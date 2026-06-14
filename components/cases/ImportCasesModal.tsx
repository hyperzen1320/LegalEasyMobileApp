import { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { pickCsvText } from "../../lib/files";
import { partnerCreateCase, type PartnerCaseInput } from "../../lib/api";

// CSV → bulk case create. A header row maps columns to case fields (flexible
// header names); every row needs a Case No. Dates accept DD/MM/YYYY or
// YYYY-MM-DD. Rows are created one-by-one via the same endpoint the New Case
// form uses — partial success is reported.

const HEADER_MAP: Record<string, keyof PartnerCaseInput> = {
  caseno: "caseNo",
  case: "caseNo",
  casenumber: "caseNo",
  fileno: "fileNo",
  filenumber: "fileNo",
  file: "fileNo",
  cnr: "cnr",
  client: "clientName",
  clientname: "clientName",
  party: "clientName",
  clientphone: "clientPhone",
  phone: "clientPhone",
  contact: "clientPhone",
  mobile: "clientPhone",
  whatsapp: "clientWhatsapp",
  clientwhatsapp: "clientWhatsapp",
  clientaddress: "clientAddress",
  address: "clientAddress",
  oppositeparty: "oppositeParty",
  opposite: "oppositeParty",
  oppositeadvocate: "oppositeAdvocate",
  appearingfor: "appearingFor",
  appearing: "appearingFor",
  ianumbers: "iaNumbers",
  ianumber: "iaNumbers",
  ia: "iaNumbers",
  court: "courtName",
  courtname: "courtName",
  courthall: "courtHall",
  hall: "courtHall",
  courtplace: "courtPlace",
  place: "courtPlace",
  status: "status",
  stage: "status",
  nextdate: "nextHearingDate",
  nexthearing: "nextHearingDate",
  nexthearingdate: "nextHearingDate",
  next: "nextHearingDate",
  previousdate: "lastHearingDate",
  lastdate: "lastHearingDate",
  lasthearingdate: "lastHearingDate",
  lasthearing: "lastHearingDate",
  previous: "lastHearingDate",
};

const DATE_FIELDS = new Set(["nextHearingDate", "lastHearingDate"]);

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Minimal RFC-4180-ish parser: handles quoted fields, "" escapes, and CRLF.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function normDate(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

type Parsed = { payloads: PartnerCaseInput[]; skipped: number; total: number };

function buildPayloads(rows: string[][]): Parsed {
  if (rows.length < 2) return { payloads: [], skipped: 0, total: 0 };
  const headers = rows[0].map((h) => HEADER_MAP[normHeader(h)]);
  const payloads: PartnerCaseInput[] = [];
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const obj: Record<string, string> = {};
    headers.forEach((key, ci) => {
      if (key) obj[key] = (cells[ci] ?? "").trim();
    });
    if (!obj.caseNo) {
      skipped++;
      continue;
    }
    const payload: Record<string, string> = { caseNo: obj.caseNo };
    for (const [k, val] of Object.entries(obj)) {
      if (k === "caseNo" || !val) continue;
      if (DATE_FIELDS.has(k)) {
        const d = normDate(val);
        if (d) payload[k] = d;
      } else {
        payload[k] = val;
      }
    }
    payloads.push(payload as PartnerCaseInput);
  }
  return { payloads, skipped, total: rows.length - 1 };
}

export default function ImportCasesModal({
  visible,
  onClose,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setParsed(null);
    setFileName("");
    setBusy(false);
    setProgress(null);
    setError(null);
  }
  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function pick() {
    setError(null);
    try {
      const f = await pickCsvText();
      if (!f) return;
      setFileName(f.name);
      const p = buildPayloads(parseCsv(f.text));
      if (p.payloads.length === 0) {
        setError(
          p.total === 0
            ? "That file has no data rows."
            : "No rows had a Case No. — check the header names (Case No, File No, Client, Court…)."
        );
        setParsed(null);
        return;
      }
      setParsed(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  }

  async function runImport() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    let done = 0;
    let failed = 0;
    setProgress({ done: 0, total: parsed.payloads.length });
    for (const payload of parsed.payloads) {
      try {
        await partnerCreateCase(payload);
        done++;
      } catch {
        failed++;
      }
      setProgress({ done: done + failed, total: parsed.payloads.length });
    }
    setBusy(false);
    onImported();
    Alert.alert(
      "Import complete",
      `${done} matter${done === 1 ? "" : "s"} added${
        failed ? `, ${failed} failed` : ""
      }.`,
      [{ text: "Done", onPress: close }]
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
      >
        <View
          className="rounded-t-3xl bg-app-paper px-5 pt-3 pb-8"
          style={{ maxHeight: "84%" }}
        >
          <View
            className="self-center mb-3 h-1.5 w-12 rounded-full"
            style={{ backgroundColor: "#e3d9c0" }}
          />
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              Case Vault
            </Text>
            <Pressable onPress={close} hitSlop={8} disabled={busy}>
              <Feather name="x" size={18} color="#8a5821" />
            </Pressable>
          </View>
          <Text
            className="text-[20px] tracking-tight text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
          >
            Import cases from CSV
          </Text>
          <Text
            className="mt-1 text-[12.5px] leading-5 text-app-fg-muted"
            style={{ fontFamily: "Manrope" }}
          >
            A header row with columns like Case No, File No, Client, Court, CNR,
            Status, Next Date. Rows without a Case No. are skipped.
          </Text>

          {error ? (
            <View
              className="mt-3 rounded-md px-3.5 py-2.5"
              style={{ backgroundColor: "#f6dccd" }}
            >
              <Text
                className="text-[12.5px]"
                style={{ fontFamily: "Manrope", color: "#c14a37" }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {!parsed ? (
            <Pressable
              onPress={pick}
              className="mt-5 rounded-xl items-center justify-center py-8 active:opacity-80"
              style={{
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: "#c5b99e",
              }}
            >
              <Feather name="upload-cloud" size={26} color="#8a5821" />
              <Text
                className="mt-2.5 text-[14px]"
                style={{ fontFamily: "Manrope-SemiBold", color: "#0a1124" }}
              >
                Choose a .csv file
              </Text>
            </Pressable>
          ) : (
            <>
              <View
                className="mt-4 rounded-xl p-4"
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                }}
              >
                <View className="flex-row items-center gap-2">
                  <Feather name="file-text" size={15} color="#8a5821" />
                  <Text
                    className="flex-1 text-[13px]"
                    style={{ fontFamily: "Manrope-SemiBold", color: "#0a1124" }}
                    numberOfLines={1}
                  >
                    {fileName}
                  </Text>
                </View>
                <Text
                  className="mt-2 text-[12.5px]"
                  style={{ fontFamily: "Manrope", color: "#4d4538" }}
                >
                  <Text
                    style={{ fontFamily: "Manrope-SemiBold", color: "#0a1124" }}
                  >
                    {parsed.payloads.length}
                  </Text>{" "}
                  matter{parsed.payloads.length === 1 ? "" : "s"} ready
                  {parsed.skipped
                    ? ` · ${parsed.skipped} skipped (no Case No.)`
                    : ""}
                  .
                </Text>
              </View>

              <ScrollView
                style={{ maxHeight: 220 }}
                className="mt-3"
                showsVerticalScrollIndicator={false}
              >
                {parsed.payloads.slice(0, 40).map((p, i) => (
                  <View
                    key={i}
                    className="flex-row items-center gap-2 py-2"
                    style={{ borderBottomWidth: 1, borderBottomColor: "#efe5d0" }}
                  >
                    <Text
                      className="text-[13px]"
                      style={{ fontFamily: "Crimson-SemiBold", color: "#0a1124" }}
                      numberOfLines={1}
                    >
                      {p.caseNo}
                    </Text>
                    {p.clientName ? (
                      <Text
                        className="flex-1 text-[12px]"
                        style={{ fontFamily: "Manrope", color: "#7a7060" }}
                        numberOfLines={1}
                      >
                        · {p.clientName}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {parsed.payloads.length > 40 ? (
                  <Text
                    className="py-2 text-[11px]"
                    style={{ fontFamily: "Manrope", color: "#a89c80" }}
                  >
                    + {parsed.payloads.length - 40} more…
                  </Text>
                ) : null}
              </ScrollView>

              <View className="mt-4 flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setParsed(null);
                    setFileName("");
                  }}
                  disabled={busy}
                  className="flex-1 rounded-md py-3.5 items-center active:opacity-60"
                  style={{
                    backgroundColor: "#ffffff",
                    borderWidth: 1,
                    borderColor: "#e3d9c0",
                  }}
                >
                  <Text
                    className="text-[13px]"
                    style={{ fontFamily: "Manrope-Medium", color: "#4d4538" }}
                  >
                    Choose another
                  </Text>
                </Pressable>
                <Pressable
                  onPress={runImport}
                  disabled={busy}
                  className="flex-[1.5] rounded-md py-3.5 items-center justify-center flex-row gap-2"
                  style={{ backgroundColor: "#c5853a", opacity: busy ? 0.7 : 1 }}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#2a1c08" />
                  ) : (
                    <Feather name="download" size={15} color="#2a1c08" />
                  )}
                  <Text
                    className="text-[13px]"
                    style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
                  >
                    {busy && progress
                      ? `Importing ${progress.done}/${progress.total}…`
                      : `Import ${parsed.payloads.length}`}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
