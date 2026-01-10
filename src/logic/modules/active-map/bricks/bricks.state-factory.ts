import { StateFactory } from "@/core/logic/provided/factories/StateFactory";
import { getBrickConfig, BrickType } from "../../../../db/bricks-db";
import type { SceneVector2, SceneFill } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { BrickData, InternalBrickState, BrickExplosionState } from "./bricks.types";
import {
  sanitizeBrickType,
  sanitizeBrickLevel,
  sanitizeKnockBackSpeed,
  sanitizeKnockBackAmplitude,
  sanitizeHp,
  resolveBrickExplosion,
  calculateBrickStatsForLevel,
  getBrickLevelStatMultiplier,
  scaleBrickStat,
} from "./bricks.helpers";
import { createBrickFill } from "./bricks.fill.helper";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
import { sanitizeRotation } from "@shared/helpers/validation.helper";
import { randomIntInclusive } from "@shared/helpers/numbers.helper";
import { BRICK_CRACK_VARIANTS_PER_STAGE } from "./bricks.const";
import { resolveBrickDamageStage } from "./bricks.helpers";

export interface BrickStateInput {
  readonly brick: BrickData;
  readonly brickId: string;
  readonly clampToMap: (position: SceneVector2) => SceneVector2;
}

export interface BrickStateFactoryOptions {
  readonly scene: SceneObjectManager;
}

/**
 * Проміжний стан brick без sceneObjectId.
 * Використовується для створення чистого стану перед реєстрацією в scene.
 */
interface BrickStateIntermediate extends Omit<InternalBrickState, "sceneObjectId"> {
  sceneObjectId?: string;
}

export class BrickStateFactory extends StateFactory<InternalBrickState, BrickStateInput> {
  private readonly scene: SceneObjectManager;

  constructor(options: BrickStateFactoryOptions) {
    super();
    this.scene = options.scene;
  }

  create(input: BrickStateInput): InternalBrickState {
    const { brick, brickId, clampToMap } = input;
    const type = sanitizeBrickType(brick.type);
    const config = getBrickConfig(type);
    const destructuble = config.destructubleData;
    const level = sanitizeBrickLevel(brick.level);
    const stats = calculateBrickStatsForLevel(config, level);
    const maxHp = stats.maxHp;
    const baseDamage = stats.baseDamage;
    const knockBackDistance = Math.max(destructuble?.knockBackDistance ?? 0, 0);
    const knockBackSpeed = sanitizeKnockBackSpeed(
      destructuble?.knockBackSpeed,
      knockBackDistance
    );
    const armor = stats.armor;
    const physicalSize = Math.max(
      destructuble?.physicalSize ?? Math.max(config.size.width, config.size.height) / 2,
      0
    );
    const brickKnockBackAmplitude = sanitizeKnockBackAmplitude(
      destructuble?.brickKnockBackAmplitude,
      knockBackDistance,
      config,
      physicalSize
    );
    const baseHp =
      typeof destructuble?.hp === "number"
        ? scaleBrickStat(destructuble.hp, getBrickLevelStatMultiplier(level), true)
        : maxHp;
    const hp = sanitizeHp(brick.hp ?? baseHp, maxHp);
    const position = clampToMap(brick.position);
    const rotation = sanitizeRotation(brick.rotation);
    const rewards = stats.rewards;
    const baseFill = createBrickFill(config);
    const variantsPerStage = Math.max(BRICK_CRACK_VARIANTS_PER_STAGE, 1);
    const crackVariant = randomIntInclusive({ min: 0, max: variantsPerStage - 1 });
    const damageStage = resolveBrickDamageStage(hp, maxHp);

    // Створюємо стан без sceneObjectId (буде додано в transform)
    const state: BrickStateIntermediate = {
      id: brickId,
      type,
      position,
      rotation,
      level,
      hp,
      maxHp,
      armor,
      baseDamage,
      knockBackDistance,
      knockBackSpeed,
      brickKnockBackAmplitude,
      physicalSize,
      rewards,
      passableFor: config.passableFor,
      damageExplosion: resolveBrickExplosion(
        destructuble?.damageExplosion,
        config,
        physicalSize
      ),
      destructionExplosion: resolveBrickExplosion(
        destructuble?.destructionExplosion,
        config,
        physicalSize
      ),
      knockback: null,
      baseFill: cloneSceneFill(baseFill),
      appliedFill: cloneSceneFill(baseFill),
      activeTint: null,
      damageStage,
      crackVariant,
    };

    return state as InternalBrickState;
  }

  /**
   * Реєструє brick у scene та додає sceneObjectId до стану.
   */
  protected override transform(state: InternalBrickState, input: BrickStateInput): void {
    const type = sanitizeBrickType(state.type as BrickType);
    const config = getBrickConfig(type);
    const crackMaskConfig = config.crackMask;
    const crackDesat = crackMaskConfig?.desat ?? 2.0;
    const crackDarken = crackMaskConfig?.darken ?? 0.5;
    const sceneObjectId = this.scene.addObject("brick", {
      position: state.position,
      size: { ...config.size },
      fill: cloneSceneFill(state.baseFill),
      rotation: state.rotation,
      stroke: config.stroke
        ? {
            color: { ...config.stroke.color },
            width: config.stroke.width,
          }
        : undefined,
      customData: {
        damageStage: state.damageStage,
        crackVariant: state.crackVariant,
        cracksEnabled: config.cracksEnabled !== false,
        crackDesat,
        crackDarken,
      },
    });

    // Мутуємо стан - додаємо sceneObjectId
    (state as any).sceneObjectId = sceneObjectId;
  }
}
