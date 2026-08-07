export type FoodCategory =
  | "heavy"
  | "light"
  | "street"
  | "drinks"
  | "snacks"
  | "breads"
  | "fruits"
  | "sport";

export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  category: FoodCategory;
  portion: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const CATEGORIES: { id: FoodCategory; label: string; emoji: string }[] = [
  { id: "heavy", label: "Og'ir taomlar", emoji: "🍲" },
  { id: "light", label: "Yengil taomlar", emoji: "🥗" },
  { id: "street", label: "Ko'cha taomlari", emoji: "🥟" },
  { id: "breads", label: "Non mahsulotlari", emoji: "🥖" },
  { id: "drinks", label: "Ichimliklar", emoji: "🥤" },
  { id: "snacks", label: "Yengil yeguliklar", emoji: "🍿" },
  { id: "fruits", label: "Mevalar va sabzavotlar", emoji: "🍎" },
  { id: "sport", label: "Sport ozuqalari", emoji: "💪" },
];

export const FOOD_DB: FoodItem[] = [
  // Og'ir taomlar (heavy)
  { id: "h1", name: "Osh (palov)", emoji: "🍚", category: "heavy", portion: "1 tovoq (300g)", cal: 615, protein: 18, carbs: 70, fat: 28 },
  { id: "h2", name: "Mol go'shtli osh", emoji: "🍚", category: "heavy", portion: "1 tovoq (300g)", cal: 660, protein: 22, carbs: 68, fat: 32 },
  { id: "h3", name: "Tovuq go'shtli osh", emoji: "🍚", category: "heavy", portion: "1 tovoq (300g)", cal: 580, protein: 24, carbs: 70, fat: 22 },
  { id: "h4", name: "Norin", emoji: "🍝", category: "heavy", portion: "1 tovoq (300g)", cal: 480, protein: 28, carbs: 55, fat: 16 },
  { id: "h5", name: "Lag'mon (qaynatma)", emoji: "🍜", category: "heavy", portion: "1 kosa (400g)", cal: 520, protein: 22, carbs: 65, fat: 18 },
  { id: "h6", name: "Qovurma lag'mon", emoji: "🍜", category: "heavy", portion: "1 tovoq (350g)", cal: 610, protein: 24, carbs: 60, fat: 28 },
  { id: "h7", name: "Manti (go'shtli)", emoji: "🥟", category: "heavy", portion: "4 dona", cal: 480, protein: 22, carbs: 48, fat: 22 },
  { id: "h8", name: "Manti (qovoqli)", emoji: "🥟", category: "heavy", portion: "4 dona", cal: 360, protein: 12, carbs: 52, fat: 12 },
  { id: "h9", name: "Chuchvara (qaynatma)", emoji: "🥟", category: "heavy", portion: "1 kosa (250g)", cal: 380, protein: 18, carbs: 42, fat: 14 },
  { id: "h10", name: "Chuchvara (qovurma)", emoji: "🥟", category: "heavy", portion: "1 porsiya (200g)", cal: 520, protein: 18, carbs: 45, fat: 28 },
  { id: "h11", name: "Mol go'shti shashlik", emoji: "🍢", category: "heavy", portion: "1 sixcha (90g)", cal: 280, protein: 22, carbs: 1, fat: 20 },
  { id: "h12", name: "Qo'y go'shti shashlik", emoji: "🍢", category: "heavy", portion: "1 sixcha (90g)", cal: 310, protein: 21, carbs: 1, fat: 24 },
  { id: "h13", name: "Tovuq shashlik", emoji: "🍢", category: "heavy", portion: "1 sixcha (90g)", cal: 200, protein: 24, carbs: 2, fat: 11 },
  { id: "h14", name: "Jigar shashlik", emoji: "🍢", category: "heavy", portion: "1 sixcha (90g)", cal: 220, protein: 25, carbs: 4, fat: 11 },
  { id: "h15", name: "Beshbarmoq", emoji: "🍝", category: "heavy", portion: "1 porsiya (350g)", cal: 540, protein: 30, carbs: 50, fat: 22 },
  { id: "h16", name: "Damlama", emoji: "🍲", category: "heavy", portion: "1 tovoq (350g)", cal: 480, protein: 22, carbs: 35, fat: 26 },
  { id: "h17", name: "Qovurma (go'shtli)", emoji: "🍳", category: "heavy", portion: "1 porsiya (250g)", cal: 520, protein: 28, carbs: 12, fat: 38 },
  { id: "h18", name: "Tovuq tabaka", emoji: "🍗", category: "heavy", portion: "1 porsiya (250g)", cal: 470, protein: 35, carbs: 5, fat: 32 },
  { id: "h19", name: "Halim", emoji: "🥣", category: "heavy", portion: "1 kosa (300g)", cal: 320, protein: 14, carbs: 42, fat: 10 },
  { id: "h20", name: "Mastava", emoji: "🥣", category: "heavy", portion: "1 kosa (300g)", cal: 280, protein: 12, carbs: 32, fat: 11 },
  { id: "h21", name: "Sho'rva (mol go'shtli)", emoji: "🥣", category: "heavy", portion: "1 kosa (350g)", cal: 320, protein: 18, carbs: 22, fat: 16 },
  { id: "h22", name: "Sho'rva (qo'y go'shtli)", emoji: "🥣", category: "heavy", portion: "1 kosa (350g)", cal: 360, protein: 18, carbs: 22, fat: 21 },

  // Yengil taomlar (light)
  { id: "l1", name: "Achchiq-chuchuk salat", emoji: "🥗", category: "light", portion: "1 tovoq (150g)", cal: 60, protein: 1.5, carbs: 8, fat: 2.5 },
  { id: "l2", name: "Vinegret salat", emoji: "🥗", category: "light", portion: "1 tovoq (200g)", cal: 180, protein: 4, carbs: 22, fat: 9 },
  { id: "l3", name: "Oliviye salat", emoji: "🥗", category: "light", portion: "1 tovoq (200g)", cal: 320, protein: 8, carbs: 18, fat: 24 },
  { id: "l4", name: "Tashkent salat", emoji: "🥗", category: "light", portion: "1 tovoq (200g)", cal: 280, protein: 18, carbs: 6, fat: 21 },
  { id: "l5", name: "Sezar salat", emoji: "🥗", category: "light", portion: "1 tovoq (200g)", cal: 340, protein: 22, carbs: 10, fat: 24 },
  { id: "l6", name: "Suzma", emoji: "🥛", category: "light", portion: "100g", cal: 130, protein: 14, carbs: 5, fat: 6 },
  { id: "l7", name: "Qatiq", emoji: "🥛", category: "light", portion: "1 stakan (200ml)", cal: 110, protein: 8, carbs: 10, fat: 4 },
  { id: "l8", name: "Chalop", emoji: "🍵", category: "light", portion: "1 kosa (300g)", cal: 140, protein: 7, carbs: 14, fat: 6 },
  { id: "l9", name: "Sutli bo'tqa", emoji: "🥣", category: "light", portion: "1 kosa (250g)", cal: 240, protein: 8, carbs: 38, fat: 6 },
  { id: "l10", name: "Manniy bo'tqa", emoji: "🥣", category: "light", portion: "1 kosa (250g)", cal: 220, protein: 7, carbs: 40, fat: 4 },
  { id: "l11", name: "Sho'rva (sutli)", emoji: "🥣", category: "light", portion: "1 kosa (300g)", cal: 200, protein: 9, carbs: 26, fat: 7 },
  { id: "l12", name: "Yog'urt", emoji: "🥛", category: "light", portion: "100g", cal: 60, protein: 4, carbs: 5, fat: 3 },
  { id: "l13", name: "Tuxum (qaynatma)", emoji: "🥚", category: "light", portion: "1 dona", cal: 70, protein: 6, carbs: 0.5, fat: 5 },
  { id: "l14", name: "Tuxum (qovurma)", emoji: "🍳", category: "light", portion: "2 dona", cal: 200, protein: 12, carbs: 1, fat: 16 },
  { id: "l15", name: "Omlet", emoji: "🍳", category: "light", portion: "1 porsiya (150g)", cal: 230, protein: 14, carbs: 2, fat: 18 },

  // Ko'cha taomlari (street)
  { id: "s1", name: "Somsa (qiymali)", emoji: "🥟", category: "street", portion: "1 dona (150g)", cal: 380, protein: 14, carbs: 32, fat: 22 },
  { id: "s2", name: "Somsa (tovuqli)", emoji: "🥟", category: "street", portion: "1 dona (150g)", cal: 340, protein: 16, carbs: 32, fat: 18 },
  { id: "s3", name: "Somsa (kartoshkali)", emoji: "🥟", category: "street", portion: "1 dona (140g)", cal: 290, protein: 7, carbs: 38, fat: 13 },
  { id: "s4", name: "Somsa (ko'katli)", emoji: "🥟", category: "street", portion: "1 dona (140g)", cal: 270, protein: 8, carbs: 32, fat: 13 },
  { id: "s5", name: "Somsa (qovoqli)", emoji: "🥟", category: "street", portion: "1 dona (140g)", cal: 300, protein: 7, carbs: 36, fat: 15 },
  { id: "s6", name: "Somsa (jizzali)", emoji: "🥟", category: "street", portion: "1 dona (150g)", cal: 410, protein: 14, carbs: 30, fat: 26 },
  { id: "s7", name: "Tandir somsa", emoji: "🥟", category: "street", portion: "1 dona (180g)", cal: 450, protein: 18, carbs: 38, fat: 25 },
  { id: "s8", name: "Pirashka (qiymali)", emoji: "🥟", category: "street", portion: "1 dona (120g)", cal: 320, protein: 10, carbs: 30, fat: 18 },
  { id: "s9", name: "Pirashka (sosiskali)", emoji: "🌭", category: "street", portion: "1 dona (130g)", cal: 360, protein: 12, carbs: 32, fat: 20 },
  { id: "s10", name: "Pirashka (kartoshkali)", emoji: "🥟", category: "street", portion: "1 dona (120g)", cal: 290, protein: 6, carbs: 38, fat: 13 },
  { id: "s11", name: "Pirashka (jamli)", emoji: "🥟", category: "street", portion: "1 dona (110g)", cal: 280, protein: 5, carbs: 42, fat: 11 },
  { id: "s12", name: "Pirashka (tvorogli)", emoji: "🥟", category: "street", portion: "1 dona (120g)", cal: 310, protein: 11, carbs: 30, fat: 16 },
  { id: "s13", name: "Gumma (qiymali)", emoji: "🥟", category: "street", portion: "1 dona (140g)", cal: 360, protein: 13, carbs: 32, fat: 20 },
  { id: "s14", name: "Gumma (kartoshkali)", emoji: "🥟", category: "street", portion: "1 dona (140g)", cal: 310, protein: 7, carbs: 40, fat: 14 },
  { id: "s15", name: "Gumma (qovoqli)", emoji: "🥟", category: "street", portion: "1 dona (130g)", cal: 290, protein: 6, carbs: 38, fat: 13 },
  { id: "s16", name: "Hot-dog", emoji: "🌭", category: "street", portion: "1 dona", cal: 360, protein: 12, carbs: 30, fat: 22 },
  { id: "s17", name: "Lavash (tovuqli)", emoji: "🌯", category: "street", portion: "1 dona (300g)", cal: 580, protein: 28, carbs: 52, fat: 28 },
  { id: "s18", name: "Lavash (mol go'shtli)", emoji: "🌯", category: "street", portion: "1 dona (300g)", cal: 640, protein: 30, carbs: 50, fat: 34 },
  { id: "s19", name: "Donar", emoji: "🌯", category: "street", portion: "1 dona (350g)", cal: 680, protein: 32, carbs: 55, fat: 36 },
  { id: "s20", name: "Cheburek", emoji: "🥟", category: "street", portion: "1 dona (150g)", cal: 420, protein: 14, carbs: 36, fat: 24 },
  { id: "s21", name: "Hamburger", emoji: "🍔", category: "street", portion: "1 dona", cal: 540, protein: 25, carbs: 45, fat: 28 },
  { id: "s22", name: "Chizburger", emoji: "🍔", category: "street", portion: "1 dona", cal: 590, protein: 28, carbs: 46, fat: 32 },
  { id: "s23", name: "Kartoshka fri", emoji: "🍟", category: "street", portion: "O'rtacha porsiya (150g)", cal: 430, protein: 5, carbs: 56, fat: 21 },
  { id: "s24", name: "Pizza (1 bo'lak)", emoji: "🍕", category: "street", portion: "1 bo'lak (130g)", cal: 290, protein: 12, carbs: 36, fat: 11 },
  { id: "s25", name: "Xachapuri", emoji: "🥖", category: "street", portion: "1 dona (200g)", cal: 580, protein: 22, carbs: 56, fat: 30 },

  // Non mahsulotlari (breads)
  { id: "b1", name: "Obi non", emoji: "🥖", category: "breads", portion: "1 bo'lak (50g)", cal: 130, protein: 4, carbs: 26, fat: 1 },
  { id: "b2", name: "Patir non", emoji: "🥖", category: "breads", portion: "1 bo'lak (60g)", cal: 180, protein: 5, carbs: 28, fat: 5 },
  { id: "b3", name: "Lochira", emoji: "🥖", category: "breads", portion: "1 bo'lak (50g)", cal: 170, protein: 4, carbs: 24, fat: 6 },
  { id: "b4", name: "Katlama", emoji: "🥖", category: "breads", portion: "1 dona (80g)", cal: 280, protein: 6, carbs: 32, fat: 14 },
  { id: "b5", name: "Kulcha", emoji: "🥖", category: "breads", portion: "1 dona (80g)", cal: 240, protein: 6, carbs: 36, fat: 8 },
  { id: "b6", name: "Chapotti", emoji: "🥖", category: "breads", portion: "1 dona (60g)", cal: 170, protein: 5, carbs: 28, fat: 4 },
  { id: "b7", name: "Yumshoq non", emoji: "🍞", category: "breads", portion: "1 bo'lak (40g)", cal: 110, protein: 3.5, carbs: 21, fat: 1.5 },
  { id: "b8", name: "Bug'doy noni", emoji: "🍞", category: "breads", portion: "1 bo'lak (40g)", cal: 105, protein: 4, carbs: 20, fat: 1 },

  // Ichimliklar (drinks)
  { id: "d1", name: "Ayron", emoji: "🥛", category: "drinks", portion: "1 stakan (250ml)", cal: 100, protein: 7, carbs: 10, fat: 4 },
  { id: "d2", name: "Tan", emoji: "🥛", category: "drinks", portion: "1 stakan (250ml)", cal: 70, protein: 5, carbs: 7, fat: 2 },
  { id: "d3", name: "Mors", emoji: "🧃", category: "drinks", portion: "1 stakan (250ml)", cal: 120, protein: 0, carbs: 30, fat: 0 },
  { id: "d4", name: "Kvas", emoji: "🥤", category: "drinks", portion: "1 stakan (250ml)", cal: 70, protein: 0.5, carbs: 17, fat: 0 },
  { id: "d5", name: "Limonad", emoji: "🥤", category: "drinks", portion: "1 stakan (250ml)", cal: 110, protein: 0, carbs: 28, fat: 0 },
  { id: "d6", name: "Coca-Cola", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 140, protein: 0, carbs: 35, fat: 0 },
  { id: "d7", name: "Pepsi", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 140, protein: 0, carbs: 36, fat: 0 },
  { id: "d8", name: "Fanta", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 145, protein: 0, carbs: 38, fat: 0 },
  { id: "d9", name: "Sprite", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 130, protein: 0, carbs: 33, fat: 0 },
  { id: "d10", name: "Ko'k choy", emoji: "🍵", category: "drinks", portion: "1 piyola (200ml)", cal: 2, protein: 0, carbs: 0, fat: 0 },
  { id: "d11", name: "Qora choy", emoji: "🍵", category: "drinks", portion: "1 piyola (200ml)", cal: 2, protein: 0, carbs: 0, fat: 0 },
  { id: "d12", name: "Sutli choy", emoji: "🍵", category: "drinks", portion: "1 piyola (200ml)", cal: 90, protein: 4, carbs: 8, fat: 5 },
  { id: "d13", name: "Kofe (qora)", emoji: "☕", category: "drinks", portion: "1 chashka (200ml)", cal: 5, protein: 0, carbs: 0, fat: 0 },
  { id: "d14", name: "Kapuchino", emoji: "☕", category: "drinks", portion: "1 chashka (200ml)", cal: 90, protein: 5, carbs: 8, fat: 5 },
  { id: "d15", name: "Latte", emoji: "☕", category: "drinks", portion: "1 chashka (250ml)", cal: 130, protein: 7, carbs: 12, fat: 6 },
  { id: "d16", name: "Espresso", emoji: "☕", category: "drinks", portion: "1 chashka (50ml)", cal: 5, protein: 0, carbs: 0, fat: 0 },
  { id: "d17", name: "Apelsin shirasi", emoji: "🍊", category: "drinks", portion: "1 stakan (250ml)", cal: 110, protein: 2, carbs: 26, fat: 0 },
  { id: "d18", name: "Olma shirasi", emoji: "🍎", category: "drinks", portion: "1 stakan (250ml)", cal: 115, protein: 0.5, carbs: 28, fat: 0 },
  { id: "d19", name: "Pomidor shirasi", emoji: "🍅", category: "drinks", portion: "1 stakan (250ml)", cal: 45, protein: 2, carbs: 10, fat: 0 },
  { id: "d20", name: "Mineral suv", emoji: "💧", category: "drinks", portion: "1 stakan (250ml)", cal: 0, protein: 0, carbs: 0, fat: 0 },
  { id: "d21", name: "Milkshake", emoji: "🥤", category: "drinks", portion: "1 stakan (300ml)", cal: 360, protein: 9, carbs: 56, fat: 12 },
  // Ko'proq gazli va energetik ichimliklar
  { id: "d22", name: "Mirinda (apelsin)", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 145, protein: 0, carbs: 38, fat: 0 },
  { id: "d23", name: "7UP", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 130, protein: 0, carbs: 33, fat: 0 },
  { id: "d24", name: "Dr. Pepper", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 150, protein: 0, carbs: 39, fat: 0 },
  { id: "d25", name: "Mountain Dew", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 165, protein: 0, carbs: 46, fat: 0 },
  { id: "d26", name: "Schweppes (tonik)", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 125, protein: 0, carbs: 32, fat: 0 },
  { id: "d27", name: "Tarxun", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 120, protein: 0, carbs: 31, fat: 0 },
  { id: "d28", name: "Buratino", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 120, protein: 0, carbs: 30, fat: 0 },
  { id: "d29", name: "Baikal", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 130, protein: 0, carbs: 33, fat: 0 },
  { id: "d30", name: "Kruchon", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 125, protein: 0, carbs: 32, fat: 0 },
  { id: "d31", name: "Coca-Cola Zero", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 1, protein: 0, carbs: 0, fat: 0 },
  { id: "d32", name: "Pepsi Light", emoji: "🥤", category: "drinks", portion: "1 banka (330ml)", cal: 1, protein: 0, carbs: 0, fat: 0 },
  { id: "d33", name: "Red Bull", emoji: "⚡", category: "drinks", portion: "1 banka (250ml)", cal: 110, protein: 0, carbs: 28, fat: 0 },
  { id: "d34", name: "Adrenaline Rush", emoji: "⚡", category: "drinks", portion: "1 banka (250ml)", cal: 115, protein: 0, carbs: 28, fat: 0 },
  { id: "d35", name: "Burn", emoji: "⚡", category: "drinks", portion: "1 banka (250ml)", cal: 120, protein: 0, carbs: 30, fat: 0 },
  { id: "d36", name: "Hell Energy", emoji: "⚡", category: "drinks", portion: "1 banka (250ml)", cal: 110, protein: 0, carbs: 27, fat: 0 },
  { id: "d37", name: "Monster Energy", emoji: "⚡", category: "drinks", portion: "1 banka (500ml)", cal: 230, protein: 0, carbs: 56, fat: 0 },
  { id: "d38", name: "Non Stop", emoji: "⚡", category: "drinks", portion: "1 banka (250ml)", cal: 115, protein: 0, carbs: 28, fat: 0 },
  { id: "d39", name: "Pulse", emoji: "⚡", category: "drinks", portion: "1 banka (250ml)", cal: 105, protein: 0, carbs: 26, fat: 0 },
  { id: "d40", name: "Cappy (apelsin)", emoji: "🧃", category: "drinks", portion: "1 paket (250ml)", cal: 110, protein: 1, carbs: 26, fat: 0 },
  { id: "d41", name: "Rich (olma)", emoji: "🧃", category: "drinks", portion: "1 paket (250ml)", cal: 115, protein: 0.5, carbs: 28, fat: 0 },
  { id: "d42", name: "Fuse Tea (limon)", emoji: "🧃", category: "drinks", portion: "1 shisha (500ml)", cal: 140, protein: 0, carbs: 35, fat: 0 },
  { id: "d43", name: "Lipton Ice Tea", emoji: "🧃", category: "drinks", portion: "1 shisha (500ml)", cal: 145, protein: 0, carbs: 36, fat: 0 },

  // Yengil yeguliklar (snacks)
  { id: "n1", name: "Chips", emoji: "🥔", category: "snacks", portion: "1 paket (100g)", cal: 540, protein: 6, carbs: 50, fat: 35 },
  { id: "n2", name: "Pista", emoji: "🥜", category: "snacks", portion: "30g", cal: 170, protein: 6, carbs: 8, fat: 14 },
  { id: "n3", name: "Yong'oq", emoji: "🥜", category: "snacks", portion: "30g", cal: 195, protein: 5, carbs: 4, fat: 19 },
  { id: "n4", name: "Bodom", emoji: "🥜", category: "snacks", portion: "30g", cal: 175, protein: 6, carbs: 6, fat: 15 },
  { id: "n5", name: "Findiq", emoji: "🥜", category: "snacks", portion: "30g", cal: 190, protein: 4.5, carbs: 5, fat: 18 },
  { id: "n6", name: "Mayiz", emoji: "🍇", category: "snacks", portion: "30g", cal: 90, protein: 1, carbs: 24, fat: 0 },
  { id: "n7", name: "O'rik (quritilgan)", emoji: "🍑", category: "snacks", portion: "30g", cal: 75, protein: 1, carbs: 19, fat: 0 },
  { id: "n8", name: "Pechenye", emoji: "🍪", category: "snacks", portion: "1 dona (15g)", cal: 70, protein: 1, carbs: 10, fat: 3 },
  { id: "n9", name: "Shokolad", emoji: "🍫", category: "snacks", portion: "1 plitka (50g)", cal: 270, protein: 3, carbs: 28, fat: 16 },
  { id: "n10", name: "Konfet", emoji: "🍬", category: "snacks", portion: "1 dona (10g)", cal: 45, protein: 0, carbs: 11, fat: 0 },
  { id: "n11", name: "Halva", emoji: "🍮", category: "snacks", portion: "50g", cal: 260, protein: 6, carbs: 26, fat: 16 },
  { id: "n12", name: "Tort (1 bo'lak)", emoji: "🎂", category: "snacks", portion: "1 bo'lak (100g)", cal: 360, protein: 5, carbs: 45, fat: 18 },
  { id: "n13", name: "Muzqaymoq", emoji: "🍦", category: "snacks", portion: "100g", cal: 210, protein: 4, carbs: 24, fat: 11 },
  { id: "n14", name: "Kuksu (kraker)", emoji: "🍘", category: "snacks", portion: "30g", cal: 130, protein: 3, carbs: 22, fat: 4 },

  // Mevalar va sabzavotlar (fruits)
  { id: "f1", name: "Olma", emoji: "🍎", category: "fruits", portion: "1 dona (180g)", cal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { id: "f2", name: "Banan", emoji: "🍌", category: "fruits", portion: "1 dona (120g)", cal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { id: "f3", name: "Anor", emoji: "🍎", category: "fruits", portion: "1 dona (280g)", cal: 235, protein: 5, carbs: 53, fat: 3 },
  { id: "f4", name: "Uzum", emoji: "🍇", category: "fruits", portion: "100g", cal: 70, protein: 0.7, carbs: 18, fat: 0.2 },
  { id: "f5", name: "Tarvuz", emoji: "🍉", category: "fruits", portion: "1 bo'lak (300g)", cal: 90, protein: 2, carbs: 22, fat: 0.5 },
  { id: "f6", name: "Qovun", emoji: "🍈", category: "fruits", portion: "1 bo'lak (200g)", cal: 70, protein: 1.5, carbs: 17, fat: 0.4 },
  { id: "f7", name: "Nok", emoji: "🍐", category: "fruits", portion: "1 dona (180g)", cal: 100, protein: 0.6, carbs: 27, fat: 0.2 },
  { id: "f8", name: "Olxo'ri", emoji: "🍑", category: "fruits", portion: "100g", cal: 46, protein: 0.7, carbs: 11, fat: 0.3 },
  { id: "f9", name: "O'rik", emoji: "🍑", category: "fruits", portion: "100g", cal: 50, protein: 1.4, carbs: 11, fat: 0.4 },
  { id: "f10", name: "Shaftoli", emoji: "🍑", category: "fruits", portion: "1 dona (150g)", cal: 60, protein: 1.4, carbs: 15, fat: 0.4 },
  { id: "f11", name: "Apelsin", emoji: "🍊", category: "fruits", portion: "1 dona (140g)", cal: 65, protein: 1.2, carbs: 16, fat: 0.2 },
  { id: "f12", name: "Mandarina", emoji: "🍊", category: "fruits", portion: "1 dona (90g)", cal: 47, protein: 0.7, carbs: 12, fat: 0.3 },
  { id: "f13", name: "Limon", emoji: "🍋", category: "fruits", portion: "1 dona (60g)", cal: 17, protein: 0.6, carbs: 5, fat: 0.2 },
  { id: "f14", name: "Qulupnay", emoji: "🍓", category: "fruits", portion: "100g", cal: 32, protein: 0.7, carbs: 8, fat: 0.3 },
  { id: "f15", name: "Pomidor", emoji: "🍅", category: "fruits", portion: "1 dona (120g)", cal: 22, protein: 1, carbs: 5, fat: 0.2 },
  { id: "f16", name: "Bodring", emoji: "🥒", category: "fruits", portion: "1 dona (150g)", cal: 23, protein: 1, carbs: 5, fat: 0.2 },
  { id: "f17", name: "Sabzi", emoji: "🥕", category: "fruits", portion: "1 dona (100g)", cal: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { id: "f18", name: "Kartoshka (qaynatma)", emoji: "🥔", category: "fruits", portion: "100g", cal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  { id: "f19", name: "Piyoz", emoji: "🧅", category: "fruits", portion: "100g", cal: 40, protein: 1.1, carbs: 9, fat: 0.1 },
  { id: "f20", name: "Bulg'or qalampir", emoji: "🫑", category: "fruits", portion: "1 dona (120g)", cal: 24, protein: 1, carbs: 6, fat: 0.2 },

  // Sport ozuqalari (sport)
  { id: "sp1", name: "Whey Protein (zardob oqsili)", emoji: "💪", category: "sport", portion: "1 sovuq (30g)", cal: 120, protein: 24, carbs: 3, fat: 1.5 },
  { id: "sp2", name: "Casein Protein", emoji: "💪", category: "sport", portion: "1 sovuq (30g)", cal: 110, protein: 24, carbs: 4, fat: 1 },
  { id: "sp3", name: "BCAA aminokislotalar", emoji: "💊", category: "sport", portion: "1 sovuq (10g)", cal: 30, protein: 7, carbs: 0, fat: 0 },
  { id: "sp4", name: "Kreatin monogidrat", emoji: "💊", category: "sport", portion: "1 sovuq (5g)", cal: 0, protein: 0, carbs: 0, fat: 0 },
  { id: "sp5", name: "Mass Gainer", emoji: "🏋️", category: "sport", portion: "1 sovuq (100g)", cal: 380, protein: 30, carbs: 55, fat: 4 },
  { id: "sp6", name: "Protein bar", emoji: "🍫", category: "sport", portion: "1 dona (60g)", cal: 220, protein: 20, carbs: 22, fat: 7 },
  { id: "sp7", name: "Energy bar (granola)", emoji: "🍫", category: "sport", portion: "1 dona (50g)", cal: 200, protein: 6, carbs: 30, fat: 7 },
  { id: "sp8", name: "L-karnitin", emoji: "💊", category: "sport", portion: "1 sovuq (3g)", cal: 0, protein: 0, carbs: 0, fat: 0 },
  { id: "sp9", name: "Glutamin", emoji: "💊", category: "sport", portion: "1 sovuq (5g)", cal: 20, protein: 5, carbs: 0, fat: 0 },
  { id: "sp10", name: "Pre-workout", emoji: "⚡", category: "sport", portion: "1 sovuq (10g)", cal: 15, protein: 0, carbs: 4, fat: 0 },
  { id: "sp11", name: "Izotonik ichimlik", emoji: "🥤", category: "sport", portion: "1 shisha (500ml)", cal: 130, protein: 0, carbs: 32, fat: 0 },
  { id: "sp12", name: "Protein shake (sutli)", emoji: "🥤", category: "sport", portion: "1 stakan (300ml)", cal: 220, protein: 28, carbs: 14, fat: 5 },
  { id: "sp13", name: "Tovuq ko'kragi (qaynatma)", emoji: "🍗", category: "sport", portion: "100g", cal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "sp14", name: "Tovuq ko'kragi (panja)", emoji: "🍗", category: "sport", portion: "150g", cal: 250, protein: 47, carbs: 0, fat: 5 },
  { id: "sp15", name: "Mol go'shti (yog'siz)", emoji: "🥩", category: "sport", portion: "100g", cal: 180, protein: 26, carbs: 0, fat: 8 },
  { id: "sp16", name: "Tuna baliq (konserva)", emoji: "🐟", category: "sport", portion: "1 banka (150g)", cal: 180, protein: 38, carbs: 0, fat: 2 },
  { id: "sp17", name: "Losos baliq", emoji: "🐟", category: "sport", portion: "100g", cal: 208, protein: 22, carbs: 0, fat: 13 },
  { id: "sp18", name: "Tvorog (yog'siz)", emoji: "🥛", category: "sport", portion: "100g", cal: 90, protein: 18, carbs: 3, fat: 0.5 },
  { id: "sp19", name: "Grek yogurti", emoji: "🥛", category: "sport", portion: "150g", cal: 130, protein: 18, carbs: 6, fat: 4 },
  { id: "sp20", name: "Sutli oqsil (yog'siz)", emoji: "🥛", category: "sport", portion: "1 stakan (250ml)", cal: 90, protein: 9, carbs: 12, fat: 0 },
  { id: "sp21", name: "Tuxum oqi", emoji: "🥚", category: "sport", portion: "3 dona", cal: 50, protein: 11, carbs: 1, fat: 0 },
  { id: "sp22", name: "Suli yormasi (oats)", emoji: "🥣", category: "sport", portion: "50g (quruq)", cal: 190, protein: 7, carbs: 32, fat: 4 },
  { id: "sp23", name: "Grechka (qora yorma)", emoji: "🥣", category: "sport", portion: "100g (quruq)", cal: 340, protein: 13, carbs: 70, fat: 3 },
  { id: "sp24", name: "Quinoa", emoji: "🌾", category: "sport", portion: "100g (qaynatma)", cal: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  { id: "sp25", name: "Avokado", emoji: "🥑", category: "sport", portion: "1/2 dona (100g)", cal: 160, protein: 2, carbs: 9, fat: 15 },
  { id: "sp26", name: "Yong'oq yog'i (peanut butter)", emoji: "🥜", category: "sport", portion: "1 osh qoshiq (16g)", cal: 95, protein: 4, carbs: 3, fat: 8 },
  { id: "sp27", name: "Chia urug'i", emoji: "🌱", category: "sport", portion: "20g", cal: 100, protein: 4, carbs: 8, fat: 6 },
  { id: "sp28", name: "Almond milk (bodom suti)", emoji: "🥛", category: "sport", portion: "1 stakan (250ml)", cal: 40, protein: 1, carbs: 2, fat: 3 },
];

export function getFoodsByCategory(cat: FoodCategory): FoodItem[] {
  return FOOD_DB.filter((f) => f.category === cat);
}
