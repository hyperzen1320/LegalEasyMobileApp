// eCourts case-status portal. The v6 portal gates CNR search behind a captcha,
// so we can't deep-link straight to a case — instead we open the portal and
// copy the CNR to the clipboard so the advocate can paste it into the search.
// Mirrors the web app's src/lib/ecourts.ts so both platforms behave the same.
export const ECOURTS_CNR_SEARCH =
  "https://services.ecourts.gov.in/ecourtindia_v6/";

export function ecourtsCnrUrl(_cnr?: string): string {
  return ECOURTS_CNR_SEARCH;
}
