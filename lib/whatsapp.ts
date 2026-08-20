import { Alert, Linking } from "react-native";
import {
  parseDateLocal,
  renderNotice,
  type NoticeData,
} from "./notice-template";

// The hearing notice, and the one place that sends it.
//
// There used to be two of these: Hearing Track filled the office's
// editable bilingual template (My Profile → Pre-filled WhatsApp message),
// and the case dossier had its own hard-coded English paragraph. So the
// same matter produced two different messages depending on which screen
// the advocate happened to be standing on — and the dossier's version
// quoted neither the office's wording nor, since it never re-read the
// case, the date that had just been saved.
//
// One builder now. Both screens hand it whatever they hold — a hearing
// row or a full case record — and it renders the office's template
// against it.

/** Whatever a screen knows about a matter. Every field is optional
 *  because a hearing row and a case dossier carry different subsets. */
export type NoticeMatter = {
  caseNo?: string | null;
  clientName?: string | null;
  cnr?: string | null;
  fileNo?: string | null;
  status?: string | null;
  oppositeParty?: string | null;
  courtName?: string | null;
  courtPlace?: string | null;
  lastHearingDate?: string | null;
  nextHearingDate?: string | null;
  clientPhone?: string | null;
  clientWhatsapp?: string | null;
};

/** India dials without a country code; wa.me will not. */
function toWaNumber(matter: NoticeMatter): string {
  const raw = (matter.clientWhatsapp || matter.clientPhone || "").replace(
    /\D/g,
    ""
  );
  if (!raw) return "";
  return raw.length === 10 ? `91${raw}` : raw;
}

/** True when there's a number to message at all. */
export function hasWhatsAppNumber(matter: NoticeMatter): boolean {
  return Boolean(matter.clientWhatsapp || matter.clientPhone);
}

/** The notice text this matter would send, for anything that wants to
 *  show it before sending. */
export function noticeTextFor(
  matter: NoticeMatter,
  officeName: string,
  template: string
): string {
  const data: NoticeData = {
    caseNo: matter.caseNo || "",
    clientName: matter.clientName || "",
    cnr: matter.cnr || "",
    fileNo: matter.fileNo || "",
    status: matter.status || "",
    oppositeParty: matter.oppositeParty || "",
    courtName: matter.courtName || "",
    courtPlace: matter.courtPlace || "",
    lastHearingDate: parseDateLocal(matter.lastHearingDate),
    nextHearingDate: parseDateLocal(matter.nextHearingDate),
    officeName: officeName || "",
  };
  return renderNotice(template, data);
}

/**
 * Open WhatsApp on the client's number with the office's hearing notice
 * filled in. Falls back to the wa.me web handoff when the app isn't
 * installed, and says so plainly when there's no number on file.
 */
export async function openWhatsAppNotice(
  matter: NoticeMatter,
  officeName: string,
  template: string
): Promise<void> {
  if (!hasWhatsAppNumber(matter)) {
    Alert.alert(
      "No WhatsApp number on file",
      "Add a WhatsApp or phone number on this case, or in Client Crew."
    );
    return;
  }
  const wa = toWaNumber(matter);
  if (!wa) return;

  const text = noticeTextFor(matter, officeName, template);
  const native = `whatsapp://send?phone=${wa}&text=${encodeURIComponent(text)}`;
  const fallback = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;

  try {
    const can = await Linking.canOpenURL(native);
    if (can) {
      await Linking.openURL(native);
    } else {
      await Linking.openURL(fallback);
    }
  } catch {
    try {
      await Linking.openURL(fallback);
    } catch {
      Alert.alert("Couldn't open WhatsApp.");
    }
  }
}
