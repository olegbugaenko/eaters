import { SceneVector2 } from "../services/SceneObjectManager";

interface SpatialGridItem<T> {
  readonly id: string;
  readonly position: SceneVector2;
  readonly radius: number;
  readonly payload: T;
  readonly cells: readonly string[];
}

interface CellRange {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

const cloneVector = (vector: SceneVector2): SceneVector2 => ({ x: vector.x, y: vector.y });

const clampRadius = (radius: number): number => {
  if (!Number.isFinite(radius) || radius <= 0) {
    return 0;
  }
  return radius;
};

export class SpatialGrid<T> {
  private readonly cellSize: number;
  private items = new Map<string, SpatialGridItem<T>>();
  private cells = new Map<string, Set<string>>();

  constructor(cellSize: number) {
    this.cellSize = Math.max(cellSize, 1);
  }

  public clear(): void {
    this.items.clear();
    this.cells.clear();
  }

  public set(id: string, position: SceneVector2, radius: number, payload: T): void {
    this.delete(id);

    const safeRadius = clampRadius(radius);
    const snapshot: SpatialGridItem<T> = {
      id,
      position: cloneVector(position),
      radius: safeRadius,
      payload,
      cells: this.insertIntoCells(id, position, safeRadius),
    };

    this.items.set(id, snapshot);
  }

  public delete(id: string): void {
    const existing = this.items.get(id);
    if (!existing) {
      return;
    }

    existing.cells.forEach((cellKey) => {
      const cell = this.cells.get(cellKey);
      if (!cell) {
        return;
      }
      cell.delete(id);
      if (cell.size === 0) {
        this.cells.delete(cellKey);
      }
    });

    this.items.delete(id);
  }

  public queryCircle(position: SceneVector2, radius: number): T[] {
    const safeRadius = clampRadius(radius);
    if (safeRadius <= 0 && this.items.size === 0) {
      return [];
    }

    const range = this.computeCellRange(position, safeRadius);
    const resultIds = new Set<string>();

    for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
      for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
        const cell = this.cells.get(this.getCellKey(cellX, cellY));
        if (!cell) {
          continue;
        }
        cell.forEach((id) => resultIds.add(id));
      }
    }

    if (resultIds.size === 0) {
      return [];
    }

    const result: T[] = [];
    resultIds.forEach((id) => {
      const item = this.items.get(id);
      if (!item) {
        return;
      }
      const dx = item.position.x - position.x;
      const dy = item.position.y - position.y;
      const combinedRadius = item.radius + safeRadius;
      if (combinedRadius <= 0) {
        return;
      }
      if (dx * dx + dy * dy <= combinedRadius * combinedRadius + 1e-4) {
        result.push(item.payload);
      }
    });

    return result;
  }

  private insertIntoCells(id: string, position: SceneVector2, radius: number): string[] {
    if (radius <= 0) {
      const cellX = this.coordinateToCell(position.x);
      const cellY = this.coordinateToCell(position.y);
      const key = this.getCellKey(cellX, cellY);
      this.addToCell(key, id);
      return [key];
    }

    const range = this.computeCellRange(position, radius);
    const result: string[] = [];

    for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
      for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
        const key = this.getCellKey(cellX, cellY);
        this.addToCell(key, id);
        result.push(key);
      }
    }

    return result;
  }

  private addToCell(key: string, id: string): void {
    let cell = this.cells.get(key);
    if (!cell) {
      cell = new Set<string>();
      this.cells.set(key, cell);
    }
    cell.add(id);
  }

  private computeCellRange(position: SceneVector2, radius: number): CellRange {
    const minX = this.coordinateToCell(position.x - radius);
    const maxX = this.coordinateToCell(position.x + radius);
    const minY = this.coordinateToCell(position.y - radius);
    const maxY = this.coordinateToCell(position.y + radius);
    return { minX, minY, maxX, maxY };
  }

  private coordinateToCell(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.floor(value / this.cellSize);
  }

  private getCellKey(x: number, y: number): string {
    return `${x}:${y}`;
  }
}
