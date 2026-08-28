// Compatibility re-export. The previous implementation called the synchronous
// detectPaymentChannel() function with .then(), causing the production crash:
// "TypeError: Dg(...).then is not a function".
export { BannerAd, RewardedAd } from "./AdSystemFixed";
