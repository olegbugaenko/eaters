import { CampTabKey } from "../CampContent";
import "./CampTabsMenu.css";

type CampTabsMenuProps = {
  activeTab: CampTabKey;
  onChange: (tab: CampTabKey) => void;
};

const LABELS: Record<CampTabKey, string> = {
  maps: "Map Selector",
  skills: "Skill Tree",
};

export const CampTabsMenu: React.FC<CampTabsMenuProps> = ({ activeTab, onChange }) => {
  return (
    <div className="camp-tabs-menu">
      <div className="inline-tabs">
        {(Object.keys(LABELS) as CampTabKey[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`inline-tabs__button${
              activeTab === tab ? " inline-tabs__button--active" : ""
            }`}
            onClick={() => onChange(tab)}
          >
            {LABELS[tab]}
          </button>
        ))}
      </div>
    </div>
  );
};
