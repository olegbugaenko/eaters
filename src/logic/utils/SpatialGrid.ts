import { SceneVector2 } from "../services/scene-object-manager/scene-object-manager.types";
import { cloneVector } from "@shared/helpers/vector.helper";

interface SpatialGridItem<T> {
  readonly id: string;
  readonly position: SceneVector2;
  readonly radius: number;
  readonly payload: T;
  readonly cells: readonly number[]; // Числові ключі
}

interface CellRange {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

const clampRadius = (radius: number): number => {
  if (!Number.isFinite(radius) || radius <= 0) {
    return 0;
  }
  return radius;
};

// Числовий ключ для клітинки - набагато швидше ніж строки
const packCellKey = (x: number, y: number): number => {
  // Зсуваємо координати щоб підтримувати негативні значення
  // Використовуємо 16-bit для кожної координати (-32768 до 32767)
  const sx = (x + 32768) & 0xFFFF;
  const sy = (y + 32768) & 0xFFFF;
  return (sx << 16) | sy;
};

export class SpatialGrid<T> {
  private readonly cellSize: number;
  private items = new Map<string, SpatialGridItem<T>>();
  private cells = new Map<number, Set<string>>();
  private readonly visitedSet = new Set<string>(); // Переиспользовуваний Set

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

    const cells = existing.cells;
    for (let i = 0; i < cells.length; i++) {
      const cellKey = cells[i]!;
      const cell = this.cells.get(cellKey);
      if (!cell) {
        continue;
      }
      cell.delete(id);
      if (cell.size === 0) {
        this.cells.delete(cellKey);
      }
    }

    this.items.delete(id);
  }

  public queryCircle(position: SceneVector2, radius: number): T[] {
    const safeRadius = clampRadius(radius);
    if (safeRadius <= 0 && this.items.size === 0) {
      return [];
    }

    const range = this.computeCellRange(position, safeRadius);
    const visited = this.visitedSet;
    visited.clear();

    const result: T[] = [];
    const radiusSq = safeRadius * safeRadius;

    for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
      for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
        const cell = this.cells.get(packCellKey(cellX, cellY));
        if (!cell) {
          continue;
        }
        for (const id of cell) {
          if (visited.has(id)) {
            continue;
          }
          visited.add(id);
          const item = this.items.get(id);
          if (!item) {
            continue;
          }
          const dx = item.position.x - position.x;
          const dy = item.position.y - position.y;
          const combinedRadius = item.radius + safeRadius;
          if (combinedRadius <= 0) {
            continue;
          }
          if (dx * dx + dy * dy <= combinedRadius * combinedRadius + 1e-4) {
            result.push(item.payload);
          }
        }
      }
    }

    return result;
  }

  public forEachInCircle(
    position: SceneVector2,
    radius: number,
    visitor: (payload: T) => void
  ): void {
    const safeRadius = clampRadius(radius);
    if (safeRadius <= 0 && this.items.size === 0) {
      return;
    }

    const range = this.computeCellRange(position, safeRadius);
    const visited = this.visitedSet;
    visited.clear();

    for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
      for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
        const cell = this.cells.get(packCellKey(cellX, cellY));
        if (!cell) {
          continue;
        }
        for (const id of cell) {
          if (visited.has(id)) {
            continue;
          }
          visited.add(id);
          const item = this.items.get(id);
          if (!item) {
            continue;
          }
          const dx = item.position.x - position.x;
          const dy = item.position.y - position.y;
          const combinedRadius = item.radius + safeRadius;
          if (combinedRadius <= 0) {
            continue;
          }
          if (dx * dx + dy * dy <= combinedRadius * combinedRadius + 1e-4) {
            visitor(item.payload);
          }
        }
      }
    }
  }

  /**
   * Ітерує через ВСІ елементи без просторової фільтрації.
   * Набагато швидше ніж forEachInCircle з величезним радіусом.
   */
  public forEachItem(visitor: (payload: T) => void): void {
    for (const item of this.items.values()) {
      visitor(item.payload);
    }
  }

  /**
   * Повертає всі елементи як масив.
   */
  public getAllItems(): T[] {
    const result: T[] = [];
    for (const item of this.items.values()) {
      result.push(item.payload);
    }
    return result;
  }

  public queryNearest(position: SceneVector2, options?: { maxLayers?: number }): T | null {
    if (this.items.size === 0) {
      return null;
    }

    const centerCellX = this.coordinateToCell(position.x);
    const centerCellY = this.coordinateToCell(position.y);
    const maxLayers = Math.max(0, Math.floor(options?.maxLayers ?? 64));

    let bestId: string | null = null;
    let bestDistSq = Infinity;

    for (let layer = 0; layer <= maxLayers; layer += 1) {
      if (layer === 0) {
        const cell = this.cells.get(packCellKey(centerCellX, centerCellY));
        if (cell) {
          for (const id of cell) {
            const item = this.items.get(id);
            if (!item) continue;
            const dx = item.position.x - position.x;
            const dy = item.position.y - position.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDistSq) {
              bestDistSq = distSq;
              bestId = id;
            }
          }
        }
      } else {
        const minX = centerCellX - layer;
        const maxX = centerCellX + layer;
        const minY = centerCellY - layer;
        const maxY = centerCellY + layer;

        // top and bottom rows
        for (let x = minX; x <= maxX; x += 1) {
          this.considerCellForNearest(x, minY, position, bestDistSq, (distSq, id) => {
            if (distSq < bestDistSq) {
              bestDistSq = distSq;
              bestId = id;
            }
          });
          this.considerCellForNearest(x, maxY, position, bestDistSq, (distSq, id) => {
            if (distSq < bestDistSq) {
              bestDistSq = distSq;
              bestId = id;
            }
          });
        }
        // left and right columns (excluding corners already handled)
        for (let y = minY + 1; y <= maxY - 1; y += 1) {
          this.considerCellForNearest(minX, y, position, bestDistSq, (distSq, id) => {
            if (distSq < bestDistSq) {
              bestDistSq = distSq;
              bestId = id;
            }
          });
          this.considerCellForNearest(maxX, y, position, bestDistSq, (distSq, id) => {
            if (distSq < bestDistSq) {
              bestDistSq = distSq;
              bestId = id;
            }
          });
        }
      }

      if (bestId !== null) {
        const best = this.items.get(bestId);
        return best ? best.payload : null;
      }
    }

    return null;
  }

  private considerCellForNearest(
    cellX: number,
    cellY: number,
    position: SceneVector2,
    currentBest: number,
    update: (distSq: number, id: string) => void
  ): void {
    const cell = this.cells.get(packCellKey(cellX, cellY));
    if (!cell) return;
    for (const id of cell) {
      const item = this.items.get(id);
      if (!item) continue;
      const dx = item.position.x - position.x;
      const dy = item.position.y - position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < currentBest) {
        update(distSq, id);
      }
    }
  }

  private insertIntoCells(id: string, position: SceneVector2, radius: number): number[] {
    if (radius <= 0) {
      const cellX = this.coordinateToCell(position.x);
      const cellY = this.coordinateToCell(position.y);
      const key = packCellKey(cellX, cellY);
      this.addToCell(key, id);
      return [key];
    }

    const range = this.computeCellRange(position, radius);
    const result: number[] = [];

    for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
      for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
        const key = packCellKey(cellX, cellY);
        this.addToCell(key, id);
        result.push(key);
      }
    }

    return result;
  }

  private addToCell(key: number, id: string): void {
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
}
