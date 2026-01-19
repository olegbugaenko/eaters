import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ExtendedGpuBatch } from "../../core/GpuBatchRenderer";

export interface ArcInstance {
  from: SceneVector2;
  to: SceneVector2;
  age: number;
  lifetime: number;
  active: boolean;
}

export type ArcGpuUniforms = {
  coreColor: Float32Array; // vec4
  blurColor: Float32Array; // vec4
  coreWidth: number;
  blurWidth: number;
  fadeStartMs: number;
  noiseAmplitude: number;
  noiseDensity: number; // cycles per length unit
  aperiodicStrength: number;
  kinkAmplitude: number;
  kinkFrequency: number;
  oscAmplitude: number;
  oscAngularSpeed: number; // radians per ms
};

export interface ArcBatchConfig {
  batchKey: string;
  uniforms: ArcGpuUniforms;
}

export interface ArcBatch extends ExtendedGpuBatch<ArcInstance> {
  uniforms: ArcGpuUniforms;
}

export interface ArcSharedResources {
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    coreColor: WebGLUniformLocation | null;
    blurColor: WebGLUniformLocation | null;
    coreWidth: WebGLUniformLocation | null;
    blurWidth: WebGLUniformLocation | null;
    fadeStartMs: WebGLUniformLocation | null;
    noiseAmplitude: WebGLUniformLocation | null;
    noiseDensity: WebGLUniformLocation | null;
    aperiodicStrength: WebGLUniformLocation | null;
    kinkAmplitude: WebGLUniformLocation | null;
    kinkFrequency: WebGLUniformLocation | null;
    oscAmplitude: WebGLUniformLocation | null;
    oscAngularSpeed: WebGLUniformLocation | null;
  };
  attributes: {
    unitPos: number;
    from: number;
    to: number;
    age: number;
    lifetime: number;
  };
}
