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
import { GpuPrimitiveBase } from "@ui/renderers/primitives/GpuPrimitiveBase";

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

  class SpineGpuPrimitive extends GpuPrimitiveBase {
    private cachedFill: SceneFill = options.fill;
    private cachedColor = extractFillColor(this.cachedFill);
    private prevInstanceFillRef: SceneFill | undefined =
      typeof options.refreshFill === "function" ? instance.data.fill : undefined;
    private renderHandle: SpineGpuHandle | null = null;
    private needsColorUpload = true;

    protected override areResourcesValid(): boolean {
      return !!(this.renderHandle && spineGpuRenderer.isHandleValid(this.renderHandle));
    }

    protected override createResources(gl: WebGL2RenderingContext): boolean {
      spineGpuRenderer.setContext(gl);
      this.renderHandle = spineGpuRenderer.acquire({
        spinePoints: spine,
        axis: anim.axis === "tangent" ? "tangent" : "normal",
        falloff: anim.falloff === "root" ? "root" : anim.falloff === "none" ? "none" : "tip",
        epsilon,
        winding,
      });
      if (!this.renderHandle) {
        return false;
      }
      this.renderHandle.anim.periodMs = Math.max(anim.periodMs ?? 1400, 1);
      this.renderHandle.anim.phase = anim.phase ?? 0;
      this.renderHandle.anim.amplitude = anim.amplitude ?? 1;
      this.needsColorUpload = true;
      return true;
    }

    protected override updateBuffers(target: SceneObjectInstance): void {
      if (!this.gl || !this.renderHandle) {
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
          this.cachedColor = extractFillColor(this.cachedFill);
          fillRefChanged = true;
        }
      }

      if (this.needsColorUpload || fillRefChanged) {
        spineGpuRenderer.update(this.renderHandle, this.cachedColor);
        this.needsColorUpload = false;
      }

      this.renderHandle.anim.timeMs = getSceneTimelineNow();
      this.renderHandle.anim.origin.x = origin.x;
      this.renderHandle.anim.origin.y = origin.y;
      this.renderHandle.anim.rotation = rotation;
    }

    protected override releaseResources(_gl: WebGL2RenderingContext): void {
      if (this.renderHandle) {
        spineGpuRenderer.release(this.renderHandle);
        this.renderHandle = null;
      }
    }
  }

  return new SpineGpuPrimitive(getAnimationGpuContext);
};
