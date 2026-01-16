const PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z+.-]*:/;

export const getAssetUrl = (assetPath: string): string => {
  if (!assetPath) {
    return "";
  }

  if (PROTOCOL_REGEX.test(assetPath)) {
    return assetPath;
  }

  const normalizedPath = assetPath.replace(/^\.?\//, "").replace(/^\/+/, "");
  const isFileProtocol =
    typeof window !== "undefined" && window.location?.protocol === "file:";
  const prefix = isFileProtocol ? "./" : "/";

  return `${prefix}${normalizedPath}`;
};
