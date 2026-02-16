export type CampTabKey = "maps" | "skills" | "modules" | "stronghold" | "buildings" | "crafting";
export type CampTopLevelTabKey = Exclude<CampTabKey, "buildings">;

type CampTabHasNew = Record<CampTopLevelTabKey, boolean>;

interface CampTabUnlockState {
  moduleWorkshopUnlocked: boolean;
  buildingsUnlocked: boolean;
  craftingUnlocked: boolean;
}

export const normalizeCampTab = (tab: CampTabKey): CampTopLevelTabKey =>
  tab === "buildings" ? "stronghold" : tab;

export const sanitizeCampTab = (
  tab: CampTabKey,
  unlockState: CampTabUnlockState,
  fallbackTab: CampTopLevelTabKey
): CampTopLevelTabKey => {
  const normalizedTab = normalizeCampTab(tab);

  if (normalizedTab === "modules" && !unlockState.moduleWorkshopUnlocked) {
    return fallbackTab;
  }

  if (normalizedTab === "stronghold" && !unlockState.buildingsUnlocked) {
    return fallbackTab;
  }

  if (normalizedTab === "crafting" && !unlockState.craftingUnlocked) {
    return fallbackTab;
  }

  return normalizedTab;
};

export const buildCampTabHasNew = (
  unseenByPrefix: Record<string, string[]>
): CampTabHasNew => {
  const hasBuildingsUnlocks = (unseenByPrefix.buildings ?? []).length > 0;
  const hasDarkResearchUnlocks = (unseenByPrefix.darkResearch ?? []).length > 0;

  return {
    maps: (unseenByPrefix.maps ?? []).length > 0,
    skills: false,
    modules: (unseenByPrefix.biolab ?? []).length > 0,
    stronghold: hasBuildingsUnlocks || hasDarkResearchUnlocks,
    crafting: (unseenByPrefix.crafting ?? []).length > 0,
  };
};
