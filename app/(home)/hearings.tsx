import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Feather, FontAwesome } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  partnerListHearings,
  partnerUpdateCase,
  partnerGetNoticeTemplate,
  ApiError,
  type HearingBucket,
  type PartnerHearingItem,
} from "../../lib/api";
import {
  renderNotice,
  parseDateLocal,
  type NoticeData,
} from "../../lib/notice-template";
import { DateField, SheetField } from "../../components/CaseFields";
import Sheet from "../../components/Sheet";
import { useAuth } from "../../lib/auth-context";
import ExportSheet from "../../components/ExportSheet";
import {
  HEARING_EXPORT_BUCKETS,
  exportHearings,
  type HearingExportBucket,
} from "../../lib/exports";

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
  const { isPartnerAdmin } = useAuth();
  const [bucket, setBucket] = useState<HearingBucket>("today");
  // Dashboard stat tiles deep-link straight into a bucket
  // (/(home)/hearings?bucket=tomorrow).
  const { bucket: bucketParam } = useLocalSearchParams<{ bucket?: string }>();
  useEffect(() => {
    if (
      (bucketParam === "today" ||
        bucketParam === "tomorrow" ||
        bucketParam === "pending") &&
      bucketParam !== bucket
    ) {
      setLoading(true);
      setBucket(bucketParam);
    }
    // Only react to the param — `bucket` changing via the segmented
    // control must not re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketParam]);
  const [items, setItems] = useState<PartnerHearingItem[]>([]);
  const [counts, setCounts] = useState({ today: 0, tomorrow: 0, pending: 0 });
  const [officeName, setOfficeName] = useState("");
  const [template, setTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Export sheet state — the export bucket starts from whatever tab the
  // user is on but can be changed in the sheet (incl. "All", which only
  // exists server-side on the export endpoint).
  const [exporting, setExporting] = useState(false);
  const [exportBucket, setExportBucket] =
    useState<HearingExportBucket>("today");
  // Court-wise grouping (the cause-list reading order) + the compact
  // update sheet for scheduled rows.
  const [groupByCourt, setGroupByCourt] = useState(false);
  const [updating, setUpdating] = useState<PartnerHearingItem | null>(null);

  const courtGroups = useMemo(() => {
    const map = new Map<string, PartnerHearingItem[]>();
    for (const c of items) {
      const key =
        [c.courtName, c.courtPlace].filter(Boolean).join(", ") ||
        "Court not set";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, groupItems]) => ({ title, items: groupItems }));
  }, [items]);

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

  // The office's WhatsApp notice template — fetched once; the WhatsApp button
  // fills it per matter. Falls back to the bilingual default if absent.
  useEffect(() => {
    partnerGetNoticeTemplate()
      .then((r) => setTemplate(r.template))
      .catch(() => {});
  }, []);

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
        <TopBar
          onExport={
            isPartnerAdmin
              ? () => {
                  setExportBucket(bucket);
                  setExporting(true);
                }
              : null
          }
        />
        <Segmented bucket={bucket} onChange={changeBucket} counts={counts} />

        {bucket !== "pending" && items.length > 0 && !loading ? (
          <View className="px-5 pt-3 flex-row justify-end">
            <Pressable
              onPress={() => setGroupByCourt((v) => !v)}
              hitSlop={6}
              className="flex-row items-center gap-1.5 rounded-full px-3 active:opacity-75"
              style={{
                paddingVertical: 5,
                backgroundColor: groupByCourt ? "#0a1124" : "#ffffff",
                borderWidth: 1,
                borderColor: groupByCourt ? "#0a1124" : "#e3d9c0",
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: groupByCourt }}
              accessibilityLabel="Group by court"
            >
              <Feather
                name="layers"
                size={12}
                color={groupByCourt ? "#ddb074" : "#8a5821"}
              />
              <Text
                className="text-[11px]"
                style={{
                  fontFamily: "Manrope-SemiBold",
                  color: groupByCourt ? "#f5ebd6" : "#4d4538",
                }}
              >
                By court
              </Text>
            </Pressable>
          </View>
        ) : null}

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
                      template={template}
                      onUpdated={() => load(bucket)}
                    />
                  </Animated.View>
                ))}
              </View>
            ) : groupByCourt ? (
              <View className="gap-5">
                {courtGroups.map((group) => (
                  <Animated.View
                    key={group.title}
                    entering={FadeInDown.duration(380)}
                  >
                    {/* Court-wise cause list — the order a clerk reads it */}
                    <View className="flex-row items-center gap-2.5 mb-2.5">
                      <View className="h-px flex-1 bg-app-edge" />
                      <Text
                        className="text-[10px] uppercase text-app-copper-deep"
                        style={{
                          fontFamily: "DMMono-Medium",
                          letterSpacing: 1.6,
                        }}
                        numberOfLines={1}
                      >
                        {group.title} · {group.items.length}
                      </Text>
                      <View className="h-px flex-1 bg-app-edge" />
                    </View>
                    <View className="gap-3">
                      {group.items.map((c) => (
                        <ScheduledRow
                          key={c.id}
                          c={c}
                          bucket={bucket}
                          officeName={officeName}
                          template={template}
                          onUpdate={() => setUpdating(c)}
                        />
                      ))}
                    </View>
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
                      template={template}
                      onUpdate={() => setUpdating(c)}
                    />
                  </Animated.View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <ExportSheet
        visible={exporting}
        onClose={() => setExporting(false)}
        eyebrow="Hearing Track"
        title="Export the cause list"
        contextLine={`Today ${counts.today} · Tomorrow ${counts.tomorrow} · Pending ${counts.pending}`}
        run={(format) => exportHearings(format, exportBucket)}
      >
        <Text
          className="text-[10px] uppercase text-app-copper-deep mb-2"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          Hearings
        </Text>
        <View className="flex-row gap-2 mb-5">
          {HEARING_EXPORT_BUCKETS.map((b) => {
            const active = b.key === exportBucket;
            return (
              <Pressable
                key={b.key}
                onPress={() => setExportBucket(b.key)}
                className="flex-1 items-center rounded-lg py-2 active:opacity-85"
                style={{
                  backgroundColor: active ? "#0a1124" : "#ffffff",
                  borderWidth: 1,
                  borderColor: active ? "#0a1124" : "#e3d9c0",
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text
                  className="text-[12px]"
                  style={{
                    fontFamily: "Manrope-SemiBold",
                    color: active ? "#f5ebd6" : "#0a1124",
                  }}
                >
                  {b.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ExportSheet>

      <UpdateHearingSheet
        item={updating}
        onClose={() => setUpdating(null)}
        onSaved={() => {
          setUpdating(null);
          load(bucket);
        }}
      />
    </View>
  );
}

/* ─── Quick update (scheduled rows) ─── */

function UpdateHearingSheet({
  item,
  onClose,
  onSaved,
}: {
  item: PartnerHearingItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("Filed");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setDate(item.nextHearingDate ? item.nextHearingDate.slice(0, 10) : "");
      setStatus(item.status || "Filed");
      setError(null);
      setSaving(false);
    }
  }, [item]);

  async function save() {
    if (!item || saving) return;
    setSaving(true);
    setError(null);
    try {
      await partnerUpdateCase(item.id, {
        // Clearing the date is allowed — the matter moves to Pending.
        nextHearingDate: date || null,
        status,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={Boolean(item)}
      onClose={saving ? () => {} : onClose}
      eyebrow="Hearing Track"
      title={item?.caseNo ?? ""}
      showClose={!saving}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        {error ? (
          <View
            className="rounded-md px-3.5 py-2.5 mb-3"
            style={{ backgroundColor: "#f6dccd" }}
          >
            <Text
              className="text-[12.5px]"
              style={{ fontFamily: "Manrope", color: "#c14a37" }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        <DateField label="Next hearing date" value={date} onChange={setDate} />
        <View className="mt-3">
          <SheetField
            label="Status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
        </View>
        <Text
          className="mt-2 text-[11px] text-app-fg-muted"
          style={{ fontFamily: "Manrope" }}
        >
          Leave the date empty to move the matter to Pending.
        </Text>

        <Pressable
          onPress={save}
          disabled={saving}
          className="mt-5 rounded-xl items-center justify-center flex-row gap-2 active:opacity-90"
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
          accessibilityLabel="Save hearing update"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#f5ebd6" />
          ) : (
            <Feather name="check" size={15} color="#f5ebd6" />
          )}
          <Text
            className="text-[13.5px]"
            style={{ fontFamily: "Manrope-SemiBold", color: "#f5ebd6" }}
          >
            {saving ? "Saving…" : "Save update"}
          </Text>
        </Pressable>
        <View style={{ height: 16 }} />
      </View>
    </Sheet>
  );
}

/* ─── Top bar ─── */

function TopBar({ onExport }: { onExport?: (() => void) | null }) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center justify-between">
      <View>
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
      {onExport ? (
        <Pressable
          onPress={onExport}
          hitSlop={6}
          className="rounded-md items-center justify-center active:opacity-70"
          style={{
            height: 36,
            width: 36,
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: "#e3d9c0",
          }}
          accessibilityRole="button"
          accessibilityLabel="Export cause list"
        >
          <Feather name="download" size={15} color="#8a5821" />
        </Pressable>
      ) : null}
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
  template,
  onUpdate,
}: {
  c: PartnerHearingItem;
  bucket: HearingBucket;
  officeName: string;
  template: string;
  onUpdate: () => void;
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
          template={template}
          hasNumber={hasWa}
        />
        <Pressable
          onPress={onUpdate}
          hitSlop={4}
          className="rounded-md items-center justify-center active:opacity-80"
          style={{
            height: 34,
            width: 34,
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: "#e3d9c0",
          }}
          accessibilityRole="button"
          accessibilityLabel={`Update hearing for ${c.caseNo}`}
        >
          <Feather name="edit-2" size={13} color="#8a5821" />
        </Pressable>
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
  template,
  onUpdated,
}: {
  c: PartnerHearingItem;
  officeName: string;
  template: string;
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
          template={template}
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
  template,
  hasNumber,
}: {
  c: PartnerHearingItem;
  bucket: HearingBucket;
  officeName: string;
  template: string;
  hasNumber: boolean;
}) {
  return (
    <Pressable
      onPress={() => openWhatsApp(c, bucket, officeName, template, hasNumber)}
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
  template,
  hasNumber,
}: {
  c: PartnerHearingItem;
  bucket: HearingBucket;
  officeName: string;
  template: string;
  hasNumber: boolean;
}) {
  return (
    <Pressable
      onPress={() => openWhatsApp(c, bucket, officeName, template, hasNumber)}
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
  template: string,
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

  // The wording comes from the office's editable bilingual template, filled
  // with this matter's details (My Profile → Pre-filled WhatsApp message).
  const data: NoticeData = {
    caseNo: c.caseNo || "",
    clientName: c.clientName || "",
    cnr: c.cnr || "",
    fileNo: c.fileNo || "",
    status: c.status || "",
    oppositeParty: c.oppositeParty || "",
    courtName: c.courtName || "",
    courtPlace: c.courtPlace || "",
    lastHearingDate: parseDateLocal(c.lastHearingDate),
    nextHearingDate: parseDateLocal(c.nextHearingDate),
    officeName: officeName || "",
  };
  const text = renderNotice(template, data);

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
