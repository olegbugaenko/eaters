import type { SceneColor, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ExtendedGpuBatch } from "../../core/GpuBatchRenderer";

export interface RingInstance {
  position: SceneVector2;
  createdAt: number;
  lifetimeMs: number;
  startRadius: number;
  endRadius: number;
  startAlpha: number;
  endAlpha: number;
  innerStop: number;
  outerStop: number;
  color: SceneColor;
  active: boolean;
}

export interface RingBatch extends ExtendedGpuBatch<RingInstance> {
  // No additional fields needed - all in base GpuBatch
}

export interface RingSharedResources {
  program: WebGLProgram;
  circleBuffer: WebGLBuffer;
  circleVertexCount: number;
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
  };
  attributes: {
    position: number;
    instancePosition: number;
    instanceCreatedAt: number;
    instanceLifetime: number;
    instanceStartRadius: number;
    instanceEndRadius: number;
    instanceStartAlpha: number;
    instanceEndAlpha: number;
    instanceInnerStop: number;
    instanceOuterStop: number;
    instanceColor: number;
    instanceActive: number;
  };
}
