import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";
import { BrickConfig, BrickType, getBrickConfig, isBrickType } from "../../db/bricks-db";
import {
  FILL_TYPES,
  SceneObjectManager,
  SceneVector2,
} from "../services/SceneObjectManager";

const DEFAULT_BRICK_TYPE: BrickType = "classic";

const createBrickFill = (config: BrickConfig) => {
  const fill = config.fill;
  switch (fill.type) {
    case "solid":
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
      };
    case "radial":
      return {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: fill.center ? { ...fill.center } : undefined,
        end: fill.radius,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
      };
    case "linear":
    default:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
      };
  }
};

export const BRICK_COUNT_BRIDGE_KEY = "bricks/count";

export interface BrickData {
  position: SceneVector2;
  rotation: number;
  type: BrickType;
}

interface BricksModuleOptions {
  scene: SceneObjectManager;
  bridge: DataBridge;
}

interface BrickSaveData {
  bricks: BrickData[];
}

export class BricksModule implements GameModule {
  public readonly id = "bricks";

  private bricks: BrickData[] = [];
  private objectIds = new Set<string>();

  constructor(private readonly options: BricksModuleOptions) {}

  public initialize(): void {
    this.pushCount();
  }

  public reset(): void {
    this.applyBricks([]);
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.applyBricks(parsed.bricks);
      return;
    }
    this.pushCount();
  }

  public save(): unknown {
    return {
      bricks: this.bricks.map((brick) => ({
        position: { ...brick.position },
        rotation: brick.rotation,
        type: brick.type,
      })),
    } satisfies BrickSaveData;
  }

  public tick(_deltaMs: number): void {
    // Bricks are static for now.
  }

  public setBricks(bricks: BrickData[]): void {
    this.applyBricks(bricks);
  }

  private parseSaveData(data: unknown): BrickSaveData | null {
    if (
      typeof data !== "object" ||
      data === null ||
      !("bricks" in data) ||
      !Array.isArray((data as { bricks: unknown }).bricks)
    ) {
      return null;
    }

    const bricksInput = (data as BrickSaveData).bricks;
    const sanitized: BrickData[] = [];

    bricksInput.forEach((brick) => {
      if (
        brick &&
        typeof brick === "object" &&
        "position" in brick &&
        typeof brick.position === "object" &&
        brick.position !== null &&
        typeof brick.position.x === "number" &&
        typeof brick.position.y === "number"
      ) {
        sanitized.push({
          position: this.clampToMap(brick.position),
          rotation: sanitizeRotation((brick as BrickData).rotation),
          type: sanitizeBrickType((brick as BrickData).type),
        });
      }
    });

    return { bricks: sanitized };
  }

  private applyBricks(bricks: BrickData[]): void {
    this.clearSceneObjects();
    this.bricks = bricks.map((brick) => ({
      position: this.clampToMap(brick.position),
      rotation: sanitizeRotation(brick.rotation),
      type: sanitizeBrickType(brick.type),
    }));

    this.bricks.forEach((brick) => {
      const config = getBrickConfig(brick.type);
      const id = this.options.scene.addObject("brick", {
        position: brick.position,
        size: { ...config.size },
        fill: createBrickFill(config),
        rotation: brick.rotation,
        stroke: config.stroke
          ? {
              color: { ...config.stroke.color },
              width: config.stroke.width,
            }
          : undefined,
      });
      this.objectIds.add(id);
    });

    this.pushCount();
  }

  private clearSceneObjects(): void {
    this.objectIds.forEach((id) => {
      this.options.scene.removeObject(id);
    });
    this.objectIds.clear();
  }

  private pushCount(): void {
    this.options.bridge.setValue(BRICK_COUNT_BRIDGE_KEY, this.bricks.length);
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const { width, height } = this.options.scene.getMapSize();
    return {
      x: clamp(position.x, 0, width),
      y: clamp(position.y, 0, height),
    };
  }

}

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const sanitizeRotation = (value: number | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return Math.random() * Math.PI * 2;
};

const sanitizeBrickType = (value: BrickType | undefined): BrickType => {
  if (isBrickType(value)) {
    return value;
  }
  return DEFAULT_BRICK_TYPE;
};
