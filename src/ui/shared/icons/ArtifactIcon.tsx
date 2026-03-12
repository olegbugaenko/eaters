import { useState } from "react";
import { getAssetUrl } from "@shared/helpers/assets.helper";
import { classNames } from "@ui-shared/classNames";
import "./ArtifactIcon.css";

export interface ArtifactIconProps {
  readonly icon?: string;
  readonly name: string;
  readonly size?: number;
  readonly className?: string;
}

const getArtifactIconUrl = (icon: string): string =>
  getAssetUrl(`images/artifacts/${icon}`);

export const ArtifactIcon: React.FC<ArtifactIconProps> = ({
  icon,
  name,
  size = 32,
  className,
}) => {
  const [imageError, setImageError] = useState(false);
  const showLetter = !icon || imageError;
  const letter = name ? name.charAt(0).toUpperCase() : "?";

  if (showLetter) {
    return (
      <span
        className={classNames("artifact-icon", "artifact-icon--letter", className)}
        style={{ width: size, height: size, fontSize: size * 0.55 }}
        aria-hidden
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      src={getArtifactIconUrl(icon)}
      alt=""
      className={classNames("artifact-icon", "artifact-icon--image", className)}
      width={size}
      height={size}
      onError={() => setImageError(true)}
      aria-hidden
    />
  );
};
