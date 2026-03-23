export const isVideoRecordBuild = (): boolean =>
  typeof process !== "undefined" && process.env.IS_VIDEO_RECORD === "1";
