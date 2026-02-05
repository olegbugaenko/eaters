import type {
  SceneFill,
  SceneObjectInstance,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { RendererLayerAnimationConfig } from "@shared/types/renderer.types";
import { getAnimationGpuContext } from "@ui/renderers/objects/shared/animation-gpu";
import {
  FILL_COMPONENTS,
  DynamicPrimitive,
  getInstanceRenderPosition,
  transformObjectPoint,
} from "@ui/renderers/objects/ObjectRenderer";
import { writeFillVertexComponents } from "@ui/renderers/primitives/utils/fill";
import { polygonGpuRenderer, type PolygonGpuHandle } from "@ui/renderers/primitives/gpu/polygon";
import { getSceneTimelineNow } from "@ui/renderers/primitives/utils/sceneTimeline";
import { computePolygonGeometry } from "@ui/renderers/primitives/basic/PolygonPrimitive";
import { GpuPrimitiveBase } from "@ui/renderers/primitives/GpuPrimitiveBase";

export interface PolygonGpuPrimitiveOptions {
  vertices: SceneVector2[];
  anim?: RendererLayerAnimationConfig;
  fill: SceneFill;
  offset?: SceneVector2;
  phaseStep?: number;
  enableMovementAxis?: boolean;
  refreshFill?: (instance: SceneObjectInstance) => SceneFill;
}

const buildPackedVertices = (vertices: SceneVector2[]): Float32Array => {
  const packed = new Float32Array(vertices.length * 2);
  for (let i = 0; i < vertices.length; i += 1) {
    const offset = i * 2;
    const vertex = vertices[i]!;
    packed[offset] = vertex.x;
    packed[offset + 1] = vertex.y;
  }
  return packed;
};

const buildFillBufferData = (
  vertexCount: number,
  fillComponents: Float32Array,
  target?: Float32Array
): Float32Array => {
  const data =
    target && target.length === vertexCount * FILL_COMPONENTS
      ? target
      : new Float32Array(vertexCount * FILL_COMPONENTS);
  for (let i = 0; i < vertexCount; i += 1) {
    data.set(fillComponents, i * FILL_COMPONENTS);
  }
  return data;
};

export const createPolygonGpuPrimitive = (
  instance: SceneObjectInstance,
  options: PolygonGpuPrimitiveOptions
): DynamicPrimitive | null => {
  if (!options.vertices || options.vertices.length < 3) {
    return null;
  }
  const vertexCount = options.vertices.length;
  const packedVertices = buildPackedVertices(options.vertices);
  const geometry = computePolygonGeometry(options.vertices);

  // Compute center of polygon (in local coords)
  const center = options.vertices.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
    { x: 0, y: 0 }
  );
  const invCount = vertexCount > 0 ? 1 / vertexCount : 0;
  center.x *= invCount;
  center.y *= invCount;

  class PolygonGpuPrimitive extends GpuPrimitiveBase {
    private fillScratch = new Float32Array(FILL_COMPONENTS);
    private fillData: Float32Array | null = null;
    private cachedFill: SceneFill = options.fill;
    private prevInstanceFillRef: SceneFill | undefined =
      typeof options.refreshFill === "function" ? instance.data.fill : undefined;

    private positionBuffer: WebGLBuffer | null = null;
    private fillBuffer: WebGLBuffer | null = null;
    private renderHandle: PolygonGpuHandle | null = null;

    private prevPosX = getInstanceRenderPosition(instance).x;
    private prevPosY = getInstanceRenderPosition(instance).y;
    private needsFillUpload = true;

    public constructor() {
      super(getAnimationGpuContext);
    }

    protected override createResources(gl: WebGL2RenderingContext): boolean {
      if (!this.positionBuffer) {
        const packed = packedVertices as unknown as BufferSource;
        this.positionBuffer = this.createBuffer(
          gl,
          gl.ARRAY_BUFFER,
          packed,
          gl.STATIC_DRAW
        );
        if (!this.positionBuffer) {
          return false;
        }
      }

      if (!this.fillBuffer) {
        this.fillBuffer = this.createBuffer(
          gl,
          gl.ARRAY_BUFFER,
          vertexCount * FILL_COMPONENTS * Float32Array.BYTES_PER_ELEMENT,
          gl.DYNAMIC_DRAW
        );
        if (!this.fillBuffer) {
          return false;
        }
      }

      polygonGpuRenderer.setContext(gl);
      if (!this.renderHandle) {
        this.renderHandle = polygonGpuRenderer.acquire({
          positionBuffer: this.positionBuffer,
          fillBuffer: this.fillBuffer,
          vertexCount,
          center,
        });
        if (!this.renderHandle) {
          return false;
        }
        this.renderHandle.anim.periodMs = Math.max(anim?.periodMs ?? 1500, 1);
        this.renderHandle.anim.phase = anim?.phase ?? 0;
        this.renderHandle.anim.amplitude = hasAnim ? (anim?.amplitude ?? 6) : 0;
        this.renderHandle.anim.amplitudePercent = hasAnim ? amplitudePercent : 0;
        this.renderHandle.anim.phaseStep = options.phaseStep ?? 0.3;
        this.renderHandle.anim.animType = animType;
        this.renderHandle.anim.axisType = axisType;
        this.renderHandle.anim.useVertexPhase = useVertexPhase;
      }
      return true;
    }

    protected override updateBuffers(target: SceneObjectInstance): void {
      if (!this.gl || !this.fillBuffer || !this.renderHandle) {
        return;
      }

      const pos = getInstanceRenderPosition(target);
      const rotation = target.data.rotation ?? 0;
      const origin = transformObjectPoint(pos, rotation, options.offset);

      let fillRefChanged = false;
      if (typeof options.refreshFill === "function") {
        if (target.data.fill !== this.prevInstanceFillRef) {
          this.prevInstanceFillRef = target.data.fill;
          this.cachedFill = options.refreshFill(target);
          fillRefChanged = true;
        }
      }

      const fillCenter = transformObjectPoint(pos, rotation, {
        x: (options.offset?.x ?? 0) + center.x,
        y: (options.offset?.y ?? 0) + center.y,
      });

      if (this.needsFillUpload || fillRefChanged) {
        const fillComponents = writeFillVertexComponents(this.fillScratch, {
          fill: this.cachedFill,
          center: fillCenter,
          rotation,
          size: geometry.size,
        });
        this.fillData = buildFillBufferData(vertexCount, fillComponents, this.fillData ?? undefined);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.fillBuffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.fillData);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        this.needsFillUpload = false;
      }

      this.renderHandle.anim.timeMs = getSceneTimelineNow();
      this.renderHandle.anim.origin.x = origin.x;
      this.renderHandle.anim.origin.y = origin.y;
      this.renderHandle.anim.rotation = rotation;

      const dx = pos.x - this.prevPosX;
      const dy = pos.y - this.prevPosY;
      const moveLen = Math.sqrt(dx * dx + dy * dy);
      if (moveLen > 0.01) {
        this.renderHandle.anim.movementDir.x = dx / moveLen;
        this.renderHandle.anim.movementDir.y = dy / moveLen;
      }
      this.prevPosX = pos.x;
      this.prevPosY = pos.y;
    }

    protected override releaseResources(_gl: WebGL2RenderingContext): void {
      if (this.renderHandle) {
        polygonGpuRenderer.release(this.renderHandle);
        this.renderHandle = null;
      }
      this.positionBuffer = null;
      this.fillBuffer = null;
      this.fillData = null;
      this.needsFillUpload = true;
    }
  }

  // Pre-compute animation params from config (optional - static polygon if undefined)
  const anim = options.anim;
  const hasAnim = !!anim;
  const axis = anim?.axis ?? "normal";
  const axisType = axis === "tangent" ? 1 : axis === "movement-tangent" ? 2 : axis === "movement-normal" ? 3 : 0;
  const animType = anim?.type === "pulse" ? 1 : 0;
  const useVertexPhase = anim?.type === "sway" && axisType !== 2 ? 1 : 0;
  const amplitudePercent =
    hasAnim && typeof anim?.amplitudePercentage === "number" && Number.isFinite(anim.amplitudePercentage)
      ? anim.amplitudePercentage
      : -1;

  return new PolygonGpuPrimitive();
};
