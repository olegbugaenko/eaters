import { MutableRefObject, useEffect, useRef } from "react";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import type { BridgeKey, BridgeValue } from "@/core/logic/ui/BridgeSchema";

export const useBridgeRef = <K extends BridgeKey>(
  bridge: DataBridge,
  key: K,
  fallback: BridgeValue<K>,
  onChange?: (value: BridgeValue<K>) => void
): MutableRefObject<BridgeValue<K>> => {
  const valueRef = useRef<BridgeValue<K>>(bridge.getValue(key) ?? fallback);

  useEffect(() => {
    const applyValue = (value: BridgeValue<K> | undefined) => {
      const next = value ?? fallback;
      valueRef.current = next;
      onChange?.(next);
    };

    applyValue(bridge.getValue(key));
    const unsubscribe = bridge.subscribe(key, applyValue);

    return unsubscribe;
  }, [bridge, fallback, key, onChange]);

  return valueRef;
};
