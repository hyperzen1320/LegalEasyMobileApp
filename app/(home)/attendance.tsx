import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import Sheet from "../../components/Sheet";
import {
  ApiError,
  partnerGetAttendance,
  partnerMarkAttendance,
  type AttendanceMonth,
  type AttendanceStatus,
  type AttendanceUser,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

// The bound register — month nav, a day strip, and the roster for the
// selected day. Web shows a users × days grid; on a phone you pick the
// day first, then mark people. Marking is admin-only on the server (and
// this screen is admin-only, like the web nav). Future dates are
// rejected server-side; the strip greys them out.

const STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; fg: string; bg: string }
> = {
  present: { label: "Present", short: "P", fg: "#3a5a40", bg: "rgba(108,152,88,0.18)" },
  absent: { label: "Absent", short: "A", fg: "#c14a37", bg: "#f6dccd" },
  half_day: { label: "Half day", short: "½", fg: "#8a5821", bg: "rgba(197,133,58,0.2)" },
  leave: { label: "Leave", short: "L", fg: "#56a0a8", bg: "#d2e6e7" },
  holiday: { label: "Holiday", short: "H", fg: "#7a7060", bg: "#efe5d0" },
};

const STATUS_ORDER: AttendanceStatus[] = [
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Attendance() {
  const router = useRouter();
  const { isPartnerAdmin, status } = useAuth();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [data, setData] = useState<AttendanceMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(() => new Date().getDate());
  const [marking, setMarking] = useState<AttendanceUser | null>(null);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  // Person sheet tabs: quick-mark the selected day, or the whole month
  // as a colour-coded calendar with the running tallies.
  const [sheetTab, setSheetTab] = useState<"mark" | "month">("mark");

  useEffect(() => {
    if (marking) setSheetTab("mark");
  }, [marking]);

  useEffect(() => {
    if (status === "authenticated" && !isPartnerAdmin) router.back();
  }, [status, isPartnerAdmin, router]);

  const load = useCallback(async () => {
    try {
      const res = await partnerGetAttendance(month);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
    }
  }, [month]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const isCurrentMonth = month === monthKey(new Date());
  const maxDay = data ? (isCurrentMonth ? data.daysSoFar : data.totalDays) : 0;

  // Clamp the selected day when the month changes.
  useEffect(() => {
    if (!data) return;
    setDay((d) => Math.min(Math.max(1, d), Math.max(1, maxDay)));
  }, [data, maxDay]);

  function shiftMonth(dir: -1 | 1) {
    const [y, m] = month.split("-").map(Number);
    const next = new Date(y, m - 1 + dir, 1);
    // Never navigate into the future.
    if (next > new Date()) return;
    setMonth(monthKey(next));
    setDay(1);
  }

  // status-by-user for the selected day.
  const dayRecords = useMemo(() => {
    const map = new Map<string, { status: AttendanceStatus; note: string }>();
    if (!data) return map;
    for (const r of data.records) {
      const d = new Date(r.date);
      if (d.getDate() === day) {
        map.set(r.userId, { status: r.status, note: r.note });
      }
    }
    return map;
  }, [data, day]);

  const selectedDate = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, day);
  }, [month, day]);

  // Day-number → status for the person currently in the sheet.
  const markingMonthMap = useMemo(() => {
    const map = new Map<number, AttendanceStatus>();
    if (!data || !marking) return map;
    for (const r of data.records) {
      if (r.userId !== marking.id) continue;
      map.set(new Date(r.date).getDate(), r.status);
    }
    return map;
  }, [data, marking]);

  // Weekday of the 1st (0=Sun) for the calendar grid offset.
  const firstWeekday = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).getDay();
  }, [month]);

  async function mark(user: AttendanceUser, value: AttendanceStatus | "") {
    setSavingStatus(value === "" ? "clear" : value);
    try {
      await partnerMarkAttendance({
        userId: user.id,
        date: selectedDate.toISOString(),
        status: value,
      });
      await load();
      setMarking(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't mark");
      setMarking(null);
    } finally {
      setSavingStatus(null);
    }
  }

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }, [month]);

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
              The Register
            </Text>
            <Text
              className="text-[18px] tracking-tight text-app-ink leading-none mt-0.5"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Attendance
            </Text>
          </View>
          {/* Month nav */}
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() => shiftMonth(-1)}
              hitSlop={6}
              className="h-8 w-8 items-center justify-center rounded-md active:opacity-60"
              style={{ backgroundColor: "#ffffff" }}
              accessibilityLabel="Previous month"
            >
              <Feather name="chevron-left" size={15} color="#8a5821" />
            </Pressable>
            <Text
              className="text-[11px] text-app-ink"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 0.4 }}
            >
              {monthLabel}
            </Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              disabled={isCurrentMonth}
              hitSlop={6}
              className="h-8 w-8 items-center justify-center rounded-md active:opacity-60"
              style={{
                backgroundColor: "#ffffff",
                opacity: isCurrentMonth ? 0.35 : 1,
              }}
              accessibilityLabel="Next month"
            >
              <Feather name="chevron-right" size={15} color="#8a5821" />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="pb-12"
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
                className="mx-5 mt-4 rounded-md px-4 py-3"
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

            {data ? (
              <Animated.View entering={FadeInDown.duration(380)}>
                {/* Office summary */}
                <View className="px-5 pt-4">
                  <View
                    className="rounded-xl px-4 py-3.5 flex-row items-center justify-between"
                    style={{ backgroundColor: "#0a1124" }}
                  >
                    <View>
                      <Text
                        className="text-[9px] uppercase"
                        style={{
                          fontFamily: "DMMono-Medium",
                          letterSpacing: 1.6,
                          color: "#ddb074",
                        }}
                      >
                        Office attendance · {monthLabel}
                      </Text>
                      <Text
                        className="mt-1 text-[22px]"
                        style={{
                          fontFamily: "Crimson-SemiBold",
                          color: "#f5ebd6",
                        }}
                      >
                        {data.summary.office.avgAttendancePct}%
                      </Text>
                    </View>
                    <Text
                      className="text-[10px] text-right"
                      style={{
                        fontFamily: "DMMono",
                        letterSpacing: 0.4,
                        color: "#c4baa3",
                      }}
                    >
                      {data.summary.office.totalMarked} marked{"\n"}
                      {data.users.length}{" "}
                      {data.users.length === 1 ? "person" : "people"}
                    </Text>
                  </View>
                </View>

                {/* Day strip */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingTop: 16,
                    gap: 6,
                  }}
                >
                  {Array.from({ length: data.totalDays }, (_, i) => i + 1).map(
                    (d) => {
                      const selectable = d <= maxDay;
                      const on = d === day;
                      return (
                        <Pressable
                          key={d}
                          onPress={() => selectable && setDay(d)}
                          disabled={!selectable}
                          className="items-center justify-center rounded-lg active:opacity-80"
                          style={{
                            width: 38,
                            height: 44,
                            backgroundColor: on ? "#0a1124" : "#ffffff",
                            borderWidth: 1,
                            borderColor: on ? "#0a1124" : "#e3d9c0",
                            opacity: selectable ? 1 : 0.35,
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Day ${d}`}
                          accessibilityState={{ selected: on }}
                        >
                          <Text
                            className="text-[13px] tabular-nums"
                            style={{
                              fontFamily: "DMMono-Medium",
                              color: on ? "#f5ebd6" : "#0a1124",
                            }}
                          >
                            {d}
                          </Text>
                        </Pressable>
                      );
                    }
                  )}
                </ScrollView>

                {/* Roster for the selected day */}
                <View className="px-5 pt-4 gap-2.5">
                  {data.users.map((u) => {
                    const rec = dayRecords.get(u.id);
                    const meta = rec ? STATUS_META[rec.status] : null;
                    const summary = data.summary.perUser[u.id];
                    return (
                      <Pressable
                        key={u.id}
                        onPress={() => setMarking(u)}
                        className="rounded-xl bg-app-paper p-3.5 flex-row items-center gap-3 active:opacity-85"
                        style={{
                          shadowColor: "#0a1124",
                          shadowOpacity: 0.05,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 1 },
                          elevation: 1,
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Mark attendance for ${u.name}`}
                      >
                        <View
                          className="h-10 w-10 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#efe5d0" }}
                        >
                          <Text
                            className="text-[13px] uppercase"
                            style={{
                              fontFamily: "Crimson-SemiBold",
                              color: "#8a5821",
                            }}
                          >
                            {u.name
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((x) => x[0] || "")
                              .join("")}
                          </Text>
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text
                            className="text-[14px] text-app-ink"
                            style={{ fontFamily: "Manrope-SemiBold" }}
                            numberOfLines={1}
                          >
                            {u.name}
                            {u.isYou ? "  · you" : ""}
                          </Text>
                          {summary ? (
                            <Text
                              className="mt-0.5 text-[9.5px] text-app-fg-muted"
                              style={{
                                fontFamily: "DMMono",
                                letterSpacing: 0.5,
                              }}
                            >
                              P {summary.present} · A {summary.absent} · ½{" "}
                              {summary.halfDay} · L {summary.leave} ·{" "}
                              {summary.attendancePct}%
                            </Text>
                          ) : null}
                        </View>
                        {meta ? (
                          <View
                            className="rounded-md px-2.5 py-1"
                            style={{ backgroundColor: meta.bg }}
                          >
                            <Text
                              className="text-[10px] uppercase"
                              style={{
                                fontFamily: "DMMono-Medium",
                                letterSpacing: 1,
                                color: meta.fg,
                              }}
                            >
                              {meta.label}
                            </Text>
                          </View>
                        ) : (
                          <Text
                            className="text-[10px] uppercase"
                            style={{
                              fontFamily: "DMMono",
                              letterSpacing: 1,
                              color: "#c4baa3",
                            }}
                          >
                            unmarked
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Status picker + month card */}
      <Sheet
        visible={Boolean(marking)}
        onClose={savingStatus ? () => {} : () => setMarking(null)}
        eyebrow={
          sheetTab === "mark"
            ? selectedDate.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "2-digit",
                month: "short",
              })
            : monthLabel
        }
        title={marking?.name ?? ""}
        showClose={!savingStatus}
        containerStyle={{ maxHeight: "88%" }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
          {/* Tabs */}
          <View className="flex-row gap-2 mb-4">
            {(
              [
                { key: "mark", label: "Mark day" },
                { key: "month", label: "Month view" },
              ] as const
            ).map((t) => {
              const on = sheetTab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setSheetTab(t.key)}
                  className="flex-1 items-center rounded-lg py-2 active:opacity-85"
                  style={{
                    backgroundColor: on ? "#0a1124" : "#ffffff",
                    borderWidth: 1,
                    borderColor: on ? "#0a1124" : "#e3d9c0",
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text
                    className="text-[12px]"
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      color: on ? "#f5ebd6" : "#0a1124",
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {sheetTab === "month" && marking && data ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 460 }}
            >
              {/* Tallies */}
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {STATUS_ORDER.map((s) => {
                  const meta = STATUS_META[s];
                  const summary = data.summary.perUser[marking.id];
                  const value = summary
                    ? {
                        present: summary.present,
                        absent: summary.absent,
                        half_day: summary.halfDay,
                        leave: summary.leave,
                        holiday: summary.holiday,
                      }[s]
                    : 0;
                  return (
                    <View
                      key={s}
                      className="flex-row items-center gap-1.5 rounded-md px-2.5 py-1.5"
                      style={{ backgroundColor: meta.bg }}
                    >
                      <Text
                        style={{
                          fontFamily: "DMMono-Medium",
                          fontSize: 11,
                          color: meta.fg,
                        }}
                      >
                        {meta.short}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Manrope-SemiBold",
                          fontSize: 12,
                          color: meta.fg,
                        }}
                      >
                        {value}
                      </Text>
                    </View>
                  );
                })}
                <View
                  className="flex-row items-center rounded-md px-2.5 py-1.5"
                  style={{ backgroundColor: "#0a1124" }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      fontSize: 12,
                      color: "#f5ebd6",
                    }}
                  >
                    {data.summary.perUser[marking.id]?.attendancePct ?? 0}%
                  </Text>
                </View>
              </View>

              {/* Calendar */}
              <View className="mt-4 rounded-xl bg-app-paper p-3" style={{ borderWidth: 1, borderColor: "#e3d9c0" }}>
                <View className="flex-row">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <Text
                      key={`${d}-${i}`}
                      className="flex-1 text-center text-[9px] uppercase"
                      style={{
                        fontFamily: "DMMono-Medium",
                        letterSpacing: 1,
                        color: "#a89c80",
                      }}
                    >
                      {d}
                    </Text>
                  ))}
                </View>
                <View className="flex-row flex-wrap mt-1.5">
                  {Array.from({ length: firstWeekday }).map((_, i) => (
                    <View key={`pad-${i}`} style={{ width: "14.28%" }} />
                  ))}
                  {Array.from({ length: data.totalDays }, (_, i) => i + 1).map(
                    (d) => {
                      const status = markingMonthMap.get(d);
                      const meta = status ? STATUS_META[status] : null;
                      const selectable = d <= maxDay;
                      const isSelected = d === day;
                      return (
                        <View
                          key={d}
                          style={{ width: "14.28%", padding: 2.5 }}
                        >
                          <Pressable
                            onPress={() => {
                              if (!selectable) return;
                              setDay(d);
                              setSheetTab("mark");
                            }}
                            disabled={!selectable}
                            className="items-center justify-center rounded-lg active:opacity-75"
                            style={{
                              aspectRatio: 1,
                              backgroundColor: meta ? meta.bg : "#faf6ed",
                              borderWidth: isSelected ? 2 : 1,
                              borderColor: isSelected
                                ? "#0a1124"
                                : meta
                                  ? "transparent"
                                  : "#efe5d0",
                              opacity: selectable ? 1 : 0.35,
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Day ${d}${meta ? ` — ${meta.label}` : ""}`}
                          >
                            <Text
                              style={{
                                fontFamily: "DMMono-Medium",
                                fontSize: 12,
                                color: meta ? meta.fg : "#7a7060",
                              }}
                            >
                              {d}
                            </Text>
                            {meta ? (
                              <Text
                                style={{
                                  fontFamily: "DMMono-Medium",
                                  fontSize: 7.5,
                                  letterSpacing: 0.5,
                                  color: meta.fg,
                                  marginTop: 1,
                                }}
                              >
                                {meta.short}
                              </Text>
                            ) : null}
                          </Pressable>
                        </View>
                      );
                    }
                  )}
                </View>
                {/* Legend */}
                <View
                  className="flex-row flex-wrap mt-2.5 pt-2.5"
                  style={{
                    gap: 10,
                    borderTopWidth: 1,
                    borderTopColor: "#efe5d0",
                  }}
                >
                  {STATUS_ORDER.map((s) => {
                    const meta = STATUS_META[s];
                    return (
                      <View
                        key={s}
                        className="flex-row items-center"
                        style={{ gap: 4 }}
                      >
                        <View
                          style={{
                            height: 9,
                            width: 9,
                            borderRadius: 3,
                            backgroundColor: meta.bg,
                            borderWidth: 1,
                            borderColor: meta.fg,
                          }}
                        />
                        <Text
                          style={{
                            fontFamily: "Manrope",
                            fontSize: 10,
                            color: "#4d4538",
                          }}
                        >
                          {meta.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <Text
                className="mt-2.5 text-[11px] text-app-fg-muted"
                style={{ fontFamily: "Manrope" }}
              >
                Tap a day to mark it.
              </Text>
              <View style={{ height: 8 }} />
            </ScrollView>
          ) : null}

          <View
            className="gap-2.5"
            style={{ display: sheetTab === "mark" ? "flex" : "none" }}
          >
            {STATUS_ORDER.map((s) => {
              const meta = STATUS_META[s];
              const current =
                marking && dayRecords.get(marking.id)?.status === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => marking && mark(marking, s)}
                  disabled={savingStatus !== null}
                  className="flex-row items-center gap-3 rounded-xl px-4 active:opacity-85"
                  style={{
                    minHeight: 48,
                    backgroundColor: current ? meta.bg : "#ffffff",
                    borderWidth: 1,
                    borderColor: current ? meta.fg : "#e3d9c0",
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: Boolean(current) }}
                >
                  {savingStatus === s ? (
                    <ActivityIndicator size="small" color={meta.fg} />
                  ) : (
                    <View
                      className="h-6 w-6 items-center justify-center rounded-md"
                      style={{ backgroundColor: meta.bg }}
                    >
                      <Text
                        style={{
                          fontFamily: "DMMono-Medium",
                          fontSize: 11,
                          color: meta.fg,
                        }}
                      >
                        {meta.short}
                      </Text>
                    </View>
                  )}
                  <Text
                    className="text-[14px]"
                    style={{ fontFamily: "Manrope-SemiBold", color: "#0a1124" }}
                  >
                    {meta.label}
                  </Text>
                  {current ? (
                    <Feather
                      name="check"
                      size={15}
                      color={meta.fg}
                      style={{ marginLeft: "auto" }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
            {marking && dayRecords.get(marking.id) ? (
              <Pressable
                onPress={() => marking && mark(marking, "")}
                disabled={savingStatus !== null}
                className="flex-row items-center justify-center gap-2 rounded-xl px-4 active:opacity-85"
                style={{
                  minHeight: 44,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                  borderStyle: "dashed",
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear the mark"
              >
                {savingStatus === "clear" ? (
                  <ActivityIndicator size="small" color="#7a7060" />
                ) : (
                  <Feather name="x" size={13} color="#7a7060" />
                )}
                <Text
                  className="text-[12.5px]"
                  style={{ fontFamily: "Manrope-SemiBold", color: "#7a7060" }}
                >
                  Clear the mark
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ height: 16 }} />
        </View>
      </Sheet>
    </View>
  );
}
