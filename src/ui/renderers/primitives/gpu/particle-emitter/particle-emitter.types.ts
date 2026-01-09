import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

export interface ParticleRenderProgram {
  program: WebGLProgram;
  attributes: {
    unitPosition: number;
    position: number;
    velocity: number;
    size: number;
    age: number;
    lifetime: number;
    isActive: number;
    startAlpha: number;
    endAlpha: number;
  };
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    fadeStartMs: WebGLUniformLocation | null;
    defaultLifetimeMs: WebGLUniformLocation | null;
    minParticleSize: WebGLUniformLocation | null;
    lengthMultiplier: WebGLUniformLocation | null;
    alignToVelocity: WebGLUniformLocation | null;
    sizeGrowthRate: WebGLUniformLocation | null;
    fillType: WebGLUniformLocation | null;
    stopCount: WebGLUniformLocation | null;
    hasLinearStart: WebGLUniformLocation | null;
    hasLinearEnd: WebGLUniformLocation | null;
    hasRadialOffset: WebGLUniformLocation | null;
    hasExplicitRadius: WebGLUniformLocation | null;
    shape: WebGLUniformLocation | null;
    linearStart: WebGLUniformLocation | null;
    linearEnd: WebGLUniformLocation | null;
    radialOffset: WebGLUniformLocation | null;
    explicitRadius: WebGLUniformLocation | null;
    stopOffsets: WebGLUniformLocation | null;
    stopColor0: WebGLUniformLocation | null;
    stopColor1: WebGLUniformLocation | null;
    stopColor2: WebGLUniformLocation | null;
    stopColor3: WebGLUniformLocation | null;
    stopColor4: WebGLUniformLocation | null;
    noiseAmplitude: WebGLUniformLocation | null;
    noiseScale: WebGLUniformLocation | null;
    noiseDensity: WebGLUniformLocation | null;
    filaments0: WebGLUniformLocation | null;
    filamentEdgeBlur: WebGLUniformLocation | null;
  };
}

export interface ParticleEmitterGpuRenderUniforms {
  fillType: number;
  stopCount: number;
  stopOffsets: Float32Array;
  stopOffsetsKey?: string;
  stopColor0: Float32Array;
  stopColor0Key?: string;
  stopColor1: Float32Array;
  stopColor1Key?: string;
  stopColor2: Float32Array;
  stopColor2Key?: string;
  stopColor3: Float32Array;
  stopColor3Key?: string;
  stopColor4: Float32Array;
  stopColor4Key?: string;
  noiseColorAmplitude: number;
  noiseAlphaAmplitude: number;
  noiseScale: number;
  noiseDensity: number;
  filamentColorContrast: number;
  filamentAlphaContrast: number;
  filamentWidth: number;
  filamentDensity: number;
  filamentEdgeBlur: number;
  hasLinearStart: boolean;
  linearStart: SceneVector2;
  hasLinearEnd: boolean;
  linearEnd: SceneVector2;
  hasRadialOffset: boolean;
  radialOffset: SceneVector2;
  hasExplicitRadius: boolean;
  explicitRadius: number;
  fadeStartMs: number;
  defaultLifetimeMs: number;
  shape: number;
  minParticleSize: number;
  lengthMultiplier: number;
  alignToVelocity: boolean;
  sizeGrowthRate: number;
}

export interface ParticleEmitterGpuDrawHandle {
  gl: WebGL2RenderingContext;
  capacity: number;
  getCurrentVao(): WebGLVertexArrayObject | null;
  uniforms: ParticleEmitterGpuRenderUniforms;
  activeCount: number;
}

export interface ParticleRenderResources {
  program: ParticleRenderProgram;
  quadBuffer: WebGLBuffer;
}

export interface ParticleRendererContext {
  resources: ParticleRenderResources;
  emitters: Set<ParticleEmitterGpuDrawHandle>;
}

export interface UniformCache {
  fadeStartMs?: number;
  defaultLifetimeMs?: number;
  minParticleSize?: number;
  lengthMultiplier?: number;
  alignToVelocity?: number;
  sizeGrowthRate?: number;
  fillType?: number;
  stopCount?: number;
  hasLinearStart?: number;
  hasLinearEnd?: number;
  hasRadialOffset?: number;
  hasExplicitRadius?: number;
  shape?: number;
  linearStart?: [number, number];
  linearEnd?: [number, number];
  radialOffset?: [number, number];
  explicitRadius?: number;
  stopOffsets?: string; // serialized to avoid per-element checks cost
  stopColor0?: string;
  stopColor1?: string;
  stopColor2?: string;
  stopColor3?: string;
  stopColor4?: string;
  noiseAmplitude?: [number, number];
  noiseScale?: number;
  noiseDensity?: number;
  filaments0?: [number, number, number, number];
  filamentEdgeBlur?: number;
}
