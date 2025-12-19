import { GameModule } from "../../core/types";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneFillFilaments,
  SceneFillNoise,
  SceneGradientStop,
  SceneObjectManager,
  SceneVector2,
} from "../../services/SceneObjectManager";
import {
  ExplosionConfig,
  ExplosionRendererEmitterConfig,
  ExplosionType,
  getExplosionConfig,
} from "../../../db/explosions-db";
import {
  cloneSceneColor,
  cloneSceneFill,
  sanitizeAngle,
  sanitizeArc,
} from "../../services/particles/ParticleEmitterShared";

interface ExplosionModuleOptions {
  scene: SceneObjectManager;
}

interface WaveState {
  id: string;
  startInnerRadius: number;
  endInnerRadius: number;
  startOuterRadius: number;
  endOuterRadius: number;
  startAlpha: number;
  endAlpha: number;
  gradientStops: readonly SceneGradientStop[];
  noise?: SceneFillNoise;
  filaments?: SceneFillFilaments;
}

interface ExplosionState {
  position: SceneVector2;
  elapsedMs: number;
  waveLifetimeMs: number;
  effectLifetimeMs: number;
  waves: WaveState[];
}

export interface SpawnExplosionOptions {
  position: SceneVector2;
  initialRadius: number;
}

export interface SpawnExplosionByTypeOptions {
  position: SceneVector2;
  initialRadius?: number;
}

export interface ExplosionRendererCustomData {
  waveLifetimeMs?: number;
  emitter?: ExplosionRendererEmitterConfig;
}

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
    if (deltaMs <= 0) {
      return;
    }

    const survivors: ExplosionState[] = [];

    this.explosions.forEach((explosion) => {
      explosion.elapsedMs += deltaMs;
      this.updateExplosion(explosion);

      if (explosion.elapsedMs >= explosion.effectLifetimeMs) {
        explosion.waves.forEach((wave) =>
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
    const config = getExplosionConfig(type);
    const initialRadius = Math.max(
      1,
      options.initialRadius ?? config.defaultInitialRadius
    );
    this.spawnConfiguredExplosion(config, {
      position: options.position,
      initialRadius,
    });
  }

  private spawnConfiguredExplosion(
    config: ExplosionConfig,
    options: SpawnExplosionOptions
  ): void {
    const baseInitialRadius = Math.max(1, options.initialRadius);
    const defaultInitialRadius = Math.max(1, config.defaultInitialRadius);
    const radiusScale = clamp(
      baseInitialRadius / defaultInitialRadius,
      0.0001,
      Number.POSITIVE_INFINITY
    );

    const waveStates = config.waves.map((waveConfig) => {
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
      };
    });

    const maxInitialOuterRadius = waveStates.reduce(
      (max, wave) => Math.max(max, wave.startOuterRadius),
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

    const waves: WaveState[] = waveStates.map((wave, index) => {
      const fill = createWaveFill(
        wave.startInnerRadius,
        wave.startOuterRadius,
        wave.startAlpha,
        wave.gradientStops,
        wave.noise
      );

      const id = this.options.scene.addObject("explosion", {
        position: { ...options.position },
        size: { width: wave.startOuterRadius * 2, height: wave.startOuterRadius * 2 },
        fill,
        customData: index === 0 ? customData : { waveLifetimeMs },
      });

      return {
        ...wave,
        id,
      };
    });

    this.explosions.push({
      position: { ...options.position },
      elapsedMs: 0,
      waveLifetimeMs: Math.max(1, config.lifetimeMs),
      effectLifetimeMs,
      waves,
    });
  }

  private updateExplosion(explosion: ExplosionState): void {
    const waveProgress = clamp01(
      explosion.elapsedMs / Math.max(1, explosion.waveLifetimeMs)
    );
    explosion.waves.forEach((wave) => {
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

      this.options.scene.updateObject(wave.id, {
        position: { ...explosion.position },
        size: { width: outerRadius * 2, height: outerRadius * 2 },
        fill: createWaveFill(
          innerRadius,
          outerRadius,
          waveAlpha,
          wave.gradientStops,
          wave.noise,
          wave.filaments,
        ),
      });
    });
  }

  private clearExplosions(): void {
    this.explosions.forEach((explosion) => {
      explosion.waves.forEach((wave) => this.options.scene.removeObject(wave.id));
    });
    this.explosions = [];
  }
}

const createWaveFill = (
  innerRadius: number,
  outerRadius: number,
  alpha: number,
  gradientStops: readonly SceneGradientStop[],
  noise?: SceneFillNoise,
  filaments?: SceneFillFilaments
): SceneFill => {
  const radius = Math.max(outerRadius, 0.0001);
  const normalizedInnerRadius = clamp01(innerRadius / radius);

  const adjustedStops = gradientStops.map((stop) => ({
    offset:
      normalizedInnerRadius + clamp01(stop.offset) * (1 - normalizedInnerRadius),
    color: {
      r: stop.color.r,
      g: stop.color.g,
      b: stop.color.b,
      a: clamp01((typeof stop.color.a === "number" ? stop.color.a : 1) * alpha),
    },
  }));

  if (normalizedInnerRadius > 0 && adjustedStops[0]) {
    adjustedStops[0] = {
      ...adjustedStops[0],
      color: {
        ...adjustedStops[0].color,
        a: 0,
      },
    };
  }

  const baseColor = gradientStops[0]?.color ?? { r: 1, g: 1, b: 1, a: 0 };
  const stops: SceneGradientStop[] =
    adjustedStops.length > 0
      ? adjustedStops
      : [
          {
            offset: normalizedInnerRadius,
            color: {
              r: baseColor.r,
              g: baseColor.g,
              b: baseColor.b,
              a: 0,
            },
          },
        ];

  return {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: radius,
    stops,
    ...(noise && { noise }),
    ...(filaments && { filaments }),
  };
};

const createEmitterCustomData = (
  config: ExplosionConfig,
  initialRadius: number
): ExplosionRendererEmitterConfig | undefined => {
  const particlesPerSecond = Math.max(0, config.emitter.particlesPerSecond);
  const particleLifetimeMs = Math.max(0, config.emitter.particleLifetimeMs);
  const emissionDurationMs = Math.max(0, config.emitter.emissionDurationMs);

  if (particlesPerSecond <= 0 || particleLifetimeMs <= 0) {
    return undefined;
  }

  const fadeStartMs = clamp(config.emitter.fadeStartMs, 0, particleLifetimeMs);
  const sizeMin = Math.max(0, config.emitter.sizeRange.min);
  const sizeMax = Math.max(sizeMin, config.emitter.sizeRange.max);
  const spawnRadiusMin = Math.max(0, config.emitter.spawnRadius.min);
  const spawnRadiusMax = Math.max(
    spawnRadiusMin,
    config.emitter.spawnRadius.max,
    initialRadius * config.emitter.spawnRadiusMultiplier
  );

  const maxParticles = computeEmitterMaxParticles(
    particlesPerSecond,
    emissionDurationMs,
    particleLifetimeMs
  );

  return {
    particlesPerSecond,
    particleLifetimeMs,
    fadeStartMs,
    emissionDurationMs,
    sizeRange: { min: sizeMin, max: sizeMax },
    spawnRadius: { min: spawnRadiusMin, max: spawnRadiusMax },
    baseSpeed: Math.max(0, config.emitter.baseSpeed),
    speedVariation: Math.max(0, config.emitter.speedVariation),
    color: cloneSceneColor(config.emitter.color),
    fill: config.emitter.fill ? cloneSceneFill(config.emitter.fill) : undefined,
    arc: sanitizeArc(config.emitter.arc),
    direction: sanitizeAngle(config.emitter.direction),
    offset: { x: 0, y: 0 },
    maxParticles,
    shape: config.emitter.shape,
    sizeGrowthRate: config.emitter.sizeGrowthRate,
  };
};

const computeEffectLifetime = (
  config: ExplosionConfig,
  emitter: ExplosionRendererEmitterConfig | undefined
): number => {
  const waveLifetime = Math.max(1, config.lifetimeMs);
  if (!emitter) {
    return waveLifetime;
  }
  const emitterLifetime = emitter.emissionDurationMs + emitter.particleLifetimeMs;
  return Math.max(waveLifetime, emitterLifetime);
};

const computeEmitterMaxParticles = (
  particlesPerSecond: number,
  emissionDurationMs: number,
  particleLifetimeMs: number
): number | undefined => {
  if (particlesPerSecond <= 0 || particleLifetimeMs <= 0) {
    return undefined;
  }
  const emissionWindowMs = Math.max(
    0,
    Math.min(emissionDurationMs, particleLifetimeMs)
  );
  if (emissionWindowMs <= 0) {
    return 1;
  }
  const base = (particlesPerSecond * emissionWindowMs) / 1000;
  const slack = particlesPerSecond / 60;
  return Math.max(1, Math.ceil(base + slack));
};

const lerp = (start: number, end: number, t: number): number =>
  start + (end - start) * t;

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

const clamp = (value: number, min: number, max: number): number => {
  if (value <= min) {
    return min;
  }
  if (value >= max) {
    return max;
  }
  return value;
};

