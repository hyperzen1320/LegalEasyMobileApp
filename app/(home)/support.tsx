import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";

// Support hub reachable from the bottom of the More menu: a quick tutorial plus
// an issue-report form that opens the device mail app to the support address
// with the advocate's name, company, phone and the issue pre-filled.
const SUPPORT_EMAIL = "ksnagendhran@gmail.com";

const TUTORIAL: { icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
  {
    icon: "calendar",
    title: "Hearing Track",
    body: "Today / Tomorrow / Pending tabs. Tap Update to set the next date and stage; tap a CNR to copy it and open eCourts.",
  },
  {
    icon: "briefcase",
    title: "Case Vault",
    body: "Every matter, searchable by file no., case no., CNR or party. Open a case for the full dossier, documents and disposal.",
  },
  {
    icon: "message-square",
    title: "Senior Desk",
    body: "Office chat — private and group. Share files and images; tap an image to view it full-screen, then Share from the top bar.",
  },
  {
    icon: "layout",
    title: "Work Flow",
    body: "Trello-style boards for office processes. Open a board to move cards and track each matter's progress.",
  },
];

export default function Support() {
  const router = useRouter();
  const { user, partner } = useAuth();

  const [name, setName] = useState(
    `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
  );
  const [company, setCompany] = useState(partner?.name ?? "");
  const [phone, setPhone] = useState("");
  const [issue, setIssue] = useState("");

  function sendIssue() {
    if (!issue.trim()) {
      Alert.alert(
        "Describe the issue",
        "Tell us what went wrong so we can help."
      );
      return;
    }
    const body =
      `Name: ${name || "—"}\n` +
      `Company: ${company || "—"}\n` +
      `Phone: ${phone || "—"}\n\n` +
      `Issue:\n${issue.trim()}\n`;
    const url =
      `mailto:${SUPPORT_EMAIL}` +
      `?subject=${encodeURIComponent(`Legalezi support — ${name || "issue"}`)}` +
      `&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert(
        "No mail app",
        `Email us at ${SUPPORT_EMAIL} with your name, company, phone and the issue.`
      )
    );
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
          <View>
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              Help &amp; Support
            </Text>
            <Text
              className="text-[18px] tracking-tight text-app-ink leading-none"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Support
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerClassName="px-5 pt-5 pb-10"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Quick tutorial */}
            <Text
              className="text-[11px] uppercase mb-2.5"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 1.8,
                color: "#8a5821",
              }}
            >
              Quick tutorial
            </Text>
            <View className="gap-3">
              {TUTORIAL.map((t) => (
                <View
                  key={t.title}
                  className="rounded-2xl bg-app-paper p-4 flex-row gap-3"
                  style={{
                    shadowColor: "#0a1124",
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }}
                >
                  <View
                    className="h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "#efe5d0" }}
                  >
                    <Feather name={t.icon} size={16} color="#8a5821" />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-[14px] text-app-ink"
                      style={{ fontFamily: "Crimson-SemiBold" }}
                    >
                      {t.title}
                    </Text>
                    <Text
                      className="mt-1 text-[12.5px] text-app-fg-soft"
                      style={{ fontFamily: "Manrope", lineHeight: 18 }}
                    >
                      {t.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Report an issue */}
            <Text
              className="text-[11px] uppercase mt-7 mb-2.5"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 1.8,
                color: "#8a5821",
              }}
            >
              Report an issue
            </Text>
            <View
              className="rounded-2xl bg-app-paper p-5"
              style={{
                gap: 16,
                shadowColor: "#0a1124",
                shadowOpacity: 0.04,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              }}
            >
              <SupportField
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
              />
              <SupportField
                label="Company name"
                value={company}
                onChangeText={setCompany}
                placeholder="Your office / firm"
              />
              <SupportField
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="Contact number"
                keyboardType="phone-pad"
              />
              <SupportField
                label="Issue"
                value={issue}
                onChangeText={setIssue}
                placeholder="What went wrong? Steps, the screen, anything that helps."
                multiline
              />

              <Pressable
                onPress={sendIssue}
                className="rounded-xl items-center justify-center flex-row gap-2 active:opacity-90"
                style={{
                  backgroundColor: "#c5853a",
                  paddingVertical: 14,
                  shadowColor: "#c5853a",
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 3,
                }}
                accessibilityRole="button"
                accessibilityLabel="Send issue report by email"
              >
                <Feather name="mail" size={15} color="#2a1c08" />
                <Text
                  className="text-[13.5px]"
                  style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
                >
                  Send to support
                </Text>
              </Pressable>
              <Text
                className="text-[11px] text-app-fg-muted text-center"
                style={{ fontFamily: "Manrope" }}
              >
                Opens your mail app to {SUPPORT_EMAIL}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function SupportField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad";
}) {
  return (
    <View>
      <Text
        className="text-[11px] uppercase mb-1.5"
        style={{
          fontFamily: "DMMono-Medium",
          letterSpacing: 1.2,
          color: "#8a5821",
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a89c80"
        multiline={multiline}
        keyboardType={keyboardType}
        className="rounded-xl text-[14px] text-app-ink"
        style={{
          fontFamily: "Manrope",
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 11,
          minHeight: multiline ? 104 : undefined,
          textAlignVertical: multiline ? "top" : "center",
          backgroundColor: "#faf6ee",
          borderWidth: 1,
          borderColor: "#e3d9c0",
        }}
      />
    </View>
  );
}
