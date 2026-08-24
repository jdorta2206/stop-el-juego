/**
 * Native App Store purchase configuration.
 * Product IDs are intentionally separate from Google Play SKUs.
 */
export const IOS_PRODUCT_IDS = {
  premiumMonthly: "com.dorynex.stopjuegodepalabras.premium.monthly",
  worldCupPack: "com.dorynex.stopjuegodepalabras.pack.mundial",
} as const;

export const IOS_PRODUCT_ID_LIST = Object.values(IOS_PRODUCT_IDS);
export type IOSProductId = (typeof IOS_PRODUCT_ID_LIST)[number];

export function isIOSProductId(value: string): value is IOSProductId {
  return IOS_PRODUCT_ID_LIST.includes(value as IOSProductId);
}

export const IOS_PURCHASE_API = {
  verify: "/api/billing/apple/verify",
  restore: "/api/billing/apple/restore",
} as const;
