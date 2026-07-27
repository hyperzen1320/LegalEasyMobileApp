import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Sheet from "../Sheet";
import { compareCourts } from "../../lib/court-order";
import type { PartnerCourt, PartnerHearingItem } from "../../lib/api";

// Narrow the cause-list to one court.
//
// Hearing rows carry courtName + courtPlace but no courtId, so the options
// are built from the courts the LOADED bucket actually references and
// matched on that same "Name, Place" key the by-court grouping already
// uses. Two consequences worth having: every row in the list is reachable,
// and a court with nothing listed today never appears as a dead option.
//
// Numbering and order come from lib/court-order — the same comparator
// Court Hub and the Case Vault filter use — so the serial numbers read
// identically wherever an advocate looks.

export const ALL_COURTS = "__all__";

/** The grouping key shared with the by-court view. */
export function courtKeyOf(c: {
  courtName: string;
  courtPlace: string;
}): string {
  return (
    [c.courtName, c.courtPlace].filter(Boolean).join(", ") || "Court not set"
  );
}

export type CourtOption = {
  key: string;
  /** Court number as entered ("3", "Hall 3"); empty when unnumbered. */
  number: string;
  name: string;
  place: string;
  count: number;
};

/**
 * Options for the courts present in `items`, ordered like Court Hub.
 * `courts` supplies the numbers; a court in the list but not in the
 * roster still shows (unnumbered) rather than vanishing.
 */
export function buildCourtOptions(
  items: PartnerHearingItem[],
  courts: PartnerCourt[]
): CourtOption[] {
  const numberByKey = new Map<string, string>();
  for (const c of courts) {
    numberByKey.set(
      [c.name, c.place].filter(Boolean).join(", "),
      c.number ?? ""
    );
  }

  const seen = new Map<string, CourtOption>();
  for (const it of items) {
    const key = courtKeyOf(it);
    const hit = seen.get(key);
    if (hit) {
      hit.count += 1;
      continue;
    }
    seen.set(key, {
      key,
      number: numberByKey.get(key) ?? "",
      name: it.courtName || "Court not set",
      place: it.courtPlace || "",
      count: 1,
    });
  }

  return Array.from(seen.values()).sort((a, b) =>
    compareCourts(
      { name: a.name, number: a.number },
      { name: b.name, number: b.number }
    )
  );
}

export default function CourtFilter({
  options,
  selected,
  onSelect,
  total,
}: {
  options: CourtOption[];
  selected: string;
  onSelect: (key: string) => void;
  total: number;
}) {
  const [open, setOpen] = useState(false);

  const active = useMemo(
    () => options.find((o) => o.key === selected),
    [options, selected]
  );
  const isFiltered = selected !== ALL_COURTS && Boolean(active);

  // One court in the whole bucket — a filter would be decoration.
  if (options.length < 2) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        className="flex-row items-center gap-1.5 rounded-full px-3 active:opacity-75"
        style={{
          paddingVertical: 5,
          backgroundColor: isFiltered ? "#0a1124" : "#ffffff",
          borderWidth: 1,
          borderColor: isFiltered ? "#0a1124" : "#e3d9c0",
          maxWidth: 190,
        }}
        accessibilityRole="button"
        accessibilityLabel="Filter by court"
      >
        <Feather
          name="home"
          size={12}
          color={isFiltered ? "#ddb074" : "#8a5821"}
        />
        <Text
          className="text-[11px]"
          style={{
            fontFamily: "Manrope-SemiBold",
            color: isFiltered ? "#f5ebd6" : "#4d4538",
            flexShrink: 1,
          }}
          numberOfLines={1}
        >
          {isFiltered ? shortLabel(active!) : "All courts"}
        </Text>
        <Feather
          name="chevron-down"
          size={12}
          color={isFiltered ? "#ddb074" : "#8a5821"}
        />
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        eyebrow="Hearing Track"
        title="Filter by court"
      >
        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <Row
            label="All courts"
            sub={`${total} ${total === 1 ? "matter" : "matters"}`}
            on={selected === ALL_COURTS}
            onPress={() => {
              onSelect(ALL_COURTS);
              setOpen(false);
            }}
          />
          {options.map((o) => (
            <Row
              key={o.key}
              badge={o.number || undefined}
              label={o.name}
              sub={
                [o.place, `${o.count} ${o.count === 1 ? "matter" : "matters"}`]
                  .filter(Boolean)
                  .join(" · ")
              }
              on={selected === o.key}
              onPress={() => {
                onSelect(o.key);
                setOpen(false);
              }}
            />
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

function shortLabel(o: CourtOption): string {
  return o.number ? `${o.number} · ${o.name}` : o.name;
}

function Row({
  badge,
  label,
  sub,
  on,
  onPress,
}: {
  badge?: string;
  label: string;
  sub?: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl px-3.5 mt-2 active:opacity-80"
      style={{
        minHeight: 52,
        backgroundColor: on ? "#0a1124" : "#ffffff",
        borderWidth: 1,
        borderColor: on ? "#0a1124" : "#e3d9c0",
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      <View
        className="items-center justify-center rounded-md"
        style={{
          width: 30,
          height: 30,
          backgroundColor: on ? "rgba(245,235,214,0.14)" : "#efe5d0",
        }}
      >
        <Text
          className="text-[12px] tabular-nums"
          style={{
            fontFamily: "DMMono-Medium",
            color: on ? "#ddb074" : "#8a5821",
          }}
        >
          {badge ?? "—"}
        </Text>
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className="text-[13.5px]"
          style={{
            fontFamily: "Manrope-SemiBold",
            color: on ? "#f5ebd6" : "#0a1124",
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            className="text-[10.5px] mt-0.5"
            style={{
              fontFamily: "DMMono",
              letterSpacing: 0.3,
              color: on ? "#c4baa3" : "#a89c80",
            }}
            numberOfLines={1}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {on ? <Feather name="check" size={16} color="#ddb074" /> : null}
    </Pressable>
  );
}
