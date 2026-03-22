import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type OutfitItem = {
  id: string;
  name: string | null;
  category: string;
  subcategory: string | null;
  colors: string[];
  styles: string[];
  inspirations: string[];
  seasons: string[];
  formality: number;
  imageUrl: string | null;
  brand?: string | null;
};

type OutfitSlotMap = {
  topPrimary: OutfitItem | null;
  topSecondary: OutfitItem | null;
  bottom: OutfitItem | null;
  onepiece: OutfitItem | null;
  outer: OutfitItem | null;
  shoes: OutfitItem | null;
  bag: OutfitItem | null;
};

type OutfitResult = {
  rank: number;
  score: number;
  reasons: string[];
  breakdown: {
    occasion: number;
    style: number;
    color: number;
    preference: number;
    rewear: number;
    setupBonus: number;
    suitBonus: number;
    moodCohesionBonus: number;
    versatilityBonus: number;
    favoriteStyleBonus: number;
    targetStyleBonus: number;
    inspirationBonus: number;
    harmonyPenalty: number;
    styleHarmonyPenalty: number;
  };
  items: OutfitItem[];
  slotMap: OutfitSlotMap;
};

type UserStyleContext = {
  requestedStyle: string | null;
  favoriteStyle: string | null;
  targetStyle: string | null;
};

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeItem(item: any): OutfitItem {
  return {
    id: item.id,
    name: item.name ?? null,
    category: item.category,
    subcategory: item.subCategory ?? null,
    colors: item.color ?? [],
    styles: item.styleTags ?? [],
    inspirations: item.inspirationTags ?? [],
    seasons: item.season ?? [],
    formality: item.formality ?? 3,
    imageUrl: item.imageUrl ?? null,
    brand: item.brand ?? null,
  };
}

function buildSlotMap(items: OutfitItem[]): OutfitSlotMap {
  const tops = items.filter((item) => item.category === "tops");
  const bottom = items.find((item) => item.category === "bottoms") ?? null;
  const onepiece = items.find((item) => item.category === "onepiece") ?? null;
  const outer = items.find((item) => item.category === "outer") ?? null;
  const shoes = items.find((item) => item.category === "shoes") ?? null;
  const bag =
    items.find((item) => item.category === "bag" || item.category === "bags") ?? null;

  return {
    topPrimary: tops[0] ?? null,
    topSecondary: tops[1] ?? null,
    bottom,
    onepiece,
    outer,
    shoes,
    bag,
  };
}

function hasSeasonMatch(item: OutfitItem, minTemp: number, maxTemp: number) {
  const avgTemp = (minTemp + maxTemp) / 2;
  const seasons = item.seasons ?? [];

  if (!seasons.length) return true;

  if (avgTemp <= 10) return seasons.includes("winter");
  if (avgTemp <= 18) return seasons.includes("autumn") || seasons.includes("spring");
  if (avgTemp <= 25) return seasons.includes("spring") || seasons.includes("summer");
  return seasons.includes("summer");
}

const HIGH_HARMONY_PAIRS = new Set([
  "white|black",
  "white|navy",
  "white|gray",
  "white|beige",
  "black|gray",
  "black|beige",
  "black|navy",
  "gray|navy",
  "beige|brown",
  "beige|white",
  "brown|white",
  "brown|navy",
  "navy|beige",
  "navy|gray",
  "pink|white",
  "blue|white",
  "green|white",
  "red|white",
]);

const MID_HARMONY_PAIRS = new Set([
  "black|white",
  "navy|white",
  "gray|white",
  "beige|black",
  "navy|black",
  "pink|beige",
  "blue|gray",
  "green|beige",
  "red|black",
  "yellow|white",
]);

const LOW_HARMONY_PAIRS = new Set([
  "red|green",
  "yellow|pink",
  "blue|brown",
  "green|red",
]);

function makePairKey(a: string, b: string) {
  return [normalizeText(a), normalizeText(b)].sort().join("|");
}

function scoreColorBalance(items: OutfitItem[]) {
  const uniqueColors = Array.from(
    new Set(
      items.flatMap((item) => item.colors ?? []).map((color) => normalizeText(color))
    )
  ).filter(Boolean);

  if (uniqueColors.length === 0) return 8;

  let score = 8;

  const count = uniqueColors.length;
  if (count <= 2) score += 3;
  else if (count === 3) score += 2;
  else if (count === 4) score += 0;
  else score -= 2;

  let pairBonus = 0;
  for (let i = 0; i < uniqueColors.length; i += 1) {
    for (let j = i + 1; j < uniqueColors.length; j += 1) {
      const key = makePairKey(uniqueColors[i], uniqueColors[j]);
      if (HIGH_HARMONY_PAIRS.has(key)) pairBonus += 2;
      else if (MID_HARMONY_PAIRS.has(key)) pairBonus += 1;
      else if (LOW_HARMONY_PAIRS.has(key)) pairBonus -= 2;
    }
  }

  score += pairBonus;

  const neutralColors = ["white", "black", "gray", "beige", "brown", "navy"];
  const neutralCount = uniqueColors.filter((color) => neutralColors.includes(color)).length;
  if (neutralCount >= 2) score += 1;

  return Math.max(3, Math.min(score, 15));
}

function scoreStyleMatch(items: OutfitItem[], requestedStyle: string | null) {
  if (!requestedStyle) return 10;

  let matchedCount = 0;
  for (const item of items) {
    if ((item.styles ?? []).includes(requestedStyle)) {
      matchedCount += 1;
    }
  }

  if (matchedCount >= 3) return 20;
  if (matchedCount === 2) return 14;
  if (matchedCount === 1) return 8;
  return 0;
}

function scoreTemperature(items: OutfitItem[], minTemp: number, maxTemp: number) {
  const matched = items.filter((item) => hasSeasonMatch(item, minTemp, maxTemp)).length;

  if (matched === items.length) return 10;
  if (matched >= Math.max(1, items.length - 1)) return 7;
  return 4;
}

function scoreStructure(items: OutfitItem[]) {
  const tops = items.filter((item) => item.category === "tops");
  const hasTop = tops.length >= 1;
  const hasBottom = items.some((item) => item.category === "bottoms");
  const hasOnepiece = items.some((item) => item.category === "onepiece");
  const hasShoes = items.some((item) => item.category === "shoes");

  if (hasOnepiece && hasShoes) return 10;
  if (hasTop && hasBottom && hasShoes) return 10;
  return 0;
}

function hasStyleValue(item: OutfitItem | undefined, ...values: string[]) {
  if (!item) return false;
  return (item.styles ?? []).some((style) =>
    values.some((value) => normalizeText(style) === normalizeText(value))
  );
}

function hasSubValue(item: OutfitItem | undefined, ...values: string[]) {
  if (!item) return false;
  return values.some((value) => normalizeText(item.subcategory) === normalizeText(value));
}

function isSetupLike(items: OutfitItem[]) {
  const outer = items.find((item) => item.category === "outer");
  const bottom = items.find((item) => item.category === "bottoms");

  if (!outer || !bottom) return false;

  const sameColor =
    normalizeText(outer.colors?.[0]) !== "" &&
    normalizeText(outer.colors?.[0]) === normalizeText(bottom.colors?.[0]);

  const sameBrand =
    normalizeText(outer.brand) !== "" &&
    normalizeText(outer.brand) === normalizeText(bottom.brand);

  const setupOuter = ["jacket", "tailored_jacket", "blouson", "cardigan", "coat"].includes(
    normalizeText(outer.subcategory)
  );

  const setupBottom = ["slacks", "wide_pants", "shorts", "skirt"].includes(
    normalizeText(bottom.subcategory)
  );

  return setupOuter && setupBottom && (sameColor || sameBrand);
}

function isSuitLike(items: OutfitItem[]) {
  const outer = items.find((item) => item.category === "outer");
  const bottom = items.find((item) => item.category === "bottoms");

  if (!outer || !bottom) return false;

  const outerSub = normalizeText(outer.subcategory);
  const bottomSub = normalizeText(bottom.subcategory);

  const sameColor =
    normalizeText(outer.colors?.[0]) !== "" &&
    normalizeText(outer.colors?.[0]) === normalizeText(bottom.colors?.[0]);

  const outerOffice = (outer.styles ?? []).includes("office");
  const bottomOffice = (bottom.styles ?? []).includes("office");

  const suitShape =
    ["jacket", "tailored_jacket"].includes(outerSub) &&
    bottomSub === "slacks";

  return suitShape && sameColor && outerOffice && bottomOffice;
}

function scoreOccasion(items: OutfitItem[], occasion: string | null) {
  if (!occasion) return 10;

  const top = items.find((item) => item.category === "tops");
  const bottom = items.find((item) => item.category === "bottoms");
  const onepiece = items.find((item) => item.category === "onepiece");
  const outer = items.find((item) => item.category === "outer");
  const shoes = items.find((item) => item.category === "shoes");
  const bag = items.find(
    (item) => item.category === "bag" || item.category === "bags"
  );

  if (occasion === "formal" || occasion === "office") {
    let score = 8;

    const isOfficeLikeTop =
      (top &&
        (hasSubValue(top, "shirt", "blouse") ||
          hasStyleValue(top, "office") ||
          top.formality >= 4)) ||
      (onepiece &&
        (hasStyleValue(onepiece, "office") || onepiece.formality >= 4));

    const isFormalBottom =
      bottom &&
      (hasSubValue(bottom, "slacks") ||
        hasStyleValue(bottom, "office") ||
        bottom.formality >= 4);

    const isFormalOuter =
      outer &&
      (hasSubValue(outer, "jacket", "tailored_jacket", "coat") ||
        hasStyleValue(outer, "office") ||
        outer.formality >= 4);

    const isFormalShoes =
      shoes &&
      (hasSubValue(shoes, "pumps", "loafers", "heels") ||
        hasStyleValue(shoes, "office") ||
        shoes.formality >= 4);

    const shoesAreSneakers =
      shoes &&
      (hasSubValue(shoes, "sneaker", "sneakers") || nameIncludes(shoes, "スニーカー"));

    if ((isSuitLike(items) || (isFormalOuter && isFormalBottom)) && shoesAreSneakers) {
      score -= 8;
    }

    if (isOfficeLikeTop) score += 5;
    if (isFormalBottom) score += 3;
    if (isFormalOuter) score += 2;
    if (isFormalShoes) score += 2;

    return Math.min(score, 20);
  }

  if (occasion === "casual") {
    let score = 8;

    const casualTop =
      top &&
      (hasStyleValue(top, "casual", "girly", "minimal") ||
        hasSubValue(top, "tshirt", "knit", "cardigan", "sweat", "hoodie"));

    const casualBottom =
      bottom &&
      (hasStyleValue(bottom, "casual", "girly", "minimal") ||
        hasSubValue(bottom, "denim", "skirt", "wide_pants", "shorts"));

    const casualShoes =
      shoes &&
      (hasSubValue(shoes, "sneakers", "loafers", "sandals", "flat_shoes") ||
        hasStyleValue(shoes, "casual"));

    const casualBag =
      bag &&
      (hasSubValue(bag, "shoulder_bag", "tote_bag", "mini_bag") ||
        hasStyleValue(bag, "casual"));

    if (casualTop) score += 4;
    if (casualBottom) score += 3;
    if (casualShoes) score += 3;
    if (casualBag) score += 2;

    return Math.min(score, 20);
  }

  if (occasion === "date") {
    let score = 8;

    const dateTop =
      top &&
      (hasStyleValue(top, "feminine", "girly", "mode") ||
        hasSubValue(top, "blouse", "knit", "cardigan"));

    const dateOnepiece =
      onepiece &&
      (hasStyleValue(onepiece, "feminine", "girly", "mode") ||
        onepiece.formality >= 3);

    const dateBottom =
      bottom &&
      (hasStyleValue(bottom, "feminine", "girly", "mode") ||
        hasSubValue(bottom, "skirt"));

    const dateShoes =
      shoes &&
      (hasSubValue(shoes, "pumps", "heels", "boots", "loafers") ||
        hasStyleValue(shoes, "feminine", "mode"));

    const dateBag =
      bag &&
      (hasSubValue(bag, "mini_bag", "handbag", "shoulder_bag") ||
        hasStyleValue(bag, "feminine", "mode"));

    if (dateTop) score += 3;
    if (dateOnepiece) score += 5;
    if (dateBottom) score += 2;
    if (dateShoes) score += 2;
    if (dateBag) score += 2;

    const hasOfficeTop = top && hasStyleValue(top, "office");
    const hasOfficeBottom = bottom && hasStyleValue(bottom, "office");
    const hasOfficeOuter = outer && hasStyleValue(outer, "office");
    const hasOfficeShoes = shoes && hasStyleValue(shoes, "office");

    const avgFormality =
      items.reduce((sum, item) => sum + (item.formality ?? 3), 0) /
      Math.max(items.length, 1);

    if (hasOfficeTop) score -= 1;
    if (hasOfficeBottom) score -= 2;
    if (hasOfficeOuter) score -= 2;
    if (hasOfficeShoes) score -= 1;
    if (isSuitLike(items)) score -= 4;
    if (avgFormality >= 4.2) score -= 2;

    return Math.max(3, Math.min(score, 20));
  }

  if (occasion === "travel") {
    let score = 8;

    const travelTop =
      top &&
      (hasStyleValue(top, "casual", "minimal") ||
        hasSubValue(top, "tshirt", "shirt", "knit", "hoodie", "cardigan"));

    const travelBottom =
      bottom &&
      (hasSubValue(bottom, "denim", "wide_pants", "slacks", "shorts") ||
        hasStyleValue(bottom, "casual", "minimal"));

    const travelShoes =
      shoes &&
      (hasSubValue(shoes, "sneakers", "boots", "sandals", "loafers") ||
        hasStyleValue(shoes, "casual"));

    const travelBag =
      bag &&
      (hasSubValue(bag, "backpack", "tote_bag", "shoulder_bag") ||
        hasStyleValue(bag, "casual", "minimal"));

    if (travelTop) score += 3;
    if (travelBottom) score += 3;
    if (travelShoes) score += 4;
    if (travelBag) score += 2;

    return Math.min(score, 20);
  }

  return 10;
}

function scorePreference(items: OutfitItem[], requestedStyle: string | null) {
  if (!requestedStyle) return 10;

  const matched = items.filter((item) =>
    (item.styles ?? []).includes(requestedStyle)
  ).length;

  if (matched >= 2) return 10;
  if (matched === 1) return 6;
  return 3;
}

function countMatchedStyle(items: OutfitItem[], style: string | null) {
  if (!style) return 0;

  return items.filter((item) =>
    (item.styles ?? []).some((tag) => normalizeText(tag) === normalizeText(style))
  ).length;
}

function scoreFavoriteStyleBonus(items: OutfitItem[], favoriteStyle: string | null) {
  const matched = countMatchedStyle(items, favoriteStyle);

  if (matched >= 3) return 8;
  if (matched === 2) return 5;
  if (matched === 1) return 2;
  return 0;
}

function scoreTargetStyleBonus(items: OutfitItem[], targetStyle: string | null) {
  const matched = countMatchedStyle(items, targetStyle);

  if (matched >= 3) return 6;
  if (matched === 2) return 4;
  if (matched === 1) return 1;
  return 0;
}

function scoreInspirationBonus(items: OutfitItem[], targetStyle: string | null) {
  if (!targetStyle) return 0;

  const styleInspirationMap: Record<string, string[]> = {
    clean: ["korean", "japanese_feminine", "french"],
    feminine: ["japanese_feminine", "french", "korean", "balletcore"],
    girly: ["korean", "balletcore", "japanese_feminine"],
    elegant: ["old_money", "french"],
    minimal: ["city_girl", "old_money"],
    casual: ["overseas_girl", "city_girl"],
    street: ["y2k", "overseas_girl"],
    mode: ["city_girl", "old_money"],
    natural: ["french"],
    sporty: ["y2k", "overseas_girl"],
  };

  const relatedInspirations = styleInspirationMap[targetStyle] ?? [];
  if (relatedInspirations.length === 0) return 0;

  let bonus = 0;
  for (const item of items) {
    for (const inspiration of item.inspirations ?? []) {
      if (relatedInspirations.includes(normalizeText(inspiration))) {
        bonus += 2;
      }
    }
  }

  return Math.min(bonus, 6);
}

function scoreRewear(items: OutfitItem[]) {
  const simpleColors = ["white", "black", "gray", "beige", "navy", "brown"];
  let versatileCount = 0;

  for (const item of items) {
    const colors = item.colors ?? [];
    if (colors.some((color: string) => simpleColors.includes(color))) {
      versatileCount += 1;
    }
  }

  if (versatileCount >= 3) return 10;
  if (versatileCount === 2) return 7;
  return 4;
}

function scoreVersatility(items: OutfitItem[]) {
  const versatileColors = ["white", "black", "gray", "beige", "navy", "brown"];
  const versatileSubs = [
    "shirt",
    "tshirt",
    "knit",
    "cardigan",
    "slacks",
    "wide_pants",
    "sneakers",
    "loafers",
    "tote_bag",
    "backpack",
  ];

  let score = 0;

  for (const item of items) {
    const hasVersatileColor = (item.colors ?? []).some((color) =>
      versatileColors.includes(normalizeText(color))
    );

    const hasVersatileSub = versatileSubs.includes(normalizeText(item.subcategory));

    const hasVersatileStyle = (item.styles ?? []).some((style) =>
      ["minimal", "casual", "office"].includes(normalizeText(style))
    );

    if (hasVersatileColor) score += 2;
    if (hasVersatileSub) score += 2;
    if (hasVersatileStyle) score += 1;
  }

  return Math.min(score, 10);
}

function scoreSetupBonus(items: OutfitItem[]) {
  const outer = items.find((item) => item.category === "outer");
  const bottom = items.find((item) => item.category === "bottoms");

  if (!outer || !bottom) return 0;

  const outerColor = normalizeText(outer.colors?.[0]);
  const bottomColor = normalizeText(bottom.colors?.[0]);
  const outerBrand = normalizeText(outer.brand);
  const bottomBrand = normalizeText(bottom.brand);

  let bonus = 0;

  if (isSetupLike(items)) bonus += 4;
  if (outerColor && bottomColor && outerColor === bottomColor) bonus += 3;
  if (outerBrand && bottomBrand && outerBrand === bottomBrand) bonus += 1;

  const bothFormalish =
    (outer.formality ?? 3) >= 4 && (bottom.formality ?? 3) >= 4;
  if (bothFormalish) bonus += 2;

  return Math.min(bonus, 10);
}

function scoreSuitBonus(items: OutfitItem[], occasion: string | null) {
  if (!isSuitLike(items)) return 0;
  if (occasion === "formal" || occasion === "office") return 3;
  return 0;
}

function scoreHarmonyPenalty(items: OutfitItem[]) {
  const outer = items.find((item) => item.category === "outer");
  const bottom = items.find((item) => item.category === "bottoms");
  const shoes = items.find((item) => item.category === "shoes");

  let penalty = 0;

  const outerIsOffice =
    outer &&
    (
      (outer.styles ?? []).includes("office") ||
      ["jacket", "tailored_jacket", "coat"].includes(normalizeText(outer.subcategory)) ||
      outer.formality >= 4
    );

  const bottomIsSweatLike =
    bottom &&
    (
      ["sweat", "sweatpants", "jogger", "jogger_pants"].includes(normalizeText(bottom.subcategory)) ||
      normalizeText(bottom.name).includes("スウェット")
    );

  const bottomIsVeryCasual =
    bottom &&
    (
      (bottom.styles ?? []).includes("casual") ||
      (bottom.styles ?? []).includes("street")
    );

  const shoesAreFormal =
    shoes &&
    (
      ["loafers", "pumps", "heels"].includes(normalizeText(shoes.subcategory)) ||
      shoes.formality >= 4
    );

  if (outerIsOffice && bottomIsSweatLike) penalty += 8;
  if (outerIsOffice && bottomIsVeryCasual) penalty += 4;
  if (bottomIsSweatLike && shoesAreFormal) penalty += 4;

  const bottomIsFormal =
    bottom &&
    (
      ["slacks"].includes(normalizeText(bottom.subcategory)) ||
      (bottom.styles ?? []).includes("office") ||
      bottom.formality >= 4
    );

  const shoesAreSneakers =
    shoes &&
    (
      ["sneaker", "sneakers"].includes(normalizeText(shoes.subcategory)) ||
      normalizeText(shoes.name).includes("スニーカー")
    );

  if (isSuitLike(items) && shoesAreSneakers) penalty += 10;
  if (outerIsOffice && bottomIsFormal && shoesAreSneakers) penalty += 8;

  return penalty;
}

function scoreStyleHarmonyPenalty(items: OutfitItem[]) {
  const counts: Record<string, number> = {};

  for (const item of items) {
    for (const style of item.styles ?? []) {
      const key = normalizeText(style);
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (entries.length <= 1) return 0;

  const dominantStyle = entries[0]?.[0] ?? null;
  const styleKinds = entries.length;
  const dominantCount = entries[0]?.[1] ?? 0;

  let penalty = 0;

  if (styleKinds >= 5) penalty += 8;
  else if (styleKinds === 4) penalty += 6;
  else if (styleKinds === 3) penalty += 3;

  const hasOffice = Boolean(counts["office"]);
  const hasStreet = Boolean(counts["street"]);
  const hasFeminine = Boolean(counts["feminine"]);
  const hasGirly = Boolean(counts["girly"]);
  const hasMode = Boolean(counts["mode"]);
  const hasCasual = Boolean(counts["casual"]);
  const hasClean = Boolean(counts["clean"]);
  const hasElegant = Boolean(counts["elegant"]);
  const hasSporty = Boolean(counts["sporty"]);
  const hasNatural = Boolean(counts["natural"]);
  const hasSimple = Boolean(counts["simple"]);

if (hasOffice && hasStreet) penalty += 6;
  if (hasStreet && hasFeminine) penalty += 4;
  if (hasStreet && hasGirly) penalty += 4;
  if (hasStreet && hasElegant) penalty += 4;
  if (hasStreet && hasClean) penalty += 3;
  if (hasMode && hasGirly) penalty += 2;
  if (hasOffice && hasCasual && dominantStyle !== "office") penalty += 3;
  if (hasElegant && hasSporty) penalty += 3;
  if (dominantCount <= 1 && styleKinds >= 3) penalty += 4;
  if (dominantCount <= 2 && styleKinds >= 4) penalty += 2;

  return Math.min(penalty, 15);
}

function scoreMoodCohesionBonus(items: OutfitItem[]) {
  let bonus = 0;

  const styleCounts: Record<string, number> = {};
  const normalizedStylesPerItem = items.map((item) =>
    (item.styles ?? []).map((style) => normalizeText(style)).filter(Boolean)
  );

  for (const styles of normalizedStylesPerItem) {
    for (const style of styles) {
      styleCounts[style] = (styleCounts[style] ?? 0) + 1;
    }
  }

  const sortedStyles = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]);
  const dominantCount = sortedStyles[0]?.[1] ?? 0;

  const avgFormality =
    items.reduce((sum, item) => sum + (item.formality ?? 3), 0) /
    Math.max(items.length, 1);

  const farFormalityCount = items.filter(
    (item) => Math.abs((item.formality ?? 3) - avgFormality) >= 1.5
  ).length;

  const allColors = items.flatMap((item) =>
    (item.colors ?? []).map((color) => normalizeText(color)).filter(Boolean)
  );
  const uniqueColors = [...new Set(allColors)];

  if (dominantCount >= 3) bonus += 4;
  else if (dominantCount >= 2) bonus += 2;

  if (sortedStyles.length <= 2) bonus += 3;
  else if (sortedStyles.length === 3) bonus += 1;

  if (farFormalityCount === 0) bonus += 3;
  else if (farFormalityCount === 1) bonus += 1;

  if (uniqueColors.length <= 3) bonus += 2;
  else if (uniqueColors.length === 4) bonus += 1;

  if (isSetupLike(items)) bonus += 2;
  if (isSuitLike(items)) bonus += 2;

  return Math.min(bonus, 12);
}

function buildReasons(
  score: number,
  breakdown: OutfitResult["breakdown"],
  fixedItemName?: string | null,
  items?: OutfitItem[]
) {
  const reasons: string[] = [];

  if (fixedItemName) {
    reasons.push(`「${fixedItemName}」を主役にして組みやすい構成です`);
  }

  if (items && isSuitLike(items)) {
    reasons.push("フォーマル寄りで整った印象の組み合わせです");
  } else if (items && isSetupLike(items)) {
    reasons.push("セットアップ感があり、全体に統一感があります");
  }

  if (breakdown.style >= 14) {
    reasons.push("スタイルの方向性が比較的揃っています");
  } else if (breakdown.style >= 8) {
    reasons.push("スタイルは部分的に一致しています");
  } else {
    reasons.push("スタイル感はやや弱めです");
  }

  if (breakdown.color >= 12) {
    reasons.push("色相性がよく、まとまりのある配色です");
  } else if (breakdown.color >= 9) {
    reasons.push("色合わせは概ね成立しています");
  } else {
    reasons.push("色の組み合わせは調整余地があります");
  }

  if (breakdown.moodCohesionBonus >= 8) {
    reasons.push("全体の雰囲気がよく揃っていて、統一感があります");
  } else if (breakdown.moodCohesionBonus >= 4) {
    reasons.push("雰囲気にある程度まとまりがあります");
  }

  if (score >= 70) {
    reasons.push("かなり取り入れやすい候補です");
  } else if (score >= 55) {
    reasons.push("無難に使いやすい候補です");
  } else {
    reasons.push("ベースは成立していますが改善余地があります");
  }

  return reasons;
}

async function enrichOutfitsWithLlmComments(
  outfits: OutfitResult[],
  context: {
    occasion: string | null;
    style: string | null;
    favoriteStyle: string | null;
    targetStyle: string | null;
    minTemp: number;
    maxTemp: number;
  }
) {
  const enriched = await Promise.all(
    outfits.map(async (outfit) => {
      try {
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
          temperature: 0.7,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "あなたは日本語のAIスタイリストです。必ずJSONのみ返してください。",
            },
            {
              role: "user",
              content: JSON.stringify({
                instruction:
                  "次のコーデ候補データをもとに、summary 1文と reasons 2〜4件を日本語で返してください。ポジティブ寄りで、実用的、過剰に盛らないこと。",
                occasion: context.occasion,
                style: context.style,
                favoriteStyle: context.favoriteStyle,
                targetStyle: context.targetStyle,
                temperatureLabel: `${context.minTemp}-${context.maxTemp}`,
                score: outfit.score,
                breakdown: outfit.breakdown,
                items: outfit.items.map((item) => ({
                  name: item.name,
                  category: item.category,
                  subcategory: item.subcategory,
                  colors: item.colors,
                  styles: item.styles,
                  inspirations: item.inspirations,
                  seasons: item.seasons,
                  formality: item.formality,
                })),
                fallbackReasons: outfit.reasons,
                responseFormat: {
                  summary: "string",
                  reasons: ["string", "string"],
                },
              }),
            },
          ],
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as {
          summary?: string;
          reasons?: string[];
        };

        const llmReasons =
          Array.isArray(parsed.reasons) &&
          parsed.reasons.filter((v): v is string => typeof v === "string").length > 0
            ? parsed.reasons.filter((v): v is string => typeof v === "string").slice(0, 4)
            : outfit.reasons;

        return {
          ...outfit,
          reasons: llmReasons,
        };
      } catch (error) {
        console.error("outfit comment LLM fallback:", error);
        return outfit;
      }
    })
  );

  return enriched;
}

function buildOutfit(
  items: OutfitItem[],
  styleContext: UserStyleContext,
  requestedOccasion: string | null,
  prioritizeVersatility: boolean,
  minTemp: number,
  maxTemp: number,
  fixedItemName?: string | null
): OutfitResult {
  const normalizedItems = items;
  const effectiveStyle = styleContext.requestedStyle ?? styleContext.favoriteStyle ?? null;

  const breakdown = {
    occasion: scoreOccasion(normalizedItems, requestedOccasion),
    style: scoreStyleMatch(normalizedItems, effectiveStyle),
    color: scoreColorBalance(normalizedItems),
    preference: scorePreference(normalizedItems, effectiveStyle),
    rewear: scoreRewear(normalizedItems),
  };

  const setupBonus = scoreSetupBonus(normalizedItems);
  const suitBonus = scoreSuitBonus(normalizedItems, requestedOccasion);
  const moodCohesionBonus = scoreMoodCohesionBonus(normalizedItems);

  const versatilityBonus =
    requestedOccasion === "travel" && prioritizeVersatility
      ? scoreVersatility(normalizedItems)
      : 0;

  const favoriteStyleBonus = scoreFavoriteStyleBonus(
    normalizedItems,
    styleContext.favoriteStyle
  );

  const targetStyleBonus = scoreTargetStyleBonus(
    normalizedItems,
    styleContext.targetStyle
  );

  const inspirationBonus = scoreInspirationBonus(
    normalizedItems,
    styleContext.targetStyle
  );

  const harmonyPenalty = scoreHarmonyPenalty(normalizedItems);
  const styleHarmonyPenalty = scoreStyleHarmonyPenalty(normalizedItems);

  const fullBreakdown: OutfitResult["breakdown"] = {
    ...breakdown,
    setupBonus,
    suitBonus,
    moodCohesionBonus,
    versatilityBonus,
    favoriteStyleBonus,
    targetStyleBonus,
    inspirationBonus,
    harmonyPenalty,
    styleHarmonyPenalty,
  };

  const score =
    breakdown.occasion +
    breakdown.style +
    breakdown.color +
    breakdown.preference +
    breakdown.rewear +
    setupBonus +
    suitBonus +
    moodCohesionBonus +
    versatilityBonus +
    favoriteStyleBonus +
    targetStyleBonus +
    inspirationBonus -
    harmonyPenalty -
    styleHarmonyPenalty;

  return {
    rank: 0,
    score: Math.max(0, Math.round(score)),
    reasons: buildReasons(score, fullBreakdown, fixedItemName, normalizedItems),
    breakdown: fullBreakdown,
    items: normalizedItems,
    slotMap: buildSlotMap(normalizedItems),
  };
}

function uniqueByKey<T>(arr: T[], getKey: (item: T) => string) {
  const map = new Map<string, T>();
  for (const item of arr) {
    map.set(getKey(item), item);
  }
  return Array.from(map.values());
}

function needsOuterByTemperature(minTemp: number, maxTemp: number) {
  return maxTemp <= 15;
}

function hasOuter(items: OutfitItem[]) {
  return items.some((item) => item.category === "outer");
}

function hasSubcategory(item: OutfitItem, ...values: string[]) {
  const sub = normalizeText(item.subcategory);
  return values.some((value) => sub === normalizeText(value));
}

function nameIncludes(item: OutfitItem, ...keywords: string[]) {
  const name = normalizeText(item.name);
  return keywords.some((keyword) => name.includes(normalizeText(keyword)));
}

function hasStyle(items: OutfitItem[], ...values: string[]) {
  return items.some((item) =>
    (item.styles ?? []).some((style) =>
      values.some((value) => normalizeText(style) === normalizeText(value))
    )
  );
}

function hasOnlyOfficeStyle(item: OutfitItem | undefined) {
  if (!item) return false;

  const styles = (item.styles ?? [])
    .map((style) => normalizeText(style))
    .filter(Boolean);

  if (styles.length === 0) return false;

  return styles.length === 1 && styles[0] === "office";
}

function isOfficeWearSubcategory(item: OutfitItem | undefined) {
  if (!item) return false;

  return hasSubcategory(
    item,
    "office_jacket",
    "office_pants",
    "office_skirt",
    "office_shirt"
  );
}

function isOfficeSuitLike(items: OutfitItem[]) {
  const top = items.find((item) => item.category === "tops");
  const bottom = items.find((item) => item.category === "bottoms");
  const outer = items.find((item) => item.category === "outer");

  if (!top || !bottom || !outer) return false;

  const isOfficeTop = hasSubcategory(top, "office_shirt");
  const isOfficeBottom = hasSubcategory(bottom, "office_pants", "office_skirt");
  const isOfficeOuter = hasSubcategory(outer, "office_jacket");

  return isOfficeTop && isOfficeBottom && isOfficeOuter;
}

function filterItemsByOccasion(items: OutfitItem[], occasion: string | null) {
  if (occasion === "office" || occasion === "formal") {
    return items;
  }
  return items.filter((item) => !isOfficeWearSubcategory(item));
}

function canLayerTops(primary: OutfitItem, secondary: OutfitItem) {
  const primarySub = normalizeText(primary.subcategory);
  const secondarySub = normalizeText(secondary.subcategory);

  const primaryInnerLike = ["tshirt", "shirt", "blouse", "camisole"].includes(primarySub);
  const primaryLightLike = ["tshirt", "shirt", "blouse", "camisole", "knit"].includes(primarySub);

  const secondaryOuterTopLike = ["cardigan", "hoodie", "sweat", "knit", "shirt"].includes(
    secondarySub
  );

  if (primary.id === secondary.id) return false;
  if (!primaryInnerLike && !primaryLightLike) return false;
  if (!secondaryOuterTopLike) return false;

  return true;
}

function passesOccasionRule(items: OutfitItem[], occasion: string | null) {
  if (!occasion) return true;

  const hasDenim = items.some(
    (item) => hasSubcategory(item, "denim") || nameIncludes(item, "デニム", "denim")
  );

  const hasSneakers = items.some(
    (item) =>
      item.category === "shoes" &&
      (hasSubcategory(item, "sneaker", "sneakers") ||
        nameIncludes(item, "スニーカー", "sneaker", "sneakers"))
  );

  const hasSweatBottoms = items.some(
    (item) =>
      item.category === "bottoms" &&
      (hasSubcategory(item, "sweat", "sweatpants", "jogger", "jogger_pants") ||
        nameIncludes(item, "スウェット", "ジョガー"))
  );

  const hasStreetStyle = hasStyle(items, "street");
  const avgFormality =
    items.reduce((sum, item) => sum + (item.formality ?? 3), 0) /
    Math.max(items.length, 1);

  const officeWearCount = items.filter((item) => isOfficeWearSubcategory(item)).length;
  const officeSuitLike = isOfficeSuitLike(items);

  if (occasion === "formal") {
    if (hasDenim) return false;
    if (hasSneakers) return false;
    if (hasSweatBottoms) return false;
    if (hasStreetStyle) return false;
    if (avgFormality < 3.5) return false;
    if (officeSuitLike) return false;
    return true;
  }

  if (occasion === "office") {
    if (hasSneakers) return false;
    if (hasSweatBottoms) return false;
    if (hasStreetStyle) return false;
    if (avgFormality < 2.5) return false;
    if (officeSuitLike) return false;
    return true;
  }

  if (occasion === "casual") {
    if (officeWearCount > 0) return false;
    if (avgFormality >= 4.2) return false;
    return true;
  }

  if (occasion === "date") {
    if (officeWearCount > 0) return false;
    if (hasStreetStyle && avgFormality <= 1.5) return false;
    if (avgFormality >= 4.2) return false;
    return true;
  }

  if (occasion === "travel") {
    if (officeWearCount > 0) return false;
    if (avgFormality >= 3.8) return false;

    const hasHardToWalkShoes = items.some(
      (item) =>
        item.category === "shoes" &&
        (hasSubcategory(item, "heels", "pumps") ||
          nameIncludes(item, "ヒール", "パンプス"))
    );

    if (hasHardToWalkShoes) return false;
    return true;
  }

  return true;
}

function passesTemperatureRule(items: OutfitItem[], minTemp: number, maxTemp: number) {
  const matched = items.filter((item) => hasSeasonMatch(item, minTemp, maxTemp)).length;
  return matched >= Math.max(1, items.length - 1);
}

function passesStyleConsistencyRule(items: OutfitItem[], occasion: string | null) {
  const top = items.find((item) => item.category === "tops");
  const bottom = items.find((item) => item.category === "bottoms");
  const outer = items.find((item) => item.category === "outer");
  const shoes = items.find((item) => item.category === "shoes");
  const bag = items.find((item) => item.category === "bag" || item.category === "bags");

  const topOffice = top && hasStyleValue(top, "office");
  const topFeminine = top && hasStyleValue(top, "feminine", "girly");
  const topCasual = top && hasStyleValue(top, "casual");
  const bottomOffice = bottom && hasStyleValue(bottom, "office");
  const bottomStreet = bottom && hasStyleValue(bottom, "street");
  const bottomCasual = bottom && hasStyleValue(bottom, "casual");

  const outerOffice =
    outer &&
    (
      hasStyleValue(outer, "office") ||
      ["jacket", "tailored_jacket", "coat"].includes(normalizeText(outer.subcategory)) ||
      outer.formality >= 4
    );

  const outerStreet = outer && hasStyleValue(outer, "street");
  const outerCasual = outer && hasStyleValue(outer, "casual");

  const shoesOffice =
    shoes &&
    (
      hasStyleValue(shoes, "office") ||
      ["loafers", "pumps", "heels"].includes(normalizeText(shoes.subcategory)) ||
      shoes.formality >= 4
    );

  const shoesStreet = shoes && hasStyleValue(shoes, "street");
  const shoesCasual =
    shoes &&
    (
      hasStyleValue(shoes, "casual") ||
      ["sneakers", "sandals"].includes(normalizeText(shoes.subcategory))
    );

  const bagOffice = bag && hasStyleValue(bag, "office");
  const bagStreet = bag && hasStyleValue(bag, "street");
  const bagCasual = bag && hasStyleValue(bag, "casual");

  const bottomIsSweatLike =
    bottom &&
    (
      ["sweat", "sweatpants", "jogger", "jogger_pants", "shorts", "short_pants"].includes(
        normalizeText(bottom.subcategory)
      ) ||
      nameIncludes(bottom, "スウェット", "ジョガー", "ショーパン", "shorts")
    );

  const bottomIsFormal =
    bottom &&
    (
      hasStyleValue(bottom, "office") ||
      hasSubValue(bottom, "slacks") ||
      bottom.formality >= 4
    );

  const outerIsFormal =
    outer &&
    (
      hasStyleValue(outer, "office") ||
      hasSubValue(outer, "jacket", "tailored_jacket", "coat") ||
      outer.formality >= 4
    );

  const shoesAreSneakers =
    shoes &&
    (
      hasSubValue(shoes, "sneaker", "sneakers") ||
      nameIncludes(shoes, "スニーカー")
    );

  const suitLikeUpperLower =
    outer &&
    bottom &&
    (
      isSuitLike(items) ||
      (outerIsFormal && bottomIsFormal)
    );

  if (suitLikeUpperLower && shoesAreSneakers) return false;
  if (outerOffice && shoesCasual) return false;
  if (bottomOffice && shoesCasual) return false;
  if (bagOffice && shoesStreet) return false;
  if (bagOffice && shoesCasual && !shoesOffice) return false;
  if (outerOffice && bottomStreet) return false;
  if (outerOffice && bottomIsSweatLike) return false;
  if (topFeminine && outerStreet) return false;
  if (topFeminine && bottomStreet) return false;

  const officeCount = [topOffice, bottomOffice, outerOffice, shoesOffice, bagOffice].filter(Boolean).length;
  const streetCount = [bottomStreet, outerStreet, shoesStreet, bagStreet].filter(Boolean).length;
  const casualCount = [topCasual, bottomCasual, outerCasual, shoesCasual, bagCasual].filter(Boolean).length;

  if (officeCount >= 2 && streetCount >= 1) return false;
  if (officeCount >= 3 && casualCount >= 2) return false;

  if (occasion === "date") {
    if (isSuitLike(items)) return false;
    if (outerStreet && bagOffice) return false;
    if (outerStreet && shoesOffice) return false;
  }

  if (occasion === "formal" || occasion === "office") {
    if (outerStreet || shoesStreet || bagStreet) return false;
    if (shoesCasual) return false;
  }

  if (occasion === "travel") {
    if (isSuitLike(items)) return false;
  }

  return true;
}

function passesHardRules(
  items: OutfitItem[],
  minTemp: number,
  maxTemp: number,
  occasion: string | null
) {
  if ((occasion === "office" || occasion === "formal") && isOfficeSuitLike(items)) {
    return false;
  }

  const structureScore = scoreStructure(items);
  if (structureScore <= 0) return false;

  if (!passesTemperatureRule(items, minTemp, maxTemp)) return false;
  if (!passesOccasionRule(items, occasion)) return false;
  if (!passesStyleConsistencyRule(items, occasion)) return false;

  if (needsOuterByTemperature(minTemp, maxTemp) && !hasOuter(items)) {
    return false;
  }

  return true;
}

function buildTopCombos(tops: OutfitItem[]) {
  const combos: OutfitItem[][] = [];

  for (const top of tops) {
    combos.push([top]);
  }

  for (const primary of tops) {
    for (const secondary of tops) {
      if (primary.id === secondary.id) continue;
      if (!canLayerTops(primary, secondary)) continue;
      combos.push([primary, secondary]);
    }
  }

  return combos;
}

function getPrimaryStyle(outfit: { items: OutfitItem[] }) {
  const counts = new Map<string, number>();

  for (const item of outfit.items) {
    for (const style of item.styles ?? []) {
      counts.set(style, (counts.get(style) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function getTopSignature(outfit: { items: OutfitItem[] }) {
  const topIds = outfit.items
    .filter((item) => item.category === "tops")
    .map((item) => item.id)
    .sort();

  return topIds.join("|");
}

function getPrimaryTopId(outfit: { items: OutfitItem[] }) {
  return outfit.items.find((item) => item.category === "tops")?.id ?? null;
}

function isTooSimilarOutfit(
  a: { items: OutfitItem[] },
  b: { items: OutfitItem[] }
) {
  const aIds = new Set(a.items.map((item) => item.id));
  const bIds = new Set(b.items.map((item) => item.id));

  let sameCount = 0;
  for (const id of aIds) {
    if (bIds.has(id)) sameCount++;
  }

  const aPrimaryStyle = getPrimaryStyle(a);
  const bPrimaryStyle = getPrimaryStyle(b);

  const aOuter = a.items.find((item) => item.category === "outer")?.id ?? null;
  const bOuter = b.items.find((item) => item.category === "outer")?.id ?? null;

  const aBottom = a.items.find((item) => item.category === "bottoms")?.id ?? null;
  const bBottom = b.items.find((item) => item.category === "bottoms")?.id ?? null;

  const aShoes = a.items.find((item) => item.category === "shoes")?.id ?? null;
  const bShoes = b.items.find((item) => item.category === "shoes")?.id ?? null;

  const aTopIds = a.items
    .filter((item) => item.category === "tops")
    .map((item) => item.id)
    .sort()
    .join("|");

  const bTopIds = b.items
    .filter((item) => item.category === "tops")
    .map((item) => item.id)
    .sort()
    .join("|");

  const sameOuter = Boolean(aOuter && bOuter && aOuter === bOuter);
  const sameBottom = Boolean(aBottom && bBottom && aBottom === bBottom);
  const sameShoes = Boolean(aShoes && bShoes && aShoes === bShoes);
  const sameTops = aTopIds !== "" && aTopIds === bTopIds;

  if (sameCount >= 4) return true;
  if (sameOuter && sameBottom) return true;
  if (sameTops && sameBottom) return true;
  if (sameTops && sameBottom && sameShoes) return true;

  if (sameCount >= 3 && aPrimaryStyle && aPrimaryStyle === bPrimaryStyle) {
    return true;
  }

  if (sameCount >= 2 && sameTops && sameBottom) {
    return true;
  }

  return false;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const style = body.style ?? null;
    const minTemp = Number(body.minTemp ?? 15);
    const maxTemp = Number(body.maxTemp ?? 22);
    const limit = Number(body.limit ?? 3);
    const fixedItemId = body.fixedItemId ?? null;
    const occasion = body.occasion ?? null;
    const prioritizeVersatility = Boolean(body.prioritizeVersatility ?? false);

    const items = await prisma.item.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!items.length) {
      return NextResponse.json(
        { error: "アイテムが登録されていません" },
        { status: 400 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
    });

    const activeStyleGoal = await prisma.styleGoal.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const styleContext: UserStyleContext = {
      requestedStyle: style ?? null,
      favoriteStyle: profile?.favoriteStyle ?? null,
      targetStyle: activeStyleGoal?.targetStyle ?? null,
    };

    const normalizedItems = items.map(normalizeItem);
    const candidateItems = filterItemsByOccasion(normalizedItems, occasion);

    const tops = candidateItems.filter((item) => item.category === "tops");
    const bottoms = candidateItems.filter((item) => item.category === "bottoms");
    const onepieces = candidateItems.filter((item) => item.category === "onepiece");
    const outers = candidateItems.filter((item) => item.category === "outer");
    const shoes = candidateItems.filter((item) => item.category === "shoes");
    const bags = candidateItems.filter(
      (item) => item.category === "bag" || item.category === "bags"
    );

    const topCombos = buildTopCombos(tops);

    const fixedItem = fixedItemId
      ? candidateItems.find((item) => item.id === fixedItemId) ?? null
      : null;

    let rawOutfits: OutfitResult[] = [];

    if (fixedItem) {
      if (fixedItem.category === "tops") {
        for (const bottom of bottoms) {
          for (const shoe of shoes) {
            if (needsOuterByTemperature(minTemp, maxTemp)) {
              for (const outer of outers) {
                rawOutfits.push(buildOutfit([fixedItem, bottom, outer, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
                for (const bag of bags) {
                  rawOutfits.push(buildOutfit([fixedItem, bottom, outer, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
                }
              }
            } else {
              rawOutfits.push(buildOutfit([fixedItem, bottom, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
              for (const bag of bags) {
                rawOutfits.push(buildOutfit([fixedItem, bottom, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
              }
              for (const outer of outers) {
                rawOutfits.push(buildOutfit([fixedItem, bottom, outer, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
                for (const bag of bags) {
                  rawOutfits.push(buildOutfit([fixedItem, bottom, outer, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
                }
              }
            }
          }
        }
      }

      if (fixedItem.category === "bottoms") {
        for (const topCombo of topCombos) {
          for (const shoe of shoes) {
            if (needsOuterByTemperature(minTemp, maxTemp)) {
              for (const outer of outers) {
                rawOutfits.push(buildOutfit([...topCombo, fixedItem, outer, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name ?? undefined));
                for (const bag of bags) {
                  rawOutfits.push(buildOutfit([...topCombo, fixedItem, outer, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name ?? undefined));
                }
              }
            } else {
              rawOutfits.push(buildOutfit([...topCombo, fixedItem, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name ?? undefined));
              for (const bag of bags) {
                rawOutfits.push(buildOutfit([...topCombo, fixedItem, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name ?? undefined));
              }
              for (const outer of outers) {
                rawOutfits.push(buildOutfit([...topCombo, fixedItem, outer, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name ?? undefined));
                for (const bag of bags) {
                  rawOutfits.push(buildOutfit([...topCombo, fixedItem, outer, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name ?? undefined));
                }
              }
            }
          }
        }
      }

      if (fixedItem.category === "onepiece") {
        for (const shoe of shoes) {
          if (needsOuterByTemperature(minTemp, maxTemp)) {
            for (const outer of outers) {
              rawOutfits.push(buildOutfit([fixedItem, outer, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
              for (const bag of bags) {
                rawOutfits.push(buildOutfit([fixedItem, outer, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
              }
            }
          } else {
            rawOutfits.push(buildOutfit([fixedItem, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
            for (const bag of bags) {
              rawOutfits.push(buildOutfit([fixedItem, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
            }
            for (const outer of outers) {
              rawOutfits.push(buildOutfit([fixedItem, outer, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
              for (const bag of bags) {
                rawOutfits.push(buildOutfit([fixedItem, outer, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
              }
            }
          }
        }
      }

      if (fixedItem.category === "shoes") {
        for (const topCombo of topCombos) {
          for (const bottom of bottoms) {
            rawOutfits.push(buildOutfit([...topCombo, bottom, fixedItem], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
            for (const bag of bags) {
              rawOutfits.push(buildOutfit([...topCombo, bottom, fixedItem, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
            }
          }
        }
        for (const onepiece of onepieces) {
          rawOutfits.push(buildOutfit([onepiece, fixedItem], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
          for (const bag of bags) {
            rawOutfits.push(buildOutfit([onepiece, fixedItem, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
          }
        }
      }

      if (fixedItem.category === "bag") {
        for (const topCombo of topCombos) {
          for (const bottom of bottoms) {
            for (const shoe of shoes) {
              rawOutfits.push(buildOutfit([...topCombo, bottom, shoe, fixedItem], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
            }
          }
        }
        for (const onepiece of onepieces) {
          for (const shoe of shoes) {
            rawOutfits.push(buildOutfit([onepiece, shoe, fixedItem], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
          }
        }
      }

      if (fixedItem.category === "outer") {
        for (const topCombo of topCombos) {
          for (const bottom of bottoms) {
            for (const shoe of shoes) {
              rawOutfits.push(buildOutfit([...topCombo, bottom, fixedItem, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
            }
          }
        }
        for (const onepiece of onepieces) {
          for (const shoe of shoes) {
            rawOutfits.push(buildOutfit([onepiece, fixedItem, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp, fixedItem.name));
          }
        }
      }
    } else {
      for (const topCombo of topCombos) {
        for (const bottom of bottoms) {
          for (const shoe of shoes) {
            if (needsOuterByTemperature(minTemp, maxTemp)) {
              for (const outer of outers) {
                rawOutfits.push(buildOutfit([...topCombo, bottom, outer, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
                for (const bag of bags) {
                  rawOutfits.push(buildOutfit([...topCombo, bottom, outer, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
                }
              }
            } else {
              rawOutfits.push(buildOutfit([...topCombo, bottom, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
              for (const bag of bags) {
                rawOutfits.push(buildOutfit([...topCombo, bottom, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
              }
              for (const outer of outers) {
                rawOutfits.push(buildOutfit([...topCombo, bottom, outer, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
                for (const bag of bags) {
                  rawOutfits.push(buildOutfit([...topCombo, bottom, outer, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
                }
              }
            }
          }
        }
      }

      for (const onepiece of onepieces) {
        for (const shoe of shoes) {
          if (needsOuterByTemperature(minTemp, maxTemp)) {
            for (const outer of outers) {
              rawOutfits.push(buildOutfit([onepiece, outer, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
              for (const bag of bags) {
                rawOutfits.push(buildOutfit([onepiece, outer, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
              }
            }
          } else {
            rawOutfits.push(buildOutfit([onepiece, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
            for (const bag of bags) {
              rawOutfits.push(buildOutfit([onepiece, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
            }
            for (const outer of outers) {
              rawOutfits.push(buildOutfit([onepiece, outer, shoe], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
              for (const bag of bags) {
                rawOutfits.push(buildOutfit([onepiece, outer, shoe, bag], styleContext, occasion, prioritizeVersatility, minTemp, maxTemp));
              }
            }
          }
        }
      }
    }

    rawOutfits = rawOutfits.filter((outfit) =>
      passesHardRules(outfit.items, minTemp, maxTemp, occasion)
    );

    const uniqueOutfits = uniqueByKey(
      rawOutfits,
      (outfit) => outfit.items.map((item) => item.id).sort().join("-")
    );

    const scoredOutfits = [...uniqueOutfits].sort((a, b) => b.score - a.score);

    const selected: typeof scoredOutfits = [];

    for (const outfit of scoredOutfits) {
      if (selected.length === 0) {
        selected.push(outfit);
        continue;
      }

      const tooSimilar = selected.some((picked) => isTooSimilarOutfit(picked, outfit));
      const candidatePrimaryTopId = getPrimaryTopId(outfit);
      const samePrimaryTopCount = selected.filter(
        (picked) => getPrimaryTopId(picked) === candidatePrimaryTopId
      ).length;
      const shouldBlockByTopVariety = candidatePrimaryTopId !== null && samePrimaryTopCount >= 1;

      if (!tooSimilar && !shouldBlockByTopVariety) {
        selected.push(outfit);
      }

      if (selected.length >= limit) break;
    }

    if (selected.length < limit) {
      for (const outfit of scoredOutfits) {
        const alreadyIncluded = selected.some((picked) =>
          picked.items.map((item) => item.id).sort().join("-") ===
          outfit.items.map((item) => item.id).sort().join("-")
        );

        const tooSimilar = selected.some((picked) => isTooSimilarOutfit(picked, outfit));
        const candidatePrimaryTopId = getPrimaryTopId(outfit);
        const samePrimaryTopCount = selected.filter(
          (picked) => getPrimaryTopId(picked) === candidatePrimaryTopId
        ).length;
        const shouldBlockByTopVariety = candidatePrimaryTopId !== null && samePrimaryTopCount >= 2;

        if (!alreadyIncluded && !tooSimilar && !shouldBlockByTopVariety) {
          selected.push(outfit);
        }

        if (selected.length >= limit) break;
      }
    }

    const sorted = selected.map((outfit, index) => ({
      ...outfit,
      rank: index + 1,
    }));

    const enriched = await enrichOutfitsWithLlmComments(sorted, {
      occasion,
      style: styleContext.requestedStyle,
      favoriteStyle: styleContext.favoriteStyle,
      targetStyle: styleContext.targetStyle,
      minTemp,
      maxTemp,
    });

    return NextResponse.json({
      success: true,
      count: enriched.length,
      outfits: enriched,
    });
  } catch (error) {
    console.error("POST /api/outfit error:", error);
    return NextResponse.json(
      { error: "コーデ生成に失敗しました" },
      { status: 500 }
    );
  }
}