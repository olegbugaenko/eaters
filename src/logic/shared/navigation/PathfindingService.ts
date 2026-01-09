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
const GRID_CACHE_TTL_MS = 300; // Кешуємо сітку на 300мс (було 150)
const MAX_OBSTACLE_COLLECTION_RADIUS_MULTIPLIER = 1.5; // Збираємо перешкоди тільки в 1.5x відстані від шляху
const GLOBAL_OBSTACLE_CACHE_TTL_MS = 50; // Кеш перешкод на кадр (~20 FPS)

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
  obstacles: ObstacleDescriptor[];
  grid: { blocked: Uint8Array; cols: number; rows: number };
  timestamp: number;
  clearance: number;
  mapSize: SceneSize;
}

interface GlobalObstacleCache {
  obstacles: ObstacleDescriptor[];
  timestamp: number;
  passabilityTag: string;
}

export class PathfindingService {
  private readonly obstacles: ObstacleProvider;
  private readonly getMapSize: () => SceneSize;
  private readonly cellSize: number;
  private gridCache: CachedGrid | null = null;
  private globalObstacleCache: GlobalObstacleCache | null = null;

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
    // Якщо є глобальний кеш - фільтруємо його (O(n), але без forEachObstacleNear)
    if (this.globalObstacleCache && this.globalObstacleCache.passabilityTag === passabilityTag) {
      const radiusSq = radius * radius;
      return this.globalObstacleCache.obstacles.filter((obs) => {
        const dx = obs.position.x - center.x;
        const dy = obs.position.y - center.y;
        // Враховуємо радіус перешкоди
        const effectiveRadius = radius + obs.radius;
        return dx * dx + dy * dy <= effectiveRadius * effectiveRadius;
      });
    }

    // Fallback: збираємо локально
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

    // Використовуємо кешовану сітку якщо можливо
    const grid = this.getOrCreateGrid(mapSize, obstacles, clearance);
    const startIndex = this.findNearestWalkableIndex(request.start, grid);
    const goalMask = this.computeGoalMask(request.target, goalRadius + this.cellSize * 0.5, grid);

    if (startIndex < 0 || goalMask.every((value) => !value)) {
      return { waypoints: [], goalReached: false };
    }

    const path = this.search(startIndex, goalMask, grid, request.target);
    if (path.length === 0) {
      return { waypoints: [], goalReached: false };
    }

    const smoothed = this.smoothPath(path, obstacles, clearance);
    return { waypoints: smoothed.slice(1), goalReached: false };
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

  /**
   * Отримує кешовану сітку або створює нову
   */
  private getOrCreateGrid(
    mapSize: SceneSize,
    obstacles: readonly ObstacleDescriptor[],
    clearance: number
  ): { blocked: Uint8Array; cols: number; rows: number } {
    const now = performance.now();
    
    // Перевіряємо чи кеш валідний
    if (
      this.gridCache &&
      now - this.gridCache.timestamp < GRID_CACHE_TTL_MS &&
      this.gridCache.clearance === clearance &&
      this.gridCache.mapSize.width === mapSize.width &&
      this.gridCache.mapSize.height === mapSize.height &&
      this.areObstaclesSimilar(this.gridCache.obstacles, obstacles)
    ) {
      // Використовуємо кеш, але оновлюємо перешкоди які змінилися
      const updatedGrid = this.updateGridForChangedObstacles(
        this.gridCache.grid,
        this.gridCache.obstacles,
        obstacles,
        clearance
      );
      
      // Оновлюємо кеш
      this.gridCache.obstacles = [...obstacles];
      this.gridCache.grid = updatedGrid;
      this.gridCache.timestamp = now;
      
      return updatedGrid;
    }

    // Створюємо нову сітку
    const grid = this.createGrid(mapSize, obstacles, clearance);
    
    // Кешуємо
    this.gridCache = {
      obstacles: [...obstacles],
      grid,
      timestamp: now,
      clearance,
      mapSize: { ...mapSize },
    };

    return grid;
  }

  /**
   * Перевіряє чи перешкоди схожі (для кешування)
   */
  private areObstaclesSimilar(
    cached: readonly ObstacleDescriptor[],
    current: readonly ObstacleDescriptor[]
  ): boolean {
    // Якщо кількість сильно відрізняється - точно не схожі
    if (Math.abs(cached.length - current.length) > cached.length * 0.1) {
      return false;
    }

    // Швидка перевірка - якщо кількість однакова, вважаємо схожими
    // (детальна перевірка була б занадто дорогою)
    return cached.length === current.length;
  }

  /**
   * Оновлює сітку тільки для змінених перешкод (інкрементальне оновлення)
   */
  private updateGridForChangedObstacles(
    grid: { blocked: Uint8Array; cols: number; rows: number },
    oldObstacles: readonly ObstacleDescriptor[],
    newObstacles: readonly ObstacleDescriptor[],
    clearance: number
  ): { blocked: Uint8Array; cols: number; rows: number } {
    const mapSize = this.getMapSize();
    
    // Якщо перешкод багато, простіше пересоздати сітку
    if (newObstacles.length > 200) {
      return this.createGrid(mapSize, newObstacles, clearance);
    }

    // Створюємо мапу старих перешкод для швидкого пошуку
    const oldMap = new Map<string, ObstacleDescriptor>();
    oldObstacles.forEach((obs) => {
      const key = `${obs.position.x.toFixed(1)},${obs.position.y.toFixed(1)},${obs.radius.toFixed(1)}`;
      oldMap.set(key, obs);
    });

    // Знаходимо видалені перешкоди (були в старому, немає в новому)
    const removed: ObstacleDescriptor[] = [];
    oldMap.forEach((obs) => {
      const key = `${obs.position.x.toFixed(1)},${obs.position.y.toFixed(1)},${obs.radius.toFixed(1)}`;
      if (!newObstacles.some((n) => {
        const nKey = `${n.position.x.toFixed(1)},${n.position.y.toFixed(1)},${n.radius.toFixed(1)}`;
        return nKey === key;
      })) {
        removed.push(obs);
      }
    });

    // Знаходимо додані перешкоди (є в новому, немає в старому)
    const added: ObstacleDescriptor[] = [];
    newObstacles.forEach((obs) => {
      const key = `${obs.position.x.toFixed(1)},${obs.position.y.toFixed(1)},${obs.radius.toFixed(1)}`;
      if (!oldMap.has(key)) {
        added.push(obs);
      }
    });

    // Якщо змін занадто багато - пересоздаємо сітку
    if (removed.length + added.length > Math.max(newObstacles.length * 0.3, 50)) {
      const mapSize = this.getMapSize();
      return this.createGrid(mapSize, newObstacles, clearance);
    }

    // Інкрементальне оновлення: очищаємо клітинки від видалених перешкод
    this.clearObstaclesFromGrid(grid, removed, clearance);
    
    // Додаємо нові перешкоди
    this.addObstaclesToGrid(grid, added, clearance);

    return grid;
  }

  /**
   * Видаляє перешкоди з сітки
   */
  private clearObstaclesFromGrid(
    grid: { blocked: Uint8Array; cols: number; rows: number },
    obstacles: readonly ObstacleDescriptor[],
    clearance: number
  ): void {
    const { blocked, cols, rows } = grid;
    const half = this.cellSize * 0.5;
    const halfDiag = half * Math.SQRT2;

    for (const obstacle of obstacles) {
      const inflation = obstacle.radius + clearance;
      const minX = clampNumber(Math.floor((obstacle.position.x - inflation) / this.cellSize), 0, cols - 1);
      const maxX = clampNumber(Math.floor((obstacle.position.x + inflation) / this.cellSize), 0, cols - 1);
      const minY = clampNumber(Math.floor((obstacle.position.y - inflation) / this.cellSize), 0, rows - 1);
      const maxY = clampNumber(Math.floor((obstacle.position.y + inflation) / this.cellSize), 0, rows - 1);

      for (let y = minY; y <= maxY; y += 1) {
        const centerY = y * this.cellSize + half;
        for (let x = minX; x <= maxX; x += 1) {
          const centerX = x * this.cellSize + half;
          const dx = centerX - obstacle.position.x;
          const dy = centerY - obstacle.position.y;
          if (dx * dx + dy * dy <= (inflation + halfDiag) * (inflation + halfDiag)) {
            blocked[y * cols + x] = 0; // Очищаємо
          }
        }
      }
    }
  }

  /**
   * Додає перешкоди до сітки
   */
  private addObstaclesToGrid(
    grid: { blocked: Uint8Array; cols: number; rows: number },
    obstacles: readonly ObstacleDescriptor[],
    clearance: number
  ): void {
    const { blocked, cols, rows } = grid;
    const half = this.cellSize * 0.5;
    const halfDiag = half * Math.SQRT2;

    for (const obstacle of obstacles) {
      const inflation = obstacle.radius + clearance;
      const minX = clampNumber(Math.floor((obstacle.position.x - inflation) / this.cellSize), 0, cols - 1);
      const maxX = clampNumber(Math.floor((obstacle.position.x + inflation) / this.cellSize), 0, cols - 1);
      const minY = clampNumber(Math.floor((obstacle.position.y - inflation) / this.cellSize), 0, rows - 1);
      const maxY = clampNumber(Math.floor((obstacle.position.y + inflation) / this.cellSize), 0, rows - 1);

      for (let y = minY; y <= maxY; y += 1) {
        const centerY = y * this.cellSize + half;
        for (let x = minX; x <= maxX; x += 1) {
          const centerX = x * this.cellSize + half;
          const dx = centerX - obstacle.position.x;
          const dy = centerY - obstacle.position.y;
          if (dx * dx + dy * dy <= (inflation + halfDiag) * (inflation + halfDiag)) {
            blocked[y * cols + x] = 1; // Блокуємо
          }
        }
      }
    }
  }

  private createGrid(map: SceneSize, obstacles: readonly ObstacleDescriptor[], clearance: number) {
    const cols = Math.max(1, Math.ceil(map.width / this.cellSize));
    const rows = Math.max(1, Math.ceil(map.height / this.cellSize));
    const cells = cols * rows;
    const half = this.cellSize * 0.5;
    const halfDiag = half * Math.SQRT2;
    const blocked = new Uint8Array(cells);

    for (const obstacle of obstacles) {
      const inflation = obstacle.radius + clearance;
      const minX = clampNumber(Math.floor((obstacle.position.x - inflation) / this.cellSize), 0, cols - 1);
      const maxX = clampNumber(Math.floor((obstacle.position.x + inflation) / this.cellSize), 0, cols - 1);
      const minY = clampNumber(Math.floor((obstacle.position.y - inflation) / this.cellSize), 0, rows - 1);
      const maxY = clampNumber(Math.floor((obstacle.position.y + inflation) / this.cellSize), 0, rows - 1);

      for (let y = minY; y <= maxY; y += 1) {
        const centerY = y * this.cellSize + half;
        for (let x = minX; x <= maxX; x += 1) {
          const centerX = x * this.cellSize + half;
          const dx = centerX - obstacle.position.x;
          const dy = centerY - obstacle.position.y;
          if (dx * dx + dy * dy <= (inflation + halfDiag) * (inflation + halfDiag)) {
            blocked[y * cols + x] = 1;
          }
        }
      }
    }

    return { blocked, cols, rows };
  }

  private findNearestWalkableIndex(
    position: SceneVector2,
    grid: { blocked: Uint8Array; cols: number; rows: number },
  ): number {
    const { cols, rows } = grid;
    const clampToCell = (value: number, max: number) => clampNumber(value, 0, max);
    const cellX = clampToCell(Math.floor(position.x / this.cellSize), cols - 1);
    const cellY = clampToCell(Math.floor(position.y / this.cellSize), rows - 1);
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

  private computeGoalMask(
    target: SceneVector2,
    radius: number,
    grid: { blocked: Uint8Array; cols: number; rows: number },
  ): Uint8Array {
    const { cols, rows, blocked } = grid;
    const mask = new Uint8Array(blocked.length);
    const radiusSq = radius * radius;
    const half = this.cellSize * 0.5;

    for (let y = 0; y < rows; y += 1) {
      const centerY = y * this.cellSize + half;
      for (let x = 0; x < cols; x += 1) {
        const idx = y * cols + x;
        if (blocked[idx] !== 0) {
          continue;
        }
        const centerX = x * this.cellSize + half;
        const dx = centerX - target.x;
        const dy = centerY - target.y;
        if (dx * dx + dy * dy <= radiusSq) {
          mask[idx] = 1;
        }
      }
    }

    return mask;
  }

  private search(
    start: number,
    goalMask: Uint8Array,
    grid: { blocked: Uint8Array; cols: number; rows: number },
    target: SceneVector2,
  ): SceneVector2[] {
    const { blocked, cols, rows } = grid;
    const total = blocked.length;
    const gScore = new Float32Array(total);
    const fScore = new Float32Array(total);
    const cameFrom = new Int32Array(total).fill(-1);
    const open = new MinHeap();
    const visited = new Uint8Array(total);

    for (let i = 0; i < total; i += 1) {
      gScore[i] = Number.POSITIVE_INFINITY;
      fScore[i] = Number.POSITIVE_INFINITY;
    }

    gScore[start] = 0;
    fScore[start] = this.heuristic(this.indexToPosition(start, cols), target);
    open.push({ index: start, priority: fScore[start] });

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

    while (open.size > 0) {
      const current = open.pop();
      if (!current) {
        break;
      }
      if (visited[current.index]) {
        continue;
      }
      const currentIndex = current.index;
      const currentScore = gScore[currentIndex];
      if (currentScore === undefined) {
        continue;
      }
      visited[currentIndex] = 1;

      if (goalMask[currentIndex]) {
        return this.reconstructPath(cameFrom, currentIndex, cols);
      }

      const { x, y } = this.indexToCell(currentIndex, cols);
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
        const neighborScore = gScore[neighborIndex];
        if (neighborScore === undefined || tentativeG >= neighborScore) {
          continue;
        }
        cameFrom[neighborIndex] = currentIndex;
        gScore[neighborIndex] = tentativeG;
        fScore[neighborIndex] = tentativeG + this.heuristic(this.indexToPosition(neighborIndex, cols), target);
        open.push({ index: neighborIndex, priority: fScore[neighborIndex] });
      }
    }

    return [];
  }

  private heuristic(position: SceneVector2, target: SceneVector2): number {
    return Math.hypot(position.x - target.x, position.y - target.y) / this.cellSize;
  }

  private reconstructPath(cameFrom: Int32Array, current: number, cols: number): SceneVector2[] {
    const points: SceneVector2[] = [];
    let idx: number | null = current;
    while (idx !== null && idx >= 0) {
      points.push(this.indexToPosition(idx, cols));
      const parentValue: number = cameFrom[idx] ?? -1;
      idx = typeof parentValue === "number" && parentValue >= 0 ? parentValue : null;
    }
    return points.reverse();
  }

  private indexToPosition(index: number, cols: number): SceneVector2 {
    const x = index % cols;
    const y = Math.floor(index / cols);
    return { x: x * this.cellSize + this.cellSize * 0.5, y: y * this.cellSize + this.cellSize * 0.5 };
  }

  private indexToCell(index: number, cols: number): { x: number; y: number } {
    return { x: index % cols, y: Math.floor(index / cols) };
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
    const combinedClearanceSq = clearance * clearance;
    for (const obstacle of obstacles) {
      const expanded = obstacle.radius + clearance;
      const projection = this.projectPointOnSegment(start, end, obstacle.position);
      const distSq = distanceSquared(projection, obstacle.position);
      if (distSq <= expanded * expanded - combinedClearanceSq + SMALL_NUMBER) {
        return false;
      }
    }
    return true;
  }
}

