import type {
  SceneFill,
  SceneObjectInstance,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { RendererLayerAnimationConfig } from "@shared/types/renderer.types";
import { getAnimationGpuContext } from "@ui/renderers/objects/shared/animation-gpu";
import {
  DynamicPrimitive,
  getInstanceRenderPosition,
  transformObjectPoint,
} from "@ui/renderers/objects/ObjectRenderer";
import { writeFillVertexComponents, buildPackedVertices, writeExpandedColorAnimData } from "@ui/renderers/primitives/utils/fill";
import { resolveAxisType } from "@ui/renderers/primitives/core/animation.types";
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

interface PolygonGpuPrimitiveConfig {
  vertexCount: number;
  packedVertices: Float32Array;
  geometry: { size: { width: number; height: number } };
  center: SceneVector2;
  anim: RendererLayerAnimationConfig | undefined;
  hasAnim: boolean;
  axisType: number;
  animType: number;
  useVertexPhase: number;
  amplitudePercent: number;
  options: PolygonGpuPrimitiveOptions;
  initialFillRef: SceneFill | undefined;
  initialPos: SceneVector2;
}

class PolygonGpuPrimitive extends GpuPrimitiveBase {
  private cachedFill: SceneFill;
  private prevInstanceFillRef: SceneFill | undefined;

  private positionBuffer: WebGLBuffer | null = null;
  private renderHandle: PolygonGpuHandle | null = null;

  private prevPosX: number;
  private prevPosY: number;
  private needsFillUpload = true;

  public constructor(private readonly config: PolygonGpuPrimitiveConfig) {
    super(getAnimationGpuContext);
    this.cachedFill = config.options.fill;
    this.prevInstanceFillRef = config.initialFillRef;
    this.prevPosX = config.initialPos.x;
    this.prevPosY = config.initialPos.y;
  }

  protected override createResources(gl: WebGL2RenderingContext): boolean {
    const { config } = this;

    if (!this.positionBuffer) {
      const packed = config.packedVertices as unknown as BufferSource;
      this.positionBuffer = this.createBuffer(gl, gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);
      if (!this.positionBuffer) {
        return false;
      }
    }

    polygonGpuRenderer.setContext(gl);
    if (!this.renderHandle) {
      this.renderHandle = polygonGpuRenderer.acquire({
        positionBuffer: this.positionBuffer,
        vertexCount: config.vertexCount,
        center: config.center,
      });
      if (!this.renderHandle) {
        return false;
      }
      const { anim, hasAnim, axisType, animType, useVertexPhase, amplitudePercent, options } = config;
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
    if (!this.renderHandle) {
      return;
    }

    const { config } = this;
    const { options, center, geometry } = config;

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
      writeFillVertexComponents(this.renderHandle.fillData, {
        fill: this.cachedFill,
        center: fillCenter,
        rotation,
        size: geometry.size,
      });
      writeExpandedColorAnimData(
        this.renderHandle.expandedAnimData,
        this.cachedFill.colorAnimation
      );
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
    this.needsFillUpload = true;
  }
}

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

  const center = options.vertices.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
    { x: 0, y: 0 }
  );
  const invCount = vertexCount > 0 ? 1 / vertexCount : 0;
  center.x *= invCount;
  center.y *= invCount;

  const anim = options.anim;
  const hasAnim = !!anim;
  const axisType = resolveAxisType(anim?.axis);
  const isMovementAxis = axisType === 2 || axisType === 3;
  const animType = anim?.type === "pulse" ? 1 : 0;
  const useVertexPhase = anim?.type === "sway" && !isMovementAxis ? 1 : 0;
  const amplitudePercent =
    hasAnim && typeof anim?.amplitudePercentage === "number" && Number.isFinite(anim.amplitudePercentage)
      ? anim.amplitudePercentage
      : -1;

  const config: PolygonGpuPrimitiveConfig = {
    vertexCount,
    packedVertices,
    geometry,
    center,
    anim,
    hasAnim,
    axisType,
    animType,
    useVertexPhase,
    amplitudePercent,
    options,
    initialFillRef: typeof options.refreshFill === "function" ? instance.data.fill : undefined,
    initialPos: getInstanceRenderPosition(instance),
  };

  return new PolygonGpuPrimitive(config);
};
