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
const IRON_HEX_PATH = "M12 2.6L19.5 7V17L12 21.4L4.5 17V7Z";
const IRON_CORE_PATH = "M12 6.1L16.5 8.8V15.2L12 18.9L7.5 15.2V8.8Z";
const ORGANICS_LEAF_PATH =
  "M6.5 19C9 17.5 14.5 14 16.5 9.5C18.3 5.7 15.5 3 12 3C8.2 3 6 5.8 6 9.8C6 13 7 16.5 6.5 19Z";
const ORGANICS_VEIN_PATH = "M9.8 5.2C11.4 8.8 10.6 12.5 7.8 16.2";

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
    case "iron":
      return (
        <svg className="resource-icon__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={IRON_HEX_PATH} fill="#6b7280" stroke="#111827" strokeWidth="1.4" strokeLinejoin="round" />
          <path d={IRON_CORE_PATH} fill="#9ca3af" stroke="#1f2937" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      );
    case "organics":
      return (
        <svg className="resource-icon__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d={ORGANICS_LEAF_PATH}
            fill="#4ade80"
            stroke="#166534"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d={ORGANICS_VEIN_PATH}
            fill="none"
            stroke="#bbf7d0"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
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
