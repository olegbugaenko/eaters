import type { SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import type { ExtendedGpuBatch } from "../../core/GpuBatchRenderer";
import type { ParticleEmitterGpuRenderUniforms } from "../particle-emitter";

export interface WaveInstance {
  position: SceneVector2;
  size: number; // diameter in world units
  age: number;
  lifetime: number;
  active: boolean;
  startAlpha: number; // alpha at age=0
  endAlpha: number; // alpha at age=lifetime
}

export type WaveUniformConfig = Omit<
  ParticleEmitterGpuRenderUniforms,
  | "minParticleSize"
  | "shape"
  | "stopOffsets"
  | "stopColor0"
  | "stopColor1"
  | "stopColor2"
  | "stopColor3"
  | "stopColor4"
  | "linearStart"
  | "linearEnd"
  | "radialOffset"
  | "sizeGrowthRate"
> & {
  stopOffsets: Float32Array;
  stopColor0: Float32Array;
  stopColor1: Float32Array;
  stopColor2: Float32Array;
  stopColor3: Float32Array;
  stopColor4: Float32Array;
  linearStart?: SceneVector2;
  linearEnd?: SceneVector2;
  radialOffset?: SceneVector2;
};

export interface WaveBatch extends ExtendedGpuBatch<WaveInstance> {
  uniforms: ParticleEmitterGpuRenderUniforms;
}

export interface WaveSharedResources {
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  attributes: {
    unitPosition: number;
    position: number;
    size: number;
    startAlpha: number;
    endAlpha: number;
    age: number;
    lifetime: number;
    isActive: number;
  };
}
