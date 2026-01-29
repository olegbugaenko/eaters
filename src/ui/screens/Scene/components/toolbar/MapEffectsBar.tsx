import { memo } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import { ProgressBar } from "@ui-shared/ProgressBar";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { MAP_EFFECTS_BRIDGE_KEY } from "@logic/modules/active-map/map/map.const";

interface MapEffectsBarProps {
  bridge: DataBridge;
}

export const MapEffectsBar = memo(({ bridge }: MapEffectsBarProps) => {
  const mapEffects = useBridgeValue(bridge, MAP_EFFECTS_BRIDGE_KEY, { radioactivity: null });
  const radioactivity = mapEffects.radioactivity;
  const showRadioactivity = Boolean(radioactivity && radioactivity.maxLevel > 0);

  if (!showRadioactivity) {
    return null;
  }

  return (
    <div className="scene-toolbar__radioactivity">
      <ProgressBar
        className="scene-toolbar__radioactivity-bar"
        current={radioactivity?.level ?? 0}
        max={radioactivity?.maxLevel ?? 0}
        showText={false}
      />
    </div>
  );
});

MapEffectsBar.displayName = "MapEffectsBar";
