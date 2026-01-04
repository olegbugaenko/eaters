import { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import { createRadialGradientFill } from "@shared/helpers/scene-fill.helper";

const CAMERA_FOCUS_TICKS = 6;

export class MapVisualEffects {
  private portalObjects: { id: string; position: SceneVector2 }[] = [];
  private pendingCameraFocus: { point: SceneVector2; ticksRemaining: number } | null = null;

  constructor(private readonly scene: SceneObjectManager) {}

  public reset(): void {
    this.clearPortalObjects();
    this.pendingCameraFocus = null;
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

  public tick(): void {
    this.applyPendingCameraFocus();
    this.updatePortalObjects();
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
}

