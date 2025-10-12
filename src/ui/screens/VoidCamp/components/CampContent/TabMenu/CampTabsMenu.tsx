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
  const tabs: { key: CampTabKey; label: string }[] = [
    { key: "maps", label: "Map Selector" },
    { key: "skills", label: "Skill Tree" },
  ];

  if (modulesUnlocked) {
    tabs.push({ key: "modules", label: "Modules" });
  }

  return (
    <div className="camp-tabs-menu">
      <div className="inline-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const classes = [
            "inline-tabs__button",
            isActive ? "inline-tabs__button--active" : null,
          ]
            .filter(Boolean)
            .join(" ");

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
