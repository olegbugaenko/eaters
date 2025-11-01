import { ResourceId, getResourceConfig } from "@db/resources-db";
import "./ResourceIcon.css";

interface ResourceIconProps {
  readonly resourceId: ResourceId;
  readonly className?: string;
  readonly label?: string;
}

const buildClassName = (base: string, extra?: string): string => {
  if (!extra) {
    return base;
  }
  return `${base} ${extra}`;
};

export const ResourceIcon: React.FC<ResourceIconProps> = ({ resourceId, className, label }) => {
  const resourceLabel = label ?? getResourceConfig(resourceId).name;
  const iconPath = `/images/resources/${resourceId}.svg`;

  return (
    <span className={buildClassName("resource-icon", className)} role="img" aria-label={resourceLabel}>
      <img className="resource-icon__image" src={iconPath} alt="" aria-hidden="true" />
    </span>
  );
};
