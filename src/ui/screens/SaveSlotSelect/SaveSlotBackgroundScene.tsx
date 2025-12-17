import { useEffect, useRef } from "react";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneSolidFill,
  SceneLinearGradientFill,
  SceneRadialGradientFill,
  SceneDiamondGradientFill,
  SceneFillNoise,
  SceneGradientStop,
  SceneObjectManager,
  SceneSize,
  SceneStroke,
  SceneVector2,
} from "@logic/services/SceneObjectManager";
import { BrickType, getBrickConfig } from "@db/bricks-db";
import {
  getPlayerUnitConfig,
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
  PlayerUnitRendererStrokeConfig,
  PlayerUnitAuraConfig,
  PlayerUnitEmitterConfig,
} from "@db/player-units-db";
import {
  createObjectsRendererManager,
  POSITION_COMPONENTS,
  VERTEX_COMPONENTS,
  FILL_INFO_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  FILL_FILAMENTS0_COMPONENTS,
  FILL_FILAMENTS1_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
  STOP_COLOR_COMPONENTS,
} from "@ui/renderers/objects";
import { setSceneTimelineTimeMs } from "@ui/renderers/primitives/utils/sceneTimeline";
import {
  petalAuraEffect,
  clearPetalAuraInstances,
  disposePetalAuraResources,
} from "@ui/renderers/primitives/gpu/PetalAuraGpuRenderer";
import { updateAllWhirlInterpolations } from "@ui/renderers/objects/SandStormRenderer";
import {
  renderParticleEmitters,
  disposeParticleRenderResources,
} from "@ui/renderers/primitives/gpu/ParticleEmitterGpuRenderer";
import { renderArcBatches, resetAllArcBatches } from "@ui/renderers/primitives/gpu/ArcGpuRenderer";
import { renderFireRings, disposeFireRing } from "@ui/renderers/primitives/gpu/FireRingGpuRenderer";
import {
  setParticleEmitterGlContext,
  getParticleEmitterGlContext,
} from "@ui/renderers/primitives/utils/gpuContext";
import { clearAllAuraSlots } from "@ui/renderers/objects/PlayerUnitObjectRenderer";
import { whirlEffect, disposeWhirlResources } from "@ui/renderers/primitives/gpu/WhirlGpuRenderer";
import type { UnitModuleId } from "@db/unit-modules-db";

const MAP_SIZE: SceneSize = { width: 2400, height: 1650 };
const LETTER_HORIZONTAL_GAP = 1;
const LETTER_VERTICAL_GAP = 1;
const LETTER_SPACING = 36;
const WORD_SPACING = 0;
const LINE_SPACING = 420;
const TITLE_LINES = ["VOID", "EATERS"] as const;
const DEFAULT_BRICK_TYPE: BrickType = "smallSquareGray";

// Adjust brick types per letter to quickly experiment with the title palette.
const LETTER_BRICK_TYPES: Partial<Record<string, BrickType>> = {
  V: "darkMatterBrick",
  O: "darkMatterBrick",
  I: "darkMatterBrick",
  D: "darkMatterBrick",
  E: "neutronBrick",
  A: "neutronBrick",
  T: "neutronBrick",
  R: "neutronBrick",
  S: "neutronBrick",
};

const CREATURE_ORBIT_VERTICAL_SQUASH = 0.85;
const CREATURE_BOB_AMPLITUDE = 8;
const CREATURE_BOB_SPEED = 0.0005;
const CONTENT_PADDING = 140;

type LetterPattern = readonly string[];

const LETTER_PATTERNS: Record<string, LetterPattern> = {
  V: [
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    " # # ",
    " # # ",
    "  #  ",
  ],
  O: [
    " ### ",
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    " ### ",
  ],
  I: [
    "#####",
    "  #  ",
    "  #  ",
    "  #  ",
    "  #  ",
    "  #  ",
    "#####",
  ],
  D: [
    "#### ",
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    "#### ",
  ],
  E: [
    "#####",
    "#    ",
    "#    ",
    "#### ",
    "#    ",
    "#    ",
    "#####",
  ],
  A: [
    " ### ",
    "#   #",
    "#   #",
    "#####",
    "#   #",
    "#   #",
    "#   #",
  ],
  T: [
    "#######",
    "   #  ",
    "   #  ",
    "   #  ",
    "   #  ",
    "   #  ",
    "   #  ",
  ],
  R: [
    "#### ",
    "#   #",
    "#   #",
    "#### ",
    "# #  ",
    "#  # ",
    "#   #",
  ],
  S: [
    " ####",
    "#    ",
    "#    ",
    " ### ",
    "    #",
    "    #",
    "#### ",
  ],
};

interface LetterMetric {
  brickType: BrickType;
  layout: LetterPattern;
  config: ReturnType<typeof getBrickConfig>;
  width: number;
  height: number;
}

interface WordMetric {
  letters: LetterMetric[];
  width: number;
  height: number;
}

interface LineMetric {
  words: WordMetric[];
  width: number;
  height: number;
}

interface TitleLayoutResult {
  bricks: Array<{
    position: SceneVector2;
    size: SceneSize;
    fill: SceneFill;
    stroke?: SceneStroke;
  }>;
  bounds: { x: number; y: number; width: number; height: number };
  wordRanges: Array<{ startX: number; endX: number; startY: number; endY: number; centerY: number }>;
}

const createBrickFill = (config: ReturnType<typeof getBrickConfig>): SceneFill => {
  const fill = config.fill;
  switch (fill.type) {
    case "solid":
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
        ...(fill.noise ? { noise: cloneNoise(fill.noise) } : {}),
      };
    case "radial":
      return {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: fill.center ? { ...fill.center } : undefined,
        end: fill.radius,
        stops: cloneStops(fill.stops),
        ...(fill.noise ? { noise: cloneNoise(fill.noise) } : {}),
      };
    case "linear":
    default:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: cloneStops(fill.stops),
        ...(fill.noise ? { noise: cloneNoise(fill.noise) } : {}),
      };
  }
};

const cloneNoise = (noise: SceneFillNoise | undefined): SceneFillNoise | undefined =>
  noise ? { ...noise } : undefined;

const cloneStops = (stops: readonly SceneGradientStop[]): SceneGradientStop[] =>
  stops.map((stop) => ({ offset: stop.offset, color: { ...stop.color } }));

const getLetterMetric = (letter: string): LetterMetric | null => {
  const layout = LETTER_PATTERNS[letter];
  if (!layout) {
    return null;
  }
  const brickType = LETTER_BRICK_TYPES[letter] ?? DEFAULT_BRICK_TYPE;
  const config = getBrickConfig(brickType);
  const columns = layout[0]?.length ?? 0;
  const rows = layout.length;
  const width =
    columns * config.size.width + Math.max(0, columns - 1) * LETTER_HORIZONTAL_GAP;
  const height =
    rows * config.size.height + Math.max(0, rows - 1) * LETTER_VERTICAL_GAP;
  return { brickType, layout, config, width, height };
};

const computeTitleLayout = (
  lines: readonly string[],
  mapWidth: number,
  mapHeight: number
): TitleLayoutResult => {
  const sanitizedLines = lines
    .map((line) =>
      line
        .toUpperCase()
        .split(/\s+/)
        .filter((word) => word.length > 0)
    )
    .filter((words) => words.length > 0);

  const lineMetrics: LineMetric[] = sanitizedLines.map((words) => {
    const wordMetrics = words.map((word) => {
      const entries = word
        .split("")
        .map((letter) => getLetterMetric(letter))
        .filter((metric): metric is LetterMetric => metric !== null);
      const width = entries.reduce((acc, metric, index) => {
        const spacing = index < entries.length - 1 ? LETTER_SPACING : 0;
        return acc + metric.width + spacing;
      }, 0);
      const height = entries.reduce(
        (max, metric) => Math.max(max, metric.height),
        0
      );
      return { letters: entries, width, height };
    });

    const width = wordMetrics.reduce((acc, metric, index) => {
      const spacing = index < wordMetrics.length - 1 ? WORD_SPACING : 0;
      return acc + metric.width + spacing;
    }, 0);
    const height = wordMetrics.reduce(
      (max, metric) => Math.max(max, metric.height),
      0
    );

    return { words: wordMetrics, width, height };
  });

  console.log('lineMetrics: ', lineMetrics);
  const totalHeight = lineMetrics.reduce((acc, metric, index) => {
    const spacing = index > 0 ? LINE_SPACING : 0;
    return acc + metric.height + spacing;
  }, 0);

  const maxWidth = lineMetrics.reduce(
    (max, metric) => Math.max(max, metric.width),
    0
  );

  const wW = window.innerWidth;
  const aR = wW / mapWidth;
  const boundsX = (mapWidth) - maxWidth - 50;
  const startX = Math.max(600, boundsX);
  const startY = mapHeight / 2 - totalHeight / 2;

  const bricks: TitleLayoutResult["bricks"] = [];
  const wordRanges: TitleLayoutResult["wordRanges"] = [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  let cursorY = startY;


  lineMetrics.forEach((lineMetric, lineIndex) => {
    const lineCenterY = cursorY + lineMetric.height / 2;
    let cursorX = startX;

    lineMetric.words.forEach((wordMetric, wordIndex) => {
      const wordTop = lineCenterY - wordMetric.height / 2;
      const wordStartX = cursorX;
      const wordEndX = cursorX + wordMetric.width;
      const wordStartY = wordTop;
      const wordEndY = wordTop + wordMetric.height;
      wordRanges.push({
        startX: wordStartX,
        endX: wordEndX,
        startY: wordStartY,
        endY: wordEndY,
        centerY: lineCenterY,
      });

      wordMetric.letters.forEach((letterMetric, letterIndex) => {
        const columns = letterMetric.layout[0]?.length ?? 0;
        const rows = letterMetric.layout.length;
        const tileWidth =
          letterMetric.config.size.width + LETTER_HORIZONTAL_GAP;
        const tileHeight =
          letterMetric.config.size.height + LETTER_VERTICAL_GAP;
        const betweenSizing = 140;
        const stroke = letterMetric.config.stroke
          ? {
              color: { ...letterMetric.config.stroke.color },
              width: letterMetric.config.stroke.width,
            }
          : undefined;

        for (let row = 0; row < rows; row += 1) {
          const patternRow = letterMetric.layout[row] ?? "";
          for (let col = 0; col < columns; col += 1) {
            if (patternRow[col] !== "#") {
              continue;
            }
            const centerX =
              cursorX +
              col * tileWidth +
              letterMetric.config.size.width / 2;
            const centerY =
              wordTop +
              row * tileHeight +
              letterMetric.config.size.height / 2;
            bricks.push({
              position: { x: centerX, y: centerY },
              size: { ...letterMetric.config.size },
              fill: createBrickFill(letterMetric.config),
              stroke,
            });
            minX = Math.min(
              minX,
              centerX - letterMetric.config.size.width / 2
            );
            minY = Math.min(
              minY,
              centerY - letterMetric.config.size.height / 2
            );
            maxX = Math.max(
              maxX,
              centerX + letterMetric.config.size.width / 2
            );
            maxY = Math.max(
              maxY,
              centerY + letterMetric.config.size.height / 2
            );
          }
        }

        cursorX += letterMetric.width;
        if (letterIndex < wordMetric.letters.length - 1) {
          cursorX += LETTER_SPACING;
        }
      });

      if (wordIndex < lineMetric.words.length - 1) {
        cursorX += WORD_SPACING;
      }
    });

    cursorY += lineMetric.height;
    if (lineIndex < lineMetrics.length - 1) {
      cursorY += LINE_SPACING;
    }
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    const fallbackWidth = Math.max(maxWidth, 0);
    const fallbackHeight = Math.max(totalHeight, 0);
    minX = startX;
    minY = startY;
    maxX = startX + fallbackWidth;
    maxY = startY + fallbackHeight;
  }

  return {
    bricks,
    bounds: {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    },
    wordRanges,
  };
};

interface CreatureConfig {
  modules: UnitModuleId[];
  orbitCenter: SceneVector2;
  orbitRadius: number;
  orbitSpeed: number;
  phase: number;
}

interface CreatureState extends CreatureConfig {
  objectId: string;
  previousPosition: SceneVector2;
}

const cloneColor = (color: SceneColor | undefined): SceneColor | undefined => {
  if (!color) {
    return undefined;
  }
  const clone: SceneColor = {
    r: color.r,
    g: color.g,
    b: color.b,
  };
  if (typeof color.a === "number" && Number.isFinite(color.a)) {
    clone.a = color.a;
  }
  return clone;
};

const deriveRendererStroke = (
  renderer: PlayerUnitRendererConfig
): SceneStroke | undefined => {
  if (renderer.stroke) {
    return {
      color: cloneColor(renderer.stroke.color) ?? renderer.stroke.color,
      width: renderer.stroke.width,
    };
  }

  for (const layer of renderer.layers) {
    const layerStroke = (layer as any)?.stroke as
      | { type?: string; color?: SceneColor; width?: number }
      | undefined;
    if (layerStroke?.type === "solid" && layerStroke.color) {
      const width =
        typeof layerStroke.width === "number" && Number.isFinite(layerStroke.width)
          ? layerStroke.width
          : 2;
      return {
        color: cloneColor(layerStroke.color) ?? layerStroke.color,
        width,
      };
    }
  }

  return undefined;
};

const computeSceneContentBounds = (
  titleBounds: TitleLayoutResult["bounds"],
  creatures: readonly CreatureConfig[],
  paddingX: number,
  paddingY: number
): TitleLayoutResult["bounds"] => {
  let minX = titleBounds.x;
  let minY = titleBounds.y;
  let maxX = titleBounds.x + titleBounds.width;
  let maxY = titleBounds.y + titleBounds.height;

  creatures.forEach((creature) => {
    const horizontalRadius = creature.orbitRadius;
    const verticalRadius =
      creature.orbitRadius * CREATURE_ORBIT_VERTICAL_SQUASH + CREATURE_BOB_AMPLITUDE;
    minX = Math.min(minX, creature.orbitCenter.x - horizontalRadius);
    maxX = Math.max(maxX, creature.orbitCenter.x + horizontalRadius);
    minY = Math.min(minY, creature.orbitCenter.y - verticalRadius);
    maxY = Math.max(maxY, creature.orbitCenter.y + verticalRadius);
  });

  const paddedWidth = Math.max(0, maxX - minX + paddingX * 2);
  const paddedHeight = Math.max(0, maxY - minY + paddingY * 2);

  return {
    x: minX - paddingX,
    y: minY - paddingY,
    width: paddedWidth,
    height: paddedHeight,
  };
};

const PLAYER_UNIT_CONFIG = getPlayerUnitConfig("bluePentagon");
const PLAYER_UNIT_BASE_STROKE = deriveRendererStroke(PLAYER_UNIT_CONFIG.renderer);

const cloneSceneColor = (color: SceneColor | undefined): SceneColor | undefined => {
  if (!color) {
    return undefined;
  }
  const cloned: SceneColor = {
    r: color.r,
    g: color.g,
    b: color.b,
  };
  if (typeof color.a === "number" && Number.isFinite(color.a)) {
    cloned.a = color.a;
  }
  return cloned;
};

const cloneEmitterConfig = (
  emitter: PlayerUnitEmitterConfig | undefined
): PlayerUnitEmitterConfig | undefined => {
  if (!emitter) {
    return undefined;
  }

  return {
    particlesPerSecond: emitter.particlesPerSecond,
    particleLifetimeMs: emitter.particleLifetimeMs,
    fadeStartMs: emitter.fadeStartMs,
    baseSpeed: emitter.baseSpeed,
    speedVariation: emitter.speedVariation,
    sizeRange: { min: emitter.sizeRange.min, max: emitter.sizeRange.max },
    spread: emitter.spread,
    offset: { x: emitter.offset.x, y: emitter.offset.y },
    color: cloneSceneColor(emitter.color) ?? { ...emitter.color },
    fill: emitter.fill ? cloneSceneFillDeep(emitter.fill) : undefined,
    shape: emitter.shape,
    maxParticles: emitter.maxParticles,
  };
};

const cloneSceneFillDeep = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID: {
      const solid: SceneSolidFill = {
        fillType: FILL_TYPES.SOLID,
        color: cloneSceneColor(fill.color) ?? fill.color,
      };
      if (fill.noise) {
        solid.noise = { ...fill.noise };
      }
      return solid;
    }
    case FILL_TYPES.LINEAR_GRADIENT: {
      const linear: SceneLinearGradientFill = {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: cloneSceneColor(stop.color) ?? stop.color,
        })),
      };
      if (fill.noise) {
        linear.noise = { ...fill.noise };
      }
      return linear;
    }
    case FILL_TYPES.RADIAL_GRADIENT: {
      const radial: SceneRadialGradientFill = {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: typeof fill.end === "number" ? fill.end : 0,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: cloneSceneColor(stop.color) ?? stop.color,
        })),
      };
      if (fill.noise) {
        radial.noise = { ...fill.noise };
      }
      return radial;
    }
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const diamond: SceneDiamondGradientFill = {
        fillType: FILL_TYPES.DIAMOND_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: typeof fill.end === "number" ? fill.end : 0,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: cloneSceneColor(stop.color) ?? stop.color,
        })),
      };
      if (fill.noise) {
        diamond.noise = { ...fill.noise };
      }
      return diamond;
    }
    default:
      return fill;
  }
};

const cloneRendererStrokeConfig = (
  stroke: PlayerUnitRendererStrokeConfig | undefined
): PlayerUnitRendererStrokeConfig | undefined => {
  if (!stroke) {
    return undefined;
  }
  if (stroke.type === "solid") {
    return {
      type: "solid",
      width: stroke.width,
      color: cloneSceneColor(stroke.color) ?? stroke.color,
    };
  }
  return {
    type: "base",
    width: stroke.width,
    brightness: stroke.brightness,
    alphaMultiplier: stroke.alphaMultiplier,
  };
};

const cloneRendererFillConfig = (
  fill: PlayerUnitRendererLayerConfig["fill"] | undefined
): PlayerUnitRendererLayerConfig["fill"] | undefined => {
  if (!fill) {
    return undefined;
  }
  if (fill.type === "solid") {
    return {
      type: "solid",
      color: cloneSceneColor(fill.color) ?? fill.color,
      ...(fill.noise ? { noise: { ...fill.noise } } : {}),
    };
  }
  if (fill.type === "gradient") {
    const gradient = fill.fill;
    if (gradient.fillType === FILL_TYPES.SOLID) {
      return {
        type: "gradient",
        fill: {
          fillType: gradient.fillType,
          color: cloneSceneColor(gradient.color) ?? gradient.color,
          ...(gradient.noise ? { noise: { ...gradient.noise } } : {}),
        },
      };
    }
    if (gradient.fillType === FILL_TYPES.LINEAR_GRADIENT) {
      return {
        type: "gradient",
        fill: {
          fillType: gradient.fillType,
          start: gradient.start ? { ...gradient.start } : undefined,
          end: gradient.end ? { ...gradient.end } : undefined,
          stops: gradient.stops.map((stop) => ({
            offset: stop.offset,
            color: cloneSceneColor(stop.color) ?? stop.color,
          })),
          ...(gradient.noise ? { noise: { ...gradient.noise } } : {}),
        },
      };
    }
    if (
      gradient.fillType === FILL_TYPES.RADIAL_GRADIENT ||
      gradient.fillType === FILL_TYPES.DIAMOND_GRADIENT
    ) {
      return {
        type: "gradient",
        fill: {
          fillType: gradient.fillType,
          start: gradient.start ? { ...gradient.start } : undefined,
          end: typeof gradient.end === "number" ? gradient.end : undefined,
          stops: gradient.stops.map((stop) => ({
            offset: stop.offset,
            color: cloneSceneColor(stop.color) ?? stop.color,
          })),
          ...(gradient.noise ? { noise: { ...gradient.noise } } : {}),
        },
      };
    }
    return {
      type: "gradient",
      fill: cloneSceneFillDeep(gradient),
    };
  }
  return {
    type: "base",
    brightness: fill.brightness,
    alphaMultiplier: fill.alphaMultiplier,
  };
};

const cloneRendererLayer = (
  layer: PlayerUnitRendererLayerConfig
): PlayerUnitRendererLayerConfig => {
  if (layer.shape === "polygon") {
    return {
      shape: "polygon",
      vertices: layer.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
      offset: layer.offset ? { ...layer.offset } : undefined,
      fill: cloneRendererFillConfig(layer.fill),
      stroke: cloneRendererStrokeConfig(layer.stroke),
      requiresModule: (layer as any).requiresModule,
      requiresSkill: (layer as any).requiresSkill,
      requiresEffect: (layer as any).requiresEffect,
      anim: (layer as any).anim,
      spine: (layer as any).spine,
      segmentIndex: (layer as any).segmentIndex,
      buildOpts: (layer as any).buildOpts,
      groupId: (layer as any).groupId,
    };
  }
  return {
    shape: "circle",
    radius: layer.radius,
    segments: layer.segments,
    offset: layer.offset ? { ...layer.offset } : undefined,
    fill: cloneRendererFillConfig(layer.fill),
    stroke: cloneRendererStrokeConfig(layer.stroke),
    requiresModule: (layer as any).requiresModule,
    requiresSkill: (layer as any).requiresSkill,
    requiresEffect: (layer as any).requiresEffect,
    anim: (layer as any).anim,
    groupId: (layer as any).groupId,
  };
};

const cloneAuraConfig = (
  aura: PlayerUnitAuraConfig
): PlayerUnitAuraConfig => ({
  petalCount: aura.petalCount,
  innerRadius: aura.innerRadius,
  outerRadius: aura.outerRadius,
  petalWidth: aura.petalWidth,
  rotationSpeed: aura.rotationSpeed,
  color: cloneSceneColor(aura.color) ?? aura.color,
  alpha: aura.alpha,
  requiresModule: aura.requiresModule,
  pointInward: aura.pointInward,
});

const cloneRendererConfigForScene = (
  renderer: PlayerUnitRendererConfig
): PlayerUnitRendererConfig => {
  const strokeSource = renderer.stroke ?? deriveRendererStroke(renderer);
  const stroke = strokeSource
    ? {
        color: cloneSceneColor(strokeSource.color) ?? strokeSource.color,
        width: strokeSource.width,
      }
    : undefined;

  return {
    kind: renderer.kind,
    fill: cloneSceneColor(renderer.fill) ?? { ...renderer.fill },
    stroke,
    layers: renderer.layers.map((layer) => cloneRendererLayer(layer)),
    auras: renderer.auras ? renderer.auras.map((aura) => cloneAuraConfig(aura)) : undefined,
  };
};

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Failed to compile shader: ${info ?? "unknown"}`);
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
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Failed to link program: ${info ?? "unknown"}`);
  }
  return program;
};

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec4 a_fillInfo;
attribute vec4 a_fillParams0;
attribute vec4 a_fillParams1;
attribute vec4 a_filaments0;
attribute float a_filamentEdgeBlur;
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
varying vec4 v_filaments0;
varying float v_filamentEdgeBlur;
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
  v_filaments0 = a_filaments0;
  v_filamentEdgeBlur = a_filamentEdgeBlur;
  v_stopOffsets = a_stopOffsets;
  v_stopColor0 = a_stopColor0;
  v_stopColor1 = a_stopColor1;
  v_stopColor2 = a_stopColor2;
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_worldPosition;
varying vec4 v_fillInfo;
varying vec4 v_fillParams0;
varying vec4 v_fillParams1;
varying vec4 v_filaments0;
varying float v_filamentEdgeBlur;
varying vec3 v_stopOffsets;
varying vec4 v_stopColor0;
varying vec4 v_stopColor1;
varying vec4 v_stopColor2;

float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  float ab = mix(a, b, u.x);
  float cd = mix(c, d, u.x);
  return mix(ab, cd, u.y);
}

vec2 resolveNoiseAnchor(float fillType) {
  if (fillType < 3.5) {
    return v_fillParams0.xy;
  }
  return v_worldPosition;
}

vec4 applyFillNoise(vec4 color) {
  float colorAmp = v_fillInfo.z;
  float alphaAmp = v_fillInfo.w;
  if (colorAmp <= 0.0 && alphaAmp <= 0.0) {
    return color;
  }
  float scale = v_fillParams1.w;
  float effectiveScale = scale > 0.0 ? scale : 1.0;
  float fillType = v_fillInfo.x;
  vec2 anchor = resolveNoiseAnchor(fillType);
  float noiseValue = noise2d((v_worldPosition - anchor) * effectiveScale) * 2.0 - 1.0;
  if (colorAmp > 0.0) {
    color.rgb = clamp(color.rgb + noiseValue * colorAmp, 0.0, 1.0);
  }
  if (alphaAmp > 0.0) {
    color.a = clamp(color.a + noiseValue * alphaAmp, 0.0, 1.0);
  }
  return color;
}

float ridgeNoise(vec2 p) {
  // Ridge noise creates vein-like structures
  return 1.0 - abs(noise2d(p) * 2.0 - 1.0);
}

float filamentNoise(vec2 p, float density) {
  float scale = density * 0.03;
  vec2 sp = p * scale;
  
  // Domain warping - warp coordinates with noise for organic flow
  vec2 warp = vec2(
    noise2d(sp + vec2(0.0, 0.0)),
    noise2d(sp + vec2(5.2, 1.3))
  );
  vec2 warped = sp + warp * 0.5;
  
  // Layered ridge noise for filament structure
  float n = 0.0;
  n += ridgeNoise(warped * 1.0) * 0.6;
  n += ridgeNoise(warped * 2.0) * 0.3;
  n += ridgeNoise(warped * 4.0) * 0.1;
  
  return n;
}

vec4 applyFillFilaments(vec4 color) {
  float colorContrast = v_filaments0.x;
  float alphaContrast = v_filaments0.y;
  float width = clamp01(v_filaments0.z);
  float density = v_filaments0.w;
  float edgeBlur = clamp01(v_filamentEdgeBlur);

  if ((colorContrast <= 0.0 && alphaContrast <= 0.0) || density <= 0.0) {
    return color;
  }

  vec2 anchor = resolveNoiseAnchor(v_fillInfo.x);
  vec2 pos = v_worldPosition - anchor;
  
  // Get filament pattern
  float n = filamentNoise(pos, density);
  
  // width controls how much of the filament is visible
  // Higher width = thicker filaments
  float threshold = 1.0 - width;
  float edge = threshold - edgeBlur * 0.3;
  
  // Create filament with smooth edges
  float filament = smoothstep(edge, threshold, n);
  
  // Convert to signed value
  float signed = (filament - 0.5) * 2.0;

  if (colorContrast > 0.0) {
    color.rgb = clamp(color.rgb + signed * colorContrast, 0.0, 1.0);
  }
  if (alphaContrast > 0.0) {
    color.a = clamp(color.a + signed * alphaContrast, 0.0, 1.0);
  }

  return color;
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
        t = clamp01(dot(v_worldPosition - start, dir) * invLenSq);
      }
    } else if (fillType < 2.5) {
      vec2 center = v_fillParams0.xy;
      float radius = v_fillParams0.z;
      if (radius > 0.0) {
        float dist = distance(v_worldPosition, center);
        t = clamp01(dist / radius);
      }
    } else {
      vec2 center = v_fillParams0.xy;
      float radius = v_fillParams0.z;
      if (radius > 0.0) {
        float dist = abs(v_worldPosition.x - center.x) + abs(v_worldPosition.y - center.y);
        t = clamp01(dist / radius);
      }
    }
    color = sampleGradient(t);
  }

  gl_FragColor = applyFillNoise(applyFillFilaments(color));
}
`;

const centerCameraOnBounds = (
  scene: SceneObjectManager,
  bounds: { x: number; y: number; width: number; height: number }
) => {
  const camera = scene.getCamera();
  const mapSize = scene.getMapSize();
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const targetX = centerX - camera.viewportSize.width / 2;
  const targetY = centerY - camera.viewportSize.height / 2;
  const maxX = Math.max(0, mapSize.width - camera.viewportSize.width);
  const maxY = Math.max(0, mapSize.height - camera.viewportSize.height);
  const clampedX = Math.min(Math.max(targetX, 0), maxX);
  const clampedY = Math.min(Math.max(targetY, 0), maxY);
  scene.setCameraPosition(clampedX, clampedY);
};

const createCreatures = (
  scene: SceneObjectManager,
  titleLayout: TitleLayoutResult
): CreatureState[] => {
  const titleBounds = titleLayout.bounds;
  const baseY = titleBounds.y + titleBounds.height + 120;
  const centerX = titleBounds.x + titleBounds.width / 2;
  const firstWordRange = titleLayout.wordRanges[0];
  const creatures: CreatureConfig[] = [
    {
      modules: ["perforator", "vitalHull", "burningTail"],
      orbitCenter: { x: (firstWordRange?.startX ?? 0) + 140, y: (firstWordRange?.endY ?? 0) + 110 },
      orbitRadius: 95,
      orbitSpeed: 0.00045,
      phase: 0,
    },
    {
      modules: ["mendingGland", "magnet"],
      orbitCenter: { x: centerX + 240, y: baseY - 30 },
      orbitRadius: 80,
      orbitSpeed: -0.00052,
      phase: 1.4,
    },
    {
      modules: [],
      orbitCenter: { x: (firstWordRange?.endX ?? 0) + 160, y: (firstWordRange?.centerY ?? 120) },
      orbitRadius: 70,
      orbitSpeed: 0.00062,
      phase: 2.3,
    },
    {
      modules: [],
      orbitCenter: { x: centerX - 180, y: baseY + 85 },
      orbitRadius: 60,
      orbitSpeed: -0.00058,
      phase: 3.7,
    },
    {
      modules: ["ironForge", "frenzyGland", "freezingTail"],
      orbitCenter: { x: 210, y: 150 },
      orbitRadius: 95,
      orbitSpeed: 0.00045,
      phase: 0,
    },
  ];

  return creatures.map((config) => {
    const angle = config.phase;
    const initialPosition: SceneVector2 = {
      x: config.orbitCenter.x + Math.cos(angle) * config.orbitRadius,
      y: config.orbitCenter.y + Math.sin(angle) * config.orbitRadius,
    };
    const renderer = cloneRendererConfigForScene(PLAYER_UNIT_CONFIG.renderer);
    const baseFillColor = cloneSceneColor(PLAYER_UNIT_CONFIG.renderer.fill)!;
    const baseStrokeColor = cloneSceneColor(PLAYER_UNIT_BASE_STROKE?.color);
    const emitter = cloneEmitterConfig(PLAYER_UNIT_CONFIG.emitter);
    const objectId = scene.addObject("playerUnit", {
      position: initialPosition,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: baseFillColor,
      },
      stroke: PLAYER_UNIT_BASE_STROKE
        ? {
            color: cloneSceneColor(PLAYER_UNIT_BASE_STROKE.color)!,
            width: PLAYER_UNIT_BASE_STROKE.width,
          }
        : undefined,
      rotation: 0,
      customData: {
        renderer,
        emitter,
        physicalSize: PLAYER_UNIT_CONFIG.physicalSize,
        baseFillColor,
        baseStrokeColor,
        modules: config.modules,
        skills: config.modules.length > 0 ? ["void_modules"] : [],
      },
    });

    return {
      ...config,
      objectId,
      previousPosition: { ...initialPosition },
    };
  });
};

const updateCreatures = (
  scene: SceneObjectManager,
  creatures: CreatureState[],
  timestamp: number
) => {
  creatures.forEach((creature) => {
    const angle = creature.phase + timestamp * creature.orbitSpeed;
    const nextPosition: SceneVector2 = {
      x: creature.orbitCenter.x + Math.cos(angle) * creature.orbitRadius,
      y:
        creature.orbitCenter.y +
        Math.sin(angle) * creature.orbitRadius * CREATURE_ORBIT_VERTICAL_SQUASH +
        Math.sin(timestamp * CREATURE_BOB_SPEED + creature.phase) *
          CREATURE_BOB_AMPLITUDE,
    };
    const dx = nextPosition.x - creature.previousPosition.x;
    const dy = nextPosition.y - creature.previousPosition.y;
    const rotation = Math.atan2(dy, dx);
    creature.previousPosition = nextPosition;
    scene.updateObject(creature.objectId, {
      position: nextPosition,
      rotation,
    });
  });
};

const applySyncInstructions = (
  gl: WebGLRenderingContext,
  objectsRenderer: ReturnType<typeof createObjectsRendererManager>,
  staticBuffer: WebGLBuffer,
  dynamicBuffer: WebGLBuffer
) => {
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

export const SaveSlotBackgroundScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const wrapper = canvas.parentElement as HTMLElement | null;
    const webgl2 = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    const gl =
      (webgl2 as WebGLRenderingContext | WebGL2RenderingContext | null) ??
      canvas.getContext("webgl");

    if (!gl) {
      return undefined;
    }

    const scene = new SceneObjectManager();
    scene.setMapSize(MAP_SIZE);

    const objectsRenderer = createObjectsRendererManager();

    if (webgl2) {
      setParticleEmitterGlContext(webgl2);
      whirlEffect.onContextAcquired(webgl2);
      petalAuraEffect.onContextAcquired(webgl2);
    } else {
      setParticleEmitterGlContext(null);
    }

    clearAllAuraSlots();
    if (webgl2) {
      clearPetalAuraInstances(webgl2);
    } else {
      clearPetalAuraInstances();
    }

    const titleLayout = computeTitleLayout(
      TITLE_LINES,
      MAP_SIZE.width,
      MAP_SIZE.height
    );

    titleLayout.bricks.forEach((brick) => {
      scene.addObject("brick", {
        position: brick.position,
        size: brick.size,
        fill: brick.fill,
        stroke: brick.stroke,
      });
    });

    const creatures = createCreatures(scene, titleLayout);
    const contentBounds = computeSceneContentBounds(
      titleLayout.bounds,
      creatures,
      500, // paddingX
      CONTENT_PADDING // paddingY
    );

    objectsRenderer.bootstrap(scene.getObjects());

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const fillInfoLocation = gl.getAttribLocation(program, "a_fillInfo");
    const fillParams0Location = gl.getAttribLocation(program, "a_fillParams0");
    const fillParams1Location = gl.getAttribLocation(program, "a_fillParams1");
    const filaments0Location = gl.getAttribLocation(program, "a_filaments0");
    const filamentEdgeBlurLocation = gl.getAttribLocation(
      program,
      "a_filamentEdgeBlur",
    );
    const stopOffsetsLocation = gl.getAttribLocation(program, "a_stopOffsets");
    const stopColor0Location = gl.getAttribLocation(program, "a_stopColor0");
    const stopColor1Location = gl.getAttribLocation(program, "a_stopColor1");
    const stopColor2Location = gl.getAttribLocation(program, "a_stopColor2");

    const attributeLocations = [
      positionLocation,
      fillInfoLocation,
      fillParams0Location,
      fillParams1Location,
      filaments0Location,
      filamentEdgeBlurLocation,
      stopOffsetsLocation,
      stopColor0Location,
      stopColor1Location,
      stopColor2Location,
    ];

    if (attributeLocations.some((location) => location < 0)) {
      throw new Error("Failed to resolve attribute locations");
    }

    const stride = VERTEX_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    const attributeConfigs = (() => {
      let offset = 0;
      const configs: Array<{ location: number; size: number; offset: number }> = [];
      const push = (location: number, size: number) => {
        configs.push({ location, size, offset });
        offset += size * Float32Array.BYTES_PER_ELEMENT;
      };
      push(positionLocation, POSITION_COMPONENTS);
      push(fillInfoLocation, FILL_INFO_COMPONENTS);
      push(fillParams0Location, FILL_PARAMS0_COMPONENTS);
      push(fillParams1Location, FILL_PARAMS1_COMPONENTS);
      push(filaments0Location, FILL_FILAMENTS0_COMPONENTS);
      push(filamentEdgeBlurLocation, FILL_FILAMENTS1_COMPONENTS);
      push(stopOffsetsLocation, STOP_OFFSETS_COMPONENTS);
      push(stopColor0Location, STOP_COLOR_COMPONENTS);
      push(stopColor1Location, STOP_COLOR_COMPONENTS);
      push(stopColor2Location, STOP_COLOR_COMPONENTS);
      return configs;
    })();

    const staticBuffer = gl.createBuffer();
    const dynamicBuffer = gl.createBuffer();

    if (!staticBuffer || !dynamicBuffer) {
      throw new Error("Unable to allocate GL buffers");
    }

    const enableAttributes = (buffer: WebGLBuffer) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      attributeConfigs.forEach(({ location, size, offset }) => {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
      });
    };

    const cameraPositionLocation = gl.getUniformLocation(program, "u_cameraPosition");
    const viewportSizeLocation = gl.getUniformLocation(program, "u_viewportSize");

    if (!cameraPositionLocation || !viewportSizeLocation) {
      throw new Error("Failed to resolve camera uniforms");
    }

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );

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
      const safeContentWidth = Math.max(contentBounds.width, 1);
      const safeContentHeight = Math.max(contentBounds.height, 1);
      const scale = Math.min(1, width / safeContentWidth, height / safeContentHeight);
      scene.setScale(scale);
      centerCameraOnBounds(scene, contentBounds);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const initialChanges = scene.flushChanges();
    objectsRenderer.applyChanges(initialChanges);
    applySyncInstructions(gl, objectsRenderer, staticBuffer, dynamicBuffer);

    let frame = 0;
    const render = (timestamp: number) => {
      setSceneTimelineTimeMs(timestamp);
      updateCreatures(scene, creatures, timestamp);
      const cameraState = scene.getCamera();
      const changes = scene.flushChanges();
      objectsRenderer.applyChanges(changes);
      applySyncInstructions(gl, objectsRenderer, staticBuffer, dynamicBuffer);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(cameraPositionLocation, cameraState.position.x, cameraState.position.y);
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
        renderParticleEmitters(webgl2, cameraState.position, cameraState.viewportSize);
        updateAllWhirlInterpolations();
        whirlEffect.beforeRender(webgl2, timestamp);
        petalAuraEffect.beforeRender(webgl2, timestamp);
        whirlEffect.render(webgl2, cameraState.position, cameraState.viewportSize, timestamp);
        petalAuraEffect.render(webgl2, cameraState.position, cameraState.viewportSize, timestamp);
        renderArcBatches(webgl2, cameraState.position, cameraState.viewportSize);
        renderFireRings(webgl2, cameraState.position, cameraState.viewportSize, timestamp);
      }

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);

    return () => {
      objectsRenderer.dispose();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      const particleGl = getParticleEmitterGlContext();
      if (particleGl) {
        try {
          disposeParticleRenderResources(particleGl);
          disposeFireRing(particleGl);
        } catch {
          // ignore cleanup errors
        }
      }
      const whirlGl = whirlEffect.getPrimaryContext();
      if (whirlGl) {
        try {
          whirlEffect.onContextLost(whirlGl);
          disposeWhirlResources();
        } catch {
          // ignore cleanup errors
        }
      }
      if (webgl2) {
        try {
          petalAuraEffect.onContextLost(webgl2);
        } catch {
          // ignore cleanup errors
        }
      }
      try {
        clearAllAuraSlots();
        clearPetalAuraInstances();
        disposePetalAuraResources();
        resetAllArcBatches();
      } catch {
        // ignore cleanup errors
      }
      setParticleEmitterGlContext(null);
      gl.deleteBuffer(staticBuffer);
      gl.deleteBuffer(dynamicBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return <canvas ref={canvasRef} className="save-slot-background__canvas" />;
};

