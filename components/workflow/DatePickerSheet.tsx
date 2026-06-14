import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  View,
  Text,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";

/**
 * Pure-JS month-grid date picker. We deliberately don't pull in
 * @react-native-community/datetimepicker because the native module
 * crashes on Expo Go in some builds (the plugin needs Continuous
 * Native Generation which not every dev builds with). This is a
 * minimal calendar with month nav + tap-to-pick + Today shortcut.
 *
 * Output is a JS Date set to UTC midnight of the chosen day so the
 * server's date-only field lands correctly regardless of TZ.
 */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function DatePickerSheet({
  visible,
  initial,
  onClose,
  onPick,
}: {
  visible: boolean;
  initial: Date | null;
  onClose: () => void;
  onPick: (d: Date | null) => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewYear, setViewYear] = useState<number>(
    initial?.getFullYear() ?? today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    initial?.getMonth() ?? today.getMonth()
  );

  // Build a 6-row grid (42 cells) starting from the Monday before
  // (or on) the 1st. Cells outside the current month are rendered
  // as muted text but still pickable.
  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const dow = (first.getDay() + 6) % 7; // Mon=0 .. Sun=6
    const start = new Date(viewYear, viewMonth, 1 - dow);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      out.push(d);
    }
    return out;
  }, [viewYear, viewMonth]);

  function step(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function pick(d: Date) {
    // Snap to UTC midnight so the server gets a clean date.
    const out = new Date(
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
    );
    onPick(out);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
      >
        <Pressable
          onPress={() => {
            /* swallow */
          }}
          className="rounded-t-3xl"
          style={{
            backgroundColor: "#ffffff",
            paddingTop: 8,
            paddingBottom: 24,
          }}
        >
          <View
            className="self-center mb-3 h-1.5 w-12 rounded-full"
            style={{ backgroundColor: "#e3d9c0" }}
          />

          {/* Month header with nav */}
          <View
            className="px-5 flex-row items-center"
            style={{ gap: 12 }}
          >
            <View className="flex-1">
              <Text
                className="text-[10px] uppercase text-app-copper-deep"
                style={{
                  fontFamily: "DMMono-Medium",
                  letterSpacing: 1.6,
                }}
              >
                Pick a date
              </Text>
              <Text
                className="text-[20px] tracking-tight text-app-ink"
                style={{ fontFamily: "Crimson-SemiBold" }}
              >
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
            </View>
            <Pressable
              onPress={() => step(-1)}
              hitSlop={8}
              className="active:opacity-50 h-9 w-9 items-center justify-center rounded-md"
              style={{ backgroundColor: "#efe5d0" }}
              accessibilityLabel="Previous month"
            >
              <Feather name="chevron-left" size={16} color="#0a1124" />
            </Pressable>
            <Pressable
              onPress={() => step(1)}
              hitSlop={8}
              className="active:opacity-50 h-9 w-9 items-center justify-center rounded-md"
              style={{ backgroundColor: "#efe5d0" }}
              accessibilityLabel="Next month"
            >
              <Feather name="chevron-right" size={16} color="#0a1124" />
            </Pressable>
          </View>

          {/* Weekday header */}
          <View className="px-5 mt-3 flex-row">
            {WEEKDAYS.map((w) => (
              <View
                key={w}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 4,
                }}
              >
                <Text
                  className="text-[10px] uppercase"
                  style={{
                    fontFamily: "DMMono-Medium",
                    letterSpacing: 1.4,
                    color: "#7a7060",
                  }}
                >
                  {w}
                </Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          <ScrollView
            style={{ maxHeight: 320 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 4,
              paddingBottom: 8,
            }}
          >
            <View className="flex-row flex-wrap">
              {cells.map((d) => {
                const inMonth = d.getMonth() === viewMonth;
                const isToday = d.getTime() === today.getTime();
                const isSelected =
                  initial !== null &&
                  d.getFullYear() === initial.getFullYear() &&
                  d.getMonth() === initial.getMonth() &&
                  d.getDate() === initial.getDate();
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => pick(d)}
                    style={{
                      width: `${100 / 7}%`,
                      paddingVertical: 6,
                      alignItems: "center",
                    }}
                    className="active:opacity-70"
                  >
                    <View
                      className="h-9 w-9 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? "#c5853a"
                          : isToday
                            ? "#efe5d0"
                            : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: isSelected
                            ? "Manrope-SemiBold"
                            : "Manrope",
                          fontSize: 14,
                          color: isSelected
                            ? "#2a1c08"
                            : inMonth
                              ? "#0a1124"
                              : "#a89c80",
                        }}
                      >
                        {d.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer */}
          <View
            className="px-5 mt-2 flex-row"
            style={{ gap: 8 }}
          >
            <Pressable
              onPress={() => onPick(null)}
              className="flex-1 rounded-md py-3 items-center active:opacity-50"
              style={{
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#e3d9c0",
              }}
              accessibilityLabel="Clear date"
            >
              <Text
                className="text-[13px]"
                style={{ fontFamily: "Manrope-Medium", color: "#4d4538" }}
              >
                Clear
              </Text>
            </Pressable>
            <Pressable
              onPress={() => pick(today)}
              className="flex-1 rounded-md py-3 items-center active:opacity-50"
              style={{
                backgroundColor: "#0a1124",
              }}
              accessibilityLabel="Pick today"
            >
              <Text
                className="text-[13px]"
                style={{
                  fontFamily: "Manrope-SemiBold",
                  color: "#f5ebd6",
                }}
              >
                Today
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
