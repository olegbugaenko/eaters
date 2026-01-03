import { classNames } from "@ui-shared/classNames";
import { CampTabKey } from "../CampContent";
import "./CampTabsMenu.css";

type CampTabsMenuProps = {
  activeTab: CampTabKey;
  onChange: (tab: CampTabKey) => void;
  modulesUnlocked: boolean;
  buildingsUnlocked: boolean;
  craftingUnlocked: boolean;
};

export const CampTabsMenu: React.FC<CampTabsMenuProps> = ({
  activeTab,
  onChange,
  modulesUnlocked,
  buildingsUnlocked,
  craftingUnlocked,
}) => {
  const tabs: { key: CampTabKey; label: string }[] = [
    { key: "maps", label: "Map Selector" },
    { key: "skills", label: "Skill Tree" },
  ];

  if (modulesUnlocked) {
    tabs.push({ key: "modules", label: "Biolab" });
  }

  if (craftingUnlocked) {
    tabs.push({ key: "crafting", label: "Crafting" });
  }

  if (buildingsUnlocked) {
    tabs.push({ key: "buildings", label: "Buildings" });
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
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
