import { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { partnerCreatePrompt, ApiError } from "../../../lib/api";

export default function NewPrompt() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Custom");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  async function save() {
    setError(null);
    if (!title.trim()) {
      setMissing(true);
      setError("Title is required.");
      return;
    }
    setMissing(false);
    setSaving(true);
    try {
      await partnerCreatePrompt({ title, body, category });
      router.replace("/(home)/ai");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
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
            New Template
          </Text>
        </View>

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
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              The Junior
            </Text>
            <Text
              className="mt-1.5 text-[28px] font-semibold tracking-tight leading-tight text-app-ink"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              New Template
            </Text>
            <Text
              className="mt-2 text-[13px] leading-[20px] text-app-fg-muted"
              style={{ fontFamily: "Manrope" }}
            >
              Use placeholders like [Plaintiff Name], [Court Name], [Section]
              for fields the AI should fill from your case.
            </Text>

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
                <View>
                  <Text
                    className="text-[10px] font-semibold uppercase text-app-fg-muted"
                    style={{
                      fontFamily: "DMMono-Medium",
                      letterSpacing: 1.6,
                    }}
                  >
                    Title <Text style={{ color: "#c5853a" }}>{"  *"}</Text>
                  </Text>
                  <TextInput
                    value={title}
                    onChangeText={(v) => {
                      setTitle(v);
                      if (missing && v.trim()) setMissing(false);
                    }}
                    placeholder="Draft an interim application under Order XXXIX..."
                    placeholderTextColor="#a89c80"
                    autoCapitalize="sentences"
                    autoCorrect={false}
                    className="mt-1.5 rounded-md border bg-app-paper px-3.5 py-3 text-[15px] text-app-ink"
                    style={{
                      fontFamily: "Manrope",
                      borderColor: missing ? "#c14a37" : "#e3d9c0",
                    }}
                  />
                </View>

                <View>
                  <Text
                    className="text-[10px] font-semibold uppercase text-app-fg-muted"
                    style={{
                      fontFamily: "DMMono-Medium",
                      letterSpacing: 1.6,
                    }}
                  >
                    Category
                  </Text>
                  <TextInput
                    value={category}
                    onChangeText={setCategory}
                    placeholder="Pleadings / Notices / Custom"
                    placeholderTextColor="#a89c80"
                    autoCorrect={false}
                    className="mt-1.5 rounded-md border bg-app-paper px-3.5 py-3 text-[15px] text-app-ink"
                    style={{
                      fontFamily: "Manrope",
                      borderColor: "#e3d9c0",
                    }}
                  />
                </View>

                <View>
                  <Text
                    className="text-[10px] font-semibold uppercase text-app-fg-muted"
                    style={{
                      fontFamily: "DMMono-Medium",
                      letterSpacing: 1.6,
                    }}
                  >
                    Template body
                  </Text>
                  <TextInput
                    value={body}
                    onChangeText={setBody}
                    placeholder={
                      "Paste the prompt template here. Include structure, statutory references, drafting notes — everything the AI needs to follow."
                    }
                    placeholderTextColor="#a89c80"
                    multiline
                    textAlignVertical="top"
                    className="mt-1.5 rounded-md border bg-app-canvas px-3 py-2.5 text-[13px] text-app-ink"
                    style={{
                      fontFamily: "Manrope",
                      borderColor: "#e3d9c0",
                      minHeight: 240,
                      lineHeight: 20,
                    }}
                  />
                </View>
              </View>
            </View>

            {error ? (
              <View
                className="mt-4 rounded-md px-4 py-3"
                style={{ backgroundColor: "#f6dccd" }}
              >
                <Text
                  className="text-[12px]"
                  style={{ fontFamily: "Manrope", color: "#c14a37" }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row gap-3">
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
                onPress={save}
                disabled={saving}
                className="flex-[1.4] rounded-md py-3.5 items-center flex-row justify-center gap-2"
                style={{
                  backgroundColor: "#c5853a",
                  opacity: saving ? 0.6 : 1,
                  shadowColor: "#c5853a",
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 5,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#2a1c08" size="small" />
                ) : (
                  <Text
                    className="text-[13px] font-semibold"
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      color: "#2a1c08",
                    }}
                  >
                    Save Template
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
