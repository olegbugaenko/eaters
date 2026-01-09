import {
  SceneSize,
  SceneVector2,
  SceneStroke,
  SceneFill,
} from "@logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import type { SceneUiApi } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { getBrickConfig } from "@db/bricks-db";
import { getPlayerUnitConfig } from "@db/player-units-db";
import type { UnitModuleId } from "@db/unit-modules-db";
import {
  MAP_SIZE,
  LETTER_HORIZONTAL_GAP,
  LETTER_VERTICAL_GAP,
  LETTER_SPACING,
  WORD_SPACING,
  LINE_SPACING,
  DEFAULT_BRICK_TYPE,
  LETTER_BRICK_TYPES,
  LETTER_PATTERNS,
  type LetterPattern,
  ARCH_GAP_FROM_TITLE,
  ARCH_OUTER_RADIUS,
  ARCH_INNER_RADIUS,
  ARCH_PILLAR_HEIGHT,
  ARCH_BRICK_GAP,
  ARCH_BOTTOM_PADDING,
  CREATURE_ORBIT_VERTICAL_SQUASH,
  CREATURE_BOB_AMPLITUDE,
  CREATURE_BOB_SPEED,
  CONTENT_PADDING,
} from "./save-slot-scene-config";
import {
  createBrickFill,
  cloneEmitterConfig,
} from "./save-slot-scene-utils";
import { cloneSceneColor } from "@shared/helpers/scene-color.helper";
import { cloneRendererConfigForScene, deriveRendererStroke } from "@shared/helpers/renderer-clone.helper";

export type SceneBounds = { x: number; y: number; width: number; height: number };

export interface BrickInstance {
  position: SceneVector2;
  size: SceneSize;
  fill: SceneFill;
  stroke?: SceneStroke;
  rotation?: number;
}

export interface BrickLayout {
  bricks: BrickInstance[];
  bounds: SceneBounds;
}

export interface TitleLayoutResult extends BrickLayout {
  wordRanges: Array<{ startX: number; endX: number; startY: number; endY: number; centerY: number }>;
}

interface LetterMetric {
  brickType: string; // BrickType
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

export const computeTitleLayout = (
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

export const createArchLayout = (titleBounds: SceneBounds): BrickLayout => {
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

export const mergeBounds = (base: SceneBounds, ...bounds: SceneBounds[]): SceneBounds => {
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

export interface CreatureConfig {
  modules: UnitModuleId[];
  orbitCenter: SceneVector2;
  orbitRadius: number;
  orbitSpeed: number;
  phase: number;
}

export interface CreatureState extends CreatureConfig {
  objectId: string;
  previousPosition: SceneVector2;
}

export const computeSceneContentBounds = (
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

export const centerCameraOnBounds = (
  scene: SceneUiApi,
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

export const createCreatures = (
  scene: SceneUiApi,
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

  const PLAYER_UNIT_CONFIG = getPlayerUnitConfig("bluePentagon");
  const PLAYER_UNIT_BASE_STROKE = deriveRendererStroke(PLAYER_UNIT_CONFIG.renderer);

  return creatures.map((config) => {
    const angle = config.phase;
    const initialPosition: SceneVector2 = {
      x: config.orbitCenter.x + Math.cos(angle) * config.orbitRadius,
      y: config.orbitCenter.y + Math.sin(angle) * config.orbitRadius,
    };
    const renderer = cloneRendererConfigForScene(PLAYER_UNIT_CONFIG.renderer);
    const baseFillColor = cloneSceneColor(PLAYER_UNIT_CONFIG.renderer.fill)!;
    const baseStrokeColor = PLAYER_UNIT_BASE_STROKE?.color
      ? cloneSceneColor(PLAYER_UNIT_BASE_STROKE.color)
      : undefined;
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

export const updateCreatures = (
  scene: SceneUiApi,
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
