import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  circleWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1400, height: 900 };
  // Sphinx lying down, facing left
  // Body center point
  const bodyX = 700;
  const bodyY = 550;
  // Spawn point far from sphinx (top right corner)
  const spawnPoint: SceneVector2 = { x: size.width - 150, y: 150 };

  return {
    name: "Sand Sphinx",
    size,
    icon: "sphynx.png",
    spawnPoints: [spawnPoint],
    nodePosition: { x: 2, y: 1 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const sandLevel = baseLevel + 2;

      // === BODY (lying lion, with curved back) ===
      // Main body - wider polygon with curved appearance
      const bodyMain = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: bodyX - 280, y: bodyY - 80 }, // front top
            { x: bodyX - 100, y: bodyY - 100 }, // mid-front top (curved up)
            { x: bodyX + 100, y: bodyY - 110 }, // mid-back top (highest point)
            { x: bodyX + 280, y: bodyY - 80 }, // back top
            { x: bodyX + 300, y: bodyY + 50 }, // back bottom
            { x: bodyX - 280, y: bodyY + 50 }, // front bottom
          ],
        },
        { level: sandLevel },
      );

      // Belly (adds roundness underneath)
      const belly = circleWithBricks(
        "smallSquareYellow",
        {
          center: { x: bodyX, y: bodyY + 20 },
          innerRadius: 0,
          outerRadius: 80,
        },
        { level: sandLevel },
      );

      // Haunches (back raised part - larger for folded hind legs)
      const haunches = circleWithBricks(
        "smallSquareYellow",
        {
          center: { x: bodyX + 180, y: bodyY - 50 },
          innerRadius: 0,
          outerRadius: 110,
        },
        { level: sandLevel },
      );

      // Back curve (adds more volume to the back)
      const backCurve = circleWithBricks(
        "smallSquareYellow",
        {
          center: { x: bodyX + 50, y: bodyY - 80 },
          innerRadius: 0,
          outerRadius: 70,
        },
        { level: sandLevel },
      );

      // === CHEST (raised front part) ===
      const chest = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: bodyX - 340, y: bodyY - 140 },
            { x: bodyX - 240, y: bodyY - 140 },
            { x: bodyX - 220, y: bodyY - 40 },
            { x: bodyX - 340, y: bodyY - 40 },
          ],
        },
        { level: sandLevel },
      );

      // === NECK (shorter, connects to head) ===
      const neck = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: bodyX - 380, y: bodyY - 200 },
            { x: bodyX - 300, y: bodyY - 200 },
            { x: bodyX - 260, y: bodyY - 130 },
            { x: bodyX - 360, y: bodyY - 130 },
          ],
        },
        { level: sandLevel },
      );

      // === HEAD (human profile facing left) ===
      // Back of head (rounded)
      const headBack = circleWithBricks(
        "smallSquareYellow",
        {
          center: { x: bodyX - 360, y: bodyY - 260 },
          innerRadius: 0,
          outerRadius: 70,
        },
        { level: sandLevel },
      );

      // Face (polygon for profile - forehead, nose, chin)
      const face = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: bodyX - 430, y: bodyY - 320 }, // forehead
            { x: bodyX - 480, y: bodyY - 280 }, // nose tip
            { x: bodyX - 470, y: bodyY - 250 }, // under nose
            { x: bodyX - 480, y: bodyY - 220 }, // lips
            { x: bodyX - 450, y: bodyY - 190 }, // chin
            { x: bodyX - 400, y: bodyY - 200 }, // jaw
            { x: bodyX - 380, y: bodyY - 260 }, // cheek
            { x: bodyX - 400, y: bodyY - 310 }, // temple
          ],
        },
        { level: sandLevel },
      );

      // Nemes headdress (flows down sides)
      const nemesBack = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: bodyX - 320, y: bodyY - 300 },
            { x: bodyX - 280, y: bodyY - 300 },
            { x: bodyX - 260, y: bodyY - 180 },
            { x: bodyX - 300, y: bodyY - 180 },
          ],
        },
        { level: sandLevel },
      );

      // Crown/top of headdress
      const crown = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: bodyX - 420, y: bodyY - 360 },
            { x: bodyX - 340, y: bodyY - 360 },
            { x: bodyX - 320, y: bodyY - 320 },
            { x: bodyX - 430, y: bodyY - 320 },
          ],
        },
        { level: sandLevel },
      );

      // === FRONT PAWS (extended forward, connected to body) ===
      // Left front paw (closer, starts from chest)
      const frontPawLeft = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: bodyX - 450, y: bodyY },
            { x: bodyX - 300, y: bodyY },
            { x: bodyX - 300, y: bodyY + 50 },
            { x: bodyX - 450, y: bodyY + 50 },
          ],
        },
        { level: sandLevel },
      );

      // Right front paw (slightly behind and lower)
      const frontPawRight = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: bodyX - 400, y: bodyY + 40 },
            { x: bodyX - 250, y: bodyY + 40 },
            { x: bodyX - 250, y: bodyY + 90 },
            { x: bodyX - 400, y: bodyY + 90 },
          ],
        },
        { level: sandLevel },
      );

      // Paw ends (toes)
      const pawEndLeft = circleWithBricks(
        "smallSquareYellow",
        {
          center: { x: bodyX - 450, y: bodyY + 25 },
          innerRadius: 0,
          outerRadius: 30,
        },
        { level: sandLevel },
      );

      const pawEndRight = circleWithBricks(
        "smallSquareYellow",
        {
          center: { x: bodyX - 400, y: bodyY + 65 },
          innerRadius: 0,
          outerRadius: 28,
        },
        { level: sandLevel },
      );

      // === HIND LEG (left, visible from side - extended like front paws) ===
      // Upper thigh (connects to haunches)
      const hindThighLeft = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: bodyX + 80, y: bodyY - 20 },
            { x: bodyX + 160, y: bodyY - 20 },
            { x: bodyX + 180, y: bodyY + 40 },
            { x: bodyX + 100, y: bodyY + 40 },
          ],
        },
        { level: sandLevel },
      );

      // Lower leg (extends forward like front paws)
      const hindLegLeft = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: bodyX + 60, y: bodyY + 30 },
            { x: bodyX + 180, y: bodyY + 30 },
            { x: bodyX + 180, y: bodyY + 80 },
            { x: bodyX + 60, y: bodyY + 80 },
          ],
        },
        { level: sandLevel },
      );

      // Hind paw (like front paws)
      const hindPawLeft = circleWithBricks(
        "smallSquareYellow",
        {
          center: { x: bodyX + 60, y: bodyY + 55 },
          innerRadius: 0,
          outerRadius: 32,
        },
        { level: sandLevel },
      );

      // === TAIL (more horizontal, along the ground) ===
      const tail1 = circleWithBricks(
        "smallSquareYellow",
        {
          center: { x: bodyX + 330, y: bodyY + 30 },
          innerRadius: 0,
          outerRadius: 35,
        },
        { level: sandLevel },
      );

      const tail2 = circleWithBricks(
        "smallSquareYellow",
        {
          center: { x: bodyX + 380, y: bodyY + 20 },
          innerRadius: 0,
          outerRadius: 30,
        },
        { level: sandLevel },
      );

      const tail3 = circleWithBricks(
        "smallSquareYellow",
        {
          center: { x: bodyX + 420, y: bodyY + 15 },
          innerRadius: 0,
          outerRadius: 25,
        },
        { level: sandLevel },
      );

      // === SAND BASE ===
      const sandBase = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: [
            { x: 150, y: bodyY + 120 },
            { x: size.width - 150, y: bodyY + 120 },
            { x: size.width - 130, y: bodyY + 160 },
            { x: 130, y: bodyY + 160 },
          ],
        },
        { level: sandLevel },
      );

      return [
        sandBase,
        bodyMain,
        belly,
        backCurve,
        haunches,
        chest,
        neck,
        headBack,
        face,
        nemesBack,
        crown,
        frontPawLeft,
        frontPawRight,
        pawEndLeft,
        pawEndRight,
        hindThighLeft,
        hindLegLeft,
        hindPawLeft,
        tail1,
        tail2,
        tail3,
      ];
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
        id: "initial",
        level: 2,
      },
    ],
    mapsRequired: { initial: 2 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
