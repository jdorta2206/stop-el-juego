/**
 * Real Halloween scare visuals.
 *
 * Every entry is a REAL photograph/artwork, never a CSS/SVG face or emoji.
 * Sources are Wikimedia Commons files with CC0/public-domain licensing except
 * the existing bundled clown, which is retained with its CC BY 2.0 attribution.
 *
 * Remote sources are preloaded before gameplay so the scare itself does not
 * wait for image decoding.
 */
import { HALLOWEEN_SCARE_IMAGE } from "@/lib/halloweenScareImage";

export const HALLOWEEN_SCARE_ASSETS = {
  clown: HALLOWEEN_SCARE_IMAGE,

  horrorMask:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Masque_d%27horreur%2C_PPS468.jpg",

  hauntedDoll:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Mandy_The_Haunted_Doll.jpg",

  creepyDoll:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Creepy_babydoll_found_along_creek.jpg",

  demonMask:
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Mask_in_the_Shape_of_a_Mountain_Demon%27s_Face_MET_LC-36_25_263-005.jpg",
} as const;

export type HalloweenScareVisualId = keyof typeof HALLOWEEN_SCARE_ASSETS;

const recentScares: HalloweenScareVisualId[] = [];

export function preloadHalloweenScareAssets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const jobs = Object.values(HALLOWEEN_SCARE_ASSETS).map((src) =>
    new Promise<void>((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = src;
      if (image.complete) resolve();
    }),
  );

  return Promise.all(jobs).then(() => undefined);
}

/**
 * Pick a scare independently each time. We deliberately avoid the last two
 * visuals only to prevent obvious immediate repetition; there is NO fixed
 * sequence or rotation.
 */
export function pickHalloweenScareVisual(): HalloweenScareVisualId {
  const ids = Object.keys(HALLOWEEN_SCARE_ASSETS) as HalloweenScareVisualId[];
  const available = ids.filter((id) => !recentScares.includes(id));
  const pool = available.length > 0 ? available : ids;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  recentScares.push(picked);
  while (recentScares.length > 2) recentScares.shift();
  return picked;
}
