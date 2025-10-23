import { SceneObjectManager, SceneVector2, FILL_TYPES } from "../../services/SceneObjectManager";
import { ExplosionModule } from "../scene/ExplosionModule";
import { ArcModule } from "../scene/ArcModule";
import { EffectsModule } from "../scene/EffectsModule";
import { FireballModule } from "../scene/FireballModule";
import { getArcConfig } from "../../../db/arcs-db";
import { getUnitModuleConfig } from "../../../db/unit-modules-db";
import type { PlayerUnitType } from "../../../db/player-units-db";

const DEFAULT_PHEROMONE_IDLE_THRESHOLD_SECONDS = 2;
const DEFAULT_PHEROMONE_BUFF_ATTACKS = 4;
const DEFAULT_MENDING_HEALS_PER_RUN = 10;
const HEAL_SKIP_RATIO_THRESHOLD = 0.6; // skip micro-heals if target HP > 60%
const PHEROMONE_HEAL_EXPLOSION_RADIUS = 14;
const PHEROMONE_FRENZY_EXPLOSION_RADIUS = 12;
const FIREBALL_SELF_DAMAGE_PERCENT = 1; // 75% of max HP as self-damage

export interface PheromoneAttackBonusState {
  bonusDamage: number;
  remainingAttacks: number;
}

export interface PlayerUnitAbilityState {
  id: string;
  type: PlayerUnitType;
  position: SceneVector2;
  hp: number;
  maxHp: number;
  baseAttackDamage: number;
  baseAttackInterval: number;
  pheromoneHealingMultiplier: number;
  pheromoneAggressionMultiplier: number;
  pheromoneAttackBonuses: PheromoneAttackBonusState[];
  timeSinceLastAttack: number;
  timeSinceLastSpecial: number;
  fireballDamageMultiplier: number;
}

interface AbilityArcEntry {
  id: string;
  remainingMs: number;
  sourceUnitId: string;
  targetUnitId: string;
  arcType: "heal" | "frenzy";
}

interface PlayerUnitAbilitiesOptions {
  scene: SceneObjectManager;
  explosions: ExplosionModule;
  getArcs: () => ArcModule | undefined;
  getEffects: () => EffectsModule | undefined;
  logEvent: (message: string) => void;
  formatUnitLabel: (unit: PlayerUnitAbilityState) => string;
  getUnits: () => readonly PlayerUnitAbilityState[];
  getUnitById: (id: string) => PlayerUnitAbilityState | undefined;
  getFireballs: () => FireballModule | undefined;
  getBrickPosition: (brickId: string) => SceneVector2 | null;
  damageBrick: (brickId: string, damage: number) => void;
  getBricksInRadius: (position: SceneVector2, radius: number) => string[];
  damageUnit: (unitId: string, damage: number) => void;
  findNearestBrick: (position: SceneVector2) => string | null;
}

type AbilityTrigger = "heal" | "frenzy" | "fireball" | null;

export class PlayerUnitAbilities {
  private readonly scene: SceneObjectManager;
  private readonly explosions: ExplosionModule;
  private readonly getArcs: () => ArcModule | undefined;
  private readonly getEffects: () => EffectsModule | undefined;
  private readonly getFireballs: () => FireballModule | undefined;
  private readonly logEvent: (message: string) => void;
  private readonly formatUnitLabel: (unit: PlayerUnitAbilityState) => string;
  private readonly getUnits: () => readonly PlayerUnitAbilityState[];
  private readonly getUnitById: (id: string) => PlayerUnitAbilityState | undefined;
  private readonly getBrickPosition: (brickId: string) => SceneVector2 | null;
  private readonly damageBrick: (brickId: string, damage: number) => void;
  private readonly getBricksInRadius: (position: SceneVector2, radius: number) => string[];
  private readonly damageUnit: (unitId: string, damage: number) => void;
  private readonly findNearestBrick: (position: SceneVector2) => string | null;
  private activeArcEffects: AbilityArcEntry[] = [];
  private healChargesRemaining = new Map<string, number>();

  constructor(options: PlayerUnitAbilitiesOptions) {
    this.scene = options.scene;
    this.explosions = options.explosions;
    this.getArcs = options.getArcs;
    this.getEffects = options.getEffects;
    this.getFireballs = options.getFireballs;
    this.logEvent = options.logEvent;
    this.formatUnitLabel = options.formatUnitLabel;
    this.getUnits = options.getUnits;
    this.getUnitById = options.getUnitById;
    this.getBrickPosition = options.getBrickPosition;
    this.damageBrick = options.damageBrick;
    this.getBricksInRadius = options.getBricksInRadius;
    this.damageUnit = options.damageUnit;
    this.findNearestBrick = options.findNearestBrick;
  }

  public resetRun(): void {
    this.clearArcEffects();
    this.healChargesRemaining.clear();
  }

  public clearArcEffects(): void {
    if (this.activeArcEffects.length === 0) {
      return;
    }
    this.activeArcEffects.forEach((entry) => {
      this.scene.removeObject(entry.id);
    });
    this.activeArcEffects = [];
  }

  public update(deltaMs: number): void {
    if (this.activeArcEffects.length === 0) {
      return;
    }
    const survivors: AbilityArcEntry[] = [];
    const decrement = Math.max(0, deltaMs);
    for (let i = 0; i < this.activeArcEffects.length; i += 1) {
      const entry = this.activeArcEffects[i]!;
      const next = entry.remainingMs - decrement;
      const source = this.getUnitById(entry.sourceUnitId);
      const target = this.getUnitById(entry.targetUnitId);
      if (!source || !target || source.hp <= 0 || target.hp <= 0) {
        this.scene.removeObject(entry.id);
        continue;
      }
      this.scene.updateObject(entry.id, {
        position: { ...source.position },
        fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } },
        customData: {
          arcType: entry.arcType,
          from: { ...source.position },
          to: { ...target.position },
        },
      });
      if (next <= 0) {
        this.scene.removeObject(entry.id);
      } else {
        survivors.push({ ...entry, remainingMs: next });
      }
    }
    this.activeArcEffects = survivors;
  }

  public tryTriggerPheromoneAbilities(unit: PlayerUnitAbilityState): AbilityTrigger {
    if (!this.canUsePheromoneAbility(unit)) {
      return null;
    }

    const canHeal =
      unit.pheromoneHealingMultiplier > 0 && this.getRemainingHealCharges(unit.id) > 0;
    const healTarget = canHeal ? this.findPheromoneHealingTarget(unit) : null;
    const frenzyTarget =
      unit.pheromoneAggressionMultiplier > 0 ? this.findPheromoneAggressionTarget(unit) : null;
    const fireballTarget = 
      unit.fireballDamageMultiplier > 0 ? this.findFireballTarget(unit) : null;

    const healScore = healTarget ? this.computeHealScore(unit, healTarget) : -Infinity;
    const frenzyScore = frenzyTarget ? this.computeFrenzyScore(unit, frenzyTarget) : -Infinity;
    const fireballScore = fireballTarget ? this.computeFireballScore(unit, fireballTarget) : -Infinity;

    // console.log('scores: ', `${healTarget?.hp}/${healTarget?.maxHp}`, healScore, frenzyScore, fireballScore);

    // Prioritize fireball if it has a good score
    if (fireballScore > 0 && fireballScore >= Math.max(healScore, frenzyScore) && fireballTarget) {
      const launched = this.applyFireball(unit, fireballTarget);
      if (launched) {
        unit.timeSinceLastSpecial = 0;
        return "fireball";
      }
    }

    if (healScore > frenzyScore && healScore > 0 && healTarget) {
      const healed = this.applyPheromoneHealing(unit, healTarget);
      if (healed) {
        unit.timeSinceLastSpecial = 0;
        this.consumeHealCharge(unit.id);
        return "heal";
      }
    }

    if (frenzyScore > 0 && frenzyTarget) {
      const applied = this.applyPheromoneAggression(unit, frenzyTarget);
      if (applied) {
        unit.timeSinceLastSpecial = 0;
        return "frenzy";
      }
    }

    return null;
  }

  public consumeAttackBonuses(unit: PlayerUnitAbilityState): number {
    if (unit.pheromoneAttackBonuses.length === 0) {
      return 0;
    }
    let total = 0;
    const survivors: PheromoneAttackBonusState[] = [];
    unit.pheromoneAttackBonuses.forEach((entry) => {
      if (entry.remainingAttacks <= 0 || entry.bonusDamage <= 0) {
        return;
      }
      total += entry.bonusDamage;
      const next = entry.remainingAttacks - 1;
      if (next > 0) {
        survivors.push({ bonusDamage: entry.bonusDamage, remainingAttacks: next });
      }
    });
    unit.pheromoneAttackBonuses = survivors;
    if (survivors.length === 0) {
      this.getEffects()?.removeEffect(unit.id, "frenzyAura");
    }
    return total;
  }

  public getAbilityCooldownSeconds(): number {
    return this.getMendingIntervalSeconds();
  }

  private canUsePheromoneAbility(unit: PlayerUnitAbilityState): boolean {
    if (unit.hp <= 0) {
      return false;
    }
    if (unit.pheromoneHealingMultiplier <= 0 && unit.pheromoneAggressionMultiplier <= 0 && unit.fireballDamageMultiplier <= 0) {
      return false;
    }
    const cooldown = this.getMendingIntervalSeconds();
    if (unit.timeSinceLastSpecial < cooldown) {
      return false;
    }
    return true;
  }

  private findPheromoneHealingTarget(
    source: PlayerUnitAbilityState
  ): PlayerUnitAbilityState | null {
    let best: PlayerUnitAbilityState | null = null;
    let bestRatio = Number.POSITIVE_INFINITY;
    this.getUnits().forEach((candidate) => {
      if (candidate.id === source.id || candidate.hp <= 0 || candidate.maxHp <= 0) {
        return;
      }
      const ratio = candidate.hp / candidate.maxHp;
      if (ratio >= 1) {
        return;
      }
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = candidate;
      }
    });
    return best;
  }

  private findPheromoneAggressionTarget(
    source: PlayerUnitAbilityState
  ): PlayerUnitAbilityState | null {
    const candidates = this.getUnits().filter(
      (candidate) => candidate.id !== source.id && candidate.hp > 0
    );
    if (candidates.length === 0) {
      return null;
    }
    const effects = this.getEffects();
    const withoutAura: PlayerUnitAbilityState[] = [];
    const withAura: PlayerUnitAbilityState[] = [];
    candidates.forEach((candidate) => {
      if (effects?.hasEffect(candidate.id, "frenzyAura")) {
        withAura.push(candidate);
      } else {
        withoutAura.push(candidate);
      }
    });
    const pool = withoutAura.length > 0 ? withoutAura : withAura;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index] ?? null;
  }

  private computeHealScore(
    source: PlayerUnitAbilityState,
    target: PlayerUnitAbilityState
  ): number {
    const missingHp = Math.max(target.maxHp - target.hp, 0);
    const ratio = target.maxHp > 0 ? missingHp / target.maxHp : 0;
    const healAmount =
      Math.max(source.baseAttackDamage, 0) * Math.max(source.pheromoneHealingMultiplier, 0);
    // Guard: skip if target has >60% HP and heal would overheal (waste charge)
    if (target.maxHp > 0) {
      const currentRatio = target.hp / target.maxHp;
      if (currentRatio > HEAL_SKIP_RATIO_THRESHOLD && missingHp > 0 && missingHp < healAmount) {
        return 0;
      }
    }
    const amp = healAmount > 0 ? Math.min(missingHp / (healAmount * 0.75), 1) : 0;
    const score = Math.max(0, Math.min(1, Math.pow(ratio, 0.5 ) * Math.max(amp, 0.2)));
    return score;
  }

  private computeFrenzyScore(
    source: PlayerUnitAbilityState,
    target: PlayerUnitAbilityState
  ): number {
    let score = 0.15;
    const effects = this.getEffects();
    if (!effects?.hasEffect(target.id, "frenzyAura")) {
      score += 0.2;
    }
    const interval = Math.max(target.baseAttackInterval, 0.1);
    const rate = Math.min(1, 0.0 + (1 / interval) * 0.15);
    score += rate;
    return Math.max(0, Math.min(1, score));
  }

  private applyPheromoneHealing(
    source: PlayerUnitAbilityState,
    target: PlayerUnitAbilityState
  ): boolean {
    const healAmount =
      Math.max(source.baseAttackDamage, 0) * Math.max(source.pheromoneHealingMultiplier, 0);
    if (healAmount <= 0) {
      return false;
    }
    const previousHp = target.hp;
    const nextHp = clampNumber(previousHp + healAmount, 0, target.maxHp);
    if (nextHp <= previousHp) {
      return false;
    }
    target.hp = nextHp;
    const healedAmount = nextHp - previousHp;

    this.explosions.spawnExplosionByType("healWave", {
      position: { ...target.position },
      initialRadius: PHEROMONE_HEAL_EXPLOSION_RADIUS,
    });

    this.spawnArcEffect("heal", source, target);

    const multiplier = Math.max(source.pheromoneHealingMultiplier, 0);
    const attackPower = Math.max(source.baseAttackDamage, 0);
    this.logEvent(
      `${this.formatUnitLabel(source)} healed ${this.formatUnitLabel(target)} for ${healedAmount.toFixed(
        1
      )} HP (${previousHp.toFixed(1)} -> ${nextHp.toFixed(1)}) using ${attackPower.toFixed(
        1
      )} attack × ${multiplier.toFixed(2)} multiplier`
    );
    return true;
  }

  private applyPheromoneAggression(
    source: PlayerUnitAbilityState,
    target: PlayerUnitAbilityState
  ): boolean {
    const bonusDamage =
      Math.max(source.baseAttackDamage, 0) * Math.max(source.pheromoneAggressionMultiplier, 0);
    if (bonusDamage <= 0) {
      return false;
    }
    target.pheromoneAttackBonuses.push({
      bonusDamage,
      remainingAttacks: this.getFrenzyAttacks(),
    });
    this.getEffects()?.applyEffect(target.id, "frenzyAura");
    this.explosions.spawnExplosionByType("magnetic", {
      position: { ...target.position },
      initialRadius: PHEROMONE_FRENZY_EXPLOSION_RADIUS,
    });

    this.spawnArcEffect("frenzy", source, target);

    const multiplier = Math.max(source.pheromoneAggressionMultiplier, 0);
    const attackPower = Math.max(source.baseAttackDamage, 0);
    this.logEvent(
      `${this.formatUnitLabel(source)} empowered ${this.formatUnitLabel(target)} with +${bonusDamage.toFixed(
        1
      )} damage (${attackPower.toFixed(1)} attack × ${multiplier.toFixed(
        2
      )} multiplier) for ${this.getFrenzyAttacks()} attacks`
    );
    return true;
  }

  private spawnArcEffect(
    arcType: "heal" | "frenzy",
    source: PlayerUnitAbilityState,
    target: PlayerUnitAbilityState
  ): void {
    const arcModule = this.getArcs();
    if (arcModule) {
      try {
        arcModule.spawnArcBetweenUnits(arcType, source.id, target.id);
        return;
      } catch {
        // fall through to manual arc if ArcModule fails
      }
    }

    try {
      const config = getArcConfig(arcType);
      const arcId = this.scene.addObject("arc", {
        position: { ...source.position },
        fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } },
        customData: {
          arcType,
          from: { ...source.position },
          to: { ...target.position },
          lifetimeMs: config.lifetimeMs,
          fadeStartMs: config.fadeStartMs,
        },
      });
      this.activeArcEffects.push({
        id: arcId,
        remainingMs: config.lifetimeMs,
        sourceUnitId: source.id,
        targetUnitId: target.id,
        arcType,
      });
    } catch {
      // ignore arc failures; abilities still apply
    }
  }

  private getMendingIntervalSeconds(): number {
    const activeIds = ["mendingGland", "frenzyGland"] as const;
    let best = Number.POSITIVE_INFINITY;
    activeIds.forEach((id) => {
      try {
        const meta = getUnitModuleConfig(id as never)?.meta;
        const cooldown = typeof meta?.cooldownSeconds === "number" ? meta.cooldownSeconds : NaN;
        if (Number.isFinite(cooldown) && cooldown > 0 && cooldown < best) {
          best = cooldown;
        }
      } catch {
        // ignore lookup issues; fall back to default threshold
      }
    });
    return Number.isFinite(best) ? best : DEFAULT_PHEROMONE_IDLE_THRESHOLD_SECONDS;
  }

  private getFrenzyAttacks(): number {
    try {
      const value = getUnitModuleConfig("frenzyGland" as never)?.meta?.frenzyAttacks;
      return typeof value === "number" && value > 0 ? value : DEFAULT_PHEROMONE_BUFF_ATTACKS;
    } catch {
      return DEFAULT_PHEROMONE_BUFF_ATTACKS;
    }
  }

  private getMendingHealCharges(): number {
    try {
      const value = getUnitModuleConfig("mendingGland" as never)?.meta?.healCharges;
      return typeof value === "number" && value > 0 ? value : DEFAULT_MENDING_HEALS_PER_RUN;
    } catch {
      return DEFAULT_MENDING_HEALS_PER_RUN;
    }
  }

  private getRemainingHealCharges(unitId: string): number {
    if (!this.healChargesRemaining.has(unitId)) {
      this.healChargesRemaining.set(unitId, this.getMendingHealCharges());
    }
    return this.healChargesRemaining.get(unitId)!;
  }

  private consumeHealCharge(unitId: string): void {
    const left = Math.max(0, (this.healChargesRemaining.get(unitId) ?? this.getMendingHealCharges()) - 1);
    this.healChargesRemaining.set(unitId, left);
  }

  // Fireball methods
  private findFireballTarget(source: PlayerUnitAbilityState): string | null {
    // Find the nearest brick that can be targeted
    const units = this.getUnits();
    const sourceUnit = units.find(u => u.id === source.id);
    if (!sourceUnit) return null;

    // Use the same targeting logic as normal attacks
    return this.findNearestBrick(sourceUnit.position);
  }

  private computeFireballScore(source: PlayerUnitAbilityState, targetBrickId: string): number {
    // Simple scoring - prioritize fireball when there are targets
    // Higher score means more likely to be chosen
    return 0.7; // High priority for fireball
  }

  private applyFireball(source: PlayerUnitAbilityState, targetBrickId: string): boolean {
    const fireballModule = this.getFireballs();
    console.log('fireballModule: ', fireballModule, source.baseAttackDamage, source.fireballDamageMultiplier);
    if (!fireballModule) {
      return false;
    }

    const damage = Math.max(source.baseAttackDamage, 0) * Math.max(source.fireballDamageMultiplier, 0);
    if (damage <= 0) {
      return false;
    }

    fireballModule.spawnFireball(
      source.id,
      source.position,
      targetBrickId,
      damage
    );

    // Apply self-damage for using fireball (25% of fireball damage)
    const selfDamage = Math.max(damage * FIREBALL_SELF_DAMAGE_PERCENT, 1);
    this.damageUnit(source.id, selfDamage);

    this.logEvent(
      `${this.formatUnitLabel(source)} launched fireball targeting brick ${targetBrickId} for ${damage.toFixed(1)} damage (self-damage: ${selfDamage.toFixed(1)})`
    );

    return true;
  }
}

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return value;
  }
  if (min > max) {
    return value;
  }
  return Math.max(min, Math.min(max, value));
};

