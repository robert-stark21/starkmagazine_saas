/**
 * Side banner ads: one tall slot left and right of the page on wide screens.
 * Set them with env variables on Vercel, no code change needed:
 *   ADS_LEFT_IMAGE / ADS_RIGHT_IMAGE   the banner picture: a path in /public or a URL (160×600 works best)
 *   ADS_LEFT_URL   / ADS_RIGHT_URL     where a click goes
 *   ADS_CONTACT                        shown on an empty slot, e.g. "ads@stark.vn" or a phone number
 * A slot with no image shows a "your ad here" frame. ADS_ENABLED=0 hides both.
 */
export type AdSlot = { image?: string; url?: string };
export type AdsInfo = { left: AdSlot; right: AdSlot; contact?: string };

const slot = (image?: string, url?: string): AdSlot => ({ image: image || undefined, url: url || undefined });

export function adsInfo(): AdsInfo | null {
  if (process.env.ADS_ENABLED === "0") return null;
  return {
    left: slot(process.env.ADS_LEFT_IMAGE, process.env.ADS_LEFT_URL),
    right: slot(process.env.ADS_RIGHT_IMAGE, process.env.ADS_RIGHT_URL),
    contact: process.env.ADS_CONTACT || undefined,
  };
}
