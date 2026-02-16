import { classNames } from "@ui-shared/classNames";
import { NewUnlockWrapper } from "@ui-shared/NewUnlockWrapper";
import { useLocalization } from "@ui/shared/useLocalization";
import { CampTabKey } from "../CampContent.helpers";
import "./CampTabsMenu.css";

type CampTopLevelTabKey = Exclude<CampTabKey, "buildings">;

type CampTabsMenuProps = {
  activeTab: CampTopLevelTabKey;
  onChange: (tab: CampTopLevelTabKey) => void;
  modulesUnlocked: boolean;
  buildingsUnlocked: boolean;
  craftingUnlocked: boolean;
  tabHasNew: Record<CampTopLevelTabKey, boolean>;
};

export const CampTabsMenu: React.FC<CampTabsMenuProps> = ({
  activeTab,
  onChange,
  modulesUnlocked,
  buildingsUnlocked,
  craftingUnlocked,
  tabHasNew,
}) => {
  const { t } = useLocalization();
  const tabPathByKey: Record<CampTopLevelTabKey, string> = {
    maps: "maps",
    skills: "skills",
    modules: "biolab",
    crafting: "crafting",
    stronghold: "buildings",
  };
  const tabs: { key: CampTopLevelTabKey; label: string }[] = [
    { key: "maps", label: t("voidCamp.tabs.maps", "Map Selector") },
    { key: "skills", label: t("voidCamp.tabs.skills", "Skill Tree") },
  ];

  if (modulesUnlocked) {
    tabs.push({ key: "modules", label: t("voidCamp.tabs.modules", "Biolab") });
  }

  if (craftingUnlocked) {
    tabs.push({ key: "crafting", label: t("voidCamp.tabs.crafting", "Crafting") });
  }

  if (buildingsUnlocked) {
    tabs.push({ key: "stronghold", label: t("voidCamp.tabs.stronghold", "Stronghold") });
  }

  return (
    <div className="camp-tabs-menu">
      <div className="inline-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const classes = classNames(
            "inline-tabs__button",
            isActive && "inline-tabs__button--active"
          );

          return (
            <button
              key={tab.key}
              type="button"
              className={classes}
              onClick={() => onChange(tab.key)}
            >
              <NewUnlockWrapper path={tabPathByKey[tab.key]} hasNew={tabHasNew[tab.key]}>
                {tab.label}
              </NewUnlockWrapper>
            </button>
          );
        })}
      </div>
    </div>
  );
};
