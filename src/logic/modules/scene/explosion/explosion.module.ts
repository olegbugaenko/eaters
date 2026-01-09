import { GameModule } from "@core/logic/types";
import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import { ExplosionConfig, ExplosionType, getExplosionConfig } from "../../../../db/explosions-db";
import type {
  ExplosionModuleOptions,
  ExplosionRendererCustomData,
  ExplosionState,
  SpawnExplosionByTypeOptions,
  SpawnExplosionOptions,
  WaveState,
} from "./explosion.types";
import {
  NEARBY_LIMIT_RADIUS_SQ,
  NEARBY_LIMIT_COUNT,
} from "./explosion.const";
import {
  createReusableWaveFill,
  updateWaveFill,
  createEmitterCustomData,
  computeEffectLifetime,
} from "./explosion.helpers";
import { clamp01, clampNumber, lerp } from "@shared/helpers/numbers.helper";
export type {
  ExplosionRendererCustomData,
  SpawnExplosionByTypeOptions,
  SpawnExplosionOptions,
} from "./explosion.types";

export class ExplosionModule implements GameModule {
  public readonly id = "explosions";

  private explosions: ExplosionState[] = [];

  constructor(private readonly options: ExplosionModuleOptions) {}

  public initialize(): void {}

  public reset(): void {
    this.clearExplosions();
  }

  public load(_data: unknown | undefined): void {
    this.clearExplosions();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0 || this.explosions.length === 0) {
      return;
    }

    const survivors: ExplosionState[] = [];

    this.explosions.forEach((explosion) => {
      explosion.elapsedMs += deltaMs;
      this.updateExplosion(explosion);

      if (explosion.elapsedMs >= explosion.effectLifetimeMs) {
        explosion.waves.forEach((wave: WaveState) =>
          this.options.scene.removeObject(wave.id)
        );
        return;
      }

      survivors.push(explosion);
    });

    this.explosions = survivors;
  }

  public spawnExplosion(options: SpawnExplosionOptions): void {
    this.spawnExplosionByType("plasmoid", options);
  }

  public spawnExplosionByType(
    type: ExplosionType,
    options: SpawnExplosionByTypeOptions
  ): void {
    if (this.hasTooManyNearbyExplosions(type, options.position)) {
      return;
    }
    const config: ExplosionConfig = getExplosionConfig(type);
    const initialRadius = Math.max(
      1,
      options.initialRadius ?? config.defaultInitialRadius
    );
    this.spawnConfiguredExplosion(type, config, {
      position: options.position,
      initialRadius,
    });
  }

  private spawnConfiguredExplosion(
    type: ExplosionType,
    config: ExplosionConfig,
    options: SpawnExplosionOptions
  ): void {
    const createdAt = performance.now();
    const baseInitialRadius = Math.max(1, options.initialRadius);
    const defaultInitialRadius = Math.max(1, config.defaultInitialRadius);
    const radiusScale = clampNumber(
      baseInitialRadius / defaultInitialRadius,
      0.0001,
      Number.POSITIVE_INFINITY
    );

    type WaveTemplate = Omit<WaveState, "id" | "fill" | "mutableStops" | "baseColor">;
    const waveTemplates: WaveTemplate[] = config.waves.map(
      (waveConfig: ExplosionConfig["waves"][number]) => {
        const startInnerRadius = Math.max(0, waveConfig.initialInnerRadius * radiusScale);
        const startOuterRadius = Math.max(
          startInnerRadius,
          waveConfig.initialOuterRadius * radiusScale
        );
        const endInnerRadius = Math.max(
          startInnerRadius,
          waveConfig.expansionInnerRadius * radiusScale
        );
        const endOuterRadius = Math.max(
          endInnerRadius,
          waveConfig.expansionOuterRadius * radiusScale
        );

        return {
          startInnerRadius,
          endInnerRadius,
          startOuterRadius,
          endOuterRadius,
          startAlpha: waveConfig.startAlpha,
          endAlpha: waveConfig.endAlpha,
          gradientStops: waveConfig.gradientStops,
          noise: waveConfig.noise,
          filaments: waveConfig.filaments,
        } satisfies WaveTemplate;
      }
    );

    const maxInitialOuterRadius = waveTemplates.reduce(
      (max: number, wave: WaveTemplate) => Math.max(max, wave.startOuterRadius),
      0
    );

    const emitter = createEmitterCustomData(
      config,
      Math.max(baseInitialRadius, maxInitialOuterRadius)
    );
    const effectLifetimeMs = computeEffectLifetime(config, emitter);
    const waveLifetimeMs = Math.max(1, config.lifetimeMs);

    const customData: ExplosionRendererCustomData = {
      waveLifetimeMs,
      emitter,
    };

    const waves: WaveState[] = waveTemplates.map((wave: WaveTemplate, index: number) => {
      const fillState = createReusableWaveFill(
        wave.gradientStops,
        wave.startInnerRadius,
        wave.startOuterRadius,
        wave.startAlpha,
        wave.noise,
        wave.filaments
      );

      // Each wave gets its own startAlpha/endAlpha for GPU interpolation
      const waveCustomData: ExplosionRendererCustomData = {
        ...(index === 0 ? customData : { waveLifetimeMs }),
        startAlpha: wave.startAlpha,
        endAlpha: wave.endAlpha,
      };

      const id = this.options.scene.addObject("explosion", {
        position: { ...options.position },
        size: { width: wave.startOuterRadius * 2, height: wave.startOuterRadius * 2 },
        fill: fillState.fill,
        customData: waveCustomData,
      });

      return {
        ...wave,
        id,
        fill: fillState.fill,
        mutableStops: fillState.stops,
        baseColor: fillState.baseColor,
      };
    });

    this.explosions.push({
      type,
      position: { ...options.position },
      elapsedMs: 0,
      waveLifetimeMs: Math.max(1, config.lifetimeMs),
      effectLifetimeMs,
      waves,
      createdAt,
    });
  }

  public cleanupExpired(): void {
    if (this.explosions.length === 0) {
      return;
    }

    const now = performance.now();
    const survivors: ExplosionState[] = [];

    for (let i = 0; i < this.explosions.length; i += 1) {
      const explosion = this.explosions[i]!;
      const elapsed = now - explosion.createdAt;

      if (elapsed >= explosion.effectLifetimeMs) {
        explosion.waves.forEach((wave: WaveState) => this.options.scene.removeObject(wave.id));
        continue;
      }

      survivors.push(explosion);
    }

    this.explosions = survivors;
  }

  private hasTooManyNearbyExplosions(
    type: ExplosionType,
    position: SceneVector2
  ): boolean {
    let nearbyCount = 0;
    for (const explosion of this.explosions) {
      if (explosion.type !== type) {
        continue;
      }
      const dx = explosion.position.x - position.x;
      const dy = explosion.position.y - position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= NEARBY_LIMIT_RADIUS_SQ) {
        nearbyCount += 1;
        if (nearbyCount >= NEARBY_LIMIT_COUNT) {
          return true;
        }
      }
    }
    return false;
  }

  private updateExplosion(explosion: ExplosionState): void {
    const waveProgress = clamp01(
      explosion.elapsedMs / Math.max(1, explosion.waveLifetimeMs)
    );
    explosion.waves.forEach((wave: WaveState) => {
      const innerRadius = lerp(
        wave.startInnerRadius,
        wave.endInnerRadius,
        waveProgress
      );
      const outerRadius = lerp(
        wave.startOuterRadius,
        wave.endOuterRadius,
        waveProgress
      );
      const waveAlpha = lerp(wave.startAlpha, wave.endAlpha, waveProgress);

      updateWaveFill(wave, innerRadius, outerRadius, waveAlpha);

      this.options.scene.updateObject(wave.id, {
        position: { ...explosion.position },
        size: { width: outerRadius * 2, height: outerRadius * 2 },
        fill: wave.fill,
      });
    });
  }

  private clearExplosions(): void {
    this.explosions.forEach((explosion) => {
      explosion.waves.forEach((wave: WaveState) => this.options.scene.removeObject(wave.id));
    });
    this.explosions = [];
  }
}

