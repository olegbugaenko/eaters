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
import { spineGpuRenderer, type SpineGpuHandle } from "@ui/renderers/primitives/gpu/spine";
import { getSceneTimelineNow } from "@ui/renderers/primitives/utils/sceneTimeline";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";

export interface SpinePoint {
  x: number;
  y: number;
  width: number;
}

export interface SpineGpuPrimitiveOptions {
  spine: SpinePoint[];
  anim: RendererLayerAnimationConfig;
  fill: SceneFill;
  offset?: SceneVector2;
  buildOpts?: {
    epsilon?: number;
    winding?: "CW" | "CCW";
  };
  refreshFill?: (instance: SceneObjectInstance) => SceneFill;
}

// Extract solid color from fill (fallback to white for gradients)
const extractFillColor = (fill: SceneFill): { r: number; g: number; b: number; a: number } => {
  if (fill.fillType === FILL_TYPES.SOLID) {
    const color = (fill as { color: { r: number; g: number; b: number; a?: number } }).color;
    return {
      r: color.r,
      g: color.g,
      b: color.b,
      a: typeof color.a === "number" ? color.a : 1,
    };
  }
  // For gradients, use first stop color
  const gradientFill = fill as { stops?: Array<{ color: { r: number; g: number; b: number; a?: number } }> };
  if (gradientFill.stops && gradientFill.stops.length > 0) {
    const color = gradientFill.stops[0]!.color;
    return {
      r: color.r,
      g: color.g,
      b: color.b,
      a: typeof color.a === "number" ? color.a : 1,
    };
  }
  return { r: 1, g: 1, b: 1, a: 1 };
};

export const createSpineGpuPrimitive = (
  instance: SceneObjectInstance,
  options: SpineGpuPrimitiveOptions
): DynamicPrimitive | null => {
  if (!options.spine || options.spine.length < 2) {
    return null;
  }

  const spine = options.spine;
  const anim = options.anim;
  const buildOpts = options.buildOpts ?? {};
  const epsilon = typeof buildOpts.epsilon === "number" ? buildOpts.epsilon : 0.2;
  const winding = buildOpts.winding ?? "CCW";

  let cachedFill: SceneFill = options.fill;
  let cachedColor = extractFillColor(cachedFill);
  let prevInstanceFillRef: SceneFill | undefined =
    typeof options.refreshFill === "function" ? instance.data.fill : undefined;

  let gl: WebGL2RenderingContext | null = getAnimationGpuContext();
  let renderHandle: SpineGpuHandle | null = null;
  let needsColorUpload = true;

  const ensureResources = (): boolean => {
    if (!gl) {
      gl = getAnimationGpuContext();
    }
    if (!gl) {
      return false;
    }

    spineGpuRenderer.setContext(gl);
    if (!renderHandle) {
      renderHandle = spineGpuRenderer.acquireHandle({
        spinePoints: spine,
        axis: anim.axis === "tangent" ? "tangent" : "normal",
        falloff: anim.falloff === "root" ? "root" : anim.falloff === "none" ? "none" : "tip",
        epsilon,
        winding,
      });
      if (!renderHandle) {
        return false;
      }
      // Initialize animation params
      renderHandle.anim.periodMs = Math.max(anim.periodMs ?? 1400, 1);
      renderHandle.anim.phase = anim.phase ?? 0;
      renderHandle.anim.amplitude = anim.amplitude ?? 1;
    }
    return true;
  };

  const primitive: DynamicPrimitive = {
    get data() {
      return new Float32Array(0);
    },
    autoAnimate: true,
    update(target: SceneObjectInstance): Float32Array | null {
      if (!ensureResources() || !gl || !renderHandle) {
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
          cachedColor = extractFillColor(cachedFill);
          fillRefChanged = true;
        }
      }

      if (needsColorUpload || fillRefChanged) {
        spineGpuRenderer.updateHandleFill(renderHandle, cachedColor);
        needsColorUpload = false;
      }

      // Update animation params (read by renderer in beforeRender)
      renderHandle.anim.timeMs = getSceneTimelineNow();
      renderHandle.anim.origin.x = origin.x;
      renderHandle.anim.origin.y = origin.y;
      renderHandle.anim.rotation = rotation;

      return null;
    },
    dispose() {
      if (!gl) {
        return;
      }
      if (renderHandle) {
        spineGpuRenderer.releaseHandle(renderHandle);
        renderHandle = null;
      }
    },
  };

  return primitive;
};
