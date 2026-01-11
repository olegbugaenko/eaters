import {
  SceneObjectInstance,
  SceneVector2,
  SceneSize,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { textureResourceManager } from "@ui/renderers/textures/TextureResourceManager";
import {
  DynamicPrimitive,
  StaticPrimitive,
  VERTEX_COMPONENTS,
  POSITION_COMPONENTS,
  FILL_INFO_COMPONENTS,
  FILL_COMPONENTS,
  CRACK_MASK_COMPONENTS,
  CRACK_EFFECTS_COMPONENTS,
  CRACK_UV_COMPONENTS,
} from "../../objects/ObjectRenderer";
import { createSpriteFill } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.helpers";
import {
  createFillVertexComponents,
  copyFillComponents,
} from "../utils/fill";
import { transformObjectPoint } from "../../objects/ObjectRenderer";

export const clearSpriteTextureCache = (): void => {
  textureResourceManager.clearCache(true);
};

/**
 * Get texture index for a sprite path (for use in shaders)
 */
export const getTextureIndex = (spritePath: string): number => {
  return textureResourceManager.getTextureIndex(spritePath);
};

/**
 * Loads a texture from an image path
 * This should be called from WebGLSceneRenderer or similar, not from primitive creation
 */
export const loadSpriteTexture = (
  gl: WebGL2RenderingContext,
  imagePath: string
): Promise<{ texture: WebGLTexture; width: number; height: number }> => {
  return textureResourceManager.loadTexture(gl, imagePath);
};

interface SpritePrimitiveOptions {
  spritePath: string;
  width: number;
  height: number;
  offset?: SceneVector2;
}

interface DynamicSpriteOptions {
  spritePath: string;
  getWidth?: (instance: SceneObjectInstance) => number | undefined;
  getHeight?: (instance: SceneObjectInstance) => number | undefined;
  offset?: SceneVector2;
}

/**
 * Creates a static sprite primitive with texture support
 * Automatically starts loading the texture asynchronously
 */
export const createStaticSpritePrimitive = (
  options: SpritePrimitiveOptions
): StaticPrimitive => {
  const { width, height, offset } = options;
  const spriteFill = createSpriteFill(options.spritePath);

  // Start loading texture asynchronously (don't wait for it)
  if (typeof window !== "undefined") {
    // Get GL context from the global particle emitter context
    // This is set during WebGL initialization
    import("../utils/gpuContext").then(({ getParticleEmitterGlContext }) => {
      const gl = getParticleEmitterGlContext();
      if (gl) {
        loadSpriteTexture(gl, options.spritePath).catch((err) => {
          console.warn(`[SpritePrimitive] Failed to load texture: ${options.spritePath}`, err);
        });
      }
    });
  }

  const center = transformObjectPoint({ x: 0, y: 0 }, 0, offset);
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const fillComponents = createFillVertexComponents({
    fill: spriteFill,
    center,
    rotation: 0,
    size: { width, height },
  });

  const bottomLeft = { x: center.x - halfWidth, y: center.y + halfHeight };
  const bottomRight = { x: center.x + halfWidth, y: center.y + halfHeight };
  const topLeft = { x: center.x - halfWidth, y: center.y - halfHeight };
  const topRight = { x: center.x + halfWidth, y: center.y - halfHeight };

  const VERTEX_COUNT = 6;
  const data = new Float32Array(VERTEX_COUNT * VERTEX_COMPONENTS);
  const textureIndex = getTextureIndex(options.spritePath);
  let writeOffset = 0;

  // Triangle 1: bottom-left, bottom-right, top-left
  writeOffset = pushSpriteVertex(data, writeOffset, bottomLeft.x, bottomLeft.y, 0, 1, textureIndex, fillComponents);
  writeOffset = pushSpriteVertex(data, writeOffset, bottomRight.x, bottomRight.y, 1, 1, textureIndex, fillComponents);
  writeOffset = pushSpriteVertex(data, writeOffset, topLeft.x, topLeft.y, 0, 0, textureIndex, fillComponents);

  // Triangle 2: top-left, bottom-right, top-right
  writeOffset = pushSpriteVertex(data, writeOffset, topLeft.x, topLeft.y, 0, 0, textureIndex, fillComponents);
  writeOffset = pushSpriteVertex(data, writeOffset, bottomRight.x, bottomRight.y, 1, 1, textureIndex, fillComponents);
  pushSpriteVertex(data, writeOffset, topRight.x, topRight.y, 1, 0, textureIndex, fillComponents);

  return { data };
};

/**
 * Helper to push vertex with UV coordinates and texture index for sprites
 */
const pushSpriteVertex = (
  target: Float32Array,
  offset: number,
  x: number,
  y: number,
  u: number,
  v: number,
  textureIndex: number,
  fillComponents: Float32Array
): number => {
  target[offset + 0] = x;
  target[offset + 1] = y;
  // Copy fill components, but override fillParams0.xy with UV coordinates and fillParams0.z with texture index
  copyFillComponents(target, offset, fillComponents);
  // Override UV coordinates and texture index in fillParams0 (offset + POSITION_COMPONENTS + FILL_INFO_COMPONENTS)
  const fillParams0Offset = offset + POSITION_COMPONENTS + FILL_INFO_COMPONENTS;
  target[fillParams0Offset + 0] = u;
  target[fillParams0Offset + 1] = v;
  target[fillParams0Offset + 2] = textureIndex;
  const crackUvOffset =
    offset +
    POSITION_COMPONENTS +
    FILL_COMPONENTS -
    CRACK_EFFECTS_COMPONENTS -
    CRACK_MASK_COMPONENTS -
    CRACK_UV_COMPONENTS;
  target[crackUvOffset + 0] = u;
  target[crackUvOffset + 1] = v;
  return offset + VERTEX_COMPONENTS;
};

const updateSpritePositions = (
  target: Float32Array,
  center: SceneVector2,
  width: number,
  height: number,
  rotation: number
): boolean => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const cx = center.x;
  const cy = center.y;

  const blX = cx + -halfWidth * cos - halfHeight * sin;
  const blY = cy + -halfWidth * sin + halfHeight * cos;
  const brX = cx + halfWidth * cos - halfHeight * sin;
  const brY = cy + halfWidth * sin + halfHeight * cos;
  const tlX = cx + -halfWidth * cos - -halfHeight * sin;
  const tlY = cy + -halfWidth * sin + -halfHeight * cos;
  const trX = cx + halfWidth * cos - -halfHeight * sin;
  const trY = cy + halfWidth * sin + -halfHeight * cos;

  let changed = false;
  const writePosition = (offset: number, x: number, y: number): void => {
    if (target[offset] !== x) {
      target[offset] = x;
      changed = true;
    }
    if (target[offset + 1] !== y) {
      target[offset + 1] = y;
      changed = true;
    }
  };

  writePosition(0, blX, blY);
  writePosition(VERTEX_COMPONENTS, brX, brY);
  writePosition(VERTEX_COMPONENTS * 2, tlX, tlY);
  writePosition(VERTEX_COMPONENTS * 3, tlX, tlY);
  writePosition(VERTEX_COMPONENTS * 4, brX, brY);
  writePosition(VERTEX_COMPONENTS * 5, trX, trY);

  return changed;
};

/**
 * Creates a dynamic sprite primitive with texture support
 * Automatically starts loading the texture asynchronously
 */
export const createDynamicSpritePrimitive = (
  instance: SceneObjectInstance,
  options: DynamicSpriteOptions
): DynamicPrimitive => {
  const width = options.getWidth?.(instance) ?? 32;
  const height = options.getHeight?.(instance) ?? 32;
  const spriteFill = createSpriteFill(options.spritePath);

  // Start loading texture asynchronously (don't wait for it)
  if (typeof window !== "undefined") {
    // Get GL context from the global particle emitter context
    // This is set during WebGL initialization
    import("../utils/gpuContext").then(({ getParticleEmitterGlContext }) => {
      const gl = getParticleEmitterGlContext();
      if (gl) {
        loadSpriteTexture(gl, options.spritePath).catch((err) => {
          console.warn(`[SpritePrimitive] Failed to load texture: ${options.spritePath}`, err);
        });
      }
    });
  }

  const rotation = instance.data.rotation ?? 0;
  const center = transformObjectPoint(instance.data.position, rotation, options.offset);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  // Create fill components with sprite fill type
  const fillComponents = createFillVertexComponents({
    fill: spriteFill,
    center,
    rotation,
    size: { width, height },
  });

  // Transform corners
  const transformCorner = (x: number, y: number): SceneVector2 => ({
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos,
  });

  const bottomLeft = transformCorner(-halfWidth, halfHeight);
  const bottomRight = transformCorner(halfWidth, halfHeight);
  const topLeft = transformCorner(-halfWidth, -halfHeight);
  const topRight = transformCorner(halfWidth, -halfHeight);

  // UV coordinates: (0,1) bottom-left, (1,1) bottom-right, (0,0) top-left, (1,0) top-right
  const VERTEX_COUNT = 6;
  const data = new Float32Array(VERTEX_COUNT * VERTEX_COMPONENTS);
  const textureIndex = getTextureIndex(options.spritePath);
  let writeOffset = 0;

  // Triangle 1: bottom-left, bottom-right, top-left
  writeOffset = pushSpriteVertex(data, writeOffset, bottomLeft.x, bottomLeft.y, 0, 1, textureIndex, fillComponents);
  writeOffset = pushSpriteVertex(data, writeOffset, bottomRight.x, bottomRight.y, 1, 1, textureIndex, fillComponents);
  writeOffset = pushSpriteVertex(data, writeOffset, topLeft.x, topLeft.y, 0, 0, textureIndex, fillComponents);

  // Triangle 2: top-left, bottom-right, top-right
  writeOffset = pushSpriteVertex(data, writeOffset, topLeft.x, topLeft.y, 0, 0, textureIndex, fillComponents);
  writeOffset = pushSpriteVertex(data, writeOffset, bottomRight.x, bottomRight.y, 1, 1, textureIndex, fillComponents);
  pushSpriteVertex(data, writeOffset, topRight.x, topRight.y, 1, 0, textureIndex, fillComponents);

  // Track state for updates
  let prevCenterX = center.x;
  let prevCenterY = center.y;
  let prevWidth = width;
  let prevHeight = height;
  let prevRotation = rotation;

  return {
    data,
    update(target: SceneObjectInstance) {
      const nextRotation = target.data.rotation ?? 0;
      const nextCenter = transformObjectPoint(target.data.position, nextRotation, options.offset);
      const nextWidth = options.getWidth?.(target) ?? 32;
      const nextHeight = options.getHeight?.(target) ?? 32;

      // Check if geometry changed
      if (
        nextCenter.x !== prevCenterX ||
        nextCenter.y !== prevCenterY ||
        nextWidth !== prevWidth ||
        nextHeight !== prevHeight ||
        nextRotation !== prevRotation
      ) {
        prevCenterX = nextCenter.x;
        prevCenterY = nextCenter.y;
        prevWidth = nextWidth;
        prevHeight = nextHeight;
        prevRotation = nextRotation;

        const halfW = nextWidth / 2;
        const halfH = nextHeight / 2;
        const c = Math.cos(nextRotation);
        const s = Math.sin(nextRotation);
        const cx = nextCenter.x;
        const cy = nextCenter.y;

        const transformCorner = (x: number, y: number): { x: number; y: number } => ({
          x: cx + x * c - y * s,
          y: cy + x * s + y * c,
        });

        const bl = transformCorner(-halfW, halfH);
        const br = transformCorner(halfW, halfH);
        const tl = transformCorner(-halfW, -halfH);
        const tr = transformCorner(halfW, -halfH);

        // Update vertices with new positions and UV
        let offset = 0;
        offset = pushSpriteVertex(data, offset, bl.x, bl.y, 0, 1, textureIndex, fillComponents);
        offset = pushSpriteVertex(data, offset, br.x, br.y, 1, 1, textureIndex, fillComponents);
        offset = pushSpriteVertex(data, offset, tl.x, tl.y, 0, 0, textureIndex, fillComponents);
        offset = pushSpriteVertex(data, offset, tl.x, tl.y, 0, 0, textureIndex, fillComponents);
        offset = pushSpriteVertex(data, offset, br.x, br.y, 1, 1, textureIndex, fillComponents);
        pushSpriteVertex(data, offset, tr.x, tr.y, 1, 0, textureIndex, fillComponents);

        return data;
      }
      return null;
    },
    updatePositionOnly(target: SceneObjectInstance) {
      const nextRotation = target.data.rotation ?? 0;
      const nextCenter = transformObjectPoint(target.data.position, nextRotation, options.offset);

      if (
        nextCenter.x === prevCenterX &&
        nextCenter.y === prevCenterY &&
        nextRotation === prevRotation
      ) {
        return null;
      }

      prevCenterX = nextCenter.x;
      prevCenterY = nextCenter.y;
      prevRotation = nextRotation;

      const changed = updateSpritePositions(
        data,
        nextCenter,
        prevWidth,
        prevHeight,
        nextRotation
      );
      return changed ? data : null;
    },
  };
};
