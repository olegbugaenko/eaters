import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { SpellConfig, SpellId } from "../../../../db/spells-db";
import type { BonusValueMap } from "../../shared/bonuses/bonuses.types";

export interface SpellCastContext {
  readonly spellId: SpellId;
  readonly config: SpellConfig;
  readonly origin: SceneVector2;
  readonly target: SceneVector2;
  readonly direction: SceneVector2;
  readonly spellPowerMultiplier: number;
}

export interface SpellCanCastContext {
  readonly spellId: SpellId;
  readonly config: SpellConfig;
  readonly cooldownRemainingMs: number;
  readonly isMapActive: boolean;
  readonly isUnlocked: boolean;
}

export interface SpellBehaviorDependencies {
  readonly scene: any; // SceneObjectManager
  readonly bricks: any; // BricksModule
  readonly bonuses: any; // BonusesModule
  readonly explosions?: any; // ExplosionModule (опціонально)
  readonly projectiles: any; // UnitProjectileController
  readonly getSpellPowerMultiplier: () => number;
}

/**
 * Базовий інтерфейс для поведінки заклинань.
 * Кожен тип заклинань (projectile, whirl, тощо) має свою реалізацію.
 */
export interface SpellBehavior {
  readonly spellType: SpellConfig["type"];

  /**
   * Перевіряє, чи можна виконати закляття в даний момент.
   */
  canCast(context: SpellCanCastContext): boolean;

  /**
   * Виконує закляття, створюючи його екземпляр у світі.
   * @returns true якщо закляття успішно створено
   */
  cast(context: SpellCastContext): boolean;

  /**
   * Оновлює всі активні екземпляри цього типу заклинань.
   * @param deltaMs час з останнього оновлення в мілісекундах
   */
  tick(deltaMs: number): void;

  /**
   * Очищає всі активні екземпляри заклинань.
   */
  clear(): void;

  /**
   * Очищає застарілі об'єкти, які накопичилися під час неактивності вкладки.
   * Використовує абсолютний час (performance.now()) замість elapsedMs.
   */
  cleanupExpired?(): void;

  /**
   * Підписується на зміни бонусів для оновлення множників потужності.
   */
  onBonusValuesChanged(values: BonusValueMap): void;

  /**
   * Серіалізує стан для збереження (опціонально).
   */
  serializeState(): unknown;

  /**
   * Відновлює стан з серіалізованих даних (опціонально).
   */
  deserializeState(data: unknown): void;
}
