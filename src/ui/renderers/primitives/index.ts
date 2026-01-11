export {
  createStaticRectanglePrimitive,
  createDynamicRectanglePrimitive,
} from "./basic/RectanglePrimitive";
export {
  createStaticCirclePrimitive,
  createDynamicCirclePrimitive,
} from "./basic/CirclePrimitive";
export {
  createStaticTrianglePrimitive,
  createDynamicTrianglePrimitive,
} from "./basic/TrianglePrimitive";
export {
  createStaticPolygonPrimitive,
  createDynamicPolygonPrimitive,
  createStaticPolygonStrokePrimitive,
  createDynamicPolygonStrokePrimitive,
} from "./basic/PolygonPrimitive";
export { createParticleEmitterPrimitive } from "./ParticleEmitterPrimitive";
export { createParticleSystemPrimitive } from "./ParticleSystemPrimitive";
export { createFireRingPrimitive } from "./FireRingPrimitive";
export {
  createStaticSpritePrimitive,
  createDynamicSpritePrimitive,
} from "./basic/SpritePrimitive";
export {
  bulletGpuRenderer,
  getAllActiveBullets,
  applyInterpolatedBulletPositions,
  createBulletVisualConfig,
  DEFAULT_BULLET_VISUAL,
  type BulletVisualConfig,
  type BulletSlotHandle,
} from "./gpu/bullet";
