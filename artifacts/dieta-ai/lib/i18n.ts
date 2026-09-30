import { EN } from "@/i18n/en";
import { FA } from "@/i18n/fa";
import { KK } from "@/i18n/kk";
import { KY } from "@/i18n/ky";
import { RU } from "@/i18n/ru";
import { TG } from "@/i18n/tg";
import { TK } from "@/i18n/tk";
import { TR } from "@/i18n/tr";

/**
 * Source-string translation. UI text is written in Uzbek (Latin) and used as
 * the key; each language has a dictionary of those keys (Uzbek Cyrillic is
 * transliterated instead). A missing entry falls back along FALLBACK and
 * finally to the Uzbek text, so nothing ever renders blank.
 */
export type AppLanguage = "uz" | "uz-kril" | "ru" | "en" | "kk" | "ky" | "tg" | "tk" | "tr" | "fa";

export interface LanguageInfo {
  code: AppLanguage;
  /** Name in the language itself. */
  native: string;
  /** Script or region hint shown under the name. */
  hint: string;
  flag: string;
  rtl?: boolean;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "uz", native: "O'zbekcha", hint: "Lotin alifbosi", flag: "🇺🇿" },
  { code: "uz-kril", native: "Ўзбекча", hint: "Кирилл алифбоси", flag: "🇺🇿" },
  { code: "ru", native: "Русский", hint: "Russian", flag: "🇷🇺" },
  { code: "en", native: "English", hint: "English", flag: "🇬🇧" },
  { code: "kk", native: "Қазақша", hint: "Kazakh", flag: "🇰🇿" },
  { code: "ky", native: "Кыргызча", hint: "Kyrgyz", flag: "🇰🇬" },
  { code: "tg", native: "Тоҷикӣ", hint: "Tajik", flag: "🇹🇯" },
  { code: "tk", native: "Türkmençe", hint: "Turkmen", flag: "🇹🇲" },
  { code: "tr", native: "Türkçe", hint: "Turkish", flag: "🇹🇷" },
  { code: "fa", native: "فارسی", hint: "Persian", flag: "🇮🇷", rtl: true },
];

const DICTS: Partial<Record<AppLanguage, Record<string, string>>> = {
  ru: RU, en: EN, kk: KK, ky: KY, tg: TG, tk: TK, tr: TR, fa: FA,
};
// Where to look when a language lacks a string: neighbours read Russian,
// the rest English, before falling back to the Uzbek source.
const FALLBACK: Partial<Record<AppLanguage, AppLanguage>> = {
  kk: "ru", ky: "ru", tg: "ru", tk: "ru", tr: "en", fa: "en",
};

let current: AppLanguage = "uz";

export function setLanguage(lang: string | undefined): void {
  current = LANGUAGES.some((l) => l.code === lang) ? (lang as AppLanguage) : "uz";
}

export function getLanguage(): AppLanguage {
  return current;
}

export function isRtlLanguage(lang: string | undefined): boolean {
  return LANGUAGES.find((l) => l.code === lang)?.rtl === true;
}

function fill(text: string, args: Array<string | number | null | undefined>): string {
  return args.length ? text.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? "")) : text;
}

/** Dictionary lookup tolerant of whitespace differences, following the fallback chain. */
function lookup(uz: string, lang: AppLanguage = current): string | undefined {
  for (let l: AppLanguage | undefined = lang; l; l = FALLBACK[l]) {
    const dict = DICTS[l];
    if (!dict) continue;
    const exact = dict[uz];
    if (exact != null) return exact;
    const core = uz.replace(/\s+/g, " ").trim();
    const hit = dict[core];
    if (hit != null) {
      const lead = uz.match(/^\s*/)?.[0] ?? "";
      const trail = uz.match(/\s*$/)?.[0] ?? "";
      return lead + hit + trail;
    }
  }
  return undefined;
}

/** Translate an Uzbek UI string; `{0}`, `{1}`… are filled from args. */
export function tr(uz: string, ...args: Array<string | number | null | undefined>): string {
  if (current === "uz") return fill(uz, args);
  if (current === "uz-kril") return toCyrillic(fill(uz, args));
  return fill(lookup(uz) ?? uz, args);
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
  return lookup(text) ?? translateUnits(text) ?? text;
}

// Quantities inside any text ("1 likopcha (300g)", "7 kun", "· 2 dona"): a number
// followed by a known unit word is translated even when the sentence isn't.
const UNIT_KEYS = [
  "dona", "likopcha", "kosa", "stakan", "piyola", "bo'lak", "banka", "chashka", "paket", "plitka", "porsiya",
  "shisha", "sixcha", "sovuq", "burda", "siqim", "tilim", "krujka", "kun", "hafta", "oy", "marta", "mahal",
  "ta", "soat", "daqiqa", "qadam", "yosh", "kkal", "kal", "g", "gr", "ml", "kg", "sm", "km", "l",
  "osh qoshiq", "choy qoshiq", "quruq", "qaynatma", "xom", "qovurma",
] as const;
type UnitKey = (typeof UNIT_KEYS)[number];
// Same order as UNIT_KEYS, "|"-separated so each language stays one readable line.
const UNIT_ROWS: Partial<Record<AppLanguage, string>> = {
  ru: "шт.|тарелка|миска|стакан|пиала|кусок|банка|чашка|пакет|плитка|порция|бутылка|шампур|мерная ложка|кусок|горсть|ломтик|кружка|дн.|нед.|мес.|раз|раз|шт.|ч|мин|шагов|лет|ккал|ккал|г|г|мл|кг|см|км|л|ст. ложка|ч. ложка|сухой|варёный|сырой|жареный",
  en: "pc|plate|bowl|glass|cup|slice|can|cup|pack|bar|serving|bottle|skewer|scoop|piece|handful|slice|mug|d|wk|mo|times|meals|pc|h|min|steps|y|kcal|kcal|g|g|ml|kg|cm|km|L|tbsp|tsp|dry|boiled|raw|fried",
  kk: "дана|тәрелке|кесе|стақан|пиала|тілім|банка|шыныаяқ|пакет|плитка|порция|бөтелке|шампур|қасық|тілім|уыс|тілім|кружка|күн|апта|ай|рет|рет|дана|сағ|мин|қадам|жас|ккал|ккал|г|г|мл|кг|см|км|л|ас қасық|шай қасық|құрғақ|қайнатылған|шикі|қуырылған",
  ky: "даана|табак|чөйчөк|стакан|пиала|кесим|банка|чыны|пакет|плитка|порция|бөтөлкө|шиш|кашык|кесим|ууч|кесим|кружка|күн|апта|ай|жолу|жолу|даана|саат|мүн|кадам|жаш|ккал|ккал|г|г|мл|кг|см|км|л|аш кашык|чай кашык|кургак|кайнатылган|чийки|куурулган",
  tg: "дона|табақ|коса|стакан|пиёла|бурида|банка|пиёла|пакет|плитка|порсия|шиша|сих|қошуқ|бурида|мушт|бурида|кружка|рӯз|ҳафта|моҳ|маротиба|маротиба|дона|соат|дақ|қадам|сола|ккал|ккал|г|г|мл|кг|см|км|л|қошуқи калон|қошуқи чой|хушк|ҷӯшонида|хом|бирён",
  tk: "sany|tabak|käse|stakan|käse|bölek|banka|käse|paket|plitka|porsiýa|çüýşe|şiş|çemçe|bölek|penje|bölek|krujka|gün|hepde|aý|gezek|gezek|sany|sag|min|ädim|ýaş|kkal|kkal|g|g|ml|kg|sm|km|l|nahar çemçe|çaý çemçe|gury|gaýnadylan|çig|gowrulan",
  tr: "adet|tabak|kase|bardak|fincan|dilim|kutu|fincan|paket|tablet|porsiyon|şişe|şiş|ölçek|parça|avuç|dilim|kupa|gün|hafta|ay|kez|öğün|adet|sa|dk|adım|yaş|kcal|kcal|g|g|ml|kg|cm|km|L|yemek kaşığı|çay kaşığı|kuru|haşlanmış|çiğ|kızarmış",
  fa: "عدد|بشقاب|کاسه|لیوان|فنجان|تکه|قوطی|فنجان|بسته|قالب|وعده|بطری|سیخ|پیمانه|تکه|مشت|برش|ماگ|روز|هفته|ماه|بار|وعده|عدد|ساعت|دقیقه|قدم|سال|کالری|کالری|گرم|گرم|میلی‌لیتر|کیلوگرم|سانتی‌متر|کیلومتر|لیتر|قاشق غذاخوری|قاشق چای‌خوری|خشک|آب‌پز|خام|سرخ‌شده",
};
const unitCache: Partial<Record<AppLanguage, Record<UnitKey, string>>> = {};
function unitsFor(lang: AppLanguage): Record<UnitKey, string> | undefined {
  if (unitCache[lang]) return unitCache[lang];
  const row = UNIT_ROWS[lang];
  if (!row) return undefined;
  const parts = row.split("|");
  const map = Object.fromEntries(UNIT_KEYS.map((k, i) => [k, parts[i] ?? k])) as Record<UnitKey, string>;
  unitCache[lang] = map;
  return map;
}
const ADJECTIVES = ["quruq", "qaynatma", "xom", "qovurma"] as const;
const UNIT_RE = new RegExp(
  `(\\d+(?:[.,/]\\d+)?)\\s?(${UNIT_KEYS.filter((k) => !(ADJECTIVES as readonly string[]).includes(k)).sort((a, b) => b.length - a.length).join("|")})(?![A-Za-z'])`,
  "gi",
);
function translateUnits(text: string): string | undefined {
  const units = unitsFor(current);
  if (!units) return undefined;
  let changed = false;
  const out = text.replace(UNIT_RE, (m, n: string, unit: string) => {
    const hit = units[unit.toLowerCase() as UnitKey];
    if (!hit) return m;
    changed = true;
    return `${n} ${hit}`;
  });
  const tidy = out.replace(/\((quruq|qaynatma|xom|qovurma)\)/g, (_m, w: UnitKey) => {
    changed = true;
    return `(${units[w]})`;
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

const MONTHS: Partial<Record<AppLanguage, string>> = {
  uz: "yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentabr|oktabr|noyabr|dekabr",
  ru: "января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря",
  en: "January|February|March|April|May|June|July|August|September|October|November|December",
  kk: "қаңтар|ақпан|наурыз|сәуір|мамыр|маусым|шілде|тамыз|қыркүйек|қазан|қараша|желтоқсан",
  ky: "январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь",
  tg: "январ|феврал|март|апрел|май|июн|июл|август|сентябр|октябр|ноябр|декабр",
  tk: "ýanwar|fewral|mart|aprel|maý|iýun|iýul|awgust|sentýabr|oktýabr|noýabr|dekabr",
  tr: "Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık",
  fa: "ژانویه|فوریه|مارس|آوریل|مه|ژوئن|ژوئیه|اوت|سپتامبر|اکتبر|نوامبر|دسامبر",
};

/** Month name as used after a day number ("25 sentabr", "25 сентября", "25 September"). */
export function dateMonth(index: number): string {
  if (current === "uz-kril") return toCyrillic(MONTHS.uz!.split("|")[index] ?? "");
  return (MONTHS[current] ?? MONTHS.uz!).split("|")[index] ?? "";
}
