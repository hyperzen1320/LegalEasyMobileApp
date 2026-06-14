import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Sheet from "../Sheet";
import { DateField } from "../CaseFields";
import {
  ApiError,
  partnerCreateReminder,
  partnerListUsers,
  type ReminderPriority,
} from "../../lib/api";

// New reminder — personal by default, delegable to any active teammate
// (the server validates the assignee belongs to the office). Mirrors the
// web Senior Desk's NewReminderSheet fields: title, note, due date,
// priority, assignee.

const PRIORITIES: { key: ReminderPriority; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "high", label: "High" },
];

export default function NewReminderSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ReminderPriority>("normal");
  const [assigneeId, setAssigneeId] = useState<string | null>(null); // null = me
  const [people, setPeople] = useState<
    { id: string; name: string }[] | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("normal");
      setAssigneeId(null);
      setError(null);
      setSaving(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || people) return;
    (async () => {
      try {
        const res = await partnerListUsers();
        setPeople(
          res.users
            .filter((u) => u.active !== false)
            .map((u) => ({
              id: u.id,
              name: u.id === res.currentUserId ? "Me" : u.name || u.email,
            }))
            .sort((a, b) => (a.name === "Me" ? -1 : b.name === "Me" ? 1 : 0))
        );
      } catch {
        // Assignee picker degrades to "me" — creation still works.
      }
    })();
  }, [visible, people]);

  async function save() {
    if (saving) return;
    if (!title.trim()) {
      setError("The reminder needs a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await partnerCreateReminder({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        priority,
        assignedToUserId: assigneeId ?? undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't save. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={saving ? () => {} : onClose}
      eyebrow="Senior Desk"
      title="New reminder"
      showClose={!saving}
      containerStyle={{ maxHeight: "88%" }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12 }}
      >
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

        <Text
          className="text-[10px] uppercase text-app-copper-deep mb-2"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          Title
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="File the rejoinder in OS 112"
          placeholderTextColor="#a89c80"
          maxLength={240}
          className="rounded-xl bg-app-paper px-3.5 py-3 text-[14.5px] text-app-ink"
          style={{
            fontFamily: "Manrope-SemiBold",
            borderWidth: 1,
            borderColor: "#e3d9c0",
          }}
        />

        <Text
          className="text-[10px] uppercase text-app-copper-deep mt-4 mb-2"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          Note (optional)
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Anything the assignee should know…"
          placeholderTextColor="#a89c80"
          multiline
          className="rounded-xl bg-app-paper px-3.5 py-3 text-[14px] text-app-ink"
          style={{
            fontFamily: "Manrope",
            minHeight: 72,
            textAlignVertical: "top",
            borderWidth: 1,
            borderColor: "#e3d9c0",
          }}
        />

        <View className="mt-4">
          <DateField label="Due date" value={dueDate} onChange={setDueDate} />
        </View>

        <Text
          className="text-[10px] uppercase text-app-copper-deep mt-4 mb-2"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          Priority
        </Text>
        <View className="flex-row gap-2">
          {PRIORITIES.map((p) => {
            const on = p.key === priority;
            return (
              <Pressable
                key={p.key}
                onPress={() => setPriority(p.key)}
                className="flex-1 items-center rounded-lg py-2.5 active:opacity-85"
                style={{
                  backgroundColor: on ? "#0a1124" : "#ffffff",
                  borderWidth: 1,
                  borderColor: on ? "#0a1124" : "#e3d9c0",
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text
                  className="text-[12px]"
                  style={{
                    fontFamily: "Manrope-SemiBold",
                    color: on ? "#f5ebd6" : "#0a1124",
                  }}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {people && people.length > 1 ? (
          <>
            <Text
              className="text-[10px] uppercase text-app-copper-deep mt-4 mb-2"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              Assign to
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {people.map((p) => {
                const on =
                  p.name === "Me" ? assigneeId === null : assigneeId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() =>
                      setAssigneeId(p.name === "Me" ? null : p.id)
                    }
                    className="rounded-full px-3 active:opacity-80"
                    style={{
                      paddingVertical: 6,
                      backgroundColor: on ? "#0a1124" : "#ffffff",
                      borderWidth: 1,
                      borderColor: on ? "#0a1124" : "#e3d9c0",
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text
                      className="text-[12px]"
                      style={{
                        fontFamily: on ? "Manrope-SemiBold" : "Manrope",
                        color: on ? "#f5ebd6" : "#0a1124",
                      }}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Pressable
          onPress={save}
          disabled={saving}
          className="mt-6 rounded-xl items-center justify-center flex-row gap-2 active:opacity-90"
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
          accessibilityLabel="Create reminder"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#f5ebd6" />
          ) : (
            <Feather name="bell" size={15} color="#f5ebd6" />
          )}
          <Text
            className="text-[13.5px]"
            style={{ fontFamily: "Manrope-SemiBold", color: "#f5ebd6" }}
          >
            {saving ? "Saving…" : "Set the reminder"}
          </Text>
        </Pressable>
        <View style={{ height: 16 }} />
      </ScrollView>
    </Sheet>
  );
}
