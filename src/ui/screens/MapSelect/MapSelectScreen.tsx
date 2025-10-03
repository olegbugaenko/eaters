import { useMemo } from "react";
import { Button } from "../../shared/Button";
import { useAppLogic } from "../../contexts/AppLogicContext";
import { useBridgeValue } from "../../shared/useBridgeValue";
import { TIME_BRIDGE_KEY } from "../../../logic/modules/TestTimeModule";
import "./MapSelectScreen.css";

interface MapSelectScreenProps {
  onStart: () => void;
}

const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const MapSelectScreen: React.FC<MapSelectScreenProps> = ({ onStart }) => {
  const { bridge } = useAppLogic();
  const timePlayed = useBridgeValue<number>(bridge, TIME_BRIDGE_KEY, 0);

  const formatted = useMemo(() => formatTime(timePlayed), [timePlayed]);

  return (
    <div className="map-select-screen">
      <h1>Map Selection</h1>
      <p>Time played: {formatted}</p>
      <Button onClick={onStart}>Start</Button>
    </div>
  );
};
