/* Lists every UI string the Russian dictionary should cover (JSON array on stdout). */
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}
const roots = ["app", "components", "lib", "constants"];
const files = roots.flatMap((r) => walk(r)).filter((f) => !/api-client|i18n\.ts$|components\/i18n/.test(f));

const found = new Map(); // text -> first file
const add = (t, f) => {
  const s = t.replace(/\s+/g, " ").trim();
  if (!s || !/[A-Za-z]{2,}/.test(s)) return;
  if (!found.has(s)) found.set(s, f);
};

// JSX renders text lines trimmed and joined with single spaces.
function jsxText(raw) {
  const lines = raw.split(/\r?\n/);
  const kept = lines
    .map((l, i) => {
      let x = l.replace(/\t/g, " ");
      if (i > 0) x = x.replace(/^\s+/, "");
      if (i < lines.length - 1) x = x.replace(/\s+$/, "");
      return x;
    })
    .filter((l) => l.length);
  return kept.join(" ");
}

const TECH = /^(@|\.|\/|#|Inter_|https?:|rgba?\(|[a-z0-9_-]+$|[A-Z_]+$|\d)/;
const DISPLAY_KEYS = /^(label|title|desc|description|sub|subtitle|sublabel|text|heading|cta|hint|message|placeholder|body|name|portion|emoji|reason|confirmText|cancelText|tip|tips|summary)$/;

function allLiterals(n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return true;
  if (ts.isParenthesizedExpression(n)) return allLiterals(n.expression);
  return ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken && allLiterals(n.left) && allLiterals(n.right);
}
function joined(n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isParenthesizedExpression(n)) return joined(n.expression);
  return joined(n.left) + joined(n.right);
}
// Portions like "1 dona (100g)" are translated word by word at runtime (lib/i18n).
const PORTION = /^\d+([.,/]\d+)?\s+[a-zA-Z'ʻ’ ]+(\([^)]*\))?$|^\d+\s*(g|ml)\b/;

for (const f of files) {
  const src = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node)) {
      const t = jsxText(node.text);
      if (/[A-Za-z]{2,}/.test(t)) add(t, f);
    } else if (ts.isCallExpression(node) && /^(tr|trText)$/.test(node.expression.getText()) && node.arguments[0] &&
        (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) {
      add(node.arguments[0].text, f);
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken && allLiterals(node)) {
      // "a" + "b" + "c": the UI shows the joined text, so that is the key.
      if (!/prompt/i.test(node.parent?.name?.getText?.() ?? "")) add(joined(node), f);
      return;
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const t = node.text;
      const p = node.parent;
      if (ts.isJsxAttribute(p) && !/^(name|icon|key|testID|style|source|keyboardType|autoCapitalize|returnKeyType|textContentType|autoComplete|accessibilityRole|animationType|behavior|mode|resizeMode|contentFit|facing|pointerEvents|cachePolicy|href|type|variant|color|tint|accent|unit|id|nativeID|ellipsizeMode|textAlign|direction|gender|stroke|fill|d|transform|fontFamily|textAnchor|barStyle|statusBarStyle|edges|value)$/.test(p.name.getText()) && /^[a-z']{2,}$/.test(t)) add(t, f);
      else if (TECH.test(t.trim()) && !/\s/.test(t.trim())) { /* identifier-like */ }
      else if (ts.isPropertyAssignment(p) && p.name === node) { /* key */ }
      else if (ts.isBinaryExpression(p) && /===|!==|==|!=/.test(p.operatorToken.getText())) { /* comparison */ }
      else if (ts.isCaseClause(p)) { /* switch value */ }
      else if (ts.isLiteralTypeNode(p)) { /* type */ }
      else if (ts.isJsxAttribute(p)) {
        // Any prop that isn't technical may end up inside a <Text>.
        if (!/^(name|icon|key|testID|style|source|keyboardType|autoCapitalize|returnKeyType|textContentType|autoComplete|accessibilityRole|animationType|behavior|mode|resizeMode|contentFit|facing|pointerEvents|cachePolicy|href|type|variant|color|tint|accent|unit|id|nativeID|importantForAccessibility|ellipsizeMode|textAlign|direction|gender|stroke|fill|d|transform|x|y|cx|cy|r|width|height|fontFamily|fontSize|fontWeight|textAnchor|contentInsetAdjustmentBehavior)$/.test(p.name.getText()) && /[a-zA-Z]{2,}/.test(t)) add(t, f);
      }
      else if (ts.isPropertyAssignment(p) && !DISPLAY_KEYS.test(p.name.getText())) { /* non-display prop */ }
      else if (/[a-z]/.test(t) && (/\s/.test(t) || /^[A-ZÀ-ŽЎҚҒҲ]/.test(t) || /['ʻʼ’]/.test(t))) add(t, f);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

const list = [...found.keys()].filter((s) => process.env.ALL ? PORTION.test(s) : !PORTION.test(s)).sort((a, b) => a.localeCompare(b));
process.stdout.write(JSON.stringify(list.map((x) => x.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')), null, 0));
process.stderr.write(`${list.length} strings\n`);
