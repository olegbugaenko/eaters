/// <reference types="react-scripts" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';
    readonly PUBLIC_URL: string;
  }
}

declare interface Window {
  electronAPI?: {
    platform: string;
    versions: NodeJS.ProcessVersions;
  };
}
