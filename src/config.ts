/**
 * Configuration for Brand Wali Diwali Web App
 */
export const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyn5wpyv9skKNyk6RD1b1FteC3PN67DVHeO4ekvdu7V1uKSxHxYwpHoRR9h-H7lAUn_Kw/exec";

export const TOTAL_TEAMS = 8;

export interface CategoryPair {
  full: string;
  short: string;
}

export const CATEGORIES_CONFIG: CategoryPair[] = [
  {
    full: "Ethnic Jewellery and Styling Essentials",
    short: "Ethnic Jewellery",
  },
  {
    full: "Festive Beauty & Grooming",
    short: "Beauty & Grooming",
  },
  {
    full: "Diwali Gifts & Hampers",
    short: "Gifts & Hampers",
  },
  {
    full: "Festive Snacks & Beverages",
    short: "Snacks & Beverages",
  },
  {
    full: "Festive Sweets & Healthy Treats",
    short: "Sweets & Healthy Treats",
  },
  {
    full: "Home Décor & Festive Decorations",
    short: "Home Décor",
  },
  {
    full: "Ethnic Wear & Festive Fashion",
    short: "Festive Fashion",
  },
  {
    full: "Eco-Friendly Puja Essentials",
    short: "Eco-Friendly Puja",
  },
];

export const DEFAULT_CATEGORIES = CATEGORIES_CONFIG.map((c) => c.full);

export function normalizeCat(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function getShortName(name: string): string {
  if (!name) return "";
  const norm = normalizeCat(name);
  const found = CATEGORIES_CONFIG.find(
    (c) =>
      normalizeCat(c.full) === norm ||
      normalizeCat(c.short) === norm ||
      norm.includes(normalizeCat(c.short)) ||
      normalizeCat(c.full).includes(norm)
  );
  return found ? found.short : name;
}

export function getFullName(name: string): string {
  if (!name) return "";
  const norm = normalizeCat(name);
  const found = CATEGORIES_CONFIG.find(
    (c) =>
      normalizeCat(c.full) === norm ||
      normalizeCat(c.short) === norm ||
      norm.includes(normalizeCat(c.short)) ||
      normalizeCat(c.full).includes(norm)
  );
  return found ? found.full : name;
}

export function splitCategoryForWheel(cat: string): [string, string] {
  const short = getShortName(cat);
  if (short === "Beauty & Grooming") return ["Beauty &", "Grooming"];
  if (short === "Gifts & Hampers") return ["Gifts &", "Hampers"];
  if (short === "Snacks & Beverages") return ["Snacks &", "Beverages"];
  if (short === "Sweets & Healthy Treats") return ["Sweets &", "Healthy Treats"];
  if (short === "Eco-Friendly Puja") return ["Eco-Friendly", "Puja"];
  if (short === "Ethnic Jewellery") return ["Ethnic", "Jewellery"];
  if (short === "Home Décor") return ["Home", "Décor"];
  if (short === "Festive Fashion") return ["Festive", "Fashion"];

  const words = short.split(" ");
  if (words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }
  return [short, ""];
}

export const PALETTE = [
  "#03577B", // Teal
  "#E31E4B", // Crimson
  "#FF800A", // Orange
  "#720019", // Maroon
  "#FF4C43", // Coral
  "#FFF6CE", // Cream
  "#FFC21C", // Yellow
  "#03577B", // Teal
];

