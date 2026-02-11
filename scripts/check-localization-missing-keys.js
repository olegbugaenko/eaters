#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();
const LANG_DB_PATH = path.join(ROOT_DIR, "src", "db", "languages-db.ts");
const LOCALES_DIR = path.join(ROOT_DIR, "src", "localization");
const BASE_LOCALE = "en";
const DOMAIN_FILES = [
  "ui.json",
  "maps.json",
  "skills.json",
  "unit-modules.json",
  "buildings.json",
  "resources.json",
  "spells.json",
];
const LOGS_DIR = path.join(ROOT_DIR, "logs");

const args = process.argv.slice(2);
const failOnMissing = args.includes("--fail-on-missing");
const quiet = args.includes("--quiet");

const parseLanguageCodesFromDb = () => {
  const source = fs.readFileSync(LANG_DB_PATH, "utf8");
  const match = source.match(/LANGUAGE_CODES\s*=\s*\[([^\]]+)\]/m);
  if (!match) {
    throw new Error(`Unable to find LANGUAGE_CODES in ${LANG_DB_PATH}`);
  }
  const body = match[1];
  const codes = [...body.matchAll(/"([a-z]{2})"/g)].map((m) => m[1]);
  if (codes.length === 0) {
    throw new Error(`No language codes found in LANGUAGE_CODES at ${LANG_DB_PATH}`);
  }
  return codes;
};

const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const ensureLogsDir = () => {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
};

const formatTimestamp = (date) => {
  const pad = (v) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
};

const collectMissingKeysReport = () => {
  const languageCodes = parseLanguageCodesFromDb();
  const otherLocales = languageCodes.filter((code) => code !== BASE_LOCALE);

  const report = {
    generatedAt: new Date().toISOString(),
    baseLocale: BASE_LOCALE,
    checkedDomains: DOMAIN_FILES,
    checkedLocales: otherLocales,
    missingByLocale: {},
  };

  let totalMissing = 0;

  for (const locale of otherLocales) {
    const domainReport = {};
    let localeMissing = 0;

    for (const domainFile of DOMAIN_FILES) {
      const basePath = path.join(LOCALES_DIR, BASE_LOCALE, domainFile);
      const localePath = path.join(LOCALES_DIR, locale, domainFile);
      const baseJson = readJson(basePath);
      if (!baseJson) {
        throw new Error(`Base localization file not found: ${basePath}`);
      }
      const baseKeys = Object.keys(baseJson);
      const localeJson = readJson(localePath);

      if (!localeJson) {
        domainReport[domainFile] = {
          file: path.relative(ROOT_DIR, localePath),
          missingCount: baseKeys.length,
          missingKeys: [...baseKeys],
          note: "locale file is missing",
        };
        localeMissing += baseKeys.length;
        continue;
      }

      const missingKeys = baseKeys.filter((key) => !(key in localeJson));
      domainReport[domainFile] = {
        file: path.relative(ROOT_DIR, localePath),
        missingCount: missingKeys.length,
        missingKeys,
      };
      localeMissing += missingKeys.length;
    }

    report.missingByLocale[locale] = {
      missingCount: localeMissing,
      domains: domainReport,
    };
    totalMissing += localeMissing;
  }

  return { report, totalMissing };
};

const writeLogs = (report) => {
  ensureLogsDir();
  const timestamp = formatTimestamp(new Date());
  const jsonLogName = `localization-missing-keys-${timestamp}.json`;
  const txtLogName = `localization-missing-keys-${timestamp}.txt`;
  const jsonLogPath = path.join(LOGS_DIR, jsonLogName);
  const txtLogPath = path.join(LOGS_DIR, txtLogName);

  fs.writeFileSync(jsonLogPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  const lines = [];
  lines.push("Localization missing keys report");
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push(`Base locale: ${report.baseLocale}`);
  lines.push(`Domains: ${report.checkedDomains.join(", ")}`);
  lines.push("");

  for (const locale of report.checkedLocales) {
    const entry = report.missingByLocale[locale];
    lines.push(`[${locale}]`);
    lines.push(`Missing keys: ${entry.missingCount}`);
    for (const domainFile of report.checkedDomains) {
      const domain = entry.domains[domainFile];
      lines.push(`  [${domainFile}] Missing: ${domain.missingCount}`);
      if (domain.note) {
        lines.push(`    Note: ${domain.note}`);
      }
      if (domain.missingKeys.length > 0) {
        lines.push("    Keys:");
        for (const key of domain.missingKeys) {
          lines.push(`      - ${key}`);
        }
      }
    }
    lines.push("");
  }

  fs.writeFileSync(txtLogPath, lines.join("\n"), "utf8");

  return {
    jsonLog: path.relative(ROOT_DIR, jsonLogPath),
    txtLog: path.relative(ROOT_DIR, txtLogPath),
  };
};

const main = () => {
  const { report, totalMissing } = collectMissingKeysReport();
  const { jsonLog, txtLog } = writeLogs(report);

  if (!quiet) {
    console.log("Report written:");
    console.log(`- ${jsonLog}`);
    console.log(`- ${txtLog}`);
    console.log(`Total missing keys across locales: ${totalMissing}`);
  }

  if (failOnMissing && totalMissing > 0) {
    console.error(
      `[check-localization-missing-keys] Found ${totalMissing} missing localized key(s). See ${txtLog}.`
    );
    process.exit(1);
  }
};

try {
  main();
} catch (error) {
  console.error("[check-localization-missing-keys] Failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
