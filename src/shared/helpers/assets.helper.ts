const PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z+.-]*:/;

export const getAssetUrl = (assetPath: string): string => {
  if (!assetPath) {
    return "";
  }

  if (PROTOCOL_REGEX.test(assetPath)) {
    return assetPath;
  }

  const normalizedPath = assetPath.replace(/^\.?\//, "").replace(/^\/+/, "");
  // Use relative base so assets work when the game is served from a subpath (e.g. itch.io: /html/PROJECT_ID/)
  const prefix = "./";

  return `${prefix}${normalizedPath}`;
};
