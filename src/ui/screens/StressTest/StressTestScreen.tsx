import { useEffect, useMemo, useRef } from "react";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { cloneSceneColor } from "@shared/helpers/scene-style.helper";
import { cloneRendererConfigForScene, deriveRendererStroke } from "@shared/helpers/renderer-clone.helper";
import { setupWebGLScene } from "@ui/screens/Scene/hooks/useWebGLSceneSetup";
import { createWebGLRenderLoop } from "@ui/screens/Scene/hooks/useWebGLRenderLoop";
import { cloneEmitterConfig } from "@ui/screens/SaveSlotSelect/save-slot-scene-utils";
import { SceneDebugPanel } from "@ui/screens/Scene/components/debug/SceneDebugPanel";
import {
  tickFrame,
  updateAnimationStats,
  updateJointStats,
  updateJoinedStats,
  updateUnitStats,
} from "@ui/screens/Scene/components/debug/debugStats";
import { getPlayerUnitConfig, type PlayerUnitRendererConfig } from "@db/player-units-db";
import type { UnitModuleId } from "@db/unit-modules-db";
import { resolveAnimationExecutionMode } from "@ui/renderers/objects/shared/animation-pipeline";
import { isAnimationGpuAvailable, setAnimationGpuContext } from "@ui/renderers/objects/shared/animation-gpu";
import { particleEmitterGpuRenderer } from "@ui/renderers/primitives/gpu/particle-emitter";
import { updateAllWhirlInterpolations } from "@ui/renderers/objects";
import { whirlGpuRenderer } from "@ui/renderers/primitives/gpu/whirl";
import { petalAuraGpuRenderer } from "@ui/renderers/primitives/gpu/petal-aura";
import { arcGpuRenderer } from "@ui/renderers/primitives/gpu/arc";
import { renderFireRings } from "@ui/renderers/primitives/gpu/fire-ring";
import { joinedPolygonGpuRenderer } from "@ui/renderers/primitives/gpu/joined";
import { spineGpuRenderer } from "@ui/renderers/primitives/gpu/spine";
import { polygonGpuRenderer } from "@ui/renderers/primitives/gpu/polygon";
import "./StressTestScreen.css";

const MAP_SIZE = { width: 2400, height: 1600 };
const GRID_COLS = 10;
const GRID_ROWS = 10;

type StressUnitState = {
  objectId: string;
  orbitCenter: SceneVector2;
  orbitRadius: number;
  orbitSpeed: number;
  phase: number;
  wobbleAmplitude: number;
  previousPosition: SceneVector2;
  modules: UnitModuleId[];
  skills: string[];
};

const STRESS_TEST_GROUPS: Array<{ count: number; modules: UnitModuleId[] }> = [
  { count: 25, modules: ["burningTail"] },
  { count: 25, modules: ["freezingTail"] },
  { count: 25, modules: ["mendingGland"] },
  { count: 25, modules: ["perforator"] },
];

const getRandomSeed = (seed: number): number => {
  const x = Math.sin(seed * 917.17) * 10000;
  return x - Math.floor(x);
};

const buildModuleAssignments = (): UnitModuleId[][] => {
  const modules: UnitModuleId[][] = [];
  STRESS_TEST_GROUPS.forEach((group) => {
    for (let i = 0; i < group.count; i += 1) {
      modules.push(group.modules);
    }
  });
  return modules;
};

const buildUnitStats = (
  modules: UnitModuleId[],
  skills: string[],
  renderer: PlayerUnitRendererConfig,
  gpuAvailable: boolean
) => {
  let jointTotal = 0;
  let jointGpu = 0;
  let jointCpu = 0;
  let animTotal = 0;
  let animGpu = 0;
  let animCpu = 0;

  renderer.layers.forEach((layer) => {
    if (layer.requiresModule && !modules.includes(layer.requiresModule)) {
      return;
    }
    if (layer.requiresSkill && !skills.includes(layer.requiresSkill)) {
      return;
    }
    if (layer.requiresEffect) {
      return;
    }

    if (layer.join) {
      jointTotal += 1;
      const canGpuJoin =
        gpuAvailable &&
        !layer.anim &&
        (layer.shape === "polygon" || layer.shape === "circle");
      if (canGpuJoin) {
        jointGpu += 1;
      } else {
        jointCpu += 1;
      }
    }

    if (layer.anim) {
      animTotal += 1;
      const executionMode = resolveAnimationExecutionMode({
        requested: layer.anim.executionMode,
        gpuAvailable,
        warnKey: "stress-test",
      });
      if (executionMode === "gpu") {
        animGpu += 1;
      } else {
        animCpu += 1;
      }
    }
  });

  return {
    jointTotal,
    jointGpu,
    jointCpu,
    animTotal,
    animGpu,
    animCpu,
  };
};

const updateStressStats = (units: StressUnitState[], renderer: PlayerUnitRendererConfig) => {
  const gpuAvailable = isAnimationGpuAvailable();
  let jointTotal = 0;
  let jointGpu = 0;
  let jointCpu = 0;
  let animTotal = 0;
  let animGpu = 0;
  let animCpu = 0;

  units.forEach((unit) => {
    const stats = buildUnitStats(unit.modules, unit.skills, renderer, gpuAvailable);
    jointTotal += stats.jointTotal;
    jointGpu += stats.jointGpu;
    jointCpu += stats.jointCpu;
    animTotal += stats.animTotal;
    animGpu += stats.animGpu;
    animCpu += stats.animCpu;
  });

  updateUnitStats(units.length);
  updateJointStats({ total: jointTotal, gpu: jointGpu, cpu: jointCpu });
  updateAnimationStats({ total: animTotal, gpu: animGpu, cpu: animCpu });
};

const createStressUnits = (
  scene: SceneObjectManager,
  modulesList: UnitModuleId[]
): StressUnitState => {
  const config = getPlayerUnitConfig("bluePentagon");
  const stroke = deriveRendererStroke(config.renderer);
  const renderer = cloneRendererConfigForScene(config.renderer);
  const baseFillColor = cloneSceneColor(config.renderer.fill)!;
  const baseStrokeColor = stroke?.color ? cloneSceneColor(stroke.color) : undefined;
  const emitter = cloneEmitterConfig(config.emitter);
  const skills = modulesList.length > 0 ? ["void_modules"] : [];

  const objectId = scene.addObject("playerUnit", {
    position: { x: 0, y: 0 },
    fill: { fillType: FILL_TYPES.SOLID, color: baseFillColor },
    stroke: stroke
      ? {
          color: cloneSceneColor(stroke.color)!,
          width: stroke.width,
        }
      : undefined,
    rotation: 0,
    customData: {
      renderer,
      emitter,
      physicalSize: config.physicalSize,
      baseFillColor,
      baseStrokeColor,
      modules: modulesList,
      skills,
    },
  });

  return {
    objectId,
    orbitCenter: { x: 0, y: 0 },
    orbitRadius: 0,
    orbitSpeed: 0,
    phase: 0,
    wobbleAmplitude: 0,
    previousPosition: { x: 0, y: 0 },
    modules: modulesList,
    skills,
  };
};

const buildStressUnits = (scene: SceneObjectManager): StressUnitState[] => {
  const assignments = buildModuleAssignments();
  const spacingX = MAP_SIZE.width / (GRID_COLS + 1);
  const spacingY = MAP_SIZE.height / (GRID_ROWS + 1);
  const startX = spacingX;
  const startY = spacingY;

  return assignments.map((modulesList, index) => {
    const unit = createStressUnits(scene, modulesList);
    const row = Math.floor(index / GRID_COLS);
    const col = index % GRID_COLS;
    const center: SceneVector2 = {
      x: startX + col * spacingX,
      y: startY + row * spacingY,
    };
    const radius = 28 + getRandomSeed(index + 1) * 48;
    const speedSeed = getRandomSeed(index + 31);
    const speed = (0.00025 + speedSeed * 0.0004) * (index % 2 === 0 ? 1 : -1);
    const phase = getRandomSeed(index + 77) * Math.PI * 2;
    const wobble = 6 + getRandomSeed(index + 101) * 8;
    const initialPosition: SceneVector2 = {
      x: center.x + Math.cos(phase) * radius,
      y: center.y + Math.sin(phase) * radius,
    };
    scene.updateObject(unit.objectId, { position: initialPosition });
    return {
      ...unit,
      orbitCenter: center,
      orbitRadius: radius,
      orbitSpeed: speed,
      phase,
      wobbleAmplitude: wobble,
      previousPosition: { ...initialPosition },
    };
  });
};

const updateStressUnits = (
  scene: SceneObjectManager,
  units: StressUnitState[],
  timestamp: number
) => {
  units.forEach((unit, index) => {
    const angle = unit.phase + timestamp * unit.orbitSpeed;
    const wobble = Math.sin(timestamp * 0.001 + unit.phase) * unit.wobbleAmplitude;
    const nextPosition: SceneVector2 = {
      x: unit.orbitCenter.x + Math.cos(angle) * unit.orbitRadius + wobble,
      y: unit.orbitCenter.y + Math.sin(angle) * unit.orbitRadius + wobble * 0.5,
    };
    const dx = nextPosition.x - unit.previousPosition.x;
    const dy = nextPosition.y - unit.previousPosition.y;
    const rotation = Math.atan2(dy, dx) + (index % 3) * 0.05;
    unit.previousPosition = nextPosition;
    scene.updateObject(unit.objectId, { position: nextPosition, rotation });
  });
};

export const StressTestScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const unitsRef = useRef<StressUnitState[]>([]);
  const rendererConfig = useMemo(() => getPlayerUnitConfig("bluePentagon").renderer, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const wrapper = canvas.parentElement as HTMLElement | null;
    const scene = new SceneObjectManager();
    scene.setMapSize(MAP_SIZE);

    unitsRef.current = buildStressUnits(scene);

    const { gl, webglRenderer, cleanup: webglCleanup } = setupWebGLScene(canvas, scene);
    
    // Set GPU context for animation primitives
    setAnimationGpuContext(gl);

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = wrapper?.clientWidth ?? window.innerWidth;
      const targetHeight = wrapper?.clientHeight ?? window.innerHeight;
      const width = Math.max(1, Math.round(targetWidth * dpr));
      const height = Math.max(1, Math.round(targetHeight * dpr));
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${targetHeight}px`;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      scene.setViewportScreenSize(width, height);
      const scale = Math.min(1, width / MAP_SIZE.width, height / MAP_SIZE.height);
      scene.setScale(scale);
      const viewWidth = width / scale;
      const viewHeight = height / scale;
      const posX = Math.max(0, (MAP_SIZE.width - viewWidth) / 2);
      const posY = Math.max(0, (MAP_SIZE.height - viewHeight) / 2);
      scene.setCameraPosition(posX, posY);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const initialChanges = scene.flushChanges();
    webglRenderer.getObjectsRenderer().applyChanges(initialChanges);
    webglRenderer.syncBuffers(0);

    updateStressStats(unitsRef.current, rendererConfig);

    let lastJoinedStatsUpdate = 0;
    const renderLoop = createWebGLRenderLoop({
      webglRenderer,
      scene,
      gl,
      beforeUpdate: (timestamp) => {
        updateStressUnits(scene, unitsRef.current, timestamp);
      },
      beforeEffects: (timestamp, glContext, cameraState) => {
        particleEmitterGpuRenderer.beforeRender(glContext, timestamp);
        particleEmitterGpuRenderer.render(
          glContext,
          cameraState.position,
          cameraState.viewportSize,
          timestamp
        );
        updateAllWhirlInterpolations();
        whirlGpuRenderer.beforeRender(glContext, timestamp);
        petalAuraGpuRenderer.beforeRender(glContext, timestamp);
        whirlGpuRenderer.render(
          glContext,
          cameraState.position,
          cameraState.viewportSize,
          timestamp
        );
        petalAuraGpuRenderer.render(
          glContext,
          cameraState.position,
          cameraState.viewportSize,
          timestamp
        );
        arcGpuRenderer.beforeRender(glContext, timestamp);
        arcGpuRenderer.render(
          glContext,
          cameraState.position,
          cameraState.viewportSize,
          timestamp
        );
        spineGpuRenderer.setContext(glContext);
        spineGpuRenderer.render(glContext, cameraState);
        polygonGpuRenderer.render(glContext, cameraState);
        renderFireRings(glContext, cameraState.position, cameraState.viewportSize, timestamp);
      },
      afterRender: (timestamp) => {
        tickFrame();
        if (timestamp - lastJoinedStatsUpdate >= 500) {
          lastJoinedStatsUpdate = timestamp;
          const joinedStats = joinedPolygonGpuRenderer.getStats();
          updateJoinedStats({
            handles: joinedStats.handles,
            drawCalls: joinedStats.drawCalls,
            renderMs: joinedStats.renderMs,
            uploadMs: joinedStats.anchorUploadMs,
          });
        }
      },
    });

    renderLoop.start();

    return () => {
      renderLoop.stop();
      window.removeEventListener("resize", handleResize);
      webglCleanup();
    };
  }, [rendererConfig]);

  return (
    <div className="stress-test-screen">
      <canvas ref={canvasRef} className="stress-test-canvas" />
      <SceneDebugPanel />
    </div>
  );
};
