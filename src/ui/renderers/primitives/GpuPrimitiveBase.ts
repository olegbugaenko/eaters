import type { SceneObjectInstance } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { DynamicPrimitive } from "@ui/renderers/objects/ObjectRenderer";

export abstract class GpuPrimitiveBase implements DynamicPrimitive {
  public autoAnimate = true;
  protected gl: WebGL2RenderingContext | null = null;

  private resourcesReady = false;
  private buffers: WebGLBuffer[] = [];

  public constructor(
    private readonly getContext: () => WebGL2RenderingContext | null
  ) {}

  public get data(): Float32Array {
    return new Float32Array(0);
  }

  public update(target: SceneObjectInstance): Float32Array | null {
    if (!this.ensureResources()) {
      return null;
    }
    this.updateBuffers(target);
    return null;
  }

  public dispose(): void {
    if (!this.gl) {
      return;
    }
    this.releaseResources(this.gl);
    this.clearBuffers();
    this.resourcesReady = false;
  }

  protected ensureResources(): boolean {
    if (!this.gl) {
      this.gl = this.getContext();
    }
    if (!this.gl) {
      return false;
    }
    if (!this.resourcesReady || !this.areResourcesValid()) {
      if (this.resourcesReady) {
        this.releaseResources(this.gl);
        this.clearBuffers();
      }
      this.resourcesReady = this.createResources(this.gl);
    }
    return this.resourcesReady;
  }

  protected areResourcesValid(): boolean {
    return this.resourcesReady;
  }

  protected createBuffer(
    gl: WebGL2RenderingContext,
    target: number,
    data: BufferSource | ArrayBufferLike | number,
    usage: number
  ): WebGLBuffer | null {
    const buffer = gl.createBuffer();
    if (!buffer) {
      return null;
    }
    gl.bindBuffer(target, buffer);
    if (typeof data === "number") {
      gl.bufferData(target, data, usage);
    } else {
      gl.bufferData(target, data as BufferSource, usage);
    }
    gl.bindBuffer(target, null);
    this.buffers.push(buffer);
    return buffer;
  }

  protected clearBuffers(): void {
    if (!this.gl) {
      return;
    }
    this.buffers.forEach((buffer) => this.gl!.deleteBuffer(buffer));
    this.buffers = [];
  }

  protected checkFillDirty(target: SceneObjectInstance): boolean {
    const data = target.data as { fillDirty?: boolean; colorDirty?: boolean };
    return !!(data.fillDirty || data.colorDirty);
  }

  protected abstract createResources(gl: WebGL2RenderingContext): boolean;
  protected abstract updateBuffers(target: SceneObjectInstance): void;
  protected abstract releaseResources(gl: WebGL2RenderingContext): void;
}
