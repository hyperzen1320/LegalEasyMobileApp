import { useCallback, useEffect, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  adminGetPlan,
  adminUpdatePlan,
  ApiError,
  type AdminPlan,
} from "../../../lib/api";

type BillingCycle = "trial" | "monthly" | "yearly" | "bespoke";

export default function PlanEdit() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<AdminPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [priceAmount, setPriceAmount] = useState("0");
  const [priceLabel, setPriceLabel] = useState("");
  const [priceSuffix, setPriceSuffix] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [features, setFeatures] = useState<string[]>([]);
  const [seatLimit, setSeatLimit] = useState("1");
  const [matterLimit, setMatterLimit] = useState("100");
  const [isPopular, setIsPopular] = useState(false);
  const [showOnLanding, setShowOnLanding] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [ctaLabel, setCtaLabel] = useState("");

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const data = await adminGetPlan(key);
      setPlan(data.plan);
      setLabel(data.plan.label);
      setTagline(data.plan.tagline);
      setDescription(data.plan.description);
      setPriceAmount(String(data.plan.priceAmount));
      setPriceLabel(data.plan.priceLabel);
      setPriceSuffix(data.plan.priceSuffix);
      setBillingCycle(data.plan.billingCycle);
      setFeatures(data.plan.features);
      setSeatLimit(String(data.plan.seatLimit));
      setMatterLimit(String(data.plan.matterLimit));
      setIsPopular(data.plan.isPopular);
      setShowOnLanding(data.plan.showOnLanding);
      setIsActive(data.plan.isActive);
      setSortOrder(String(data.plan.sortOrder));
      setCtaLabel(data.plan.ctaLabel);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [key]);

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

  function updateFeature(i: number, v: string) {
    setFeatures((f) => f.map((x, idx) => (idx === i ? v : x)));
  }

  function addFeature() {
    setFeatures((f) => [...f, ""]);
  }

  function removeFeature(i: number) {
    setFeatures((f) => f.filter((_, idx) => idx !== i));
  }

  function moveFeature(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= features.length) return;
    setFeatures((f) => {
      const next = [...f];
      const [m] = next.splice(i, 1);
      next.splice(target, 0, m);
      return next;
    });
  }

  async function onSave() {
    if (!key) return;
    setError(null);
    setSaving(true);
    try {
      await adminUpdatePlan(key, {
        label,
        tagline,
        description,
        priceAmount: Number(priceAmount) || 0,
        priceLabel,
        priceSuffix,
        billingCycle,
        features: features.map((f) => f.trim()).filter(Boolean),
        seatLimit: Number(seatLimit) || 0,
        matterLimit: Number(matterLimit) || 0,
        isPopular,
        showOnLanding,
        isActive,
        sortOrder: Number(sortOrder) || 0,
        ctaLabel,
      });
      flash("Saved");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-admin-bg items-center justify-center">
        <ActivityIndicator color="#0e7c4a" size="large" />
      </View>
    );
  }
  if (!plan) {
    return (
      <View className="flex-1 bg-admin-bg items-center justify-center px-5">
        <Text className="font-plex text-[14px] text-admin-fg-muted text-center">
          {error ?? "Plan not found"}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-admin-bg">
      <StatusBar style="dark" backgroundColor="#fafaf7" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar planLabel={plan.label} planKey={plan.key} />
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
                  {savedNote} · landing page refreshed
                </Text>
              </View>
            ) : null}
            {error ? (
              <View className="mb-4 rounded-md border border-admin-danger/30 bg-admin-danger-soft px-4 py-3">
                <Text className="font-plex text-[13px] text-admin-fg">
                  {error}
                </Text>
              </View>
            ) : null}

            {/* Identity */}
            <Section title="Identity" subtitle="Headline label and short tagline.">
              <Field label="Plan Label" value={label} onChangeText={setLabel} required />
              <Field label="Tagline" value={tagline} onChangeText={setTagline} hint="Single line shown under the plan name on the landing card." />
              <Field label="Description" value={description} onChangeText={setDescription} multiline hint="Longer text — shown when picking this plan in partner-create." />
            </Section>

            {/* Pricing */}
            <Section
              title="Pricing"
              subtitle="Display price is what users see. priceAmount is for analytics."
            >
              <Field
                label="Price (₹) — internal"
                value={priceAmount}
                onChangeText={setPriceAmount}
                keyboardType="number-pad"
                hint="Plain number for analytics."
              />
              <Field
                label="Display Price"
                value={priceLabel}
                onChangeText={setPriceLabel}
                hint='Free-form: "₹1,499", "Bespoke", "Free"'
              />
              <Field
                label="Display Suffix"
                value={priceSuffix}
                onChangeText={setPriceSuffix}
                hint='"/ mo", "· time-limited", or empty.'
              />
              <View>
                <Text
                  className="font-plex-mono-medium text-[10px] uppercase text-admin-fg-muted mb-2"
                  style={{ letterSpacing: 1.3 }}
                >
                  Billing cycle
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {(["trial", "monthly", "yearly", "bespoke"] as BillingCycle[]).map(
                    (b) => (
                      <Pressable
                        key={b}
                        onPress={() => setBillingCycle(b)}
                        className={`px-3 py-2 rounded-md border-2 ${
                          billingCycle === b
                            ? "border-admin-accent bg-admin-accent-soft"
                            : "border-admin-border bg-admin-surface"
                        }`}
                      >
                        <Text
                          className={`font-plex-mono-medium text-[10px] uppercase ${
                            billingCycle === b
                              ? "text-admin-accent"
                              : "text-admin-fg-muted"
                          }`}
                          style={{ letterSpacing: 1.3 }}
                        >
                          {b}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              </View>
            </Section>

            {/* Limits */}
            <Section title="Limits" subtitle="Use 999999 for effectively unlimited.">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field
                    label="Seat Limit"
                    value={seatLimit}
                    onChangeText={setSeatLimit}
                    keyboardType="number-pad"
                  />
                </View>
                <View className="flex-1">
                  <Field
                    label="Matter Limit"
                    value={matterLimit}
                    onChangeText={setMatterLimit}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </Section>

            {/* Features */}
            <Section
              title="Features"
              subtitle="Bullets shown on the landing page plan card."
            >
              <View className="gap-2">
                {features.map((f, i) => (
                  <View
                    key={i}
                    className="flex-row items-center gap-2 rounded-md border border-admin-border bg-admin-bg/40 px-2 py-1.5"
                  >
                    <View>
                      <Pressable
                        onPress={() => moveFeature(i, -1)}
                        disabled={i === 0}
                        className="active:opacity-50"
                        hitSlop={4}
                        style={{ opacity: i === 0 ? 0.3 : 1 }}
                      >
                        <Feather name="chevron-up" size={14} color="#5a6470" />
                      </Pressable>
                      <Pressable
                        onPress={() => moveFeature(i, 1)}
                        disabled={i === features.length - 1}
                        className="active:opacity-50"
                        hitSlop={4}
                        style={{
                          opacity: i === features.length - 1 ? 0.3 : 1,
                        }}
                      >
                        <Feather name="chevron-down" size={14} color="#5a6470" />
                      </Pressable>
                    </View>
                    <Text
                      className="font-plex-mono-medium text-[10px] tabular-nums text-admin-fg-soft w-6 text-right"
                      style={{ letterSpacing: 0.5 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </Text>
                    <TextInput
                      value={f}
                      onChangeText={(v) => updateFeature(i, v)}
                      placeholder="Feature line"
                      placeholderTextColor="#8a929e"
                      className="flex-1 bg-transparent px-1.5 py-1.5 font-plex text-[13px] text-admin-fg"
                    />
                    <Pressable
                      onPress={() => removeFeature(i)}
                      className="active:opacity-50 px-2 py-1"
                      hitSlop={6}
                    >
                      <Feather name="x" size={14} color="#8a929e" />
                    </Pressable>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={addFeature}
                className="mt-2 flex-row items-center gap-2 self-start rounded-md border border-dashed border-admin-border-soft px-3 py-2 active:opacity-50"
              >
                <Feather name="plus" size={12} color="#5a6470" />
                <Text className="font-plex-medium text-[12px] text-admin-fg-muted">
                  Add feature
                </Text>
              </Pressable>
            </Section>

            {/* Display */}
            <Section title="Display" subtitle="Where this plan appears.">
              <View className="gap-2">
                <Toggle
                  label="Most popular"
                  hint="Highlights this plan on the landing page."
                  value={isPopular}
                  onChange={setIsPopular}
                />
                <Toggle
                  label="Show on landing"
                  hint="Public marketing visibility."
                  value={showOnLanding}
                  onChange={setShowOnLanding}
                />
                <Toggle
                  label="Active"
                  hint="Inactive plans don't appear anywhere."
                  value={isActive}
                  onChange={setIsActive}
                />
              </View>
              <Field
                label="CTA button text"
                value={ctaLabel}
                onChangeText={setCtaLabel}
                hint='e.g. "Begin practice", "Set up office"'
              />
              <Field
                label="Sort order"
                value={sortOrder}
                onChangeText={setSortOrder}
                keyboardType="number-pad"
                hint="Lower numbers appear first."
              />
            </Section>

            {/* Save */}
            <View className="mt-6 flex-row gap-3">
              <Pressable
                onPress={() => router.back()}
                className="flex-1 border border-admin-border bg-admin-surface active:bg-admin-bg rounded-md py-3.5 items-center"
              >
                <Text className="font-plex-medium text-[13px] text-admin-fg-muted">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={onSave}
                disabled={saving}
                className="flex-1 bg-admin-accent active:bg-admin-accent-hover rounded-md py-3.5 items-center flex-row justify-center gap-2"
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Text className="font-plex-bold text-[13px] text-white">
                      Save
                    </Text>
                    <Feather name="check" size={14} color="white" />
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function TopBar({ planLabel, planKey }: { planLabel: string; planKey: string }) {
  const router = useRouter();
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
          <View>
            <Text className="font-plex-medium text-[13px] text-admin-fg" numberOfLines={1}>
              {planLabel}
            </Text>
            <Text
              className="font-plex-mono text-[10px] text-admin-fg-soft"
              style={{ letterSpacing: 0.5 }}
            >
              /{planKey}
            </Text>
          </View>
        </Pressable>
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
      <View className="gap-4">{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
  required,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "number-pad";
  multiline?: boolean;
  required?: boolean;
  hint?: string;
}) {
  return (
    <View>
      <Text
        className="font-plex-mono-medium text-[10px] uppercase text-admin-fg-muted"
        style={{ letterSpacing: 1.3 }}
      >
        {label}
        {required ? <Text className="text-admin-accent">  *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCorrect={false}
        className="mt-1.5 bg-admin-surface border border-admin-border rounded-md px-3 py-2.5 font-plex text-[14px] text-admin-fg"
        style={multiline ? { textAlignVertical: "top", minHeight: 70 } : undefined}
      />
      {hint ? (
        <Text className="mt-1 font-plex text-[10px] text-admin-fg-soft">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      className={`rounded-md border-2 px-4 py-3 ${
        value
          ? "border-admin-accent bg-admin-accent-soft"
          : "border-admin-border bg-admin-surface"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="font-plex-bold text-[13px] text-admin-fg">{label}</Text>
          {hint ? (
            <Text className="mt-0.5 font-plex text-[11px] text-admin-fg-muted">
              {hint}
            </Text>
          ) : null}
        </View>
        <View
          className={`relative h-5 w-9 rounded-full ${
            value ? "bg-admin-accent" : "bg-admin-border"
          }`}
        >
          <View
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white"
            style={{ left: value ? 18 : 2 }}
          />
        </View>
      </View>
    </Pressable>
  );
}
