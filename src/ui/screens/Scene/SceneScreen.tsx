import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppLogic } from "../../contexts/AppLogicContext";
import { useBridgeValue } from "../../shared/useBridgeValue";
import {
  BRICK_COUNT_BRIDGE_KEY,
  BRICK_TOTAL_HP_BRIDGE_KEY,
} from "../../../logic/modules/active-map/BricksModule";
import {
  PLAYER_UNIT_COUNT_BRIDGE_KEY,
  PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY,
} from "../../../logic/modules/active-map/PlayerUnitsModule";
import {
  NECROMANCER_RESOURCES_BRIDGE_KEY,
  NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
  NecromancerResourcesPayload,
  NecromancerSpawnOption,
} from "../../../logic/modules/active-map/NecromancerModule";
import {
  DEFAULT_SPELL_OPTIONS,
  SPELL_OPTIONS_BRIDGE_KEY,
  SpellOption,
} from "../../../logic/modules/active-map/SpellcastingModule";
import {
  DEFAULT_UNIT_AUTOMATION_STATE,
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
  UnitAutomationBridgeState,
} from "../../../logic/modules/active-map/UnitAutomationModule";
import { UnitDesignId } from "../../../logic/modules/camp/UnitDesignModule";
import { SpellId } from "../../../db/spells-db";
import {
  SceneCameraState,
  SceneObjectManager,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  POSITION_COMPONENTS,
  VERTEX_COMPONENTS,
  FILL_INFO_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  STOP_COLOR_COMPONENTS,
  createObjectsRendererManager,
} from "../../renderers/objects";
import { SceneDebugPanel } from "./SceneDebugPanel";
import { SceneToolbar } from "./SceneToolbar";
import { SceneSummoningPanel } from "./SceneSummoningPanel";
import "./SceneScreen.css";
import { setParticleEmitterGlContext } from "../../renderers/primitives/gpuContext";
import { renderParticleEmitters, disposeParticleRenderResources, getParticleStats } from "../../renderers/primitives/ParticleEmitterGpuRenderer";
import { renderArcBatches } from "../../renderers/primitives/ArcGpuRenderer";
import {
  DEFAULT_RESOURCE_RUN_SUMMARY,
  RESOURCE_RUN_DURATION_BRIDGE_KEY,
  RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
  ResourceRunSummaryPayload,
} from "../../../logic/modules/shared/ResourcesModule";
import {
  DEFAULT_MAP_AUTO_RESTART_STATE,
  MAP_AUTO_RESTART_BRIDGE_KEY,
  MapAutoRestartState,
} from "../../../logic/modules/active-map/MapModule";
import { SceneRunSummaryModal } from "./SceneRunSummaryModal";
import { SceneRunResourcePanel } from "./SceneRunResourcePanel";
import { SceneTooltipContent, SceneTooltipPanel } from "./SceneTooltipPanel";
import {
  SceneTutorialConfig,
  SceneTutorialOverlay,
  SceneTutorialStep,
} from "./SceneTutorialOverlay";

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec4 a_fillInfo;
attribute vec4 a_fillParams0;
attribute vec4 a_fillParams1;
attribute vec3 a_stopOffsets;
attribute vec4 a_stopColor0;
attribute vec4 a_stopColor1;
attribute vec4 a_stopColor2;
uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
varying vec2 v_worldPosition;
varying vec4 v_fillInfo;
varying vec4 v_fillParams0;
varying vec4 v_fillParams1;
varying vec3 v_stopOffsets;
varying vec4 v_stopColor0;
varying vec4 v_stopColor1;
varying vec4 v_stopColor2;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  gl_Position = vec4(toClip(a_position), 0.0, 1.0);
  v_worldPosition = a_position;
  v_fillInfo = a_fillInfo;
  v_fillParams0 = a_fillParams0;
  v_fillParams1 = a_fillParams1;
  v_stopOffsets = a_stopOffsets;
  v_stopColor0 = a_stopColor0;
  v_stopColor1 = a_stopColor1;
  v_stopColor2 = a_stopColor2;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec2 v_worldPosition;
varying vec4 v_fillInfo;
varying vec4 v_fillParams0;
varying vec4 v_fillParams1;
varying vec3 v_stopOffsets;
varying vec4 v_stopColor0;
varying vec4 v_stopColor1;
varying vec4 v_stopColor2;

float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}

vec4 sampleGradient(float t) {
  float stopCount = v_fillInfo.y;
  vec4 color0 = v_stopColor0;
  if (stopCount < 1.5) {
    return color0;
  }

  float offset0 = v_stopOffsets.x;
  float offset1 = v_stopOffsets.y;
  vec4 color1 = v_stopColor1;

  if (stopCount < 2.5) {
    if (t <= offset0) {
      return color0;
    }
    if (t >= offset1) {
      return color1;
    }
    float range = max(offset1 - offset0, 0.0001);
    float factor = clamp((t - offset0) / range, 0.0, 1.0);
    return mix(color0, color1, factor);
  }

  float offset2 = v_stopOffsets.z;
  vec4 color2 = v_stopColor2;

  if (t <= offset0) {
    return color0;
  }
  if (t >= offset2) {
    return color2;
  }
  if (t <= offset1) {
    float range = max(offset1 - offset0, 0.0001);
    float factor = clamp((t - offset0) / range, 0.0, 1.0);
    return mix(color0, color1, factor);
  }

  float range = max(offset2 - offset1, 0.0001);
  float factor = clamp((t - offset1) / range, 0.0, 1.0);
  return mix(color1, color2, factor);
}

void main() {
  float fillType = v_fillInfo.x;
  vec4 color = v_stopColor0;

  if (fillType >= 0.5) {
    float t = 0.0;
    if (fillType < 1.5) {
      vec2 start = v_fillParams0.xy;
      vec2 dir = v_fillParams1.xy;
      float invLenSq = v_fillParams1.z;
      if (invLenSq > 0.0) {
        float projection = dot(v_worldPosition - start, dir) * invLenSq;
        t = clamp01(projection);
      }
    } else if (fillType < 2.5) {
      vec2 center = v_fillParams0.xy;
      float radius = max(v_fillParams0.z, 0.000001);
      float dist = length(v_worldPosition - center);
      t = clamp01(dist / radius);
    } else {
      vec2 center = v_fillParams0.xy;
      float radius = max(v_fillParams0.z, 0.000001);
      vec2 diff = v_worldPosition - center;
      float dist = abs(diff.x) + abs(diff.y);
      t = clamp01(dist / radius);
    }
    color = sampleGradient(t);
  }

  gl_FragColor = color;
}
`;

const AUTO_RESTART_SECONDS = 5;

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

const createProgram = (
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
) => {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown program error";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
};

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const DEFAULT_NECROMANCER_RESOURCES: NecromancerResourcesPayload = Object.freeze({
  mana: { current: 0, max: 0 },
  sanity: { current: 0, max: 0 },
});

const DEFAULT_NECROMANCER_SPAWN_OPTIONS: NecromancerSpawnOption[] = [];

interface SceneScreenProps {
  onExit: () => void;
  onLeaveToMapSelect: () => void;
  tutorial: SceneTutorialConfig | null;
  onTutorialComplete?: () => void;
}

const cameraEquals = (
  a: SceneCameraState,
  b: SceneCameraState | undefined,
  epsilon = 0.01
): boolean => {
  if (a === b) {
    return true;
  }
  if (!b) {
    return false;
  }
  return (
    Math.abs(a.position.x - b.position.x) <= epsilon &&
    Math.abs(a.position.y - b.position.y) <= epsilon &&
    Math.abs(a.scale - b.scale) <= epsilon &&
    Math.abs(a.viewportSize.width - b.viewportSize.width) <= epsilon &&
    Math.abs(a.viewportSize.height - b.viewportSize.height) <= epsilon
  );
};

export const SceneScreen: React.FC<SceneScreenProps> = ({
  onExit,
  onLeaveToMapSelect,
  tutorial,
  onTutorialComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const summoningPanelRef = useRef<HTMLDivElement | null>(null);
  const { app, bridge, scene } = useAppLogic();
  const spellcasting = app.getSpellcasting();
  const mapTimeMs = useBridgeValue<number>(bridge, RESOURCE_RUN_DURATION_BRIDGE_KEY, 0);
  const brickCount = useBridgeValue<number>(bridge, BRICK_COUNT_BRIDGE_KEY, 0);
  const brickTotalHp = useBridgeValue<number>(bridge, BRICK_TOTAL_HP_BRIDGE_KEY, 0);
  const unitCount = useBridgeValue<number>(bridge, PLAYER_UNIT_COUNT_BRIDGE_KEY, 0);
  const unitTotalHp = useBridgeValue<number>(bridge, PLAYER_UNIT_TOTAL_HP_BRIDGE_KEY, 0);
  const necromancerResources = useBridgeValue<NecromancerResourcesPayload>(
    bridge,
    NECROMANCER_RESOURCES_BRIDGE_KEY,
    DEFAULT_NECROMANCER_RESOURCES
  );
  const necromancerOptions = useBridgeValue<NecromancerSpawnOption[]>(
    bridge,
    NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
    DEFAULT_NECROMANCER_SPAWN_OPTIONS
  );
  const spellOptions = useBridgeValue<SpellOption[]>(
    bridge,
    SPELL_OPTIONS_BRIDGE_KEY,
    DEFAULT_SPELL_OPTIONS
  );
  const resourceSummary = useBridgeValue<ResourceRunSummaryPayload>(
    bridge,
    RESOURCE_RUN_SUMMARY_BRIDGE_KEY,
    DEFAULT_RESOURCE_RUN_SUMMARY
  );
  const automationState = useBridgeValue<UnitAutomationBridgeState>(
    bridge,
    UNIT_AUTOMATION_STATE_BRIDGE_KEY,
    DEFAULT_UNIT_AUTOMATION_STATE
  );
  const autoRestartState = useBridgeValue<MapAutoRestartState>(
    bridge,
    MAP_AUTO_RESTART_BRIDGE_KEY,
    DEFAULT_MAP_AUTO_RESTART_STATE
  );
  const [scale, setScale] = useState(() => scene.getCamera().scale);
  const [cameraInfo, setCameraInfo] = useState(() => scene.getCamera());
  const cameraInfoRef = useRef(cameraInfo);
  const scaleRef = useRef(scale);
  const unitCountRef = useRef(0);
  const unitTotalHpRef = useRef(0);
  const brickTotalHpRef2 = useRef(0);
  const necromancerResourcesRef = useRef<NecromancerResourcesPayload>(DEFAULT_NECROMANCER_RESOURCES);
  const necromancerOptionsRef = useRef<NecromancerSpawnOption[]>(DEFAULT_NECROMANCER_SPAWN_OPTIONS);
  const spellOptionsRef = useRef<SpellOption[]>(DEFAULT_SPELL_OPTIONS);
  const automationStateRef = useRef<UnitAutomationBridgeState>(DEFAULT_UNIT_AUTOMATION_STATE);
  const scaleRange = useMemo(() => scene.getScaleRange(), [scene]);
  const brickInitialHpRef = useRef(0);
  const necromancer = useMemo(() => app.getNecromancer(), [app]);
  const unitAutomation = useMemo(() => app.getUnitAutomation(), [app]);
  const showRunSummary = resourceSummary.completed;
  const [hoverContent, setHoverContent] = useState<SceneTooltipContent | null>(null);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [selectedSpellId, setSelectedSpellId] = useState<SpellId | null>(null);
  const selectedSpellIdRef = useRef<SpellId | null>(null);
  const [autoRestartCountdown, setAutoRestartCountdown] = useState(AUTO_RESTART_SECONDS);
  // Threshold state is sourced from bridge (autoRestartState)
  const autoRestartHandledRef = useRef(false);
  const tutorialSteps = useMemo<SceneTutorialStep[]>(() => {
    if (!tutorial) {
      return [];
    }
    switch (tutorial.type) {
      case "new-player": {
        const getResourceElement = (id: string) => {
          if (typeof document === "undefined") {
            return null;
          }
          return document.getElementById(`${id}-resource`);
        };
        return [
          {
            id: "intro",
            title: "The Hunger Awakens",
            description:
              "A gnawing hunger and furious urge coil within you. Devour the matter strewn across this place.",
          },
          {
            id: "summoning-panel",
            title: "Summoning Rituals",
            description:
              "Call forth your ravenous creations from this panel. They will shatter bricks and feast on the debris.",
            getTarget: () => summoningPanelRef.current,
            highlightPadding: 32,
          },
          {
            id: "mana",
            title: "Mana Flows",
            description: "Mana trickles back on its own. Spend it freely to conjure more horrors.",
            getTarget: () => getResourceElement("mana"),
            highlightPadding: 24,
            placement: "top",
          },
          {
            id: "sanity",
            title: "Fading Sanity",
            description: "Sanity never returns. Each summon drags you nearer to the void—use it with intent.",
            getTarget: () => getResourceElement("sanity"),
            highlightPadding: 24,
            placement: "top",
          },
          {
            id: "victory",
            title: "Leave Nothing Behind",
            description:
              "The run ends in triumph when no brick remains. If your sanity breaks and your creatures fall, defeat claims you.",
            getTarget: () => wrapperRef.current,
            highlightPadding: 48,
            placement: "center",
          },
        ];
      }
      default:
        return [];
    }
  }, [tutorial]);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const showTutorial = tutorialSteps.length > 0;

  useEffect(() => {
    setTutorialStepIndex(0);
  }, [tutorial]);

  useEffect(() => {
    if (showRunSummary) {
      setHoverContent(null);
    }
  }, [showRunSummary]);

  useEffect(() => {
    if (showRunSummary) {
      setIsPauseOpen(false);
    }
  }, [showRunSummary]);

  useEffect(() => {
    if (isPauseOpen) {
      setHoverContent(null);
    }
  }, [isPauseOpen]);

  useEffect(() => {
    if (showTutorial) {
      setHoverContent(null);
      setIsPauseOpen(false);
    }
  }, [showTutorial]);

  useEffect(() => {
    if (brickTotalHp > brickInitialHpRef.current) {
      brickInitialHpRef.current = brickTotalHp;
    } else if (brickInitialHpRef.current === 0 && brickTotalHp > 0) {
      brickInitialHpRef.current = brickTotalHp;
    }
  }, [brickTotalHp]);

  useEffect(() => {
    cameraInfoRef.current = cameraInfo;
  }, [cameraInfo]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    unitCountRef.current = unitCount;
  }, [unitCount]);

  useEffect(() => {
    unitTotalHpRef.current = unitTotalHp;
  }, [unitTotalHp]);

  useEffect(() => {
    brickTotalHpRef2.current = brickTotalHp;
  }, [brickTotalHp]);

  useEffect(() => {
    necromancerResourcesRef.current = necromancerResources;
  }, [necromancerResources]);

  useEffect(() => {
    necromancerOptionsRef.current = necromancerOptions;
  }, [necromancerOptions]);

  useEffect(() => {
    spellOptionsRef.current = spellOptions;
  }, [spellOptions]);

  useEffect(() => {
    selectedSpellIdRef.current = selectedSpellId;
  }, [selectedSpellId]);

  useEffect(() => {
    if (!selectedSpellId) {
      return;
    }
    const stillAvailable = spellOptions.some((spell) => spell.id === selectedSpellId);
    if (!stillAvailable) {
      setSelectedSpellId(null);
    }
  }, [selectedSpellId, spellOptions]);

  useEffect(() => {
    if (selectedSpellId) {
      return;
    }
    if (spellOptions.length === 0) {
      return;
    }
    setSelectedSpellId(spellOptions[0]!.id);
  }, [selectedSpellId, spellOptions]);

  useEffect(() => {
    automationStateRef.current = automationState;
  }, [automationState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (showRunSummary) {
        return;
      }
      event.preventDefault();
      setIsPauseOpen((open) => !open);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showRunSummary]);

  useEffect(() => {
    const gameLoop = app.getGameLoop();
    if (isPauseOpen || showTutorial) {
      gameLoop.stop();
      return () => {
        gameLoop.start();
      };
    }
    gameLoop.start();
    return undefined;
  }, [app, isPauseOpen, showTutorial]);

  const handleScaleChange = (nextScale: number) => {
    scene.setScale(nextScale);
    const current = scene.getCamera();
    setScale(current.scale);
    setCameraInfo(current);
  };

  const handleSummonDesign = useCallback(
    (designId: UnitDesignId) => {
      necromancer.trySpawnDesign(designId);
    },
    [necromancer]
  );

  const handleSelectSpell = useCallback((spellId: SpellId) => {
    setSelectedSpellId((current) => (current === spellId ? null : spellId));
  }, []);

  const handleToggleAutomation = useCallback(
    (designId: UnitDesignId, enabled: boolean) => {
      unitAutomation.setAutomationEnabled(designId, enabled);
    },
    [unitAutomation]
  );

  const restartMap = useCallback(() => {
    app.restartCurrentMap();
  }, [app]);

  const handleToggleAutoRestart = useCallback(
    (enabled: boolean) => {
      app.setAutoRestartEnabled(enabled);
    },
    [app]
  );

  const handleUpdateAutoRestartThreshold = useCallback(
    (enabled: boolean, minUnits: number) => {
      app.setAutoRestartThreshold(enabled, minUnits);
    },
    [app]
  );

  const handleRestart = useCallback(() => {
    autoRestartHandledRef.current = true;
    restartMap();
  }, [restartMap]);

  const handleResume = useCallback(() => {
    setIsPauseOpen(false);
  }, []);

  const handleLeaveToCamp = useCallback(() => {
    setIsPauseOpen(false);
    onLeaveToMapSelect();
  }, [onLeaveToMapSelect]);

  const handleTutorialAdvance = useCallback(
    (nextIndex: number) => {
      if (tutorialSteps.length === 0) {
        return;
      }
      const clampedIndex = Math.max(0, Math.min(nextIndex, tutorialSteps.length - 1));
      setTutorialStepIndex(clampedIndex);
    },
    [tutorialSteps.length]
  );

  const handleTutorialClose = useCallback(() => {
    setTutorialStepIndex(0);
    onTutorialComplete?.();
  }, [onTutorialComplete]);

  useEffect(() => {
    if (!showRunSummary) {
      autoRestartHandledRef.current = false;
      setAutoRestartCountdown(AUTO_RESTART_SECONDS);
      return;
    }
    if (!autoRestartState.unlocked) {
      autoRestartHandledRef.current = false;
      setAutoRestartCountdown(AUTO_RESTART_SECONDS);
      return;
    }
    if (!autoRestartState.enabled) {
      autoRestartHandledRef.current = false;
      setAutoRestartCountdown(AUTO_RESTART_SECONDS);
      return;
    }
    autoRestartHandledRef.current = false;
    setAutoRestartCountdown(AUTO_RESTART_SECONDS);
    let remaining = AUTO_RESTART_SECONDS;
    const interval = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(interval);
        setAutoRestartCountdown(0);
        if (!autoRestartHandledRef.current) {
          autoRestartHandledRef.current = true;
          restartMap();
        }
        return;
      }
      setAutoRestartCountdown(remaining);
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [
    autoRestartState.enabled,
    autoRestartState.unlocked,
    restartMap,
    showRunSummary,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const webgl2 = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    const gl =
      (webgl2 as WebGL2RenderingContext | WebGLRenderingContext | null) ??
      canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL is not supported");
      return;
    }

    if (webgl2) {
      setParticleEmitterGlContext(webgl2);
    } else {
      setParticleEmitterGlContext(null);
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const staticBuffer = gl.createBuffer();
    const dynamicBuffer = gl.createBuffer();
    if (!staticBuffer || !dynamicBuffer) {
      throw new Error("Unable to create buffers");
    }

    const objectsRenderer = createObjectsRendererManager();
    objectsRenderer.bootstrap(scene.getObjects());

    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const fillInfoLocation = gl.getAttribLocation(program, "a_fillInfo");
    const fillParams0Location = gl.getAttribLocation(program, "a_fillParams0");
    const fillParams1Location = gl.getAttribLocation(program, "a_fillParams1");
    const stopOffsetsLocation = gl.getAttribLocation(program, "a_stopOffsets");
    const stopColor0Location = gl.getAttribLocation(program, "a_stopColor0");
    const stopColor1Location = gl.getAttribLocation(program, "a_stopColor1");
    const stopColor2Location = gl.getAttribLocation(program, "a_stopColor2");
    const stride = VERTEX_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;

    const attributeLocations = [
      positionLocation,
      fillInfoLocation,
      fillParams0Location,
      fillParams1Location,
      stopOffsetsLocation,
      stopColor0Location,
      stopColor1Location,
      stopColor2Location,
    ];

    if (attributeLocations.some((location) => location < 0)) {
      throw new Error("Unable to resolve vertex attribute locations");
    }

    const attributeConfigs = (() => {
      let offset = 0;
      const configs: Array<{ location: number; size: number; offset: number }> = [];
      const pushConfig = (location: number, size: number) => {
        configs.push({ location, size, offset });
        offset += size * Float32Array.BYTES_PER_ELEMENT;
      };
      pushConfig(positionLocation, POSITION_COMPONENTS);
      pushConfig(fillInfoLocation, FILL_INFO_COMPONENTS);
      pushConfig(fillParams0Location, FILL_PARAMS0_COMPONENTS);
      pushConfig(fillParams1Location, FILL_PARAMS1_COMPONENTS);
      pushConfig(stopOffsetsLocation, STOP_OFFSETS_COMPONENTS);
      pushConfig(stopColor0Location, STOP_COLOR_COMPONENTS);
      pushConfig(stopColor1Location, STOP_COLOR_COMPONENTS);
      pushConfig(stopColor2Location, STOP_COLOR_COMPONENTS);
      return configs;
    })();

    const enableAttributes = (buffer: WebGLBuffer) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      attributeConfigs.forEach(({ location, size, offset }) => {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
      });
    };

    const cameraPositionLocation = gl.getUniformLocation(
      program,
      "u_cameraPosition"
    );
    const viewportSizeLocation = gl.getUniformLocation(
      program,
      "u_viewportSize"
    );

    if (!cameraPositionLocation || !viewportSizeLocation) {
      throw new Error("Unable to resolve camera uniforms");
    }

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let frame = 0;
    let previousTime: number | null = null;

    const pointerState = {
      x: 0,
      y: 0,
      inside: false,
    };

    const applySync = () => {
      const sync = objectsRenderer.consumeSyncInstructions();
      if (sync.staticData) {
        gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sync.staticData, gl.STATIC_DRAW);
      }
      if (sync.dynamicData) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sync.dynamicData, gl.DYNAMIC_DRAW);
      } else if (sync.dynamicUpdates.length > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
        sync.dynamicUpdates.forEach(({ offset, data }) => {
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            offset * Float32Array.BYTES_PER_ELEMENT,
            data
          );
        });
      }
    };

    objectsRenderer.applyChanges(scene.flushChanges());
    applySync();

    const render = (timestamp: number) => {
      if (previousTime === null) {
        previousTime = timestamp;
      }
      const deltaMs = Math.min(timestamp - previousTime, 100);
      previousTime = timestamp;

      applyCameraMovement(pointerState, scene, deltaMs, canvas.width, canvas.height);

      const cameraState = scene.getCamera();
      const changes = scene.flushChanges();
      objectsRenderer.applyChanges(changes);
      applySync();

      // update VBO stats only when changed
      const dbs = objectsRenderer.getDynamicBufferStats();
      if (
        dbs.bytesAllocated !== vboStatsRef.current.bytes ||
        dbs.reallocations !== vboStatsRef.current.reallocs
      ) {
        vboStatsRef.current = { bytes: dbs.bytesAllocated, reallocs: dbs.reallocations };
        setVboStats({ bytes: dbs.bytesAllocated, reallocs: dbs.reallocations });
      }

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(
        cameraPositionLocation,
        cameraState.position.x,
        cameraState.position.y
      );
      gl.uniform2f(
        viewportSizeLocation,
        cameraState.viewportSize.width,
        cameraState.viewportSize.height
      );

      const drawBuffer = (buffer: WebGLBuffer, vertexCount: number) => {
        if (vertexCount <= 0) {
          return;
        }
        enableAttributes(buffer);
        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      };

      drawBuffer(staticBuffer, objectsRenderer.getStaticVertexCount());
      drawBuffer(dynamicBuffer, objectsRenderer.getDynamicVertexCount());
      
      if (webgl2) {
        renderParticleEmitters(
          webgl2,
          cameraState.position,
          cameraState.viewportSize
        );
        renderArcBatches(
          webgl2,
          cameraState.position,
          cameraState.viewportSize
        );
        const ps = getParticleStats(webgl2);
        particleStatsRef.current = ps;
        const now = timestamp;
        if (now - particleStatsLastUpdateRef.current >= 500) {
          particleStatsLastUpdateRef.current = now;
          if (
            ps.active !== particleStatsState.active ||
            ps.capacity !== particleStatsState.capacity ||
            ps.emitters !== particleStatsState.emitters
          ) {
            setParticleStatsState(ps);
          }
        }
      }
      
      if (!cameraEquals(cameraState, cameraInfoRef.current)) {
        setCameraInfo(cameraState);
      }
      if (Math.abs(cameraState.scale - scaleRef.current) > 0.0001) {
        setScale(cameraState.scale);
      }
      frame = window.requestAnimationFrame(render);
    };

    const resize = () => {
      const wrapper = wrapperRef.current ?? canvas.parentElement;
      if (!wrapper) {
        return;
      }
      const targetWidth = Math.max(1, wrapper.clientWidth);
      const targetHeight = Math.max(1, wrapper.clientHeight);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${targetHeight}px`;
      canvas.width = Math.max(1, Math.round(targetWidth * dpr));
      canvas.height = Math.max(1, Math.round(targetHeight * dpr));

      gl.viewport(0, 0, canvas.width, canvas.height);
      scene.setViewportScreenSize(canvas.width, canvas.height);
      const currentMapSize = scene.getMapSize();
      scene.setMapSize({
        width: Math.max(currentMapSize.width, canvas.width, canvas.height, 1000),
        height: Math.max(currentMapSize.height, canvas.width, canvas.height, 1000),
      });
      const current = scene.getCamera();
      setScale(current.scale);
      setCameraInfo(current);
    };

    resize();
    frame = window.requestAnimationFrame(render);
    window.addEventListener("resize", resize);

    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);

    const getWorldPosition = (event: PointerEvent): SceneVector2 | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return null;
      }
      const rawX = (event.clientX - rect.left) / rect.width;
      const rawY = (event.clientY - rect.top) / rect.height;
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
        return null;
      }
      const cameraState = scene.getCamera();
      const normalizedX = clamp(rawX, 0, 1);
      const normalizedY = clamp(rawY, 0, 1);
      return {
        x: cameraState.position.x + normalizedX * cameraState.viewportSize.width,
        y: cameraState.position.y + normalizedY * cameraState.viewportSize.height,
      };
    };

    const getOverlayHeight = () => {
      const panel = summoningPanelRef.current;
      if (!panel) {
        return 0;
      }
      return panel.getBoundingClientRect().height;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        pointerState.inside = false;
        return;
      }

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const clampedX = clamp(x, 0, rect.width);
      const clampedY = clamp(y, 0, rect.height);
      pointerState.x = (clampedX / rect.width) * canvas.width;
      pointerState.y = (clampedY / rect.height) * canvas.height;

      const overlayHeight = getOverlayHeight();
      const insideHorizontal = event.clientX >= rect.left && event.clientX <= rect.right;
      const insideVertical =
        event.clientY >= rect.top && event.clientY <= rect.bottom + overlayHeight;
      pointerState.inside = insideHorizontal && insideVertical;
    };

    const handlePointerLeave = () => {
      pointerState.inside = false;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      const spellId = selectedSpellIdRef.current;
      if (!spellId) {
        return;
      }
      const spell = spellOptionsRef.current.find((option) => option.id === spellId);
      if (!spell || spell.remainingCooldownMs > 0) {
        return;
      }
      const worldPosition = getWorldPosition(event);
      if (!worldPosition) {
        return;
      }
      spellcasting.tryCastSpell(spellId, worldPosition);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("pointerout", handlePointerLeave, { passive: true });
    canvas.addEventListener("pointerdown", handlePointerDown);

    return () => {
      setParticleEmitterGlContext(null);
      if (webgl2) {
        try {
          disposeParticleRenderResources(webgl2);
        } catch {}
      }
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frame);
      gl.deleteBuffer(staticBuffer);
      gl.deleteBuffer(dynamicBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerout", handlePointerLeave);
      canvas.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [scene, spellcasting]);

  const brickInitialHp = brickInitialHpRef.current;
  const [toolbarState, setToolbarState] = useState(() => ({
    brickTotalHp,
    brickInitialHp,
    unitCount,
    unitTotalHp,
    scale,
    cameraPosition: cameraInfo.position,
  }));

  const [summoningProps, setSummoningProps] = useState(() => ({
    resources: necromancerResources,
    spawnOptions: necromancerOptions,
    automation: automationState,
    spells: spellOptions,
  }));

  // Throttle toolbar updates to at most 5 times per second
  useEffect(() => {
    const interval = window.setInterval(() => {
      setToolbarState({
        brickTotalHp: brickTotalHpRef2.current,
        brickInitialHp: brickInitialHpRef.current,
        unitCount: unitCountRef.current,
        unitTotalHp: unitTotalHpRef.current,
        scale: scaleRef.current,
        cameraPosition: { ...cameraInfoRef.current.position },
      });
      setSummoningProps({
        resources: necromancerResourcesRef.current,
        spawnOptions: necromancerOptionsRef.current,
        automation: automationStateRef.current,
        spells: spellOptionsRef.current,
      });
    }, 200);
    return () => window.clearInterval(interval);
  }, []);
  const [vboStats, setVboStats] = useState<{ bytes: number; reallocs: number }>({ bytes: 0, reallocs: 0 });
  const vboStatsRef = useRef<{ bytes: number; reallocs: number }>({ bytes: 0, reallocs: 0 });
  const [particleStatsState, setParticleStatsState] = useState<{ active: number; capacity: number; emitters: number }>({ active: 0, capacity: 0, emitters: 0 });
  const particleStatsRef = useRef<{ active: number; capacity: number; emitters: number }>({ active: 0, capacity: 0, emitters: 0 });
  const particleStatsLastUpdateRef = useRef(0);

  return (
    <div className="scene-screen">
      <SceneToolbar
        onExit={onExit}
        brickTotalHp={toolbarState.brickTotalHp}
        brickInitialHp={toolbarState.brickInitialHp}
        unitCount={toolbarState.unitCount}
        unitTotalHp={toolbarState.unitTotalHp}
        scale={toolbarState.scale}
        scaleRange={scaleRange}
        onScaleChange={handleScaleChange}
        cameraPosition={toolbarState.cameraPosition}
      />
      <SceneRunResourcePanel resources={resourceSummary.resources} />
      <SceneTooltipPanel content={hoverContent} />
      <SceneDebugPanel
        timeMs={mapTimeMs}
        brickCount={brickCount}
        dynamicBytes={vboStats.bytes}
        dynamicReallocs={vboStats.reallocs}
        particleActive={particleStatsState.active}
        particleCapacity={particleStatsState.capacity}
        particleEmitters={particleStatsState.emitters}
      />
      <SceneSummoningPanel
        ref={summoningPanelRef}
        resources={summoningProps.resources}
        spawnOptions={summoningProps.spawnOptions}
        spells={summoningProps.spells}
        selectedSpellId={selectedSpellId}
        onSelectSpell={handleSelectSpell}
        onSummon={handleSummonDesign}
        onHoverInfoChange={setHoverContent}
        automation={summoningProps.automation}
        onToggleAutomation={handleToggleAutomation}
      />
      <div className="scene-canvas-wrapper" ref={wrapperRef}>
        <canvas ref={canvasRef} width={512} height={512} className="scene-canvas" />
      </div>
      {showRunSummary && (
        <SceneRunSummaryModal
          resources={resourceSummary.resources}
          bricksDestroyed={resourceSummary.bricksDestroyed}
          totalBricksDestroyed={resourceSummary.totalBricksDestroyed}
          primaryAction={{ label: "Return to Void Lab", onClick: onLeaveToMapSelect }}
          secondaryAction={{ label: "Restart Map", onClick: handleRestart }}
          autoRestart={
            autoRestartState.unlocked
              ? {
                  enabled: autoRestartState.enabled,
                  countdown: autoRestartCountdown,
                  onToggle: handleToggleAutoRestart,
                  thresholdEnabled: autoRestartState.thresholdEnabled ?? false,
                  minEffectiveUnits: autoRestartState.minEffectiveUnits ?? 3,
                  onUpdateThreshold: handleUpdateAutoRestartThreshold,
                }
              : undefined
          }
        />
      )}
      {isPauseOpen && !showRunSummary && (
        <SceneRunSummaryModal
          title="Run Paused"
          subtitle="Resources recovered so far:"
          resources={resourceSummary.resources}
          bricksDestroyed={resourceSummary.bricksDestroyed}
          totalBricksDestroyed={resourceSummary.totalBricksDestroyed}
          primaryAction={{ label: "Continue", onClick: handleResume }}
          secondaryAction={{ label: "Return to Void Lab", onClick: handleLeaveToCamp }}
        />
      )}
      {showTutorial && (
        <SceneTutorialOverlay
          steps={tutorialSteps}
          activeIndex={tutorialStepIndex}
          onAdvance={handleTutorialAdvance}
          onClose={handleTutorialClose}
        />
      )}
    </div>
  );
};

const EDGE_THRESHOLD = 48;
const CAMERA_SPEED = 400; // world units per second

interface PointerState {
  x: number;
  y: number;
  inside: boolean;
}

const applyCameraMovement = (
  pointer: PointerState,
  scene: SceneObjectManager,
  deltaMs: number,
  canvasWidthPx: number,
  canvasHeightPx: number
) => {
  if (!pointer.inside || deltaMs <= 0) {
    return;
  }
  const deltaSeconds = deltaMs / 1000;
  let moveX = 0;
  let moveY = 0;

  if (pointer.x < EDGE_THRESHOLD) {
    moveX -= CAMERA_SPEED * deltaSeconds;
  } else if (pointer.x > canvasWidthPx - EDGE_THRESHOLD) {
    moveX += CAMERA_SPEED * deltaSeconds;
  }

  if (pointer.y < EDGE_THRESHOLD) {
    moveY -= CAMERA_SPEED * deltaSeconds;
  } else if (pointer.y > canvasHeightPx - EDGE_THRESHOLD) {
    moveY += CAMERA_SPEED * deltaSeconds;
  }

  if (moveX !== 0 || moveY !== 0) {
    scene.panCamera(moveX, moveY);
  }
};
