import { useEffect, useMemo, useRef } from "react";
import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { getPlayerUnitConfig, PlayerUnitType } from "@db/player-units-db";
import type { PlayerUnitBlueprintStats } from "@shared/types/player-units";
import type { UnitModuleId } from "@db/unit-modules-db";
import { cloneRendererConfigForScene } from "@shared/helpers/renderer-clone.helper";
import { cloneEmitter } from "@logic/modules/active-map/player-units/player-units.helpers";
import { createWebGLRenderLoop } from "@ui/screens/Scene/hooks/useWebGLRenderLoop";
import type { SkillId } from "@db/skills-db";
import { acquirePreviewWebgl, releasePreviewWebgl } from "./previewWebglManager";
import { petalAuraGpuRenderer } from "@ui/renderers/primitives/gpu/petal-aura";

const PREVIEW_VIEWPORT_SCALE = 2.2;

interface UnitDesignerPreviewProps {
  unitType: PlayerUnitType;
  unitBlueprint: PlayerUnitBlueprintStats;
  modules: readonly UnitModuleId[];
  skills: readonly SkillId[];
  isOpen: boolean;
}

export const UnitDesignerPreview: React.FC<UnitDesignerPreviewProps> = ({
  unitType,
  unitBlueprint,
  modules,
  skills,
  isOpen,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneObjectManager | null>(null);
  const unitObjectIdRef = useRef<string | null>(null);
  const unitPositionRef = useRef({ x: 0, y: 0 });
  const lastUnitTypeRef = useRef<PlayerUnitType | null>(null);
  const lastUnitSignatureRef = useRef<string | null>(null);

  const moduleKey = useMemo(() => modules.join("|"), [modules]);
  const skillKey = useMemo(() => skills.join("|"), [skills]);
  const unitSignature = useMemo(
    () => `${unitType}|${moduleKey}|${skillKey}|${unitBlueprint.physicalSize}`,
    [unitType, moduleKey, skillKey, unitBlueprint.physicalSize]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) {
      return;
    }

    const scene = sceneRef.current ?? new SceneObjectManager();
    sceneRef.current = scene;

    const buildUnitObjectData = () => {
      const config = getPlayerUnitConfig(unitType);
      const rendererConfig = cloneRendererConfigForScene(config.renderer, { deep: false });
      const emitter = config.emitter ? cloneEmitter(config.emitter) : undefined;
      const physicalSize = unitBlueprint.physicalSize || config.physicalSize;

      const baseFillColor = {
        r: config.renderer.fill.r,
        g: config.renderer.fill.g,
        b: config.renderer.fill.b,
        a: typeof config.renderer.fill.a === "number" ? config.renderer.fill.a : 1,
      };
      const baseStrokeColor = config.renderer.stroke
        ? {
            r: config.renderer.stroke.color.r,
            g: config.renderer.stroke.color.g,
            b: config.renderer.stroke.color.b,
            a:
              typeof config.renderer.stroke.color.a === "number"
                ? config.renderer.stroke.color.a
                : 1,
          }
        : { ...baseFillColor };

      return {
        fill: {
          fillType: FILL_TYPES.SOLID,
          color: { ...baseFillColor },
        },
        stroke: config.renderer.stroke
          ? {
              color: { ...config.renderer.stroke.color },
              width: config.renderer.stroke.width,
            }
          : undefined,
        rotation: 0,
        customData: {
          renderer: rendererConfig,
          emitter,
          physicalSize,
          baseFillColor: { ...baseFillColor },
          baseStrokeColor: baseStrokeColor ? { ...baseStrokeColor } : undefined,
          modules: [...modules],
          skills: [...skills],
          autoAnimate: true,
        },
      };
    };

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(1, Math.floor(bounds.height));
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const viewportWidth = Math.max(1, Math.floor(width * PREVIEW_VIEWPORT_SCALE));
      const viewportHeight = Math.max(1, Math.floor(height * PREVIEW_VIEWPORT_SCALE));
      scene.setViewportScreenSize(viewportWidth, viewportHeight);
      const mapWidth = Math.max(200, viewportWidth);
      const mapHeight = Math.max(200, viewportHeight);
      scene.setMapSize({ width: mapWidth, height: mapHeight });

      if (!unitObjectIdRef.current) {
        const unitPosition = { x: mapWidth / 2, y: mapHeight / 2 };
        const objectId = scene.addObject("playerUnit", {
          position: unitPosition,
          ...buildUnitObjectData(),
        });
        unitObjectIdRef.current = objectId;
        unitPositionRef.current = unitPosition;
        lastUnitTypeRef.current = unitType;
        lastUnitSignatureRef.current = unitSignature;
      } else {
        const unitPosition = { x: mapWidth / 2, y: mapHeight / 2 };
        unitPositionRef.current = unitPosition;
        scene.updateObject(unitObjectIdRef.current, { position: unitPosition });
      }

      const camera = scene.getCamera();
      scene.setCameraPosition(
        unitPositionRef.current.x - camera.viewportSize.width / 2,
        unitPositionRef.current.y - camera.viewportSize.height / 2
      );
    };

    resizeCanvas();

    const previewId = "unit-designer-preview";
    let gl: WebGL2RenderingContext | null = null;
    let webglRenderer: ReturnType<typeof acquirePreviewWebgl>["webglRenderer"] | null =
      null;

    try {
      const setup = acquirePreviewWebgl(previewId, canvas, scene, {
        initBullets: false,
        initRings: false,
      });
      gl = setup.gl;
      webglRenderer = setup.webglRenderer;
    } catch (error) {
      console.error("[UnitDesignerPreview] Failed to initialize WebGL preview", error);
      return () => {};
    }

    if (!gl || !webglRenderer) {
      return () => {};
    }

    gl.viewport(0, 0, canvas.width, canvas.height);

    const renderLoop = createWebGLRenderLoop({
      webglRenderer,
      scene,
      gl,
      beforeRender: () => {
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      beforeEffects: (timestamp, glContext, cameraState) => {
        petalAuraGpuRenderer.beforeRender(glContext, timestamp);
        petalAuraGpuRenderer.render(
          glContext,
          cameraState.position,
          cameraState.viewportSize,
          timestamp
        );
      },
    });

    const observer = new ResizeObserver(() => {
      resizeCanvas();
      gl.viewport(0, 0, canvas.width, canvas.height);
    });

    observer.observe(container);

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        renderLoop.stop();
      } else {
        renderLoop.start();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    renderLoop.start();

    return () => {
      renderLoop.stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      releasePreviewWebgl(previewId);
      sceneRef.current = null;
      unitObjectIdRef.current = null;
      lastUnitTypeRef.current = null;
      lastUnitSignatureRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const scene = sceneRef.current;
    const unitObjectId = unitObjectIdRef.current;
    if (!scene || !unitObjectId) {
      return;
    }

    const config = getPlayerUnitConfig(unitType);
    const rendererConfig = cloneRendererConfigForScene(config.renderer, { deep: false });
    const emitter = config.emitter ? cloneEmitter(config.emitter) : undefined;
    const physicalSize = unitBlueprint.physicalSize || config.physicalSize;
    const baseFillColor = {
      r: config.renderer.fill.r,
      g: config.renderer.fill.g,
      b: config.renderer.fill.b,
      a: typeof config.renderer.fill.a === "number" ? config.renderer.fill.a : 1,
    };
    const baseStrokeColor = config.renderer.stroke
      ? {
          r: config.renderer.stroke.color.r,
          g: config.renderer.stroke.color.g,
          b: config.renderer.stroke.color.b,
          a:
            typeof config.renderer.stroke.color.a === "number"
              ? config.renderer.stroke.color.a
              : 1,
        }
      : { ...baseFillColor };

    const nextData = {
      position: unitPositionRef.current,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { ...baseFillColor },
      },
      stroke: config.renderer.stroke
        ? {
            color: { ...config.renderer.stroke.color },
            width: config.renderer.stroke.width,
          }
        : undefined,
      customData: {
        renderer: rendererConfig,
        emitter,
        physicalSize,
        baseFillColor: { ...baseFillColor },
        baseStrokeColor: baseStrokeColor ? { ...baseStrokeColor } : undefined,
        modules: [...modules],
        skills: [...skills],
        autoAnimate: true,
      },
    };

    if (lastUnitSignatureRef.current !== unitSignature) {
      scene.removeObject(unitObjectId);
      const newId = scene.addObject("playerUnit", {
        ...nextData,
      });
      unitObjectIdRef.current = newId;
      lastUnitTypeRef.current = unitType;
      lastUnitSignatureRef.current = unitSignature;
      return;
    }

    scene.updateObject(unitObjectId, nextData);
  }, [isOpen, unitSignature, unitType, moduleKey, skillKey, unitBlueprint]);

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={containerRef} className="unit-designer__preview">
      <canvas ref={canvasRef} className="unit-designer__preview-canvas" />
    </div>
  );
};
