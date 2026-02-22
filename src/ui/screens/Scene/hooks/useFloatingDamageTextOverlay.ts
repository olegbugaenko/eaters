import { RefObject, useEffect, useRef } from "react";
import type { DataBridge } from "@core/logic/ui/DataBridge";
import type { SceneUiApi } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { DAMAGE_TEXT_BRIDGE_KEY, DAMAGE_TEXT_TUNING } from "@logic/modules/active-map/targeting/damage-text.const";
import type { FloatingDamageTextBridgePayload } from "@logic/modules/active-map/targeting/damage-text.types";
import { readStoredGraphicsSettings } from "@logic/utils/graphicsSettings";

interface FloatingTextState {
  x: number;
  y: number;
  amount: number;
  createdAt: number;
}

interface UseFloatingDamageTextOverlayOptions {
  bridge: DataBridge;
  scene: SceneUiApi;
  canvasRef: RefObject<HTMLCanvasElement>;
  overlayCanvasRef: RefObject<HTMLCanvasElement>;
}

export const useFloatingDamageTextOverlay = ({
  bridge,
  scene,
  canvasRef,
  overlayCanvasRef,
}: UseFloatingDamageTextOverlayOptions): void => {
  const floatingTextRef = useRef<FloatingTextState[]>([]);
  const graphicsEnabledRef = useRef(readStoredGraphicsSettings().floatingDamageText);

  useEffect(() => {
    const handleStorage = () => {
      graphicsEnabledRef.current = readStoredGraphicsSettings().floatingDamageText;
      if (!graphicsEnabledRef.current) {
        floatingTextRef.current = [];
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const unsubscribe = bridge.subscribe(
      DAMAGE_TEXT_BRIDGE_KEY,
      (payload: FloatingDamageTextBridgePayload) => {
        if (!graphicsEnabledRef.current || payload.events.length === 0) {
          return;
        }
        const now = performance.now();
        const next = floatingTextRef.current;
        payload.events.forEach((event) => {
          next.push({
            x: event.x,
            y: event.y,
            amount: event.amount,
            createdAt: now,
          });
        });
        if (next.length > DAMAGE_TEXT_TUNING.maxConcurrentTexts) {
          next.splice(0, next.length - DAMAGE_TEXT_TUNING.maxConcurrentTexts);
        }
      },
    );

    return unsubscribe;
  }, [bridge]);

  useEffect(() => {
    let rafId = 0;

    const render = () => {
      const baseCanvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (!baseCanvas || !overlayCanvas) {
        rafId = requestAnimationFrame(render);
        return;
      }

      if (
        overlayCanvas.width !== baseCanvas.width ||
        overlayCanvas.height !== baseCanvas.height
      ) {
        overlayCanvas.width = baseCanvas.width;
        overlayCanvas.height = baseCanvas.height;
      }

      const context = overlayCanvas.getContext("2d");
      if (!context) {
        rafId = requestAnimationFrame(render);
        return;
      }
      context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      if (!graphicsEnabledRef.current || floatingTextRef.current.length === 0) {
        rafId = requestAnimationFrame(render);
        return;
      }

      const now = performance.now();
      const lifetimeMs = DAMAGE_TEXT_TUNING.lifetimeMs;
      const risePerMs = DAMAGE_TEXT_TUNING.riseSpeedWorldUnitsPerSecond / 1000;
      const camera = scene.getCamera();
      const survivors: FloatingTextState[] = [];

      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `700 ${DAMAGE_TEXT_TUNING.fontSizePx}px Inter, system-ui, sans-serif`;

      floatingTextRef.current.forEach((entry) => {
        const ageMs = now - entry.createdAt;
        if (ageMs >= lifetimeMs) {
          return;
        }
        const worldY = entry.y - ageMs * risePerMs;
        const normalizedX = (entry.x - camera.position.x) / camera.viewportSize.width;
        const normalizedY = (worldY - camera.position.y) / camera.viewportSize.height;
        if (normalizedX < -0.1 || normalizedX > 1.1 || normalizedY < -0.1 || normalizedY > 1.1) {
          return;
        }

        const x = normalizedX * overlayCanvas.width;
        const y = normalizedY * overlayCanvas.height;
        const alpha = Math.max(0, 1 - ageMs / lifetimeMs);

        context.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.85})`;
        context.lineWidth = 3;
        context.strokeText(`${Math.round(entry.amount)}`, x, y);
        context.fillStyle = `rgba(255, 236, 179, ${alpha})`;
        context.fillText(`${Math.round(entry.amount)}`, x, y);
        survivors.push(entry);
      });

      floatingTextRef.current = survivors;
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(rafId);
  }, [scene, canvasRef, overlayCanvasRef]);
};
