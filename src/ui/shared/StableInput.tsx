import { useCallback, useEffect, useRef, useState } from "react";

interface StableInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> {
  readonly value: string | number;
  readonly onCommit: (value: string) => void;
}

/**
 * Keeps a local draft while focused so caret/selection does not jump during frequent parent updates.
 */
export const StableInput: React.FC<StableInputProps> = ({
  value,
  onCommit,
  onFocus,
  onBlur,
  onKeyDown,
  ...inputProps
}) => {
  const [draftValue, setDraftValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);
  const focusStartValueRef = useRef(String(value));

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(String(value));
    }
  }, [isFocused, value]);

  const commitDraftIfChanged = useCallback(() => {
    if (draftValue === focusStartValueRef.current) {
      return;
    }
    onCommit(draftValue);
  }, [draftValue, onCommit]);

  return (
    <input
      {...inputProps}
      value={draftValue}
      onFocus={(event) => {
        focusStartValueRef.current = String(value);
        setIsFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        commitDraftIfChanged();
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        onKeyDown?.(event);
      }}
      onChange={(event) => {
        setDraftValue(event.target.value);
      }}
    />
  );
};
