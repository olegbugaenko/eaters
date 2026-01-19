import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { createRadialGradientFill } from "@shared/helpers/scene-fill.helper";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { getMapEffectConfig } from "../../../../db/map-effects-db";
import type { MapEffectsModule } from "../map-effects/map-effects.module";

const CAMERA_FOCUS_TICKS = 6;
const RADIOACTIVITY_OVERLAY_ID = "map-radioactivity-overlay";

export class MapVisualEffects {
  private portalObjects: { id: string; position: SceneVector2 }[] = [];
  private pendingCameraFocus: { point: SceneVector2; ticksRemaining: number } | null = null;
  private radioactivityOverlayId: string | null = null;
  private radioactivityElapsedMs = 0;

  constructor(
    private readonly scene: SceneObjectManager,
    private readonly mapEffects: MapEffectsModule
  ) {}

  public reset(): void {
    this.clearPortalObjects();
    this.pendingCameraFocus = null;
    this.clearRadioactivityOverlay();
  }

  public setCameraFocus(point: SceneVector2): void {
    const focusPoint = { x: point.x, y: point.y };
    this.focusCameraOnPoint(focusPoint);
    this.pendingCameraFocus = {
      point: focusPoint,
      ticksRemaining: CAMERA_FOCUS_TICKS,
    };
  }

  public clearPendingFocus(): void {
    this.pendingCameraFocus = null;
  }

  public spawnPortals(spawnPoints: SceneVector2[]): void {
    if (this.portalObjects.length > 0) {
      this.clearPortalObjects();
    }

    spawnPoints.forEach((point) => {
      const id = this.scene.addObject("portal", {
        position: { x: point.x, y: point.y },
        size: { width: 90, height: 90 },
        fill: createRadialGradientFill(45, [
          { offset: 0, color: { r: 0.4, g: 0.5, b: 0.6, a: 0.15 } },
          { offset: 0.55, color: { r: 0.4, g: 0.7, b: 0.7, a: 0.05 } },
          { offset: 0.65, color: { r: 0.4, g: 0.9, b: 0.9, a: 0.65 } },
          { offset: 0.75, color: { r: 0.4, g: 0.9, b: 0.9, a: 0.75 } },
          { offset: 0.8, color: { r: 0.25, g: 0.9, b: 0.9, a: 0.8 } },
          { offset: 0.85, color: { r: 0.25, g: 0.9, b: 0.9, a: 0.8 } },
          { offset: 1, color: { r: 0.15, g: 0.7, b: 0.7, a: 0 } },
        ]),
        rotation: 0,
        customData: {
          radius: 45,
          autoAnimate: true, // Enable auto-animation so particles update every frame
          emitter: {
            particlesPerSecond: 90,
            particleLifetimeMs: 900,
            fadeStartMs: 750,
            sizeRange: { min: 1, max: 3 },
            offset: { x: 0, y: 0 },
            color: { r: 0.4, g: 0.8, b: 0.8, a: 0.6 },
            shape: "circle",
            maxParticles: 120,
            baseSpeed: 0.03,
            speedVariation: 0.01,
          },
        },
      });
      this.portalObjects.push({ id, position: { ...point } });
    });
  }

  public tick(deltaMs: number): void {
    this.applyPendingCameraFocus();
    this.updatePortalObjects();
    this.updateRadioactivityOverlay(deltaMs);
  }

  public clearPortalObjects(): void {
    if (this.portalObjects.length === 0) {
      return;
    }
    this.portalObjects.forEach((portal) => this.scene.removeObject(portal.id));
    this.portalObjects = [];
  }

  private updatePortalObjects(): void {
    if (this.portalObjects.length === 0) {
      return;
    }
    this.portalObjects.forEach((portal) => {
      this.scene.updateObject(portal.id, {
        position: { x: portal.position.x, y: portal.position.y },
      });
    });
  }

  private focusCameraOnPoint(point: SceneVector2): void {
    const camera = this.scene.getCamera();
    const targetX = point.x - camera.viewportSize.width / 2;
    const targetY = point.y - camera.viewportSize.height / 2;
    this.scene.setCameraPosition(targetX, targetY);
  }

  private applyPendingCameraFocus(): void {
    const pending = this.pendingCameraFocus;
    if (!pending) {
      return;
    }
    this.focusCameraOnPoint(pending.point);
    if (pending.ticksRemaining <= 1) {
      this.pendingCameraFocus = null;
      return;
    }
    this.pendingCameraFocus = {
      point: pending.point,
      ticksRemaining: pending.ticksRemaining - 1,
    };
  }

  private updateRadioactivityOverlay(deltaMs: number): void {
    this.radioactivityElapsedMs += Math.max(deltaMs, 0);
    const level = this.mapEffects.getEffectLevel("radioactivity");
    if (level === null) {
      this.clearRadioactivityOverlay();
      return;
    }
    const config = getMapEffectConfig("radioactivity");
    const visuals = config.visuals;
    if (!visuals) {
      this.clearRadioactivityOverlay();
      return;
    }

    const intensity = clampNumber(
      config.maxLevel > 0 ? level / config.maxLevel : 0,
      0,
      1
    );
    const timeSeconds = this.radioactivityElapsedMs / 1000;
    const pulse = 0.7 + 0.3 * Math.sin(timeSeconds * 2.1);
    const flicker = 0.7 + 0.3 * Math.sin(timeSeconds * 5.4 + 1.2);
    const spikeBase = (Math.sin(timeSeconds * 3.6) + 1) / 2;
    const spike = Math.pow(spikeBase, 3);
    const artifactStrength = clampNumber(intensity * (0.6 + 0.6 * spike), 0, 1);
    const camera = this.scene.getCamera();
    const center = {
      x: camera.position.x + camera.viewportSize.width / 2,
      y: camera.position.y + camera.viewportSize.height / 2,
    };
    const size = this.resolveViewportSize(camera.viewportSize);
    const baseAlpha = visuals.maxTintAlpha * intensity * (0.9 + 0.1 * flicker);
    const radius = Math.max(size.width, size.height) * (0.6 + 0.2 * pulse);
    const noiseEnabled = visuals.maxNoiseAlpha > 0 || visuals.maxNoiseColor > 0;
    const fill = createRadialGradientFill(
      radius,
      [
        {
          offset: 0,
          color: {
            r: visuals.tintColor.r,
            g: visuals.tintColor.g,
            b: visuals.tintColor.b,
            a: baseAlpha,
          },
        },
        {
          offset: 0.55,
          color: {
            r: visuals.tintColor.r,
            g: visuals.tintColor.g,
            b: visuals.tintColor.b,
            a: baseAlpha * 0.6,
          },
        },
        {
          offset: 1,
          color: {
            r: visuals.tintColor.r,
            g: visuals.tintColor.g,
            b: visuals.tintColor.b,
            a: 0,
          },
        },
      ],
      {
        start: { x: 0, y: 0 },
        noise: noiseEnabled
          ? {
              colorAmplitude: visuals.maxNoiseColor * artifactStrength,
              alphaAmplitude: visuals.maxNoiseAlpha * artifactStrength,
              scale: visuals.noiseScale,
              density: visuals.noiseDensity,
            }
          : undefined,
      }
    );

    if (!this.radioactivityOverlayId) {
      this.radioactivityOverlayId = this.scene.addObject("screenOverlay", {
        position: center,
        size,
        fill,
        rotation: 0,
        customData: { id: RADIOACTIVITY_OVERLAY_ID },
      });
      return;
    }

    this.scene.updateObject(this.radioactivityOverlayId, {
      position: center,
      size,
      fill,
    });
  }

  private resolveViewportSize(viewport: SceneSize): SceneSize {
    const width = Math.max(0, viewport.width);
    const height = Math.max(0, viewport.height);
    return { width, height };
  }

  private clearRadioactivityOverlay(): void {
    if (!this.radioactivityOverlayId) {
      return;
    }
    this.scene.removeObject(this.radioactivityOverlayId);
    this.radioactivityOverlayId = null;
  }
}
