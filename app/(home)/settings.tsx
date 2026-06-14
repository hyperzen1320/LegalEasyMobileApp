import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  ApiError,
  partnerGetSettings,
  partnerUpdateSettings,
  type OfficeSettings,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

// Office settings — currently one lever: how long the activity ledger is
// kept (forever / 365 / 90 days). Admin-only, like the web.

const RETENTION_OPTIONS: {
  value: OfficeSettings["activityRetentionDays"];
  label: string;
  hint: string;
}[] = [
  {
    value: null,
    label: "Keep forever",
    hint: "The full ledger, never pruned.",
  },
  {
    value: 365,
    label: "One year",
    hint: "Entries older than 365 days are pruned.",
  },
  {
    value: 90,
    label: "Ninety days",
    hint: "A rolling quarter of history.",
  },
];

export default function OfficeSettingsScreen() {
  const router = useRouter();
  const { isPartnerAdmin, status } = useAuth();
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingValue, setSavingValue] = useState<
    OfficeSettings["activityRetentionDays"] | "none"
  >("none");

  useEffect(() => {
    if (status === "authenticated" && !isPartnerAdmin) router.back();
  }, [status, isPartnerAdmin, router]);

  const load = useCallback(async () => {
    try {
      const res = await partnerGetSettings();
      setSettings(res.settings);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function pick(value: OfficeSettings["activityRetentionDays"]) {
    if (!settings || savingValue !== "none") return;
    if (settings.activityRetentionDays === value) return;
    setSavingValue(value);
    setError(null);
    try {
      const res = await partnerUpdateSettings({
        activityRetentionDays: value,
      });
      setSettings(res.settings);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't save. Try again."
      );
    } finally {
      setSavingValue("none");
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
              Chambers
            </Text>
            <Text
              className="text-[18px] tracking-tight text-app-ink leading-none mt-0.5"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Office Settings
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerClassName="px-5 pt-5 pb-10 sm:max-w-[560px] sm:self-center sm:w-full"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View
              className="rounded-md px-4 py-3 mb-4"
              style={{ backgroundColor: "#f6dccd" }}
            >
              <Text
                className="text-[13px]"
                style={{ fontFamily: "Manrope", color: "#c14a37" }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {settings === null && !error ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#c5853a" size="large" />
            </View>
          ) : settings ? (
            <Animated.View entering={FadeInDown.duration(380)}>
              <Text
                className="text-[10px] uppercase text-app-copper-deep mb-1"
                style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
              >
                Activity ledger
              </Text>
              <Text
                className="text-[13px] leading-[20px] text-app-fg-soft mb-3.5"
                style={{ fontFamily: "Manrope" }}
              >
                How long the office keeps its audit trail. Pruning runs on
                the server and can't be undone.
              </Text>

              <View
                className="rounded-2xl bg-app-paper overflow-hidden"
                style={{
                  shadowColor: "#0a1124",
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                }}
              >
                {RETENTION_OPTIONS.map((opt, i) => {
                  const selected =
                    settings.activityRetentionDays === opt.value;
                  const saving = savingValue === opt.value;
                  return (
                    <Pressable
                      key={String(opt.value)}
                      onPress={() => pick(opt.value)}
                      className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
                      style={{
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: "#efe5d0",
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <View className="flex-1">
                        <Text
                          className="text-[14px] text-app-ink"
                          style={{ fontFamily: "Manrope-SemiBold" }}
                        >
                          {opt.label}
                        </Text>
                        <Text
                          className="mt-0.5 text-[11px] text-app-fg-muted"
                          style={{ fontFamily: "Manrope" }}
                        >
                          {opt.hint}
                        </Text>
                      </View>
                      {saving ? (
                        <ActivityIndicator size="small" color="#8a5821" />
                      ) : (
                        <Feather
                          name={selected ? "check-circle" : "circle"}
                          size={17}
                          color={selected ? "#6c9858" : "#c4baa3"}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
