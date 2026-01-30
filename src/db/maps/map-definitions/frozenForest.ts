import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { circleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import { brickTreeDeterministic } from "../helpers/bush-helper";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: 200, y: 200 };
  const lakeRadius = 450;

  const createRectangle = (
    x: number,
    y: number,
    width: number,
    height: number,
  ): SceneVector2[] => [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];

  const createTriangle = (
    baseCenter: SceneVector2,
    width: number,
    height: number,
  ): SceneVector2[] => [
    { x: baseCenter.x, y: baseCenter.y - height },
    { x: baseCenter.x + width / 2, y: baseCenter.y },
    { x: baseCenter.x - width / 2, y: baseCenter.y },
  ];

  const treeConfigs: readonly { base: SceneVector2; scale: number }[] = [
    { base: { x: 300, y: 300 }, scale: 0.8 },
    { base: { x: 1200, y: 400 }, scale: 0.9 },
    { base: { x: 200, y: 900 }, scale: 0.85 },
    { base: { x: 1100, y: 1100 }, scale: 0.95 },
    { base: { x: 1300, y: 800 }, scale: 0.75 },
    { base: { x: 400, y: 1200 }, scale: 0.8 },
  ];

  return {
    name: "Frozen Forest",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 3, y: -1 },
    icon: "frozen_forest.png",
    lockedForDemo: true,
    visualEffects: {
      snowfall: {
        emitter: {
          particlesPerSecond: 180,
          particleLifetimeMs: 5200,
          fadeStartMs: 4200,
          fadeInMs: 200,
          sizeRange: { min: 0.8, max: 2.4 },
          color: { r: 0.95, g: 0.98, b: 1, a: 0.9 },
          shape: "circle",
          baseSpeed: 0.03,
          speedVariation: 0.02,
          direction: Math.PI / 2,
          spread: Math.PI / 10,
          maxParticles: 700,
        },
        spawnArea: {
          height: 160,
          horizontalPadding: 220,
          topOffset: 0,
        },
        cullPadding: 220,
      },
    },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const iceLevel = baseLevel;
      const treeTrunkLevel = baseLevel;
      const treeCanopyLevel = baseLevel + 1;

      const frozenLake = circleWithBricks(
        "smallIce",
        {
          center,
          innerRadius: 0,
          outerRadius: lakeRadius,
        },
        { level: iceLevel },
      );

      const bush1 = brickTreeDeterministic({
        origin: { x: 1180, y: 480 },
        size: 260,
        mainBranchThickness: 19,
        twigThickness: 18,
        trunkThickness: 38,
        sideBranchesCount: 4,
        branchingsPerSide: 2,
        topBranchesCount: 2,
        minSideAngleDeg: 60,
        sideSpreadRad: Math.PI * 0.1,
        topSpreadRad: Math.PI * 0.22,
        twigSpreadRad: Math.PI * 0.25,
        branchStartT: 0.25,
        bendTrunkPx: 22,
        bendTopPx: 10,
        bendSidePx: 18,
        bendTwigPx: 10,
        brickType: "smallWood",
        brickLevel: treeCanopyLevel,
        spacing: 26,
        angleJitterRad: 0.72,
        lenJitter: 0.12,
        bendJitter: 0.3,
        verticalBias: 0.22,
        //heightJitterT: 0.27,
      });

      const bush2 = brickTreeDeterministic({
        origin: { x: 1250, y: 980 },
        size: 260,
        mainBranchThickness: 19,
        twigThickness: 18,
        trunkThickness: 38,
        sideBranchesCount: 3,
        branchingsPerSide: 2,
        topBranchesCount: 3,
        minSideAngleDeg: 60,
        sideSpreadRad: Math.PI * 0.4,
        topSpreadRad: Math.PI * 0.42,
        twigSpreadRad: Math.PI * 0.15,
        branchStartT: 0.25,
        bendTrunkPx: 22,
        bendTopPx: 10,
        bendSidePx: 18,
        bendTwigPx: 10,
        brickType: "smallWood",
        brickLevel: treeCanopyLevel,
        spacing: 26,
        angleJitterRad: 0.72,
        lenJitter: 0.12,
        bendJitter: 0.3,
        verticalBias: 0.22,
        //heightJitterT: 0.27,
      });

      const bush3 = brickTreeDeterministic({
        origin: { x: 1150, y: 1180 },
        size: 160,
        mainBranchThickness: 19,
        twigThickness: 18,
        trunkThickness: 38,
        sideBranchesCount: 2,
        branchingsPerSide: 3,
        topBranchesCount: 3,
        minSideAngleDeg: 60,
        branchesLenMul: 1.4,
        sideSpreadRad: Math.PI * 0.4,
        topSpreadRad: Math.PI * 0.42,
        twigSpreadRad: Math.PI * 0.15,
        branchStartT: 0.05,
        branchEndT: 0.25,
        bendTrunkPx: 22,
        bendTopPx: 10,
        bendSidePx: 18,
        bendTwigPx: 10,
        brickType: "smallWood",
        brickLevel: treeCanopyLevel,
        spacing: 26,
        angleJitterRad: 0.72,
        lenJitter: 0.12,
        bendJitter: 0.3,
        verticalBias: 0.22,
        //heightJitterT: 0.27,
      });

      const bush4 = brickTreeDeterministic({
        origin: { x: 250, y: 980 },
        size: 360,
        mainBranchThickness: 19,
        twigThickness: 18,
        trunkThickness: 38,
        sideBranchesCount: 6,
        branchingsPerSide: 2,
        topBranchesCount: 3,
        minSideAngleDeg: 60,
        sideSpreadRad: Math.PI * 0.4,
        topSpreadRad: Math.PI * 0.42,
        twigSpreadRad: Math.PI * 0.15,
        branchStartT: 0.15,
        bendTrunkPx: 22,
        bendTopPx: 10,
        bendSidePx: 18,
        bendTwigPx: 10,
        brickType: "smallWood",
        brickLevel: treeCanopyLevel,
        spacing: 26,
        angleJitterRad: 0.72,
        lenJitter: 0.12,
        bendJitter: 0.3,
        verticalBias: 0.22,
        twigAt: [0.25, 0.45, 0.65],
        //heightJitterT: 0.27,
      });

      return [frozenLake, ...bush1, ...bush2, ...bush3, ...bush4];
    },
    playerUnits: [
      {
        type: "bluePentagon",
        position: { ...spawnPoint },
      },
    ],
    unlockedBy: [
      {
        type: "map",
        id: "silverRing",
        level: 1,
      },
    ],
    mapsRequired: { silverRing: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
