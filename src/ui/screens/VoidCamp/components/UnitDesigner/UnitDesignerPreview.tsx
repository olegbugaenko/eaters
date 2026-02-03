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

  const moduleKey = useMemo(() => modules.join("|"), [modules]);
  const skillKey = useMemo(() => skills.join("|"), [skills]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) {
      return;
    }

    const scene = new SceneObjectManager();
    const config = getPlayerUnitConfig(unitType);
    const rendererConfig = cloneRendererConfigForScene(config.renderer, { deep: false });
    const emitter = config.emitter ? cloneEmitter(config.emitter) : undefined;

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

    const setupSceneObject = (mapWidth: number, mapHeight: number) => {
      const unitPosition = { x: mapWidth / 2, y: mapHeight / 2 };
      const objectId = scene.addObject("playerUnit", {
        position: unitPosition,
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
          physicalSize: config.physicalSize,
          baseFillColor: { ...baseFillColor },
          baseStrokeColor: baseStrokeColor ? { ...baseStrokeColor } : undefined,
          modules: [...modules],
          skills: [...skills],
          autoAnimate: true,
        },
      });
      return { unitPosition, objectId };
    };

    let unitObjectId: string | null = null;
    let unitPosition = { x: 0, y: 0 };

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(1, Math.floor(bounds.height));
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      scene.setViewportScreenSize(width, height);
      const mapWidth = Math.max(200, width);
      const mapHeight = Math.max(200, height);
      scene.setMapSize({ width: mapWidth, height: mapHeight });

      if (!unitObjectId) {
        const setup = setupSceneObject(mapWidth, mapHeight);
        unitObjectId = setup.objectId;
        unitPosition = setup.unitPosition;
      } else {
        unitPosition = { x: mapWidth / 2, y: mapHeight / 2 };
        scene.updateObject(unitObjectId, { position: unitPosition });
      }

      const camera = scene.getCamera();
      scene.setCameraPosition(
        unitPosition.x - camera.viewportSize.width / 2,
        unitPosition.y - camera.viewportSize.height / 2
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
    };
  }, [isOpen, unitType, unitBlueprint, moduleKey, skillKey]);

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={containerRef} className="unit-designer__preview">
      <canvas ref={canvasRef} className="unit-designer__preview-canvas" />
    </div>
  );
};
