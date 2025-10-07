import { ResourceAmountPayload } from "@logic/modules/ResourcesModule";
import "./ResourceSidebar.css";

interface ResourceSidebarProps {
  resources: ResourceAmountPayload[];
}

export const ResourceSidebar: React.FC<ResourceSidebarProps> = ({ resources }) => {
  return (
    <div className="resource-sidebar surface-sidebar stack-lg">
      <div className="stack-sm">
        <h2 className="heading-2">Resources</h2>
        <p className="text-muted">
          Track what you have gathered across your incursions.
        </p>
      </div>
      {resources.length > 0 ? (
        <ul className="resource-sidebar__list list-reset stack-sm">
          {resources.map((resource) => (
            <li key={resource.id} className="resource-sidebar__item surface-card">
              <span className="resource-sidebar__name text-strong">{resource.name}</span>
              <span className="resource-sidebar__value">{resource.amount}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No resources collected yet.</p>
      )}
    </div>
  );
};
