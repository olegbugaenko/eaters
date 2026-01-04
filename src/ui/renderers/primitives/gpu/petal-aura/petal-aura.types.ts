import type { SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import type { ExtendedGpuBatch } from "../../core/GpuBatchRenderer";

export interface PetalAuraInstance {
  position: SceneVector2;
  basePhase: number;
  active: boolean;
  petalIndex?: number; // Індекс пелюстки всередині об'єкта (0, 1, 2, ...) - додається автоматично у writeInstanceData
  // Конфігураційні параметри (через instance attributes для гнучкості)
  petalCount: number;
  innerRadius: number;
  outerRadius: number;
  petalWidth: number;
  rotationSpeed: number;
  color: [number, number, number]; // RGB
  alpha: number;
  pointInward?: boolean; // Якщо true, пелюстки спрямовані всередину (загостренням до центру)
}

export interface PetalAuraBatch extends ExtendedGpuBatch<PetalAuraInstance> {
  // No additional fields needed
}

export interface PetalAuraSharedResources {
  program: WebGLProgram;
  petalBuffer: WebGLBuffer;
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
  };
  attributes: {
    unitPosition: number;
    center: number;
    basePhase: number;
    petalIndex: number;
    petalCount: number;
    innerRadius: number;
    outerRadius: number;
    petalWidth: number;
    rotationSpeed: number;
    color: number;
    alpha: number;
    active: number;
    pointInward: number;
  };
}
