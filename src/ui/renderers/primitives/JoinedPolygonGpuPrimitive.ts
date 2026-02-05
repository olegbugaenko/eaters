import type {
  SceneFill,
  SceneObjectInstance,
  SceneStroke,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  DynamicPrimitive,
  getInstanceRenderPosition,
  FILL_COMPONENTS,
} from "@ui/renderers/objects/ObjectRenderer";
import { writeFillVertexComponents, buildFillBufferData, buildPackedVertices } from "@ui/renderers/primitives/utils/fill";
import { computePolygonGeometry } from "@ui/renderers/primitives/basic/PolygonPrimitive";
import { joinedPolygonGpuRenderer, type JoinedPolygonGpuHandle } from "@ui/renderers/primitives/gpu/joined/JoinedPolygonGpuRenderer";
import { getAnimationGpuContext } from "@ui/renderers/objects/shared/animation-gpu";
import { createSpriteFill } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.helpers";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { GpuPrimitiveBase } from "@ui/renderers/primitives/GpuPrimitiveBase";

const createStrokeFill = (stroke: SceneStroke): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: stroke.color.r,
    g: stroke.color.g,
    b: stroke.color.b,
    a: typeof stroke.color.a === "number" ? stroke.color.a : 1,
  },
});

const buildCircleFanVertices = (radius: number, segments: number): SceneVector2[] => {
  const normalized = Math.max(3, Math.floor(segments));
  const verts: SceneVector2[] = [{ x: 0, y: 0 }];
  for (let i = 0; i <= normalized; i += 1) {
    const angle = (i / normalized) * Math.PI * 2;
    verts.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return verts;
};

const buildStrokeBandVertices = (
  inner: SceneVector2[],
  outer: SceneVector2[]
): SceneVector2[] => {
  const n = Math.min(inner.length, outer.length);
  if (n < 3) {
    return [];
  }
  const verts: SceneVector2[] = [];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const outerI = outer[i]!;
    const outerJ = outer[j]!;
    const innerI = inner[i]!;
    const innerJ = inner[j]!;
    verts.push(outerI, outerJ, innerI, innerI, outerJ, innerJ);
  }
  return verts;
};

const buildSpriteQuadVertices = (width: number, height: number): SceneVector2[] => {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  return [
    { x: -halfWidth, y: halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: -halfWidth, y: -halfHeight },
  ];
};

type JoinedPrimitiveBuffers = {
  packedVertices: Float32Array;
  vertexCount: number;
  anchorIndex: number;
  joinOffset: SceneVector2;
  drawMode?: "triangles" | "triangle-fan";
  positionUsage: "static" | "dynamic";
  fillUsage: "static" | "dynamic";
};

abstract class JoinedPolygonPrimitiveBase extends GpuPrimitiveBase {
  protected fillScratch = new Float32Array(FILL_COMPONENTS);
  protected fillData: Float32Array | null = null;
  protected positionBuffer: WebGLBuffer | null = null;
  protected fillBuffer: WebGLBuffer | null = null;
  protected renderHandle: JoinedPolygonGpuHandle | null = null;

  protected constructor(protected bufferConfig: JoinedPrimitiveBuffers) {
    super(getAnimationGpuContext);
  }

  protected override createResources(gl: WebGL2RenderingContext): boolean {
    if (!this.positionBuffer) {
      const positionUsage =
        this.bufferConfig.positionUsage === "dynamic" ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
      const packedVertices = this.bufferConfig.packedVertices as unknown as BufferSource;
      this.positionBuffer = this.createBuffer(
        gl,
        gl.ARRAY_BUFFER,
        packedVertices,
        positionUsage
      );
      if (!this.positionBuffer) {
        return false;
      }
    }
    if (!this.fillBuffer) {
      const fillUsage =
        this.bufferConfig.fillUsage === "dynamic" ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
      this.fillBuffer = this.createBuffer(
        gl,
        gl.ARRAY_BUFFER,
        this.bufferConfig.vertexCount * FILL_COMPONENTS * Float32Array.BYTES_PER_ELEMENT,
        fillUsage
      );
      if (!this.fillBuffer) {
        return false;
      }
    }
    joinedPolygonGpuRenderer.setContext(gl);
    if (!this.renderHandle) {
      const drawMode =
        this.bufferConfig.drawMode === "triangles"
          ? gl.TRIANGLES
          : this.bufferConfig.drawMode === "triangle-fan"
          ? gl.TRIANGLE_FAN
          : undefined;
      this.renderHandle = joinedPolygonGpuRenderer.acquire({
        positionBuffer: this.positionBuffer,
        fillBuffer: this.fillBuffer,
        vertexCount: this.bufferConfig.vertexCount,
        anchorIndex: this.bufferConfig.anchorIndex,
        joinOffset: this.bufferConfig.joinOffset,
        drawMode,
      });
      if (!this.renderHandle) {
        return false;
      }
    }
    return true;
  }

  protected override releaseResources(_gl: WebGL2RenderingContext): void {
    if (this.renderHandle) {
      joinedPolygonGpuRenderer.release(this.renderHandle);
      this.renderHandle = null;
    }
    this.positionBuffer = null;
    this.fillBuffer = null;
    this.fillData = null;
  }

  protected uploadFillData(fillComponents: Float32Array, vertexCount: number): void {
    if (!this.gl || !this.fillBuffer) {
      return;
    }
    this.fillData = buildFillBufferData(vertexCount, fillComponents, this.fillData ?? undefined);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.fillBuffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.fillData);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  protected updateTransform(target: SceneObjectInstance): void {
    if (!this.renderHandle) {
      return;
    }
    const pos = getInstanceRenderPosition(target);
    this.renderHandle.instancePosition.x = pos.x;
    this.renderHandle.instancePosition.y = pos.y;
    this.renderHandle.instanceRotation = target.data.rotation ?? 0;
  }

  protected updatePositionBuffer(packed: Float32Array): void {
    if (!this.gl || !this.positionBuffer) {
      return;
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, packed);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  protected updateVertexCount(vertexCount: number): void {
    this.bufferConfig.vertexCount = vertexCount;
    if (this.renderHandle) {
      joinedPolygonGpuRenderer.update(this.renderHandle, vertexCount);
    }
  }
}

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

  class JoinedPolygonPrimitive extends JoinedPolygonPrimitiveBase {
    private cachedFill: SceneFill = options.fill;
    private prevInstanceFillRef: SceneFill | undefined =
      typeof options.refreshFill === "function" ? instance.data.fill : undefined;

    public constructor() {
      super({
        packedVertices,
        vertexCount,
        anchorIndex: options.anchorIndex,
        joinOffset: options.joinOffset ?? { x: 0, y: 0 },
        positionUsage: "static",
        fillUsage: "dynamic",
      });
    }

    protected override updateBuffers(target: SceneObjectInstance): void {
      if (!this.gl) {
        return;
      }

      // Check dirty flags for fill/color changes
      let fillRefChanged = false;
      if (typeof options.refreshFill === "function") {
        if (target.data.fill !== this.prevInstanceFillRef) {
          this.prevInstanceFillRef = target.data.fill;
          this.cachedFill = options.refreshFill(target);
          fillRefChanged = true;
        }
      }

      if (fillRefChanged || !this.fillData) {
        const fillComponents = writeFillVertexComponents(this.fillScratch, {
          fill: this.cachedFill,
          center: geometry.centerOffset,
          rotation: 0,
          size: geometry.size,
        });
        this.uploadFillData(fillComponents, vertexCount);
      }

      this.updateTransform(target);
    }
  }

  return new JoinedPolygonPrimitive();
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

  class JoinedCirclePrimitive extends JoinedPolygonPrimitiveBase {
    private cachedFill: SceneFill = options.fill;
    private prevInstanceFillRef: SceneFill | undefined =
      typeof options.refreshFill === "function" ? instance.data.fill : undefined;

    public constructor() {
      super({
        packedVertices,
        vertexCount,
        anchorIndex: options.anchorIndex,
        joinOffset: options.joinOffset ?? { x: 0, y: 0 },
        positionUsage: "static",
        fillUsage: "dynamic",
      });
    }

    protected override updateBuffers(target: SceneObjectInstance): void {
      if (!this.gl) {
        return;
      }

      // Check dirty flags for fill/color changes
      let fillRefChanged = false;
      if (typeof options.refreshFill === "function") {
        if (target.data.fill !== this.prevInstanceFillRef) {
          this.prevInstanceFillRef = target.data.fill;
          this.cachedFill = options.refreshFill(target);
          fillRefChanged = true;
        }
      }

      if (fillRefChanged || !this.fillData) {
        const fillComponents = writeFillVertexComponents(this.fillScratch, {
          fill: this.cachedFill,
          center: centerOffset,
          rotation: 0,
          size,
          radius: options.radius,
        });
        this.uploadFillData(fillComponents, vertexCount);
      }

      this.updateTransform(target);
    }
  }

  return new JoinedCirclePrimitive();
};

export const createJoinedPolygonStrokeGpuPrimitive = (
  instance: SceneObjectInstance,
  options: {
    vertices: SceneVector2[];
    stroke: SceneStroke;
    refreshStroke?: (instance: SceneObjectInstance) => SceneStroke;
  } & JoinedGpuPrimitiveOptions
): DynamicPrimitive | null => {
  if (!options.vertices || options.vertices.length < 3) {
    return null;
  }
  const geometry = computePolygonGeometry(options.vertices);
  const inner = options.vertices;
  let outer = inner.map((vertex) => {
    const dirX = vertex.x - geometry.centerOffset.x;
    const dirY = vertex.y - geometry.centerOffset.y;
    const length = Math.hypot(dirX, dirY) || 1;
    const scale = (length + options.stroke.width) / length;
    return {
      x: geometry.centerOffset.x + dirX * scale,
      y: geometry.centerOffset.y + dirY * scale,
    };
  });
  let vertices = buildStrokeBandVertices(inner, outer);
  if (vertices.length === 0) {
    return null;
  }
  let packedVertices = buildPackedVertices(vertices);

  class JoinedPolygonStrokePrimitive extends JoinedPolygonPrimitiveBase {
    private cachedStroke: SceneStroke = options.stroke;
    private prevInstanceStrokeRef: SceneStroke | undefined =
      typeof options.refreshStroke === "function" ? instance.data.stroke : undefined;

    public constructor() {
      super({
        packedVertices,
        vertexCount: vertices.length,
        anchorIndex: options.anchorIndex,
        joinOffset: options.joinOffset ?? { x: 0, y: 0 },
        drawMode: "triangles",
        positionUsage: "dynamic",
        fillUsage: "dynamic",
      });
    }

    protected override updateBuffers(target: SceneObjectInstance): void {
      if (!this.gl) {
        return;
      }

      // Check dirty flags for stroke changes
      let strokeColorChanged = false;
      if (typeof options.refreshStroke === "function") {
        if (target.data.stroke !== this.prevInstanceStrokeRef) {
          this.prevInstanceStrokeRef = target.data.stroke;
          const nextStroke = options.refreshStroke(target);
          if (nextStroke.width !== this.cachedStroke.width) {
            outer = inner.map((vertex) => {
              const dirX = vertex.x - geometry.centerOffset.x;
              const dirY = vertex.y - geometry.centerOffset.y;
              const length = Math.hypot(dirX, dirY) || 1;
              const scale = (length + nextStroke.width) / length;
              return {
                x: geometry.centerOffset.x + dirX * scale,
                y: geometry.centerOffset.y + dirY * scale,
              };
            });
            vertices = buildStrokeBandVertices(inner, outer);
            packedVertices = buildPackedVertices(vertices);
            this.updatePositionBuffer(packedVertices);
            this.updateVertexCount(vertices.length);
          }
          const prevColor = this.cachedStroke.color;
          const nextColor = nextStroke.color;
          if (
            prevColor.r !== nextColor.r ||
            prevColor.g !== nextColor.g ||
            prevColor.b !== nextColor.b ||
            prevColor.a !== nextColor.a
          ) {
            strokeColorChanged = true;
          }
          this.cachedStroke = nextStroke;
        }
      }

      if (strokeColorChanged || !this.fillData) {
        const fillComponents = writeFillVertexComponents(this.fillScratch, {
          fill: createStrokeFill(this.cachedStroke),
          center: geometry.centerOffset,
          rotation: 0,
          size: geometry.size,
        });
        this.uploadFillData(fillComponents, vertices.length);
      }

      this.updateTransform(target);
    }
  }

  return new JoinedPolygonStrokePrimitive();
};

export const createJoinedCircleStrokeGpuPrimitive = (
  instance: SceneObjectInstance,
  options: {
    radius: number;
    segments?: number;
    stroke: SceneStroke;
    refreshStroke?: (instance: SceneObjectInstance) => SceneStroke;
  } & JoinedGpuPrimitiveOptions
): DynamicPrimitive | null => {
  const buildVertices = (radius: number) =>
    buildCircleFanVertices(radius, options.segments ?? 24);
  let cachedStroke: SceneStroke = options.stroke;
  let vertices = buildVertices(options.radius + cachedStroke.width);
  let packedVertices = buildPackedVertices(vertices);

  class JoinedCircleStrokePrimitive extends JoinedPolygonPrimitiveBase {
    private cachedStroke: SceneStroke = options.stroke;
    private prevInstanceStrokeRef: SceneStroke | undefined =
      typeof options.refreshStroke === "function" ? instance.data.stroke : undefined;

    public constructor() {
      super({
        packedVertices,
        vertexCount: vertices.length,
        anchorIndex: options.anchorIndex,
        joinOffset: options.joinOffset ?? { x: 0, y: 0 },
        positionUsage: "dynamic",
        fillUsage: "dynamic",
      });
    }

    protected override updateBuffers(target: SceneObjectInstance): void {
      if (!this.gl) {
        return;
      }
      // Check dirty flags for stroke changes
      let strokeColorChanged = false;
      if (typeof options.refreshStroke === "function") {
        if (target.data.stroke !== this.prevInstanceStrokeRef) {
          this.prevInstanceStrokeRef = target.data.stroke;
          const nextStroke = options.refreshStroke(target);
          if (nextStroke.width !== this.cachedStroke.width) {
            vertices = buildVertices(options.radius + nextStroke.width);
            packedVertices = buildPackedVertices(vertices);
            this.updatePositionBuffer(packedVertices);
            this.updateVertexCount(vertices.length);
          }
          const prevColor = this.cachedStroke.color;
          const nextColor = nextStroke.color;
          if (
            prevColor.r !== nextColor.r ||
            prevColor.g !== nextColor.g ||
            prevColor.b !== nextColor.b ||
            prevColor.a !== nextColor.a
          ) {
            strokeColorChanged = true;
          }
          this.cachedStroke = nextStroke;
        }
      }
      if (strokeColorChanged || !this.fillData) {
        const fillComponents = writeFillVertexComponents(this.fillScratch, {
          fill: createStrokeFill(this.cachedStroke),
          center: { x: 0, y: 0 },
          rotation: 0,
          size: { width: options.radius * 2, height: options.radius * 2 },
        });
        this.uploadFillData(fillComponents, vertices.length);
      }
      this.updateTransform(target);
    }
  }

  return new JoinedCircleStrokePrimitive();
};

export const createJoinedSpriteGpuPrimitive = (
  instance: SceneObjectInstance,
  options: {
    spritePath: string;
    width: number;
    height: number;
  } & JoinedGpuPrimitiveOptions
): DynamicPrimitive | null => {
  if (!options.spritePath || options.width <= 0 || options.height <= 0) {
    return null;
  }
  const vertices = buildSpriteQuadVertices(options.width, options.height);
  const vertexCount = vertices.length;
  const packedVertices = buildPackedVertices(vertices);
  const geometry = computePolygonGeometry(vertices);

  const spriteFill = createSpriteFill(options.spritePath);

  class JoinedSpritePrimitive extends JoinedPolygonPrimitiveBase {
    public constructor() {
      super({
        packedVertices,
        vertexCount,
        anchorIndex: options.anchorIndex,
        joinOffset: options.joinOffset ?? { x: 0, y: 0 },
        positionUsage: "static",
        fillUsage: "dynamic",
      });
    }

    protected override updateBuffers(target: SceneObjectInstance): void {
      if (!this.gl) {
        return;
      }
      if (!this.fillData) {
        const fillComponents = writeFillVertexComponents(this.fillScratch, {
          fill: spriteFill,
          center: geometry.centerOffset,
          rotation: 0,
          size: geometry.size,
        });
        this.uploadFillData(fillComponents, vertexCount);
      }

      this.updateTransform(target);
    }
  }

  return new JoinedSpritePrimitive();
};
