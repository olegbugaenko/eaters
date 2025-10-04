import { GameModule } from "../core/types";
import {
  CUSTOM_DATA_KIND_PARTICLE_SYSTEM,
  FILL_TYPES,
  ParticleSystemCustomData,
  SceneColor,
  SceneFill,
  SceneGradientStop,
  SceneObjectManager,
  SceneVector2,
} from "../services/SceneObjectManager";
import {
  ExplosionConfig,
  ExplosionType,
  getExplosionConfig,
} from "../../db/explosions-db";

interface ExplosionModuleOptions {
  scene: SceneObjectManager;
}

interface ParticleState {
  position: SceneVector2;
  velocity: SceneVector2;
  ageMs: number;
  lifetimeMs: number;
  fadeStartMs: number;
  size: number;
}

interface ParticleEmitterOptions {
  emissionDurationMs: number;
  particlesPerSecond: number;
  baseSpeed: number;
  speedVariation: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  sizeRange: { min: number; max: number };
  spawnRadius: { min: number; max: number };
  color: SceneColor;
  arc: number;
  direction: number;
  fill: SceneFill;
}

interface ParticleEmitterState {
  options: ParticleEmitterOptions;
  elapsedMs: number;
  spawnAccumulator: number;
  particles: ParticleState[];
  capacity: number;
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
  lifetimeMs: number;
  wave: WaveState;
  emitter: ParticleEmitterState;
  renderPayload: ParticleSystemCustomData;
}

export interface SpawnExplosionOptions {
  position: SceneVector2;
  initialRadius: number;
}

export interface SpawnExplosionByTypeOptions {
  position: SceneVector2;
  initialRadius?: number;
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
      this.updateExplosion(explosion, deltaMs);
      const waveExpired = explosion.elapsedMs >= explosion.lifetimeMs;
      const emitterActive =
        explosion.emitter.elapsedMs < explosion.emitter.options.emissionDurationMs;
      const hasParticles = explosion.emitter.particles.length > 0;

      if (waveExpired && !emitterActive && !hasParticles) {
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

    const emitter = this.createEmitterState(options.initialRadius, config);

    const renderPayload: ParticleSystemCustomData = {
      kind: CUSTOM_DATA_KIND_PARTICLE_SYSTEM,
      capacity: emitter.capacity,
      count: 0,
      positions: new Float32Array(emitter.capacity * 2),
      sizes: new Float32Array(emitter.capacity),
      alphas: new Float32Array(emitter.capacity),
      color: { ...emitter.options.color },
      fill: cloneFill(emitter.options.fill),
    };

    const id = this.options.scene.addObject("explosion", {
      position: { ...options.position },
      size: { width: startRadius * 2, height: startRadius * 2 },
      fill: createWaveFill(startRadius, wave.startAlpha, wave.gradientStops),
      customData: renderPayload,
    });

    this.explosions.push({
      id,
      position: { ...options.position },
      elapsedMs: 0,
      lifetimeMs: config.lifetimeMs,
      wave,
      emitter,
      renderPayload,
    });
  }

  private updateExplosion(explosion: ExplosionState, deltaMs: number): void {
    explosion.elapsedMs += deltaMs;
    const waveProgress = clamp01(explosion.elapsedMs / explosion.lifetimeMs);
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

    this.updateEmitter(explosion, deltaMs);
    this.updateRenderPayload(explosion);

    this.options.scene.updateObject(explosion.id, {
      position: { ...explosion.position },
      size: { width: radius * 2, height: radius * 2 },
      fill: createWaveFill(radius, waveAlpha, explosion.wave.gradientStops),
      customData: explosion.renderPayload,
    });
  }

  private updateEmitter(explosion: ExplosionState, deltaMs: number): void {
    const emitter = explosion.emitter;
    const options = emitter.options;
    const previousElapsed = emitter.elapsedMs;
    emitter.elapsedMs += deltaMs;

    const activeDelta = Math.max(
      0,
      Math.min(deltaMs, options.emissionDurationMs - previousElapsed)
    );

    if (activeDelta > 0) {
      const particlesPerMs = options.particlesPerSecond / 1_000;
      emitter.spawnAccumulator += particlesPerMs * activeDelta;
      while (emitter.spawnAccumulator >= 1) {
        emitter.spawnAccumulator -= 1;
        emitter.particles.push(
          this.createParticle(explosion.position, emitter.options)
        );
      }
    }

    const survivors: ParticleState[] = [];
    emitter.particles.forEach((particle) => {
      particle.ageMs += deltaMs;
      if (particle.ageMs >= particle.lifetimeMs) {
        return;
      }
      particle.position = {
        x: particle.position.x + particle.velocity.x * deltaMs,
        y: particle.position.y + particle.velocity.y * deltaMs,
      };
      survivors.push(particle);
    });

    emitter.particles = survivors;
  }

  private updateRenderPayload(explosion: ExplosionState): void {
    const { renderPayload, emitter } = explosion;
    const capacity = Math.max(0, renderPayload.capacity);

    if (renderPayload.positions.length !== capacity * 2) {
      renderPayload.positions = new Float32Array(capacity * 2);
    }
    if (renderPayload.sizes.length !== capacity) {
      renderPayload.sizes = new Float32Array(capacity);
    }
    if (renderPayload.alphas.length !== capacity) {
      renderPayload.alphas = new Float32Array(capacity);
    }

    const activeCount = Math.min(emitter.particles.length, capacity);
    renderPayload.count = activeCount;

    for (let i = 0; i < activeCount; i += 1) {
      const particle = emitter.particles[i]!;
      renderPayload.positions[i * 2] = particle.position.x;
      renderPayload.positions[i * 2 + 1] = particle.position.y;
      renderPayload.sizes[i] = particle.size;
      renderPayload.alphas[i] = this.computeParticleAlpha(particle);
    }

    for (let i = activeCount; i < capacity; i += 1) {
      renderPayload.positions[i * 2] = explosion.position.x;
      renderPayload.positions[i * 2 + 1] = explosion.position.y;
      renderPayload.sizes[i] = 0;
      renderPayload.alphas[i] = 0;
    }
  }

  private computeParticleAlpha(particle: ParticleState): number {
    if (particle.fadeStartMs >= particle.lifetimeMs) {
      return 1;
    }
    if (particle.ageMs <= particle.fadeStartMs) {
      return 1;
    }
    const fadeDuration = particle.lifetimeMs - particle.fadeStartMs;
    const fadeProgress = clamp01((particle.ageMs - particle.fadeStartMs) / fadeDuration);
    return 1 - fadeProgress;
  }

  private createEmitterState(
    initialRadius: number,
    config: ExplosionConfig
  ): ParticleEmitterState {
    const spawnRadiusMax = Math.max(
      config.emitter.spawnRadius.max,
      initialRadius * config.emitter.spawnRadiusMultiplier
    );
    const options: ParticleEmitterOptions = {
      emissionDurationMs: config.emitter.emissionDurationMs,
      particlesPerSecond: config.emitter.particlesPerSecond,
      baseSpeed: config.emitter.baseSpeed,
      speedVariation: config.emitter.speedVariation,
      particleLifetimeMs: config.emitter.particleLifetimeMs,
      fadeStartMs: config.emitter.fadeStartMs,
      sizeRange: { ...config.emitter.sizeRange },
      spawnRadius: {
        min: config.emitter.spawnRadius.min,
        max: spawnRadiusMax,
      },
      color: { ...config.emitter.color },
      arc: sanitizeArc(config.emitter.arc),
      direction: sanitizeAngle(config.emitter.direction),
      fill: cloneFill(config.emitter.fill ?? createSolidFill(config.emitter.color)),
    };

    return {
      options,
      elapsedMs: 0,
      spawnAccumulator: 0,
      particles: [],
      capacity: computeEmitterCapacity(options),
    };
  }

  private createParticle(
    center: SceneVector2,
    options: ParticleEmitterOptions
  ): ParticleState {
    const direction = pickParticleDirection(options);
    const speed = Math.max(
      0,
      options.baseSpeed + (Math.random() * 2 - 1) * options.speedVariation
    );
    const radius = randomRange(options.spawnRadius.min, options.spawnRadius.max);
    const offsetAngle = pickSpawnAngle(options, direction);
    const startPosition = {
      x: center.x + Math.cos(offsetAngle) * radius,
      y: center.y + Math.sin(offsetAngle) * radius,
    };
    const lifetime = Math.max(1, options.particleLifetimeMs);
    const fadeStart = clamp(options.fadeStartMs, 0, lifetime);
    const size = randomRange(options.sizeRange.min, options.sizeRange.max);

    return {
      position: startPosition,
      velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
      ageMs: 0,
      lifetimeMs: lifetime,
      fadeStartMs: fadeStart,
      size,
    };
  }

  private clearExplosions(): void {
    this.explosions.forEach((explosion) => {
      this.options.scene.removeObject(explosion.id);
    });
    this.explosions = [];
  }
}

function createWaveFill(
  radius: number,
  alpha: number,
  gradientStops: readonly SceneGradientStop[]
) {
  return {
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
  };
}

const TWO_PI = Math.PI * 2;

const sanitizeArc = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return TWO_PI;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= TWO_PI) {
    return TWO_PI;
  }
  return value;
};

const sanitizeAngle = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return normalizeAngle(value);
};

const pickParticleDirection = (options: ParticleEmitterOptions): number => {
  const arc = Math.max(0, options.arc);
  if (arc === 0) {
    return options.direction;
  }
  if (arc >= TWO_PI - 1e-6) {
    return Math.random() * TWO_PI;
  }
  const halfArc = arc / 2;
  const offset = Math.random() * arc - halfArc;
  return normalizeAngle(options.direction + offset);
};

const pickSpawnAngle = (
  options: ParticleEmitterOptions,
  direction: number
): number => {
  const arc = Math.max(0, options.arc);
  if (arc === 0) {
    return direction;
  }
  if (arc >= TWO_PI - 1e-6) {
    return Math.random() * TWO_PI;
  }
  const halfArc = arc / 2;
  const offset = Math.random() * arc - halfArc;
  return normalizeAngle(options.direction + offset);
};

const normalizeAngle = (angle: number): number => {
  const wrapped = angle % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
};

const createSolidFill = (color: SceneColor): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: color.r,
    g: color.g,
    b: color.b,
    a: typeof color.a === "number" ? color.a : 1,
  },
});

const cloneFill = (fill: SceneFill): SceneFill => {
  switch (fill.fillType) {
    case FILL_TYPES.SOLID:
      return {
        fillType: FILL_TYPES.SOLID,
        color: { ...fill.color },
      };
    case FILL_TYPES.LINEAR_GRADIENT:
      return {
        fillType: FILL_TYPES.LINEAR_GRADIENT,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end ? { ...fill.end } : undefined,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
      };
    case FILL_TYPES.RADIAL_GRADIENT:
    case FILL_TYPES.DIAMOND_GRADIENT:
      return {
        fillType: fill.fillType,
        start: fill.start ? { ...fill.start } : undefined,
        end: fill.end,
        stops: fill.stops.map((stop) => ({
          offset: stop.offset,
          color: { ...stop.color },
        })),
      };
    default:
      return {
        fillType: FILL_TYPES.SOLID,
        color: { r: 1, g: 1, b: 1, a: 1 },
      };
  }
};

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp01(value: number): number {
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
}

function clamp(value: number, min: number, max: number): number {
  if (value <= min) {
    return min;
  }
  if (value >= max) {
    return max;
  }
  return value;
}

function randomRange(min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
}

function computeEmitterCapacity(options: ParticleEmitterOptions): number {
  const rate = Math.max(0, options.particlesPerSecond);
  if (rate <= 0) {
    return 0;
  }
  const emissionWindowMs = Math.max(
    0,
    Math.min(options.emissionDurationMs, options.particleLifetimeMs)
  );
  if (emissionWindowMs <= 0) {
    return 0;
  }
  const base = (rate * emissionWindowMs) / 1000;
  const slack = rate / 60;
  return Math.max(1, Math.ceil(base + slack));
}
