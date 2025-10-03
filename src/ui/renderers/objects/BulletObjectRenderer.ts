import { ObjectRegistration, ObjectRenderer } from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneColor,
  SceneLinearGradientFill,
  SceneObjectInstance,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  createDynamicCirclePrimitive,
  createDynamicTrianglePrimitive,
} from "../primitives";

interface BulletTailRenderConfig {
  lengthMultiplier: number;
  widthMultiplier: number;
  startColor: SceneColor;
  endColor: SceneColor;
}

interface BulletRendererCustomData {
  tail?: Partial<BulletTailRenderConfig>;
}

const DEFAULT_TAIL_CONFIG: BulletTailRenderConfig = {
  lengthMultiplier: 4.5,
  widthMultiplier: 1.75,
  startColor: { r: 0.25, g: 0.45, b: 1, a: 0.65 },
  endColor: { r: 0.05, g: 0.15, b: 0.6, a: 0 },
};

const cloneColor = (color: SceneColor, fallback: SceneColor): SceneColor => ({
  r: typeof color.r === "number" ? color.r : fallback.r,
  g: typeof color.g === "number" ? color.g : fallback.g,
  b: typeof color.b === "number" ? color.b : fallback.b,
  a: typeof color.a === "number" ? color.a : fallback.a,
});

const getTailConfig = (instance: SceneObjectInstance): BulletTailRenderConfig => {
  const data = instance.data.customData as BulletRendererCustomData | undefined;
  if (!data || typeof data !== "object" || !data.tail) {
    return DEFAULT_TAIL_CONFIG;
  }

  const { tail } = data;
  const lengthMultiplier =
    typeof tail.lengthMultiplier === "number"
      ? tail.lengthMultiplier
      : DEFAULT_TAIL_CONFIG.lengthMultiplier;
  const widthMultiplier =
    typeof tail.widthMultiplier === "number"
      ? tail.widthMultiplier
      : DEFAULT_TAIL_CONFIG.widthMultiplier;
  const startColor = tail.startColor
    ? cloneColor(tail.startColor, DEFAULT_TAIL_CONFIG.startColor)
    : { ...DEFAULT_TAIL_CONFIG.startColor };
  const endColor = tail.endColor
    ? cloneColor(tail.endColor, DEFAULT_TAIL_CONFIG.endColor)
    : { ...DEFAULT_TAIL_CONFIG.endColor };

  return {
    lengthMultiplier,
    widthMultiplier,
    startColor,
    endColor,
  };
};

const getBulletRadius = (instance: SceneObjectInstance): number => {
  const size = instance.data.size;
  if (!size) {
    return 0;
  }
  return Math.max(size.width, size.height) / 2;
};

const createTailVertices = (
  instance: SceneObjectInstance
): [SceneVector2, SceneVector2, SceneVector2] => {
  const radius = getBulletRadius(instance);
  const tail = getTailConfig(instance);
  const tailLength = radius * tail.lengthMultiplier;
  const tailHalfWidth = (radius * tail.widthMultiplier) / 2;
  return [
    { x: -radius, y: tailHalfWidth },
    { x: -radius, y: -tailHalfWidth },
    { x: -radius - tailLength, y: 0 },
  ];
};

const createTailFill = (instance: SceneObjectInstance): SceneLinearGradientFill => {
  const radius = getBulletRadius(instance);
  const tail = getTailConfig(instance);
  const tailLength = radius * tail.lengthMultiplier;
  return {
    fillType: FILL_TYPES.LINEAR_GRADIENT,
    start: { x: -radius, y: 0 },
    end: { x: -radius - tailLength, y: 0 },
    stops: [
      { offset: 0, color: { ...tail.startColor } },
      { offset: 1, color: { ...tail.endColor } },
    ],
  };
};

export class BulletObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    return {
      staticPrimitives: [],
      dynamicPrimitives: [
        createDynamicTrianglePrimitive(instance, {
          getVertices: createTailVertices,
          getFill: createTailFill,
        }),
        createDynamicCirclePrimitive(instance),
      ],
    };
  }
}
