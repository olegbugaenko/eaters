import type { SceneColor, SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import type { ExtendedGpuBatch } from "../../core/GpuBatchRenderer";

export interface FireRingInstance {
  center: SceneVector2;
  innerRadius: number;
  outerRadius: number;
  birthTimeMs: number; // time of spawn in ms
  lifetime: number;    // ms (<=0 => infinite)
  intensity: number;
  color: SceneColor;
  active: boolean;
}

export interface FireRingBatch extends ExtendedGpuBatch<FireRingInstance> {
  // No additional fields needed
}

export interface FireRingSharedResources {
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
  };
  attributes: {
    unitPosition: number;
    center: number;
    innerRadius: number;
    outerRadius: number;
    birthTimeMs: number;
    lifetime: number;
    intensity: number;
    color: number;
    active: number;
  };
}
