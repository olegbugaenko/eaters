import { MutableRefObject, useEffect } from "react";
import { SpellId } from "@db/spells-db";
import { DEFAULT_SPELL_OPTIONS, SPELL_OPTIONS_BRIDGE_KEY } from "@logic/modules/active-map/spellcasting/spellcasting.const";
import { UnitDesignId } from "@logic/modules/camp/unit-design/unit-design.types";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { usePersistedSpellSelection } from "../../hooks/usePersistedSpellSelection";
import type { SceneTooltipContent } from "../tooltip/SceneTooltipPanel";
import { SceneSummoningPanel } from "./SceneSummoningPanel";

interface SceneSummoningPanelContainerProps {
  panelRef: MutableRefObject<HTMLDivElement | null>;
  selectedSpellIdRef: MutableRefObject<SpellId | null>;
  spellCastPulse: { id: SpellId; token: number } | null;
  onSummon: (designId: UnitDesignId) => void;
  onHoverInfoChange: (content: SceneTooltipContent | null) => void;
  onToggleAutomation: (designId: UnitDesignId, enabled: boolean) => void;
}

export const SceneSummoningPanelContainer: React.FC<SceneSummoningPanelContainerProps> = ({
  panelRef,
  selectedSpellIdRef,
  spellCastPulse,
  onSummon,
  onHoverInfoChange,
  onToggleAutomation,
}) => {
  const { bridge } = useAppLogic();
  const spellOptions = useBridgeValue(bridge, SPELL_OPTIONS_BRIDGE_KEY, DEFAULT_SPELL_OPTIONS);
  const { selectedSpellId, handleSelectSpell } = usePersistedSpellSelection(spellOptions);

  useEffect(() => {
    selectedSpellIdRef.current = selectedSpellId;
  }, [selectedSpellId, selectedSpellIdRef]);

  return (
    <SceneSummoningPanel
      ref={panelRef}
      selectedSpellId={selectedSpellId}
      spellCastPulse={spellCastPulse}
      onSelectSpell={handleSelectSpell}
      onSummon={onSummon}
      onHoverInfoChange={onHoverInfoChange}
      onToggleAutomation={onToggleAutomation}
    />
  );
};
