import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import KeyboardAwareScreen from "../KeyboardAwareScreen";
import { Field, SheetField, DateField } from "../CaseFields";
import StatusCombobox from "./StatusCombobox";
import type { PartnerCaseInput } from "../../lib/api";

// Shared case form — backs both "Add a Case" (new) and "Edit Case". The owning
// screen handles loading + the submit call (create vs PATCH) and passes the
// network error in; the form owns all field state, required-field validation,
// the typeable status combobox and the calendar date pickers.

const APPEARING_OPTIONS = ["Petitioner", "Respondent", "Plaintiff", "Defendant"];

export type CaseFormInitial = Partial<{
  fileNo: string;
  caseNo: string;
  iaNumbers: string;
  cnr: string;
  clientName: string;
  appearingFor: string;
  clientWhatsapp: string;
  clientPhone: string;
  oppositeParty: string;
  oppositeAdvocate: string;
  courtName: string;
  status: string;
  previousDate: string;
  nextHearingDate: string;
  courtPlace: string;
  courtHall: string;
  clientAddress: string;
}>;

export default function CaseForm({
  eyebrow,
  title,
  subtitle,
  submitLabel,
  initial,
  submitting,
  error,
  onSubmit,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  submitLabel: string;
  initial?: CaseFormInitial;
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: PartnerCaseInput) => void;
}) {
  const router = useRouter();

  const [fileNo, setFileNo] = useState(initial?.fileNo ?? "");
  const [caseNo, setCaseNo] = useState(initial?.caseNo ?? "");
  const [iaNumbers, setIaNumbers] = useState(initial?.iaNumbers ?? "");
  const [cnr, setCnr] = useState(initial?.cnr ?? "");

  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [appearingFor, setAppearingFor] = useState(
    initial?.appearingFor ?? "Petitioner"
  );
  const [clientWhatsapp, setClientWhatsapp] = useState(
    initial?.clientWhatsapp ?? ""
  );
  const [clientPhone, setClientPhone] = useState(initial?.clientPhone ?? "");
  const [oppositeParty, setOppositeParty] = useState(
    initial?.oppositeParty ?? ""
  );
  const [oppositeAdvocate, setOppositeAdvocate] = useState(
    initial?.oppositeAdvocate ?? ""
  );

  const [courtName, setCourtName] = useState(initial?.courtName ?? "");
  const [status, setStatus] = useState(initial?.status ?? "Filed");
  const [previousDate, setPreviousDate] = useState(initial?.previousDate ?? "");
  const [nextHearingDate, setNextHearingDate] = useState(
    initial?.nextHearingDate ?? ""
  );

  const [courtPlace, setCourtPlace] = useState(initial?.courtPlace ?? "");
  const [courtHall, setCourtHall] = useState(initial?.courtHall ?? "");
  const [clientAddress, setClientAddress] = useState(
    initial?.clientAddress ?? ""
  );
  const [showOptional, setShowOptional] = useState(
    !!(initial?.courtPlace || initial?.courtHall || initial?.clientAddress)
  );

  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [validationError, setValidationError] = useState<string | null>(null);

  function clearMissing(key: string) {
    if (missing.has(key)) {
      const next = new Set(missing);
      next.delete(key);
      setMissing(next);
    }
  }

  function handleSubmit() {
    const m = new Set<string>();
    if (!fileNo.trim()) m.add("fileNo");
    if (!caseNo.trim()) m.add("caseNo");
    if (!clientName.trim()) m.add("clientName");
    if (!courtName.trim()) m.add("courtName");
    if (m.size > 0) {
      setMissing(m);
      setValidationError("Please fill the four required fields before saving.");
      return;
    }
    setMissing(new Set());
    setValidationError(null);
    onSubmit({
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
    });
  }

  const shownError = validationError ?? error;

  return (
    <KeyboardAwareScreen contentContainerClassName="px-5 pt-5 pb-12 sm:max-w-[560px] sm:self-center sm:w-full">
      <View>
        <Text
          className="text-[10px] uppercase text-app-copper-deep"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          {eyebrow}
        </Text>
        <Text
          className="mt-1.5 text-[28px] font-semibold tracking-tight leading-tight text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
        >
          {title}
        </Text>
        <Text
          className="mt-2 text-[13px] leading-[20px] text-app-fg-muted"
          style={{ fontFamily: "Manrope" }}
        >
          {subtitle}
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
        <StatusCombobox label="Status" value={status} onChange={setStatus} />
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
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.5, color: "#8a5821" }}
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

      {shownError ? (
        <View
          className="mt-5 rounded-md px-4 py-3"
          style={{ backgroundColor: "#f6dccd" }}
        >
          <Text
            className="text-[10px] font-semibold uppercase"
            style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.5, color: "#c14a37" }}
          >
            Couldn&rsquo;t save
          </Text>
          <Text
            className="mt-1 text-[13px] text-app-ink"
            style={{ fontFamily: "Manrope" }}
          >
            {shownError}
          </Text>
        </View>
      ) : null}

      <View className="mt-6 flex-row gap-3">
        <Pressable
          onPress={() => router.back()}
          className="flex-1 rounded-md py-3.5 items-center active:opacity-50"
          style={{ backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e3d9c0" }}
        >
          <Text
            className="text-[13px] font-medium text-app-fg-soft"
            style={{ fontFamily: "Manrope-Medium" }}
          >
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
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
              style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
            >
              {submitLabel}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAwareScreen>
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
