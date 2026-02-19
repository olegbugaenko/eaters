import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { GpuBatchRenderer } from "../../core/GpuBatchRenderer";
import type { StarburstBatch, StarburstInstance, StarburstSharedResources } from "./starburst.types";
import {
  DEFAULT_BATCH_CAPACITY,
  INSTANCE_COMPONENTS,
  INSTANCE_STRIDE,
  serializeStarburstConfig,
  STARBURST_FRAGMENT_SHADER,
  STARBURST_VERTEX_SHADER,
  UNIT_QUAD_VERTICES,
  writeStarburstInstanceData,
} from "./starburst.const";

class StarburstGpuRenderer extends GpuBatchRenderer<StarburstInstance, StarburstBatch, void> {
  private sharedResourcesExtended: StarburstSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, STARBURST_VERTEX_SHADER);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, STARBURST_FRAGMENT_SHADER);
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
      console.error("Failed to link starburst program", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) {
      gl.deleteProgram(program);
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_VERTICES, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.sharedResourcesExtended = {
      program,
      quadBuffer,
      attributes: {
        unitPosition: gl.getAttribLocation(program, "a_unitPosition"),
        position: gl.getAttribLocation(program, "a_position"),
        timeActive: gl.getAttribLocation(program, "a_timeActive"),
        spikeGeom: gl.getAttribLocation(program, "a_spikeGeom"),
        jitterGrow: gl.getAttribLocation(program, "a_jitterGrow"),
        softRot: gl.getAttribLocation(program, "a_softRot"),
        color: gl.getAttribLocation(program, "a_color"),
      },
      uniforms: {
        cameraPosition: gl.getUniformLocation(program, "u_cameraPosition"),
        viewportSize: gl.getUniformLocation(program, "u_viewportSize"),
      },
    };

    return { program };
  }

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): StarburstBatch | null {
    if (!this.sharedResourcesExtended) {
      return null;
    }

    const instanceBuffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    if (!instanceBuffer || !vao) {
      if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
      if (vao) gl.deleteVertexArray(vao);
      return null;
    }

    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sharedResourcesExtended.quadBuffer);
    if (this.sharedResourcesExtended.attributes.unitPosition >= 0) {
      gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.unitPosition);
      gl.vertexAttribPointer(
        this.sharedResourcesExtended.attributes.unitPosition,
        2,
        gl.FLOAT,
        false,
        2 * Float32Array.BYTES_PER_ELEMENT,
        0
      );
      gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.unitPosition, 0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

    const bindAttribute = (location: number, size: number, offsetFloats: number) => {
      if (location < 0) {
        return;
      }
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(
        location,
        size,
        gl.FLOAT,
        false,
        INSTANCE_STRIDE,
        offsetFloats * Float32Array.BYTES_PER_ELEMENT
      );
      gl.vertexAttribDivisor(location, 1);
    };

    const attrs = this.sharedResourcesExtended.attributes;
    bindAttribute(attrs.position, 2, 0);
    bindAttribute(attrs.timeActive, 4, 2);
    bindAttribute(attrs.spikeGeom, 4, 6);
    bindAttribute(attrs.jitterGrow, 4, 10);
    bindAttribute(attrs.softRot, 2, 14);
    bindAttribute(attrs.color, 4, 16);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const freeSlots: number[] = [];
    for (let i = capacity - 1; i >= 0; i -= 1) {
      freeSlots.push(i);
    }

    return {
      gl,
      capacity,
      instanceBuffer,
      vao,
      freeSlots,
      activeCount: 0,
      instances: new Array(capacity).fill(null),
      needsUpload: false,
      instanceData: new Float32Array(capacity * INSTANCE_COMPONENTS),
    };
  }

  protected getBatchKey(config: void): string {
    return serializeStarburstConfig(config);
  }

  protected writeInstanceData(batch: StarburstBatch, slotIndex: number, instance: StarburstInstance): void {
    const offset = slotIndex * INSTANCE_COMPONENTS;
    writeStarburstInstanceData(batch.instanceData, offset, instance);
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    _batch: StarburstBatch,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    _timestampMs: number
  ): void {
    if (!this.sharedResourcesExtended) {
      return;
    }

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);

    if (this.sharedResourcesExtended.uniforms.cameraPosition) {
      gl.uniform2f(
        this.sharedResourcesExtended.uniforms.cameraPosition,
        cameraPosition.x,
        cameraPosition.y
      );
    }
    if (this.sharedResourcesExtended.uniforms.viewportSize) {
      gl.uniform2f(
        this.sharedResourcesExtended.uniforms.viewportSize,
        viewportSize.width,
        viewportSize.height
      );
    }
  }

  public override render(
    gl: WebGL2RenderingContext,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number
  ): void {
    super.render(gl, cameraPosition, viewportSize, timestampMs);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
  }

  protected getInstanceFloats(): number {
    return INSTANCE_COMPONENTS;
  }

  protected getActiveFloatIndex(): number {
    return 4;
  }

  protected getVertexCount(_batch: StarburstBatch): number {
    return 4;
  }

  protected getDrawMode(gl: WebGL2RenderingContext): number {
    return gl.TRIANGLE_STRIP;
  }

  protected override disposeSharedResources(gl: WebGL2RenderingContext): void {
    if (this.sharedResourcesExtended?.quadBuffer) {
      gl.deleteBuffer(this.sharedResourcesExtended.quadBuffer);
    }
    this.sharedResourcesExtended = null;
  }

  public clearAll(): void {
    this.batches.clear();
  }

  private compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) {
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Failed to compile starburst shader", {
        info: gl.getShaderInfoLog(shader),
        type,
      });
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }
}

export const starburstGpuRenderer = new StarburstGpuRenderer();
