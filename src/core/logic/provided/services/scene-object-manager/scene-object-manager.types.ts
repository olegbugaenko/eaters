import type { SceneFillType } from "./scene-object-manager.const";

export interface SceneVector2 {
  x: number;
  y: number;
}

export interface SceneSize {
  width: number;
  height: number;
}

export interface SceneColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface SceneStroke {
  color: SceneColor;
  width: number;
}

export interface SceneGradientStop {
  offset: number;
  color: SceneColor;
}

export interface SceneFillNoise {
  colorAmplitude: number;
  alphaAmplitude: number;
  scale: number;
  /** Controls sparsity of noise (0-1). Lower = fewer visible fluctuations. Default 1. */
  density?: number;
}

export interface SceneFillFilaments {
  colorContrast: number;
  alphaContrast: number;
  width: number;
  density: number;
  edgeBlur: number;
}

interface SceneFillCommon {
  noise?: SceneFillNoise;
  filaments?: SceneFillFilaments;
  crackMask?: { atlasId: number; tileIndex: number; strength: number; desat: number; darken: number };
}

export interface SceneSolidFill extends SceneFillCommon {
  fillType: SceneFillType;
  color: SceneColor;
}

export interface SceneLinearGradientFill extends SceneFillCommon {
  fillType: SceneFillType;
  start?: SceneVector2;
  end?: SceneVector2;
  stops: readonly SceneGradientStop[];
}

export interface SceneRadialGradientFill extends SceneFillCommon {
  fillType: SceneFillType;
  start?: SceneVector2;
  end?: number;
  stops: readonly SceneGradientStop[];
}

export interface SceneDiamondGradientFill extends SceneFillCommon {
  fillType: SceneFillType;
  start?: SceneVector2;
  end?: number;
  stops: readonly SceneGradientStop[];
}

export interface SceneSpriteFill extends SceneFillCommon {
  fillType: SceneFillType;
  spritePath: string;
  color?: SceneColor; // Optional tint color
}

export type SceneFill =
  | SceneSolidFill
  | SceneLinearGradientFill
  | SceneRadialGradientFill
  | SceneDiamondGradientFill
  | SceneSpriteFill;

export interface SceneObjectData {
  position: SceneVector2;
  renderPosition?: SceneVector2;
  size?: SceneSize;
  color?: SceneColor;
  fill?: SceneFill;
  rotation?: number;
  stroke?: SceneStroke;
  customData?: unknown;
}

export interface SceneObjectInstance {
  id: string;
  type: string;
  data: SceneObjectData & { fill: SceneFill; stroke?: SceneStroke };
}

export interface SceneCameraState {
  position: SceneVector2;
  viewportSize: SceneSize;
  scale: number;
}

// Internal types
export interface CustomDataCacheEntry {
  clone: unknown;
  snapshot: unknown;
  version: number;
  snapshotVersion: number;
}

export interface MutableCloneResult<T> {
  clone: T;
  changed: boolean;
}

export interface SceneUiApi {
  addObject(type: string, data: SceneObjectData): string;
  updateObject(id: string, data: SceneObjectData): void;
  getObjects(): readonly SceneObjectInstance[];
  getMovableObjects(): readonly SceneObjectInstance[];
  forEachMovableObject(callback: (instance: SceneObjectInstance) => void): void;
  getMovableObjectCount(): number;
  getCamera(): SceneCameraState;
  getScaleRange(): { min: number; max: number };
  setScale(value: number): void;
  getMapSize(): SceneSize;
  setMapSize(size: SceneSize): void;
  setViewportScreenSize(width: number, height: number): void;
  setCameraPosition(x: number, y: number): void;
  panCamera(deltaX: number, deltaY: number): void;
  flushChanges(): {
    added: SceneObjectInstance[];
    updated: SceneObjectInstance[];
    removed: string[];
  };
  flushAllPendingRemovals(): string[];
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    scene: SceneUiApi;
  }
}
