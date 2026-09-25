import { RU } from "@/i18n/ru";

/**
 * Source-string translation. UI text is written in Uzbek (Latin) and used as
 * the key: Russian comes from the RU dictionary, Uzbek Cyrillic is
 * transliterated. Missing entries fall back to the Uzbek text, so nothing
 * ever renders blank.
 */
export type AppLanguage = "uz" | "uz-kril" | "ru";

let current: AppLanguage = "uz";

export function setLanguage(lang: string | undefined): void {
  current = lang === "ru" || lang === "uz-kril" ? lang : "uz";
}

export function getLanguage(): AppLanguage {
  return current;
}

function fill(text: string, args: Array<string | number | null | undefined>): string {
  return args.length ? text.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? "")) : text;
}

/** Translate an Uzbek UI string; `{0}`, `{1}`… are filled from args. */
/** Dictionary lookup that tolerates the whitespace differences between code and extracted keys. */
function lookupRu(uz: string): string | undefined {
  const exact = RU[uz];
  if (exact != null) return exact;
  const core = uz.replace(/\s+/g, " ").trim();
  const hit = RU[core];
  if (hit == null) return undefined;
  const lead = uz.match(/^\s*/)?.[0] ?? "";
  const trail = uz.match(/\s*$/)?.[0] ?? "";
  return lead + hit + trail;
}

export function tr(uz: string, ...args: Array<string | number | null | undefined>): string {
  if (current === "ru") return fill(lookupRu(uz) ?? uz, args);
  const text = fill(uz, args);
  return current === "uz-kril" ? toCyrillic(text) : text;
}

/**
 * For text that may or may not be a dictionary key (a label from a constant,
 * a food name, user input): translate when known, keep it otherwise.
 * Leading/trailing whitespace is preserved.
 */
export function trText(text: string): string {
  if (current === "uz") return text;
  if (current === "uz-kril") return toCyrillic(text);
  if (!text.trim()) return text;
  return lookupRu(text) ?? translateUnits(text) ?? text;
}

// Quantities inside any text ("1 likopcha (300g)", "7 kun", "· 2 dona"): a number
// followed by a known unit word is translated even when the sentence isn't.
const UNIT_WORDS: Record<string, string> = {
  dona: "шт.", likopcha: "тарелка", kosa: "миска", stakan: "стакан", piyola: "пиала", "bo'lak": "кусок",
  banka: "банка", chashka: "чашка", paket: "пакет", plitka: "плитка", porsiya: "порция", shisha: "бутылка",
  sixcha: "шампур", sovuq: "мерная ложка", burda: "кусок", siqim: "горсть", tilim: "ломтик", krujka: "кружка",
  kun: "дн.", hafta: "нед.", oy: "мес.", marta: "раз", mahal: "раз", ta: "шт.", soat: "ч", daqiqa: "мин",
  qadam: "шагов", yosh: "лет", kkal: "ккал", kal: "ккал", g: "г", gr: "г", ml: "мл", kg: "кг", sm: "см", km: "км", l: "л",
};
const UNIT_RE = new RegExp(
  `(\\d+(?:[.,/]\\d+)?)\\s?(osh qoshiq|choy qoshiq|${Object.keys(UNIT_WORDS).sort((a, b) => b.length - a.length).join("|")})(?![A-Za-z'])`,
  "gi",
);
function translateUnits(text: string): string | undefined {
  let changed = false;
  const out = text.replace(UNIT_RE, (_m, n: string, unit: string) => {
    const u = unit.toLowerCase();
    const ru = u === "osh qoshiq" ? "ст. ложка" : u === "choy qoshiq" ? "ч. ложка" : UNIT_WORDS[u];
    if (!ru) return _m;
    changed = true;
    return `${n} ${ru}`;
  });
  const tidy = out.replace(/\((quruq|qaynatma|xom|qovurma)\)/g, (_m, w: string) => {
    changed = true;
    return `(${{ quruq: "сухой", qaynatma: "варёный", xom: "сырой", qovurma: "жареный" }[w as "quruq"]})`;
  });
  return changed ? tidy : undefined;
}

// ── Uzbek Latin → Cyrillic ────────────────────────────────────────────────
const APOS = "['ʻʼ’`]";
const DIGRAPHS: Array<[RegExp, string]> = [
  [new RegExp(`O${APOS}`, "g"), "Ў"],
  [new RegExp(`o${APOS}`, "g"), "ў"],
  [new RegExp(`G${APOS}`, "g"), "Ғ"],
  [new RegExp(`g${APOS}`, "g"), "ғ"],
  [/Sh/g, "Ш"],
  [/SH/g, "Ш"],
  [/sh/g, "ш"],
  [/Ch/g, "Ч"],
  [/CH/g, "Ч"],
  [/ch/g, "ч"],
  [/Yo/g, "Ё"],
  [/YO/g, "Ё"],
  [/yo/g, "ё"],
  [/Yu/g, "Ю"],
  [/YU/g, "Ю"],
  [/yu/g, "ю"],
  [/Ya/g, "Я"],
  [/YA/g, "Я"],
  [/ya/g, "я"],
  [/Ts/g, "Ц"],
  [/ts/g, "ц"],
];
const SINGLE: Record<string, string> = {
  a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м",
  n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", c: "с", w: "в",
};

function translitWord(word: string): string {
  let w = word;
  // Word-initial "e" is "э"; "ye" is "е".
  w = w.replace(/^E/, "Э").replace(/^e/, "э").replace(/^Ye/, "Е").replace(/^ye/, "е");
  for (const [re, to] of DIGRAPHS) w = w.replace(re, to);
  // Apostrophe between letters is the hard sign (ma'no → маъно).
  w = w.replace(new RegExp(`([a-zA-Zа-яА-ЯўғқҳЎҒҚҲ])${APOS}(?=[a-zA-Zа-яА-ЯўғқҳЎҒҚҲ])`, "g"), "$1ъ");
  let out = "";
  for (const ch of w) {
    const lower = ch.toLowerCase();
    const mapped = SINGLE[lower];
    if (mapped) out += ch === lower ? mapped : mapped.toUpperCase();
    else out += ch;
  }
  return out;
}

/** Transliterates Latin Uzbek; leaves URLs, codes, units and placeholders alone. */
export function toCyrillic(text: string): string {
  return text.replace(/[A-Za-z'ʻʼ’`]+/g, (m, offset: number, whole: string) => {
    // Keep things like "UZD-XXXX", "kkal"-free tech tokens and URLs as they are.
    const before = whole.slice(Math.max(0, offset - 8), offset);
    if (/https?:\/\/\S*$|@\S*$/.test(before)) return m;
    if (/^(AI|BMI|UZD|OK|kkal|kcal|ml|kg|g|sm|km|L|UzDieta)$/.test(m)) return m === "kkal" ? "ккал" : m === "sm" ? "см" : m === "kg" ? "кг" : m === "km" ? "км" : m === "ml" ? "мл" : m === "g" ? "г" : m;
    if (/^[A-Z0-9]{2,}$/.test(m) && m.length <= 4) return m;
    return translitWord(m);
  });
}

const MONTHS_UZ_DATE = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const MONTHS_RU_DATE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** Month name as used after a day number ("25 sentabr" / "25 сентября"). */
export function dateMonth(index: number): string {
  if (current === "ru") return MONTHS_RU_DATE[index] ?? "";
  const m = MONTHS_UZ_DATE[index] ?? "";
  return current === "uz-kril" ? toCyrillic(m) : m;
}
