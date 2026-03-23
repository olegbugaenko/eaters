/// <reference types="react-scripts" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';
    readonly PUBLIC_URL: string;
    readonly IS_DEMO?: string;
    readonly IS_STRESSTEST?: string;
    readonly IS_VIDEO_RECORD?: string;
  }
}

declare interface Window {
  electronAPI?: {
    platform: string;
    versions: NodeJS.ProcessVersions;
  };
}
