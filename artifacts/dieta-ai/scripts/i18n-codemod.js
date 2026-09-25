/* One-off codemod for the Russian/Cyrillic rollout (kept for re-running on new files).
 *
 *  1. `Text` / `TextInput` imported from react-native → the translating
 *     wrappers in components/i18n/Text.
 *  2. Sentence-like template literals (`${n} kun qoldi`) → tr("{0} kun qoldi", n),
 *     so the dictionary sees a stable pattern.
 *  3. String literals given to Alert.alert → trText(...), since native alerts
 *     don't go through our Text.
 *
 * Usage: node scripts/i18n-codemod.js [--dry] files...
 * Prints every converted template so prompts/URLs can be reviewed.
 */
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const dry = process.argv.includes("--dry");
const files = process.argv.slice(2).filter((a) => a !== "--dry");

const isSentence = (s) => /[A-Za-zʻʼ'’]{2,}/.test(s) && /[a-z]/.test(s) && /[\s'ʻʼ’]/.test(s.trim() ? s : "");
const SKIP_CALLS = /^(JSON\.stringify|fetch|customFetch|console\.\w+|logger\.\w+|aiAnalyzeText|aiAnalyzeImage|aiChat\w*|require|FileSystem\.\w+|AsyncStorage\.\w+|new RegExp|RegExp|Linking\.\w+|WebBrowser\.\w+|router\.\w+)$/;
const SKIP_VAR = /(prompt|query|url|path|key|uri|dest|folder|link|message_for_ai|text$)/i;

function callName(expr) {
  return expr.getText().replace(/\s+/g, "");
}

function insideSkipped(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && SKIP_CALLS.test(callName(p.expression))) return true;
    if (ts.isVariableDeclaration(p) && SKIP_VAR.test(p.name.getText())) return true;
    if (ts.isPropertyAssignment(p) && /^(text|prompt|preferences|content|body|messages|uri|key)$/.test(p.name.getText()) &&
        p.parent && p.parent.parent && ts.isCallExpression(p.parent.parent) && SKIP_CALLS.test(callName(p.parent.parent.expression))) return true;
    if (ts.isJsxAttribute(p) && /^(key|testID|style|source|href|name|accessibilityLabel|accessibilityHint|nativeID)$/.test(p.name.getText())) return true;
    if (ts.isTaggedTemplateExpression(p)) return true;
    if (ts.isImportDeclaration(p)) return true;
  }
  return false;
}

function inAlertCall(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) return callName(p.expression) === "Alert.alert";
    if (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) return false;
  }
  return false;
}

const report = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  let needTr = false;
  let needTrText = false;
  let rnTextImported = false;

  const visit = (node) => {
    // 1. imports
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === "react-native" && node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings) && !file.includes(path.join("components", "i18n"))) {
      const els = node.importClause.namedBindings.elements;
      const moved = els.filter((e) => !e.propertyName && (e.name.text === "Text" || e.name.text === "TextInput") && !e.isTypeOnly);
      if (moved.length) {
        rnTextImported = true;
        // Remove just the moved specifiers (keeping the import's own formatting),
        // then add the wrapper import on the next line.
        const remaining = els.filter((e) => !moved.includes(e));
        if (remaining.length === 0) {
          edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `import { ${moved.map((e) => e.name.text).join(", ")} } from "@/components/i18n/Text";` });
        } else {
          for (const e of moved) {
            const idx = els.indexOf(e);
            const start = e.getStart(sf);
            // Swallow the following comma + whitespace (or the preceding one for the last element).
            let end = e.getEnd();
            const after = text.slice(end).match(/^\s*,[ \t]*\n?[ \t]*/);
            let from = start;
            if (after && idx < els.length - 1) end += after[0].length;
            else {
              const before = text.slice(0, start).match(/,\s*$/);
              if (before) from = start - before[0].length;
            }
            edits.push({ start: from, end, text: "" });
          }
          edits.push({ start: node.getEnd(), end: node.getEnd(), text: `\nimport { ${moved.map((e) => e.name.text).join(", ")} } from "@/components/i18n/Text";` });
        }
      }
      return;
    }
    if (ts.isImportDeclaration(node)) return;

    // 2. sentence templates
    if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      const pattern = parts.reduce((acc, lit, i) => (i === 0 ? lit : `${acc}{${i - 1}}${lit}`), "");
      const literalOnly = parts.join("");
      const technical = /^(rotate|url|translate|matrix)\(|:\/\/|^Error:|^Stack Trace/.test(pattern);
      if (isSentence(literalOnly) && !technical && !insideSkipped(node)) {
        const args = node.templateSpans.map((s) => s.expression.getText(sf));
        const repl = `tr(${JSON.stringify(pattern)}${args.length ? ", " + args.join(", ") : ""})`;
        edits.push({ start: node.getStart(sf), end: node.getEnd(), text: repl });
        needTr = true;
        report.push(`${path.relative(process.cwd(), file)}: ${pattern}`);
        return; // nested templates inside args are left as-is
      }
    }

    // 3. Alert.alert literals
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /^[A-Z0-9ʻ'"«]/.test(node.text) && inAlertCall(node) &&
        !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) &&
        !(ts.isPropertyAssignment(node.parent) && node.parent.name.getText() === "style")) {
      edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `trText(${node.getText(sf)})` });
      needTrText = true;
      return;
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  const names = [needTr && "tr", needTrText && "trText"].filter(Boolean);
  if (names.length && !/from "@\/lib\/i18n"/.test(out)) {
    // Insert after the last import.
    const lastImport = [...out.matchAll(/^import [^;]+;\n/gm)].pop();
    const at = lastImport ? lastImport.index + lastImport[0].length : 0;
    out = out.slice(0, at) + `import { ${names.join(", ")} } from "@/lib/i18n";\n` + out.slice(at);
  }
  if (!dry) fs.writeFileSync(file, out);
  if (rnTextImported) report.push(`${path.relative(process.cwd(), file)}: [Text import swapped]`);
}

console.log(report.join("\n"));
