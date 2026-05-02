import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import {
  partnerGetTask,
  partnerUpdateTask,
  partnerDeleteTask,
  partnerAddChecklist,
  partnerUpdateChecklist,
  partnerDeleteChecklist,
  partnerAddChecklistItem,
  partnerUpdateChecklistItem,
  partnerDeleteChecklistItem,
  partnerGetBoardFull,
  deleteRequestRequired,
  ApiError,
  type SerializedTaskFull,
  type TaskFullChecklist,
  type CardPriority,
  type BoardMember,
  type DeleteRequestRequiredError,
} from "../../../../../lib/api";
import RequestDeleteSheet from "../../../../../components/workflow/RequestDeleteSheet";
import DatePickerSheet from "../../../../../components/workflow/DatePickerSheet";

const PRIORITY_OPTIONS: { value: CardPriority; label: string; color: string }[] =
  [
    { value: null, label: "None", color: "#a89c80" },
    { value: "low", label: "Low", color: "#56a0a8" },
    { value: "medium", label: "Medium", color: "#c5853a" },
    { value: "high", label: "High", color: "#c14a37" },
  ];

export default function CardDetail() {
  const { id, cardId } = useLocalSearchParams<{
    id: string;
    cardId: string;
  }>();
  const router = useRouter();

  const [task, setTask] = useState<SerializedTaskFull | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestTarget, setRequestTarget] =
    useState<DeleteRequestRequiredError | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);

  // Local edits — title and description are debounced-saved
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, board] = await Promise.all([
        partnerGetTask(String(cardId)),
        partnerGetBoardFull(String(id)),
      ]);
      setTask(t.task);
      setMembers(board.members);
      setTitle(t.task.title);
      setDescription(t.task.description);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load card");
    }
  }, [cardId, id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  // Debounced save for title + description
  useEffect(() => {
    if (!task) return;
    if (title === task.title) return;
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(async () => {
      try {
        await partnerUpdateTask(task.id, { title: title.trim() });
        setTask((prev) => (prev ? { ...prev, title: title.trim() } : prev));
      } catch {
        /* leave local for next attempt */
      }
    }, 700);
    return () => {
      if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    };
  }, [title, task]);

  useEffect(() => {
    if (!task) return;
    if (description === task.description) return;
    if (descSaveTimer.current) clearTimeout(descSaveTimer.current);
    descSaveTimer.current = setTimeout(async () => {
      try {
        await partnerUpdateTask(task.id, { description });
        setTask((prev) => (prev ? { ...prev, description } : prev));
      } catch {
        /* leave local */
      }
    }, 700);
    return () => {
      if (descSaveTimer.current) clearTimeout(descSaveTimer.current);
    };
  }, [description, task]);

  /* ─── Field setters with optimistic local update ─── */

  async function setPriority(p: CardPriority) {
    if (!task) return;
    Haptics.selectionAsync();
    setTask({ ...task, priority: p });
    try {
      await partnerUpdateTask(task.id, { priority: p });
    } catch {
      // revert on failure — re-fetch
      load();
    }
  }

  async function setDueDate(d: Date | null) {
    if (!task) return;
    setDatePickerOpen(false);
    setTask({ ...task, dueDate: d ? d.toISOString() : null });
    try {
      await partnerUpdateTask(task.id, {
        dueDate: d ? d.toISOString() : null,
      });
    } catch {
      load();
    }
  }

  async function setAssignee(member: BoardMember | null) {
    if (!task) return;
    setAssigneePickerOpen(false);
    setTask({
      ...task,
      assignee: member
        ? { id: member.id, name: member.name, role: member.role }
        : null,
    });
    try {
      await partnerUpdateTask(task.id, {
        assignedToUserId: member ? member.id : null,
      });
    } catch {
      load();
    }
  }

  async function onDelete() {
    if (!task) return;
    Alert.alert(
      "Delete this card?",
      "It'll be removed from the list and the dashboard.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await partnerDeleteTask(task.id);
              router.back();
            } catch (err) {
              const reqd = deleteRequestRequired(err);
              if (reqd) {
                setRequestTarget(reqd);
                return;
              }
              Alert.alert(
                "Couldn't delete",
                err instanceof ApiError ? err.message : "Try again."
              );
            }
          },
        },
      ]
    );
  }

  /* ─── Checklist mutations ─── */

  const addChecklist = useCallback(async () => {
    if (!task) return;
    try {
      const res = await partnerAddChecklist(task.id, { title: "Checklist" });
      setTask((prev) =>
        prev
          ? { ...prev, checklists: [...prev.checklists, res.checklist] }
          : prev
      );
    } catch {
      /* ignore */
    }
  }, [task]);

  const renameChecklist = useCallback(
    async (clId: string, t: string) => {
      if (!task) return;
      const trimmed = t.trim() || "Checklist";
      setTask((prev) =>
        prev
          ? {
              ...prev,
              checklists: prev.checklists.map((c) =>
                c.id === clId ? { ...c, title: trimmed } : c
              ),
            }
          : prev
      );
      try {
        await partnerUpdateChecklist(task.id, clId, { title: trimmed });
      } catch {
        load();
      }
    },
    [task, load]
  );

  const removeChecklist = useCallback(
    async (clId: string) => {
      if (!task) return;
      const snap = task;
      setTask({
        ...task,
        checklists: task.checklists.filter((c) => c.id !== clId),
      });
      try {
        await partnerDeleteChecklist(task.id, clId);
      } catch {
        setTask(snap);
      }
    },
    [task]
  );

  const addItem = useCallback(
    async (clId: string, text: string) => {
      if (!task || !text.trim()) return;
      try {
        const res = await partnerAddChecklistItem(task.id, clId, {
          text: text.trim(),
        });
        setTask((prev) =>
          prev
            ? {
                ...prev,
                checklists: prev.checklists.map((c) =>
                  c.id === clId ? { ...c, items: [...c.items, res.item] } : c
                ),
              }
            : prev
        );
      } catch {
        /* ignore */
      }
    },
    [task]
  );

  const toggleItem = useCallback(
    async (clId: string, itemId: string, done: boolean) => {
      if (!task) return;
      Haptics.selectionAsync();
      setTask((prev) =>
        prev
          ? {
              ...prev,
              checklists: prev.checklists.map((c) =>
                c.id === clId
                  ? {
                      ...c,
                      items: c.items.map((it) =>
                        it.id === itemId ? { ...it, done } : it
                      ),
                    }
                  : c
              ),
            }
          : prev
      );
      try {
        await partnerUpdateChecklistItem(task.id, clId, itemId, { done });
      } catch {
        load();
      }
    },
    [task, load]
  );

  const deleteItem = useCallback(
    async (clId: string, itemId: string) => {
      if (!task) return;
      const snap = task;
      setTask({
        ...task,
        checklists: task.checklists.map((c) =>
          c.id === clId
            ? { ...c, items: c.items.filter((it) => it.id !== itemId) }
            : c
        ),
      });
      try {
        await partnerDeleteChecklistItem(task.id, clId, itemId);
      } catch {
        setTask(snap);
      }
    },
    [task]
  );

  /* ─── Render ─── */

  const dueDate = task?.dueDate ? new Date(task.dueDate) : null;
  const dueLabel = useMemo(() => {
    if (!dueDate) return null;
    return dueDate.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [dueDate]);

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
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
              className="text-[9px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
            >
              Card
            </Text>
            <Text
              className="text-[15px] tracking-tight text-app-ink"
              style={{ fontFamily: "Crimson-SemiBold" }}
              numberOfLines={1}
            >
              {task?.title ?? "Loading…"}
            </Text>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#c5853a" />
          </View>
        ) : error || !task ? (
          <View className="flex-1 items-center justify-center px-8">
            <Feather name="alert-circle" size={28} color="#c14a37" />
            <Text
              className="mt-3 text-[14px] text-app-fg-soft text-center"
              style={{ fontFamily: "Manrope" }}
            >
              {error || "Card not found"}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Field label="Title">
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={{
                  fontFamily: "Crimson-SemiBold",
                  fontSize: 22,
                  letterSpacing: -0.4,
                  color: "#0a1124",
                  padding: 0,
                  paddingTop: 4,
                }}
                multiline
              />
            </Field>

            {/* Description */}
            <View style={{ height: 14 }} />
            <Field label="Description">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Notes, context, links — anything the office needs to know."
                placeholderTextColor="#a89c80"
                multiline
                textAlignVertical="top"
                style={{
                  fontFamily: "Manrope",
                  fontSize: 14,
                  color: "#0a1124",
                  minHeight: 80,
                  padding: 0,
                  paddingTop: 4,
                  lineHeight: 20,
                }}
              />
            </Field>

            {/* Priority */}
            <View style={{ height: 14 }} />
            <Field label="Priority">
              <View className="flex-row" style={{ gap: 6, paddingTop: 6 }}>
                {PRIORITY_OPTIONS.map((p) => {
                  const active = task.priority === p.value;
                  return (
                    <Pressable
                      key={p.label}
                      onPress={() => setPriority(p.value)}
                      className="active:opacity-80 rounded-md px-3 py-2 flex-row items-center"
                      style={{
                        backgroundColor: active ? p.color : "#ffffff",
                        borderWidth: 1,
                        borderColor: active ? p.color : "#e3d9c0",
                        gap: 6,
                      }}
                    >
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: active ? "#ffffff" : p.color,
                        }}
                      />
                      <Text
                        className="text-[12px]"
                        style={{
                          fontFamily: "Manrope-SemiBold",
                          color: active ? "#ffffff" : p.color,
                        }}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            {/* Due date + Assignee — two-up */}
            <View style={{ height: 14 }} />
            <View className="flex-row" style={{ gap: 12 }}>
              <Pressable
                onPress={() => setDatePickerOpen(true)}
                className="flex-1 rounded-xl active:opacity-70"
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                  padding: 12,
                }}
              >
                <Text
                  className="text-[10px] uppercase text-app-fg-muted"
                  style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.4 }}
                >
                  Due date
                </Text>
                <View
                  className="mt-1.5 flex-row items-center"
                  style={{ gap: 6 }}
                >
                  <Feather
                    name="calendar"
                    size={14}
                    color={dueLabel ? "#0a1124" : "#a89c80"}
                  />
                  <Text
                    className="text-[14px]"
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      color: dueLabel ? "#0a1124" : "#a89c80",
                    }}
                  >
                    {dueLabel ?? "Set date"}
                  </Text>
                </View>
                {dueLabel ? (
                  <Pressable
                    onPress={() => setDueDate(null)}
                    hitSlop={6}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                    }}
                  >
                    <Feather name="x" size={13} color="#a89c80" />
                  </Pressable>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => setAssigneePickerOpen(true)}
                className="flex-1 rounded-xl active:opacity-70"
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                  padding: 12,
                }}
              >
                <Text
                  className="text-[10px] uppercase text-app-fg-muted"
                  style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.4 }}
                >
                  Assignee
                </Text>
                <View
                  className="mt-1.5 flex-row items-center"
                  style={{ gap: 6 }}
                >
                  <Feather
                    name="user"
                    size={14}
                    color={task.assignee ? "#0a1124" : "#a89c80"}
                  />
                  <Text
                    className="text-[14px]"
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      color: task.assignee ? "#0a1124" : "#a89c80",
                    }}
                    numberOfLines={1}
                  >
                    {task.assignee?.name ?? "Unassigned"}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Checklists */}
            <View style={{ height: 18 }} />
            <View
              className="flex-row items-center"
              style={{ gap: 8, marginBottom: 8 }}
            >
              <Text
                className="text-[10px] uppercase text-app-fg-muted"
                style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.4 }}
              >
                Checklists
              </Text>
              <Pressable
                onPress={addChecklist}
                hitSlop={6}
                className="ml-auto rounded-md flex-row items-center active:opacity-70"
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  gap: 4,
                  backgroundColor: "#efe5d0",
                }}
              >
                <Feather name="plus" size={12} color="#8a5821" />
                <Text
                  className="text-[11px]"
                  style={{ fontFamily: "Manrope-SemiBold", color: "#8a5821" }}
                >
                  Add
                </Text>
              </Pressable>
            </View>
            {task.checklists.length === 0 ? (
              <View
                className="rounded-md px-4 py-5 items-center"
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: "#e3d9c0",
                }}
              >
                <Text
                  className="text-[12px] text-app-fg-muted text-center"
                  style={{ fontFamily: "Manrope" }}
                >
                  No checklists yet — tap{" "}
                  <Text style={{ fontFamily: "Manrope-SemiBold" }}>Add</Text>{" "}
                  to break this card into steps.
                </Text>
              </View>
            ) : (
              task.checklists.map((c) => (
                <ChecklistBlock
                  key={c.id}
                  checklist={c}
                  onRename={(t) => renameChecklist(c.id, t)}
                  onRemove={() => removeChecklist(c.id)}
                  onAddItem={(text) => addItem(c.id, text)}
                  onToggleItem={(itemId, done) => toggleItem(c.id, itemId, done)}
                  onDeleteItem={(itemId) => deleteItem(c.id, itemId)}
                />
              ))
            )}

            {/* Delete */}
            <View style={{ height: 28 }} />
            <Pressable
              onPress={onDelete}
              className="active:opacity-70 rounded-md flex-row items-center justify-center"
              style={{
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: "#c14a37",
                backgroundColor: "#ffffff",
                gap: 6,
              }}
              accessibilityLabel="Delete card"
            >
              <Feather name="trash-2" size={14} color="#c14a37" />
              <Text
                className="text-[13px]"
                style={{ fontFamily: "Manrope-SemiBold", color: "#c14a37" }}
              >
                Delete card
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Date picker — pure-JS month grid, works in Expo Go without
          any native module. */}
      <DatePickerSheet
        visible={datePickerOpen}
        initial={dueDate}
        onClose={() => setDatePickerOpen(false)}
        onPick={(d) => setDueDate(d)}
      />

      {/* Assignee picker */}
      <Modal
        visible={assigneePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAssigneePickerOpen(false)}
      >
        <Pressable
          onPress={() => setAssigneePickerOpen(false)}
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <Pressable
              className="rounded-t-3xl"
              style={{
                backgroundColor: "#ffffff",
                paddingTop: 8,
                paddingBottom: 24,
              }}
              onPress={() => {
                /* swallow */
              }}
            >
              <View
                className="self-center mb-3 h-1.5 w-12 rounded-full"
                style={{ backgroundColor: "#e3d9c0" }}
              />
              <Text
                className="px-5 text-[10px] uppercase text-app-copper-deep"
                style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
              >
                Assignee
              </Text>
              <Text
                className="px-5 mt-1 text-[18px] tracking-tight text-app-ink"
                style={{ fontFamily: "Crimson-SemiBold" }}
              >
                Who's on this card?
              </Text>
              <ScrollView
                style={{ maxHeight: 380 }}
                contentContainerStyle={{ paddingVertical: 6 }}
              >
                <Pressable
                  onPress={() => setAssignee(null)}
                  className="px-5 py-3 active:bg-app-canvas-2 flex-row items-center"
                  style={{ gap: 12 }}
                >
                  <View
                    className="h-8 w-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: "#efe5d0" }}
                  >
                    <Feather name="x" size={13} color="#7a7060" />
                  </View>
                  <Text
                    className="flex-1 text-[14px] text-app-fg-soft"
                    style={{ fontFamily: "Manrope-Medium" }}
                  >
                    Unassigned
                  </Text>
                </Pressable>
                {members.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setAssignee(m)}
                    className="px-5 py-3 active:bg-app-canvas-2 flex-row items-center"
                    style={{ gap: 12 }}
                  >
                    <View
                      className="h-8 w-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: "#0a1124" }}
                    >
                      <Text
                        style={{
                          fontFamily: "Manrope-SemiBold",
                          fontSize: 11,
                          color: "#f5ebd6",
                          letterSpacing: 0.5,
                        }}
                      >
                        {initials(m.name)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-[14px] text-app-ink"
                        style={{ fontFamily: "Manrope-SemiBold" }}
                      >
                        {m.name}
                      </Text>
                      <Text
                        className="text-[10px] uppercase mt-0.5"
                        style={{
                          fontFamily: "DMMono-Medium",
                          letterSpacing: 1.2,
                          color: "#7a7060",
                        }}
                      >
                        {m.role}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Smart-delete reason sheet */}
      <RequestDeleteSheet
        target={requestTarget}
        onClose={() => setRequestTarget(null)}
        onSubmitted={() => {
          setRequestTarget(null);
          Alert.alert(
            "Sent for review",
            "The office admin has been notified."
          );
        }}
      />
    </View>
  );
}

/* ─── Small primitives ─── */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View
      className="rounded-xl"
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e3d9c0",
        padding: 12,
      }}
    >
      <Text
        className="text-[10px] uppercase text-app-fg-muted"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.4 }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function ChecklistBlock({
  checklist,
  onRename,
  onRemove,
  onAddItem,
  onToggleItem,
  onDeleteItem,
}: {
  checklist: TaskFullChecklist;
  onRename: (t: string) => void;
  onRemove: () => void;
  onAddItem: (text: string) => void;
  onToggleItem: (itemId: string, done: boolean) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const [titleEdit, setTitleEdit] = useState(checklist.title);
  const [newItem, setNewItem] = useState("");

  // Keep local title in sync if the row is updated externally (e.g. resync)
  useEffect(() => {
    setTitleEdit(checklist.title);
  }, [checklist.title]);

  const total = checklist.items.length;
  const done = checklist.items.filter((it) => it.done).length;

  function commitNew() {
    const t = newItem.trim();
    if (!t) return;
    onAddItem(t);
    setNewItem("");
  }

  return (
    <View
      className="rounded-xl"
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e3d9c0",
        padding: 12,
        marginBottom: 10,
      }}
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Feather name="check-square" size={13} color="#8a5821" />
        <TextInput
          value={titleEdit}
          onChangeText={setTitleEdit}
          onBlur={() => {
            if (titleEdit.trim() !== checklist.title) onRename(titleEdit);
          }}
          style={{
            flex: 1,
            fontFamily: "Manrope-SemiBold",
            fontSize: 14,
            color: "#0a1124",
            padding: 0,
          }}
        />
        {total > 0 ? (
          <Text
            className="text-[10px] tabular-nums uppercase"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 0.6,
              color: "#7a7060",
            }}
          >
            {done}/{total}
          </Text>
        ) : null}
        <Pressable onPress={onRemove} hitSlop={8} className="active:opacity-50">
          <Feather name="x" size={14} color="#a89c80" />
        </Pressable>
      </View>

      <View style={{ marginTop: 8, gap: 6 }}>
        {checklist.items.map((it) => (
          <Pressable
            key={it.id}
            onPress={() => onToggleItem(it.id, !it.done)}
            className="flex-row items-center active:opacity-70"
            style={{ gap: 8 }}
          >
            <View
              className="items-center justify-center"
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                borderWidth: 1.5,
                borderColor: it.done ? "#56a0a8" : "#c5b9a0",
                backgroundColor: it.done ? "#56a0a8" : "transparent",
              }}
            >
              {it.done ? (
                <Feather name="check" size={11} color="#ffffff" />
              ) : null}
            </View>
            <Text
              className="flex-1 text-[13px]"
              style={{
                fontFamily: "Manrope",
                color: it.done ? "#a89c80" : "#0a1124",
                textDecorationLine: it.done ? "line-through" : "none",
              }}
            >
              {it.text}
            </Text>
            <Pressable
              onPress={() => onDeleteItem(it.id)}
              hitSlop={6}
              className="active:opacity-50"
            >
              <Feather name="x" size={12} color="#a89c80" />
            </Pressable>
          </Pressable>
        ))}
      </View>

      <View className="flex-row items-center" style={{ marginTop: 8, gap: 8 }}>
        <Feather name="plus" size={13} color="#a89c80" />
        <TextInput
          value={newItem}
          onChangeText={setNewItem}
          placeholder="New item…"
          placeholderTextColor="#a89c80"
          returnKeyType="done"
          onSubmitEditing={commitNew}
          style={{
            flex: 1,
            fontFamily: "Manrope",
            fontSize: 13,
            color: "#0a1124",
            padding: 0,
          }}
        />
      </View>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
