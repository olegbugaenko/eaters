import assert from "assert";
import { MovementService } from "../src/core/logic/provided/services/movement/MovementService";
import { SceneObjectManager } from "../src/core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { FILL_TYPES } from "../src/core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { describe, test } from "./testRunner";

const createSceneObject = (scene: SceneObjectManager): string =>
  scene.addObject("unit", {
    position: { x: 0, y: 0 },
    fill: {
      fillType: FILL_TYPES.SOLID,
      color: { r: 1, g: 1, b: 1, a: 1 },
    },
  });

const createMovementFixture = () => {
  const scene = new SceneObjectManager();
  const movement = new MovementService(scene);
  const objectId = createSceneObject(scene);
  const bodyId = movement.createBody({ position: { x: 0, y: 0 }, mass: 1, maxSpeed: 10 });
  movement.registerSceneObject(bodyId, objectId);
  return { scene, movement, objectId, bodyId };
};

const isMovable = (scene: SceneObjectManager, objectId: string): boolean =>
  scene.getMovableObjects().some((instance) => instance.id === objectId);

describe("MovementService movable tracking", () => {
  test("registers object as movable when velocity is non-zero", () => {
    const { scene, movement, objectId, bodyId } = createMovementFixture();
    movement.setBodyVelocity(bodyId, { x: 1, y: 0 });
    movement.update(0.016);

    assert.strictEqual(isMovable(scene, objectId), true);
  });

  test("removes object from movable when scene object is deleted", () => {
    const { scene, movement, objectId, bodyId } = createMovementFixture();
    movement.setBodyVelocity(bodyId, { x: 1, y: 0 });
    movement.update(0.016);
    scene.removeObject(objectId);

    assert.strictEqual(isMovable(scene, objectId), false);
  });

  test("keeps object movable after one idle tick", () => {
    const { scene, movement, objectId, bodyId } = createMovementFixture();
    movement.setBodyVelocity(bodyId, { x: 1, y: 0 });
    movement.update(0.016);

    movement.setBodyVelocity(bodyId, { x: 0, y: 0 });
    movement.update(0.016);

    assert.strictEqual(isMovable(scene, objectId), true);
  });

  test("removes object after two idle ticks", () => {
    const { scene, movement, objectId, bodyId } = createMovementFixture();
    movement.setBodyVelocity(bodyId, { x: 1, y: 0 });
    movement.update(0.016);

    movement.setBodyVelocity(bodyId, { x: 0, y: 0 });
    movement.update(0.016);
    movement.update(0.016);

    assert.strictEqual(isMovable(scene, objectId), false);
  });
});
