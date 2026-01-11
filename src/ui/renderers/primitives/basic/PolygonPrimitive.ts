import {
  SceneFill,
  SceneObjectInstance,
  SceneVector2,
  SceneStroke,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import {
  DynamicPrimitive,
  StaticPrimitive,
  VERTEX_COMPONENTS,
  FILL_COMPONENTS,
  transformObjectPoint,
} from "../../objects/ObjectRenderer";
import {
  copyFillComponents,
  createFillVertexComponents,
  writeFillVertexComponents,
} from "../utils/fill";

interface PolygonPrimitiveOptions {
  center: SceneVector2;
  vertices: SceneVector2[];
  fill: SceneFill;
  rotation?: number;
  offset?: SceneVector2;
}

interface DynamicPolygonPrimitiveOptions {
  vertices?: SceneVector2[];
  getVertices?: (instance: SceneObjectInstance) => SceneVector2[];
  fill?: SceneFill;
  getFill?: (instance: SceneObjectInstance) => SceneFill;
  offset?: SceneVector2;
  /**
   * Callback to refresh fill when instance.data.fill reference changes.
   * Used for "base" fills in composite renderers that depend on visual effects.
   * Only called when instance.data.fill !== prevInstanceFill (reference changed).
   */
  refreshFill?: (instance: SceneObjectInstance) => SceneFill;
}

interface PolygonStrokeOptions {
  center: SceneVector2;
  vertices: SceneVector2[];
  stroke: SceneStroke;
  rotation?: number;
  offset?: SceneVector2;
}

type PolygonVertices = SceneVector2[];

type PolygonGeometry = {
  centerOffset: SceneVector2;
  size: { width: number; height: number };
};

const MIN_VERTEX_COUNT = 3;
const MIN_SIZE = 1e-6;

const cloneVertex = (vertex: SceneVector2): SceneVector2 => ({
  x: vertex.x,
  y: vertex.y,
});

const cloneVertices = (vertices: PolygonVertices): PolygonVertices =>
  vertices.map((vertex) => cloneVertex(vertex));

// Default fallback vertices - reused to avoid allocations
const DEFAULT_FALLBACK_VERTICES: PolygonVertices = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 0, y: 15 },
];

const ensureVertices = (vertices: SceneVector2[] | undefined): PolygonVertices => {
  if (!vertices || vertices.length < MIN_VERTEX_COUNT) {
    return DEFAULT_FALLBACK_VERTICES;
  }
  // OPTIMIZATION: Return vertices directly without cloning if they're already valid
  // This avoids massive GC pressure from creating new objects every frame
  // Callers that need mutation should clone explicitly
  return vertices as PolygonVertices;
};

const resolveVertices = (
  options: DynamicPolygonPrimitiveOptions,
  instance: SceneObjectInstance
): PolygonVertices => {
  if (typeof options.getVertices === "function") {
    return ensureVertices(options.getVertices(instance));
  }
  if (options.vertices) {
    return ensureVertices(options.vertices);
  }
  const data = instance.data.customData as
    | { vertices?: SceneVector2[] }
    | undefined;
  return ensureVertices(data?.vertices);
};

const resolveFill = (
  options: DynamicPolygonPrimitiveOptions,
  instance: SceneObjectInstance
): SceneFill => {
  if (typeof options.getFill === "function") {
    return options.getFill(instance);
  }
  if (options.fill) {
    return options.fill;
  }
  return instance.data.fill;
};

// OPTIMIZATION: Reusable geometry object to avoid per-frame allocations
const computeGeometry = (vertices: PolygonVertices, out?: PolygonGeometry): PolygonGeometry => {
  const result = out ?? {
    centerOffset: { x: 0, y: 0 },
    size: { width: MIN_SIZE, height: MIN_SIZE },
  };

  if (vertices.length < MIN_VERTEX_COUNT) {
    result.centerOffset.x = 0;
    result.centerOffset.y = 0;
    result.size.width = MIN_SIZE;
    result.size.height = MIN_SIZE;
    return result;
  }
  let minX = vertices[0]!.x;
  let maxX = vertices[0]!.x;
  let minY = vertices[0]!.y;
  let maxY = vertices[0]!.y;

  for (let i = 1; i < vertices.length; i += 1) {
    const vertex = vertices[i]!;
    if (vertex.x < minX) {
      minX = vertex.x;
    }
    if (vertex.x > maxX) {
      maxX = vertex.x;
    }
    if (vertex.y < minY) {
      minY = vertex.y;
    }
    if (vertex.y > maxY) {
      maxY = vertex.y;
    }
  }

  result.centerOffset.x = (minX + maxX) / 2;
  result.centerOffset.y = (minY + maxY) / 2;
  result.size.width = Math.max(MIN_SIZE, maxX - minX);
  result.size.height = Math.max(MIN_SIZE, maxY - minY);

  return result;
};

const pushVertex = (
  target: Float32Array,
  offset: number,
  x: number,
  y: number,
  fillComponents: Float32Array
): number => {
  target[offset + 0] = x;
  target[offset + 1] = y;
  copyFillComponents(target, offset, fillComponents);
  return offset + VERTEX_COMPONENTS;
};

const assignVertex = (
  target: Float32Array,
  offset: number,
  x: number,
  y: number,
  fillComponents: Float32Array
): boolean => {
  let changed = false;
  if (target[offset + 0] !== x) {
    target[offset + 0] = x;
    changed = true;
  }
  if (target[offset + 1] !== y) {
    target[offset + 1] = y;
    changed = true;
  }
  for (let i = 0; i < fillComponents.length; i += 1) {
    const index = offset + 2 + i;
    const value = fillComponents[i] ?? 0;
    if (target[index] !== value) {
      target[index] = value;
      changed = true;
    }
  }
  return changed;
};

// Optimized: inline transform, avoid .map() allocations
const buildPolygonData = (
  center: SceneVector2,
  rotation: number,
  vertices: PolygonVertices,
  fillComponents: Float32Array
): Float32Array => {
  const triangleCount = Math.max(vertices.length - 2, 0);
  if (triangleCount <= 0) {
    return new Float32Array(0);
  }
  const cx = center.x;
  const cy = center.y;
  const hasRotation = rotation !== 0;
  const cos = hasRotation ? Math.cos(rotation) : 1;
  const sin = hasRotation ? Math.sin(rotation) : 0;

  // Inline transform helper
  const transformX = (v: SceneVector2): number =>
    hasRotation ? cx + v.x * cos - v.y * sin : cx + v.x;
  const transformY = (v: SceneVector2): number =>
    hasRotation ? cy + v.x * sin + v.y * cos : cy + v.y;

  const data = new Float32Array(triangleCount * 3 * VERTEX_COMPONENTS);
  let writeOffset = 0;
  const anchor = vertices[0]!;
  const anchorX = transformX(anchor);
  const anchorY = transformY(anchor);

  for (let i = 1; i < vertices.length - 1; i += 1) {
    writeOffset = pushVertex(data, writeOffset, anchorX, anchorY, fillComponents);
    const current = vertices[i]!;
    writeOffset = pushVertex(
      data,
      writeOffset,
      transformX(current),
      transformY(current),
      fillComponents
    );
    const next = vertices[i + 1]!;
    writeOffset = pushVertex(
      data,
      writeOffset,
      transformX(next),
      transformY(next),
      fillComponents
    );
  }
  return data;
};

// Optimized: fully inlined transform, no function allocations
const updatePolygonData = (
  target: Float32Array,
  center: SceneVector2,
  rotation: number,
  vertices: PolygonVertices,
  fillComponents: Float32Array
): boolean => {
  const triangleCount = Math.max(vertices.length - 2, 0);
  if (triangleCount <= 0) {
    if (target.length === 0) {
      return false;
    }
    for (let i = 0; i < target.length; i += 1) {
      if (target[i] !== 0) {
        target[i] = 0;
      }
    }
    return true;
  }
  const cx = center.x;
  const cy = center.y;
  const hasRotation = rotation !== 0;
  const cos = hasRotation ? Math.cos(rotation) : 1;
  const sin = hasRotation ? Math.sin(rotation) : 0;
  const fillLen = fillComponents.length;

  let offset = 0;
  let changed = false;
  const anchor = vertices[0]!;
  const anchorX = hasRotation ? cx + anchor.x * cos - anchor.y * sin : cx + anchor.x;
  const anchorY = hasRotation ? cy + anchor.x * sin + anchor.y * cos : cy + anchor.y;

  for (let i = 1; i < vertices.length - 1; i += 1) {
    // Inline assignVertex for anchor
    if (target[offset] !== anchorX) { target[offset] = anchorX; changed = true; }
    if (target[offset + 1] !== anchorY) { target[offset + 1] = anchorY; changed = true; }
    for (let f = 0; f < fillLen; f++) {
      const val = fillComponents[f]!;
      if (target[offset + 2 + f] !== val) { target[offset + 2 + f] = val; changed = true; }
    }
    offset += VERTEX_COMPONENTS;

    const current = vertices[i]!;
    const currX = hasRotation ? cx + current.x * cos - current.y * sin : cx + current.x;
    const currY = hasRotation ? cy + current.x * sin + current.y * cos : cy + current.y;
    if (target[offset] !== currX) { target[offset] = currX; changed = true; }
    if (target[offset + 1] !== currY) { target[offset + 1] = currY; changed = true; }
    for (let f = 0; f < fillLen; f++) {
      const val = fillComponents[f]!;
      if (target[offset + 2 + f] !== val) { target[offset + 2 + f] = val; changed = true; }
    }
    offset += VERTEX_COMPONENTS;

    const next = vertices[i + 1]!;
    const nextX = hasRotation ? cx + next.x * cos - next.y * sin : cx + next.x;
    const nextY = hasRotation ? cy + next.x * sin + next.y * cos : cy + next.y;
    if (target[offset] !== nextX) { target[offset] = nextX; changed = true; }
    if (target[offset + 1] !== nextY) { target[offset + 1] = nextY; changed = true; }
    for (let f = 0; f < fillLen; f++) {
      const val = fillComponents[f]!;
      if (target[offset + 2 + f] !== val) { target[offset + 2 + f] = val; changed = true; }
    }
    offset += VERTEX_COMPONENTS;
  }
  return changed;
};

const updatePolygonPositionData = (
  target: Float32Array,
  center: SceneVector2,
  rotation: number,
  vertices: PolygonVertices
): boolean => {
  const triangleCount = Math.max(vertices.length - 2, 0);
  if (triangleCount <= 0) {
    return false;
  }
  const cx = center.x;
  const cy = center.y;
  const hasRotation = rotation !== 0;
  const cos = hasRotation ? Math.cos(rotation) : 1;
  const sin = hasRotation ? Math.sin(rotation) : 0;

  let offset = 0;
  let changed = false;
  const anchor = vertices[0]!;
  const anchorX = hasRotation ? cx + anchor.x * cos - anchor.y * sin : cx + anchor.x;
  const anchorY = hasRotation ? cy + anchor.x * sin + anchor.y * cos : cy + anchor.y;

  for (let i = 1; i < vertices.length - 1; i += 1) {
    if (target[offset] !== anchorX) { target[offset] = anchorX; changed = true; }
    if (target[offset + 1] !== anchorY) { target[offset + 1] = anchorY; changed = true; }
    offset += VERTEX_COMPONENTS;

    const current = vertices[i]!;
    const currX = hasRotation ? cx + current.x * cos - current.y * sin : cx + current.x;
    const currY = hasRotation ? cy + current.x * sin + current.y * cos : cy + current.y;
    if (target[offset] !== currX) { target[offset] = currX; changed = true; }
    if (target[offset + 1] !== currY) { target[offset + 1] = currY; changed = true; }
    offset += VERTEX_COMPONENTS;

    const next = vertices[i + 1]!;
    const nextX = hasRotation ? cx + next.x * cos - next.y * sin : cx + next.x;
    const nextY = hasRotation ? cy + next.x * sin + next.y * cos : cy + next.y;
    if (target[offset] !== nextX) { target[offset] = nextX; changed = true; }
    if (target[offset + 1] !== nextY) { target[offset + 1] = nextY; changed = true; }
    offset += VERTEX_COMPONENTS;
  }
  return changed;
};

// Optimized: reuse output array when size matches
const expandVertices = (
  vertices: PolygonVertices,
  centerOffset: SceneVector2,
  strokeWidth: number,
  output?: PolygonVertices
): PolygonVertices => {
  const n = vertices.length;
  if (strokeWidth <= 0) {
    // When no stroke, just copy
    if (output && output.length === n) {
      for (let i = 0; i < n; i++) {
        const src = vertices[i]!;
        const dst = output[i]!;
        dst.x = src.x;
        dst.y = src.y;
      }
      return output;
    }
    return cloneVertices(vertices);
  }
  // Reuse or create output array
  let result: PolygonVertices;
  if (output && output.length === n) {
    result = output;
  } else {
    result = new Array(n);
    for (let i = 0; i < n; i++) {
      result[i] = { x: 0, y: 0 };
    }
  }
  const cox = centerOffset.x;
  const coy = centerOffset.y;
  for (let i = 0; i < n; i++) {
    const vertex = vertices[i]!;
    const dirX = vertex.x - cox;
    const dirY = vertex.y - coy;
    const length = Math.hypot(dirX, dirY);
    const out = result[i]!;
    if (length === 0) {
      out.x = vertex.x + strokeWidth;
      out.y = vertex.y;
    } else {
      const scale = (length + strokeWidth) / Math.max(length, 1e-6);
      out.x = cox + dirX * scale;
      out.y = coy + dirY * scale;
    }
  }
  return result;
};

const createStrokeFill = (stroke: SceneStroke): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: stroke.color.r,
    g: stroke.color.g,
    b: stroke.color.b,
    a: typeof stroke.color.a === "number" ? stroke.color.a : 1,
  },
});

export const createStaticPolygonPrimitive = (
  options: PolygonPrimitiveOptions
): StaticPrimitive => {
  const { center, vertices, fill, rotation, offset } = options;
  const origin = transformObjectPoint(center, rotation, offset);
  const geometry = computeGeometry(vertices);
  const fillCenter = transformObjectPoint(
    origin,
    rotation ?? 0,
    geometry.centerOffset
  );
  const fillComponents = createFillVertexComponents({
    fill,
    center: fillCenter,
    rotation: rotation ?? 0,
    size: geometry.size,
  });
  return {
    data: buildPolygonData(origin, rotation ?? 0, vertices, fillComponents),
  };
};

export const createDynamicPolygonPrimitive = (
  instance: SceneObjectInstance,
  options: DynamicPolygonPrimitiveOptions = {}
): DynamicPrimitive => {
  // Check if vertices and fill are static (not animated)
  const isStaticVertices = !options.getVertices && !!options.vertices;
  const isStaticFill = !options.getFill && !!options.fill;
  // refreshFill tracks instance.data.fill reference changes for visual effects
  const hasRefreshFill = typeof options.refreshFill === "function";
  // Can only fast-path if fill doesn't need refresh tracking
  const canFastPath = isStaticVertices && isStaticFill && !hasRefreshFill;
  
  const initialVertices = resolveVertices(options, instance);
  let vertexCount = initialVertices.length;
  let geometry = computeGeometry(initialVertices);
  const getCenter = (target: SceneObjectInstance): SceneVector2 =>
    transformObjectPoint(target.data.position, target.data.rotation, options.offset);

  let origin = getCenter(instance);
  let rotation = instance.data.rotation ?? 0;
  let fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
  const fillScratch = new Float32Array(FILL_COMPONENTS);
  
  // Cache the resolved fill and track instance.data.fill reference for refreshFill
  let cachedFill: SceneFill = resolveFill(options, instance);
  let prevInstanceFillRef: SceneFill | undefined = hasRefreshFill ? instance.data.fill : undefined;
  
  let fillComponents = writeFillVertexComponents(fillScratch, {
    fill: cachedFill,
    center: fillCenter,
    rotation,
    size: geometry.size,
  });

  let data = buildPolygonData(origin, rotation, initialVertices, fillComponents);
  let currentVertices = initialVertices;
  
  // Cache previous state for fast-path (use raw position, not transformed origin)
  let prevPosX = instance.data.position.x;
  let prevPosY = instance.data.position.y;
  let prevRotation = rotation;

  const primitive: DynamicPrimitive = {
    get data() {
      return data;
    },
    update(target: SceneObjectInstance) {
      const pos = target.data.position;
      const nextRotation = target.data.rotation ?? 0;
      
      // Fast path: skip expensive computations if nothing changed
      // For static vertices/fill, only position and rotation matter
      if (canFastPath &&
          pos.x === prevPosX &&
          pos.y === prevPosY &&
          nextRotation === prevRotation) {
        return null;
      }
      
      origin = getCenter(target);
      rotation = nextRotation;
      prevPosX = pos.x;
      prevPosY = pos.y;
      prevRotation = rotation;
      
      // Skip expensive geometry/vertices work for static vertices
      let nextVertices: PolygonVertices;
      if (isStaticVertices) {
        nextVertices = initialVertices;
      } else {
        nextVertices = resolveVertices(options, target);
        computeGeometry(nextVertices, geometry);
      }
      currentVertices = nextVertices;
      const nextVertexCount = nextVertices.length;
      
      fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
      // Reuse a single scratch buffer to avoid per-frame allocations
      // Check if fill reference changed (visual effect applied)
      let fillRefChanged = false;
      if (hasRefreshFill) {
        const fillChanged = target.data.fill !== prevInstanceFillRef;
        if (fillChanged) {
          prevInstanceFillRef = target.data.fill;
          cachedFill = options.refreshFill!(target);
          fillRefChanged = true;
        }
      }
      
      // Skip resolveFill for static fill (unless refreshFill triggered)
      if (!isStaticFill) {
        fillComponents = writeFillVertexComponents(fillScratch, {
          fill: resolveFill(options, target),
          center: fillCenter,
          rotation,
          size: geometry.size,
        });
      } else if (fillRefChanged) {
        // refreshFill was triggered - use the newly cached fill
        fillComponents = writeFillVertexComponents(fillScratch, {
          fill: cachedFill,
          center: fillCenter,
          rotation,
          size: geometry.size,
        });
      } else {
        // Just update center position in fill components
        fillComponents = writeFillVertexComponents(fillScratch, {
          fill: cachedFill,
          center: fillCenter,
          rotation,
          size: geometry.size,
        });
      }

      if (nextVertexCount !== vertexCount) {
        vertexCount = nextVertexCount;
        data = buildPolygonData(origin, rotation, nextVertices, fillComponents);
        return data;
      }

      const changed = updatePolygonData(
        data,
        origin,
        rotation,
        nextVertices,
        fillComponents
      );
      return changed ? data : null;
    },
    updatePositionOnly(target: SceneObjectInstance) {
      const pos = target.data.position;
      const nextRotation = target.data.rotation ?? 0;
      if (
        pos.x === prevPosX &&
        pos.y === prevPosY &&
        nextRotation === prevRotation
      ) {
        return null;
      }
      origin = getCenter(target);
      rotation = nextRotation;
      prevPosX = pos.x;
      prevPosY = pos.y;
      prevRotation = rotation;

      const expectedSize = Math.max(currentVertices.length - 2, 0) * 3 * VERTEX_COMPONENTS;
      if (data.length !== expectedSize) {
        return null;
      }

      const shouldUpdateFill =
        cachedFill.fillType !== FILL_TYPES.SOLID ||
        Boolean(cachedFill.noise || cachedFill.filaments || cachedFill.crackMask);
      if (shouldUpdateFill) {
        const fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
        fillComponents = writeFillVertexComponents(fillScratch, {
          fill: cachedFill,
          center: fillCenter,
          rotation,
          size: geometry.size,
        });
      }

      const changed = shouldUpdateFill
        ? updatePolygonData(data, origin, rotation, currentVertices, fillComponents)
        : updatePolygonPositionData(data, origin, rotation, currentVertices);
      return changed ? data : null;
    },
  };

  return primitive;
};

interface DynamicPolygonStrokePrimitiveOptions {
  vertices?: SceneVector2[];
  getVertices?: (instance: SceneObjectInstance) => SceneVector2[];
  stroke: SceneStroke;
  offset?: SceneVector2;
  /**
   * Callback to refresh stroke when instance.data.stroke reference changes.
   * Used for "base" strokes in composite renderers that depend on visual effects.
   */
  refreshStroke?: (instance: SceneObjectInstance) => SceneStroke;
}

// Optimized: fully inlined transform and vertex writing, no function allocations
const buildStrokeBandData = (
  center: SceneVector2,
  rotation: number,
  inner: PolygonVertices,
  outer: PolygonVertices,
  fillComponents: Float32Array,
  existingData?: Float32Array
): Float32Array => {
  const n = Math.min(inner.length, outer.length);
  if (n < MIN_VERTEX_COUNT) {
    return new Float32Array(0);
  }
  // Two triangles per edge, 3 vertices each
  const triCount = n * 2;
  const requiredSize = triCount * 3 * VERTEX_COMPONENTS;
  const data =
    existingData && existingData.length === requiredSize
      ? existingData
      : new Float32Array(requiredSize);

  const cx = center.x;
  const cy = center.y;
  const hasRotation = rotation !== 0;
  const cos = hasRotation ? Math.cos(rotation) : 1;
  const sin = hasRotation ? Math.sin(rotation) : 0;
  const fillLen = fillComponents.length;

  let write = 0;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const outerI = outer[i]!;
    const outerJ = outer[j]!;
    const innerI = inner[i]!;
    const innerJ = inner[j]!;

    // Inline transform calculations (no function call overhead)
    let Ax: number, Ay: number, Bx: number, By: number;
    let ax: number, ay: number, bx: number, by: number;
    if (hasRotation) {
      Ax = cx + outerI.x * cos - outerI.y * sin;
      Ay = cy + outerI.x * sin + outerI.y * cos;
      Bx = cx + outerJ.x * cos - outerJ.y * sin;
      By = cy + outerJ.x * sin + outerJ.y * cos;
      ax = cx + innerI.x * cos - innerI.y * sin;
      ay = cy + innerI.x * sin + innerI.y * cos;
      bx = cx + innerJ.x * cos - innerJ.y * sin;
      by = cy + innerJ.x * sin + innerJ.y * cos;
    } else {
      Ax = cx + outerI.x;
      Ay = cy + outerI.y;
      Bx = cx + outerJ.x;
      By = cy + outerJ.y;
      ax = cx + innerI.x;
      ay = cy + innerI.y;
      bx = cx + innerJ.x;
      by = cy + innerJ.y;
    }

    // Inline vertex writing (no function call overhead)
    // Triangle 1: A, B, a
    data[write] = Ax; data[write + 1] = Ay;
    for (let f = 0; f < fillLen; f++) data[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
    
    data[write] = Bx; data[write + 1] = By;
    for (let f = 0; f < fillLen; f++) data[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
    
    data[write] = ax; data[write + 1] = ay;
    for (let f = 0; f < fillLen; f++) data[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
    
    // Triangle 2: a, B, b
    data[write] = ax; data[write + 1] = ay;
    for (let f = 0; f < fillLen; f++) data[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
    
    data[write] = Bx; data[write + 1] = By;
    for (let f = 0; f < fillLen; f++) data[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
    
    data[write] = bx; data[write + 1] = by;
    for (let f = 0; f < fillLen; f++) data[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
  }
  return data;
};

// Fast path: update stroke band data directly without change detection
// Use this for animated vertices where changes are guaranteed
const updateStrokeBandDataFast = (
  target: Float32Array,
  center: SceneVector2,
  rotation: number,
  inner: PolygonVertices,
  outer: PolygonVertices,
  fillComponents: Float32Array
): void => {
  const n = Math.min(inner.length, outer.length);
  if (n < MIN_VERTEX_COUNT) {
    return;
  }
  
  const cx = center.x;
  const cy = center.y;
  const hasRotation = rotation !== 0;
  const cos = hasRotation ? Math.cos(rotation) : 1;
  const sin = hasRotation ? Math.sin(rotation) : 0;
  const fillLen = fillComponents.length;
  
  let write = 0;
  
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const outerI = outer[i]!;
    const outerJ = outer[j]!;
    const innerI = inner[i]!;
    const innerJ = inner[j]!;
    
    let Ax: number, Ay: number, Bx: number, By: number;
    let ax: number, ay: number, bx: number, by: number;
    if (hasRotation) {
      Ax = cx + outerI.x * cos - outerI.y * sin;
      Ay = cy + outerI.x * sin + outerI.y * cos;
      Bx = cx + outerJ.x * cos - outerJ.y * sin;
      By = cy + outerJ.x * sin + outerJ.y * cos;
      ax = cx + innerI.x * cos - innerI.y * sin;
      ay = cy + innerI.x * sin + innerI.y * cos;
      bx = cx + innerJ.x * cos - innerJ.y * sin;
      by = cy + innerJ.x * sin + innerJ.y * cos;
    } else {
      Ax = cx + outerI.x;
      Ay = cy + outerI.y;
      Bx = cx + outerJ.x;
      By = cy + outerJ.y;
      ax = cx + innerI.x;
      ay = cy + innerI.y;
      bx = cx + innerJ.x;
      by = cy + innerJ.y;
    }
    
    // Triangle 1: A, B, a - direct write, no comparison
    target[write] = Ax; target[write + 1] = Ay;
    for (let f = 0; f < fillLen; f++) target[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
    
    target[write] = Bx; target[write + 1] = By;
    for (let f = 0; f < fillLen; f++) target[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
    
    target[write] = ax; target[write + 1] = ay;
    for (let f = 0; f < fillLen; f++) target[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
    
    // Triangle 2: a, B, b
    target[write] = ax; target[write + 1] = ay;
    for (let f = 0; f < fillLen; f++) target[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
    
    target[write] = Bx; target[write + 1] = By;
    for (let f = 0; f < fillLen; f++) target[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
    
    target[write] = bx; target[write + 1] = by;
    for (let f = 0; f < fillLen; f++) target[write + 2 + f] = fillComponents[f]!;
    write += VERTEX_COMPONENTS;
  }
};

// Slow path: update stroke band data with change detection
// Use this for static vertices where we can skip GPU upload if unchanged
const updateStrokeBandData = (
  target: Float32Array,
  center: SceneVector2,
  rotation: number,
  inner: PolygonVertices,
  outer: PolygonVertices,
  fillComponents: Float32Array
): boolean => {
  const n = Math.min(inner.length, outer.length);
  if (n < MIN_VERTEX_COUNT) {
    return false;
  }
  
  const cx = center.x;
  const cy = center.y;
  const hasRotation = rotation !== 0;
  const cos = hasRotation ? Math.cos(rotation) : 1;
  const sin = hasRotation ? Math.sin(rotation) : 0;
  const fillLen = fillComponents.length;
  
  let write = 0;
  let changed = false;
  
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const outerI = outer[i]!;
    const outerJ = outer[j]!;
    const innerI = inner[i]!;
    const innerJ = inner[j]!;
    
    let Ax: number, Ay: number, Bx: number, By: number;
    let ax: number, ay: number, bx: number, by: number;
    if (hasRotation) {
      Ax = cx + outerI.x * cos - outerI.y * sin;
      Ay = cy + outerI.x * sin + outerI.y * cos;
      Bx = cx + outerJ.x * cos - outerJ.y * sin;
      By = cy + outerJ.x * sin + outerJ.y * cos;
      ax = cx + innerI.x * cos - innerI.y * sin;
      ay = cy + innerI.x * sin + innerI.y * cos;
      bx = cx + innerJ.x * cos - innerJ.y * sin;
      by = cy + innerJ.x * sin + innerJ.y * cos;
    } else {
      Ax = cx + outerI.x;
      Ay = cy + outerI.y;
      Bx = cx + outerJ.x;
      By = cy + outerJ.y;
      ax = cx + innerI.x;
      ay = cy + innerI.y;
      bx = cx + innerJ.x;
      by = cy + innerJ.y;
    }
    
    // Triangle 1: A, B, a - inline with change detection
    if (target[write] !== Ax) { target[write] = Ax; changed = true; }
    if (target[write + 1] !== Ay) { target[write + 1] = Ay; changed = true; }
    for (let f = 0; f < fillLen; f++) {
      const val = fillComponents[f]!;
      if (target[write + 2 + f] !== val) { target[write + 2 + f] = val; changed = true; }
    }
    write += VERTEX_COMPONENTS;
    
    if (target[write] !== Bx) { target[write] = Bx; changed = true; }
    if (target[write + 1] !== By) { target[write + 1] = By; changed = true; }
    for (let f = 0; f < fillLen; f++) {
      const val = fillComponents[f]!;
      if (target[write + 2 + f] !== val) { target[write + 2 + f] = val; changed = true; }
    }
    write += VERTEX_COMPONENTS;
    
    if (target[write] !== ax) { target[write] = ax; changed = true; }
    if (target[write + 1] !== ay) { target[write + 1] = ay; changed = true; }
    for (let f = 0; f < fillLen; f++) {
      const val = fillComponents[f]!;
      if (target[write + 2 + f] !== val) { target[write + 2 + f] = val; changed = true; }
    }
    write += VERTEX_COMPONENTS;
    
    // Triangle 2: a, B, b
    if (target[write] !== ax) { target[write] = ax; changed = true; }
    if (target[write + 1] !== ay) { target[write + 1] = ay; changed = true; }
    for (let f = 0; f < fillLen; f++) {
      const val = fillComponents[f]!;
      if (target[write + 2 + f] !== val) { target[write + 2 + f] = val; changed = true; }
    }
    write += VERTEX_COMPONENTS;
    
    if (target[write] !== Bx) { target[write] = Bx; changed = true; }
    if (target[write + 1] !== By) { target[write + 1] = By; changed = true; }
    for (let f = 0; f < fillLen; f++) {
      const val = fillComponents[f]!;
      if (target[write + 2 + f] !== val) { target[write + 2 + f] = val; changed = true; }
    }
    write += VERTEX_COMPONENTS;
    
    if (target[write] !== bx) { target[write] = bx; changed = true; }
    if (target[write + 1] !== by) { target[write + 1] = by; changed = true; }
    for (let f = 0; f < fillLen; f++) {
      const val = fillComponents[f]!;
      if (target[write + 2 + f] !== val) { target[write + 2 + f] = val; changed = true; }
    }
    write += VERTEX_COMPONENTS;
  }
  
  return changed;
};

const updateStrokeBandPositionData = (
  target: Float32Array,
  center: SceneVector2,
  rotation: number,
  inner: PolygonVertices,
  outer: PolygonVertices
): boolean => {
  const n = Math.min(inner.length, outer.length);
  if (n < MIN_VERTEX_COUNT) {
    return false;
  }
  const cx = center.x;
  const cy = center.y;
  const hasRotation = rotation !== 0;
  const cos = hasRotation ? Math.cos(rotation) : 1;
  const sin = hasRotation ? Math.sin(rotation) : 0;

  let write = 0;
  let changed = false;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const outerI = outer[i]!;
    const outerJ = outer[j]!;
    const innerI = inner[i]!;
    const innerJ = inner[j]!;

    let Ax: number, Ay: number, Bx: number, By: number;
    let ax: number, ay: number, bx: number, by: number;
    if (hasRotation) {
      Ax = cx + outerI.x * cos - outerI.y * sin;
      Ay = cy + outerI.x * sin + outerI.y * cos;
      Bx = cx + outerJ.x * cos - outerJ.y * sin;
      By = cy + outerJ.x * sin + outerJ.y * cos;
      ax = cx + innerI.x * cos - innerI.y * sin;
      ay = cy + innerI.x * sin + innerI.y * cos;
      bx = cx + innerJ.x * cos - innerJ.y * sin;
      by = cy + innerJ.x * sin + innerJ.y * cos;
    } else {
      Ax = cx + outerI.x;
      Ay = cy + outerI.y;
      Bx = cx + outerJ.x;
      By = cy + outerJ.y;
      ax = cx + innerI.x;
      ay = cy + innerI.y;
      bx = cx + innerJ.x;
      by = cy + innerJ.y;
    }

    if (target[write] !== Ax) { target[write] = Ax; changed = true; }
    if (target[write + 1] !== Ay) { target[write + 1] = Ay; changed = true; }
    write += VERTEX_COMPONENTS;

    if (target[write] !== Bx) { target[write] = Bx; changed = true; }
    if (target[write + 1] !== By) { target[write + 1] = By; changed = true; }
    write += VERTEX_COMPONENTS;

    if (target[write] !== ax) { target[write] = ax; changed = true; }
    if (target[write + 1] !== ay) { target[write + 1] = ay; changed = true; }
    write += VERTEX_COMPONENTS;

    if (target[write] !== ax) { target[write] = ax; changed = true; }
    if (target[write + 1] !== ay) { target[write + 1] = ay; changed = true; }
    write += VERTEX_COMPONENTS;

    if (target[write] !== Bx) { target[write] = Bx; changed = true; }
    if (target[write + 1] !== By) { target[write + 1] = By; changed = true; }
    write += VERTEX_COMPONENTS;

    if (target[write] !== bx) { target[write] = bx; changed = true; }
    if (target[write + 1] !== by) { target[write + 1] = by; changed = true; }
    write += VERTEX_COMPONENTS;
  }

  return changed;
};

export const createDynamicPolygonStrokePrimitive = (
  instance: SceneObjectInstance,
  options: DynamicPolygonStrokePrimitiveOptions
): DynamicPrimitive => {
  // Check if vertices are static (not animated)
  const isStaticVertices = !options.getVertices && !!options.vertices;
  const hasRefreshStroke = typeof options.refreshStroke === "function";
  
  const resolveVerts = (target: SceneObjectInstance): PolygonVertices => {
    if (typeof options.getVertices === "function") {
      return ensureVertices(options.getVertices(target));
    }
    if (options.vertices) {
      return ensureVertices(options.vertices);
    }
    const data = target.data.customData as { vertices?: SceneVector2[] } | undefined;
    return ensureVertices(data?.vertices);
  };
  const getCenter = (target: SceneObjectInstance): SceneVector2 =>
    transformObjectPoint(target.data.position, target.data.rotation, options.offset);

  let inner = resolveVerts(instance);
  let geometry = computeGeometry(inner);
  let origin = getCenter(instance);
  let rotation = instance.data.rotation ?? 0;
  
  // Track stroke reference for refreshStroke
  let cachedStroke: SceneStroke = options.stroke;
  let prevInstanceStrokeRef: SceneStroke | undefined = hasRefreshStroke ? instance.data.stroke : undefined;
  
  let strokeFill = createStrokeFill(cachedStroke);
  let fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
  const fillScratch = new Float32Array(FILL_COMPONENTS);
  let fillComponents = writeFillVertexComponents(fillScratch, {
    fill: strokeFill,
    center: fillCenter,
    rotation,
    size: geometry.size,
  });
  let outer = expandVertices(inner, geometry.centerOffset, cachedStroke.width);
  let data = buildStrokeBandData(origin, rotation, inner, outer, fillComponents);
  
  // Cache previous state for static vertices to skip updates when nothing changed
  let prevPosX = instance.data.position.x;
  let prevPosY = instance.data.position.y;
  let prevRotation = rotation;

  const primitive: DynamicPrimitive = {
    get data() {
      return data;
    },
    update(target: SceneObjectInstance) {
      const pos = target.data.position;
      const nextRotation = target.data.rotation ?? 0;
      
      // Check if stroke reference changed (visual effect applied)
      let strokeRefChanged = false;
      if (hasRefreshStroke && target.data.stroke !== prevInstanceStrokeRef) {
        prevInstanceStrokeRef = target.data.stroke;
        cachedStroke = options.refreshStroke!(target);
        strokeFill = createStrokeFill(cachedStroke);
        strokeRefChanged = true;
      }
      
      // Fast path: skip update if position/rotation unchanged, vertices are static, and stroke didn't change
      if (isStaticVertices &&
          !strokeRefChanged &&
          pos.x === prevPosX &&
          pos.y === prevPosY &&
          nextRotation === prevRotation) {
        return null;
      }
      
      origin = getCenter(target);
      rotation = nextRotation;
      prevPosX = pos.x;
      prevPosY = pos.y;
      prevRotation = rotation;
      
      // Skip expensive geometry/vertices work for static vertices
      if (!isStaticVertices) {
        inner = resolveVerts(target);
        computeGeometry(inner, geometry);
        outer = expandVertices(inner, geometry.centerOffset, cachedStroke.width, outer);
      }
      
      // Always update fill components if stroke changed, or for non-solid fills
      const isSolidFill = strokeFill.fillType === 0;
      if (strokeRefChanged || !isSolidFill) {
        fillCenter = transformObjectPoint(origin, rotation, geometry.centerOffset);
        fillComponents = writeFillVertexComponents(fillScratch, {
          fill: strokeFill,
          center: fillCenter,
          rotation,
          size: geometry.size,
        });
      }
      
      // Check if buffer size changed (e.g., vertex count changed)
      const n = Math.min(inner.length, outer.length);
      const expectedSize = n * 2 * 3 * VERTEX_COMPONENTS;
      if (data.length !== expectedSize) {
        data = buildStrokeBandData(origin, rotation, inner, outer, fillComponents);
        return data;
      }
      
      // For animated vertices or stroke changes, use fast path (no change detection overhead)
      // For static vertices without stroke changes, use change detection to skip GPU upload when possible
      if (!isStaticVertices || strokeRefChanged) {
        updateStrokeBandDataFast(data, origin, rotation, inner, outer, fillComponents);
        return data;
      }
      
      const changed = updateStrokeBandData(data, origin, rotation, inner, outer, fillComponents);
      return changed ? data : null;
    },
    updatePositionOnly(target: SceneObjectInstance) {
      const pos = target.data.position;
      const nextRotation = target.data.rotation ?? 0;
      if (
        pos.x === prevPosX &&
        pos.y === prevPosY &&
        nextRotation === prevRotation
      ) {
        return null;
      }
      origin = getCenter(target);
      rotation = nextRotation;
      prevPosX = pos.x;
      prevPosY = pos.y;
      prevRotation = rotation;

      const n = Math.min(inner.length, outer.length);
      const expectedSize = n * 2 * 3 * VERTEX_COMPONENTS;
      if (data.length !== expectedSize) {
        return null;
      }

      const changed = updateStrokeBandPositionData(
        data,
        origin,
        rotation,
        inner,
        outer
      );
      return changed ? data : null;
    },
  };

  return primitive;
};

export const createStaticPolygonStrokePrimitive = (
  options: PolygonStrokeOptions
): StaticPrimitive | null => {
  const { stroke, vertices } = options;
  if (!stroke || stroke.width <= 0) {
    return null;
  }
  const geometry = computeGeometry(vertices);
  const expanded = expandVertices(vertices, geometry.centerOffset, stroke.width);
  return createStaticPolygonPrimitive({
    center: options.center,
    vertices: expanded,
    fill: createStrokeFill(stroke),
    rotation: options.rotation,
    offset: options.offset,
  });
};
