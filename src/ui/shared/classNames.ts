export type ClassDictionary = Record<string, boolean | null | undefined>;
export type ClassValue =
  | string
  | null
  | undefined
  | false
  | ClassDictionary
  | ClassValue[];

const normalize = (value: ClassValue, result: string[]): void => {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    if (value.trim()) {
      result.push(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => normalize(item, result));
    return;
  }

  Object.entries(value).forEach(([key, condition]) => {
    if (condition) {
      result.push(key);
    }
  });
};

export const classNames = (...values: ClassValue[]): string => {
  const result: string[] = [];
  values.forEach((value) => normalize(value, result));
  return result.join(" ");
};
