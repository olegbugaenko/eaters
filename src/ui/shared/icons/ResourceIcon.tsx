import { ResourceId, getResourceConfig } from "@db/resources-db";
import "./ResourceIcon.css";

interface ResourceIconProps {
  readonly resourceId: ResourceId;
  readonly className?: string;
  readonly label?: string;
}

const STONE_PATH =
  "M6.2 4.4 14.9 2l6 6.7-2 9.3-9.6 2.2-4-8.3z";
const STONE_OVERLAY_PATH =
  "M8.3 6.6 14.7 4.8l3.5 3.9-1.3 5.8-6.4 1.5-2.7-5.7z";
const SAND_BASE_PATH =
  "M3.5 16.8 11.9 5.6l8.6 11.2z";
const SAND_HIGHLIGHT_PATH =
  "M11.9 5.6 18.2 14.1l-3.4 2.7-6-3.4z";

const buildClassName = (base: string, extra?: string): string => {
  if (!extra) {
    return base;
  }
  return `${base} ${extra}`;
};

const renderIcon = (resourceId: ResourceId): JSX.Element => {
  switch (resourceId) {
    case "stone":
      return (
        <svg className="resource-icon__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={STONE_PATH} fill="#9ca3af" stroke="#4b5563" strokeWidth="1.6" strokeLinejoin="round" />
          <path
            d={STONE_OVERLAY_PATH}
            fill="#cbd5f5"
            opacity="0.4"
            stroke="#64748b"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "sand":
      return (
        <svg className="resource-icon__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={SAND_BASE_PATH} fill="#f9d977" stroke="#b45309" strokeWidth="1.4" strokeLinejoin="round" />
          <path d={SAND_HIGHLIGHT_PATH} fill="#fde68a" opacity="0.7" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg className="resource-icon__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="10" fill="#6b7280" />
        </svg>
      );
  }
};

export const ResourceIcon: React.FC<ResourceIconProps> = ({ resourceId, className, label }) => {
  const resourceLabel = label ?? getResourceConfig(resourceId).name;
  return (
    <span className={buildClassName("resource-icon", className)} role="img" aria-label={resourceLabel}>
      {renderIcon(resourceId)}
    </span>
  );
};
