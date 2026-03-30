import type { MapConfig, MapId, MapListEntry } from "./maps-db.types";
import adit from "./map-definitions/adit";
import agressiveClock from "./map-definitions/agressiveClock";
import ancientPyramids from "./map-definitions/ancientPyramids";
import bezierGrove from "./map-definitions/bezierGrove";
import coil from "./map-definitions/coil";
import unknownKnightMonument from "./map-definitions/unknownKnightMonument";
import coalConvoy from "./map-definitions/coalConvoy";
import geologicalExcavations from "./map-definitions/geologicalExcavations";
import fossilizedDinosaur from "./map-definitions/fossilizedDinosaur";
import deadOak from "./map-definitions/deadOak";
import deadlyTunnels from "./map-definitions/deadlyTunnels";
import deathfulGuns from "./map-definitions/deathfulGuns";
import encagedBeast from "./map-definitions/encagedBeast";
import greatOctopus from "./map-definitions/greatOctopus";
import foundations from "./map-definitions/foundations";
import frozenForest from "./map-definitions/frozenForest";
import gear from "./map-definitions/gear";
import initial from "./map-definitions/initial";
import megaBrick from "./map-definitions/megaBrick";
import mine from "./map-definitions/mine";
import oldForge from "./map-definitions/oldForge";
import portalRing from "./map-definitions/portalRing";
import silverChalice from "./map-definitions/silverChalice";
import silverRing from "./map-definitions/silverRing";
import snakeNest from "./map-definitions/snakeNest";
import impenetrableJungle from "./map-definitions/impenetrableJungle";
import sphinx from "./map-definitions/sphinx";
import spiralSleeves from "./map-definitions/spiralSleeves";
import desertCrater from "./map-definitions/desertCrater";
import nautilusShell from "./map-definitions/nautilusShell";
import spruce from "./map-definitions/spruce";
import stoneCottage from "./map-definitions/stoneCottage";
import thicket from "./map-definitions/thicket";
import theWheel from "./map-definitions/theWheel";
import trainingGrounds from "./map-definitions/trainingGrounds";
import transformer from "./map-definitions/transformer";
import twinbladeAxe from "./map-definitions/twinbladeAxe";
import automobile from "./map-definitions/automobile";
import turretRings from "./map-definitions/turretRings";
import tutorialZone from "./map-definitions/tutorialZone";
import uraniumFields from "./map-definitions/uranium_fields";
import volcano from "./map-definitions/volcano";
import hotCorridors from "./map-definitions/hotCorridors";
import wire from "./map-definitions/wire";

export type {
  MapBrickGenerator,
  MapBrickGeneratorOptions,
  MapConfig,
  MapEnemyGenerator,
  MapEnemyGeneratorOptions,
  MapEnemySpawnPointConfig,
  MapEnemySpawnTypeConfig,
  MapId,
  MapListEntry,
  MapNodePosition,
  MapPlayerUnitConfig,
} from "./maps-db.types";

const MAPS_DB: Record<MapId, MapConfig> = {
  tutorialZone,
  trainingGrounds,
  foundations,
  initial,
  turretRings,
  thicket,
  oldForge,
  spruce,
  deadOak,
  theWheel,
  agressiveClock,
  sphinx,
  spiralSleeves,
  desertCrater,
  nautilusShell,
  stoneCottage,
  bezierGrove,
  snakeNest,
  impenetrableJungle,
  wire,
  coil,
  unknownKnightMonument,
  mine,
  adit,
  silverRing,
  portalRing,
  silverChalice,
  frozenForest,
  volcano,
  hotCorridors,
  gear,
  twinbladeAxe,
  automobile,
  megaBrick,
  ancientPyramids,
  deathfulGuns,
  deadlyTunnels,
  encagedBeast,
  greatOctopus,
  coalConvoy,
  geologicalExcavations,
  fossilizedDinosaur,
  transformer,
  uranium_fields: uraniumFields,
};

export const MAP_IDS = Object.keys(MAPS_DB) as MapId[];

export const getMapConfig = (mapId: MapId): MapConfig => {
  const config = MAPS_DB[mapId];
  if (!config) {
    throw new Error(`Unknown map: ${mapId}`);
  }
  return config;
};

export const isMapId = (value: unknown): value is MapId =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(MAPS_DB, value);

export const getMapList = (): MapListEntry[] =>
  MAP_IDS.map((mapId) => {
    const config = MAPS_DB[mapId];
    return {
      id: mapId,
      name: config.name,
      size: { ...config.size },
      icon: config.icon,
    };
  });
