import { useState } from "react";
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
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  partnerCreateClient,
  ApiError,
  type PartnerClientInput,
} from "../../../lib/api";
import { Field } from "../../../components/CaseFields";

export default function NewClient() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  async function onSubmit() {
    setError(null);
    if (!name.trim()) {
      setMissing(true);
      setError("Client name is required.");
      return;
    }
    setMissing(false);
    setSubmitting(true);
    try {
      const payload: PartnerClientInput = {
        name,
        email,
        whatsapp,
        phone,
        address,
      };
      await partnerCreateClient(payload);
      router.replace("/(home)/clients");
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
            contentContainerClassName="px-5 pt-5 pb-12 sm:max-w-[560px] sm:self-center sm:w-full"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View>
              <Text
                className="text-[10px] uppercase text-app-copper-deep"
                style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
              >
                New on the crew
              </Text>
              <Text
                className="mt-1.5 text-[28px] font-semibold tracking-tight leading-tight text-app-ink"
                style={{ fontFamily: "Crimson-SemiBold" }}
              >
                Add a Client
              </Text>
              <Text
                className="mt-2 text-[13px] leading-[20px] text-app-fg-muted"
                style={{ fontFamily: "Manrope" }}
              >
                Just the basics — name and how to reach them. Cases linked to
                this client will roll up here automatically.
              </Text>
            </View>

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
              <View className="gap-4">
                <Field
                  label="Name"
                  required
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    if (missing && v.trim()) setMissing(false);
                  }}
                  placeholder="R. Murugan"
                  autoCapitalize="words"
                  invalid={missing}
                />
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="client@example.com"
                  keyboardType="email-address"
                />
                <Field
                  label="WhatsApp"
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  placeholder="+91..."
                  keyboardType="phone-pad"
                />
                <Field
                  label="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+91..."
                  keyboardType="phone-pad"
                />
                <Field
                  label="Address"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="12, North Mada St, Mylapore, Chennai"
                  autoCapitalize="sentences"
                  multiline
                />
              </View>
            </View>

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
                    Save Client
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
        hitSlop={10}
        className="active:opacity-50"
      >
        <Feather name="arrow-left" size={18} color="#0a1124" />
      </Pressable>
      <Text
        className="text-[14px] font-semibold text-app-ink"
        style={{ fontFamily: "Manrope-SemiBold" }}
      >
        Client Crew
      </Text>
    </View>
  );
}
