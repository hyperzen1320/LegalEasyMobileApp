import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  partnerCreateCase,
  partnerGetCase,
  ApiError,
  type PartnerCaseInput,
} from "../../../lib/api";
import { Field, SheetField, DateField } from "../../../components/CaseFields";

const STATUS_OPTIONS = [
  "Filed",
  "Notice",
  "Pleadings",
  "Issues",
  "Evidence",
  "Arguments",
  "Reserved",
  "Judgment",
  "Disposed",
];

const APPEARING_OPTIONS = [
  "Petitioner",
  "Respondent",
  "Plaintiff",
  "Defendant",
];

export default function NewCase() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [showOptional, setShowOptional] = useState(false);

  // The matter
  const [fileNo, setFileNo] = useState("");
  const [caseNo, setCaseNo] = useState("");
  const [iaNumbers, setIaNumbers] = useState("");
  const [cnr, setCnr] = useState("");

  // Parties
  const [clientName, setClientName] = useState("");
  const [appearingFor, setAppearingFor] = useState("Petitioner");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [oppositeParty, setOppositeParty] = useState("");
  const [oppositeAdvocate, setOppositeAdvocate] = useState("");

  // Court & status
  const [courtName, setCourtName] = useState("");
  const [status, setStatus] = useState("Filed");

  // Dates
  const [previousDate, setPreviousDate] = useState("");
  const [nextHearingDate, setNextHearingDate] = useState("");

  // Optional extras
  const [courtPlace, setCourtPlace] = useState("");
  const [courtHall, setCourtHall] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  // "Duplicate matter": ?from=<caseId> pre-fills the parties and court
  // from an existing case. Identifiers and dates stay blank — those are
  // what make the new matter a different matter.
  const { from } = useLocalSearchParams<{ from?: string }>();
  useEffect(() => {
    if (!from) return;
    let alive = true;
    (async () => {
      try {
        const res = await partnerGetCase(String(from));
        if (!alive) return;
        const c = res.case;
        setClientName(c.clientName || "");
        setAppearingFor(c.appearingFor || "Petitioner");
        setClientPhone(c.clientPhone || "");
        setClientWhatsapp(c.clientWhatsapp || "");
        setClientAddress(c.clientAddress || "");
        setOppositeParty(c.oppositeParty || "");
        setOppositeAdvocate(c.oppositeAdvocate || "");
        setCourtName(c.courtName || "");
        setCourtPlace(c.courtPlace || "");
        setCourtHall(c.courtHall || "");
        if (c.courtPlace || c.courtHall || c.clientAddress) {
          setShowOptional(true);
        }
      } catch {
        // Pre-fill is best-effort — a blank form is a fine fallback.
      }
    })();
    return () => {
      alive = false;
    };
  }, [from]);

  function clearMissing(key: string) {
    if (missing.has(key)) {
      const next = new Set(missing);
      next.delete(key);
      setMissing(next);
    }
  }

  async function onSubmit() {
    setError(null);
    const m = new Set<string>();
    if (!fileNo.trim()) m.add("fileNo");
    if (!caseNo.trim()) m.add("caseNo");
    if (!clientName.trim()) m.add("clientName");
    if (!courtName.trim()) m.add("courtName");
    if (m.size > 0) {
      setMissing(m);
      setError("Please fill the four required fields before saving.");
      return;
    }
    setMissing(new Set());
    setSubmitting(true);
    try {
      const payload: PartnerCaseInput = {
        fileNo,
        caseNo,
        iaNumbers,
        cnr,
        clientName,
        appearingFor,
        clientWhatsapp,
        clientPhone,
        clientAddress,
        oppositeParty,
        oppositeAdvocate,
        courtName,
        courtPlace,
        courtHall,
        status,
        nextHearingDate: nextHearingDate || null,
        lastHearingDate: previousDate || null,
      };
      const res = await partnerCreateCase(payload);
      router.replace(`/(home)/cases/${res.id}` as never);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            contentContainerClassName="px-5 pt-5 pb-12"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View>
              <Text
                className="text-[10px] uppercase text-app-copper-deep"
                style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
              >
                New matter
              </Text>
              <Text
                className="mt-1.5 text-[28px] font-semibold tracking-tight leading-tight text-app-ink"
                style={{ fontFamily: "Crimson-SemiBold" }}
              >
                Add a Case
              </Text>
              <Text
                className="mt-2 text-[13px] leading-[20px] text-app-fg-muted"
                style={{ fontFamily: "Manrope" }}
              >
                Capture the matter details — you can update next date later.
              </Text>
            </View>

            <Card>
              <Field
                label="File Number"
                required
                value={fileNo}
                onChangeText={(v) => {
                  setFileNo(v);
                  clearMissing("fileNo");
                }}
                placeholder="F-2025/001"
                invalid={missing.has("fileNo")}
              />
              <Field
                label="Case Number"
                required
                value={caseNo}
                onChangeText={(v) => {
                  setCaseNo(v);
                  clearMissing("caseNo");
                }}
                placeholder="O.S. 100/2025"
                invalid={missing.has("caseNo")}
              />
              <Field
                label="I.A. Number(s)"
                value={iaNumbers}
                onChangeText={setIaNumbers}
                placeholder="I.A. 5/2025"
              />
              <Field
                label="CNR Number"
                value={cnr}
                onChangeText={setCnr}
                placeholder="TNCH010012342024"
                autoCapitalize="characters"
              />
            </Card>

            <Card>
              <Field
                label="Client"
                required
                value={clientName}
                onChangeText={(v) => {
                  setClientName(v);
                  clearMissing("clientName");
                }}
                placeholder="R. Murugan"
                autoCapitalize="words"
                invalid={missing.has("clientName")}
              />
              <SheetField
                label="Appearing For"
                value={appearingFor}
                options={APPEARING_OPTIONS}
                onChange={setAppearingFor}
              />
              <Field
                label="WhatsApp"
                value={clientWhatsapp}
                onChangeText={setClientWhatsapp}
                placeholder="+91..."
                keyboardType="phone-pad"
              />
              <Field
                label="Contact Number"
                value={clientPhone}
                onChangeText={setClientPhone}
                placeholder="+91..."
                keyboardType="phone-pad"
              />
              <Field
                label="Opposite Party"
                value={oppositeParty}
                onChangeText={setOppositeParty}
                placeholder="State of Tamil Nadu"
                autoCapitalize="words"
              />
              <Field
                label="Opposite Advocate"
                value={oppositeAdvocate}
                onChangeText={setOppositeAdvocate}
                placeholder="Adv. S. Ramesh"
                autoCapitalize="words"
              />
            </Card>

            <Card>
              <Field
                label="Court"
                required
                value={courtName}
                onChangeText={(v) => {
                  setCourtName(v);
                  clearMissing("courtName");
                }}
                placeholder="District Court, Chennai"
                autoCapitalize="words"
                invalid={missing.has("courtName")}
              />
              <SheetField
                label="Status"
                value={status}
                options={STATUS_OPTIONS}
                onChange={setStatus}
              />
              <DateField
                label="Previous Date"
                value={previousDate}
                onChange={setPreviousDate}
              />
              <DateField
                label="Next Date"
                value={nextHearingDate}
                onChange={setNextHearingDate}
              />
            </Card>

            {/* Optional extras */}
            <Pressable
              onPress={() => setShowOptional((v) => !v)}
              className="mt-5 flex-row items-center justify-center gap-2 active:opacity-50"
            >
              <Feather
                name={showOptional ? "chevron-up" : "chevron-down"}
                size={14}
                color="#8a5821"
              />
              <Text
                className="text-[11px] uppercase"
                style={{
                  fontFamily: "DMMono-Medium",
                  letterSpacing: 1.5,
                  color: "#8a5821",
                }}
              >
                {showOptional ? "Hide" : "Add more details"}
              </Text>
            </Pressable>

            {showOptional ? (
              <Card>
                <Field
                  label="Court Place"
                  value={courtPlace}
                  onChangeText={setCourtPlace}
                  placeholder="Chennai"
                  autoCapitalize="words"
                />
                <Field
                  label="Court Hall"
                  value={courtHall}
                  onChangeText={setCourtHall}
                  placeholder="Hall 4"
                />
                <Field
                  label="Client Address"
                  value={clientAddress}
                  onChangeText={setClientAddress}
                  placeholder="12, North Mada St, Mylapore"
                  autoCapitalize="sentences"
                  multiline
                />
              </Card>
            ) : null}

            {error ? (
              <View
                className="mt-5 rounded-md px-4 py-3"
                style={{ backgroundColor: "#f6dccd" }}
              >
                <Text
                  className="text-[10px] font-semibold uppercase"
                  style={{
                    fontFamily: "DMMono-Medium",
                    letterSpacing: 1.5,
                    color: "#c14a37",
                  }}
                >
                  Couldn&rsquo;t save
                </Text>
                <Text
                  className="mt-1 text-[13px] text-app-ink"
                  style={{ fontFamily: "Manrope" }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            <View className="mt-6 flex-row gap-3">
              <Pressable
                onPress={() => router.back()}
                className="flex-1 rounded-md py-3.5 items-center active:opacity-50"
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                }}
              >
                <Text
                  className="text-[13px] font-medium text-app-fg-soft"
                  style={{ fontFamily: "Manrope-Medium" }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={onSubmit}
                disabled={submitting}
                className="flex-[1.4] rounded-md py-3.5 items-center flex-row justify-center gap-2"
                style={{
                  backgroundColor: "#c5853a",
                  opacity: submitting ? 0.6 : 1,
                  shadowColor: "#c5853a",
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 5,
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#2a1c08" size="small" />
                ) : (
                  <Text
                    className="text-[13px] font-semibold"
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      color: "#2a1c08",
                    }}
                  >
                    Save Case
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function TopBar() {
  const router = useRouter();
  return (
    <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center gap-3">
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        className="active:opacity-50"
      >
        <Feather name="arrow-left" size={18} color="#0a1124" />
      </Pressable>
      <Text
        className="text-[14px] font-semibold text-app-ink"
        style={{ fontFamily: "Manrope-SemiBold" }}
      >
        New Case
      </Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="mt-5 rounded-2xl bg-app-paper p-5"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <View className="gap-4">{children}</View>
    </View>
  );
}

