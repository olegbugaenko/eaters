import React from "react";
import "./SceneTooltipPanel.css";

export interface SceneTooltipStat {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}

export interface SceneTooltipContent {
  readonly title: string;
  readonly subtitle?: string;
  readonly stats: readonly SceneTooltipStat[];
  readonly footer?: string;
}

interface SceneTooltipPanelProps {
  readonly content: SceneTooltipContent | null;
}

export const SceneTooltipPanel: React.FC<SceneTooltipPanelProps> = ({ content }) => {
  const isVisible = Boolean(content);

  return (
    <div
      className={`scene-tooltip-panel ${
        isVisible ? "scene-tooltip-panel--visible" : ""
      }`}
      aria-hidden={!isVisible}
    >
      {content && (
        <>
          <div className="scene-tooltip-panel__header">
            <div className="scene-tooltip-panel__title">{content.title}</div>
            {content.subtitle ? (
              <div className="scene-tooltip-panel__subtitle">{content.subtitle}</div>
            ) : null}
          </div>
          <dl className="scene-tooltip-panel__stats">
            {content.stats.map((stat) => (
              <div key={stat.label} className="scene-tooltip-panel__stat">
                <dt className="scene-tooltip-panel__stat-label">{stat.label}</dt>
                <dd className="scene-tooltip-panel__stat-value">
                  <span>{stat.value}</span>
                  {stat.hint ? (
                    <span className="scene-tooltip-panel__stat-hint">{stat.hint}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
          {content.footer ? (
            <div className="scene-tooltip-panel__footer">{content.footer}</div>
          ) : null}
        </>
      )}
    </div>
  );
};
