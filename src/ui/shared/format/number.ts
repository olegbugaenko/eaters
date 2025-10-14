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

const formatCompactNumber = (value: number): string => {
  const absValue = Math.abs(value);

  for (const { value: threshold, suffix } of COMPACT_THRESHOLDS) {
    if (absValue < threshold) {
      continue;
    }

    const scaled = value / threshold;
    const absScaled = Math.abs(scaled);
    const integerDigits = absScaled === 0 ? 1 : Math.floor(Math.log10(absScaled)) + 1;
    const decimals = Math.max(0, 3 - integerDigits);
    const factor = 10 ** decimals;
    const truncated = Math.trunc(scaled * factor) / factor;
    const formatted = decimals > 0 ? truncated.toFixed(decimals) : truncated.toString();
    const trimmed = decimals > 0 ? formatted.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1") : formatted;
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
    const compactValue = formatCompactNumber(value);
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
