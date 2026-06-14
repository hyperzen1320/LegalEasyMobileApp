import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  ApiError,
  deleteRequestRequired,
  partnerDeleteClient,
  partnerListClients,
  partnerUpdateClient,
  type DeleteRequestRequiredError,
  type PartnerClient,
} from "../../../lib/api";
import { Field } from "../../../components/CaseFields";
import RequestDeleteSheet from "../../../components/workflow/RequestDeleteSheet";

// Client profile — view + edit + remove. There's no GET-by-id endpoint
// (the list carries every field), so the screen loads the list and picks
// its client out; cheap for an office-sized book of clients and always
// fresh after edits elsewhere.

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const clientId = String(id);

  const [client, setClient] = useState<PartnerClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");

  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [requestTarget, setRequestTarget] =
    useState<DeleteRequestRequiredError | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await partnerListClients();
      const found = res.clients.find((c) => c.id === clientId) ?? null;
      setClient(found);
      if (found) {
        setName(found.name);
        setEmail(found.email || "");
        setPhone(found.phone || "");
        setWhatsapp(found.whatsapp || "");
        setAddress(found.address || "");
        setError(null);
      } else {
        setError("Client not found — it may have been removed.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load client");
    }
  }, [clientId]);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function save() {
    if (!client || busy) return;
    if (!name.trim()) {
      setSaveError("Client name can't be empty.");
      return;
    }
    setBusy("save");
    setSaveError(null);
    try {
      const res = await partnerUpdateClient(client.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        address: address.trim(),
      });
      setClient((prev) => (prev ? { ...prev, ...res.client } : prev));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : "Couldn't save. Try again."
      );
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    if (!client || busy) return;
    Alert.alert(
      "Remove this client?",
      client.caseCount > 0
        ? `${client.name} is on ${client.caseCount} ${client.caseCount === 1 ? "matter" : "matters"} — those keep their client details.`
        : `${client.name} will be removed from the Client Crew.`,
      [
        { text: "Keep them", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void doDelete() },
      ]
    );
  }

  async function doDelete() {
    if (!client) return;
    setBusy("delete");
    try {
      await partnerDeleteClient(client.id);
      router.back();
    } catch (err) {
      const reqd = deleteRequestRequired(err);
      if (reqd) {
        setRequestTarget(reqd);
      } else {
        setSaveError(
          err instanceof ApiError ? err.message : "Couldn't delete. Try again."
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Top bar */}
        <View
          className="border-b border-app-edge bg-app-canvas px-4 py-3 flex-row items-center"
          style={{ gap: 10 }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            className="active:opacity-50 h-9 w-9 items-center justify-center rounded-md"
            style={{ backgroundColor: "#ffffff" }}
            accessibilityLabel="Back"
          >
            <Feather name="arrow-left" size={17} color="#0a1124" />
          </Pressable>
          <View className="flex-1">
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              Client Crew
            </Text>
            <Text
              className="text-[18px] tracking-tight text-app-ink leading-none mt-0.5"
              style={{ fontFamily: "Crimson-SemiBold" }}
              numberOfLines={1}
            >
              {client?.name ?? "…"}
            </Text>
          </View>
          {client && client.caseCount > 0 ? (
            <View
              className="rounded-md px-2 py-1"
              style={{ backgroundColor: "#d2e6e7" }}
            >
              <Text
                className="text-[10px] uppercase tabular-nums"
                style={{
                  fontFamily: "DMMono-Medium",
                  letterSpacing: 1.2,
                  color: "#56a0a8",
                }}
              >
                {client.caseCount} {client.caseCount === 1 ? "case" : "cases"}
              </Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : error || !client ? (
          <View className="flex-1 items-center justify-center px-8">
            <Feather name="alert-circle" size={28} color="#c14a37" />
            <Text
              className="mt-3 text-[14px] text-app-fg-soft text-center"
              style={{ fontFamily: "Manrope" }}
            >
              {error ?? "Client not found"}
            </Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1"
          >
            <ScrollView
              contentContainerClassName="px-5 pt-5 pb-12 sm:max-w-[560px] sm:self-center sm:w-full"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {saveError ? (
                <Animated.View
                  entering={FadeInDown.duration(250)}
                  className="rounded-md px-4 py-3 mb-4"
                  style={{ backgroundColor: "#f6dccd" }}
                >
                  <Text
                    className="text-[13px]"
                    style={{ fontFamily: "Manrope", color: "#c14a37" }}
                  >
                    {saveError}
                  </Text>
                </Animated.View>
              ) : null}
              {savedFlash ? (
                <Animated.View
                  entering={FadeInDown.duration(250)}
                  className="rounded-md px-4 py-3 mb-4"
                  style={{ backgroundColor: "rgba(108,152,88,0.14)" }}
                >
                  <Text
                    className="text-[13px]"
                    style={{ fontFamily: "Manrope", color: "#3a5a40" }}
                  >
                    Saved.
                  </Text>
                </Animated.View>
              ) : null}

              <Field
                label="Full name"
                value={name}
                onChangeText={setName}
                placeholder="Client name"
                required
              />
              <View className="mt-3">
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="client@email.in"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <View className="mt-3 flex-row gap-3">
                <View className="flex-1">
                  <Field
                    label="Phone"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="98765 43210"
                    keyboardType="phone-pad"
                  />
                </View>
                <View className="flex-1">
                  <Field
                    label="WhatsApp"
                    value={whatsapp}
                    onChangeText={setWhatsapp}
                    placeholder="98765 43210"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
              <View className="mt-3">
                <Field
                  label="Address"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Street, town, district"
                  multiline
                />
              </View>

              <Pressable
                onPress={save}
                disabled={busy !== null}
                className="mt-6 rounded-xl items-center justify-center flex-row gap-2 active:opacity-90"
                style={{
                  backgroundColor: "#0a1124",
                  paddingVertical: 14,
                  shadowColor: "#0a1124",
                  shadowOpacity: 0.22,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                }}
                accessibilityRole="button"
                accessibilityLabel="Save client"
              >
                {busy === "save" ? (
                  <ActivityIndicator size="small" color="#f5ebd6" />
                ) : (
                  <Feather name="check" size={15} color="#f5ebd6" />
                )}
                <Text
                  className="text-[13.5px]"
                  style={{ fontFamily: "Manrope-SemiBold", color: "#f5ebd6" }}
                >
                  {busy === "save" ? "Saving…" : "Save changes"}
                </Text>
              </Pressable>

              <Pressable
                onPress={confirmDelete}
                disabled={busy !== null}
                className="mt-3 rounded-xl items-center justify-center flex-row gap-2 active:opacity-85"
                style={{
                  minHeight: 46,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "rgba(193,74,55,0.35)",
                }}
                accessibilityRole="button"
                accessibilityLabel="Remove client"
              >
                {busy === "delete" ? (
                  <ActivityIndicator size="small" color="#c14a37" />
                ) : (
                  <Feather name="trash-2" size={14} color="#c14a37" />
                )}
                <Text
                  className="text-[13px]"
                  style={{ fontFamily: "Manrope-SemiBold", color: "#c14a37" }}
                >
                  Remove from Client Crew
                </Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

      <RequestDeleteSheet
        target={requestTarget}
        onClose={() => setRequestTarget(null)}
        onSubmitted={() => {
          setRequestTarget(null);
          Alert.alert("Sent for review", "The office admin has been notified.");
        }}
      />
    </View>
  );
}
