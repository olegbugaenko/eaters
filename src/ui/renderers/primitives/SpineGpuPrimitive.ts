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
  console.log("[SpineGpuPrimitive] createSpineGpuPrimitive called", {
    instanceId: instance.id,
    spineLength: options.spine?.length,
    hasAnim: !!options.anim,
  });
  if (!options.spine || options.spine.length < 2) {
    console.warn("[SpineGpuPrimitive] Invalid spine - too few points");
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
      console.warn("[SpineGpuPrimitive] No GL context available");
      return false;
    }

    spineGpuRenderer.setContext(gl);
    // console.log("[SpineGpuPrimitive] ensure resources:", !!renderHandle);
    // Check if handle exists AND is still registered in renderer
    const handleValid = renderHandle && spineGpuRenderer.isHandleValid(renderHandle);
    if (!handleValid) {
      renderHandle = null; // Clear stale handle
      console.log("[SpineGpuPrimitive] Acquiring handle for spine with", spine.length, "points");
      renderHandle = spineGpuRenderer.acquireHandle({
        spinePoints: spine,
        axis: anim.axis === "tangent" ? "tangent" : "normal",
        falloff: anim.falloff === "root" ? "root" : anim.falloff === "none" ? "none" : "tip",
        epsilon,
        winding,
      });
      if (!renderHandle) {
        console.error("[SpineGpuPrimitive] Failed to acquire render handle");
        return false;
      }
      console.log("[SpineGpuPrimitive] Got handle slot", renderHandle.slotIndex);
      // Initialize animation params
      renderHandle.anim.periodMs = Math.max(anim.periodMs ?? 1400, 1);
      renderHandle.anim.phase = anim.phase ?? 0;
      renderHandle.anim.amplitude = anim.amplitude ?? 1;
    } else {
      // console.log("[SpineGpuPrimitive] Reusing existing handle slot", renderHandle?.slotIndex);
    }
    return true;
  };

  const primitive: DynamicPrimitive = {
    get data() {
      return new Float32Array(0);
    },
    autoAnimate: true,
    update(target: SceneObjectInstance): Float32Array | null {
      const resourcesOk = ensureResources();
      if (!resourcesOk || !gl || !renderHandle) {
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
