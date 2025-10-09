export interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
  fallback?: string;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

const getCacheKey = (options: Required<Omit<FormatNumberOptions, "fallback">>) =>
  `${options.minimumFractionDigits}:${options.maximumFractionDigits}:${options.useGrouping}`;

const getFormatter = (
  options: Required<Omit<FormatNumberOptions, "fallback">>
): Intl.NumberFormat => {
  const key = getCacheKey(options);
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
    useGrouping: options.useGrouping,
  });
  formatterCache.set(key, formatter);
  return formatter;
};

const DEFAULT_OPTIONS: Required<Omit<FormatNumberOptions, "fallback">> = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: false,
};

export const formatNumber = (
  value: number,
  options: FormatNumberOptions = {}
): string => {
  const { fallback = "0", ...formatOptions } = options;
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const mergedOptions: Required<Omit<FormatNumberOptions, "fallback">> = {
    ...DEFAULT_OPTIONS,
    ...formatOptions,
  };

  const formatter = getFormatter(mergedOptions);
  return formatter.format(value);
};
