#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT_DIR = process.cwd();
const UI_DIR = path.join(ROOT_DIR, "src", "ui");

const LETTER_REGEX = /\p{L}/u;
const SYMBOLS_ONLY_REGEX = /^[\s\d\p{P}\p{S}—–…]*$/u;

const isTestLikeFile = (filePath) => {
  const normalized = filePath.replace(/\\/g, "/");
  return (
    normalized.includes("/__tests__/") ||
    normalized.endsWith(".test.tsx") ||
    normalized.endsWith(".spec.tsx") ||
    normalized.endsWith(".stories.tsx")
  );
};

const collectTsxFiles = (dirPath, acc = []) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectTsxFiles(fullPath, acc);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!fullPath.endsWith(".tsx")) {
      continue;
    }
    if (isTestLikeFile(fullPath)) {
      continue;
    }
    acc.push(fullPath);
  }
  return acc;
};

const isAllowedVisualString = (value) => {
  if (!value || value.trim().length === 0) {
    return true;
  }
  if (SYMBOLS_ONLY_REGEX.test(value)) {
    return true;
  }
  return false;
};

const trimSnippet = (value) => {
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 120) {
    return singleLine;
  }
  return `${singleLine.slice(0, 117)}...`;
};

const reportViolation = (violations, sourceFile, startPos, kind, text) => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(startPos);
  violations.push({
    file: path.relative(ROOT_DIR, sourceFile.fileName),
    line: line + 1,
    column: character + 1,
    kind,
    snippet: trimSnippet(text),
  });
};

const isVisualJsxExpression = (node) => {
  const parent = node.parent;
  if (!parent) {
    return false;
  }
  return parent.kind === ts.SyntaxKind.JsxElement || parent.kind === ts.SyntaxKind.JsxFragment;
};

const checkFile = (filePath, violations) => {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile);
      if (!isAllowedVisualString(text) && LETTER_REGEX.test(text)) {
        reportViolation(violations, sourceFile, node.getStart(sourceFile), "JSXText", text);
      }
    }

    if (ts.isJsxExpression(node) && isVisualJsxExpression(node)) {
      const expr = node.expression;
      if (!expr) {
        // {} placeholder, ignore
      } else if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
        const value = expr.text;
        if (!isAllowedVisualString(value) && LETTER_REGEX.test(value)) {
          reportViolation(violations, sourceFile, expr.getStart(sourceFile), "JSXExpressionContainer(string)", value);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

const main = () => {
  if (!fs.existsSync(UI_DIR)) {
    console.error(`[check-hardcoded-ui-strings] UI directory not found: ${path.relative(ROOT_DIR, UI_DIR)}`);
    process.exit(1);
  }

  const tsxFiles = collectTsxFiles(UI_DIR);
  const violations = [];

  for (const file of tsxFiles) {
    checkFile(file, violations);
  }

  if (violations.length === 0) {
    console.log(`[check-hardcoded-ui-strings] OK: no hardcoded UI strings found in ${tsxFiles.length} TSX file(s).`);
    return;
  }

  console.error(`[check-hardcoded-ui-strings] Found ${violations.length} violation(s):`);
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line}:${violation.column} [${violation.kind}] \"${violation.snippet}\"`);
  }

  process.exit(1);
};

try {
  main();
} catch (error) {
  console.error("[check-hardcoded-ui-strings] Failed:");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
}
