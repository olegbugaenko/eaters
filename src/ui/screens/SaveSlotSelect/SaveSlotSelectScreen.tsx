import { Button } from "../../shared/Button";
import "./SaveSlotSelectScreen.css";

interface SaveSlotSelectScreenProps {
  slots: string[];
  onSlotSelect: (slot: string) => void;
}

export const SaveSlotSelectScreen: React.FC<SaveSlotSelectScreenProps> = ({
  slots,
  onSlotSelect,
}) => {
  return (
    <div className="save-slot-screen">
      <h1>Select Save Slot</h1>
      <div className="save-slot-list">
        {slots.map((slot) => (
          <Button key={slot} onClick={() => onSlotSelect(slot)}>
            Slot {slot}
          </Button>
        ))}
      </div>
    </div>
  );
};
