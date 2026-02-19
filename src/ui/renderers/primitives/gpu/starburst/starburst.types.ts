import type { SceneColor, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ExtendedGpuBatch, SlotHandle } from "../../core/GpuBatchRenderer";

export interface StarburstInstance {
  position: SceneVector2;
  age: number;
  lifetime: number;
  active: boolean;
  spikeCount: number;
  spikeLength: number;
  spikeWidth: number;
  angleJitterRad: number;
  lengthJitter: number;
  widthJitter: number;
  growSizeMult: number;
  fadeStartMs: number;
  seed: number;
  color: SceneColor;
}

export interface StarburstBatch extends ExtendedGpuBatch<StarburstInstance> {}

export type StarburstSlotHandle = SlotHandle;

export interface StarburstSharedResources {
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  attributes: {
    unitPosition: number;
    position: number;
    age: number;
    lifetime: number;
    isActive: number;
    spikeCount: number;
    spikeLength: number;
    spikeWidth: number;
    angleJitterRad: number;
    lengthJitter: number;
    widthJitter: number;
    growSizeMult: number;
    fadeStartMs: number;
    seed: number;
    color: number;
  };
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
  };
}
