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
    layeringBonus: number;
  };
  items: OutfitItem[];
  slotMap: OutfitSlotMap;
};

type UserStyleContext = {
  requestedStyle: string | null;
  favoriteStyle: string | null;
  targetStyle: string | null;
};

type CandidatePools = {
  tops: OutfitItem[];
  bottoms: OutfitItem[];
  onepieces: OutfitItem[];
  outers: OutfitItem[];
  shoes: OutfitItem[];
  bags: OutfitItem[];
};

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function nameIncludes(item: OutfitItem | undefined, keyword: string) {
  if (!item) return false;
  return normalizeText(item.name).includes(normalizeText(keyword));
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
  if (item.category === "bag" || item.category === "bags" || item.category === "shoes") {
    return true;
  }

  const avgTemp = (minTemp + maxTemp) / 2;
  const seasons = item.seasons ?? [];

  if (!seasons.length) return true;

  const hasSpring = seasons.includes("spring");
  const hasSummer = seasons.includes("summer");
  const hasAutumn = seasons.includes("autumn");
  const hasWinter = seasons.includes("winter");

  const isSpringSummerOnly = (hasSpring || hasSummer) && !hasAutumn && !hasWinter;
  if (isSpringSummerOnly && avgTemp <= 15) return false;

  if (avgTemp <= 10) return hasWinter;
  if (avgTemp <= 18) return hasAutumn || hasSpring;
  if (avgTemp <= 25) return hasSpring || hasSummer;
  return hasSummer;
}

function hasOuter(items: OutfitItem[]) {
  return items.some((item) => item.category === "outer");
}

function needsOuterByTemperature(minTemp: number, maxTemp: number) {
  const avgTemp = (minTemp + maxTemp) / 2;
  return avgTemp <= 15;
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
    ["jacket", "tailored_jacket", "office_jacket"].includes(outerSub) &&
    ["slacks", "office_pants"].includes(bottomSub);

  return suitShape && sameColor && outerOffice && bottomOffice;
}

function isOfficeSuitLike(items: OutfitItem[]) {
  return isSuitLike(items);
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
        (hasSubValue(top, "shirt", "blouse", "office_shirt") ||
          hasStyleValue(top, "office") ||
          top.formality >= 4)) ||
      (onepiece &&
        (hasStyleValue(onepiece, "office") || onepiece.formality >= 4));

    const isFormalBottom =
      bottom &&
      (hasSubValue(bottom, "slacks", "office_pants", "office_skirt") ||
        hasStyleValue(bottom, "office") ||
        bottom.formality >= 4);

    const isFormalOuter =
      outer &&
      (hasSubValue(outer, "jacket", "tailored_jacket", "coat", "office_jacket") ||
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
      (hasSubValue(bag, "shoulder_bag", "tote_bag", "mini_bag", "backpack") ||
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
      ["jacket", "tailored_jacket", "coat", "office_jacket"].includes(
        normalizeText(outer.subcategory)
      ) ||
      outer.formality >= 4
    );

  const bottomIsSweatLike =
    bottom &&
    (
      ["sweat", "sweatpants", "jogger", "jogger_pants"].includes(
        normalizeText(bottom.subcategory)
      ) ||
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
      ["slacks", "office_pants", "office_skirt"].includes(normalizeText(bottom.subcategory)) ||
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

function isExposureTop(item: OutfitItem) {
  const name = normalizeText(item.name);
  const sub = normalizeText(item.subcategory);

  return (
    name.includes("オフショル") ||
    name.includes("肩空き") ||
    name.includes("ノースリーブ") ||
    name.includes("キャミ") ||
    name.includes("ベア") ||
    sub === "camisole"
  );
}

function isBaseLayerTop(item: OutfitItem) {
  const sub = normalizeText(item.subcategory);
  const name = normalizeText(item.name);

  if (isExposureTop(item)) return false;
  if (["knit", "cardigan", "vest"].includes(sub)) return false;
  if (name.includes("ニット") || name.includes("カーデ") || name.includes("ベスト")) {
    return false;
  }

  return ["shirt", "blouse", "tshirt", "office_shirt"].includes(sub);
}

function isOuterLayerTop(item: OutfitItem) {
  const sub = normalizeText(item.subcategory);
  const name = normalizeText(item.name);

  return (
    ["knit", "cardigan", "hoodie", "sweat", "vest"].includes(sub) ||
    name.includes("ニット") ||
    name.includes("カーデ") ||
    name.includes("ベスト") ||
    name.includes("パーカー") ||
    name.includes("スウェット")
  );
}

function canLayerTops(primary: OutfitItem, secondary: OutfitItem) {
  if (primary.id === secondary.id) return false;
  if (isExposureTop(primary) || isExposureTop(secondary)) return false;

  const primaryIsBase = isBaseLayerTop(primary);
  const secondaryIsOuter = isOuterLayerTop(secondary);

  if (primaryIsBase && secondaryIsOuter) return true;

  const primarySub = normalizeText(primary.subcategory);
  const secondarySub = normalizeText(secondary.subcategory);

  if (
    ["shirt", "blouse", "office_shirt", "tshirt"].includes(primarySub) &&
    ["knit", "cardigan", "vest", "hoodie", "sweat"].includes(secondarySub)
  ) {
    return true;
  }

  return false;
}

function scoreLayeringBonus(items: OutfitItem[], minTemp: number, maxTemp: number) {
  const avgTemp = (minTemp + maxTemp) / 2;
  const tops = items.filter((item) => item.category === "tops");

  if (avgTemp > 18) return 0;
  if (tops.length < 2) return 0;

  const hasBaseLayer = tops.some((item) => isBaseLayerTop(item));
  const hasOuterLayer = tops.some((item) => isOuterLayerTop(item));

  if (hasBaseLayer && hasOuterLayer) return 2;
  return 0;
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
              content: "あなたは日本語のAIスタイリストです。必ずJSONのみ返してください。",
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

function passesTemperatureRule(items: OutfitItem[], minTemp: number, maxTemp: number) {
  if (needsOuterByTemperature(minTemp, maxTemp) && !hasOuter(items)) {
    return false;
  }

  const coreItems = items.filter(
    (item) => item.category !== "bag" && item.category !== "bags"
  );

  return coreItems.every((item) => hasSeasonMatch(item, minTemp, maxTemp));
}

function passesOccasionRule(items: OutfitItem[], occasion: string | null) {
  if (!occasion) return true;

  const top = items.find((item) => item.category === "tops");
  const bottom = items.find((item) => item.category === "bottoms");
  const outer = items.find((item) => item.category === "outer");
  const shoes = items.find((item) => item.category === "shoes");
  const bag = items.find((item) => item.category === "bag" || item.category === "bags");

  const topOffice = top && hasStyleValue(top, "office");
  const topCasual = top && hasStyleValue(top, "casual");
  const topFeminine = top && hasStyleValue(top, "feminine", "girly");

  const bottomOffice =
    bottom &&
    (hasStyleValue(bottom, "office") ||
      hasSubValue(bottom, "slacks", "office_pants", "office_skirt") ||
      bottom.formality >= 4);

  const bottomStreet = bottom && hasStyleValue(bottom, "street");
  const bottomCasual = bottom && hasStyleValue(bottom, "casual");
  const bottomIsSweatLike =
    bottom &&
    (hasSubValue(bottom, "sweatpants") || nameIncludes(bottom, "スウェット"));

  const outerOffice =
    outer &&
    (hasStyleValue(outer, "office") ||
      hasSubValue(outer, "jacket", "tailored_jacket", "office_jacket") ||
      outer.formality >= 4);

  const outerStreet = outer && hasStyleValue(outer, "street");
  const outerCasual = outer && hasStyleValue(outer, "casual");

  const shoesOffice =
    shoes &&
    (hasStyleValue(shoes, "office") ||
      hasSubValue(shoes, "pumps", "loafers", "heels") ||
      shoes.formality >= 4);

  const shoesStreet = shoes && hasStyleValue(shoes, "street");
  const shoesCasual =
    shoes &&
    (hasStyleValue(shoes, "casual") ||
      hasSubValue(shoes, "sneakers", "sandals"));

  const bagOffice = bag && hasStyleValue(bag, "office");
  const bagStreet = bag && hasStyleValue(bag, "street");
  const bagCasual = bag && hasStyleValue(bag, "casual");

  const outerIsFormal =
    outer &&
    (
      hasStyleValue(outer, "office") ||
      hasSubValue(outer, "jacket", "tailored_jacket", "coat", "office_jacket") ||
      outer.formality >= 4
    );

  const bottomIsFormal =
    bottom &&
    (
      hasStyleValue(bottom, "office") ||
      hasSubValue(bottom, "slacks", "office_pants", "office_skirt") ||
      bottom.formality >= 4
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

function passesStyleConsistencyRule(items: OutfitItem[], occasion: string | null) {
  const penalty = scoreStyleHarmonyPenalty(items);
  if (penalty >= 10) return false;

  if (occasion === "formal" || occasion === "office") {
    const hasStreet = items.some((item) => hasStyleValue(item, "street"));
    if (hasStreet) return false;
  }

  return true;
}

function passesHardRules(
  items: OutfitItem[],
  minTemp: number,
  maxTemp: number,
  occasion: string | null
) {
  if (
    (occasion === "casual" || occasion === "date" || occasion === "travel") &&
    isOfficeSuitLike(items)
  ) {
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

function getPrimaryTopId(outfit: { items: OutfitItem[] }) {
  return outfit.items.find((item) => item.category === "tops")?.id ?? null;
}

function isTooSimilarOutfit(
  a: { items: OutfitItem[] },
  b: { items: OutfitItem[] }
) {
  const aTopIds = a.items
    .filter((item) => item.category === "tops")
    .map((item) => item.id)
    .sort();

  const bTopIds = b.items
    .filter((item) => item.category === "tops")
    .map((item) => item.id)
    .sort();

  const aBottomId = a.items.find((item) => item.category === "bottoms")?.id ?? null;
  const bBottomId = b.items.find((item) => item.category === "bottoms")?.id ?? null;

  const aOnepieceId = a.items.find((item) => item.category === "onepiece")?.id ?? null;
  const bOnepieceId = b.items.find((item) => item.category === "onepiece")?.id ?? null;

  const aShoesId = a.items.find((item) => item.category === "shoes")?.id ?? null;
  const bShoesId = b.items.find((item) => item.category === "shoes")?.id ?? null;

  const aOuterId = a.items.find((item) => item.category === "outer")?.id ?? null;
  const bOuterId = b.items.find((item) => item.category === "outer")?.id ?? null;

  const sameTopSet =
    aTopIds.length === bTopIds.length &&
    aTopIds.every((id, idx) => id === bTopIds[idx]);

  const sameBottom = aBottomId !== null && aBottomId === bBottomId;
  const sameOnepiece = aOnepieceId !== null && aOnepieceId === bOnepieceId;
  const sameShoes = aShoesId !== null && aShoesId === bShoesId;
  const sameOuter = aOuterId !== null && aOuterId === bOuterId;

  if (sameOnepiece) return true;
  if (sameTopSet && sameBottom) return true;
  if (sameTopSet && sameBottom && sameShoes) return true;
  if (sameTopSet && sameBottom && sameOuter) return true;

  return false;
}

function uniqueByKey<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T>();

  for (const item of items) {
    const key = getKey(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

function buildOutfit(
  items: OutfitItem[],
  styleContext: UserStyleContext,
  occasion: string | null,
  prioritizeVersatility: boolean,
  minTemp: number,
  maxTemp: number,
  fixedItemName?: string | null
): OutfitResult {
  const style = scoreStyleMatch(items, styleContext.requestedStyle);
  const color = scoreColorBalance(items);
  const preference = scorePreference(items, styleContext.requestedStyle);
  const rewear = scoreRewear(items);
  const setupBonus = scoreSetupBonus(items);
  const suitBonus = scoreSuitBonus(items, occasion);
  const moodCohesionBonus = scoreMoodCohesionBonus(items);
  const versatilityBonus = prioritizeVersatility ? scoreVersatility(items) : 0;
  const favoriteStyleBonus = scoreFavoriteStyleBonus(items, styleContext.favoriteStyle);
  const targetStyleBonus = scoreTargetStyleBonus(items, styleContext.targetStyle);
  const inspirationBonus = scoreInspirationBonus(items, styleContext.targetStyle);
  const harmonyPenalty = scoreHarmonyPenalty(items);
  const styleHarmonyPenalty = scoreStyleHarmonyPenalty(items);
  const layeringBonus = scoreLayeringBonus(items, minTemp, maxTemp);
  const occasionScore = scoreOccasion(items, occasion);

  const score =
    occasionScore +
    style +
    color +
    preference +
    rewear +
    setupBonus +
    suitBonus +
    moodCohesionBonus +
    versatilityBonus +
    favoriteStyleBonus +
    targetStyleBonus +
    inspirationBonus +
    layeringBonus -
    harmonyPenalty -
    styleHarmonyPenalty;

  const breakdown: OutfitResult["breakdown"] = {
    occasion: occasionScore,
    style,
    color,
    preference,
    rewear,
    setupBonus,
    suitBonus,
    moodCohesionBonus,
    versatilityBonus,
    favoriteStyleBonus,
    targetStyleBonus,
    inspirationBonus,
    harmonyPenalty,
    styleHarmonyPenalty,
    layeringBonus,
  };

  return {
    rank: 0,
    score,
    reasons: buildReasons(score, breakdown, fixedItemName, items),
    items,
    slotMap: buildSlotMap(items),
    breakdown,
  };
}

function parseExcludedOutfitKeys(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is unknown[] => Array.isArray(entry))
    .map((entry) => entry.filter((id): id is string => typeof id === "string").sort())
    .filter((entry) => entry.length > 0);
}

function getOutfitKey(items: OutfitItem[]) {
  return items.map((item) => item.id).sort().join("-");
}

async function getUserStyleContext(userId: string, requestedStyle: string | null) {
  let profile: { favoriteStyle: string | null; targetStyle: string | null } | null = null;

  try {
    const prismaAny = prisma as any;

    if (prismaAny.userProfile?.findUnique) {
      profile = await prismaAny.userProfile.findUnique({
        where: { userId },
        select: {
          favoriteStyle: true,
          targetStyle: true,
        },
      });
    } else if (prismaAny.profile?.findUnique) {
      profile = await prismaAny.profile.findUnique({
        where: { userId },
        select: {
          favoriteStyle: true,
          targetStyle: true,
        },
      });
    }
  } catch (error) {
    console.error("getUserStyleContext fallback:", error);
  }

  return {
    requestedStyle,
    favoriteStyle: profile?.favoriteStyle ?? null,
    targetStyle: profile?.targetStyle ?? null,
  } satisfies UserStyleContext;
}

function shouldBlockByExcludedBase(
  items: OutfitItem[],
  excludedOutfitKeys: string[][]
) {
  if (excludedOutfitKeys.length === 0) return false;

  const usedIds = new Set(excludedOutfitKeys.flat());

  const tops = items.filter((item) => item.category === "tops");
  const bottom = items.find((item) => item.category === "bottoms");
  const onepiece = items.find((item) => item.category === "onepiece");

  if (onepiece && usedIds.has(onepiece.id)) {
    return true;
  }

  if (tops.length > 0 && bottom) {
    const sameTopUsed = tops.every((item) => usedIds.has(item.id));
    const sameBottomUsed = usedIds.has(bottom.id);
    if (sameTopUsed && sameBottomUsed) {
      return true;
    }
  }

  return false;
}

function hasDuplicateItems(items: OutfitItem[]) {
  const ids = items.map((item) => item.id);
  return new Set(ids).size !== ids.length;
}

function pushCandidateOutfit(
  target: OutfitResult[],
  items: OutfitItem[],
  styleContext: UserStyleContext,
  occasion: string | null,
  prioritizeVersatility: boolean,
  minTemp: number,
  maxTemp: number,
  excludedOutfitKeys: string[][],
  fixedItemName?: string | null
) {
  // 🚨 同一アイテムが複数スロットに入るのを防ぐ
  if (hasDuplicateItems(items)) {
    return;
  }

  if (shouldBlockByExcludedBase(items, excludedOutfitKeys)) {
    return;
  }

  // 🚨 スロット構造チェック
const hasTop = items.some((i) => i.category === "tops");
const hasBottom = items.some((i) => i.category === "bottoms");
const hasOnepiece = items.some((i) => i.category === "onepiece");

if (!( (hasTop && hasBottom) || hasOnepiece )) {
  return;
}

  target.push(
    buildOutfit(
      items,
      styleContext,
      occasion,
      prioritizeVersatility,
      minTemp,
      maxTemp,
      fixedItemName
    )
  );
}

function generateTwoPieceCandidates(
  rawOutfitsBase: OutfitResult[],
  pools: CandidatePools,
  options: {
    fixedItem?: OutfitItem | null;
    styleContext: UserStyleContext;
    occasion: string | null;
    prioritizeVersatility: boolean;
    minTemp: number;
    maxTemp: number;
    excludedOutfitKeys: string[][];
  }
) {
  const { tops, bottoms, outers, shoes, bags } = pools;
  const {
    fixedItem,
    styleContext,
    occasion,
    prioritizeVersatility,
    minTemp,
    maxTemp,
    excludedOutfitKeys,
  } = options;

  const topCombos = buildTopCombos(tops);
  const needOuter = needsOuterByTemperature(minTemp, maxTemp);

  for (const topCombo of topCombos) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        const baseItems = [...topCombo, bottom];

        if (needOuter) {
          for (const outer of outers) {
            const withOuter = [...baseItems, outer, shoe];
            pushCandidateOutfit(
              rawOutfitsBase,
              withOuter,
              styleContext,
              occasion,
              prioritizeVersatility,
              minTemp,
              maxTemp,
              excludedOutfitKeys,
              fixedItem?.name ?? null
            );

            for (const bag of bags) {
              pushCandidateOutfit(
                rawOutfitsBase,
                [...withOuter, bag],
                styleContext,
                occasion,
                prioritizeVersatility,
                minTemp,
                maxTemp,
                excludedOutfitKeys,
                fixedItem?.name ?? null
              );
            }
          }
        } else {
          const noOuter = [...baseItems, shoe];
          pushCandidateOutfit(
            rawOutfitsBase,
            noOuter,
            styleContext,
            occasion,
            prioritizeVersatility,
            minTemp,
            maxTemp,
            excludedOutfitKeys,
            fixedItem?.name ?? null
          );

          for (const bag of bags) {
            pushCandidateOutfit(
              rawOutfitsBase,
              [...noOuter, bag],
              styleContext,
              occasion,
              prioritizeVersatility,
              minTemp,
              maxTemp,
              excludedOutfitKeys,
              fixedItem?.name ?? null
            );
          }

          for (const outer of outers) {
            const withOuter = [...baseItems, outer, shoe];
            pushCandidateOutfit(
              rawOutfitsBase,
              withOuter,
              styleContext,
              occasion,
              prioritizeVersatility,
              minTemp,
              maxTemp,
              excludedOutfitKeys,
              fixedItem?.name ?? null
            );

            for (const bag of bags) {
              pushCandidateOutfit(
                rawOutfitsBase,
                [...withOuter, bag],
                styleContext,
                occasion,
                prioritizeVersatility,
                minTemp,
                maxTemp,
                excludedOutfitKeys,
                fixedItem?.name ?? null
              );
            }
          }
        }
      }
    }
  }
}

function generateOnepieceCandidates(
  rawOutfitsBase: OutfitResult[],
  pools: CandidatePools,
  options: {
    fixedItem?: OutfitItem | null;
    styleContext: UserStyleContext;
    occasion: string | null;
    prioritizeVersatility: boolean;
    minTemp: number;
    maxTemp: number;
    excludedOutfitKeys: string[][];
  }
) {
  const { onepieces, outers, shoes, bags } = pools;
  const {
    fixedItem,
    styleContext,
    occasion,
    prioritizeVersatility,
    minTemp,
    maxTemp,
    excludedOutfitKeys,
  } = options;

  const needOuter = needsOuterByTemperature(minTemp, maxTemp);

  for (const onepiece of onepieces) {
    for (const shoe of shoes) {
      if (needOuter) {
        for (const outer of outers) {
          const withOuter = [onepiece, outer, shoe];
          pushCandidateOutfit(
            rawOutfitsBase,
            withOuter,
            styleContext,
            occasion,
            prioritizeVersatility,
            minTemp,
            maxTemp,
            excludedOutfitKeys,
            fixedItem?.name ?? null
          );

          for (const bag of bags) {
            pushCandidateOutfit(
              rawOutfitsBase,
              [...withOuter, bag],
              styleContext,
              occasion,
              prioritizeVersatility,
              minTemp,
              maxTemp,
              excludedOutfitKeys,
              fixedItem?.name ?? null
            );
          }
        }
      } else {
        const noOuter = [onepiece, shoe];
        pushCandidateOutfit(
          rawOutfitsBase,
          noOuter,
          styleContext,
          occasion,
          prioritizeVersatility,
          minTemp,
          maxTemp,
          excludedOutfitKeys,
          fixedItem?.name ?? null
        );

        for (const bag of bags) {
          pushCandidateOutfit(
            rawOutfitsBase,
            [...noOuter, bag],
            styleContext,
            occasion,
            prioritizeVersatility,
            minTemp,
            maxTemp,
            excludedOutfitKeys,
            fixedItem?.name ?? null
          );
        }

        for (const outer of outers) {
          const withOuter = [onepiece, outer, shoe];
          pushCandidateOutfit(
            rawOutfitsBase,
            withOuter,
            styleContext,
            occasion,
            prioritizeVersatility,
            minTemp,
            maxTemp,
            excludedOutfitKeys,
            fixedItem?.name ?? null
          );

          for (const bag of bags) {
            pushCandidateOutfit(
              rawOutfitsBase,
              [...withOuter, bag],
              styleContext,
              occasion,
              prioritizeVersatility,
              minTemp,
              maxTemp,
              excludedOutfitKeys,
              fixedItem?.name ?? null
            );
          }
        }
      }
    }
  }
}

function buildPoolsForFixedItem(
  candidateItems: OutfitItem[],
  fixedItem: OutfitItem | null
): CandidatePools {
  const allTops = candidateItems.filter((item) => item.category === "tops");
  const allBottoms = candidateItems.filter((item) => item.category === "bottoms");
  const allOnepieces = candidateItems.filter((item) => item.category === "onepiece");
  const allOuters = candidateItems.filter((item) => item.category === "outer");
  const allShoes = candidateItems.filter((item) => item.category === "shoes");
  const allBags = candidateItems.filter(
    (item) => item.category === "bag" || item.category === "bags"
  );

  if (!fixedItem) {
    return {
      tops: allTops,
      bottoms: allBottoms,
      onepieces: allOnepieces,
      outers: allOuters,
      shoes: allShoes,
      bags: allBags,
    };
  }

  switch (fixedItem.category) {
    case "tops":
      return {
        tops: [fixedItem],
        bottoms: allBottoms,
        onepieces: [],
        outers: allOuters,
        shoes: allShoes,
        bags: allBags,
      };
    case "bottoms":
      return {
        tops: allTops,
        bottoms: [fixedItem],
        onepieces: [],
        outers: allOuters,
        shoes: allShoes,
        bags: allBags,
      };
    case "onepiece":
      return {
        tops: [],
        bottoms: [],
        onepieces: [fixedItem],
        outers: allOuters,
        shoes: allShoes,
        bags: allBags,
      };
    case "outer":
      return {
        tops: allTops,
        bottoms: allBottoms,
        onepieces: allOnepieces,
        outers: [fixedItem],
        shoes: allShoes,
        bags: allBags,
      };
    case "shoes":
      return {
        tops: allTops,
        bottoms: allBottoms,
        onepieces: allOnepieces,
        outers: allOuters,
        shoes: [fixedItem],
        bags: allBags,
      };
    case "bag":
    case "bags":
      return {
        tops: allTops,
        bottoms: allBottoms,
        onepieces: allOnepieces,
        outers: allOuters,
        shoes: allShoes,
        bags: [fixedItem],
      };
    default:
      return {
        tops: allTops,
        bottoms: allBottoms,
        onepieces: allOnepieces,
        outers: allOuters,
        shoes: allShoes,
        bags: allBags,
      };
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const style = typeof body.style === "string" ? body.style : null;
    const minTemp = Number(body.minTemp ?? 15);
    const maxTemp = Number(body.maxTemp ?? 22);
    const limit = Math.max(1, Math.min(6, Number(body.limit ?? 3)));
    const fixedItemId = typeof body.fixedItemId === "string" ? body.fixedItemId : null;
    const occasion = typeof body.occasion === "string" ? body.occasion : null;
    const prioritizeVersatility = Boolean(body.prioritizeVersatility ?? false);
    const excludedOutfitKeys = parseExcludedOutfitKeys(body.excludedOutfitKeys);

    const dbItems = await prisma.item.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    const normalizedItems = dbItems.map(normalizeItem);

    if (normalizedItems.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        outfits: [],
      });
    }

    const fixedItem = fixedItemId
      ? normalizedItems.find((item) => item.id === fixedItemId) ?? null
      : null;

    const styleContext = await getUserStyleContext(session.user.id, style);

    const candidateItems =
      fixedItem != null
        ? normalizedItems.filter(
            (item) =>
              item.id === fixedItem.id ||
              item.category !== fixedItem.category ||
              item.category === "bag" ||
              item.category === "bags"
          )
        : normalizedItems;

    const pools = buildPoolsForFixedItem(candidateItems, fixedItem);
    const rawOutfitsBase: OutfitResult[] = [];

    generateTwoPieceCandidates(rawOutfitsBase, pools, {
      fixedItem,
      styleContext,
      occasion,
      prioritizeVersatility,
      minTemp,
      maxTemp,
      excludedOutfitKeys,
    });

    generateOnepieceCandidates(rawOutfitsBase, pools, {
      fixedItem,
      styleContext,
      occasion,
      prioritizeVersatility,
      minTemp,
      maxTemp,
      excludedOutfitKeys,
    });

    console.log("=== outfit debug start ===");
    console.log("body", {
      style,
      occasion,
      fixedItemId,
      minTemp,
      maxTemp,
      prioritizeVersatility,
      excludedOutfitKeysCount: excludedOutfitKeys.length,
    });

    console.log("candidate counts", {
      allItems: normalizedItems.length,
      candidateItems: candidateItems.length,
      tops: pools.tops.length,
      bottoms: pools.bottoms.length,
      onepieces: pools.onepieces.length,
      outers: pools.outers.length,
      shoes: pools.shoes.length,
      bags: pools.bags.length,
      rawOutfitsBeforeRules: rawOutfitsBase.length,
    });

    const rawOutfits = rawOutfitsBase.filter((outfit) =>
      passesHardRules(outfit.items, minTemp, maxTemp, occasion)
    );

    console.log("rawOutfits after hard rules", rawOutfits.length);

    const uniqueAll = uniqueByKey(rawOutfits, (outfit) => getOutfitKey(outfit.items));
    const scoredAll = [...uniqueAll].sort((a, b) => b.score - a.score);

    let scoredOutfits = scoredAll;

    if (excludedOutfitKeys.length > 0) {
      const recentExcluded = excludedOutfitKeys.slice(-limit);
      const filtered = scoredAll.filter((outfit) => {
        const key = outfit.items.map((item) => item.id).sort();
        return !recentExcluded.some(
          (excluded) =>
            excluded.length === key.length &&
            excluded.every((id, idx) => id === key[idx])
        );
      });

      console.log("after excluded filter", {
        before: scoredAll.length,
        after: filtered.length,
        recentExcludedCount: recentExcluded.length,
      });

      if (filtered.length > 0) {
        scoredOutfits = filtered;
      }
    }

    if (scoredOutfits.length === 0) {
      scoredOutfits = scoredAll;
    }

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

      const shouldBlockByTopVariety =
        candidatePrimaryTopId !== null && samePrimaryTopCount >= 1;

      if (!tooSimilar && !shouldBlockByTopVariety) {
        selected.push(outfit);
      }

      if (selected.length >= limit) break;
    }

    if (selected.length < limit) {
      for (const outfit of scoredOutfits) {
        const outfitKey = getOutfitKey(outfit.items);
        const alreadyIncluded = selected.some(
          (picked) => getOutfitKey(picked.items) === outfitKey
        );

        const tooSimilar = selected.some((picked) => isTooSimilarOutfit(picked, outfit));
        const candidatePrimaryTopId = getPrimaryTopId(outfit);
        const samePrimaryTopCount = selected.filter(
          (picked) => getPrimaryTopId(picked) === candidatePrimaryTopId
        ).length;

        const shouldBlockByTopVariety =
          candidatePrimaryTopId !== null && samePrimaryTopCount >= 2;

        if (!alreadyIncluded && !tooSimilar && !shouldBlockByTopVariety) {
          selected.push(outfit);
        }

        if (selected.length >= limit) break;
      }
    }

    if (selected.length < limit) {
      for (const outfit of scoredOutfits) {
        const outfitKey = getOutfitKey(outfit.items);
        const alreadyIncluded = selected.some(
          (picked) => getOutfitKey(picked.items) === outfitKey
        );

        if (!alreadyIncluded) {
          selected.push(outfit);
        }

        if (selected.length >= limit) break;
      }
    }

    console.log("selected outfits", selected.length);

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