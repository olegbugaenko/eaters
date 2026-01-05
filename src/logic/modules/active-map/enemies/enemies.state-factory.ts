import { StateFactory } from "../../../core/factories/StateFactory";
import { createSolidFill, cloneStroke } from "../../../services/scene-object-manager/scene-object-manager.helpers";
import { DEFAULT_COLOR } from "../../../services/scene-object-manager/scene-object-manager.const";
import type { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import type { SceneFill } from "../../../services/scene-object-manager/scene-object-manager.types";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { sanitizeRotation } from "@shared/helpers/validation.helper";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
import { ENEMY_SCENE_OBJECT_TYPE } from "./enemies.const";
import type { EnemySpawnData, InternalEnemyState } from "./enemies.types";

export interface EnemyStateInput {
  readonly enemyId: string;
  readonly enemy: EnemySpawnData;
  readonly clampToMap: (position: EnemySpawnData["position"]) => EnemySpawnData["position"];
}

interface EnemyStateFactoryOptions {
  readonly scene: SceneObjectManager;
}

export class EnemyStateFactory extends StateFactory<InternalEnemyState, EnemyStateInput> {
  private readonly scene: SceneObjectManager;

  constructor(options: EnemyStateFactoryOptions) {
    super();
    this.scene = options.scene;
  }

  create(input: EnemyStateInput): InternalEnemyState {
    const { enemy, enemyId, clampToMap } = input;
    const blueprint = enemy.blueprint;
    const position = clampToMap(enemy.position);
    const rotation = sanitizeRotation(enemy.rotation ?? 0);

    const maxHp = clampNumber(blueprint.maxHp, 0, Number.POSITIVE_INFINITY);
    const hp = clampNumber(enemy.hp ?? maxHp, 0, maxHp);
    const armor = clampNumber(blueprint.armor, 0, Number.POSITIVE_INFINITY);
    const baseDamage = clampNumber(blueprint.baseDamage, 0, Number.POSITIVE_INFINITY);
    const attackInterval = clampNumber(blueprint.attackInterval, 0, Number.POSITIVE_INFINITY);
    const attackCooldown = clampNumber(enemy.attackCooldown ?? attackInterval, 0, Number.POSITIVE_INFINITY);
    const moveSpeed = clampNumber(blueprint.moveSpeed, 0, Number.POSITIVE_INFINITY);
    const physicalSize = clampNumber(blueprint.physicalSize, 0, Number.POSITIVE_INFINITY);
    const fill: SceneFill = cloneSceneFill(blueprint.fill ?? createSolidFill(DEFAULT_COLOR));
    const stroke = cloneStroke(blueprint.stroke);

    return {
      id: enemyId,
      type: blueprint.type,
      position,
      rotation,
      hp,
      maxHp,
      armor,
      baseDamage,
      attackInterval,
      attackCooldown,
      moveSpeed,
      physicalSize,
      reward: blueprint.reward,
      fill,
      stroke,
      sceneObjectId: "",
    };
  }

  protected override transform(state: InternalEnemyState): void {
    const sceneObjectId = this.scene.addObject(ENEMY_SCENE_OBJECT_TYPE, {
      position: state.position,
      rotation: state.rotation,
      size: { width: Math.max(state.physicalSize, 1), height: Math.max(state.physicalSize, 1) },
      fill: state.fill,
      stroke: state.stroke,
    });
    state.sceneObjectId = sceneObjectId;
  }
}
