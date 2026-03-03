import type { PlayerUnitRendererConfig } from "@db/player-units-db";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";

export const createJoinedDebugRendererConfig = (): PlayerUnitRendererConfig => ({
  kind: "composite",
  fill: { r: 0.2, g: 0.6, b: 1, a: 1 },
  layers: [
    {
      shape: "polygon",
      vertices: [
        { x: -6, y: -4 },
        { x: 6, y: -4 },
        { x: 0, y: 8 },
      ],
      fill: {
        type: "solid",
        fill: { fillType: FILL_TYPES.SOLID, color: { r: 0.18, g: 0.62, b: 1, a: 0.9 } },
      },
      anim: {
        type: "sway",
        periodMs: 1200,
        amplitude: 2.5,
        axis: "normal",
        phase: 0,
        executionMode: "gpu",
      },
      groupId: "debugAnchor",
      anchors: [{ id: "debugJoin", mode: "vertex", index: 2 }],
    },
    {
      shape: "circle",
      radius: 6,
      segments: 24,
      fill: {
        type: "solid",
        fill: { fillType: FILL_TYPES.SOLID, color: { r: 0.95, g: 0.45, b: 0.2, a: 0.85 } },
      },
      join: { anchorId: "debugJoin", targetGroupId: "debugAnchor" },
    },
  ],
});
