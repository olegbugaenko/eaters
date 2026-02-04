import type {
  SceneFill,
  SceneObjectInstance,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { RendererLayerAnimationConfig } from "@shared/types/renderer.types";
import {
  createPolygonTransformFeedbackResources,
  getAnimationGpuContext,
  updatePolygonTransformFeedback,
  type PolygonTransformFeedbackResources,
} from "@ui/renderers/objects/shared/animation-gpu";
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

export interface PolygonGpuPrimitiveOptions {
  vertices: SceneVector2[];
  anim: RendererLayerAnimationConfig;
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

  const center = options.vertices.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
    { x: 0, y: 0 }
  );
  const invCount = vertexCount > 0 ? 1 / vertexCount : 0;
  center.x *= invCount;
  center.y *= invCount;

  const fillScratch = new Float32Array(FILL_COMPONENTS);
  let fillData: Float32Array | null = null;
  let cachedFill: SceneFill = options.fill;
  let prevInstanceFillRef: SceneFill | undefined =
    typeof options.refreshFill === "function" ? instance.data.fill : undefined;

  let gl = getAnimationGpuContext();
  let tfResources: PolygonTransformFeedbackResources | null = null;
  let fillBuffer: WebGLBuffer | null = null;
  let renderHandle: PolygonGpuHandle | null = null;

  let prevPosX = getInstanceRenderPosition(instance).x;
  let prevPosY = getInstanceRenderPosition(instance).y;
  let prevRotation = instance.data.rotation ?? 0;
  let needsFillUpload = true;

  const ensureResources = (): boolean => {
    if (!gl) {
      gl = getAnimationGpuContext();
    }
    if (!gl) {
      return false;
    }
    if (!tfResources) {
      tfResources = createPolygonTransformFeedbackResources({
        vertexCount,
        vertices: packedVertices,
      });
      if (!tfResources) {
        return false;
      }
    }
    if (!fillBuffer) {
      fillBuffer = gl.createBuffer();
      if (!fillBuffer) {
        return false;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, fillBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        vertexCount * FILL_COMPONENTS * Float32Array.BYTES_PER_ELEMENT,
        gl.DYNAMIC_DRAW
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    polygonGpuRenderer.setContext(gl);
    if (!renderHandle) {
      renderHandle = polygonGpuRenderer.acquireHandle({
        outputBuffer: tfResources.outputBuffer,
        fillBuffer,
        vertexCount,
      });
      if (!renderHandle) {
        return false;
      }
    }
    return true;
  };

  const primitive: DynamicPrimitive = {
    get data() {
      return new Float32Array(0);
    },
    autoAnimate: true,
    update(target: SceneObjectInstance): Float32Array | null {
      if (!ensureResources() || !gl || !tfResources || !fillBuffer) {
        return null;
      }

      const pos = getInstanceRenderPosition(target);
      const rotation = target.data.rotation ?? 0;
      const origin = transformObjectPoint(pos, rotation, options.offset);

      let fillRefChanged = false;
      if (typeof options.refreshFill === "function") {
        if (target.data.fill !== prevInstanceFillRef) {
          prevInstanceFillRef = target.data.fill;
          cachedFill = options.refreshFill(target);
          fillRefChanged = true;
        }
      }

      if (
        needsFillUpload ||
        fillRefChanged ||
        pos.x !== prevPosX ||
        pos.y !== prevPosY ||
        rotation !== prevRotation
      ) {
        const fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
        const fillComponents = writeFillVertexComponents(fillScratch, {
          fill: cachedFill,
          center: fillCenter,
          rotation,
          size: geometry.size,
        });
        fillData = buildFillBufferData(vertexCount, fillComponents, fillData ?? undefined);
        gl.bindBuffer(gl.ARRAY_BUFFER, fillBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fillData);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        needsFillUpload = false;
      }

      prevPosX = pos.x;
      prevPosY = pos.y;
      prevRotation = rotation;

      updatePolygonTransformFeedback({
        resources: tfResources,
        vertices: packedVertices,
        vertexCount,
        anim: options.anim,
        timeMs: getSceneTimelineNow(),
        center,
        origin,
        rotation,
        phaseStep: options.phaseStep ?? 0.3,
        enableMovementAxis: Boolean(options.enableMovementAxis),
      });

      return null;
    },
    dispose() {
      if (!gl) {
        return;
      }
      if (renderHandle) {
        polygonGpuRenderer.releaseHandle(renderHandle);
        renderHandle = null;
      }
      if (fillBuffer) {
        gl.deleteBuffer(fillBuffer);
        fillBuffer = null;
      }
      if (tfResources) {
        gl.deleteBuffer(tfResources.inputBuffer);
        gl.deleteBuffer(tfResources.outputBuffer);
        gl.deleteVertexArray(tfResources.vao);
        tfResources = null;
      }
    },
  };

  return primitive;
};
