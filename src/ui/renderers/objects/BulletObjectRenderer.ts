import { ObjectRegistration, ObjectRenderer } from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneLinearGradientFill,
  SceneObjectInstance,
  SceneVector2,
} from "../../../logic/services/SceneObjectManager";
import {
  createDynamicCirclePrimitive,
  createDynamicTrianglePrimitive,
} from "../primitives";

const TAIL_LENGTH_MULTIPLIER = 4.5;
const TAIL_WIDTH_MULTIPLIER = 1.75;
const TAIL_START_COLOR = { r: 0.25, g: 0.45, b: 1, a: 0.65 } as const;
const TAIL_END_COLOR = { r: 0.05, g: 0.15, b: 0.6, a: 0 } as const;

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
  const tailLength = radius * TAIL_LENGTH_MULTIPLIER;
  const tailHalfWidth = (radius * TAIL_WIDTH_MULTIPLIER) / 2;
  return [
    { x: -radius, y: 0 },
    { x: -radius - tailLength, y: tailHalfWidth },
    { x: -radius - tailLength, y: -tailHalfWidth },
  ];
};

const createTailFill = (instance: SceneObjectInstance): SceneLinearGradientFill => {
  const radius = getBulletRadius(instance);
  const tailLength = radius * TAIL_LENGTH_MULTIPLIER;
  const halfLength = tailLength / 2;
  return {
    fillType: FILL_TYPES.LINEAR_GRADIENT,
    start: { x: halfLength, y: 0 },
    end: { x: -halfLength, y: 0 },
    stops: [
      { offset: 0, color: { ...TAIL_START_COLOR } },
      { offset: 1, color: { ...TAIL_END_COLOR } },
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
