import { GameModule } from "../../core/types";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
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
  startRadius: number;
  endRadius: number;
  startAlpha: number;
  endAlpha: number;
  gradientStops: readonly SceneGradientStop[];
}

interface ExplosionState {
  id: string;
  position: SceneVector2;
  elapsedMs: number;
  waveLifetimeMs: number;
  effectLifetimeMs: number;
  wave: WaveState;
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
        this.options.scene.removeObject(explosion.id);
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
    const startRadius = Math.max(1, options.initialRadius);
    const endRadius = startRadius + config.wave.radiusExtension;

    const wave: WaveState = {
      startRadius,
      endRadius,
      startAlpha: config.wave.startAlpha,
      endAlpha: config.wave.endAlpha,
      gradientStops: config.wave.gradientStops,
    };

    const emitter = createEmitterCustomData(config, startRadius);
    const effectLifetimeMs = computeEffectLifetime(config, emitter);
    const waveLifetimeMs = Math.max(1, config.lifetimeMs);

    const customData: ExplosionRendererCustomData = {
      waveLifetimeMs,
      emitter,
    };

    const id = this.options.scene.addObject("explosion", {
      position: { ...options.position },
      size: { width: startRadius * 2, height: startRadius * 2 },
      fill: createWaveFill(startRadius, wave.startAlpha, wave.gradientStops),
      customData,
    });

    this.explosions.push({
      id,
      position: { ...options.position },
      elapsedMs: 0,
      waveLifetimeMs: Math.max(1, config.lifetimeMs),
      effectLifetimeMs,
      wave,
    });
  }

  private updateExplosion(explosion: ExplosionState): void {
    const waveProgress = clamp01(
      explosion.elapsedMs / Math.max(1, explosion.waveLifetimeMs)
    );
    const radius = lerp(
      explosion.wave.startRadius,
      explosion.wave.endRadius,
      waveProgress
    );
    const waveAlpha = lerp(
      explosion.wave.startAlpha,
      explosion.wave.endAlpha,
      waveProgress
    );

    this.options.scene.updateObject(explosion.id, {
      position: { ...explosion.position },
      size: { width: radius * 2, height: radius * 2 },
      fill: createWaveFill(radius, waveAlpha, explosion.wave.gradientStops),
    });
  }

  private clearExplosions(): void {
    this.explosions.forEach((explosion) => {
      this.options.scene.removeObject(explosion.id);
    });
    this.explosions = [];
  }
}

const createWaveFill = (
  radius: number,
  alpha: number,
  gradientStops: readonly SceneGradientStop[]
): SceneFill => ({
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: radius,
  stops: gradientStops.map((stop) => ({
    offset: stop.offset,
    color: {
      r: stop.color.r,
      g: stop.color.g,
      b: stop.color.b,
      a: clamp01((typeof stop.color.a === "number" ? stop.color.a : 1) * alpha),
    },
  })),
});

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

