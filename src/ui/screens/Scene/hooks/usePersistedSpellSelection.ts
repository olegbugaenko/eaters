import { useCallback, useEffect, useRef, useState } from "react";
import { SpellId, SPELL_IDS } from "@db/spells-db";
import { SpellOption } from "@logic/modules/active-map/spellcasting/spellcasting.types";

const STORAGE_KEY = "selectedSpellId";

export const usePersistedSpellSelection = (spellOptions: SpellOption[]) => {
  const [selectedSpellId, setSelectedSpellId] = useState<SpellId | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SPELL_IDS.includes(stored as SpellId)) {
        return stored as SpellId;
      }
    } catch {
      // ignore localStorage errors
    }
    return null;
  });
  const selectedSpellIdRef = useRef<SpellId | null>(null);

  useEffect(() => {
    selectedSpellIdRef.current = selectedSpellId;
    if (typeof window !== "undefined") {
      if (selectedSpellId) {
        localStorage.setItem(STORAGE_KEY, selectedSpellId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [selectedSpellId]);

  useEffect(() => {
    if (spellOptions.length === 0) {
      return;
    }
    if (!selectedSpellId) {
      setSelectedSpellId(spellOptions[0]!.id);
      return;
    }
    const stillAvailable = spellOptions.some((spell) => spell.id === selectedSpellId);
    if (!stillAvailable) {
      setSelectedSpellId(spellOptions[0]!.id);
    }
  }, [selectedSpellId, spellOptions]);

  const handleSelectSpell = useCallback((spellId: SpellId) => {
    setSelectedSpellId((current) => (current === spellId ? null : spellId));
  }, []);

  return { selectedSpellId, selectedSpellIdRef, handleSelectSpell } as const;
};
