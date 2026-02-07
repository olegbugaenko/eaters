import { isGaEnabled } from "./ga.helper";

const GA_MEASUREMENT_ID = "G-3VZQC3KZ5F";
const GA_SCRIPT_ID = "ga-gtag-script";

type GtagCommand = "js" | "config" | "event";

type GtagFunction = (command: GtagCommand, target: Date | string, params?: unknown) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFunction;
  }
}

let isInitialized = false;

const ensureDataLayer = (): void => {
  if (!window.dataLayer) {
    window.dataLayer = [];
  }
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }
};

export const initializeGoogleAnalytics = (): void => {
  if (isInitialized || !isGaEnabled()) {
    return;
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  if (document.getElementById(GA_SCRIPT_ID)) {
    isInitialized = true;
    ensureDataLayer();
    window.gtag?.("js", new Date());
    window.gtag?.("config", GA_MEASUREMENT_ID);
    return;
  }
  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
  ensureDataLayer();
  window.gtag?.("js", new Date());
  window.gtag?.("config", GA_MEASUREMENT_ID);
  isInitialized = true;
};

export const trackAnalyticsEvent = (
  name: string,
  params?: Record<string, unknown>
): void => {
  if (!isGaEnabled()) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  if (!window.gtag) {
    return;
  }
  window.gtag("event", name, params);
};
