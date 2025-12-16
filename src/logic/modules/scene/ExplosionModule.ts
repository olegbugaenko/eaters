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
  ExplosionWaveConfig,
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
  startOuterRadius: number;
  endOuterRadius: number;
  startInnerRadius: number;
  endInnerRadius: number;
  startAlpha: number;
  endAlpha: number;
  gradientStops: readonly SceneGradientStop[];
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
        this.removeExplosionObjects(explosion);
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

    const waveConfigs = getWaveConfigs(config);
    if (waveConfigs.length === 0) {
      return;
    }
    const firstWaveConfig = waveConfigs[0]!;

    const emitter = createEmitterCustomData(
      config,
      computeWaveStartRadius(firstWaveConfig, baseInitialRadius)
    );
    const effectLifetimeMs = computeEffectLifetime(config, emitter);
    const waveLifetimeMs = Math.max(1, config.lifetimeMs);

    const waves: WaveState[] = waveConfigs.map((waveConfig, index) => {
      const startOuterRadius = computeWaveStartRadius(
        waveConfig,
        baseInitialRadius
      );
      const startInnerRadius = computeWaveStartInnerRadius(
        waveConfig,
        startOuterRadius
      );
      const { innerExtension, outerExtension } = computeWaveExtensions(
        waveConfig,
        config.defaultExtensionRadius
      );
      const endOuterRadius = computeWaveEndRadius(
        waveConfig,
        startOuterRadius,
        outerExtension
      );
      const endInnerRadius = computeWaveInnerEndRadius(
        startInnerRadius,
        endOuterRadius,
        innerExtension
      );

      const wave: WaveState = {
        id: "",
        startOuterRadius,
        endOuterRadius,
        startInnerRadius,
        endInnerRadius,
        startAlpha: waveConfig.startAlpha,
        endAlpha: waveConfig.endAlpha,
        gradientStops: waveConfig.gradientStops,
      };

      const customData: ExplosionRendererCustomData = {
        waveLifetimeMs,
        emitter: index === 0 ? emitter : undefined,
      };

      wave.id = this.options.scene.addObject("explosion", {
        position: { ...options.position },
        size: { width: startOuterRadius * 2, height: startOuterRadius * 2 },
        fill: createWaveFill(
          startInnerRadius,
          startOuterRadius,
          wave.startAlpha,
          wave.gradientStops
        ),
        customData,
      });

      return wave;
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
      const outerRadius = lerp(
        wave.startOuterRadius,
        wave.endOuterRadius,
        waveProgress
      );
      const innerRadius = lerp(
        wave.startInnerRadius,
        wave.endInnerRadius,
        waveProgress
      );
      const clampedOuterRadius = Math.max(0, outerRadius);
      const clampedInnerRadius = clamp(innerRadius, 0, clampedOuterRadius);
      const waveAlpha = lerp(wave.startAlpha, wave.endAlpha, waveProgress);

      this.options.scene.updateObject(wave.id, {
        position: { ...explosion.position },
        size: { width: clampedOuterRadius * 2, height: clampedOuterRadius * 2 },
        fill: createWaveFill(
          clampedInnerRadius,
          clampedOuterRadius,
          waveAlpha,
          wave.gradientStops
        ),
      });
    });
  }

  private clearExplosions(): void {
    this.explosions.forEach((explosion) => {
      this.removeExplosionObjects(explosion);
    });
    this.explosions = [];
  }

  private removeExplosionObjects(explosion: ExplosionState): void {
    explosion.waves.forEach((wave) => {
      this.options.scene.removeObject(wave.id);
    });
  }
}

const createWaveFill = (
  innerRadius: number,
  outerRadius: number,
  alpha: number,
  gradientStops: readonly SceneGradientStop[]
): SceneFill => {
  const safeOuterRadius = Math.max(outerRadius, 0);
  const normalizedInnerRadius = safeOuterRadius <= 0
    ? 0
    : clamp01(innerRadius / safeOuterRadius);
  const colorizeStop = (stop: SceneGradientStop): SceneGradientStop => ({
    offset: normalizedInnerRadius + (1 - normalizedInnerRadius) * clamp01(stop.offset),
    color: {
      r: stop.color.r,
      g: stop.color.g,
      b: stop.color.b,
      a: clamp01((typeof stop.color.a === "number" ? stop.color.a : 1) * alpha),
    },
  });

  const normalizedStops = gradientStops.map(colorizeStop);
  const firstColor = normalizedStops[0]?.color ?? {
    r: 1,
    g: 1,
    b: 1,
    a: 0,
  };

  const stops: SceneGradientStop[] = [];
  if (normalizedInnerRadius > 0) {
    const transparentColor = { ...firstColor, a: 0 };
    stops.push({ offset: 0, color: transparentColor });
    stops.push({ offset: normalizedInnerRadius, color: transparentColor });
  }
  stops.push(...normalizedStops);

  return {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    end: safeOuterRadius,
    stops,
  };
};

const computeWaveStartRadius = (
  waveConfig: ExplosionWaveConfig,
  fallbackRadius: number
): number => Math.max(1, waveConfig.radiusInitial ?? fallbackRadius);

const computeWaveStartInnerRadius = (
  waveConfig: ExplosionWaveConfig,
  outerStartRadius: number
): number => clamp(Math.max(0, waveConfig.radiusInnerInitial ?? 0), 0, outerStartRadius);

const computeWaveExtensions = (
  waveConfig: ExplosionWaveConfig,
  defaultExtensionRadius: number
): { innerExtension: number; outerExtension: number } => {
  const useDefaultExtension =
    typeof waveConfig.radiusExtension !== "number" &&
    typeof waveConfig.radiusInnerExtension !== "number";

  const outerExtension = Math.max(
    0,
    waveConfig.radiusExtension ?? (useDefaultExtension ? defaultExtensionRadius : 0)
  );
  const innerExtension = Math.max(
    0,
    waveConfig.radiusInnerExtension ?? (useDefaultExtension ? defaultExtensionRadius : 0)
  );

  return { innerExtension, outerExtension };
};

const computeWaveEndRadius = (
  waveConfig: ExplosionWaveConfig,
  startRadius: number,
  extension: number
): number => {
  if (typeof waveConfig.outerRadius === "number") {
    return Math.max(startRadius, waveConfig.outerRadius);
  }
  return startRadius + Math.max(0, extension);
};

const computeWaveInnerEndRadius = (
  startInnerRadius: number,
  maxOuterRadius: number,
  extension: number
): number => {
  const endInnerRadius = startInnerRadius + Math.max(0, extension);
  return clamp(endInnerRadius, 0, maxOuterRadius);
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

const getWaveConfigs = (
  config: ExplosionConfig
): readonly ExplosionWaveConfig[] => {
  if (Array.isArray(config.waves) && config.waves.length > 0) {
    return config.waves;
  }
  if (config.wave) {
    return [config.wave];
  }
  return [];
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

