import assert from "assert";
import { describe, test } from "./testRunner";
import type { ParticleEmitterGpuDrawHandle, ParticleEmitterGpuRenderUniforms } from "../src/ui/renderers/primitives/gpu/particle-emitter/particle-emitter.types";
import {
  registerParticleEmitterHandle,
  renderParticleEmitters,
  clearAllParticleEmitters,
} from "../src/ui/renderers/primitives/gpu/particle-emitter/ParticleEmitterGpuRenderer";

type UniformLocation = { name: string };

const createMockGl = () => {
  const drawOrder: Array<string | null> = [];
  const fadeStartCalls: number[] = [];
  const gl = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    BLEND: 0x0be2,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    ONE: 1,
    TRIANGLE_STRIP: 0x0005,
    createShader: () => ({}),
    shaderSource: () => undefined,
    compileShader: () => undefined,
    getShaderParameter: () => true,
    getShaderInfoLog: () => "",
    createProgram: () => ({}),
    attachShader: () => undefined,
    linkProgram: () => undefined,
    deleteShader: () => undefined,
    getProgramParameter: () => true,
    getProgramInfoLog: () => "",
    getAttribLocation: () => 0,
    getUniformLocation: (_program: object, name: string) => ({ name } as UniformLocation),
    createBuffer: () => ({}),
    bindBuffer: () => undefined,
    bufferData: () => undefined,
    deleteBuffer: () => undefined,
    deleteProgram: () => undefined,
    enable: () => undefined,
    blendFuncSeparate: () => undefined,
    useProgram: () => undefined,
    uniform1f: (location: UniformLocation | null) => {
      if (location?.name === "u_fadeStartMs") {
        fadeStartCalls.push(1);
      }
    },
    uniform1i: () => undefined,
    uniform2f: () => undefined,
    uniform1fv: () => undefined,
    uniform4fv: () => undefined,
    uniform4f: () => undefined,
    bindVertexArray: (vao: { id?: string } | null) => {
      drawOrder.push(vao?.id ?? null);
    },
    drawArraysInstanced: () => undefined,
  } as unknown as WebGL2RenderingContext;

  return { gl, drawOrder, fadeStartCalls };
};

const createUniforms = (overrides: Partial<ParticleEmitterGpuRenderUniforms> = {}): ParticleEmitterGpuRenderUniforms => ({
  fillType: 0,
  stopCount: 1,
  stopOffsets: new Float32Array([0, 0, 0, 0, 0]),
  stopColor0: new Float32Array([1, 1, 1, 1]),
  stopColor1: new Float32Array([0, 0, 0, 0]),
  stopColor2: new Float32Array([0, 0, 0, 0]),
  stopColor3: new Float32Array([0, 0, 0, 0]),
  stopColor4: new Float32Array([0, 0, 0, 0]),
  noiseColorAmplitude: 0,
  noiseAlphaAmplitude: 0,
  noiseScale: 0,
  noiseDensity: 0,
  filamentColorContrast: 0,
  filamentAlphaContrast: 0,
  filamentWidth: 0,
  filamentDensity: 0,
  filamentEdgeBlur: 0,
  hasLinearStart: false,
  linearStart: { x: 0, y: 0 },
  hasLinearEnd: false,
  linearEnd: { x: 0, y: 0 },
  hasRadialOffset: false,
  radialOffset: { x: 0, y: 0 },
  hasExplicitRadius: false,
  explicitRadius: 0,
  fadeStartMs: 100,
  defaultLifetimeMs: 1000,
  shape: 0,
  minParticleSize: 0,
  lengthMultiplier: 1,
  alignToVelocity: false,
  alignToVelocityFlip: false,
  sizeGrowthRate: 1,
  ...overrides,
});

const createHandle = (
  gl: WebGL2RenderingContext,
  id: string,
  uniforms: ParticleEmitterGpuRenderUniforms
): ParticleEmitterGpuDrawHandle => ({
  gl,
  capacity: 4,
  getCurrentVao: () => ({ id }),
  uniforms,
  activeCount: 0,
});

describe("ParticleEmitterGpuRenderer batching", () => {
  test("uploads uniforms only when signature changes", () => {
    const { gl, fadeStartCalls } = createMockGl();
    const uniformsA = createUniforms({ fadeStartMs: 100 });
    const uniformsB = createUniforms({ fadeStartMs: 100 });
    const uniformsC = createUniforms({ fadeStartMs: 250 });
    registerParticleEmitterHandle(createHandle(gl, "a", uniformsA));
    registerParticleEmitterHandle(createHandle(gl, "b", uniformsB));
    registerParticleEmitterHandle(createHandle(gl, "c", uniformsC));

    renderParticleEmitters(gl, { x: 0, y: 0 }, { width: 100, height: 100 });

    assert.strictEqual(fadeStartCalls.length, 2);
    clearAllParticleEmitters(gl);
  });

  test("sorts emitters by numeric signature and resorts when signature changes", () => {
    const { gl, drawOrder } = createMockGl();
    const uniformsA = createUniforms({ fillType: 0, fadeStartMs: 100 });
    const uniformsB = createUniforms({ fillType: 2, fadeStartMs: 300 });
    const handleA = createHandle(gl, "a", uniformsA);
    const handleB = createHandle(gl, "b", uniformsB);
    registerParticleEmitterHandle(handleA);
    registerParticleEmitterHandle(handleB);

    renderParticleEmitters(gl, { x: 0, y: 0 }, { width: 100, height: 100 });
    const firstDrawCount = drawOrder.length;
    const firstOrder = drawOrder
      .slice(0, firstDrawCount)
      .filter((id) => id !== null) as string[];
    const firstSignatures: Record<string, number> = {
      a: uniformsA.uniformSignature ?? 0,
      b: uniformsB.uniformSignature ?? 0,
    };
    const expectedFirstOrder = ["a", "b"].sort((left, right) => {
      return firstSignatures[left]! - firstSignatures[right]!;
    });
    assert.deepStrictEqual(firstOrder, expectedFirstOrder);

    uniformsA.fadeStartMs = 500;
    renderParticleEmitters(gl, { x: 0, y: 0 }, { width: 100, height: 100 });
    const secondOrder = drawOrder
      .slice(firstDrawCount)
      .filter((id) => id !== null) as string[];
    const secondSignatures: Record<string, number> = {
      a: uniformsA.uniformSignature ?? 0,
      b: uniformsB.uniformSignature ?? 0,
    };
    const expectedSecondOrder = ["a", "b"].sort((left, right) => {
      return secondSignatures[left]! - secondSignatures[right]!;
    });
    assert.deepStrictEqual(secondOrder, expectedSecondOrder);
    clearAllParticleEmitters(gl);
  });
});
