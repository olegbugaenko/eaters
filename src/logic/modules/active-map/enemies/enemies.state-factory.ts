import { StateFactory } from "@/core/logic/provided/factories/StateFactory";
import { createSolidFill, cloneStroke } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.helpers";
import { DEFAULT_COLOR } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { SceneFill, SceneStroke } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { sanitizeRotation } from "@shared/helpers/validation.helper";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
import { ENEMY_SCENE_OBJECT_TYPE } from "./enemies.const";
import type { EnemySpawnData, InternalEnemyState } from "./enemies.types";
import { getEnemyConfig } from "../../../../db/enemies-db";
import {
  sanitizeEnemyType,
  sanitizeEnemyLevel,
  calculateEnemyStatsForLevel,
  scaleEnemyStat,
  getEnemyLevelStatMultiplier,
} from "./enemies.helpers";
import { cloneSceneColor } from "@shared/helpers/scene-color.helper";
import { cloneResourceStockpile, normalizeResourceAmount } from "../../../../db/resources-db";
import type { MovementService } from "@core/logic/provided/services/movement/MovementService";

export interface EnemyStateInput {
  readonly enemyId: string;
  readonly enemy: EnemySpawnData;
  readonly clampToMap: (position: EnemySpawnData["position"]) => EnemySpawnData["position"];
}

interface EnemyStateFactoryOptions {
  readonly scene: SceneObjectManager;
  readonly movement: MovementService;
}

export class EnemyStateFactory extends StateFactory<InternalEnemyState, EnemyStateInput> {
  private readonly scene: SceneObjectManager;
  private readonly movement: MovementService;

  constructor(options: EnemyStateFactoryOptions) {
    super();
    this.scene = options.scene;
    this.movement = options.movement;
  }

  create(input: EnemyStateInput): InternalEnemyState {
    const { enemy, enemyId, clampToMap } = input;
    const type = sanitizeEnemyType(enemy.type);
    const config = getEnemyConfig(type);
    const level = sanitizeEnemyLevel(enemy.level);
    const stats = calculateEnemyStatsForLevel(config, level);
    
    const position = clampToMap(enemy.position);
    const rotation = sanitizeRotation(enemy.rotation ?? 0);

    const maxHp = stats.maxHp;
    const hp = clampNumber(enemy.hp ?? maxHp, 0, maxHp);
    const armor = stats.armor;
    const baseDamage = stats.baseDamage;
    const attackInterval = clampNumber(config.attackInterval, 0, Number.POSITIVE_INFINITY);
    const attackCooldown = clampNumber(enemy.attackCooldown ?? attackInterval, 0, Number.POSITIVE_INFINITY);
    const attackRange = clampNumber(config.attackRange ?? 240, 0, Number.POSITIVE_INFINITY);
    const moveSpeed = clampNumber(config.moveSpeed, 0, Number.POSITIVE_INFINITY);
    const physicalSize = clampNumber(config.physicalSize, 0, Number.POSITIVE_INFINITY);
    const knockBackDistance = clampNumber(config.knockBackDistance ?? 0, 0, Number.POSITIVE_INFINITY);
    const knockBackSpeed = clampNumber(config.knockBackSpeed ?? 0, 0, Number.POSITIVE_INFINITY);
    
    // Create movement body
    const mass = Math.max(physicalSize * 0.1, 0.001); // Mass based on size
    const movementId = this.movement.createBody({
      position,
      mass,
      maxSpeed: moveSpeed,
    });
    
    // Extract fill and stroke from renderer config
    let fill: SceneFill;
    let stroke: SceneStroke | undefined;
    
    if (config.renderer.kind === "composite") {
      fill = createSolidFill(config.renderer.fill);
      stroke = config.renderer.stroke
        ? {
            color: cloneSceneColor(config.renderer.stroke.color),
            width: config.renderer.stroke.width,
          }
        : undefined;
    } else {
      fill = createSolidFill(config.renderer.fill);
      stroke = config.renderer.stroke
        ? {
            color: cloneSceneColor(config.renderer.stroke.color),
            width: config.renderer.stroke.width,
          }
        : undefined;
    }

    return {
      id: enemyId,
      type,
      level,
      position,
      rotation,
      hp,
      maxHp,
      armor,
      baseDamage,
      attackInterval,
      attackCooldown,
      attackRange,
      attackSeriesState: undefined,
      moveSpeed,
      physicalSize,
      knockBackDistance,
      knockBackSpeed,
      reward: stats.rewards,
      fill,
      stroke,
      movementId,
      sceneObjectId: "",
    };
  }

  protected override transform(state: InternalEnemyState): void {
    const config = getEnemyConfig(state.type);
    
    // Pass renderer config in customData for the renderer
    const sceneObjectId = this.scene.addObject(ENEMY_SCENE_OBJECT_TYPE, {
      position: state.position,
      rotation: state.rotation,
      size: { width: Math.max(state.physicalSize, 1), height: Math.max(state.physicalSize, 1) },
      fill: state.fill,
      stroke: state.stroke,
      customData: {
        renderer: config.renderer,
        type: state.type,
        level: state.level,
      },
    });
    state.sceneObjectId = sceneObjectId;
    this.movement.registerSceneObject(state.movementId, sceneObjectId);
  }
}
