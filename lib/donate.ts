/**
 * Donate panel (bottom-right corner). Change the details here or with env variables on
 * Vercel, no code change needed:
 *   DONATE_QR       picture of the QR code: a path in /public (e.g. /donate-qr.png) or a URL
 *   DONATE_BANK     bank or wallet name, e.g. "Vietcombank" or "MoMo"
 *   DONATE_ACCOUNT  account / phone number (shown with a copy button)
 *   DONATE_NAME     account holder
 *   DONATE_NOTE     suggested transfer note
 * Set DONATE_ENABLED=0 to hide the panel.
 */
export type DonateInfo = { qr: string; bank?: string; account?: string; name?: string; note?: string; placeholder: boolean };

export function donateInfo(): DonateInfo | null {
  if (process.env.DONATE_ENABLED === "0") return null;
  const qr = process.env.DONATE_QR || "/donate-qr.svg";
  return {
    qr,
    placeholder: qr === "/donate-qr.svg",
    bank: process.env.DONATE_BANK || undefined,
    account: process.env.DONATE_ACCOUNT || undefined,
    name: process.env.DONATE_NAME || undefined,
    note: process.env.DONATE_NOTE || "Ung ho STARK",
  };
}
