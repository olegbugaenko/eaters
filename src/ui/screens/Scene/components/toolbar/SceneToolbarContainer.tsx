import { useSyncExternalStore } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import { SceneToolbar } from "./SceneToolbar";
import type { CameraUiStore } from "../../hooks/useSceneCameraInteraction";

interface SceneToolbarContainerProps {
  bridge: DataBridge;
  cameraUiStore: CameraUiStore;
  onExit: () => void;
  onScaleChange: (value: number) => void;
}

export const SceneToolbarContainer: React.FC<SceneToolbarContainerProps> = ({
  bridge,
  cameraUiStore,
  onExit,
  onScaleChange,
}) => {
  const cameraUiState = useSyncExternalStore(
    cameraUiStore.subscribe,
    cameraUiStore.getSnapshot,
    cameraUiStore.getSnapshot
  );

  return (
    <SceneToolbar
      bridge={bridge}
      onExit={onExit}
      scale={cameraUiState.scale}
      scaleRange={cameraUiState.scaleRange}
      onScaleChange={onScaleChange}
      cameraPosition={cameraUiState.cameraInfo.position}
    />
  );
};
