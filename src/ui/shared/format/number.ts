export interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
  fallback?: string;
  compact?: boolean;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

const getCacheKey = (options: Required<Omit<FormatNumberOptions, "fallback" | "compact">>) =>
  `${options.minimumFractionDigits}:${options.maximumFractionDigits}:${options.useGrouping}`;

const getFormatter = (
  options: Required<Omit<FormatNumberOptions, "fallback" | "compact">>
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

const DEFAULT_FORMAT_OPTIONS: Required<Omit<FormatNumberOptions, "fallback" | "compact">> = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: false,
};

const DEFAULT_COMPACT = true;

type CompactThreshold = {
  value: number;
  suffix: string;
};

const COMPACT_THRESHOLDS: CompactThreshold[] = [
  { value: 1_000_000_000_000, suffix: "T" },
  { value: 1_000_000_000, suffix: "B" },
  { value: 1_000_000, suffix: "M" },
  { value: 1_000, suffix: "K" },
];

interface CompactFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

const formatCompactNumber = (
  value: number,
  compactOptions?: CompactFormatOptions,
): string => {
  const absValue = Math.abs(value);
  const minDecimals = compactOptions?.minimumFractionDigits ?? 0;
  const maxDecimals = compactOptions?.maximumFractionDigits;

  for (let index = 0; index < COMPACT_THRESHOLDS.length; index += 1) {
    const { value: threshold, suffix } = COMPACT_THRESHOLDS[index]!;
    if (absValue < threshold) {
      continue;
    }

    const scaled = value / threshold;
    const absScaled = Math.abs(scaled);
    const integerDigits = absScaled === 0 ? 1 : Math.floor(Math.log10(absScaled)) + 1;
    const suggestedDecimals = Math.max(0, 3 - integerDigits);
    const decimals = maxDecimals === 0 ? 0 : Math.max(suggestedDecimals, minDecimals);
    const factor = 10 ** decimals;
    const rounded = Math.round(scaled * factor) / factor;

    // If rounding pushes us to the next magnitude (e.g. 999.9K -> 1M),
    // recompute using the next larger threshold.
    if (Math.abs(rounded) >= 1000 && index > 0) {
      const next = COMPACT_THRESHOLDS[index - 1]!;
      const nextScaled = value / next.value;
      const nextAbsScaled = Math.abs(nextScaled);
      const nextIntegerDigits =
        nextAbsScaled === 0 ? 1 : Math.floor(Math.log10(nextAbsScaled)) + 1;
      const nextSuggestedDecimals = Math.max(0, 3 - nextIntegerDigits);
      const nextDecimals = maxDecimals === 0 ? 0 : Math.max(nextSuggestedDecimals, minDecimals);
      const nextFactor = 10 ** nextDecimals;
      const nextRounded = Math.round(nextScaled * nextFactor) / nextFactor;
      const nextFormatted =
        nextDecimals > 0 ? nextRounded.toFixed(nextDecimals) : nextRounded.toString();
      const nextTrimmed =
        minDecimals > 0
          ? nextFormatted
          : nextDecimals > 0
            ? nextFormatted.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
            : nextFormatted;
      return `${nextTrimmed}${next.suffix}`;
    }

    const formatted = decimals > 0 ? rounded.toFixed(decimals) : rounded.toString();
    const trimmed =
      minDecimals > 0
        ? formatted
        : decimals > 0
          ? formatted.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
          : formatted;
    return `${trimmed}${suffix}`;
  }

  return value.toString();
};

export const formatNumber = (
  value: number,
  options: FormatNumberOptions = {}
): string => {
  const { fallback = "0", compact = DEFAULT_COMPACT, ...formatOptions } = options;
  if (!Number.isFinite(value)) {
    return fallback;
  }

  if (compact) {
    const compactOptions: CompactFormatOptions = {
      minimumFractionDigits: formatOptions.minimumFractionDigits,
      maximumFractionDigits: formatOptions.maximumFractionDigits,
    };
    const compactValue = formatCompactNumber(value, compactOptions);
    if (compactValue !== value.toString()) {
      return compactValue;
    }
  }

  const mergedOptions: Required<Omit<FormatNumberOptions, "fallback" | "compact">> = {
    ...DEFAULT_FORMAT_OPTIONS,
    ...formatOptions,
  };

  const formatter = getFormatter(mergedOptions);
  return formatter.format(value);
};
