// The office's WhatsApp hearing-notice template — its merge tokens, the
// default bilingual (Tamil + English) wording, and the renderer that fills a
// template with one matter's details. A direct port of the web's
// src/lib/notice-template.ts so both clients speak the same token language.

export type NoticeData = {
  caseNo: string;
  clientName: string;
  cnr: string;
  fileNo: string;
  status: string;
  oppositeParty: string;
  courtName: string;
  courtPlace: string;
  lastHearingDate: Date | null;
  nextHearingDate: Date | null;
  officeName: string;
};

export type NoticeToken = { token: string; label: string };

// The fields an admin can drop into the template via the "@" menu. `token`
// is what gets written ({{token}}); `label` is the friendly name shown.
export const NOTICE_TOKENS: NoticeToken[] = [
  { token: "caseNo", label: "Case No" },
  { token: "clientName", label: "Client Name" },
  { token: "cnr", label: "CNR" },
  { token: "fileNo", label: "File No" },
  { token: "lastHearingDate", label: "Previous Date" },
  { token: "nextHearingDate", label: "Next Date" },
  { token: "courtName", label: "Court" },
  { token: "courtPlace", label: "Place" },
  { token: "oppositeParty", label: "Opposite Party" },
  { token: "status", label: "Status" },
  { token: "officeName", label: "Office Name" },
];

// DD.MM.YYYY — the convention the chambers uses in its notices.
function fmtDate(d: Date | null): string {
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// Default the office sees the first time — the admin edits it in My Profile.
// {{officeName}} stands in for the signature; the admin replaces it with the
// full advocate / firm / contact block they want at the foot of the notice.
export const DEFAULT_NOTICE_TEMPLATE = [
  "வணக்கம், உங்கள் வழக்கு எண். *{{caseNo}}* , கடந்த {{lastHearingDate}} அன்று வாய்தா இருந்தது. அடுத்த வாய்தா வரும் {{nextHearingDate}} அன்று உள்ளது. நன்றி.",
  "",
  "Hi, Your Case No. *{{caseNo}}* came up on {{lastHearingDate}} for hearing and is now posted to {{nextHearingDate}}.",
  "Thanking You.",
  "",
  "{{officeName}}",
].join("\n");

// Parse a yyyy-mm-dd value into a *local* midnight Date so the notice reads
// the same calendar day the advocate picked (new Date("2026-05-30") parses as
// UTC and could slip a day in IST when formatted back).
export function parseDateLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Substitute every {{token}} in the template with the matter's value. Unknown
// tokens are left as-is so a typo is visible rather than silently dropped.
export function renderNotice(template: string, data: NoticeData): string {
  const tpl = template && template.trim() ? template : DEFAULT_NOTICE_TEMPLATE;
  const map: Record<string, string> = {
    caseNo: data.caseNo || "",
    clientName: data.clientName || "",
    cnr: data.cnr || "",
    fileNo: data.fileNo || "",
    status: data.status || "",
    oppositeParty: data.oppositeParty || "",
    courtName: data.courtName || "",
    courtPlace: data.courtPlace || "",
    lastHearingDate: fmtDate(data.lastHearingDate),
    nextHearingDate: fmtDate(data.nextHearingDate),
    officeName: data.officeName || "",
  };
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) =>
    key in map ? map[key] : whole
  );
}
