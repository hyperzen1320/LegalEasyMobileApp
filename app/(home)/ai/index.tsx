import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import {
  partnerListPrompts,
  partnerUpdatePrompt,
  partnerDeletePrompt,
  ApiError,
  type PartnerPrompt,
} from "../../../lib/api";

const TOOLS: { name: string; description: string; href: string }[] = [
  {
    name: "Indian Kanoon",
    description: "Free Indian case law search engine.",
    href: "https://indiankanoon.org",
  },
  {
    name: "SCC Online",
    description: "Premium legal research database.",
    href: "https://www.scconline.com",
  },
  {
    name: "Manupatra",
    description: "Indian and international case law.",
    href: "https://www.manupatra.com",
  },
  {
    name: "ChatGPT",
    description: "General AI for drafting assistance.",
    href: "https://chat.openai.com",
  },
  {
    name: "Claude",
    description: "Long-document analysis and drafting.",
    href: "https://claude.ai",
  },
];

export default function AiAssistant() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PartnerPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await partnerListPrompts();
      setPrompts(data.prompts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [prompts, query]);

  function onUpdated(updated: PartnerPrompt) {
    setPrompts((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
    setEditingId(null);
  }

  function onDeleted(id: string) {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    if (openId === id) setOpenId(null);
    if (editingId === id) setEditingId(null);
  }

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar />
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="px-5 pt-4 pb-12"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#c5853a"
              />
            }
          >
            {/* Verification banner */}
            <View
              className="rounded-xl px-4 py-3.5 flex-row items-start gap-3"
              style={{
                backgroundColor: "rgba(197,133,58,0.12)",
                borderWidth: 1,
                borderColor: "rgba(197,133,58,0.30)",
              }}
            >
              <Feather name="alert-triangle" size={16} color="#8a5821" />
              <Text
                className="flex-1 text-[12px] leading-[1.5]"
                style={{ fontFamily: "Manrope", color: "#0a1124" }}
              >
                All AI-generated drafts must be verified, edited and signed by
                an advocate before filing.
              </Text>
            </View>

            {/* Tools */}
            <Text
              className="mt-7 text-[22px] font-semibold tracking-tight text-app-ink"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Research &amp; drafting tools
            </Text>
            <View className="mt-3 gap-3">
              {TOOLS.map((t, i) => (
                <Animated.View
                  key={t.name}
                  entering={FadeInDown.duration(380).delay(
                    Math.min(i, 6) * 35
                  )}
                >
                  <ToolCard tool={t} />
                </Animated.View>
              ))}
            </View>

            {/* Prompt templates */}
            <View className="mt-8 flex-row items-end justify-between">
              <View className="flex-1">
                <Text
                  className="text-[22px] font-semibold tracking-tight text-app-ink"
                  style={{ fontFamily: "Crimson-SemiBold" }}
                >
                  Prompt templates
                </Text>
                <Text
                  className="mt-1 text-[12px] text-app-fg-muted leading-[1.4]"
                  style={{ fontFamily: "Manrope" }}
                >
                  Tap to expand. Edits save to the office library.
                </Text>
              </View>
              <Pressable
                onPress={() => router.push("/(home)/ai/new")}
                className="rounded-md flex-row items-center gap-1.5 px-3 py-2 active:opacity-90"
                style={{
                  backgroundColor: "#c5853a",
                  shadowColor: "#c5853a",
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 3,
                }}
              >
                <Feather name="plus" size={13} color="#2a1c08" />
                <Text
                  className="text-[12px] font-semibold"
                  style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
                >
                  New
                </Text>
              </Pressable>
            </View>

            {/* Search */}
            {prompts.length > 4 ? (
              <View
                className="mt-4 flex-row items-center gap-2 rounded-xl bg-app-paper px-3.5 py-2.5"
                style={{
                  shadowColor: "#0a1124",
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                }}
              >
                <Feather name="search" size={15} color="#a89c80" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search title, body or category..."
                  placeholderTextColor="#a89c80"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 text-[14px] text-app-ink"
                  style={{ fontFamily: "Manrope", paddingVertical: 0 }}
                />
                {query.length > 0 ? (
                  <Pressable
                    onPress={() => setQuery("")}
                    hitSlop={8}
                    className="active:opacity-50"
                  >
                    <Feather name="x" size={15} color="#8a5821" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {error ? (
              <View
                className="mt-4 rounded-md px-4 py-3"
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

            {/* List */}
            {filtered.length === 0 ? (
              <View
                className="mt-5 rounded-xl px-5 py-10 items-center"
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                  borderStyle: "dashed",
                }}
              >
                <Text
                  className="text-[13px] text-app-fg-muted text-center"
                  style={{ fontFamily: "Manrope" }}
                >
                  {query
                    ? `No matches for "${query}"`
                    : "No templates yet. Tap + New to create one."}
                </Text>
              </View>
            ) : (
              <View className="mt-4 gap-3">
                {filtered.map((p, i) => (
                  <Animated.View
                    key={p.id}
                    entering={FadeInDown.duration(380).delay(
                      Math.min(i, 10) * 25
                    )}
                  >
                    <PromptCard
                      p={p}
                      expanded={openId === p.id}
                      editing={editingId === p.id}
                      onToggle={() =>
                        setOpenId((cur) => (cur === p.id ? null : p.id))
                      }
                      onStartEdit={() => {
                        setOpenId(p.id);
                        setEditingId(p.id);
                      }}
                      onCancelEdit={() => setEditingId(null)}
                      onSavedEdit={onUpdated}
                      onDeleted={onDeleted}
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
  const router = useRouter();
  return (
    <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center gap-3">
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        className="active:opacity-50"
      >
        <Feather name="arrow-left" size={18} color="#0a1124" />
      </Pressable>
      <View className="flex-1">
        <Text
          className="text-[10px] uppercase text-app-copper-deep"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          The Junior
        </Text>
        <Text
          className="mt-0.5 text-[18px] font-semibold tracking-tight text-app-ink leading-none"
          style={{ fontFamily: "Crimson-SemiBold" }}
        >
          AI Assistant
        </Text>
      </View>
    </View>
  );
}

/* ─── Tool card ─── */

function ToolCard({
  tool,
}: {
  tool: { name: string; description: string; href: string };
}) {
  async function open() {
    try {
      await Linking.openURL(tool.href);
    } catch {
      Alert.alert("Couldn't open the link.");
    }
  }
  return (
    <Pressable
      onPress={open}
      className="rounded-2xl bg-app-paper p-4 flex-row items-center gap-3 active:opacity-80"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <View className="flex-1 min-w-0">
        <Text
          className="text-[18px] font-semibold tracking-tight leading-[1.2] text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
        >
          {tool.name}
        </Text>
        <Text
          className="mt-0.5 text-[12px] text-app-fg-muted"
          style={{ fontFamily: "Manrope" }}
        >
          {tool.description}
        </Text>
      </View>
      <Feather name="external-link" size={16} color="#8a5821" />
    </Pressable>
  );
}

/* ─── Prompt card ─── */

function PromptCard({
  p,
  expanded,
  editing,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSavedEdit,
  onDeleted,
}: {
  p: PartnerPrompt;
  expanded: boolean;
  editing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSavedEdit: (p: PartnerPrompt) => void;
  onDeleted: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function copy() {
    try {
      await Clipboard.setStringAsync(p.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      Alert.alert("Couldn't copy.");
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete this template?",
      "This template will be removed from your office library.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await partnerDeletePrompt(p.id);
              onDeleted(p.id);
            } catch (err) {
              Alert.alert(
                "Couldn't delete",
                err instanceof ApiError ? err.message : "Try again."
              );
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View
      className="rounded-2xl overflow-hidden bg-app-paper"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <Pressable
        onPress={onToggle}
        className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
      >
        <View
          className="rounded px-1.5 py-0.5"
          style={{
            backgroundColor: p.isSeeded
              ? "#d2e6e7"
              : "rgba(197,133,58,0.18)",
          }}
        >
          <Text
            className="text-[9px] font-semibold uppercase"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.2,
              color: p.isSeeded ? "#56a0a8" : "#8a5821",
            }}
          >
            {p.category}
          </Text>
        </View>
        <Text
          className="flex-1 text-[14px] text-app-ink"
          style={{
            fontFamily: "Manrope-Medium",
          }}
          numberOfLines={2}
        >
          {p.title}
        </Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color="#8a5821"
        />
      </Pressable>

      {expanded ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          className="px-4 pb-4"
          style={{
            borderTopWidth: 1,
            borderTopColor: "#efe5d0",
            paddingTop: 14,
          }}
        >
          {editing ? (
            <EditForm
              p={p}
              onCancel={onCancelEdit}
              onSaved={onSavedEdit}
            />
          ) : (
            <>
              <View
                className="rounded-md p-3.5"
                style={{ backgroundColor: "#f4ede0" }}
              >
                <Text
                  className="text-[12px] leading-[1.6]"
                  style={{
                    fontFamily: "Manrope",
                    color: "#4d4538",
                  }}
                >
                  {p.body || "(Empty template — tap Edit to add the prompt.)"}
                </Text>
              </View>

              <View className="mt-3 flex-row gap-2">
                <Pressable
                  onPress={copy}
                  className="flex-1 rounded-md py-2.5 items-center justify-center flex-row gap-1.5 active:opacity-80"
                  style={{
                    backgroundColor: copied ? "#56a0a8" : "#0a1124",
                    shadowColor: copied ? "#56a0a8" : "#0a1124",
                    shadowOpacity: 0.18,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 3,
                  }}
                >
                  <Feather
                    name={copied ? "check" : "copy"}
                    size={13}
                    color="#f5ebd6"
                  />
                  <Text
                    className="text-[12px] font-semibold"
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      color: "#f5ebd6",
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onStartEdit}
                  className="flex-1 rounded-md py-2.5 items-center justify-center flex-row gap-1.5 active:opacity-50"
                  style={{
                    backgroundColor: "#ffffff",
                    borderWidth: 1,
                    borderColor: "#e3d9c0",
                  }}
                >
                  <Feather name="edit-3" size={13} color="#0a1124" />
                  <Text
                    className="text-[12px] font-semibold"
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      color: "#0a1124",
                    }}
                  >
                    Edit
                  </Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  disabled={deleting}
                  className="rounded-md py-2.5 px-3 items-center justify-center active:opacity-50"
                  style={{
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: "#c14a37",
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  <Feather name="trash-2" size={14} color="#c14a37" />
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

/* ─── Edit form (inline) ─── */

function EditForm({
  p,
  onCancel,
  onSaved,
}: {
  p: PartnerPrompt;
  onCancel: () => void;
  onSaved: (p: PartnerPrompt) => void;
}) {
  const [title, setTitle] = useState(p.title);
  const [body, setBody] = useState(p.body);
  const [category, setCategory] = useState(p.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await partnerUpdatePrompt(p.id, { title, body, category });
      onSaved(res.prompt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="gap-3">
      <SmallField
        label="Title"
        value={title}
        onChangeText={setTitle}
      />
      <SmallField
        label="Category"
        value={category}
        onChangeText={setCategory}
      />
      <View>
        <Text
          className="text-[10px] font-semibold uppercase text-app-fg-muted mb-1.5"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
        >
          Template body
        </Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          className="rounded-md border bg-app-canvas px-3 py-2.5 text-[13px] text-app-ink"
          style={{
            fontFamily: "Manrope",
            borderColor: "#e3d9c0",
            minHeight: 200,
            lineHeight: 20,
          }}
        />
      </View>
      {error ? (
        <Text
          className="text-[12px]"
          style={{ fontFamily: "Manrope", color: "#c14a37" }}
        >
          {error}
        </Text>
      ) : null}
      <View className="flex-row gap-2 mt-1">
        <Pressable
          onPress={onCancel}
          className="flex-1 rounded-md py-2.5 items-center active:opacity-50"
          style={{
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: "#e3d9c0",
          }}
        >
          <Text
            className="text-[12px] font-medium"
            style={{ fontFamily: "Manrope-Medium", color: "#4d4538" }}
          >
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={saving}
          className="flex-[1.4] rounded-md py-2.5 items-center justify-center flex-row gap-2"
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
            <ActivityIndicator size="small" color="#2a1c08" />
          ) : (
            <Text
              className="text-[12px] font-semibold"
              style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
            >
              Save
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function SmallField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View>
      <Text
        className="text-[10px] font-semibold uppercase text-app-fg-muted mb-1.5"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        className="rounded-md border bg-app-paper px-3 py-2.5 text-[14px] text-app-ink"
        style={{
          fontFamily: "Manrope",
          borderColor: "#e3d9c0",
        }}
      />
    </View>
  );
}
