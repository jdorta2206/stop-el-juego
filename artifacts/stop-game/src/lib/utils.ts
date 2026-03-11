import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CATEGORIES_ES = [
  "Nombre",
  "Lugar",
  "Animal",
  "Objeto",
  "Color",
  "Fruta",
  "Marca"
];

export const ALPHABET_ES = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

export const AVATAR_COLORS = [
  "#fcd322", // Yellow
  "#3b82f6", // Blue
  "#10b981", // Green
  "#8b5cf6", // Indigo
  "#ec4899", // Pink
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#a855f7", // Purple
];
