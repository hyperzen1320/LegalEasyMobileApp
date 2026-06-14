import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Sheet from "../Sheet";
import { DateField } from "../CaseFields";
import {
  partnerListCourts,
  partnerListUsers,
  type CaseListFilters,
  type PartnerCourt,
} from "../../lib/api";

// Vault filter sheet — same five structural filters as the web toolbar
// (place, court, advocate, date range); search stays in the list header.
// Options load lazily the first time the sheet opens: courts feed both
// the place chips (distinct, sorted) and the court chips; the office
// roster feeds the advocate chips.

type Advocate = { id: string; name: string };

/** Display names for id-based filters, so the list screen can render
 *  human chips without re-fetching options. */
export type CaseFilterLabels = { courtId?: string; advocateId?: string };

export default function CaseFilterSheet({
  visible,
  onClose,
  value,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  value: CaseListFilters;
  onApply: (next: CaseListFilters, labels: CaseFilterLabels) => void;
}) {
  const [draft, setDraft] = useState<CaseListFilters>(value);
  const [courts, setCourts] = useState<PartnerCourt[] | null>(null);
  const [advocates, setAdvocates] = useState<Advocate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Re-seed the draft from the applied value on every open.
  useEffect(() => {
    if (visible) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Lazy one-time option load.
  useEffect(() => {
    if (!visible || (courts && advocates)) return;
    (async () => {
      try {
        const [c, u] = await Promise.all([
          partnerListCourts(),
          partnerListUsers(),
        ]);
        setCourts(c.courts);
        setAdvocates(
          u.users
            .filter((x) => x.active !== false)
            .map((x) => ({ id: x.id, name: x.name || x.email }))
        );
        setLoadError(null);
      } catch {
        setLoadError("Couldn't load filter options. Pull to retry.");
      }
    })();
  }, [visible, courts, advocates]);

  const places = useMemo(() => {
    const set = new Set<string>();
    for (const c of courts ?? []) {
      if (c.place?.trim()) set.add(c.place.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [courts]);

  const set = <K extends keyof CaseListFilters>(
    key: K,
    v: CaseListFilters[K] | undefined
  ) =>
    setDraft((prev) => {
      const next = { ...prev };
      if (v) next[key] = v;
      else delete next[key];
      return next;
    });

  const activeCount = countActive(draft);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="Case Vault"
      title="Filter the rolls"
      containerStyle={{ maxHeight: "88%" }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12 }}
      >
        {loadError ? (
          <View
            className="rounded-md px-3.5 py-2.5 mb-3"
            style={{ backgroundColor: "#f6dccd" }}
          >
            <Text
              className="text-[12.5px]"
              style={{ fontFamily: "Manrope", color: "#c14a37" }}
            >
              {loadError}
            </Text>
          </View>
        ) : null}

        {courts === null || advocates === null ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#c5853a" size="small" />
          </View>
        ) : (
          <>
            <ChipSection
              label="Court place"
              empty="No places yet — add courts in Court Hub."
              options={places.map((p) => ({ key: p, label: p }))}
              selected={draft.courtPlace}
              onPick={(k) =>
                set("courtPlace", draft.courtPlace === k ? undefined : k)
              }
            />

            <ChipSection
              label="Court"
              empty="No courts yet — add them in Court Hub."
              options={(courts ?? []).map((c) => ({
                key: c.id,
                label: c.number ? `${c.name} · ${c.number}` : c.name,
              }))}
              selected={draft.courtId}
              onPick={(k) =>
                set("courtId", draft.courtId === k ? undefined : k)
              }
            />

            <ChipSection
              label="Filed by"
              empty="No teammates found."
              options={(advocates ?? []).map((a) => ({
                key: a.id,
                label: a.name,
              }))}
              selected={draft.advocateId}
              onPick={(k) =>
                set("advocateId", draft.advocateId === k ? undefined : k)
              }
            />

            {/* Next-hearing date range */}
            <Text
              className="text-[10px] uppercase text-app-copper-deep mt-5 mb-2"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              Next hearing between
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <DateField
                  label="From"
                  value={draft.fromDate ?? ""}
                  onChange={(v) => set("fromDate", v || undefined)}
                />
              </View>
              <View className="flex-1">
                <DateField
                  label="To"
                  value={draft.toDate ?? ""}
                  onChange={(v) => set("toDate", v || undefined)}
                />
              </View>
            </View>

            {/* Apply / clear */}
            <View className="mt-6 flex-row items-center gap-3">
              <Pressable
                onPress={() => {
                  onApply({ search: draft.search }, {});
                  onClose();
                }}
                className="rounded-xl px-4 items-center justify-center active:opacity-80"
                style={{
                  minHeight: 48,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear filters"
              >
                <Text
                  className="text-[13px]"
                  style={{ fontFamily: "Manrope-SemiBold", color: "#7a7060" }}
                >
                  Clear
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const court = (courts ?? []).find(
                    (c) => c.id === draft.courtId
                  );
                  const adv = (advocates ?? []).find(
                    (a) => a.id === draft.advocateId
                  );
                  onApply(draft, {
                    courtId: court?.name,
                    advocateId: adv?.name,
                  });
                  onClose();
                }}
                className="flex-1 rounded-xl items-center justify-center flex-row gap-2 active:opacity-90"
                style={{
                  minHeight: 48,
                  backgroundColor: "#0a1124",
                  shadowColor: "#0a1124",
                  shadowOpacity: 0.22,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                }}
                accessibilityRole="button"
                accessibilityLabel="Apply filters"
              >
                <Feather name="check" size={15} color="#f5ebd6" />
                <Text
                  className="text-[13.5px]"
                  style={{ fontFamily: "Manrope-SemiBold", color: "#f5ebd6" }}
                >
                  Apply{activeCount > 0 ? ` · ${activeCount}` : ""}
                </Text>
              </Pressable>
            </View>
          </>
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </Sheet>
  );
}

export function countActive(f: CaseListFilters): number {
  return [f.courtPlace, f.courtId, f.advocateId, f.fromDate, f.toDate].filter(
    Boolean
  ).length;
}

function ChipSection({
  label,
  options,
  selected,
  onPick,
  empty,
}: {
  label: string;
  options: { key: string; label: string }[];
  selected: string | undefined;
  onPick: (key: string) => void;
  empty: string;
}) {
  return (
    <View className="mt-5">
      <Text
        className="text-[10px] uppercase text-app-copper-deep mb-2"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
      >
        {label}
      </Text>
      {options.length === 0 ? (
        <Text
          className="text-[12px] text-app-fg-muted"
          style={{ fontFamily: "Manrope" }}
        >
          {empty}
        </Text>
      ) : (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {options.map((o) => {
            const on = selected === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => onPick(o.key)}
                className="rounded-full px-3 active:opacity-80"
                style={{
                  paddingVertical: 7,
                  backgroundColor: on ? "#0a1124" : "#ffffff",
                  borderWidth: 1,
                  borderColor: on ? "#0a1124" : "#e3d9c0",
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Text
                  className="text-[12px]"
                  style={{
                    fontFamily: on ? "Manrope-SemiBold" : "Manrope",
                    color: on ? "#f5ebd6" : "#0a1124",
                  }}
                  numberOfLines={1}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
