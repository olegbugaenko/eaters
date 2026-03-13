import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { CampStatisticsSnapshot } from "@logic/modules/shared/statistics/statistics.module";
import type { EventLogEntry } from "@logic/modules/shared/event-log/event-log.types";
import { getMapConfig } from "@/db/maps/maps-db";
import type { MapId } from "@/db/maps/maps-db";
import type { SkillId } from "@/db/skills-db";
import { formatDuration } from "@ui/utils/formatDuration";
import { formatNumber } from "@ui/shared/format/number";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useLocalization } from "@ui/shared/useLocalization";
import { SANITY_DECAY_PER_SECOND } from "@logic/modules/active-map/necromancer/necromancer.const";
import {
  BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY,
  DEFAULT_BUILDINGS_WORKSHOP_STATE,
} from "@logic/modules/camp/buildings/buildings.const";
import {
  DEFAULT_UNIT_MODULE_WORKSHOP_STATE,
  UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
} from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.const";
import {
  CRAFTING_STATE_BRIDGE_KEY,
  DEFAULT_CRAFTING_STATE,
} from "@logic/modules/camp/crafting/crafting.const";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import "./StatisticsModal.css";

interface FavoriteMapInfo {
  name: string;
  attempts: number;
}

interface StatisticsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly timePlayedMs: number;
  readonly favoriteMap: FavoriteMapInfo | null;
  readonly statistics: CampStatisticsSnapshot;
  readonly eventLog: EventLogEntry[];
}

const formatCount = (value: number): string =>
  formatNumber(Math.max(0, Math.floor(value)), {
    maximumFractionDigits: 0,
    useGrouping: true,
    compact: false,
  });

const formatDamage = (value: number): string =>
  formatNumber(Math.max(0, value), {
    maximumFractionDigits: value < 10 ? 1 : 0,
    minimumFractionDigits: value > 0 && value < 10 ? 1 : 0,
    useGrouping: true,
    compact: false,
  });

function formatHistoryEntryText(
  entry: EventLogEntry,
  t: (key: string, fallback?: string) => string,
  getMapName: (mapId: MapId, fallback: string) => string,
  getSkillText: (skillId: SkillId, fallback: { name: string; description: string }) => { name: string; registerEventText?: string },
): string {
  const { type, text, payload } = entry;
  if (!payload) {
    return text;
  }
  if (type === "map-cleared" && payload.mapId != null && payload.level != null) {
    const mapId = payload.mapId as MapId;
    const config = getMapConfig(mapId);
    const mapName = getMapName(mapId, config.name);
    return t("voidCamp.statistics.history.mapCleared", "Map {{mapName}} cleared (Level {{level}})")
      .replace("{{mapName}}", mapName)
      .replace("{{level}}", String(payload.level));
  }
  if (type === "skill-obtained" && payload.skillId) {
    const skill = getSkillText(payload.skillId as SkillId, { name: payload.skillId, description: "" });
    const description = skill.registerEventText ?? payload.eventDescription ?? "";
    return t("voidCamp.statistics.history.skillObtained", "Skill {{name}} obtained: {{description}}")
      .replace("{{name}}", skill.name)
      .replace("{{description}}", description);
  }
  return text;
}

export const StatisticsModal: React.FC<StatisticsModalProps> = ({
  isOpen,
  onClose,
  timePlayedMs,
  favoriteMap,
  statistics,
  eventLog,
}) => {
  const { t } = useLocalization();
  const { uiApi, bridge } = useAppLogic();
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<"general" | "combat" | "history">("general");
  const historyEntries = useMemo(() => {
    return eventLog.map((entry, index) => ({
      id: `${entry.realTimeMs}-${entry.type}-${index}`,
      gameTimeMs: entry.gameTimeMs,
      entry,
    }));
  }, [eventLog]);

  const moduleWorkshopState = useBridgeValue(
    bridge,
    UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
    DEFAULT_UNIT_MODULE_WORKSHOP_STATE,
  );
  const buildingsState = useBridgeValue(
    bridge,
    BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY,
    DEFAULT_BUILDINGS_WORKSHOP_STATE,
  );
  const craftingState = useBridgeValue(
    bridge,
    CRAFTING_STATE_BRIDGE_KEY,
    DEFAULT_CRAFTING_STATE,
  );

  const handleDialogClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("general");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const favoriteMapNote = favoriteMap
    ? `${formatNumber(Math.max(0, favoriteMap.attempts), {
        maximumFractionDigits: 0,
        compact: false,
      })} ${t("voidCamp.statistics.attempts", "attempts")}`
    : t("voidCamp.statistics.noRuns", "No runs recorded yet.");

  interface StatEntry {
    label: string;
    value: string;
    note?: string;
  }

  const stats: StatEntry[] = [
    {
      label: t("saveSelect.slot.timePlayed", "Time Played"),
      value: formatDuration(timePlayedMs),
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.favoriteMap", "Favorite Map"),
      value: favoriteMap ? favoriteMap.name : t("voidCamp.maps.none", "—"),
      note: favoriteMap ? favoriteMapNote : t("voidCamp.statistics.noMapRuns", "No map runs completed yet."),
    },
    {
      label: t("scene.runSummary.bricksDestroyed", "Bricks Destroyed"),
      value: formatCount(statistics.bricksDestroyed),
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.creaturesDied", "Creatures Died"),
      value: formatCount(statistics.creaturesDied),
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.damageDealt", "Damage Dealt"),
      value: formatDamage(statistics.damageDealt),
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.damageTaken", "Damage Taken"),
      value: formatDamage(statistics.damageTaken),
      note: undefined,
    },
  ];

  if (moduleWorkshopState.unlocked) {
    stats.push({
      label: t("voidCamp.statistics.organsUnlocked", "Organs unlocked"),
      value: formatCount(moduleWorkshopState.modules.length),
      note: undefined,
    });
  }

  if (buildingsState.unlocked) {
    stats.push({
      label: t("voidCamp.statistics.buildingsPurchased", "Buildings purchased"),
      value: formatCount(
        buildingsState.buildings.filter((building) => building.level > 0).length,
      ),
      note: undefined,
    });
  }

  if (craftingState.unlocked) {
    stats.push({
      label: t("voidCamp.statistics.materialsCrafted", "Materials crafted"),
      value: formatCount(statistics.materialsCrafted ?? 0),
      note: undefined,
    });
  }

  const bonusValues = uiApi.bonuses.getValues();

  const combatStats: StatEntry[] = [
    {
      label: t("voidCamp.statistics.combat.maxSanity", "Max Sanity"),
      value: formatCount(bonusValues.sanity_cap ?? 0),
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.combat.sanityDrainPerSecond", "Sanity drain per second"),
      value: formatDamage(SANITY_DECAY_PER_SECOND),
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.combat.maxMana", "Max Mana"),
      value: formatCount(bonusValues.mana_cap ?? 0),
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.combat.manaRegenPerSecond", "Mana regen per second"),
      value: formatDamage(bonusValues.mana_regen ?? 0),
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.combat.allUnitsHpMultiplier", "All units HP multiplier"),
      value: `×${formatNumber(bonusValues.all_units_hp_multiplier ?? 1, {
        maximumFractionDigits: 2,
      })}`,
      note: undefined,
    },
    {
      label: t(
        "voidCamp.statistics.combat.allUnitsAttackMultiplier",
        "All units attack multiplier",
      ),
      value: `×${formatNumber(bonusValues.all_units_attack_multiplier ?? 1, {
        maximumFractionDigits: 2,
      })}`,
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.combat.allUnitsArmorBonus", "All units armor bonus"),
      value: formatNumber(bonusValues.all_units_armor ?? 0, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.combat.allUnitsArmorMultiplier", "All units armor multiplier"),
      value: `×${formatNumber(bonusValues.all_units_armor_multiplier ?? 1, {
        maximumFractionDigits: 2,
      })}`,
      note: undefined,
    },
    {
      label: t("voidCamp.statistics.combat.brickRewardsMultiplier", "Brick rewards multiplier"),
      value: `×${formatNumber(bonusValues.brick_rewards ?? 1, {
        maximumFractionDigits: 2,
      })}`,
      note: undefined,
    },
  ];

  if (craftingState.unlocked) {
    combatStats.push({
      label: t(
        "voidCamp.statistics.combat.craftingSpeedMultiplier",
        "Crafting speed multiplier",
      ),
      value: `×${formatNumber(bonusValues.crafting_speed_mult ?? 1, {
        maximumFractionDigits: 2,
      })}`,
      note: undefined,
    });
  }

  return (
    <div className="statistics-modal" onClick={onClose} role="presentation">
      <div
        className="statistics-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={handleDialogClick}
      >
        <header className="statistics-modal__header">
          <div className="statistics-modal__title-group">
            <h2 id={titleId} className="statistics-modal__title">
              {t("voidCamp.topBar.statistics", "Statistics")}
            </h2>
            <div className="inline-tabs statistics-modal__tabs">
              <button
                type="button"
                className={
                  "inline-tabs__button" +
                  (activeTab === "general" ? " inline-tabs__button--active" : "")
                }
                onClick={() => setActiveTab("general")}
              >
                {t("voidCamp.statistics.general", "General Stats")}
              </button>
              <button
                type="button"
                className={
                  "inline-tabs__button" +
                  (activeTab === "combat" ? " inline-tabs__button--active" : "")
                }
                onClick={() => setActiveTab("combat")}
              >
                {t("voidCamp.statistics.combat", "Combat Stats")}
              </button>
              <button
                type="button"
                className={
                  "inline-tabs__button" +
                  (activeTab === "history" ? " inline-tabs__button--active" : "")
                }
                onClick={() => setActiveTab("history")}
              >
                {t("voidCamp.statistics.history", "History")}
              </button>
            </div>
          </div>
          <button type="button" className="statistics-modal__close" onClick={onClose}>
            {t("settings.close", "Close")}
          </button>
        </header>
        <div className="statistics-modal__content">
          {activeTab === "general" ? (
            <ul className="statistics-modal__list">
              {stats.map((entry: StatEntry) => (
                <li key={entry.label} className="statistics-modal__item">
                  <span className="statistics-modal__label">{entry.label}</span>
                  <span className="statistics-modal__value">{entry.value}</span>
                  {entry.note ? (
                    <span className="statistics-modal__note">{entry.note}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : activeTab === "combat" ? (
            <ul className="statistics-modal__list">
              {combatStats.map((entry: StatEntry) => (
                <li key={entry.label} className="statistics-modal__item">
                  <span className="statistics-modal__label">{entry.label}</span>
                  <span className="statistics-modal__value">{entry.value}</span>
                  {entry.note ? (
                    <span className="statistics-modal__note">{entry.note}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="statistics-modal__history">
              {historyEntries.length === 0 ? (
                <div className="statistics-modal__history-empty">
                  {t("voidCamp.statistics.noEvents", "No events recorded yet.")}
                </div>
              ) : (
                <ul className="statistics-modal__history-list">
                  {historyEntries.map((item) => (
                    <li key={item.id} className="statistics-modal__history-item">
                      <span className="statistics-modal__history-time">{formatDuration(item.gameTimeMs)}</span>
                      <span className="statistics-modal__history-separator">—</span>
                      <span className="statistics-modal__history-text">
                        {formatHistoryEntryText(
                          item.entry,
                          t,
                          uiApi.localization.getMapName.bind(uiApi.localization),
                          uiApi.localization.getSkillText.bind(uiApi.localization),
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
