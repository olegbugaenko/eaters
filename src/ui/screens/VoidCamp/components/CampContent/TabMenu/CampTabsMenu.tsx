import { CampTabKey } from "../CampContent";
import "./CampTabsMenu.css";

type CampTabsMenuProps = {
  activeTab: CampTabKey;
  onChange: (tab: CampTabKey) => void;
  modulesUnlocked: boolean;
};

export const CampTabsMenu: React.FC<CampTabsMenuProps> = ({
  activeTab,
  onChange,
  modulesUnlocked,
}) => {
  const tabs: { key: CampTabKey; label: string; enabled: boolean; lockedReason?: string }[] = [
    { key: "maps", label: "Map Selector", enabled: true },
    { key: "skills", label: "Skill Tree", enabled: true },
    {
      key: "modules",
      label: "Modules",
      enabled: modulesUnlocked,
      lockedReason: "Reach Void Module Fabrication level 1 to unlock.",
    },
  ];

  return (
    <div className="camp-tabs-menu">
      <div className="inline-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const classes = [
            "inline-tabs__button",
            isActive ? "inline-tabs__button--active" : null,
            !tab.enabled ? "inline-tabs__button--disabled" : null,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={tab.key}
              type="button"
              className={classes}
              onClick={() => onChange(tab.key)}
              disabled={!tab.enabled}
              title={!tab.enabled ? tab.lockedReason : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
