// Instance data: position(2) + size(1) + age(1) + lifetime(1) + isActive(1) + startAlpha(1) + endAlpha(1)
export const INSTANCE_COMPONENTS = 8;
export const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
export const DEFAULT_BATCH_CAPACITY = 512;

// Round float to 2 decimal places for stable batch key
export const r2 = (n: number): string => n.toFixed(2);

// Round color array for batch key (avoid float precision issues)
export const roundColor = (arr: Float32Array): string => {
  return `${r2(arr[0] ?? 0)},${r2(arr[1] ?? 0)},${r2(arr[2] ?? 0)},${r2(arr[3] ?? 0)}`;
};

import type { WaveUniformConfig } from "./explosion-wave.types";

export const serializeWaveConfig = (config: WaveUniformConfig): string => {
  // Simplified batch key - only essential parameters that affect rendering
  // Colors are rounded to avoid float precision creating too many unique batches
  const parts: string[] = [
    `ft:${config.fillType}`,
    `sc:${config.stopCount}`,
  ];
  
  // Add rounded colors (main differentiator for visual appearance)
  if (config.stopCount > 0) {
    parts.push(`c0:${roundColor(config.stopColor0)}`);
  }
  if (config.stopCount > 1) {
    parts.push(`c1:${roundColor(config.stopColor1)}`);
  }
  
  // Add noise if significant
  if (config.noiseColorAmplitude > 0.01 || config.noiseAlphaAmplitude > 0.01) {
    parts.push(`n:${r2(config.noiseScale)}`);
  }
  
  // Add filaments if present
  if ((config.filamentColorContrast ?? 0) > 0.01 || (config.filamentAlphaContrast ?? 0) > 0.01) {
    parts.push(`f:1`);
  }
  
  return parts.join("|");
};
