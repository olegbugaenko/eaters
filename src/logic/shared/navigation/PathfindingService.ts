import type {
  SceneSize,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { isPassableFor, type PassabilityTag } from "./passability.types";
import type { ObstacleDescriptor, ObstacleProvider } from "./navigation.types";

const DEFAULT_CELL_SIZE = 14;
const DIAGONAL_COST = Math.SQRT2;
const SMALL_NUMBER = 1e-3;
const GRID_CACHE_TTL_MS = 300;
const MAX_OBSTACLE_COLLECTION_RADIUS_MULTIPLIER = 1.5;
const FALLBACK_OBSTACLE_COLLECTION_RADIUS_MULTIPLIER = 2.5;
const GLOBAL_OBSTACLE_CACHE_TTL_MS = 50;
const SEARCH_WINDOW_PADDING_CELLS = 0;
const SMOOTHING_SAFETY_PADDING_PX = 5;

const distanceSquared = (a: SceneVector2, b: SceneVector2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface PathfindingServiceOptions {
  readonly obstacles: ObstacleProvider;
  readonly getMapSize: () => SceneSize;
  readonly cellSize?: number;
}

interface PathRequest {
  readonly start: SceneVector2;
  readonly target: SceneVector2;
  readonly targetRadius: number;
  readonly entityRadius: number;
  readonly passabilityTag?: PassabilityTag;
}

export interface PathResult {
  readonly waypoints: SceneVector2[];
  readonly goalReached: boolean;
}

interface HeapNode {
  readonly index: number;
  readonly priority: number;
}

class MinHeap {
  private heap: HeapNode[] = [];

  public push(node: HeapNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  public pop(): HeapNode | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }
    const top = this.heap[0];
    const last = this.heap.pop();
    if (last && this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  public get size(): number {
    return this.heap.length;
  }

  public clear(): void {
    this.heap.length = 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent]!.priority <= this.heap[index]!.priority) {
        return;
      }
      [this.heap[parent], this.heap[index]] = [this.heap[index]!, this.heap[parent]!];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;

      if (left < length && this.heap[left]!.priority < this.heap[smallest]!.priority) {
        smallest = left;
      }
      if (right < length && this.heap[right]!.priority < this.heap[smallest]!.priority) {
        smallest = right;
      }
      if (smallest === index) {
        return;
      }
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest]!, this.heap[index]!];
      index = smallest;
    }
  }
}

interface CachedGrid {
  grid: PathGrid;
  timestamp: number;
  clearance: number;
  obstacleHash: number;
  obstacleCount: number;
  boundsKey: string;
}

interface GlobalObstacleCache {
  obstacles: ObstacleDescriptor[];
  timestamp: number;
  passabilityTag: string;
}

interface SearchBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface PathGrid {
  blocked: Uint8Array;
  cols: number;
  rows: number;
  originX: number;
  originY: number;
}

export class PathfindingService {
  private readonly obstacles: ObstacleProvider;
  private readonly getMapSize: () => SceneSize;
  private readonly cellSize: number;
  private gridCache: CachedGrid | null = null;
  private globalObstacleCache: GlobalObstacleCache | null = null;
  private readonly open = new MinHeap();
  private gScore = new Float32Array(0);
  private cameFrom = new Int32Array(0);
  private scoreStamp = new Uint32Array(0);
  private visitedStamp = new Uint32Array(0);
  private searchGeneration = 1;

  constructor(options: PathfindingServiceOptions) {
    this.obstacles = options.obstacles;
    this.getMapSize = options.getMapSize;
    this.cellSize = clampNumber(options.cellSize ?? DEFAULT_CELL_SIZE, 4, 128);
  }

  public getCellSize(): number {
    return this.cellSize;
  }

  /**
   * Збирає всі перешкоди на мапі один раз за кадр.
   * Викликай на початку tick перед обробкою pathfinding для всіх ворогів.
   */
  public cacheAllObstacles(passabilityTag: string): void {
    const now = performance.now();
    if (
      this.globalObstacleCache &&
      now - this.globalObstacleCache.timestamp < GLOBAL_OBSTACLE_CACHE_TTL_MS &&
      this.globalObstacleCache.passabilityTag === passabilityTag
    ) {
      return; // Кеш ще актуальний
    }

    const collected: ObstacleDescriptor[] = [];

    // Використовуємо швидкий метод якщо доступний
    if (this.obstacles.forEachObstacle) {
      this.obstacles.forEachObstacle((obstacle) => {
        if (!isPassableFor(obstacle, passabilityTag)) {
          collected.push(obstacle);
        }
      });
    } else {
      // Fallback для старих провайдерів
      const mapSize = this.getMapSize();
      const mapRadius = Math.hypot(mapSize.width, mapSize.height);
      const center = { x: mapSize.width * 0.5, y: mapSize.height * 0.5 };
      this.obstacles.forEachObstacleNear(center, mapRadius, (obstacle) => {
        if (!isPassableFor(obstacle, passabilityTag)) {
          collected.push(obstacle);
        }
      });
    }

    this.globalObstacleCache = {
      obstacles: collected,
      timestamp: now,
      passabilityTag,
    };
  }

  /**
   * Отримує перешкоди з глобального кешу, фільтруючи за відстанню.
   * Якщо кеш порожній, збирає перешкоди локально.
   */
  private getObstaclesInRadius(
    center: SceneVector2,
    radius: number,
    passabilityTag: string
  ): ObstacleDescriptor[] {
    if (this.globalObstacleCache && this.globalObstacleCache.passabilityTag === passabilityTag) {
      const collected: ObstacleDescriptor[] = [];
      for (const obs of this.globalObstacleCache.obstacles) {
        const dx = obs.position.x - center.x;
        const dy = obs.position.y - center.y;
        const effectiveRadius = radius + obs.radius;
        if (dx * dx + dy * dy <= effectiveRadius * effectiveRadius) {
          collected.push(obs);
        }
      }
      return collected;
    }

    const collected: ObstacleDescriptor[] = [];
    this.obstacles.forEachObstacleNear(center, radius, (obstacle) => {
      if (!isPassableFor(obstacle, passabilityTag)) {
        collected.push(obstacle);
      }
    });
    return collected;
  }

  public findPathToTarget(request: PathRequest): PathResult {
    const mapSize = this.getMapSize();
    const goalRadius = Math.max(request.targetRadius, SMALL_NUMBER);
    const clearance = Math.max(request.entityRadius, 0);
    const goalReached = distanceSquared(request.start, request.target) <= goalRadius * goalRadius;

    // Оптимізований радіус збору перешкод - тільки в релевантній області
    const pathDistance = Math.hypot(
      request.target.x - request.start.x,
      request.target.y - request.start.y
    );
    const collectionRadius = Math.min(
      pathDistance * MAX_OBSTACLE_COLLECTION_RADIUS_MULTIPLIER + clearance * 2,
      Math.hypot(mapSize.width, mapSize.height)
    );
    const fallbackCollectionRadius = Math.min(
      pathDistance * FALLBACK_OBSTACLE_COLLECTION_RADIUS_MULTIPLIER + clearance * 2,
      Math.hypot(mapSize.width, mapSize.height),
    );

    // Використовуємо глобальний кеш якщо доступний
    const center = {
      x: (request.start.x + request.target.x) * 0.5,
      y: (request.start.y + request.target.y) * 0.5,
    };
    const passabilityTag = request.passabilityTag ?? "";
    const obstacles = this.getObstaclesInRadius(center, collectionRadius, passabilityTag);

    if (goalReached || this.isLineClear(request.start, request.target, clearance, obstacles)) {
      return { waypoints: [], goalReached: true };
    }

    const expandedGoalRadius = goalRadius + this.cellSize * 0.5;
    const tryBuildPath = (radius: number): PathResult | null => {
      const localObstacles = this.getObstaclesInRadius(center, radius, passabilityTag);
      const bounds = this.getSearchBounds(mapSize, center, radius);
      const grid = this.getOrCreateGrid(localObstacles, clearance, bounds);
      const startIndex = this.findNearestWalkableIndex(request.start, grid);
      if (
        startIndex < 0 ||
        !this.hasWalkableGoalCell(request.target, expandedGoalRadius, grid)
      ) {
        return null;
      }
      const path = this.search(startIndex, grid, request.target, expandedGoalRadius);
      if (path.length === 0) {
        return null;
      }
      const smoothed = this.smoothPath(path, localObstacles, clearance);
      // console.log('path', smoothed, localObstacles, request, bounds);
      return { waypoints: smoothed.slice(1), goalReached: false };
    };

    const primaryResult = tryBuildPath(collectionRadius);
    if (primaryResult) {
      return primaryResult;
    }
    if (fallbackCollectionRadius > collectionRadius + SMALL_NUMBER) {
      const fallbackResult = tryBuildPath(fallbackCollectionRadius);
      if (fallbackResult) {
        return fallbackResult;
      }
    }
    return { waypoints: [], goalReached: false };
  }

  private isLineClear(
    start: SceneVector2,
    end: SceneVector2,
    clearance: number,
    obstacles: readonly ObstacleDescriptor[],
  ): boolean {
    for (const obstacle of obstacles) {
      const combined = obstacle.radius + clearance;
      const projection = this.projectPointOnSegment(start, end, obstacle.position);
      const distSq = distanceSquared(projection, obstacle.position);
      if (distSq <= combined * combined) {
        return false;
      }
    }
    return true;
  }

  private projectPointOnSegment(start: SceneVector2, end: SceneVector2, point: SceneVector2): SceneVector2 {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = Math.max(dx * dx + dy * dy, SMALL_NUMBER);
    const t = clampNumber(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
    return { x: lerp(start.x, end.x, t), y: lerp(start.y, end.y, t) };
  }

  private getSearchBounds(
    mapSize: SceneSize,
    center: SceneVector2,
    collectionRadius: number,
  ): SearchBounds {
    const padding = this.cellSize * SEARCH_WINDOW_PADDING_CELLS;
    return {
      minX: clampNumber(center.x - collectionRadius - padding, 0, mapSize.width),
      minY: clampNumber(center.y - collectionRadius - padding, 0, mapSize.height),
      maxX: clampNumber(center.x + collectionRadius + padding, 0, mapSize.width),
      maxY: clampNumber(center.y + collectionRadius + padding, 0, mapSize.height),
    };
  }

  private getOrCreateGrid(
    obstacles: readonly ObstacleDescriptor[],
    clearance: number,
    bounds: SearchBounds,
  ): PathGrid {
    const now = performance.now();
    const obstacleHash = this.computeObstacleHash(obstacles);
    const boundsKey = `${bounds.minX}|${bounds.minY}|${bounds.maxX}|${bounds.maxY}`;

    if (
      this.gridCache &&
      now - this.gridCache.timestamp < GRID_CACHE_TTL_MS &&
      this.gridCache.clearance === clearance &&
      this.gridCache.obstacleCount === obstacles.length &&
      this.gridCache.obstacleHash === obstacleHash &&
      this.gridCache.boundsKey === boundsKey
    ) {
      return this.gridCache.grid;
    }

    const grid = this.createGrid(bounds, obstacles, clearance);
    this.gridCache = {
      grid,
      timestamp: now,
      clearance,
      obstacleHash,
      obstacleCount: obstacles.length,
      boundsKey,
    };

    return grid;
  }

  private computeObstacleHash(obstacles: readonly ObstacleDescriptor[]): number {
    let hash = obstacles.length | 0;
    for (let i = 0; i < obstacles.length; i += 1) {
      const obstacle = obstacles[i]!;
      const x = Math.round(obstacle.position.x * 10);
      const y = Math.round(obstacle.position.y * 10);
      const radius = Math.round(obstacle.radius * 10);
      hash =
        ((hash * 31) ^ x ^ (y * 17) ^ (radius * 13)) >>> 0;
    }
    return hash;
  }

  private createGrid(bounds: SearchBounds, obstacles: readonly ObstacleDescriptor[], clearance: number): PathGrid {
    const originX = Math.floor(bounds.minX / this.cellSize) * this.cellSize;
    const originY = Math.floor(bounds.minY / this.cellSize) * this.cellSize;
    const cols = Math.max(1, Math.ceil((bounds.maxX - originX) / this.cellSize));
    const rows = Math.max(1, Math.ceil((bounds.maxY - originY) / this.cellSize));
    const cells = cols * rows;
    const half = this.cellSize * 0.5;
    const halfDiag = half * Math.SQRT2;
    const blocked = new Uint8Array(cells);

    for (const obstacle of obstacles) {
      const inflation = obstacle.radius + clearance;
      const minX = clampNumber(
        Math.floor((obstacle.position.x - inflation - originX) / this.cellSize),
        0,
        cols - 1,
      );
      const maxX = clampNumber(
        Math.floor((obstacle.position.x + inflation - originX) / this.cellSize),
        0,
        cols - 1,
      );
      const minY = clampNumber(
        Math.floor((obstacle.position.y - inflation - originY) / this.cellSize),
        0,
        rows - 1,
      );
      const maxY = clampNumber(
        Math.floor((obstacle.position.y + inflation - originY) / this.cellSize),
        0,
        rows - 1,
      );

      for (let y = minY; y <= maxY; y += 1) {
        const centerY = originY + y * this.cellSize + half;
        for (let x = minX; x <= maxX; x += 1) {
          const centerX = originX + x * this.cellSize + half;
          const dx = centerX - obstacle.position.x;
          const dy = centerY - obstacle.position.y;
          if (dx * dx + dy * dy <= (inflation + halfDiag) * (inflation + halfDiag)) {
            blocked[y * cols + x] = 1;
          }
        }
      }
    }

    return { blocked, cols, rows, originX, originY };
  }

  private findNearestWalkableIndex(
    position: SceneVector2,
    grid: PathGrid,
  ): number {
    const { cols, rows, originX, originY } = grid;
    const clampToCell = (value: number, max: number) => clampNumber(value, 0, max);
    const cellX = clampToCell(Math.floor((position.x - originX) / this.cellSize), cols - 1);
    const cellY = clampToCell(Math.floor((position.y - originY) / this.cellSize), rows - 1);
    const index = cellY * cols + cellX;
    if (grid.blocked[index] === 0) {
      return index;
    }

    const maxRadius = Math.max(cols, rows);
    for (let r = 1; r <= maxRadius; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) {
            continue;
          }
          const nx = clampToCell(cellX + dx, cols - 1);
          const ny = clampToCell(cellY + dy, rows - 1);
          const idx = ny * cols + nx;
          if (grid.blocked[idx] === 0) {
            return idx;
          }
        }
      }
    }
    return -1;
  }

  private hasWalkableGoalCell(
    target: SceneVector2,
    radius: number,
    grid: PathGrid,
  ): boolean {
    const { cols, rows, blocked, originX, originY } = grid;
    const radiusSq = radius * radius;
    const half = this.cellSize * 0.5;
    const minX = clampNumber(
      Math.floor((target.x - radius - originX) / this.cellSize),
      0,
      cols - 1,
    );
    const maxX = clampNumber(
      Math.floor((target.x + radius - originX) / this.cellSize),
      0,
      cols - 1,
    );
    const minY = clampNumber(
      Math.floor((target.y - radius - originY) / this.cellSize),
      0,
      rows - 1,
    );
    const maxY = clampNumber(
      Math.floor((target.y + radius - originY) / this.cellSize),
      0,
      rows - 1,
    );

    for (let y = minY; y <= maxY; y += 1) {
      const centerY = originY + y * this.cellSize + half;
      for (let x = minX; x <= maxX; x += 1) {
        const idx = y * cols + x;
        if (blocked[idx] !== 0) {
          continue;
        }
        const centerX = originX + x * this.cellSize + half;
        const dx = centerX - target.x;
        const dy = centerY - target.y;
        if (dx * dx + dy * dy <= radiusSq) {
          return true;
        }
      }
    }

    return false;
  }

  private search(
    start: number,
    grid: PathGrid,
    target: SceneVector2,
    goalRadius: number,
  ): SceneVector2[] {
    const { blocked, cols, rows } = grid;
    const total = blocked.length;
    this.ensureSearchCapacity(total);
    const generation = this.beginSearchGeneration();
    this.open.clear();

    const startCellX = start % cols;
    const startCellY = Math.floor(start / cols);
    const targetCellX = (target.x - grid.originX - this.cellSize * 0.5) / this.cellSize;
    const targetCellY = (target.y - grid.originY - this.cellSize * 0.5) / this.cellSize;
    const goalRadiusSq = goalRadius * goalRadius;

    this.scoreStamp[start] = generation;
    this.visitedStamp[start] = 0;
    this.gScore[start] = 0;
    this.cameFrom[start] = -1;
    this.open.push({
      index: start,
      priority: this.heuristic(startCellX, startCellY, targetCellX, targetCellY),
    });

    const neighbors: readonly [number, number, number][] = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, DIAGONAL_COST],
      [-1, 1, DIAGONAL_COST],
      [1, -1, DIAGONAL_COST],
      [-1, -1, DIAGONAL_COST],
    ];

    while (this.open.size > 0) {
      const current = this.open.pop();
      if (!current) {
        break;
      }
      if (this.visitedStamp[current.index] === generation) {
        continue;
      }
      const currentIndex = current.index;
      this.visitedStamp[currentIndex] = generation;
      const currentScore = this.gScore[currentIndex]!;
      const x = currentIndex % cols;
      const y = Math.floor(currentIndex / cols);

      if (this.isGoalIndex(currentIndex, x, y, target, goalRadiusSq, grid)) {
        return this.reconstructPath(this.cameFrom, currentIndex, grid);
      }

      for (const [dx, dy, cost] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
          continue;
        }
        const neighborIndex = ny * cols + nx;
        if (blocked[neighborIndex]) {
          continue;
        }
        if (Math.abs(dx) + Math.abs(dy) === 2) {
          const orth1 = y * cols + nx;
          const orth2 = ny * cols + x;
          if (blocked[orth1] || blocked[orth2]) {
            continue;
          }
        }
        const tentativeG = currentScore + cost;
        if (
          this.scoreStamp[neighborIndex] === generation &&
          tentativeG >= this.gScore[neighborIndex]!
        ) {
          continue;
        }
        this.scoreStamp[neighborIndex] = generation;
        this.cameFrom[neighborIndex] = currentIndex;
        this.gScore[neighborIndex] = tentativeG;
        this.open.push({
          index: neighborIndex,
          priority:
            tentativeG + this.heuristic(nx, ny, targetCellX, targetCellY),
        });
      }
    }

    return [];
  }

  private ensureSearchCapacity(total: number): void {
    if (this.gScore.length >= total) {
      return;
    }
    this.gScore = new Float32Array(total);
    this.cameFrom = new Int32Array(total);
    this.scoreStamp = new Uint32Array(total);
    this.visitedStamp = new Uint32Array(total);
  }

  private beginSearchGeneration(): number {
    this.searchGeneration += 1;
    if (this.searchGeneration === 0xffffffff) {
      this.searchGeneration = 1;
      this.scoreStamp.fill(0);
      this.visitedStamp.fill(0);
    }
    return this.searchGeneration;
  }

  private isGoalIndex(
    index: number,
    cellX: number,
    cellY: number,
    target: SceneVector2,
    goalRadiusSq: number,
    grid: PathGrid,
  ): boolean {
    if (grid.blocked[index] !== 0) {
      return false;
    }
    const centerX = grid.originX + cellX * this.cellSize + this.cellSize * 0.5;
    const centerY = grid.originY + cellY * this.cellSize + this.cellSize * 0.5;
    const dx = centerX - target.x;
    const dy = centerY - target.y;
    return dx * dx + dy * dy <= goalRadiusSq;
  }

  private heuristic(
    cellX: number,
    cellY: number,
    targetCellX: number,
    targetCellY: number,
  ): number {
    const dx = Math.abs(cellX - targetCellX);
    const dy = Math.abs(cellY - targetCellY);
    const diagonal = Math.min(dx, dy);
    const straight = Math.max(dx, dy) - diagonal;
    return diagonal * DIAGONAL_COST + straight;
  }

  private reconstructPath(cameFrom: Int32Array, current: number, grid: PathGrid): SceneVector2[] {
    const points: SceneVector2[] = [];
    let idx: number | null = current;
    while (idx !== null && idx >= 0) {
      points.push(this.indexToPosition(idx, grid));
      const parentValue: number = cameFrom[idx] ?? -1;
      idx = typeof parentValue === "number" && parentValue >= 0 ? parentValue : null;
    }
    return points.reverse();
  }

  private indexToPosition(index: number, grid: PathGrid): SceneVector2 {
    const x = index % grid.cols;
    const y = Math.floor(index / grid.cols);
    return {
      x: grid.originX + x * this.cellSize + this.cellSize * 0.5,
      y: grid.originY + y * this.cellSize + this.cellSize * 0.5,
    };
  }

  private smoothPath(
    path: SceneVector2[],
    obstacles: readonly ObstacleDescriptor[],
    clearance: number,
  ): SceneVector2[] {
    if (path.length <= 2) {
      return path;
    }
    const result: SceneVector2[] = [path[0]!];
    for (let i = 2; i < path.length; i += 1) {
      const anchor = result[result.length - 1]!;
      const candidate = path[i]!;
      if (!this.segmentClear(anchor, candidate, obstacles, clearance)) {
        result.push(path[i - 1]!);
      }
    }
    result.push(path[path.length - 1]!);
    return result;
  }

  private segmentClear(
    start: SceneVector2,
    end: SceneVector2,
    obstacles: readonly ObstacleDescriptor[],
    clearance: number,
  ): boolean {
    for (const obstacle of obstacles) {
      const expanded = obstacle.radius + clearance + SMOOTHING_SAFETY_PADDING_PX;
      const projection = this.projectPointOnSegment(start, end, obstacle.position);
      const distSq = distanceSquared(projection, obstacle.position);
      if (distSq <= expanded * expanded) {
        return false;
      }
    }
    return true;
  }
}
