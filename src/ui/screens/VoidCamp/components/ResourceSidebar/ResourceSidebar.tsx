import { ResourceAmountPayload } from "@logic/modules/shared/ResourcesModule";
import { ResourceIcon } from "@shared/icons/ResourceIcon";
import "./ResourceSidebar.css";
import { formatNumber } from "@shared/format/number";

interface ResourceSidebarProps {
  resources: ResourceAmountPayload[];
}

export const ResourceSidebar: React.FC<ResourceSidebarProps> = ({ resources }) => {
  return (
    <div className="resource-sidebar stack-lg">
      {resources.length > 0 ? (
        <ul className="resource-sidebar__list list-reset stack-sm">
          {resources.map((resource) => (
            <li key={resource.id} className="resource-sidebar__item surface-card">
              <ResourceIcon resourceId={resource.id} className="resource-sidebar__icon" label={resource.name} />
              <span className="resource-sidebar__value">{formatNumber(resource.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No resources collected yet.</p>
      )}
    </div>
  );
};
