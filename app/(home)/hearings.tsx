import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather, FontAwesome } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  partnerListHearings,
  partnerUpdateCase,
  ApiError,
  type HearingBucket,
  type PartnerHearingItem,
} from "../../lib/api";
import { DateField, SheetField } from "../../components/CaseFields";

const SEGMENTS: { key: HearingBucket; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "pending", label: "Pending" },
];

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

export default function Hearings() {
  const [bucket, setBucket] = useState<HearingBucket>("today");
  const [items, setItems] = useState<PartnerHearingItem[]>([]);
  const [counts, setCounts] = useState({ today: 0, tomorrow: 0, pending: 0 });
  const [officeName, setOfficeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (b: HearingBucket) => {
      try {
        const data = await partnerListHearings(b);
        setItems(data.items);
        setCounts(data.counts);
        setOfficeName(data.officeName);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      await load(bucket);
      setLoading(false);
    })();
  }, [bucket, load]);

  useFocusEffect(
    useCallback(() => {
      load(bucket);
    }, [bucket, load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(bucket);
    setRefreshing(false);
  }, [bucket, load]);

  function changeBucket(next: HearingBucket) {
    if (next === bucket) return;
    setLoading(true);
    setBucket(next);
  }

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar />
        <Segmented bucket={bucket} onChange={changeBucket} counts={counts} />

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="px-5 pt-4 pb-6"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#c5853a"
              />
            }
          >
            {error ? (
              <View
                className="rounded-md px-4 py-3 mb-4"
                style={{
                  backgroundColor: "#f6dccd",
                  borderWidth: 1,
                  borderColor: "rgba(193,74,55,0.3)",
                }}
              >
                <Text
                  className="text-[13px]"
                  style={{ fontFamily: "Manrope", color: "#c14a37" }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {items.length === 0 ? (
              <Empty bucket={bucket} />
            ) : bucket === "pending" ? (
              <View className="gap-4">
                {items.map((c, i) => (
                  <Animated.View
                    key={c.id}
                    entering={FadeInDown.duration(380).delay(
                      Math.min(i, 10) * 35
                    )}
                  >
                    <PendingCard
                      c={c}
                      officeName={officeName}
                      onUpdated={() => load(bucket)}
                    />
                  </Animated.View>
                ))}
              </View>
            ) : (
              <View className="gap-3">
                {items.map((c, i) => (
                  <Animated.View
                    key={c.id}
                    entering={FadeInDown.duration(380).delay(
                      Math.min(i, 10) * 35
                    )}
                  >
                    <ScheduledRow
                      c={c}
                      bucket={bucket}
                      officeName={officeName}
                    />
                  </Animated.View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

/* ─── Top bar ─── */

function TopBar() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5">
      <Text
        className="text-[10px] uppercase text-app-copper-deep"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
      >
        The Diary · {today}
      </Text>
      <Text
        className="mt-0.5 text-[18px] font-semibold tracking-tight text-app-ink leading-none"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        Hearing Track
      </Text>
    </View>
  );
}

/* ─── Segmented ─── */

function Segmented({
  bucket,
  onChange,
  counts,
}: {
  bucket: HearingBucket;
  onChange: (s: HearingBucket) => void;
  counts: { today: number; tomorrow: number; pending: number };
}) {
  return (
    <View className="border-b border-app-edge-soft bg-app-canvas px-5 py-3">
      <View
        className="flex-row rounded-lg p-1"
        style={{ backgroundColor: "rgba(10,17,36,0.05)" }}
      >
        {SEGMENTS.map((s) => {
          const isActive = bucket === s.key;
          const count = counts[s.key];
          return (
            <Pressable
              key={s.key}
              onPress={() => onChange(s.key)}
              className="flex-1 rounded-md py-2 items-center active:opacity-90 flex-row justify-center gap-1.5"
              style={{
                backgroundColor: isActive ? "#0a1124" : "transparent",
              }}
            >
              <Text
                className="text-[12px] font-semibold"
                style={{
                  fontFamily: "Manrope-SemiBold",
                  color: isActive ? "#f5ebd6" : "#4d4538",
                }}
              >
                {s.label}
              </Text>
              {count > 0 ? (
                <View
                  className="rounded-full px-1.5"
                  style={{
                    backgroundColor: isActive
                      ? "#c5853a"
                      : "rgba(10,17,36,0.08)",
                    minWidth: 20,
                    alignItems: "center",
                  }}
                >
                  <Text
                    className="text-[10px] tabular-nums"
                    style={{
                      fontFamily: "DMMono-Medium",
                      color: isActive ? "#2a1c08" : "#7a7060",
                    }}
                  >
                    {count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Today/Tomorrow row ─── */

function ScheduledRow({
  c,
  bucket,
  officeName,
}: {
  c: PartnerHearingItem;
  bucket: HearingBucket;
  officeName: string;
}) {
  const router = useRouter();
  const courtLine = [c.courtName, c.courtPlace].filter(Boolean).join(", ");
  const hasPhone = Boolean(c.clientPhone || c.clientWhatsapp);
  const hasWa = Boolean(c.clientWhatsapp || c.clientPhone);

  function openCase() {
    router.push(`/(home)/cases/${c.id}` as never);
  }

  return (
    <View
      className="rounded-2xl bg-app-paper p-4"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
        borderLeftWidth: 3,
        borderLeftColor: "#c5853a",
      }}
    >
      <Pressable onPress={openCase} className="active:opacity-70">
        <View className="flex-row items-baseline gap-2 flex-wrap">
          <Text
            className="text-[18px] font-semibold tracking-tight text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
          >
            {c.caseNo}
          </Text>
          {c.status ? (
            <View
              className="rounded-md px-1.5 py-0.5"
              style={{ backgroundColor: "#d2e6e7" }}
            >
              <Text
                className="text-[9px] uppercase"
                style={{
                  fontFamily: "DMMono-Medium",
                  letterSpacing: 1.2,
                  color: "#56a0a8",
                }}
              >
                {c.status}
              </Text>
            </View>
          ) : null}
        </View>
        {(c.clientName || courtLine) ? (
          <Text
            className="mt-1.5 text-[13px]"
            style={{ fontFamily: "Manrope", color: "#4d4538" }}
            numberOfLines={2}
          >
            {c.clientName ? (
              <Text
                style={{ fontFamily: "Manrope-SemiBold", color: "#0a1124" }}
              >
                {c.clientName}
              </Text>
            ) : null}
            {c.clientName && courtLine ? (
              <Text style={{ color: "#8a5821" }}>{"  ·  "}</Text>
            ) : null}
            {courtLine ? (
              <Text style={{ color: "#7a7060" }}>{courtLine}</Text>
            ) : null}
          </Text>
        ) : null}
      </Pressable>

      {/* Action row */}
      <View className="mt-3.5 flex-row items-center gap-2">
        <CallButton c={c} hasNumber={hasPhone} />
        <WhatsAppButton
          c={c}
          bucket={bucket}
          officeName={officeName}
          hasNumber={hasWa}
        />
        <Pressable
          onPress={openCase}
          className="ml-auto rounded-md flex-row items-center gap-1.5 px-4 py-2 active:opacity-90"
          style={{
            backgroundColor: "#c5853a",
            shadowColor: "#c5853a",
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
          }}
        >
          <Text
            className="text-[12px] font-semibold"
            style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
          >
            Open
          </Text>
          <Feather name="chevron-right" size={13} color="#2a1c08" />
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Pending card ─── */

function PendingCard({
  c,
  officeName,
  onUpdated,
}: {
  c: PartnerHearingItem;
  officeName: string;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [status, setStatus] = useState(c.status || "Filed");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const hasPhone = Boolean(c.clientPhone || c.clientWhatsapp);
  const hasWa = Boolean(c.clientWhatsapp || c.clientPhone);

  async function update() {
    setError(null);
    if (!date) {
      setError("Please pick a next hearing date.");
      return;
    }
    setSaving(true);
    try {
      await partnerUpdateCase(c.id, {
        nextHearingDate: date,
        status,
      });
      setSavedFlash(true);
      setTimeout(() => onUpdated(), 350);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      className="rounded-2xl bg-app-paper p-5"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
        opacity: savedFlash ? 0.55 : 1,
      }}
    >
      {/* Title row */}
      <View className="flex-row items-start gap-3">
        <Pressable
          onPress={() => router.push(`/(home)/cases/${c.id}` as never)}
          className="flex-1 active:opacity-70"
        >
          <Text
            className="text-[22px] font-semibold tracking-tight text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
          >
            {c.caseNo}
          </Text>
          {(c.clientName || c.cnr) ? (
            <Text
              className="mt-1 text-[12px]"
              style={{ fontFamily: "Manrope", color: "#4d4538" }}
              numberOfLines={2}
            >
              {c.clientName ? (
                <Text
                  style={{
                    fontFamily: "Manrope-SemiBold",
                    color: "#0a1124",
                  }}
                >
                  {c.clientName}
                </Text>
              ) : null}
              {c.clientName && c.cnr ? (
                <Text style={{ color: "#8a5821" }}>{"  ·  "}</Text>
              ) : null}
              {c.cnr ? (
                <Text
                  style={{ fontFamily: "DMMono", color: "#7a7060" }}
                >
                  CNR {c.cnr}
                </Text>
              ) : null}
            </Text>
          ) : null}
          {c.lastHearingDate ? (
            <Text
              className="mt-1 text-[11px]"
              style={{
                fontFamily: "DMMono",
                color: "#7a7060",
                letterSpacing: 0.4,
              }}
            >
              Last date:{" "}
              <Text style={{ color: "#0a1124", fontFamily: "DMMono-Medium" }}>
                {c.lastHearingDate.slice(0, 10)}
              </Text>
            </Text>
          ) : null}
        </Pressable>
        <View
          className="rounded-md px-2 py-1"
          style={{ backgroundColor: "#c5853a" }}
        >
          <Text
            className="text-[9px] font-semibold uppercase"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.5,
              color: "#2a1c08",
            }}
          >
            Pending date
          </Text>
        </View>
      </View>

      {/* Update form */}
      <View className="mt-4 gap-3">
        <DateField
          label="Next hearing"
          value={date}
          onChange={setDate}
        />
        <SheetField
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
        />
        {error ? (
          <Text
            className="text-[12px]"
            style={{ fontFamily: "Manrope", color: "#c14a37" }}
          >
            {error}
          </Text>
        ) : null}
        <Pressable
          onPress={update}
          disabled={saving}
          className="rounded-md py-3 items-center justify-center flex-row gap-2"
          style={{
            backgroundColor: "#c5853a",
            opacity: saving ? 0.6 : 1,
            shadowColor: "#c5853a",
            shadowOpacity: 0.3,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#2a1c08" size="small" />
          ) : (
            <Text
              className="text-[13px] font-semibold"
              style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
            >
              {savedFlash ? "Updated ✓" : "Update"}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Contact buttons */}
      <View className="mt-4 flex-row gap-2">
        <CallPill c={c} hasNumber={hasPhone} />
        <WhatsAppPill
          c={c}
          bucket="pending"
          officeName={officeName}
          hasNumber={hasWa}
        />
      </View>
    </View>
  );
}

/* ─── Buttons ─── */

function CallButton({
  c,
  hasNumber,
}: {
  c: PartnerHearingItem;
  hasNumber: boolean;
}) {
  return (
    <Pressable
      onPress={() => callClient(c, hasNumber)}
      className="h-10 w-10 rounded-full items-center justify-center active:opacity-80"
      style={{
        backgroundColor: hasNumber ? "#0a1124" : "#a89c80",
        shadowColor: hasNumber ? "#0a1124" : "transparent",
        shadowOpacity: hasNumber ? 0.25 : 0,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: hasNumber ? 3 : 0,
      }}
    >
      <Feather name="phone" size={17} color="#f5ebd6" />
    </Pressable>
  );
}

function WhatsAppButton({
  c,
  bucket,
  officeName,
  hasNumber,
}: {
  c: PartnerHearingItem;
  bucket: HearingBucket;
  officeName: string;
  hasNumber: boolean;
}) {
  return (
    <Pressable
      onPress={() => openWhatsApp(c, bucket, officeName, hasNumber)}
      className="h-10 w-10 rounded-full items-center justify-center active:opacity-80"
      style={{
        backgroundColor: hasNumber ? "#1faa4f" : "#9bbfa8",
        shadowColor: hasNumber ? "#1faa4f" : "transparent",
        shadowOpacity: hasNumber ? 0.35 : 0,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: hasNumber ? 4 : 0,
      }}
    >
      <FontAwesome name="whatsapp" size={18} color="#ffffff" />
    </Pressable>
  );
}

function CallPill({
  c,
  hasNumber,
}: {
  c: PartnerHearingItem;
  hasNumber: boolean;
}) {
  return (
    <Pressable
      onPress={() => callClient(c, hasNumber)}
      className="flex-1 rounded-md py-2.5 items-center justify-center flex-row gap-2 active:opacity-80"
      style={{
        backgroundColor: hasNumber ? "#0a1124" : "#a89c80",
        shadowColor: hasNumber ? "#0a1124" : "transparent",
        shadowOpacity: hasNumber ? 0.18 : 0,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: hasNumber ? 3 : 0,
      }}
    >
      <Feather name="phone" size={14} color="#f5ebd6" />
      <Text
        className="text-[12px] font-semibold"
        style={{ fontFamily: "Manrope-SemiBold", color: "#f5ebd6" }}
      >
        Call
      </Text>
    </Pressable>
  );
}

function WhatsAppPill({
  c,
  bucket,
  officeName,
  hasNumber,
}: {
  c: PartnerHearingItem;
  bucket: HearingBucket;
  officeName: string;
  hasNumber: boolean;
}) {
  return (
    <Pressable
      onPress={() => openWhatsApp(c, bucket, officeName, hasNumber)}
      className="flex-1 rounded-md py-2.5 items-center justify-center flex-row gap-2 active:opacity-80"
      style={{
        backgroundColor: hasNumber ? "#1faa4f" : "#9bbfa8",
        shadowColor: hasNumber ? "#1faa4f" : "transparent",
        shadowOpacity: hasNumber ? 0.3 : 0,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: hasNumber ? 4 : 0,
      }}
    >
      <FontAwesome name="whatsapp" size={15} color="#ffffff" />
      <Text
        className="text-[12px] font-semibold"
        style={{ fontFamily: "Manrope-SemiBold", color: "#ffffff" }}
      >
        WhatsApp
      </Text>
    </Pressable>
  );
}

/* ─── Actions ─── */

async function callClient(c: PartnerHearingItem, hasNumber: boolean) {
  if (!hasNumber) {
    Alert.alert(
      "No phone number on file",
      "Add a phone or WhatsApp number on this case, or in Client Crew."
    );
    return;
  }
  const target = (c.clientPhone || c.clientWhatsapp).replace(/\s+/g, "");
  const url = `tel:${target}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Can't make calls from this device.");
    }
  } catch {
    Alert.alert("Couldn't open the dialer.");
  }
}

async function openWhatsApp(
  c: PartnerHearingItem,
  bucket: HearingBucket,
  officeName: string,
  hasNumber: boolean
) {
  if (!hasNumber) {
    Alert.alert(
      "No WhatsApp number on file",
      "Add a WhatsApp or phone number on this case, or in Client Crew."
    );
    return;
  }
  const raw = (c.clientWhatsapp || c.clientPhone).replace(/\D/g, "");
  if (!raw) return;
  const wa = raw.length === 10 ? `91${raw}` : raw;

  const dateStr =
    bucket === "today"
      ? "today"
      : bucket === "tomorrow"
        ? "tomorrow"
        : c.nextHearingDate
          ? new Date(c.nextHearingDate).toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "the date communicated separately";

  const venue =
    [c.courtName, c.courtPlace].filter(Boolean).join(", ") ||
    "the Hon'ble Court";
  const office = officeName || "this office";
  const matter = c.oppositeParty
    ? `${c.clientName || "you"} vs ${c.oppositeParty}`
    : c.caseNo;

  const text = [
    `Dear Mr./Ms. ${c.clientName || "Client"},`,
    ``,
    `Warm greetings from ${office}.`,
    ``,
    `This is to formally apprise you that the next hearing in your matter ${c.caseNo}` +
      (c.oppositeParty ? ` (${matter})` : ``) +
      ` is scheduled ${dateStr} before the ${venue}.`,
    ``,
    `You are kindly requested to ensure your presence on the said date and time, accompanied by all relevant documents previously discussed, so as to enable us to proceed with your matter without procedural complication.`,
    ``,
    `For any clarification or to revisit the brief prior to the hearing, please feel free to contact our office at your convenience.`,
    ``,
    `Thank you for your continued cooperation and trust.`,
    ``,
    `Regards,`,
    office,
  ].join("\n");

  const native = `whatsapp://send?phone=${wa}&text=${encodeURIComponent(text)}`;
  const fallback = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  try {
    const can = await Linking.canOpenURL(native);
    if (can) {
      await Linking.openURL(native);
    } else {
      await Linking.openURL(fallback);
    }
  } catch {
    try {
      await Linking.openURL(fallback);
    } catch {
      Alert.alert("Couldn't open WhatsApp.");
    }
  }
}

/* ─── Empty ─── */

function Empty({ bucket }: { bucket: HearingBucket }) {
  const messages: Record<HearingBucket, { title: string; body: string }> = {
    today: {
      title: "Nothing on the cause-list today.",
      body: "When a matter has its next hearing date set to today, it will surface here.",
    },
    tomorrow: {
      title: "Tomorrow looks clear.",
      body: "No matters listed for tomorrow yet — a quiet day to plan ahead.",
    },
    pending: {
      title: "No pending dates.",
      body: "Every matter in the vault has its next hearing date set. Well kept.",
    },
  };
  const m = messages[bucket];

  return (
    <View className="items-center pt-12">
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "#efe5d0" }}
      >
        <Feather name="calendar" size={20} color="#8a5821" />
      </View>
      <Text
        className="mt-4 text-[20px] font-semibold tracking-tight text-app-ink text-center"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        {m.title}
      </Text>
      <Text
        className="mt-1.5 text-[12px] text-app-fg-muted text-center max-w-[280px]"
        style={{ fontFamily: "Manrope" }}
      >
        {m.body}
      </Text>
    </View>
  );
}
