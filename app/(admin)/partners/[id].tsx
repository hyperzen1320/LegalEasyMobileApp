import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  adminGetPartner,
  adminUpdatePartner,
  adminDeletePartner,
  adminResetPartnerPassword,
  ApiError,
  type AdminPartnerDetail,
} from "../../../lib/api";

type Plan = "trial" | "solo" | "office" | "chambers";

export default function PartnerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [partner, setPartner] = useState<AdminPartnerDetail | null>(null);
  const [partnerAdmin, setPartnerAdmin] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // editable state
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [plan, setPlan] = useState<Plan>("trial");
  const [extendDays, setExtendDays] = useState("7");

  // password reset state
  const [newPw, setNewPw] = useState("");
  const [confirmNewPw, setConfirmNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  // operation state
  const [savingInfo, setSavingInfo] = useState(false);
  const [extending, setExtending] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);
  const [actioning, setActioning] = useState<null | "suspend" | "unsuspend" | "delete">(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await adminGetPartner(id);
      setPartner(data.partner);
      setPartnerAdmin(data.partnerAdmin);
      setName(data.partner.name);
      setContactName(data.partner.primaryContactName);
      setPhone(data.partner.phone);
      setCity(data.partner.city);
      setStateField(data.partner.state);
      setPlan(data.partner.plan);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  function flash(msg: string) {
    setSavedNote(msg);
    setTimeout(() => setSavedNote(null), 2500);
  }

  async function onSaveInfo() {
    if (!id || !partner) return;
    setSavingInfo(true);
    setError(null);
    try {
      await adminUpdatePartner(id, {
        name,
        primaryContactName: contactName,
        phone,
        city,
        state: stateField,
        plan,
      });
      await load();
      flash("Saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setSavingInfo(false);
    }
  }

  async function onExtendTrial() {
    if (!id) return;
    setExtending(true);
    setError(null);
    try {
      const days = Number(extendDays) || 7;
      await adminUpdatePartner(id, { extendTrialDays: days });
      await load();
      flash(`Trial extended by ${days} days`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't extend");
    } finally {
      setExtending(false);
    }
  }

  async function onResetPassword() {
    if (!id) return;
    setError(null);
    if (newPw.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirmNewPw) {
      setError("Passwords don't match.");
      return;
    }
    setResettingPw(true);
    try {
      await adminResetPartnerPassword(id, newPw);
      setNewPw("");
      setConfirmNewPw("");
      flash("Password reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reset");
    } finally {
      setResettingPw(false);
    }
  }

  async function onSuspend() {
    if (!id) return;
    setActioning("suspend");
    setError(null);
    try {
      await adminUpdatePartner(id, { subscriptionStatus: "suspended" });
      await load();
      flash("Suspended");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't suspend");
    } finally {
      setActioning(null);
    }
  }

  async function onUnsuspend() {
    if (!id) return;
    setActioning("unsuspend");
    setError(null);
    try {
      await adminUpdatePartner(id, { subscriptionStatus: "active" });
      await load();
      flash("Unsuspended");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't unsuspend");
    } finally {
      setActioning(null);
    }
  }

  async function onDelete() {
    if (!id || !partner) return;
    Alert.alert(
      `Delete ${partner.name}?`,
      "All users will be locked out. Soft-delete — can be undone via DB only.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setActioning("delete");
            try {
              await adminDeletePartner(id);
              router.replace("/(admin)/partners");
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Couldn't delete");
              setActioning(null);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-admin-bg items-center justify-center">
        <ActivityIndicator color="#0e7c4a" size="large" />
      </View>
    );
  }
  if (!partner) {
    return (
      <View className="flex-1 bg-admin-bg items-center justify-center px-5">
        <Text className="font-plex text-[14px] text-admin-fg-muted text-center">
          {error ?? "Partner not found"}
        </Text>
      </View>
    );
  }

  const isTrial = partner.subscription.status === "trial";
  const isSuspended = partner.subscription.status === "suspended";
  const trialEnd = new Date(partner.subscription.endDate);
  const daysLeft = Math.ceil(
    (trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  return (
    <View className="flex-1 bg-admin-bg">
      <StatusBar style="dark" backgroundColor="#fafaf7" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar partnerName={partner.name} status={partner.subscription.status} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            contentContainerClassName="px-5 pt-5 pb-12"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {savedNote ? (
              <View className="mb-4 rounded-md bg-admin-accent-soft border border-admin-accent/30 px-4 py-2.5 flex-row items-center gap-2">
                <Feather name="check" size={14} color="#0e7c4a" />
                <Text className="font-plex-medium text-[12px] text-admin-accent">
                  {savedNote}
                </Text>
              </View>
            ) : null}

            {error ? (
              <View className="mb-4 rounded-md border border-admin-danger/30 bg-admin-danger-soft px-4 py-3">
                <Text className="font-plex text-[13px] text-admin-fg">{error}</Text>
              </View>
            ) : null}

            {/* Header card */}
            <View className="bg-admin-surface border border-admin-border rounded-lg p-5">
              <Text
                className="font-plex-mono text-[10px] uppercase text-admin-fg-soft"
                style={{ letterSpacing: 1.3 }}
              >
                /{partner.slug}
              </Text>
              <Text className="mt-1 font-plex-bold text-[22px] text-admin-fg leading-tight">
                {partner.name}
              </Text>
              <Text
                className="mt-1.5 font-plex-mono text-[11px] text-admin-fg-muted"
                style={{ letterSpacing: 0.3 }}
              >
                Created{" "}
                {new Date(partner.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </View>

            {/* Section 1 — Info */}
            <Section title="Partner Info" subtitle="Editable details.">
              <Field label="Chambers Name" value={name} onChangeText={setName} />
              <Field
                label="Contact Name"
                value={contactName}
                onChangeText={setContactName}
                autoCapitalize="words"
              />
              <Field
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Field
                label="Login Email"
                value={partner.primaryEmail}
                readOnly
                hint="Use Reset Password below to change credentials."
              />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field
                    label="City"
                    value={city}
                    onChangeText={setCity}
                    autoCapitalize="words"
                  />
                </View>
                <View className="flex-1">
                  <Field
                    label="State"
                    value={stateField}
                    onChangeText={setStateField}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Plan picker */}
              <View>
                <Text
                  className="font-plex-mono-medium text-[10px] uppercase text-admin-fg-muted mb-2"
                  style={{ letterSpacing: 1.3 }}
                >
                  Plan
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {(["trial", "solo", "office", "chambers"] as Plan[]).map((p) => {
                    const isSelected = plan === p;
                    const isTrialOpt = p === "trial";
                    return (
                      <Pressable
                        key={p}
                        onPress={() => setPlan(p)}
                        className={`px-3 py-2 rounded-md border ${
                          isSelected
                            ? isTrialOpt
                              ? "border-admin-saffron bg-admin-saffron-soft"
                              : "border-admin-accent bg-admin-accent-soft"
                            : "border-admin-border bg-admin-surface"
                        }`}
                      >
                        <Text
                          className={`font-plex-mono-medium text-[10px] uppercase ${
                            isSelected
                              ? isTrialOpt
                                ? "text-admin-saffron"
                                : "text-admin-accent"
                              : "text-admin-fg-muted"
                          }`}
                          style={{ letterSpacing: 1.3 }}
                        >
                          {p}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={onSaveInfo}
                disabled={savingInfo}
                className="bg-admin-fg active:bg-admin-fg-muted rounded-md py-3 mt-2 items-center flex-row justify-center gap-2"
                style={{ opacity: savingInfo ? 0.6 : 1 }}
              >
                {savingInfo ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="font-plex-bold text-[13px] text-white">
                    Save Changes
                  </Text>
                )}
              </Pressable>
            </Section>

            {/* Section 2 — Trial extension (only for trial) */}
            {isTrial ? (
              <Section
                title="Trial"
                subtitle={
                  daysLeft > 0
                    ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left — ends ${trialEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`
                    : `Trial expired ${trialEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · login blocked`
                }
              >
                <View className="flex-row items-center gap-3">
                  <TextInput
                    value={extendDays}
                    onChangeText={setExtendDays}
                    keyboardType="number-pad"
                    className="bg-admin-surface border border-admin-saffron/40 rounded-md px-3 py-2 w-20 text-[14px] tabular-nums text-admin-fg font-plex-mono"
                    maxLength={3}
                  />
                  <Text className="font-plex text-[12px] text-admin-fg-muted">
                    days
                  </Text>
                  <Pressable
                    onPress={onExtendTrial}
                    disabled={extending}
                    className="ml-auto bg-admin-saffron active:opacity-80 rounded-md px-4 py-2"
                    style={{ opacity: extending ? 0.6 : 1 }}
                  >
                    <Text className="font-plex-bold text-[12px] text-white">
                      {extending ? "Extending…" : "Extend"}
                    </Text>
                  </Pressable>
                </View>
              </Section>
            ) : null}

            {/* Section 3 — Reset password */}
            {partnerAdmin ? (
              <Section
                title="Reset Partner-Admin Password"
                subtitle={`Force a new password for ${partnerAdmin.email}. Current password invalidated immediately.`}
              >
                <PasswordField
                  label="New Password"
                  value={newPw}
                  onChangeText={setNewPw}
                  show={showPw}
                  onToggleShow={() => setShowPw((s) => !s)}
                  placeholder="At least 6 characters"
                />
                <PasswordField
                  label="Confirm"
                  value={confirmNewPw}
                  onChangeText={setConfirmNewPw}
                  show={showPw}
                  onToggleShow={() => setShowPw((s) => !s)}
                  placeholder="Match the above"
                />
                <Pressable
                  onPress={onResetPassword}
                  disabled={resettingPw}
                  className="bg-admin-fg active:bg-admin-fg-muted rounded-md py-3 mt-1 items-center"
                  style={{ opacity: resettingPw ? 0.6 : 1 }}
                >
                  {resettingPw ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="font-plex-bold text-[13px] text-white">
                      Reset Password
                    </Text>
                  )}
                </Pressable>
              </Section>
            ) : null}

            {/* Section 4 — Danger zone */}
            <View className="mt-6 bg-admin-danger-soft/40 border border-admin-danger/30 rounded-lg p-5">
              <View className="border-b border-admin-danger/20 pb-3 mb-4">
                <Text
                  className="font-plex-mono-medium text-[10px] uppercase text-admin-danger"
                  style={{ letterSpacing: 1.5 }}
                >
                  Danger zone
                </Text>
                <Text className="mt-1.5 font-plex-bold text-[14px] text-admin-fg">
                  Restrict access
                </Text>
                <Text className="mt-1 font-plex text-[11px] text-admin-fg-muted">
                  Suspend logs everyone out and blocks login until reversed.
                  Delete is a soft-delete that locks all users permanently.
                </Text>
              </View>

              <View className="gap-2.5">
                <Pressable
                  onPress={isSuspended ? onUnsuspend : onSuspend}
                  disabled={actioning !== null}
                  className={`rounded-md py-3 items-center flex-row justify-center gap-2 border ${
                    isSuspended
                      ? "border-admin-accent bg-white"
                      : "border-admin-danger bg-white"
                  }`}
                  style={{ opacity: actioning !== null ? 0.6 : 1 }}
                >
                  <Feather
                    name={isSuspended ? "play" : "pause"}
                    size={14}
                    color={isSuspended ? "#0e7c4a" : "#c9382f"}
                  />
                  <Text
                    className={`font-plex-bold text-[13px] ${
                      isSuspended ? "text-admin-accent" : "text-admin-danger"
                    }`}
                  >
                    {actioning === "suspend"
                      ? "Suspending…"
                      : actioning === "unsuspend"
                        ? "Unsuspending…"
                        : isSuspended
                          ? "Unsuspend Chambers"
                          : "Suspend Chambers"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onDelete}
                  disabled={actioning !== null}
                  className="bg-admin-danger active:opacity-80 rounded-md py-3 items-center flex-row justify-center gap-2"
                  style={{ opacity: actioning !== null ? 0.6 : 1 }}
                >
                  <Feather name="trash-2" size={14} color="white" />
                  <Text className="font-plex-bold text-[13px] text-white">
                    {actioning === "delete" ? "Deleting…" : "Delete Chambers"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function TopBar({
  partnerName,
  status,
}: {
  partnerName: string;
  status: string;
}) {
  const router = useRouter();
  const map: Record<string, { bg: string; fg: string; dot: string }> = {
    active: { bg: "bg-admin-accent-soft", fg: "text-admin-accent", dot: "bg-admin-accent" },
    trial: { bg: "bg-admin-saffron-soft", fg: "text-admin-saffron", dot: "bg-admin-saffron" },
    cancelled: { bg: "bg-admin-danger-soft", fg: "text-admin-danger", dot: "bg-admin-danger" },
    suspended: { bg: "bg-admin-danger-soft", fg: "text-admin-danger", dot: "bg-admin-danger" },
  };
  const s = map[status] ?? map.trial;
  return (
    <View className="bg-admin-surface border-b border-admin-border">
      <View className="h-[2px] bg-admin-accent" />
      <View className="px-5 py-3.5 flex-row items-center justify-between">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="flex-row items-center gap-2 active:opacity-50 flex-1"
        >
          <Feather name="arrow-left" size={16} color="#0e1a1f" />
          <Text
            className="font-plex-medium text-[13px] text-admin-fg"
            numberOfLines={1}
          >
            {partnerName}
          </Text>
        </Pressable>
        <View
          className={`flex-row items-center gap-1.5 px-2 py-0.5 rounded-full ${s.bg}`}
        >
          <View className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          <Text
            className={`font-plex-mono-medium text-[9px] uppercase ${s.fg}`}
            style={{ letterSpacing: 1.2 }}
          >
            {status.replace("_", " ")}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-6 bg-admin-surface border border-admin-border rounded-lg p-5">
      <View className="border-b border-admin-border-soft pb-3 mb-4">
        <Text className="font-plex-bold text-[14px] text-admin-fg">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 font-plex text-[11px] text-admin-fg-muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="gap-3">{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  readOnly,
  hint,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <View>
      <Text
        className="font-plex-mono-medium text-[10px] uppercase text-admin-fg-muted"
        style={{ letterSpacing: 1.3 }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={readOnly ? undefined : onChangeText}
        editable={!readOnly}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        className={`mt-1.5 border rounded-md px-3 py-2.5 font-plex text-[14px] ${
          readOnly
            ? "bg-admin-bg border-admin-border text-admin-fg-muted"
            : "bg-admin-surface border-admin-border text-admin-fg"
        }`}
        style={readOnly ? { fontFamily: "PlexMono" } : undefined}
      />
      {hint ? (
        <Text className="mt-1 font-plex text-[10px] text-admin-fg-soft">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  show,
  onToggleShow,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder?: string;
}) {
  return (
    <View>
      <View className="flex-row items-baseline justify-between">
        <Text
          className="font-plex-mono-medium text-[10px] uppercase text-admin-fg-muted"
          style={{ letterSpacing: 1.3 }}
        >
          {label}
        </Text>
        <Pressable onPress={onToggleShow} hitSlop={6} className="active:opacity-50">
          <Text
            className="font-plex-mono-medium text-[9px] uppercase text-admin-fg-soft"
            style={{ letterSpacing: 1.5 }}
          >
            {show ? "Hide" : "Show"}
          </Text>
        </Pressable>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8a929e"
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        className="mt-1.5 bg-admin-surface border border-admin-border rounded-md px-3 py-2.5 font-plex text-[14px] text-admin-fg"
      />
    </View>
  );
}
