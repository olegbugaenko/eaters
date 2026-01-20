import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { GpuInstancedPrimitiveLifecycle } from "../GpuInstancedPrimitiveLifecycle";
import type {
  ParticleRenderProgram,
  ParticleEmitterGpuRenderUniforms,
  ParticleEmitterGpuDrawHandle,
  ParticleRenderResources,
  ParticleRendererContext,
  UniformCache,
} from "./particle-emitter.types";
import {
  UNIT_QUAD_VERTICES,
  PARTICLE_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
} from "./particle-emitter.const";

const rendererContexts = new WeakMap<WebGL2RenderingContext, ParticleRendererContext>();
// Track current active GL context for clearAllParticleEmitters without GL param
let activeGlContext: WebGL2RenderingContext | null = null;

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Failed to compile particle shader", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createRenderProgram = (
  gl: WebGL2RenderingContext
): ParticleRenderProgram | null => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, PARTICLE_VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, PARTICLE_FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Failed to link particle render program", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const attributes = {
    unitPosition: gl.getAttribLocation(program, "a_unitPosition"),
    position: gl.getAttribLocation(program, "a_position"),
    velocity: gl.getAttribLocation(program, "a_velocity"),
    size: gl.getAttribLocation(program, "a_size"),
    age: gl.getAttribLocation(program, "a_age"),
    lifetime: gl.getAttribLocation(program, "a_lifetime"),
    isActive: gl.getAttribLocation(program, "a_isActive"),
    startAlpha: gl.getAttribLocation(program, "a_startAlpha"),
    endAlpha: gl.getAttribLocation(program, "a_endAlpha"),
  };
  if (
    attributes.unitPosition < 0 ||
    attributes.position < 0 ||
    attributes.velocity < 0 ||
    attributes.size < 0 ||
    attributes.age < 0 ||
    attributes.lifetime < 0 ||
    attributes.isActive < 0
  ) {
    console.error("Particle render attributes are missing");
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = {
    cameraPosition: gl.getUniformLocation(program, "u_cameraPosition"),
    viewportSize: gl.getUniformLocation(program, "u_viewportSize"),
    fadeStartMs: gl.getUniformLocation(program, "u_fadeStartMs"),
    defaultLifetimeMs: gl.getUniformLocation(program, "u_defaultLifetimeMs"),
    minParticleSize: gl.getUniformLocation(program, "u_minParticleSize"),
    lengthMultiplier: gl.getUniformLocation(program, "u_lengthMultiplier"),
    alignToVelocity: gl.getUniformLocation(program, "u_alignToVelocity"),
    alignToVelocityFlip: gl.getUniformLocation(program, "u_alignToVelocityFlip"),
    sizeGrowthRate: gl.getUniformLocation(program, "u_sizeGrowthRate"),
    fillType: gl.getUniformLocation(program, "u_fillType"),
    stopCount: gl.getUniformLocation(program, "u_stopCount"),
    hasLinearStart: gl.getUniformLocation(program, "u_hasLinearStart"),
    hasLinearEnd: gl.getUniformLocation(program, "u_hasLinearEnd"),
    hasRadialOffset: gl.getUniformLocation(program, "u_hasRadialOffset"),
    hasExplicitRadius: gl.getUniformLocation(program, "u_hasExplicitRadius"),
    shape: gl.getUniformLocation(program, "u_shape"),
    linearStart: gl.getUniformLocation(program, "u_linearStart"),
    linearEnd: gl.getUniformLocation(program, "u_linearEnd"),
    radialOffset: gl.getUniformLocation(program, "u_radialOffset"),
    explicitRadius: gl.getUniformLocation(program, "u_explicitRadius"),
    stopOffsets: gl.getUniformLocation(program, "u_stopOffsets"),
    stopColor0: gl.getUniformLocation(program, "u_stopColor0"),
    stopColor1: gl.getUniformLocation(program, "u_stopColor1"),
    stopColor2: gl.getUniformLocation(program, "u_stopColor2"),
    stopColor3: gl.getUniformLocation(program, "u_stopColor3"),
    stopColor4: gl.getUniformLocation(program, "u_stopColor4"),
    noiseAmplitude: gl.getUniformLocation(program, "u_noiseAmplitude"),
    noiseScale: gl.getUniformLocation(program, "u_noiseScale"),
    noiseDensity: gl.getUniformLocation(program, "u_noiseDensity"),
    filaments0: gl.getUniformLocation(program, "u_filaments0"),
    filamentEdgeBlur: gl.getUniformLocation(program, "u_filamentEdgeBlur"),
  };
  return { program, attributes, uniforms };
};

const createResources = (
  gl: WebGL2RenderingContext
): ParticleRenderResources | null => {
  const program = createRenderProgram(gl);
  if (!program) {
    return null;
  }
  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) {
    gl.deleteProgram(program.program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_VERTICES, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return { program, quadBuffer };
};

export const getParticleRenderResources = (
  gl: WebGL2RenderingContext
): ParticleRenderResources | null => {
  activeGlContext = gl; // Track active context
  let context = rendererContexts.get(gl);
  if (context) {
    return context.resources;
  }
  const resources = createResources(gl);
  if (!resources) {
    return null;
  }
  context = {
    resources,
    emitters: new Set(),
  };
  rendererContexts.set(gl, context);
  return resources;
};

export const disposeParticleRenderResources = (
  gl: WebGL2RenderingContext
): void => {
  const context = rendererContexts.get(gl);
  if (!context) {
    return;
  }
  // Best effort: ensure no emitters are kept
  context.emitters.clear();
  const { program, quadBuffer } = context.resources;
  if (quadBuffer) {
    gl.deleteBuffer(quadBuffer);
  }
  if (program && program.program) {
    gl.deleteProgram(program.program);
  }
  rendererContexts.delete(gl);
  if (activeGlContext === gl) {
    activeGlContext = null;
  }
};

/**
 * Clears all particle emitter handles from context without disposing GL resources.
 * Use on map restart to prevent zombie particles.
 * Can be called without GL param - will use last active context.
 */
export const clearAllParticleEmitters = (gl?: WebGL2RenderingContext): void => {
  const targetGl = gl ?? activeGlContext;
  if (!targetGl) {
    return;
  }
  const context = rendererContexts.get(targetGl);
  if (!context) {
    return;
  }
  context.emitters.clear();
};

export const getParticleStats = (
  gl: WebGL2RenderingContext
): { emitters: number; active: number; capacity: number } => {
  const context = rendererContexts.get(gl);
  if (!context) {
    return { emitters: 0, active: 0, capacity: 0 };
  }
  let emitters = 0;
  let active = 0;
  let capacity = 0;
  context.emitters.forEach((handle) => {
    emitters += 1;
    active += Math.max(0, handle.activeCount || 0);
    capacity += Math.max(0, handle.capacity || 0);
  });
  return { emitters, active, capacity };
};

const getRendererContext = (
  gl: WebGL2RenderingContext
): ParticleRendererContext | null => {
  const resources = getParticleRenderResources(gl);
  if (!resources) {
    return null;
  }
  let context = rendererContexts.get(gl);
  if (!context) {
    context = {
      resources,
      emitters: new Set(),
    };
    rendererContexts.set(gl, context);
  }
  return context;
};

export const registerParticleEmitterHandle = (
  handle: ParticleEmitterGpuDrawHandle
): void => {
  const context = getRendererContext(handle.gl);
  if (!context) {
    return;
  }
  context.emitters.add(handle);
};

export const unregisterParticleEmitterHandle = (
  handle: ParticleEmitterGpuDrawHandle
): void => {
  const context = rendererContexts.get(handle.gl);
  if (!context) {
    return;
  }
  context.emitters.delete(handle);
};

const serializeArray = (arr: Float32Array): string => {
  let s = "";
  for (let i = 0; i < arr.length; i += 1) s += arr[i] + ",";
  return s;
};

export const refreshParticleUniformKeys = (
  uniforms: ParticleEmitterGpuRenderUniforms
): void => {
  uniforms.stopOffsetsKey = serializeArray(uniforms.stopOffsets);
  uniforms.stopColor0Key = serializeArray(uniforms.stopColor0);
  uniforms.stopColor1Key = serializeArray(uniforms.stopColor1);
  uniforms.stopColor2Key = serializeArray(uniforms.stopColor2);
  uniforms.stopColor3Key = serializeArray(uniforms.stopColor3);
  uniforms.stopColor4Key = serializeArray(uniforms.stopColor4);
  uniforms.uniformSignature = `${uniforms.fillType}|${uniforms.stopCount}|${uniforms.fadeStartMs}|${uniforms.sizeGrowthRate}|${uniforms.stopOffsetsKey}|${uniforms.stopColor0Key}`;
};

const uploadEmitterUniforms = (
  gl: WebGL2RenderingContext,
  program: ParticleRenderProgram,
  u: ParticleEmitterGpuRenderUniforms,
  cache: UniformCache
): void => {
  if (program.uniforms.fadeStartMs && cache.fadeStartMs !== u.fadeStartMs) {
    gl.uniform1f(program.uniforms.fadeStartMs, (cache.fadeStartMs = u.fadeStartMs));
  }
  if (
    program.uniforms.defaultLifetimeMs &&
    cache.defaultLifetimeMs !== u.defaultLifetimeMs
  ) {
    gl.uniform1f(
      program.uniforms.defaultLifetimeMs,
      (cache.defaultLifetimeMs = u.defaultLifetimeMs)
    );
  }
  if (
    program.uniforms.minParticleSize &&
    cache.minParticleSize !== u.minParticleSize
  ) {
    gl.uniform1f(
      program.uniforms.minParticleSize,
      (cache.minParticleSize = u.minParticleSize)
    );
  }
  if (
    program.uniforms.lengthMultiplier &&
    cache.lengthMultiplier !== u.lengthMultiplier
  ) {
    gl.uniform1f(
      program.uniforms.lengthMultiplier,
      (cache.lengthMultiplier = u.lengthMultiplier)
    );
  }
  const alignVal = u.alignToVelocity ? 1 : 0;
  if (
    program.uniforms.alignToVelocity &&
    cache.alignToVelocity !== alignVal
  ) {
    gl.uniform1i(
      program.uniforms.alignToVelocity,
      (cache.alignToVelocity = alignVal)
    );
  }
  const alignFlipVal = u.alignToVelocityFlip ? 1 : 0;
  if (
    program.uniforms.alignToVelocityFlip &&
    cache.alignToVelocityFlip !== alignFlipVal
  ) {
    gl.uniform1i(
      program.uniforms.alignToVelocityFlip,
      (cache.alignToVelocityFlip = alignFlipVal)
    );
  }
  if (
    program.uniforms.sizeGrowthRate &&
    cache.sizeGrowthRate !== u.sizeGrowthRate
  ) {
    gl.uniform1f(
      program.uniforms.sizeGrowthRate,
      (cache.sizeGrowthRate = u.sizeGrowthRate)
    );
  }
  if (program.uniforms.fillType && cache.fillType !== u.fillType) {
    gl.uniform1i(program.uniforms.fillType, (cache.fillType = u.fillType));
  }
  if (program.uniforms.stopCount && cache.stopCount !== u.stopCount) {
    gl.uniform1i(program.uniforms.stopCount, (cache.stopCount = u.stopCount));
  }
  const hasStart = u.hasLinearStart ? 1 : 0;
  if (program.uniforms.hasLinearStart && cache.hasLinearStart !== hasStart) {
    gl.uniform1i(program.uniforms.hasLinearStart, (cache.hasLinearStart = hasStart));
  }
  const hasEnd = u.hasLinearEnd ? 1 : 0;
  if (program.uniforms.hasLinearEnd && cache.hasLinearEnd !== hasEnd) {
    gl.uniform1i(program.uniforms.hasLinearEnd, (cache.hasLinearEnd = hasEnd));
  }
  const hasRadial = u.hasRadialOffset ? 1 : 0;
  if (program.uniforms.hasRadialOffset && cache.hasRadialOffset !== hasRadial) {
    gl.uniform1i(
      program.uniforms.hasRadialOffset,
      (cache.hasRadialOffset = hasRadial)
    );
  }
  const hasRadius = u.hasExplicitRadius ? 1 : 0;
  if (
    program.uniforms.hasExplicitRadius &&
    cache.hasExplicitRadius !== hasRadius
  ) {
    gl.uniform1i(
      program.uniforms.hasExplicitRadius,
      (cache.hasExplicitRadius = hasRadius)
    );
  }
  if (program.uniforms.shape && cache.shape !== u.shape) {
    gl.uniform1i(program.uniforms.shape, (cache.shape = u.shape));
  }
  const ls: [number, number] = [u.linearStart.x, u.linearStart.y];
  if (
    program.uniforms.linearStart &&
    (!cache.linearStart || cache.linearStart[0] !== ls[0] || cache.linearStart[1] !== ls[1])
  ) {
    gl.uniform2f(program.uniforms.linearStart, ls[0], ls[1]);
    cache.linearStart = ls;
  }
  const le: [number, number] = [u.linearEnd.x, u.linearEnd.y];
  if (
    program.uniforms.linearEnd &&
    (!cache.linearEnd || cache.linearEnd[0] !== le[0] || cache.linearEnd[1] !== le[1])
  ) {
    gl.uniform2f(program.uniforms.linearEnd, le[0], le[1]);
    cache.linearEnd = le;
  }
  const ro: [number, number] = [u.radialOffset.x, u.radialOffset.y];
  if (
    program.uniforms.radialOffset &&
    (!cache.radialOffset || cache.radialOffset[0] !== ro[0] || cache.radialOffset[1] !== ro[1])
  ) {
    gl.uniform2f(program.uniforms.radialOffset, ro[0], ro[1]);
    cache.radialOffset = ro;
  }
  if (
    program.uniforms.explicitRadius &&
    cache.explicitRadius !== u.explicitRadius
  ) {
    gl.uniform1f(
      program.uniforms.explicitRadius,
      (cache.explicitRadius = u.explicitRadius)
    );
  }
  const stopOffsetsKey = u.stopOffsetsKey ?? (u.stopOffsetsKey = serializeArray(u.stopOffsets));
  if (program.uniforms.stopOffsets && cache.stopOffsets !== stopOffsetsKey) {
    gl.uniform1fv(program.uniforms.stopOffsets, u.stopOffsets);
    cache.stopOffsets = stopOffsetsKey;
  }
  const stopColor0Key = u.stopColor0Key ?? (u.stopColor0Key = serializeArray(u.stopColor0));
  if (program.uniforms.stopColor0 && cache.stopColor0 !== stopColor0Key) {
    gl.uniform4fv(program.uniforms.stopColor0, u.stopColor0);
    cache.stopColor0 = stopColor0Key;
  }
  const stopColor1Key = u.stopColor1Key ?? (u.stopColor1Key = serializeArray(u.stopColor1));
  if (program.uniforms.stopColor1 && cache.stopColor1 !== stopColor1Key) {
    gl.uniform4fv(program.uniforms.stopColor1, u.stopColor1);
    cache.stopColor1 = stopColor1Key;
  }
  const stopColor2Key = u.stopColor2Key ?? (u.stopColor2Key = serializeArray(u.stopColor2));
  if (program.uniforms.stopColor2 && cache.stopColor2 !== stopColor2Key) {
    gl.uniform4fv(program.uniforms.stopColor2, u.stopColor2);
    cache.stopColor2 = stopColor2Key;
  }
  const stopColor3Key = u.stopColor3Key ?? (u.stopColor3Key = serializeArray(u.stopColor3));
  if (program.uniforms.stopColor3 && cache.stopColor3 !== stopColor3Key) {
    gl.uniform4fv(program.uniforms.stopColor3, u.stopColor3);
    cache.stopColor3 = stopColor3Key;
  }
  const stopColor4Key = u.stopColor4Key ?? (u.stopColor4Key = serializeArray(u.stopColor4));
  if (program.uniforms.stopColor4 && cache.stopColor4 !== stopColor4Key) {
    gl.uniform4fv(program.uniforms.stopColor4, u.stopColor4);
    cache.stopColor4 = stopColor4Key;
  }
  const noiseAmp: [number, number] = [u.noiseColorAmplitude, u.noiseAlphaAmplitude];
  if (
    program.uniforms.noiseAmplitude &&
    (!cache.noiseAmplitude || cache.noiseAmplitude[0] !== noiseAmp[0] || cache.noiseAmplitude[1] !== noiseAmp[1])
  ) {
    gl.uniform2f(program.uniforms.noiseAmplitude, noiseAmp[0], noiseAmp[1]);
    cache.noiseAmplitude = [noiseAmp[0], noiseAmp[1]];
  }
  if (program.uniforms.noiseScale && cache.noiseScale !== u.noiseScale) {
    gl.uniform1f(program.uniforms.noiseScale, (cache.noiseScale = u.noiseScale));
  }
  if (program.uniforms.noiseDensity && cache.noiseDensity !== u.noiseDensity) {
    gl.uniform1f(program.uniforms.noiseDensity, (cache.noiseDensity = u.noiseDensity));
  }
  const filaments0: [number, number, number, number] = [
    u.filamentColorContrast,
    u.filamentAlphaContrast,
    u.filamentWidth,
    u.filamentDensity,
  ];
  if (
    program.uniforms.filaments0 &&
    (!cache.filaments0 ||
      cache.filaments0[0] !== filaments0[0] ||
      cache.filaments0[1] !== filaments0[1] ||
      cache.filaments0[2] !== filaments0[2] ||
      cache.filaments0[3] !== filaments0[3])
  ) {
    gl.uniform4f(
      program.uniforms.filaments0,
      filaments0[0],
      filaments0[1],
      filaments0[2],
      filaments0[3]
    );
    cache.filaments0 = [...filaments0];
  }
  if (
    program.uniforms.filamentEdgeBlur &&
    cache.filamentEdgeBlur !== u.filamentEdgeBlur
  ) {
    gl.uniform1f(
      program.uniforms.filamentEdgeBlur,
      (cache.filamentEdgeBlur = u.filamentEdgeBlur)
    );
  }
};

/**
 * Public function to upload emitter uniforms.
 * Used by ExplosionWaveGpuRenderer which renders separately but uses same shader.
 */
export const uploadEmitterUniformsPublic = (
  gl: WebGL2RenderingContext,
  uniforms: ParticleEmitterGpuRenderUniforms,
  cameraPosition: SceneVector2,
  viewportSize: { width: number; height: number }
): void => {
  const resources = getParticleRenderResources(gl);
  if (!resources) {
    return;
  }
  const program = resources.program;
  
  if (program.uniforms.cameraPosition) {
    gl.uniform2f(program.uniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
  }
  if (program.uniforms.viewportSize) {
    gl.uniform2f(program.uniforms.viewportSize, viewportSize.width, viewportSize.height);
  }
  
  const cache: UniformCache = {};
  uploadEmitterUniforms(gl, program, uniforms, cache);
};

// Reusable array to avoid allocations during render
const emitterRenderList: ParticleEmitterGpuDrawHandle[] = [];

// Generate a signature for uniform values to enable batching
const ensureUniformSignature = (u: ParticleEmitterGpuRenderUniforms): string => {
  if (!u.stopOffsetsKey) {
    u.stopOffsetsKey = serializeArray(u.stopOffsets);
  }
  if (!u.stopColor0Key) {
    u.stopColor0Key = serializeArray(u.stopColor0);
  }
  if (!u.uniformSignature) {
    u.uniformSignature = `${u.fillType}|${u.stopCount}|${u.fadeStartMs}|${u.sizeGrowthRate}|${u.stopOffsetsKey}|${u.stopColor0Key}`;
  }
  return u.uniformSignature;
};

export const renderParticleEmitters = (
  gl: WebGL2RenderingContext,
  cameraPosition: SceneVector2,
  viewportSize: { width: number; height: number }
): void => {
  const context = rendererContexts.get(gl);
  if (!context || context.emitters.size === 0) {
    return;
  }
  const { resources, emitters } = context;
  const program = resources.program;
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA,
  );
  gl.useProgram(program.program);
  if (program.uniforms.cameraPosition) {
    gl.uniform2f(program.uniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
  }
  if (program.uniforms.viewportSize) {
    gl.uniform2f(program.uniforms.viewportSize, viewportSize.width, viewportSize.height);
  }

  // Sort emitters by uniform signature to minimize uniform updates
  emitterRenderList.length = 0;
  emitters.forEach((handle) => {
    if (handle.capacity > 0 && handle.getCurrentVao()) {
      ensureUniformSignature(handle.uniforms);
      emitterRenderList.push(handle);
    }
  });
  
  // Sort by uniform signature for batching
  emitterRenderList.sort((a, b) => {
    return (a.uniforms.uniformSignature ?? "").localeCompare(
      b.uniforms.uniformSignature ?? ""
    );
  });

  const cache: UniformCache = {};
  for (let i = 0; i < emitterRenderList.length; i++) {
    const handle = emitterRenderList[i]!;
    const vao = handle.getCurrentVao();
    if (!vao) {
      continue;
    }
    uploadEmitterUniforms(gl, program, handle.uniforms, cache);
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, handle.capacity);
  }

  gl.bindVertexArray(null);
};

// ============================================================================
// ParticleEmitterGpuRenderer Singleton Class
// ============================================================================

/**
 * Singleton class for managing particle emitter GPU rendering.
 * Implements GpuInstancedPrimitiveLifecycle for unified lifecycle management.
 * 
 * Note: This renderer differs from GpuBatchRenderer because particle simulation
 * uses Transform Feedback with ping-pong buffers. The simulation is handled
 * by ParticleEmitterPrimitive, while this class manages rendering.
 */
class ParticleEmitterGpuRendererClass implements GpuInstancedPrimitiveLifecycle<ParticleEmitterGpuDrawHandle> {
  private gl: WebGL2RenderingContext | null = null;

  /**
   * Called when WebGL context is acquired.
   */
  public onContextAcquired(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    // Ensure resources are initialized
    getParticleRenderResources(gl);
  }

  /**
   * Called when WebGL context is lost.
   */
  public onContextLost(gl: WebGL2RenderingContext): void {
    disposeParticleRenderResources(gl);
    if (this.gl === gl) {
      this.gl = null;
    }
  }

  /**
   * Set the WebGL context (alternative to onContextAcquired for compatibility).
   */
  public setContext(gl: WebGL2RenderingContext | null): void {
    if (gl === this.gl) {
      return;
    }
    if (this.gl) {
      // Don't dispose resources - they may be shared with other emitters
      this.gl = null;
    }
    if (gl) {
      this.gl = gl;
      getParticleRenderResources(gl);
    }
  }

  /**
   * Ensure a batch (emitter handle) exists. For particle emitters, handles are
   * created by ParticleEmitterPrimitive via createParticleEmitterGpuState.
   * This method is here for interface compatibility.
   */
  public ensureBatch(
    _gl: WebGL2RenderingContext,
    _capacity: number
  ): ParticleEmitterGpuDrawHandle | null {
    // Handles are created by ParticleEmitterPrimitive, not by this renderer
    return null;
  }

  /**
   * Called before render to prepare GPU state.
   * For particle emitters, simulation is done in ParticleEmitterPrimitive.
   * This is a no-op here since there's no instance data to upload.
   */
  public beforeRender(_gl: WebGL2RenderingContext, _timestampMs: number): void {
    // Transform feedback simulation is done in ParticleEmitterPrimitive
    // No additional work needed here
  }

  /**
   * Render all registered particle emitters.
   */
  public render(
    gl: WebGL2RenderingContext,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    _timestampMs: number
  ): void {
    renderParticleEmitters(gl, cameraPosition, viewportSize);
  }

  /**
   * Clear all particle emitter instances.
   */
  public clearInstances(gl?: WebGL2RenderingContext): void {
    clearAllParticleEmitters(gl);
  }

  /**
   * Dispose all resources.
   */
  public dispose(): void {
    if (this.gl) {
      disposeParticleRenderResources(this.gl);
      this.gl = null;
    }
  }

  /**
   * Get statistics about particle emitters.
   */
  public getStats(gl: WebGL2RenderingContext): { emitters: number; active: number; capacity: number } {
    return getParticleStats(gl);
  }
}

// Export singleton instance
export const particleEmitterGpuRenderer = new ParticleEmitterGpuRendererClass();
