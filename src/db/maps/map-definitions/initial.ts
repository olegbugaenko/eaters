import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { circleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = {
  name: "Initial Grounds",
  size: { width: 1200, height: 1200 },
  icon: "initial.png",
  unlockedBy: [
    {
      type: "map",
      id: "foundations",
      level: 1,
    },
  ],
  nodePosition: { x: 2, y: 2 },
  bricks: ({ mapLevel }) => {
    const baseLevel = Math.max(0, Math.floor(mapLevel));
    const innerLevel = baseLevel + 1;
    const center: SceneVector2 = { x: 600, y: 600 };
    const largeCircle = circleWithBricks(
      "smallSquareGray",
      {
        center,
        innerRadius: 210,
        outerRadius: 250,
      },
      { level: innerLevel },
    );

    const largeYellowCircle = circleWithBricks(
      "smallSquareYellow",
      {
        center,
        innerRadius: 150,
        outerRadius: 210,
      },
      { level: baseLevel },
    );

    const satelliteCount = 8;
    const satelliteRadius = 80;
    const orbitRadius = 350 + satelliteRadius;

    const satellites = Array.from({ length: satelliteCount }, (_, index) => {
      const angle = (index / satelliteCount) * Math.PI * 2;
      const position: SceneVector2 = {
        x: center.x + Math.cos(angle) * orbitRadius,
        y: center.y + Math.sin(angle) * orbitRadius,
      };
      return circleWithBricks(
        "smallSquareGray",
        {
          center: position,
          innerRadius: satelliteRadius * 0.6,
          outerRadius: satelliteRadius,
        },
        { level: baseLevel + 0.5 },
      );
    });

    const satellitesInner = Array.from(
      { length: satelliteCount },
      (_, index) => {
        const angle = (index / satelliteCount) * Math.PI * 2;
        const position: SceneVector2 = {
          x: center.x + Math.cos(angle) * orbitRadius,
          y: center.y + Math.sin(angle) * orbitRadius,
        };
        return circleWithBricks(
          "smallSquareYellow",
          {
            center: position,
            innerRadius: 0,
            outerRadius: satelliteRadius * 0.6,
          },
          { level: baseLevel },
        );
      },
    );

    /*const satelliteCountOuter = 32;
    const satelliteRadiusOuter = 100;
    const orbitRadiusOuter = 500 + 700 + satelliteRadius;

    const satellitesOuter = Array.from({ length: satelliteCountOuter }, (_, index) => {
      const angle = (index / satelliteCountOuter) * Math.PI * 2;
      const position: SceneVector2 = {
        x: center.x + Math.cos(angle) * orbitRadiusOuter,
        y: center.y + Math.sin(angle) * orbitRadiusOuter,
      };
      return circleWithBricks(
        "smallSquareGray",
        {
          center: position,
          innerRadius: 0,
          outerRadius: satelliteRadiusOuter,
        },
        { level: baseLevel + 0.25 }
      );
    });
    */
    return [
      largeCircle,
      largeYellowCircle,
      ...satellites,
      ...satellitesInner,
    ];
  },
  playerUnits: [
    {
      type: "bluePentagon",
      position: { x: 100, y: 100 },
    },
  ],
  mapsRequired: { foundations: 1 },
  maxLevel: 2,
} satisfies MapConfig;

export default mapConfig;
