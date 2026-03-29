import { RefObject, useEffect, useRef } from "react";
import type { DataBridge } from "@core/logic/ui/DataBridge";
import type { SceneUiApi } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { DAMAGE_TEXT_BRIDGE_KEY, DAMAGE_TEXT_TUNING } from "@logic/modules/active-map/targeting/damage-text.const";
import type { FloatingDamageTextBridgePayload, FloatingTextKind } from "@logic/modules/active-map/targeting/damage-text.types";
import { readStoredGraphicsSettings } from "@logic/utils/graphicsSettings";

interface FloatingTextState {
  x: number;
  y: number;
  amount: number;
  createdAt: number;
  isCritical: boolean;
  kind: FloatingTextKind;
  targetType: string;
}

interface UseFloatingDamageTextOverlayOptions {
  bridge: DataBridge;
  scene: SceneUiApi;
  canvasRef: RefObject<HTMLCanvasElement>;
  overlayCanvasRef: RefObject<HTMLCanvasElement>;
}

const GRAPHICS_SETTINGS_REFRESH_MS = 150;
const DENSITY_RADIUS = 30;
const DENSITY_MAX_TEXTS = 2;

export const useFloatingDamageTextOverlay = ({
  bridge,
  scene,
  canvasRef,
  overlayCanvasRef,
}: UseFloatingDamageTextOverlayOptions): void => {
  const floatingTextRef = useRef<FloatingTextState[]>([]);
  const graphicsEnabledRef = useRef(readStoredGraphicsSettings().floatingDamageText);
  const lastSettingsReadAtRef = useRef(0);
  const rafIdRef = useRef(0);
  const timeoutIdRef = useRef<number | null>(null);
  const renderingRef = useRef(false);
  const lastRenderAtRef = useRef(0);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  const syncGraphicsFlag = (): boolean => {
    const now = performance.now();
    if (now - lastSettingsReadAtRef.current < GRAPHICS_SETTINGS_REFRESH_MS) {
      return graphicsEnabledRef.current;
    }
    lastSettingsReadAtRef.current = now;
    const enabled = readStoredGraphicsSettings().floatingDamageText;
    graphicsEnabledRef.current = enabled;
    if (!enabled && floatingTextRef.current.length > 0) {
      floatingTextRef.current.length = 0;
    }
    return enabled;
  };

  const queueRender = (delayMs = 0) => {
    if (delayMs <= 0) {
      rafIdRef.current = requestAnimationFrame(renderTick);
      return;
    }
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
    }
    timeoutIdRef.current = window.setTimeout(() => {
      timeoutIdRef.current = null;
      rafIdRef.current = requestAnimationFrame(renderTick);
    }, delayMs);
  };

  const startRenderLoop = () => {
    if (renderingRef.current) return;
    renderingRef.current = true;
    queueRender();
  };

  const renderTick = () => {
    const now = performance.now();
    const minInterval = DAMAGE_TEXT_TUNING.renderIntervalMs;
    const texts = floatingTextRef.current;
    const baseCanvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (texts.length === 0 || !baseCanvas || !overlayCanvas) {
      if (texts.length === 0 && overlayCanvas) {
        const ctx = contextRef.current ?? overlayCanvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
      contextRef.current = overlayCanvas ? contextRef.current : null;
      renderingRef.current = false;
      return;
    }

    const elapsedSinceRender = now - lastRenderAtRef.current;
    if (elapsedSinceRender < minInterval) {
      queueRender(minInterval - elapsedSinceRender);
      return;
    }
    lastRenderAtRef.current = now;

    if (overlayCanvas.width !== baseCanvas.width || overlayCanvas.height !== baseCanvas.height) {
      overlayCanvas.width = baseCanvas.width;
      overlayCanvas.height = baseCanvas.height;
      contextRef.current = null;
    }

    const context = contextRef.current ?? overlayCanvas.getContext("2d");
    if (!context) {
      renderingRef.current = false;
      return;
    }
    contextRef.current = context;
    context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (!syncGraphicsFlag()) {
      renderingRef.current = false;
      return;
    }

    const lifetimeMs = DAMAGE_TEXT_TUNING.lifetimeMs;
    const risePerMs = DAMAGE_TEXT_TUNING.riseSpeedWorldUnitsPerSecond / 1000;
    const camera = scene.getCamera();
    const baseFontSize = DAMAGE_TEXT_TUNING.fontSizePx;
    const critFontSize = Math.round(baseFontSize * 1.25);

    context.textAlign = "center";
    context.textBaseline = "middle";

    let writeIdx = 0;

    for (let i = 0; i < texts.length; i++) {
      const entry = texts[i]!;
      const ageMs = now - entry.createdAt;
      if (ageMs >= lifetimeMs) continue;

      texts[writeIdx++] = entry;

      const worldY = entry.y - ageMs * risePerMs;
      const normalizedX = (entry.x - camera.position.x) / camera.viewportSize.width;
      const normalizedY = (worldY - camera.position.y) / camera.viewportSize.height;
      if (normalizedX < -0.1 || normalizedX > 1.1 || normalizedY < -0.1 || normalizedY > 1.1) {
        continue;
      }

      const x = normalizedX * overlayCanvas.width;
      const y = normalizedY * overlayCanvas.height;
      const alpha = Math.max(0, 1 - ageMs / lifetimeMs);
      if (alpha <= 0.02) {
        continue;
      }

      let amountText: string;
      let fillColor: string;
      let strokeAlpha: number;
      let fontSize: number;
      let lineW: number;

      if (entry.kind === "heal") {
        amountText = `+${Math.round(entry.amount)}`;
        fillColor = `rgba(100, 255, 120, ${alpha})`;
        strokeAlpha = alpha * 0.8;
        fontSize = baseFontSize;
        lineW = 2.5;
      } else if (entry.targetType === "unit") {
        amountText = `${Math.round(entry.amount)}`;
        fillColor = `rgba(255, 90, 80, ${alpha})`;
        strokeAlpha = alpha * 0.8;
        fontSize = baseFontSize;
        lineW = 2.5;
      } else if (entry.isCritical) {
        amountText = `${Math.round(entry.amount)}!`;
        fillColor = `rgba(255, 236, 179, ${alpha})`;
        strokeAlpha = alpha * 0.85;
        fontSize = critFontSize;
        lineW = 3.5;
      } else {
        amountText = `${Math.round(entry.amount)}`;
        fillColor = `rgba(255, 255, 255, ${alpha})`;
        strokeAlpha = alpha * 0.7;
        fontSize = baseFontSize;
        lineW = 2.5;
      }

      context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
      context.strokeStyle = `rgba(0, 0, 0, ${strokeAlpha})`;
      context.lineWidth = lineW;
      context.strokeText(amountText, x, y);
      context.fillStyle = fillColor;
      context.fillText(amountText, x, y);
    }

    texts.length = writeIdx;

    if (writeIdx > 0) {
      queueRender();
    } else {
      renderingRef.current = false;
    }
  };

  useEffect(() => {
    const unsubscribe = bridge.subscribe(
      DAMAGE_TEXT_BRIDGE_KEY,
      (payload: FloatingDamageTextBridgePayload) => {
        if (payload.clear) {
          floatingTextRef.current.length = 0;
          return;
        }
        if (!syncGraphicsFlag() || payload.events.length === 0) {
          return;
        }

        const now = performance.now();
        const alive = floatingTextRef.current;
        const lifetimeMs = DAMAGE_TEXT_TUNING.lifetimeMs;

        const incoming = payload.events.map((event) => ({
          x: event.x,
          y: event.y,
          amount: event.amount,
          createdAt: now,
          isCritical: event.isCritical === true,
          kind: (event.kind ?? "damage") as FloatingTextKind,
          targetType: event.targetType,
        }));

        incoming.sort((a, b) => b.amount - a.amount);

        for (const candidate of incoming) {
          let nearbyCount = 0;
          for (let i = alive.length - 1; i >= 0; i--) {
            const e = alive[i]!;
            if (now - e.createdAt >= lifetimeMs) continue;
            const dx = e.x - candidate.x;
            const dy = e.y - candidate.y;
            if (dx * dx + dy * dy <= DENSITY_RADIUS * DENSITY_RADIUS) {
              nearbyCount++;
            }
          }
          if (nearbyCount < DENSITY_MAX_TEXTS) {
            alive.push(candidate);
          }
        }

        if (alive.length > DAMAGE_TEXT_TUNING.maxConcurrentTexts) {
          alive.splice(0, alive.length - DAMAGE_TEXT_TUNING.maxConcurrentTexts);
        }

        startRenderLoop();
      },
    );

    return () => {
      unsubscribe();
      cancelAnimationFrame(rafIdRef.current);
      if (timeoutIdRef.current !== null) {
        clearTimeout(timeoutIdRef.current);
      }
      renderingRef.current = false;
      contextRef.current = null;
      floatingTextRef.current.length = 0;
    };
  }, [bridge]);
};
