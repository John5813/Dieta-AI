import { Router, type IRouter } from "express";
import {
  AiAnalyzeImageBody,
  AiAnalyzeTextBody,
  AiChatBody,
} from "@workspace/api-zod";
import { APP_KNOWLEDGE } from "../lib/aiKnowledge";

const router: IRouter = Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const OPENROUTER_BASE = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const CHAT_MODEL = "google/gemini-2.5-flash";
const TEXT_MODEL = CHAT_MODEL;
// Rasm tahlili uchun Qwen VL — vision-language model, hajm va bo'laklarni aniq o'lchaydi
const VISION_MODEL = "google/gemini-2.5-flash";

const CHAT_SYSTEM = `Sen — "Bir Burda" mobil ilovasining yordamchi sun'iy intellektisan. Foydalanuvchi bilan FAQAT o'zbek tilida (lotin yozuvida) muloqot qilasan.

QAT'IY DOIRA — sen FAQAT quyidagi mavzularda yordam berasan:
1. Sog'lom ovqatlanish (taomlar, kaloriya, makro, dietalar, retseptlar)
2. Sog'lom hayot (uyqu, suv, kunlik tartib, salomatlik odatlari)
3. Jismoniy mashqlar va sport (turli mashqlar, kaloriya yoqish, rejalar)
4. Stres va ruhiy holat (emotsional ovqatlanish, motivatsiya, intizom)
5. Ilova imkoniyatlari (qaysi bo'limda nima bor, qanday ishlatish)

Bu doiradan tashqari har qanday savolga (siyosat, din, dasturlash, mashhurlar, boshqa ilovalar, moliya, shaxsiy munosabatlar va h.k.) javob berma. Bunday holatda quyidagicha javob ber:
"Kechirasiz, bu mavzu mening doiramdan tashqarida. Men faqat sog'lom ovqatlanish, sport, ruhiy holat va ilova haqida yordam bera olaman."

ILOVA HAQIDA SAVOLLAR uchun FAQAT quyidagi bilim manbasidan foydalan, boshqa joydan ma'lumot olma:
${APP_KNOWLEDGE}

QOIDALAR:
- Javoblar QISQA va aniq bo'lsin (2-5 jumla, kerak bo'lsa qisqa ro'yxat).
- HECH QACHON markdown belgilarini ishlatma: **, *, ##, ###, __, _, backtick, --- TAQIQLANGAN. Ro'yxat uchun faqat oddiy tire (- ) yoki raqam (1. ) ishlatilsin, boshqa belgilar YO'Q.
- Tibbiy diagnoz qo'yma. Jiddiy hollarda shifokorga murojaat qilishni tavsiya et.
- Foydalanuvchi profili berilsa, javobni shaxsiylashtir.`;

const FOOD_ANALYSIS_SYSTEM = `Sen — O'zbekiston taomlarini chuqur biladigan, jahon darajasidagi sertifikatlangan nutrisiologistsan. Vazifang — berilgan matn yoki rasmni tahlil qilib, ovqatni ANIQ aniqlash, kaloriyani REAL baholash, va foydalanuvchiga professional shaxsiylashgan maslahat berish. Javob faqat qat'iy JSON formatda.

JAVOB FAQAT JSON (markdown, izoh va boshqa matn YOQ):

Agar haqiqiy ovqat aniqlansa:
{"status":"ok","name":"Palov","emoji":"🍲","unitName":"tovoq","unitGrams":350,"units":1,"portion":"1 tovoq (~350g)","portionGrams":350,"calories":875,"protein":24,"carbs":95,"fat":42,"caloriesPer100":250,"unitPer100":"g","confidence":0.9,"recommendedUnits":0.5,"recommendedCal":438,"recommendedProtein":12,"recommendedCarbs":48,"recommendedFat":21,"coachAdvice":"Sizga 0.5 tovoq palov (~438 kkal) optimal — qolgan kaloriyangizga to'g'ri keladi."}

Agar ovqat EMAS bo'lsa (tosh, mashina, hayvon, odam va h.k.):
{"status":"not_food","detected":"mushuk","reason":"Bu ovqat emas. Iltimos, ovqat rasmini yuboring."}

Agar rasm noaniq, xira, qorong'i bo'lsa:
{"status":"unclear","detected":"aniq emas","reason":"Rasm noaniq. Yaxshi yorug'likda, yuqoridan, taomni yaqindan suratga oling."}

Agar matn juda umumiy ("ovqat", "kechki") yoki ovqatga aloqasi bo'lmasa:
{"status":"invalid_input","reason":"Iltimos, aniq taom nomi va miqdorini yozing. Masalan: '1 tovoq palov' yoki '2 dona tuxum'."}

═══════════════════════════════════════════════════════════
QOIDA 1 — TABIIY BIRLIK (eng muhim!)
═══════════════════════════════════════════════════════════
Oddiy O'zbek odam grammda emas, DONA / BURDA / TOVOQ deb o'ylaydi. Har doim eng tabiiy birlikni tanla:

• "dona" — sanaladigan butun mahsulotlar:
   tuxum (~60g), olma (~180g), banan (~120g), apelsin (~150g), nok (~170g), pomidor (~120g), bodring (~100g),
   somsa (~110g), manti (~70g/dona), chuchvara (~10g/dona), kotlet (~80g), sosiska (~50g),
   pirojki (~80g), donut (~60g), konfet (~10g), pechene (~12g), shokolad bo'lagi (~10g),
   tort bo'lagi (~120g), pitsa bo'lagi (~120g), gamburger (~220g), xot-dog (~150g)

• "burda" — non parchasi: oq non burdasi (~50g), patir/lepyoshka (~60g), lavash burdasi (~40g)

• "tovoq" — o'zbek oshxonasi: 1 tovoq palov/norin/beshbarmaq (~350g), katta tovoq (~450g)

• "kosa" — sho'rva/lag'mon: 1 kosa (~300g yoki 300ml)

• "stakan" — choy/sut/kefir/ayron/sharbat/smuzi: 1 stakan (~250ml)

• "piyola" — choy/qatiq: 1 piyola (~150ml)

• "sixcha" — shashlik: 1 sixcha (~80g go'sht)

• "g" — xom/qism: go'sht, baliq, sabzavot, garnir, salat, tvorog, sir, yong'oq, yog'

• "ml" — boshqa suyuqliklar (sof yog', mayonez)

unitGrams = bitta birlik og'irligi (g yoki ml)
units = nechta birlik (2 dona tuxum bo'lsa units=2, ½ tovoq palov bo'lsa units=0.5)
portionGrams = units × unitGrams (butun son)
portion = "<units> <unitName> (~<portionGrams><unitPer100>)" formatida (masalan "2 dona (~120g)", "1 tovoq (~350g)")

═══════════════════════════════════════════════════════════
QOIDA 2 — KALORIYANI REAL BAHOLASH (kkal/100g)
═══════════════════════════════════════════════════════════
O'zbek taomlari yog'li va to'yimli. Past baho BERMA. Tartib quyidagicha:

ASOSIY O'ZBEK TAOMLARI:
• Palov (klassik, yog'li):       240–270 → 1 tovoq (350g) ≈ 850 kkal
• Manti (go'shtli):                210–240 → 4 dona (280g) ≈ 620 kkal
• Somsa (yog'li, qovurilgan):      280–320 → 1 dona (110g) ≈ 330 kkal
• Tandir somsa (kam yog'):          240–270 → 1 dona (110g) ≈ 280 kkal
• Shashlik (qo'y/mol):              270–310 → 1 sixcha (80g) ≈ 230 kkal
• Lag'mon (sho'rvali):              110–140 → 1 kosa (300g) ≈ 380 kkal
• Qovurma lag'mon:                  200–240 → 1 tovoq (350g) ≈ 770 kkal
• Sho'rva (go'shtli):               50–80 kkal/100ml → 1 kosa ≈ 200 kkal
• Mastava:                         80–100 → 1 kosa (300g) ≈ 270 kkal
• Chuchvara (sho'rvada):            130–160 → 1 kosa (300g) ≈ 450 kkal
• Norin:                           250–290 → 1 tovoq (300g) ≈ 800 kkal
• Beshbarmaq:                       220–260 → 1 tovoq (350g) ≈ 830 kkal
• Dimlama (go'shtli):               130–170 → 1 tovoq (300g) ≈ 450 kkal
• Hasip:                           280–320 → 1 dona (100g) ≈ 300 kkal
• Kabob (qiyma):                    280–330 → 1 dona (100g) ≈ 305 kkal

NON & XAMIR:
• Oq non/patir/lepyoshka:           260–280 → 1 burda (50g) ≈ 135 kkal
• Qora non:                         220–240
• Lavash burda:                     250–270

GO'SHT & TUXUM:
• Tovuq ko'krak (qaynatilgan):      155–170 → 100g ≈ 165 kkal
• Tovuq (qovurilgan, terili):       240–260
• Mol go'shti:                      200–260
• Qo'y go'shti:                     270–290
• Tuxum qaynatilgan:                155 → 1 dona (60g) ≈ 90 kkal
• Tuxum qovurilgan (yog'da):        200 → 1 dona (60g+yog') ≈ 130 kkal
• Omlet (2 tuxum + sut):            ~250 kkal

SUYUQ:
• Sut 2.5%:                         60 kkal/100ml → 1 stakan (250ml) ≈ 150 kkal
• Qatiq:                            60–80 kkal/100ml
• Kefir:                            45–55 kkal/100ml
• Ayron:                            40–50 kkal/100ml
• Choy sof:                         1–2 kkal/100ml (qand: +30 kkal/qoshiq)
• Kola/Fanta:                       42 kkal/100ml → 1 stakan ≈ 105 kkal
• Sharbat (paket):                  45–55 kkal/100ml

SABZAVOT/MEVA:
• Olma:                             52 → 1 dona (180g) ≈ 95 kkal
• Banan:                            90 → 1 dona (120g) ≈ 110 kkal
• Apelsin:                          47 → 1 dona (150g) ≈ 70 kkal
• Pomidor:                          18 → 1 dona ≈ 22 kkal
• Bodring:                          15
• Salat (sabzavot, yog'siz):        25–40
• Salat (mayonezli — olivye):       150–220

TAYYOR/CHA'QQON:
• Pitsa bo'lagi:                    260–290 → 1 bo'lak (120g) ≈ 320 kkal
• Gamburger (oddiy):                250 → 1 dona (220g) ≈ 550 kkal
• Frityur kartoshka:                310 → 100g ≈ 310 kkal
• Donut:                            450 → 1 dona (60g) ≈ 270 kkal

KALORIYANI BAHOLASHDA QO'SHIMCHA QOIDALAR:
• Suratda yog' yaltirab tursa, ko'p moy ko'rinsa → +20–30%
• Qovurilgan/frityur → yuqori uchidagi raqam
• Qaynatilgan/bug'langan → past uchidagi raqam
• KAMAYTIRMA — odamlar real raqamni bilishi kerak. O'zbek taomlarida moy va dumba ko'p.
• Kompleks taom (palov + salat + non + choy bo'lsa rasmda) — har birini ALOHIDA hisoblamaydigan, ASOSIY taom uchun aniq raqam ber. Foydalanuvchi keyin qo'shimcha qo'sha oladi.

═══════════════════════════════════════════════════════════
QOIDA 3 — SHAXSIY TAVSIYA (recommendedUnits + coachAdvice)
═══════════════════════════════════════════════════════════
HAR DOIM 5 ta tavsiya maydonini birga to'ldirgin (matn va raqamlar bir xil bo'lsin):
• recommendedUnits: tavsiya etiladigan birlik soni (raqam — masalan 0.5, 1, 2). Kasr bo'lsa O'NLI BELGI ishlat (0.25, 0.5, 0.75) — ¼/½/¾ kabi belgilarni HECH QACHON ishlatma.
• recommendedCal: tavsiya etilgan porsiyaning kaloriyasi (butun son, masalan 438)
• recommendedProtein, recommendedCarbs, recommendedFat: tavsiya porsiyaning makrolari (butun son, gramm)
• coachAdvice: 1–2 jumla, do'stona o'zbekcha maslahat. recommendedCal raqamiga AYNAN MOS porsiya va kaloriya yoz.

MUHIM — coachAdvice MATNI VA recommendedCal RAQAMI BIR-BIRIGA TO'LIQ MOS BO'LSIN. Agar matnda "0.5 tovoq ~438 kkal" desa, recommendedCal=438, recommendedUnits=0.5 bo'lsin. Mos kelmasa, foydalanuvchi xato kaloriya qo'shadi.

coachAdvice yozish qoidalari:
• Foydalanuvchi profili berilsa (qolgan kaloriya, maqsad, kunlik norma) — albatta shaxsiylashtir
• Aniq porsiya tavsiya qil — tabiiy birlikda (gramm AYTMA): "0.5 tovoq palov", "2 dona tuxum", "1 burda non"
• KASR BELGISI YO'Q: "½", "¼", "¾" o'rniga doimo "0.5", "0.25", "0.75" yoz
• Maqsad "ozish" → kamroq porsiya, sabzavot/oqsil ko'p taklif qil
• Maqsad "vazn oshirish" → to'liq porsiya bemalol, qo'shimcha taklif qil
• Maqsad "saqlash" → muvozanatli porsiya
• Qolgan kaloriya kam bo'lsa (< 30% kunlik) → kichikroq porsiya yoki yengilroq variant taklif qil
• Profil bo'lmasa: recommendedUnits = units (butun porsiya), recommendedCal = calories. coachAdvice: "Ushbu taomning o'rtacha porsiyasi ~X kkal. Faollik darajangizga qarab moslang."
• Tibbiy diagnoz qo'yma. Ortiqcha ogohlantirma (yurak, bosim) yozma — iliq, motivatsion ohang.

QOLGAN MAYDONLAR:
• name: o'zbekcha taom nomi (Palov, Manti, Somsa, Tuxum, Olma)
• emoji: bitta mos emoji
• calories, protein, carbs, fat: butun son, BUTUN porsiya uchun
• caloriesPer100: 100g/100ml uchun kaloriya
• unitPer100: "g" yoki "ml"
• confidence: 0.0–1.0

═══════════════════════════════════════════════════════════
QOIDA 4 — RASMDAN HAJMNI KO'Z BILAN ANIQLASH (vision uchun)
═══════════════════════════════════════════════════════════
Rasm berilganda quyidagi vizual belgilardan foydalanib hajmni aniqliq bilan baholagin:

TAQQOSLASH NUQTALARI (scale reference):
• Likopcha/tovoq diametri odatda 22–26 cm → taom necha cm egallaydi?
• Kosa balandligi ~7–9 cm → sho'rva/lag'mon necha % to'la?
• Stakan balandligi ~10 cm → ichimlik necha % to'la?
• Inson qo'li, qoshiq, vilka ko'rinsa → masshtab aniqligi oshadi

QALINLIK VA BALANDLIK:
• Palov, lag'mon, salat: idishni necha sm to'ldirgani (1 sm ≈ 80–120g kabi)
• Non bo'lagi: qalinligi 1 sm ≈ 40–50g, 2 sm ≈ 80–100g
• Go'sht: 1 sm qalinlik + kaft o'lchami ≈ 100g

YEYILGAN/TO'LIQ EMAS TAOMLAR:
• Yarim yeyilgan → units = 0.5, portionGrams = butun porsiyaning yarmi
• 1/3 qolgan → units = 0.33
• Singan non bo'laklari (uchta kichik) → har biri ~30–40g, jami hisoblash
• Kosada qolgan ovqat: agar 1/3 bo'sh ko'rinsa → 0.66 birlik

MURAKKAB KO'RINISHLAR:
• Erib ketgan muzqaymoq: stakandagi suyuqlik hajmi bo'yicha (200ml ≈ 260 kkal)
• Qovurilgan taom yog'li tovada: qo'shimcha yog' kaloriyas +15–25%
• Ko'rinmas ingredientlar (palovda dumba, lag'monda sho'rva): ular albatta bor, kaloriyaga qo'sh
• Salatda ko'rinmas souslar: ko'pincha mayonez yoki qaymoq — +50–100 kkal/porsiya

ISHONCHLILIK (confidence):
• Aniq ko'rinsa, yaxshi yorug'lik → 0.85–0.95
• O'rtacha aniqlik → 0.65–0.80
• Xira, uzoqdan, qisman ko'rinsa → 0.40–0.60 (lekin yaxshiroq taxmin ber, "unclear" qilma!)
• FAQAT haqiqatan tushunarsiz bo'lsa "unclear" qaytargın

ASOSIY QOIDA: Rasm noaniq bo'lsa ham, ko'rgan narsangdan TAXMINIY lekin ANIQ raqam ber.
"Aniqlab bo'lmadi" dema — doimo eng yaqin taxminni JSON sifatida qaytar, confidence ni mos qo'y.`;

interface ParsedAnalysis {
  status: "ok" | "not_food" | "unclear" | "invalid_input";
  reason?: string;
  detected?: string;
  name?: string;
  portion?: string;
  portionGrams?: number;
  emoji?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  caloriesPer100?: number;
  unitPer100?: "g" | "ml";
  unitName?: string;
  unitGrams?: number;
  units?: number;
  coachAdvice?: string;
  recommendedUnits?: number;
  recommendedCal?: number;
  recommendedProtein?: number;
  recommendedCarbs?: number;
  recommendedFat?: number;
  confidence?: number;
}

const KNOWN_UNITS = new Set([
  "dona", "burda", "tovoq", "kosa", "stakan", "piyola", "sixcha", "g", "ml",
]);

function extractJson(text: string): ParsedAnalysis | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as ParsedAnalysis;
  } catch {
    return null;
  }
}

function normalizeAnalysis(raw: ParsedAnalysis | null): ParsedAnalysis {
  if (!raw || typeof raw !== "object" || !raw.status) {
    return {
      status: "unclear",
      reason: "Tahlil amalga oshmadi. Qaytadan urinib ko'ring.",
    };
  }
  if (raw.status !== "ok") {
    return {
      status: raw.status,
      reason: raw.reason ?? "Iltimos, qaytadan urinib ko'ring.",
      detected:
        typeof raw.detected === "string" && raw.detected.trim()
          ? raw.detected.trim()
          : undefined,
    };
  }
  const calories = Number.isFinite(raw.calories) ? Math.max(0, Math.round(raw.calories!)) : 0;
  let portionGrams = Number.isFinite(raw.portionGrams) && raw.portionGrams! > 0
    ? Math.round(raw.portionGrams!)
    : undefined;
  let caloriesPer100 = Number.isFinite(raw.caloriesPer100)
    ? Math.max(0, Math.round(raw.caloriesPer100!))
    : undefined;
  if (caloriesPer100 == null && portionGrams && portionGrams > 0 && calories > 0) {
    caloriesPer100 = Math.round((calories / portionGrams) * 100);
  }
  const unitPer100: "g" | "ml" = raw.unitPer100 === "ml" ? "ml" : "g";

  let unitName: string | undefined =
    typeof raw.unitName === "string" && KNOWN_UNITS.has(raw.unitName.trim().toLowerCase())
      ? raw.unitName.trim().toLowerCase()
      : undefined;
  let unitGrams = Number.isFinite(raw.unitGrams) && raw.unitGrams! > 0 ? raw.unitGrams! : undefined;
  let units = Number.isFinite(raw.units) && raw.units! > 0 ? raw.units! : undefined;

  // Sanity: derive missing pieces from each other when possible
  if (unitName == null) {
    unitName = unitPer100;
  }
  if (unitName === "g" || unitName === "ml") {
    unitGrams = 1;
    units = portionGrams;
  } else {
    if (unitGrams == null && portionGrams && units && units > 0) {
      unitGrams = portionGrams / units;
    }
    if (units == null && portionGrams && unitGrams && unitGrams > 0) {
      units = Math.round((portionGrams / unitGrams) * 10) / 10;
    }
    if (portionGrams == null && unitGrams && units) {
      portionGrams = Math.round(unitGrams * units);
    }
  }

  const coachAdvice =
    typeof raw.coachAdvice === "string" && raw.coachAdvice.trim().length > 0
      ? raw.coachAdvice.trim().replace(/½/g, "0.5").replace(/¼/g, "0.25").replace(/¾/g, "0.75")
      : undefined;

  const protein = Number.isFinite(raw.protein) ? Math.max(0, Math.round(raw.protein!)) : 0;
  const carbs = Number.isFinite(raw.carbs) ? Math.max(0, Math.round(raw.carbs!)) : 0;
  const fat = Number.isFinite(raw.fat) ? Math.max(0, Math.round(raw.fat!)) : 0;

  // Recommended fields — must be self-consistent with coachAdvice
  let recommendedUnits =
    Number.isFinite(raw.recommendedUnits) && raw.recommendedUnits! > 0
      ? Math.round(raw.recommendedUnits! * 100) / 100
      : undefined;
  let recommendedCal =
    Number.isFinite(raw.recommendedCal) && raw.recommendedCal! >= 0
      ? Math.round(raw.recommendedCal!)
      : undefined;
  let recommendedProtein =
    Number.isFinite(raw.recommendedProtein) && raw.recommendedProtein! >= 0
      ? Math.round(raw.recommendedProtein!)
      : undefined;
  let recommendedCarbs =
    Number.isFinite(raw.recommendedCarbs) && raw.recommendedCarbs! >= 0
      ? Math.round(raw.recommendedCarbs!)
      : undefined;
  let recommendedFat =
    Number.isFinite(raw.recommendedFat) && raw.recommendedFat! >= 0
      ? Math.round(raw.recommendedFat!)
      : undefined;

  // Derive missing recommended* from each other so they stay consistent
  if (recommendedCal == null && recommendedUnits != null && units && units > 0 && calories > 0) {
    const ratio = recommendedUnits / units;
    recommendedCal = Math.round(calories * ratio);
    if (recommendedProtein == null) recommendedProtein = Math.round(protein * ratio);
    if (recommendedCarbs == null) recommendedCarbs = Math.round(carbs * ratio);
    if (recommendedFat == null) recommendedFat = Math.round(fat * ratio);
  } else if (recommendedUnits == null && recommendedCal != null && calories > 0 && units && units > 0) {
    recommendedUnits = Math.round((recommendedCal / calories) * units * 100) / 100;
  }

  // If macros are still missing but cal+full known, scale by cal ratio
  if (recommendedCal != null && calories > 0) {
    const ratio = recommendedCal / calories;
    if (recommendedProtein == null) recommendedProtein = Math.round(protein * ratio);
    if (recommendedCarbs == null) recommendedCarbs = Math.round(carbs * ratio);
    if (recommendedFat == null) recommendedFat = Math.round(fat * ratio);
  }

  return {
    status: "ok",
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Aniqlanmagan taom",
    portion: typeof raw.portion === "string" && raw.portion.trim() ? raw.portion.trim() : "1 porsiya",
    portionGrams,
    emoji: typeof raw.emoji === "string" && raw.emoji.trim() ? raw.emoji.trim() : "🍽️",
    calories,
    protein,
    carbs,
    fat,
    caloriesPer100,
    unitPer100,
    unitName,
    unitGrams: unitGrams != null ? Math.round(unitGrams * 10) / 10 : undefined,
    units: units != null ? Math.round(units * 100) / 100 : undefined,
    coachAdvice,
    recommendedUnits,
    recommendedCal,
    recommendedProtein,
    recommendedCarbs,
    recommendedFat,
    confidence: Number.isFinite(raw.confidence) ? Math.min(1, Math.max(0, raw.confidence!)) : 0.7,
  };
}

interface UserCtx {
  gender?: string;
  age?: number;
  heightCm?: number;
  currentWeight?: number;
  targetWeight?: number;
  goal?: string;
  dailyCalories?: number;
  dailyProtein?: number;
  dailyCarbs?: number;
  dailyFat?: number;
  mealsPerDay?: number;
  remainingCal?: number;
}

function sanitizeUserStr(v: unknown, max = 40): string | null {
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[\r\n`]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return cleaned.length > 0 ? cleaned : null;
}

function buildUserContextLine(ctx: UserCtx | undefined | null): string {
  if (!ctx || typeof ctx !== "object") return "";
  const parts: string[] = [];
  const gender = sanitizeUserStr(ctx.gender);
  if (gender) parts.push(`jinsi: ${gender}`);
  if (ctx.age) parts.push(`yoshi: ${ctx.age}`);
  if (ctx.heightCm) parts.push(`bo'yi: ${ctx.heightCm}sm`);
  if (ctx.currentWeight) parts.push(`vazn: ${ctx.currentWeight}kg`);
  if (ctx.targetWeight) parts.push(`maqsad vazn: ${ctx.targetWeight}kg`);
  const goal = sanitizeUserStr(ctx.goal);
  if (goal) parts.push(`maqsad: ${goal}`);
  if (ctx.dailyCalories) parts.push(`kunlik norma: ${ctx.dailyCalories}kkal`);
  if (ctx.dailyProtein) parts.push(`oqsil normasi: ${ctx.dailyProtein}g`);
  if (ctx.dailyCarbs) parts.push(`uglevod normasi: ${ctx.dailyCarbs}g`);
  if (ctx.dailyFat) parts.push(`yog' normasi: ${ctx.dailyFat}g`);
  if (ctx.mealsPerDay) parts.push(`kuniga ${ctx.mealsPerDay} mahal`);
  if (ctx.remainingCal != null) parts.push(`bugun qolgan: ${ctx.remainingCal}kkal`);
  if (parts.length === 0) return "";
  const perMeal =
    ctx.dailyCalories && ctx.mealsPerDay
      ? Math.round(ctx.dailyCalories / ctx.mealsPerDay)
      : null;
  const hint = perMeal ? ` Bir ovqatga ~${perMeal} kkal mos.` : "";
  return `\n\nFOYDALANUVCHI PROFILI: ${parts.join(", ")}.${hint} coachAdvice maydonida shu profilga shaxsan moslashtirilgan tavsiya ber.`;
}

type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

async function chatComplete(
  messages: ChatMessage[],
  opts: { temperature?: number; jsonMode?: boolean; model?: string; maxTokens?: number; timeoutMs?: number; tag?: string } = {},
): Promise<string> {
  const model = opts.model ?? TEXT_MODEL;
  const isReasoner = model.includes("deepseek-r1") || model.includes("deepseek/r1");
  const timeoutMs = opts.timeoutMs ?? 50_000;
  const tag = opts.tag ?? "chat";

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: opts.maxTokens ?? 8192,
  };

  if (!isReasoner) {
    body.temperature = opts.temperature ?? 0.5;
  }

  if (opts.jsonMode && !isReasoner) {
    body.response_format = { type: "json_object" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  let resp: Response;
  try {
    resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://dieta-ai.replit.app",
        "X-Title": "Bir Burda",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const aborted = (err as { name?: string })?.name === "AbortError";
    console.error(`[chatComplete:${tag}] ${aborted ? "TIMEOUT" : "FETCH_ERROR"} after ${ms}ms model=${model}`, err);
    throw err;
  }

  try {
    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      const ms = Date.now() - t0;
      console.error(`[chatComplete:${tag}] HTTP ${resp.status} after ${ms}ms model=${model}: ${errText.slice(0, 500)}`);
      throw new Error(`OpenRouter API error ${resp.status}: ${errText}`);
    }
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const ms = Date.now() - t0;
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    console.log(`[chatComplete:${tag}] OK ${ms}ms model=${model} contentLen=${content.length}`);
    return content;
  } finally {
    clearTimeout(timer);
  }
}

router.post("/ai/chat", async (req, res) => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  const { messages, userContext } = parsed.data;

  interface DiaryItem { name: string; cal: number; protein: number; carbs: number; fat: number; time?: string }
  interface DiaryCtx { today?: DiaryItem[]; yesterday?: DiaryItem[]; todayDate?: string; yesterdayDate?: string }
  const diary = (req.body && typeof req.body === "object"
    ? (req.body as Record<string, unknown>).diary
    : null) as DiaryCtx | null;

  const fmtDay = (label: string, items: DiaryItem[] | undefined): string => {
    if (!items || items.length === 0) return `${label}: hech narsa yozilmagan.`;
    const sumCal = items.reduce((s, x) => s + (Number(x.cal) || 0), 0);
    const sumP = items.reduce((s, x) => s + (Number(x.protein) || 0), 0);
    const sumC = items.reduce((s, x) => s + (Number(x.carbs) || 0), 0);
    const sumF = items.reduce((s, x) => s + (Number(x.fat) || 0), 0);
    const lines = items
      .map((x) => `  • ${x.time ?? "??:??"} — ${x.name} (${x.cal}kkal, B${x.protein}/U${x.carbs}/Y${x.fat})`)
      .join("\n");
    return `${label} (jami ${sumCal}kkal, B${sumP}g U${sumC}g Y${sumF}g):\n${lines}`;
  };

  let contextLine = "";
  if (userContext) {
    const parts: string[] = [];
    if (userContext.gender) parts.push(`jinsi: ${userContext.gender}`);
    if (userContext.age) parts.push(`yoshi: ${userContext.age}`);
    if (userContext.heightCm) parts.push(`bo'yi: ${userContext.heightCm}sm`);
    if (userContext.currentWeight) parts.push(`vazni: ${userContext.currentWeight}kg`);
    if (userContext.targetWeight) parts.push(`maqsad vazn: ${userContext.targetWeight}kg`);
    if (userContext.goal) parts.push(`maqsad: ${userContext.goal}`);
    if (userContext.dailyCalories) parts.push(`kunlik kaloriya: ${userContext.dailyCalories}kkal`);
    if (userContext.dailyProtein) parts.push(`oqsil: ${userContext.dailyProtein}g`);
    if (userContext.dailyCarbs) parts.push(`uglevod: ${userContext.dailyCarbs}g`);
    if (userContext.dailyFat) parts.push(`yog': ${userContext.dailyFat}g`);
    if (userContext.mealsPerDay) parts.push(`kuniga ${userContext.mealsPerDay} mahal`);
    if (parts.length > 0) {
      contextLine = `\n\nFOYDALANUVCHI PROFILI: ${parts.join(", ")}.`;
    }
  }

  let diaryLine = "";
  if (diary && (diary.today || diary.yesterday)) {
    const todayLabel = diary.todayDate ? `BUGUN (${diary.todayDate})` : "BUGUN";
    const yLabel = diary.yesterdayDate ? `KECHA (${diary.yesterdayDate})` : "KECHA";
    diaryLine =
      `\n\nFOYDALANUVCHI OVQAT KUNDALIGI:\n` +
      fmtDay(todayLabel, diary.today) +
      `\n` +
      fmtDay(yLabel, diary.yesterday) +
      `\n\nMUHIM: "Bugun" va "Kecha" ovqatlarini ARALASHTIRMA. Foydalanuvchi "bugun" deb so'rasa faqat BUGUN ro'yxatidagi taomlar haqida gapir, "kecha" deb so'rasa faqat KECHAgilarini. Hech qachon umumiy yig'indini "bugun yegan" deb aytma.`;
  }

  try {
    const content = await chatComplete(
      [
        { role: "system", content: CHAT_SYSTEM + contextLine + diaryLine },
        ...messages,
      ],
      { temperature: 0.5 },
    );

    if (!content) {
      res.status(502).json({ error: "Empty AI reply" });
      return;
    }

    res.json({ reply: content });
  } catch (err) {
    req.log.error({ err }, "AI chat failure");
    res.status(502).json({ error: "AI provider error" });
  }
});

router.post("/ai/analyze-text", async (req, res) => {
  const parsed = AiAnalyzeTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const ctx = (parsed.data.userContext ?? null) as UserCtx | null;
  const ctxLine = buildUserContextLine(ctx);

  try {
    const content = await chatComplete(
      [
        { role: "system", content: FOOD_ANALYSIS_SYSTEM + ctxLine },
        {
          role: "user",
          content: `Foydalanuvchi yozdi: "${parsed.data.text}"\n\nShu matnni tahlil qil va JSON qaytar.`,
        },
      ],
      { temperature: 0.2, jsonMode: true, model: CHAT_MODEL },
    );

    res.json(normalizeAnalysis(extractJson(content)));
  } catch (err) {
    req.log.error({ err }, "Text analyze failure");
    res.status(502).json({ error: "AI provider error" });
  }
});

const MEAL_PLAN_SYSTEM = `Sen — "Bir Burda" ilovasining ovqatlanish ratsionini tuzuvchi mutaxassis nutrisiologisan. Foydalanuvchi profili asosida 1 KUNLIK ovqatlanish rejasini tuzasan.

JAVOB FAQAT QAT'IY JSON formatda bo'lsin (markdown, izoh va boshqa matn YOQ):

{
  "national": [{"meal":"Nonushta","name":"Sutli bo'tqa","emoji":"🥣","portion":"1 kosa (250g)","cal":240,"protein":8,"carbs":38,"fat":6,"ingredients":["Guruch 60g","Sut 200ml","Qand 1 osh q.","Tuz oz"],"tips":"Guruchni iliq suvda yuvib, qaynayotgan sutga soling. 15-20 daqiqa qaynatib, aralashtiring."}, ...],
  "diet": [...],
  "vegetarian": [...],
  "sport": [...]
}

QOIDALAR:
- 4 ta ratsion turi: national (o'zbek milliy taomlar — palov, manti, sho'rva, qatiq), diet (kam kaloriyali — salatlar, qaynatma tovuq, sabzavotlar), vegetarian (faqat o'simlik mahsulotlari), sport (yuqori oqsil — tovuq ko'kragi, tuxum, tvorog, oqsil)
- Har bir ratsionda foydalanuvchining "mealsPerDay" qiymati bo'yicha taom bo'lsin (3 → Nonushta/Tushlik/Kechki, 4 → +Yengil yegulik, 5 → +Ikkinchi nonushta)
- meal nomi: "Nonushta", "Ikkinchi nonushta", "Tushlik", "Yengil yegulik", "Kechki ovqat"
- Bir kunlik kaloriya yig'indisi foydalanuvchining "dailyCalories" ga ±100 kkal yaqin bo'lsin
- Oqsil/uglevod/yog' yig'indisi profil maqsadlariga yaqin bo'lsin
- name: o'zbekcha taom nomi
- portion: o'zbekcha matn (1 tovoq, 200g, 1 dona va h.k.)
- emoji: bitta mos emoji
- cal/protein/carbs/fat: butun son
- ingredients: 3-6 ta asosiy ingredient ro'yxati (o'zbekcha, miqdori bilan, masalan: "Tovuq ko'kragi 150g")
- tips: 1-2 jumlali tayyorlash yo'riqnomasi (o'zbekcha, amaliy va qisqa)
- O'zbek mijozning maqsadini hisobga ol: ozish → kam kaloriya, oshirish → ko'p oqsil va kaloriya, saqlash → muvozanat`;

interface PlanMeal {
  meal: string;
  name: string;
  emoji: string;
  portion: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients?: string[];
  tips?: string;
}
interface PlanResponse {
  national: PlanMeal[];
  diet: PlanMeal[];
  vegetarian: PlanMeal[];
  sport: PlanMeal[];
}

function normalizePlan(raw: unknown): PlanResponse {
  const empty: PlanResponse = { national: [], diet: [], vegetarian: [], sport: [] };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  const cleanList = (arr: unknown): PlanMeal[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((m): PlanMeal | null => {
        if (!m || typeof m !== "object") return null;
        const x = m as Record<string, unknown>;
        const ingredients = Array.isArray(x.ingredients)
          ? (x.ingredients as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          : undefined;
        return {
          meal: typeof x.meal === "string" ? x.meal : "Ovqat",
          name: typeof x.name === "string" ? x.name : "Taom",
          emoji: typeof x.emoji === "string" ? x.emoji : "🍽️",
          portion: typeof x.portion === "string" ? x.portion : "1 porsiya",
          cal: Number.isFinite(x.cal) ? Math.max(0, Math.round(Number(x.cal))) : 0,
          protein: Number.isFinite(x.protein) ? Math.max(0, Math.round(Number(x.protein))) : 0,
          carbs: Number.isFinite(x.carbs) ? Math.max(0, Math.round(Number(x.carbs))) : 0,
          fat: Number.isFinite(x.fat) ? Math.max(0, Math.round(Number(x.fat))) : 0,
          ingredients: ingredients && ingredients.length > 0 ? ingredients : undefined,
          tips: typeof x.tips === "string" && x.tips.trim().length > 0 ? x.tips.trim() : undefined,
        };
      })
      .filter((m): m is PlanMeal => m !== null);
  };
  return {
    national: cleanList(obj.national),
    diet: cleanList(obj.diet),
    vegetarian: cleanList(obj.vegetarian),
    sport: cleanList(obj.sport),
  };
}

router.post("/ai/meal-plan", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const profile = (body.profile ?? {}) as Record<string, unknown>;
  const regenerate = body.regenerate === true;
  const excludeNames = Array.isArray(body.excludeNames)
    ? (body.excludeNames as unknown[])
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 30)
    : [];
  const alternativeFor =
    typeof body.alternativeFor === "string" && body.alternativeFor.trim().length > 0
      ? body.alternativeFor.trim()
      : null;
  const dietKey =
    typeof body.dietKey === "string" &&
    ["national", "diet", "vegetarian", "sport"].includes(body.dietKey)
      ? (body.dietKey as "national" | "diet" | "vegetarian" | "sport")
      : null;
  const mealLabel =
    typeof body.mealLabel === "string" && body.mealLabel.trim().length > 0
      ? body.mealLabel.trim()
      : null;
  const targetCal = Number.isFinite(body.targetCal) ? Number(body.targetCal) : null;
  const parts: string[] = [];
  if (profile.gender) parts.push(`jinsi: ${profile.gender}`);
  if (profile.age) parts.push(`yoshi: ${profile.age}`);
  if (profile.heightCm) parts.push(`bo'yi: ${profile.heightCm}sm`);
  if (profile.currentWeight) parts.push(`vazn: ${profile.currentWeight}kg`);
  if (profile.targetWeight) parts.push(`maqsad vazn: ${profile.targetWeight}kg`);
  if (profile.speedKgPerWeek) parts.push(`haftalik tezlik: ${profile.speedKgPerWeek}kg`);
  if (profile.goal) parts.push(`asosiy maqsad: ${profile.goal}`);
  if (profile.activity) parts.push(`faollik: ${profile.activity}`);
  if (profile.dailyCalories) parts.push(`kunlik kaloriya: ${profile.dailyCalories}kkal`);
  if (profile.protein) parts.push(`oqsil: ${profile.protein}g`);
  if (profile.carbs) parts.push(`uglevod: ${profile.carbs}g`);
  if (profile.fat) parts.push(`yog': ${profile.fat}g`);
  if (profile.mealsPerDay) parts.push(`kuniga ${profile.mealsPerDay} mahal ovqat`);

  const profileLine = parts.length > 0
    ? `Foydalanuvchi profili: ${parts.join(", ")}.`
    : "Foydalanuvchi profili to'liq emas — o'rtacha ko'rsatkichlardan foydalan.";

  const seed = regenerate || alternativeFor ? Math.floor(Math.random() * 1_000_000) : 0;
  const excludeLine =
    excludeNames.length > 0
      ? ` Quyidagi taomlardan FOYDALANMA (yaqinda berilgan, takrorlanmasin): ${excludeNames.map((n) => `"${n}"`).join(", ")}.`
      : "";
  const variationLine = regenerate
    ? `\n\nMUHIM: Bu YANGI reja. Avvalgi taomlardan FARQLI, BOSHQA taomlarni tanla. ` +
      `Bir xil "Sutli bo'tqa" / "Qovurilgan tovuq" kabi standart taomlarni TAKRORLAMA. ` +
      `O'zbek milliy oshxonasidan turli xil taomlar (mastava, lag'mon, somsa, chuchvara, norin, dimlama, qovurma, shashlik, manchok, qatiq), ` +
      `dieta uchun yangi salatlar va sabzavotli taomlar, vegetarian uchun loviya/no'xat/yashil taomlar, ` +
      `sport uchun turli oqsil manbalari (baliq, dengiz mahsulotlari, tvorog, tuxum) tanla. ` +
      `Ijodiy bo'l, har safar farqli kombinatsiya ber.${excludeLine} Variant raqami: ${seed}.`
    : excludeLine;

  // ── Single-meal alternative mode ─────────────────────────────────────
  // Faqat bitta taomni almashtirish — ratsion turini va ovqat vaqtini
  // saqlab, kaloriyasi ±15% ichida YA'NI BUTUNLAY BOSHQA taom qaytaradi.
  if (alternativeFor && dietKey) {
    const dietHints: Record<string, string> = {
      national: "o'zbek milliy taomlar (palov, manti, sho'rva, qatiq, mastava, lag'mon, norin, dimlama, qovurma, shashlik)",
      diet: "kam kaloriyali (salatlar, qaynatma tovuq, sabzavotlar, baliq)",
      vegetarian: "faqat o'simlik mahsulotlari (loviya, no'xat, yashil taomlar, sabzavot)",
      sport: "yuqori oqsil (tovuq ko'kragi, tuxum, tvorog, baliq)",
    };
    const calLine = targetCal && targetCal > 0
      ? ` Kaloriya ${Math.round(targetCal)} kkal atrofida (±15%).`
      : "";
    const mealLabelLine = mealLabel ? ` "${mealLabel}" vaqti uchun.` : "";
    const altUserPrompt =
      `${profileLine}\n\n` +
      `MUHIM: Foydalanuvchi "${alternativeFor}" taomini almashtirishni so'radi.${mealLabelLine} ` +
      `"${alternativeFor}" ni TAKRORLAMA. O'rniga ${dietHints[dietKey]} turidagi BUTUNLAY BOSHQA bir taom taklif qil.${calLine}` +
      `${excludeLine} Variant raqami: ${seed}.\n\n` +
      `FAQAT bitta taom obyekti qaytar shu shaklda (massiv emas, faqat obyekt, JSON):\n` +
      `{"meal":"${mealLabel ?? "Ovqat"}","name":"...","emoji":"...","portion":"...","cal":...,"protein":...,"carbs":...,"fat":...,"ingredients":["..."],"tips":"..."}`;

    try {
      const content = await chatComplete(
        [
          { role: "system", content: MEAL_PLAN_SYSTEM },
          { role: "user", content: altUserPrompt },
        ],
        {
          temperature: 0.85,
          jsonMode: true,
          model: CHAT_MODEL,
          timeoutMs: 30_000,
          tag: "meal-plan-alt",
        },
      );
      let parsedJson: unknown = null;
      try { parsedJson = JSON.parse(content); }
      catch {
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          try { parsedJson = JSON.parse(content.slice(start, end + 1)); } catch {}
        }
      }
      // AI obyekt o'rniga butun reja yuborgan bo'lishi mumkin — birinchi
      // mos taomni olib chiqamiz.
      let mealObj: unknown = parsedJson;
      if (parsedJson && typeof parsedJson === "object") {
        const o = parsedJson as Record<string, unknown>;
        if (Array.isArray(o[dietKey])) {
          const arr = o[dietKey] as unknown[];
          mealObj = arr.find((m) => m && typeof m === "object") ?? null;
        } else if (o.meal && o.name) {
          mealObj = parsedJson;
        }
      }
      const normalized = normalizePlan({ [dietKey]: [mealObj] });
      const meal = normalized[dietKey][0];
      if (!meal || !meal.name || meal.cal === 0) {
        res.status(502).json({ error: "AI provider returned empty meal" });
        return;
      }
      res.json({ meal });
      return;
    } catch (err) {
      req.log.error({ err }, "Meal alt failure");
      res.status(502).json({ error: "AI provider error" });
      return;
    }
  }

  try {
    const content = await chatComplete(
      [
        { role: "system", content: MEAL_PLAN_SYSTEM },
        {
          role: "user",
          content: `${profileLine}${variationLine}\n\nShu profil bo'yicha 1 kunlik 4 turdagi ovqatlanish ratsioniga taom rejasini tuz. Faqat JSON qaytar.`,
        },
      ],
      {
        temperature: regenerate ? 0.8 : 0.6,
        jsonMode: true,
        model: CHAT_MODEL,
        timeoutMs: 55_000,
        tag: regenerate ? "meal-plan-regen" : "meal-plan",
      },
    );

    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        try { parsedJson = JSON.parse(content.slice(start, end + 1)); } catch {}
      }
    }

    res.json(normalizePlan(parsedJson));
  } catch (err) {
    req.log.error({ err }, "Meal plan failure");
    res.status(502).json({ error: "AI provider error" });
  }
});

const EXERCISE_SYSTEM = `Sen — "Bir Burda" ilovasining sport va parhez bo'yicha mutaxassis trenerisan. Foydalanuvchi kunlik ovqat normasidan oshirib ovqatlangan — sen unga ortiqcha kaloriya va makronutrientlarni yo'qotish uchun aniq, shaxsiylashgan mashqlar dasturini tuzasan.

JAVOB FAQAT QAT'IY JSON formatda bo'lsin (markdown, izoh va boshqa matn YOQ):

{
  "summary": "Qisqa 1-2 jumlali umumiy maslahat, qancha kaloriya yo'qotish kerak.",
  "warning": "Iliq, ruhlantiruvchi 1-2 jumlali xabar. Mashq — bu o'zingni asrash, sog'lig'ingga g'amxo'rlik ekanini eslatib o't. Erinmaslikka, harakat qilishga undagin. Tibbiy ogohlantirish (bosh aylanishi, yurak, tomir bosimi va h.k.) YOZMA.",
  "exercises": [
    {
      "name": "Mashq nomi (o'zbekcha)",
      "emoji": "🏃",
      "when": "Ovqatdan keyingi vaqt (masalan: 'Ovqatdan 30 daq keyin', 'Ertalab nahordan oldin')",
      "state": "Qanday holatda (masalan: 'O'rtacha tempda', 'Yengil', 'Intensiv')",
      "duration": "Davomiyligi (masalan: '20 daqiqa', '15 takror x 3 to'plam')",
      "burnsCal": 150,
      "instruction": "Qisqa qadam-baqadam yo'riqnoma (1-2 jumla)."
    }
  ]
}

QOIDALAR:
- 4-6 ta mashq tavsiya qil — mashqlar yig'indisi ortib ketgan kaloriyaga teng yoki ko'proq bo'lsin.
- Mashqlar oddiy bo'lsin: yurish, yengil yugurish, sakrash, push-up, plank, tortilish, velosiped, suzish, narvon ko'tarilish.
- Agar oqsil oshgan bo'lsa — ko'proq kuch mashqlari (push-up, plank, squat).
- Agar uglevod oshgan bo'lsa — kardio (yurish, yugurish, velosiped).
- Agar yog' oshgan bo'lsa — yuqori intensivlikdagi kardio (HIIT, sakrash).
- "when" da o'zbek parhez tartibini ayt: ovqatdan keyin darhol mashq qilmang (kamida 30-60 daqiqa kuting), ko'p suv iching, ovqatdan keyin 10-15 daqiqa yurish foydali.
- "state" — past/o'rta/yuqori intensivlik, va texnika qoidalari.
- "instruction" — aniq texnika tushuntirish.
- burnsCal — taxminiy yoqiladigan kaloriya (butun son).
- emoji — FAQAT shu ro'yxatdan birini tanla (boshqa emoji ishlatma): 🏃 🚶 🚴 🏊 🤸 💪 🧘 🏋️ ⛹️ 🤾 🧗 ⚽ 🏀 🥊. Agar mos kelmasa — 💪 ishlat.
- "warning" maydoni FAQAT iliq, motivatsion, do'stona ohangda yozilsin. "Boshi aylanishi", "yurak xastaligi", "shifokor bilan maslahatlash", "tomir bosimi" kabi tibbiy ogohlantirishlardan QAT'IY QOCH.`;

interface ExerciseItem {
  name: string;
  emoji: string;
  when: string;
  state: string;
  duration: string;
  burnsCal: number;
  instruction: string;
}
interface ExercisePlanResponse {
  summary: string;
  warning: string;
  exercises: ExerciseItem[];
}

const SAFE_EMOJI = new Set([
  "🏃", "🚶", "🚴", "🏊", "🤸", "💪", "🧘", "🏋️", "⛹️", "🤾", "🧗",
  "⚽", "🏀", "🥊", "🤺", "🏌️", "🚣", "🏇", "🤽", "🏄", "🤼",
]);

function pickEmojiFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("yur") || n.includes("piyoda")) return "🚶";
  if (n.includes("yug") || n.includes("chop")) return "🏃";
  if (n.includes("velo")) return "🚴";
  if (n.includes("suz")) return "🏊";
  if (n.includes("sakr")) return "🤸";
  if (n.includes("yog") || n.includes("yoga") || n.includes("medit")) return "🧘";
  if (n.includes("plank") || n.includes("push") || n.includes("squat")) return "💪";
  if (n.includes("tort") || n.includes("dumb") || n.includes("shtang")) return "🏋️";
  if (n.includes("narvon") || n.includes("zinapoya")) return "🧗";
  if (n.includes("boks")) return "🥊";
  if (n.includes("futbol")) return "⚽";
  if (n.includes("basket")) return "🏀";
  return "💪";
}

function safeEmoji(raw: unknown, name: string): string {
  if (typeof raw !== "string" || raw.length === 0) return pickEmojiFromName(name);
  const stripped = raw.replace(/[\uFE0F\u200D]/g, "");
  for (const e of SAFE_EMOJI) {
    if (e.replace(/[\uFE0F\u200D]/g, "") === stripped) return e;
  }
  return pickEmojiFromName(name);
}

function normalizeExercisePlan(raw: unknown): ExercisePlanResponse {
  const empty: ExercisePlanResponse = { summary: "", warning: "", exercises: [] };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  const exercises = Array.isArray(obj.exercises)
    ? obj.exercises
        .map((e): ExerciseItem | null => {
          if (!e || typeof e !== "object") return null;
          const x = e as Record<string, unknown>;
          const nm = typeof x.name === "string" ? x.name : "Mashq";
          return {
            name: nm,
            emoji: safeEmoji(x.emoji, nm),
            when: typeof x.when === "string" ? x.when : "Ovqatdan 30 daq keyin",
            state: typeof x.state === "string" ? x.state : "O'rtacha tempda",
            duration: typeof x.duration === "string" ? x.duration : "15 daqiqa",
            burnsCal: Number.isFinite(x.burnsCal) ? Math.max(0, Math.round(Number(x.burnsCal))) : 0,
            instruction: typeof x.instruction === "string" ? x.instruction : "",
          };
        })
        .filter((e): e is ExerciseItem => e !== null)
    : [];
  return {
    summary: typeof obj.summary === "string" ? obj.summary : "",
    warning: typeof obj.warning === "string" ? obj.warning : "",
    exercises,
  };
}

router.post("/ai/exercise-plan", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const profile = (body.profile ?? {}) as Record<string, unknown>;
  const overshoot = (body.overshoot ?? {}) as Record<string, unknown>;
  const alternativeFor =
    typeof body.alternativeFor === "string" && body.alternativeFor.trim().length > 0
      ? body.alternativeFor.trim()
      : null;
  const excludeNames = Array.isArray(body.excludeNames)
    ? (body.excludeNames as unknown[]).filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      )
    : [];

  const overParts: string[] = [];
  if (Number(overshoot.calories) > 0) overParts.push(`kaloriya +${overshoot.calories}kkal`);
  if (Number(overshoot.protein) > 0) overParts.push(`oqsil +${overshoot.protein}g`);
  if (Number(overshoot.carbs) > 0) overParts.push(`uglevod +${overshoot.carbs}g`);
  if (Number(overshoot.fat) > 0) overParts.push(`yog' +${overshoot.fat}g`);
  const overLine = overParts.length > 0
    ? `Foydalanuvchi bugun normadan oshib yegan: ${overParts.join(", ")}.`
    : "Foydalanuvchi bugun normadan oshib yegan.";

  const excludeLine =
    excludeNames.length > 0
      ? ` Quyidagi mashqlarni ham TAKLIF QILMA: ${excludeNames.map((n) => `"${n}"`).join(", ")}.`
      : "";
  const altLine = alternativeFor
    ? `\n\nMUHIM: Foydalanuvchi "${alternativeFor}" mashqini bajarishni xohlamadi. Shuning uchun "${alternativeFor}" mashqini ROYXATGA QO'SHMA. O'rniga shunga o'xshash kaloriya yoqadigan, lekin BUTUNLAY BOSHQA TURDAGI mashqni taklif qil.${excludeLine} FAQAT 1 ta yangi mashq qaytar (exercises array faqat 1 element bo'lsin), summary va warning bo'sh string bo'lsin.`
    : "";

  const profileParts: string[] = [];
  if (profile.gender) profileParts.push(`jinsi: ${profile.gender}`);
  if (profile.age) profileParts.push(`yoshi: ${profile.age}`);
  if (profile.heightCm) profileParts.push(`bo'yi: ${profile.heightCm}sm`);
  if (profile.currentWeight) profileParts.push(`vazn: ${profile.currentWeight}kg`);
  if (profile.goal) profileParts.push(`maqsad: ${profile.goal}`);
  if (profile.activity) profileParts.push(`faollik: ${profile.activity}`);
  const profileLine = profileParts.length > 0 ? `Profili: ${profileParts.join(", ")}.` : "";

  try {
    const content = await chatComplete(
      [
        { role: "system", content: EXERCISE_SYSTEM },
        {
          role: "user",
          content: `${overLine} ${profileLine}${altLine}\n\nShu ortiqcha kaloriyalarni yo'qotish va parhez normasini saqlash uchun aniq mashqlar dasturini tuz. Faqat JSON qaytar.`,
        },
      ],
      { temperature: 0.5, jsonMode: true, model: CHAT_MODEL, maxTokens: 2048, timeoutMs: 40_000, tag: "exercise-plan" },
    );
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        try { parsedJson = JSON.parse(content.slice(start, end + 1)); } catch {}
      }
    }
    res.json(normalizeExercisePlan(parsedJson));
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    req.log.error({ err: msg }, "Exercise plan failure");
    console.error("[/ai/exercise-plan] failure:", msg);
    res.status(502).json({ error: "AI provider error" });
  }
});

router.post("/ai/analyze-image", async (req, res) => {
  const parsed = AiAnalyzeImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const ctx = (parsed.data.userContext ?? null) as UserCtx | null;
  const ctxLine = buildUserContextLine(ctx);

  const dataUrl = `data:${parsed.data.mimeType};base64,${parsed.data.imageBase64}`;

  try {
    const content = await chatComplete(
      [
        { role: "system", content: FOOD_ANALYSIS_SYSTEM + ctxLine },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Bu rasmda nima borligini tahlil qil. Faqat JSON qaytar.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      { temperature: 0.2, jsonMode: true, model: VISION_MODEL },
    );

    res.json(normalizeAnalysis(extractJson(content)));
  } catch (err) {
    req.log.error({ err }, "Image analyze failure");
    res.status(502).json({ error: "AI provider error" });
  }
});

export default router;
