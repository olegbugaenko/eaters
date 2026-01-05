import type {
  SceneSize,
  SceneVector2,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { isPassableFor, type PassabilityTag } from "./passability.types";
import type { ObstacleDescriptor, ObstacleProvider } from "./navigation.types";

const DEFAULT_CELL_SIZE = 14;
const DIAGONAL_COST = Math.SQRT2;
const SMALL_NUMBER = 1e-3;

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

export class PathfindingService {
  private readonly obstacles: ObstacleProvider;
  private readonly getMapSize: () => SceneSize;
  private readonly cellSize: number;

  constructor(options: PathfindingServiceOptions) {
    this.obstacles = options.obstacles;
    this.getMapSize = options.getMapSize;
    this.cellSize = clampNumber(options.cellSize ?? DEFAULT_CELL_SIZE, 4, 128);
  }

  public getCellSize(): number {
    return this.cellSize;
  }

  public findPathToTarget(request: PathRequest): PathResult {
    const mapSize = this.getMapSize();
    const goalRadius = Math.max(request.targetRadius, SMALL_NUMBER);
    const clearance = Math.max(request.entityRadius, 0);
    const goalReached = distanceSquared(request.start, request.target) <= goalRadius * goalRadius;

    const obstacles = this.collectObstacles(request, Math.hypot(mapSize.width, mapSize.height));

    if (goalReached || this.isLineClear(request.start, request.target, clearance, obstacles)) {
      return { waypoints: [], goalReached: true };
    }

    const grid = this.createGrid(mapSize, obstacles, clearance);
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

  private collectObstacles(request: PathRequest, radius: number): ObstacleDescriptor[] {
    const center = {
      x: (request.start.x + request.target.x) * 0.5,
      y: (request.start.y + request.target.y) * 0.5,
    } satisfies SceneVector2;
    const collected: ObstacleDescriptor[] = [];
    this.obstacles.forEachObstacleNear(center, radius, (obstacle) => {
      if (!isPassableFor(obstacle, request.passabilityTag ?? "")) {
        collected.push(obstacle);
      }
    });
    return collected;
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

