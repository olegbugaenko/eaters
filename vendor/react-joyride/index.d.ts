import * as React from "react";

export type StepTarget = string | Element | null | undefined;

export interface Step {
  target: StepTarget;
  title?: React.ReactNode;
  content?: React.ReactNode;
  placement?: "auto" | "top" | "bottom" | "center";
  disableBeacon?: boolean;
  spotlightPadding?: number;
  styles?: {
    spotlight?: {
      borderRadius?: number;
    };
  };
}

export interface TooltipRenderProps {
  backProps?: React.HTMLAttributes<HTMLButtonElement>;
  closeProps: React.HTMLAttributes<HTMLButtonElement>;
  continuous: boolean;
  index: number;
  primaryProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  size: number;
  skipProps?: React.HTMLAttributes<HTMLButtonElement>;
  step: Step;
  tooltipProps: React.HTMLAttributes<HTMLElement>;
}

export interface CallBackProps {
  action: ACTIONS | string;
  index: number;
  status: STATUS;
  step: Step;
  type: EVENTS;
}

export enum EVENTS {
  STEP_AFTER = "step:after",
  TARGET_NOT_FOUND = "error:target_not_found",
}

export enum STATUS {
  RUNNING = "running",
  FINISHED = "finished",
  SKIPPED = "skipped",
}

export enum ACTIONS {
  NEXT = "next",
  PREV = "prev",
  CLOSE = "close",
  SKIP = "skip",
}

export interface JoyrideStylesOptions {
  overlayColor?: string;
  zIndex?: number;
  arrowColor?: string;
  backgroundColor?: string;
  textColor?: string;
  primaryColor?: string;
}

export interface JoyrideStyles {
  options?: JoyrideStylesOptions;
}

export interface LocaleStrings {
  back?: string;
  close?: string;
  last?: string;
  next?: string;
  skip?: string;
}

export interface JoyrideProps {
  steps: Step[];
  stepIndex?: number;
  run?: boolean;
  continuous?: boolean;
  showSkipButton?: boolean;
  hideBackButton?: boolean;
  disableCloseOnEsc?: boolean;
  disableOverlayClose?: boolean;
  locale?: LocaleStrings;
  styles?: JoyrideStyles;
  tooltipComponent?: React.ComponentType<TooltipRenderProps>;
  callback?: (data: CallBackProps) => void;
}

declare const Joyride: React.FC<JoyrideProps>;

export default Joyride;
