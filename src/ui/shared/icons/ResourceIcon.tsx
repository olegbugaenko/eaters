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
const WOOD_RING_PATH = "M12 3C7.029 3 3 7.029 3 12C3 16.971 7.029 21 12 21C16.971 21 21 16.971 21 12C21 7.029 16.971 3 12 3ZM12 5.5C15.59 5.5 18.5 8.41 18.5 12C18.5 15.59 15.59 18.5 12 18.5C8.41 18.5 5.5 15.59 5.5 12C5.5 8.41 8.41 5.5 12 5.5Z";
const WOOD_HEARTWOOD_PATH = "M12 8.2C9.653 8.2 7.7 10.153 7.7 12.5C7.7 14.847 9.653 16.8 12 16.8C14.347 16.8 16.3 14.847 16.3 12.5C16.3 10.153 14.347 8.2 12 8.2Z";
const WOOD_GRAIN_PATH =
  "M12 6.6C8.91 6.6 6.4 9.11 6.4 12.2C6.4 14.1 7.33 15.77 8.78 16.87L9.52 15.9C8.42 15.08 7.76 13.75 7.76 12.2C7.76 9.86 9.66 7.96 12 7.96C14.34 7.96 16.24 9.86 16.24 12.2C16.24 13.75 15.58 15.08 14.48 15.9L15.22 16.87C16.67 15.77 17.6 14.1 17.6 12.2C17.6 9.11 15.09 6.6 12 6.6Z";
const COPPER_RING_PATH = "M12 3.5C7.30558 3.5 3.5 7.30558 3.5 12C3.5 16.6944 7.30558 20.5 12 20.5C16.6944 20.5 20.5 16.6944 20.5 12C20.5 7.30558 16.6944 3.5 12 3.5ZM12 5.7C15.472 5.7 18.3 8.528 18.3 12C18.3 15.472 15.472 18.3 12 18.3C8.528 18.3 5.7 15.472 5.7 12C5.7 8.528 8.528 5.7 12 5.7Z";
const COPPER_COIL_PATH =
  "M8 12C8 9.79086 9.79086 8 12 8C13.2091 8 14.3184 8.51281 15.1213 9.32226L13.929 10.5146C13.494 10.0796 12.777 9.8 12 9.8C10.565 9.8 9.4 10.965 9.4 12.4C9.4 13.835 10.565 15 12 15C12.777 15 13.494 14.7204 13.929 14.2854L15.1213 15.4777C14.3184 16.2872 13.2091 16.8 12 16.8C9.79086 16.8 8 15.0091 8 12.8Z";
const COPPER_SPARK_PATH =
  "M16.4 8.2L18.4 6.2L17.2 10L19.8 11L17.2 12L18.4 15.8L16.4 13.8L15.8 16.4L14.8 13.8L12.8 15.8L14 12L11.4 11L14 10L12.8 6.2L14.8 8.2L15.4 5.6L16.4 8.2Z";

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
    case "wood":
      return (
        <svg className="resource-icon__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={WOOD_RING_PATH} fill="#92400e" stroke="#451a03" strokeWidth="1.4" strokeLinejoin="round" />
          <path d={WOOD_GRAIN_PATH} fill="#b45309" opacity="0.85" stroke="none" />
          <path d={WOOD_HEARTWOOD_PATH} fill="#f59e0b" opacity="0.6" stroke="#7c2d12" strokeWidth="0.8" />
        </svg>
      );
    case "copper":
      return (
        <svg className="resource-icon__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={COPPER_RING_PATH} fill="#f97316" stroke="#7c2d12" strokeWidth="1.3" strokeLinejoin="round" />
          <path d={COPPER_COIL_PATH} fill="#fb923c" stroke="#7c2d12" strokeWidth="0.9" strokeLinecap="round" />
          <path d={COPPER_SPARK_PATH} fill="#fef3c7" opacity="0.75" stroke="#fcd34d" strokeWidth="0.6" />
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
