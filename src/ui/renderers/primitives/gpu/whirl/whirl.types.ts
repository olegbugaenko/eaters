import type { SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import type { ExtendedGpuBatch } from "../../core/GpuBatchRenderer";

export interface WhirlInstance {
  position: SceneVector2;
  radius: number;
  phase: number;
  intensity: number;
  active: boolean;
  // Візуальні параметри
  rotationSpeedMultiplier: number;
  spiralArms: number;
  spiralArms2: number;
  spiralTwist: number;
  spiralTwist2: number;
  colorInner: [number, number, number]; // RGB
  colorMid: [number, number, number]; // RGB
  colorOuter: [number, number, number]; // RGB
}

export interface WhirlBatch extends ExtendedGpuBatch<WhirlInstance> {
  // No additional fields needed
}

export interface WhirlSharedResources {
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
    radius: number;
    phase: number;
    intensity: number;
    active: number;
    rotationSpeedMultiplier: number;
    spiralArms: number;
    spiralArms2: number;
    spiralTwist: number;
    spiralTwist2: number;
    colorInner: number;
    colorMid: number;
    colorOuter: number;
  };
}
