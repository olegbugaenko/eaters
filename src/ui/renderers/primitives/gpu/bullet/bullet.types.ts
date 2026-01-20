import type { SceneColor, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ExtendedGpuBatch } from "../../core/GpuBatchRenderer";
import type { BulletSpriteName } from "@logic/services/bullet-render-bridge/bullet-sprites.const";

export type BulletShape = "circle" | "sprite";

export interface BulletVisualConfig {
  /** Unique key identifying this visual type (e.g., "default", "ice", "fire") */
  readonly visualKey: string;
  /** Base color for the bullet body (used if centerColor not set) */
  readonly bodyColor: SceneColor;
  /** Color at the start of the tail (near bullet) */
  readonly tailStartColor: SceneColor;
  /** Color at the end of the tail (fading out) */
  readonly tailEndColor: SceneColor;
  /** Tail length multiplier relative to bullet radius */
  readonly tailLengthMultiplier: number;
  /** Tail width multiplier relative to bullet radius */
  readonly tailWidthMultiplier: number;
  /** Tail offset along movement axis (positive = forward, negative = backward) */
  readonly tailOffsetMultiplier?: number;
  /** Shape: "circle" for procedural, "sprite" for texture */
  readonly shape: BulletShape;
  /** If set, body uses radial gradient from center to edge */
  readonly centerColor?: SceneColor;
  readonly edgeColor?: SceneColor;
  /** Sprite name (converted to index by logic layer) */
  readonly spriteName?: BulletSpriteName;
  /** Sprite index in texture array (used when shape === "sprite") */
  readonly spriteIndex?: number;
}

export interface BulletInstance {
  position: SceneVector2;
  rotation: number;
  radius: number;
  active: boolean;
}

export interface BulletBatchConfig {
  batchKey: string;
  config: BulletVisualConfig;
}

export interface BulletBatch extends ExtendedGpuBatch<BulletInstance> {
  visualKey: string;
  config: BulletVisualConfig;
}

export interface BulletSharedResources {
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  spriteTexture: WebGLTexture | null;
  spriteCount: number;
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    bodyColor: WebGLUniformLocation | null;
    tailStartColor: WebGLUniformLocation | null;
    tailEndColor: WebGLUniformLocation | null;
    tailLengthMul: WebGLUniformLocation | null;
    tailWidthMul: WebGLUniformLocation | null;
    shapeType: WebGLUniformLocation | null;
    renderPass: WebGLUniformLocation | null;
    centerColor: WebGLUniformLocation | null;
    edgeColor: WebGLUniformLocation | null;
    useRadialGradient: WebGLUniformLocation | null;
    spriteArray: WebGLUniformLocation | null;
    spriteIndex: WebGLUniformLocation | null;
    tailOffsetMul: WebGLUniformLocation | null;
  };
  attributes: {
    unitPosition: number;
    instancePosition: number;
    instanceRotation: number;
    instanceRadius: number;
    instanceActive: number;
  };
}
