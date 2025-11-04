import { SceneSize, SceneVector2 } from "../../../logic/services/SceneObjectManager";

export interface GpuInstancedPrimitiveLifecycle<TBatch> {
  onContextAcquired(gl: WebGL2RenderingContext): void;
  onContextLost(gl: WebGL2RenderingContext): void;
  ensureBatch(gl: WebGL2RenderingContext, capacity: number): TBatch | null;
  beforeRender(gl: WebGL2RenderingContext, timestampMs: number): void;
  render(
    gl: WebGL2RenderingContext,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number,
  ): void;
  clearInstances(gl?: WebGL2RenderingContext): void;
  dispose(): void;
}
