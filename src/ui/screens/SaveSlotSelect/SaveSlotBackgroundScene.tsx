import { useEffect, useRef } from "react";
import {
  SceneColor,
  SceneFill,
  SceneSolidFill,
  SceneLinearGradientFill,
  SceneRadialGradientFill,
  SceneDiamondGradientFill,
  SceneFillNoise,
  SceneGradientStop,
  SceneSize,
  SceneStroke,
  SceneVector2,
} from "@logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { SceneObjectManager } from "@/logic/services/scene-object-manager/SceneObjectManager";
import { BrickType, getBrickConfig } from "@db/bricks-db";
import type { ParticleEmitterConfig } from "@logic/interfaces/visuals/particle-emitters-config";
import {
  getPlayerUnitConfig,
  PlayerUnitRendererConfig,
  PlayerUnitRendererLayerConfig,
  PlayerUnitRendererStrokeConfig,
  PlayerUnitAuraConfig,
} from "@db/player-units-db";
import {
  createObjectsRendererManager,
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
import { WebGLSceneRenderer } from "@ui/renderers/utils/WebGLSceneRenderer";
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
// Real arch configuration - bricks placed along a semicircle with proper rotation
const ARCH_GAP_FROM_TITLE = 320;
const ARCH_OUTER_RADIUS = 320; // Outer radius of the arch curve
const ARCH_INNER_RADIUS = 280; // Inner radius (creates thickness)
const ARCH_PILLAR_HEIGHT = 880; // Height of the vertical pillars
const ARCH_BRICK_GAP = 3; // Gap between bricks
const ARCH_BOTTOM_PADDING = 60; // Distance from bottom of screen to pillar base

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

type SceneBounds = { x: number; y: number; width: number; height: number };

interface BrickInstance {
  position: SceneVector2;
  size: SceneSize;
  fill: SceneFill;
  stroke?: SceneStroke;
  rotation?: number;
}

interface BrickLayout {
  bricks: BrickInstance[];
  bounds: SceneBounds;
}

interface TitleLayoutResult extends BrickLayout {
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

const createArchLayout = (titleBounds: SceneBounds): BrickLayout => {
  const config = getBrickConfig("floodedArch");
  const stroke = config.stroke
    ? {
        color: { ...config.stroke.color },
        width: config.stroke.width,
      }
    : undefined;

  const bricks: BrickLayout["bricks"] = [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const addBrick = (x: number, y: number, rotation: number = 0) => {
    bricks.push({
      position: { x, y },
      size: { ...config.size },
      fill: createBrickFill(config),
      stroke,
      rotation,
    });
    const halfW = config.size.width / 2;
    const halfH = config.size.height / 2;
    // Approximate bounds (not accounting for rotation, but close enough)
    minX = Math.min(minX, x - halfW);
    minY = Math.min(minY, y - halfH);
    maxX = Math.max(maxX, x + halfW);
    maxY = Math.max(maxY, y + halfH);
  };

  // Calculate arch center position
  const archCenterX = titleBounds.x + titleBounds.width + ARCH_GAP_FROM_TITLE + ARCH_OUTER_RADIUS;
  // Arc center is positioned so that pillars end near the bottom of the screen
  const arcCenterY = MAP_SIZE.height - ARCH_BOTTOM_PADDING - ARCH_PILLAR_HEIGHT;
  const pillarBottomY = arcCenterY + ARCH_PILLAR_HEIGHT;

  // Calculate how many bricks fit along the semicircle arc
  const brickArcLength = config.size.width + ARCH_BRICK_GAP;
  
  // Place bricks along the outer semicircle (top curved part)
  // Arc goes from left (angle=π) over the top (angle=π/2) to right (angle=0)
  const outerArcLength = Math.PI * ARCH_OUTER_RADIUS;
  const numOuterBricks = Math.max(7, Math.floor(outerArcLength / brickArcLength));
  
  for (let i = 0; i <= numOuterBricks; i += 1) {
    const t = i / numOuterBricks;
    const angle = Math.PI * (1 - t); // π → 0 (left to right over top)
    
    const x = archCenterX + Math.cos(angle) * ARCH_OUTER_RADIUS;
    const y = arcCenterY - Math.sin(angle) * ARCH_OUTER_RADIUS; // minus because Y goes down
    // Rotation: tangent to circle. At angle=π brick is vertical, at π/2 horizontal
    const rotation = -(angle - Math.PI / 2);
    addBrick(x, y, rotation);
  }

  // Place bricks along the inner semicircle
  const innerArcLength = Math.PI * ARCH_INNER_RADIUS;
  const numInnerBricks = Math.max(5, Math.floor(innerArcLength / brickArcLength));
  
  for (let i = 0; i <= numInnerBricks; i += 1) {
    const t = i / numInnerBricks;
    const angle = Math.PI * (1 - t);
    
    const x = archCenterX + Math.cos(angle) * ARCH_INNER_RADIUS;
    const y = arcCenterY - Math.sin(angle) * ARCH_INNER_RADIUS;
    const rotation = -(angle - Math.PI / 2);
    addBrick(x, y, rotation);
  }

  // Pillars - vertical bricks going down from arc endpoints
  const leftPillarX = archCenterX - ARCH_OUTER_RADIUS;
  const rightPillarX = archCenterX + ARCH_OUTER_RADIUS;
  const pillarThickness = ARCH_OUTER_RADIUS - ARCH_INNER_RADIUS;
  const pillarBrickHeight = config.size.height + ARCH_BRICK_GAP;
  const numPillarBricks = Math.floor(ARCH_PILLAR_HEIGHT / pillarBrickHeight);
  
  for (let i = 0; i < numPillarBricks; i += 1) {
    const y = arcCenterY + i * pillarBrickHeight + config.size.height / 2;
    
    // Left pillar - outer and inner edge
    addBrick(leftPillarX, y, 0);
    addBrick(leftPillarX + pillarThickness, y, 0);
    
    // Right pillar - outer and inner edge
    addBrick(rightPillarX, y, 0);
    addBrick(rightPillarX - pillarThickness, y, 0);
  }

  return {
    bricks,
    bounds: {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    },
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

const mergeBounds = (base: SceneBounds, ...bounds: SceneBounds[]): SceneBounds => {
  let minX = base.x;
  let minY = base.y;
  let maxX = base.x + base.width;
  let maxY = base.y + base.height;

  bounds.forEach((bound) => {
    minX = Math.min(minX, bound.x);
    minY = Math.min(minY, bound.y);
    maxX = Math.max(maxX, bound.x + bound.width);
    maxY = Math.max(maxY, bound.y + bound.height);
  });

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
};

const computeSceneContentBounds = (
  contentBounds: SceneBounds,
  creatures: readonly CreatureConfig[],
  paddingX: number,
  paddingY: number
): SceneBounds => {
  let minX = contentBounds.x;
  let minY = contentBounds.y;
  let maxX = contentBounds.x + contentBounds.width;
  let maxY = contentBounds.y + contentBounds.height;

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
  emitter: ParticleEmitterConfig | undefined
): ParticleEmitterConfig | undefined => {
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
    offset: emitter.offset ? { x: emitter.offset.x, y: emitter.offset.y } : { x: 0, y: 0 },
    color: cloneSceneColor(emitter.color) ?? { ...emitter.color },
    fill: emitter.fill ? cloneSceneFillDeep(emitter.fill) : undefined,
    shape: emitter.shape,
    maxParticles: emitter.maxParticles,
  };
};

const cloneSceneFillDeep = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID: {
      const solidFill = fill as SceneSolidFill;
      const solid: SceneSolidFill = {
        fillType: FILL_TYPES.SOLID,
        color: cloneSceneColor(solidFill.color) ?? solidFill.color,
      };
      if (solidFill.noise) {
        solid.noise = { ...solidFill.noise };
      }
      return solid;
    }
    case FILL_TYPES.LINEAR_GRADIENT: {
      const linearFill = fill as SceneLinearGradientFill;
      const linear: SceneLinearGradientFill = {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: linearFill.start ? { ...linearFill.start } : undefined,
        end: linearFill.end ? { ...linearFill.end } : undefined,
        stops: linearFill.stops.map((stop) => ({
          offset: stop.offset,
          color: cloneSceneColor(stop.color) ?? stop.color,
        })),
      };
      if (linearFill.noise) {
        linear.noise = { ...linearFill.noise };
      }
      return linear;
    }
    case FILL_TYPES.RADIAL_GRADIENT: {
      const radialFill = fill as SceneRadialGradientFill;
      const radial: SceneRadialGradientFill = {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: radialFill.start ? { ...radialFill.start } : undefined,
        end: typeof radialFill.end === "number" ? radialFill.end : 0,
        stops: radialFill.stops.map((stop) => ({
          offset: stop.offset,
          color: cloneSceneColor(stop.color) ?? stop.color,
        })),
      };
      if (radialFill.noise) {
        radial.noise = { ...radialFill.noise };
      }
      return radial;
    }
    case FILL_TYPES.DIAMOND_GRADIENT: {
      const diamondFill = fill as SceneDiamondGradientFill;
      const diamond: SceneDiamondGradientFill = {
        fillType: FILL_TYPES.DIAMOND_GRADIENT,
        start: diamondFill.start ? { ...diamondFill.start } : undefined,
        end: typeof diamondFill.end === "number" ? diamondFill.end : 0,
        stops: diamondFill.stops.map((stop) => ({
          offset: stop.offset,
          color: cloneSceneColor(stop.color) ?? stop.color,
        })),
      };
      if (diamondFill.noise) {
        diamond.noise = { ...diamondFill.noise };
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
      const solidFill = gradient as SceneSolidFill;
      return {
        type: "gradient",
        fill: {
          fillType: solidFill.fillType,
          color: cloneSceneColor(solidFill.color) ?? solidFill.color,
          ...(solidFill.noise ? { noise: { ...solidFill.noise } } : {}),
        },
      };
    }
    if (gradient.fillType === FILL_TYPES.LINEAR_GRADIENT) {
      const linearGradient = gradient as SceneLinearGradientFill;
      return {
        type: "gradient",
        fill: {
          fillType: linearGradient.fillType,
          start: linearGradient.start ? { ...linearGradient.start } : undefined,
          end: linearGradient.end ? { ...linearGradient.end } : undefined,
          stops: linearGradient.stops.map((stop) => ({
            offset: stop.offset,
            color: cloneSceneColor(stop.color) ?? stop.color,
          })),
          ...(linearGradient.noise ? { noise: { ...linearGradient.noise } } : {}),
        },
      };
    }
    if (
      gradient.fillType === FILL_TYPES.RADIAL_GRADIENT ||
      gradient.fillType === FILL_TYPES.DIAMOND_GRADIENT
    ) {
      const radialOrDiamondFill = gradient as SceneRadialGradientFill | SceneDiamondGradientFill;
      return {
        type: "gradient",
        fill: {
          fillType: radialOrDiamondFill.fillType,
          start: radialOrDiamondFill.start ? { ...radialOrDiamondFill.start } : undefined,
          end: typeof radialOrDiamondFill.end === "number" ? radialOrDiamondFill.end : undefined,
          stops: radialOrDiamondFill.stops.map((stop) => ({
            offset: stop.offset,
            color: cloneSceneColor(stop.color) ?? stop.color,
          })),
          ...(radialOrDiamondFill.noise ? { noise: { ...radialOrDiamondFill.noise } } : {}),
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

const centerCameraOnBounds = (
  scene: SceneObjectManager,
  bounds: SceneBounds
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

export const SaveSlotBackgroundScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const wrapper = canvas.parentElement as HTMLElement | null;
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;

    if (!gl) {
      console.error("WebGL 2 is required but not available");
      return undefined;
    }

    const scene = new SceneObjectManager();
    scene.setMapSize(MAP_SIZE);

    const objectsRenderer = createObjectsRendererManager();

    setParticleEmitterGlContext(gl);
    whirlEffect.onContextAcquired(gl);
    petalAuraEffect.onContextAcquired(gl);

    clearAllAuraSlots();
    clearPetalAuraInstances(gl);

    const titleLayout = computeTitleLayout(
      TITLE_LINES,
      MAP_SIZE.width,
      MAP_SIZE.height
    );

    const archLayout = createArchLayout(titleLayout.bounds);

    [...titleLayout.bricks, ...archLayout.bricks].forEach((brick) => {
      scene.addObject("brick", {
        position: brick.position,
        size: brick.size,
        fill: brick.fill,
        stroke: brick.stroke,
        rotation: brick.rotation ?? 0,
      });
    });

    const creatures = createCreatures(scene, titleLayout);
    const contentBounds = computeSceneContentBounds(
      mergeBounds(titleLayout.bounds, archLayout.bounds),
      creatures,
      500, // paddingX
      CONTENT_PADDING // paddingY
    );

    objectsRenderer.bootstrap(scene.getObjects());

    // Initialize WebGL renderer (handles shaders, buffers, attributes, uniforms)
    const webglRenderer = new WebGLSceneRenderer(gl, objectsRenderer);

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
    webglRenderer.getObjectsRenderer().applyChanges(initialChanges);
    webglRenderer.syncBuffers();

    let frame = 0;
    const render = (timestamp: number) => {
      setSceneTimelineTimeMs(timestamp);
      updateCreatures(scene, creatures, timestamp);
      const cameraState = scene.getCamera();
      const changes = scene.flushChanges();
      webglRenderer.getObjectsRenderer().applyChanges(changes);
      webglRenderer.syncBuffers();

      // Render base scene (static + dynamic buffers)
      webglRenderer.render(cameraState);

      // Render additional effects (particles, whirls, auras, arcs, fire rings)
      renderParticleEmitters(webglRenderer.getGl(), cameraState.position, cameraState.viewportSize);
      updateAllWhirlInterpolations();
      whirlEffect.beforeRender(webglRenderer.getGl(), timestamp);
      petalAuraEffect.beforeRender(webglRenderer.getGl(), timestamp);
      whirlEffect.render(webglRenderer.getGl(), cameraState.position, cameraState.viewportSize, timestamp);
      petalAuraEffect.render(webglRenderer.getGl(), cameraState.position, cameraState.viewportSize, timestamp);
      renderArcBatches(webglRenderer.getGl(), cameraState.position, cameraState.viewportSize);
      renderFireRings(webglRenderer.getGl(), cameraState.position, cameraState.viewportSize, timestamp);

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);

    return () => {
      objectsRenderer.dispose();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      
      // Dispose WebGL renderer (handles buffers, program, shaders)
      webglRenderer.dispose();
      
      // Cleanup additional GPU effects
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
      try {
        petalAuraEffect.onContextLost(gl);
      } catch {
        // ignore cleanup errors
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
    };
  }, []);

  return <canvas ref={canvasRef} className="save-slot-background__canvas" />;
};

