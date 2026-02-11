import { useCallback, useEffect, useState } from "react";

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

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(String(value));
    }
  }, [isFocused, value]);

  const commitDraft = useCallback(() => {
    onCommit(draftValue);
  }, [draftValue, onCommit]);

  return (
    <input
      {...inputProps}
      value={draftValue}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        commitDraft();
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commitDraft();
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
