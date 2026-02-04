import type {
  SceneFill,
  SceneObjectInstance,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  DynamicPrimitive,
  getInstanceRenderPosition,
} from "@ui/renderers/objects/ObjectRenderer";
import { writeFillVertexComponents } from "@ui/renderers/primitives/utils/fill";
import { computePolygonGeometry } from "@ui/renderers/primitives/basic/PolygonPrimitive";
import { joinedPolygonGpuRenderer, type JoinedPolygonGpuHandle } from "@ui/renderers/primitives/gpu/joined/JoinedPolygonGpuRenderer";
import { getAnimationGpuContext } from "@ui/renderers/objects/shared/animation-gpu";
import { FILL_COMPONENTS } from "@ui/renderers/objects/ObjectRenderer";

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

const buildCircleFanVertices = (radius: number, segments: number): SceneVector2[] => {
  const normalized = Math.max(3, Math.floor(segments));
  const verts: SceneVector2[] = [{ x: 0, y: 0 }];
  for (let i = 0; i <= normalized; i += 1) {
    const angle = (i / normalized) * Math.PI * 2;
    verts.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return verts;
};

export interface JoinedGpuPrimitiveOptions {
  anchorIndex: number;
  joinOffset?: SceneVector2;
  refreshFill?: (instance: SceneObjectInstance) => SceneFill;
}

export const createJoinedPolygonGpuPrimitive = (
  instance: SceneObjectInstance,
  options: {
    vertices: SceneVector2[];
    fill: SceneFill;
  } & JoinedGpuPrimitiveOptions
): DynamicPrimitive | null => {
  if (!options.vertices || options.vertices.length < 3) {
    return null;
  }
  const vertexCount = options.vertices.length;
  const packedVertices = buildPackedVertices(options.vertices);
  const geometry = computePolygonGeometry(options.vertices);

  const fillScratch = new Float32Array(FILL_COMPONENTS);
  let fillData: Float32Array | null = null;
  let cachedFill: SceneFill = options.fill;
  let prevInstanceFillRef: SceneFill | undefined =
    typeof options.refreshFill === "function" ? instance.data.fill : undefined;

  let gl = getAnimationGpuContext();
  let fillBuffer: WebGLBuffer | null = null;
  let positionBuffer: WebGLBuffer | null = null;
  let renderHandle: JoinedPolygonGpuHandle | null = null;

  const ensureResources = (): boolean => {
    if (!gl) {
      gl = getAnimationGpuContext();
    }
    if (!gl) {
      return false;
    }
    if (!positionBuffer) {
      positionBuffer = gl.createBuffer();
      if (!positionBuffer) {
        return false;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        packedVertices,
        gl.STATIC_DRAW
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
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
    joinedPolygonGpuRenderer.setContext(gl);
    if (!renderHandle) {
      renderHandle = joinedPolygonGpuRenderer.acquireHandle({
        positionBuffer,
        fillBuffer,
        vertexCount,
        anchorIndex: options.anchorIndex,
        joinOffset: options.joinOffset ?? { x: 0, y: 0 },
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
      if (!ensureResources() || !gl || !fillBuffer || !renderHandle) {
        return null;
      }

      let fillRefChanged = false;
      if (typeof options.refreshFill === "function") {
        if (target.data.fill !== prevInstanceFillRef) {
          prevInstanceFillRef = target.data.fill;
          cachedFill = options.refreshFill(target);
          fillRefChanged = true;
        }
      }

      if (fillRefChanged) {
        const fillComponents = writeFillVertexComponents(fillScratch, {
          fill: cachedFill,
          center: geometry.centerOffset,
          rotation: 0,
          size: geometry.size,
        });
        fillData = buildFillBufferData(vertexCount, fillComponents, fillData ?? undefined);
        gl.bindBuffer(gl.ARRAY_BUFFER, fillBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fillData);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      } else if (!fillData) {
        const fillComponents = writeFillVertexComponents(fillScratch, {
          fill: cachedFill,
          center: geometry.centerOffset,
          rotation: 0,
          size: geometry.size,
        });
        fillData = buildFillBufferData(vertexCount, fillComponents, fillData ?? undefined);
        gl.bindBuffer(gl.ARRAY_BUFFER, fillBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fillData);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      }

      const pos = getInstanceRenderPosition(target);
      renderHandle.instancePosition.x = pos.x;
      renderHandle.instancePosition.y = pos.y;
      renderHandle.instanceRotation = target.data.rotation ?? 0;
      return null;
    },
    dispose() {
      if (!gl) {
        return;
      }
      if (renderHandle) {
        joinedPolygonGpuRenderer.releaseHandle(renderHandle);
        renderHandle = null;
      }
      if (fillBuffer) {
        gl.deleteBuffer(fillBuffer);
        fillBuffer = null;
      }
      if (positionBuffer) {
        gl.deleteBuffer(positionBuffer);
        positionBuffer = null;
      }
    },
  };

  return primitive;
};

export const createJoinedCircleGpuPrimitive = (
  instance: SceneObjectInstance,
  options: {
    radius: number;
    segments?: number;
    fill: SceneFill;
  } & JoinedGpuPrimitiveOptions
): DynamicPrimitive | null => {
  const vertices = buildCircleFanVertices(options.radius, options.segments ?? 24);
  const vertexCount = vertices.length;
  const packedVertices = buildPackedVertices(vertices);

  const size = { width: options.radius * 2, height: options.radius * 2 };
  const centerOffset = { x: 0, y: 0 };

  const fillScratch = new Float32Array(FILL_COMPONENTS);
  let fillData: Float32Array | null = null;
  let cachedFill: SceneFill = options.fill;
  let prevInstanceFillRef: SceneFill | undefined =
    typeof options.refreshFill === "function" ? instance.data.fill : undefined;

  let gl = getAnimationGpuContext();
  let fillBuffer: WebGLBuffer | null = null;
  let positionBuffer: WebGLBuffer | null = null;
  let renderHandle: JoinedPolygonGpuHandle | null = null;

  const ensureResources = (): boolean => {
    if (!gl) {
      gl = getAnimationGpuContext();
    }
    if (!gl) {
      return false;
    }
    if (!positionBuffer) {
      positionBuffer = gl.createBuffer();
      if (!positionBuffer) {
        return false;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, packedVertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
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
    joinedPolygonGpuRenderer.setContext(gl);
    if (!renderHandle) {
      renderHandle = joinedPolygonGpuRenderer.acquireHandle({
        positionBuffer,
        fillBuffer,
        vertexCount,
        anchorIndex: options.anchorIndex,
        joinOffset: options.joinOffset ?? { x: 0, y: 0 },
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
      if (!ensureResources() || !gl || !fillBuffer || !renderHandle) {
        return null;
      }

      let fillRefChanged = false;
      if (typeof options.refreshFill === "function") {
        if (target.data.fill !== prevInstanceFillRef) {
          prevInstanceFillRef = target.data.fill;
          cachedFill = options.refreshFill(target);
          fillRefChanged = true;
        }
      }

      if (fillRefChanged || !fillData) {
        const fillComponents = writeFillVertexComponents(fillScratch, {
          fill: cachedFill,
          center: centerOffset,
          rotation: 0,
          size,
          radius: options.radius,
        });
        fillData = buildFillBufferData(vertexCount, fillComponents, fillData ?? undefined);
        gl.bindBuffer(gl.ARRAY_BUFFER, fillBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fillData);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      }

      const pos = getInstanceRenderPosition(target);
      renderHandle.instancePosition.x = pos.x;
      renderHandle.instancePosition.y = pos.y;
      renderHandle.instanceRotation = target.data.rotation ?? 0;
      return null;
    },
    dispose() {
      if (!gl) {
        return;
      }
      if (renderHandle) {
        joinedPolygonGpuRenderer.releaseHandle(renderHandle);
        renderHandle = null;
      }
      if (fillBuffer) {
        gl.deleteBuffer(fillBuffer);
        fillBuffer = null;
      }
      if (positionBuffer) {
        gl.deleteBuffer(positionBuffer);
        positionBuffer = null;
      }
    },
  };

  return primitive;
};
