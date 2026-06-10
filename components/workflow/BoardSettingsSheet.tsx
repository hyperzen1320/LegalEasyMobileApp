import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Sheet from "../Sheet";
import { BOARD_COLORS, BOARD_COLOR_STYLES } from "../BoardColors";
import {
  ApiError,
  deleteRequestRequired,
  partnerDeleteBoard,
  partnerUpdateBoard,
  type BoardColor,
  type DeleteRequestRequiredError,
} from "../../lib/api";

// Board housekeeping — rename, recolour, delete. Deleting follows the
// office smart-delete rule (admin direct, others via delete request);
// the caller owns the RequestDeleteSheet and navigation.

export default function BoardSettingsSheet({
  visible,
  onClose,
  boardId,
  title,
  color,
  onSaved,
  onDeleted,
  onDeleteNeedsRequest,
}: {
  visible: boolean;
  onClose: () => void;
  boardId: string;
  title: string;
  color: BoardColor;
  onSaved: (next: { title: string; color: BoardColor }) => void;
  onDeleted: () => void;
  onDeleteNeedsRequest: (target: DeleteRequestRequiredError) => void;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftColor, setDraftColor] = useState<BoardColor>(color);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraftTitle(title);
      setDraftColor(color);
      setError(null);
      setBusy(null);
    }
  }, [visible, title, color]);

  async function save() {
    if (busy) return;
    const t = draftTitle.trim();
    if (!t) {
      setError("The board needs a name.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      await partnerUpdateBoard(boardId, { title: t, color: draftColor });
      onSaved({ title: t, color: draftColor });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't save. Try again."
      );
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    if (busy) return;
    Alert.alert(
      "Delete this board?",
      `“${title}” and all of its lists and cards will be removed.`,
      [
        { text: "Keep it", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void doDelete() },
      ]
    );
  }

  async function doDelete() {
    setBusy("delete");
    setError(null);
    try {
      await partnerDeleteBoard(boardId);
      onClose();
      onDeleted();
    } catch (err) {
      const reqd = deleteRequestRequired(err);
      if (reqd) {
        onClose();
        onDeleteNeedsRequest(reqd);
      } else {
        setError(
          err instanceof ApiError ? err.message : "Couldn't delete. Try again."
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={busy ? () => {} : onClose}
      eyebrow="Workflow"
      title="Board settings"
      showClose={!busy}
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

        <Text
          className="text-[10px] uppercase text-app-copper-deep mb-2"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          Name
        </Text>
        <TextInput
          value={draftTitle}
          onChangeText={setDraftTitle}
          placeholder="Board name"
          placeholderTextColor="#a89c80"
          className="rounded-xl bg-app-paper px-3.5 py-3 text-[15px] text-app-ink"
          style={{
            fontFamily: "Crimson-SemiBold",
            borderWidth: 1,
            borderColor: "#e3d9c0",
          }}
          maxLength={80}
        />

        <Text
          className="text-[10px] uppercase text-app-copper-deep mt-5 mb-2"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          Colour
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {BOARD_COLORS.map((key) => {
            const s = BOARD_COLOR_STYLES[key];
            const active = key === draftColor;
            return (
              <Pressable
                key={key}
                onPress={() => setDraftColor(key)}
                className="items-center justify-center active:opacity-80"
                style={{
                  height: 40,
                  width: 40,
                  borderRadius: 10,
                  overflow: "hidden",
                  borderWidth: active ? 2.5 : 1,
                  borderColor: active ? "#0a1124" : "#e3d9c0",
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Colour ${key}`}
              >
                <LinearGradient
                  colors={s.gradient as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
                {active ? (
                  <Feather name="check" size={16} color="#ffffff" />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={save}
          disabled={busy !== null}
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
          accessibilityLabel="Save board settings"
        >
          {busy === "save" ? (
            <ActivityIndicator size="small" color="#f5ebd6" />
          ) : (
            <Feather name="check" size={15} color="#f5ebd6" />
          )}
          <Text
            className="text-[13.5px]"
            style={{ fontFamily: "Manrope-SemiBold", color: "#f5ebd6" }}
          >
            {busy === "save" ? "Saving…" : "Save changes"}
          </Text>
        </Pressable>

        <Pressable
          onPress={confirmDelete}
          disabled={busy !== null}
          className="mt-3 rounded-xl items-center justify-center flex-row gap-2 active:opacity-85"
          style={{
            minHeight: 46,
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: "rgba(193,74,55,0.35)",
          }}
          accessibilityRole="button"
          accessibilityLabel="Delete board"
        >
          {busy === "delete" ? (
            <ActivityIndicator size="small" color="#c14a37" />
          ) : (
            <Feather name="trash-2" size={14} color="#c14a37" />
          )}
          <Text
            className="text-[13px]"
            style={{ fontFamily: "Manrope-SemiBold", color: "#c14a37" }}
          >
            Delete board
          </Text>
        </Pressable>
        <View style={{ height: 16 }} />
      </View>
    </Sheet>
  );
}
