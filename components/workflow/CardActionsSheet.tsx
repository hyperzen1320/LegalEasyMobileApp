import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  View,
  Text,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  partnerListBoardLists,
  partnerListBoards,
  ApiError,
  type BoardListSummary,
  type PartnerBoard,
} from "../../lib/api";
import { BOARD_COLOR_STYLES } from "../BoardColors";

export type ListOption = { id: string; title: string };

/**
 * Bottom-sheet modal triggered by a long-press on a card. Lets the user
 * move the card to another list, hand it to another BOARD entirely, jump
 * into the card detail screen for full editing, or delete it.
 *
 * The sheet is a small wizard: the action menu, then either the list
 * picker (one step) or the board picker (two — board, then which column on
 * it). Everything unwinds with the same back chevron and resets on close.
 *
 * It uses RN's native Modal so we avoid pulling in a third-party
 * bottom-sheet library. Slide-up animation comes from `animationType`,
 * dismissal via tapping the backdrop.
 */
type Step = "actions" | "lists" | "boards" | "boardLists";

export default function CardActionsSheet({
  visible,
  cardTitle,
  currentBoardId,
  currentListId,
  lists,
  onClose,
  onMoveToList,
  onMoveToBoard,
  onOpen,
  onDelete,
}: {
  visible: boolean;
  cardTitle: string;
  currentBoardId: string;
  currentListId: string;
  lists: ListOption[];
  onClose: () => void;
  onMoveToList: (listId: string) => void;
  /** Destination list on another board, plus the board for the confirmation. */
  onMoveToBoard: (listId: string, board: PartnerBoard) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [step, setStep] = useState<Step>("actions");
  const [boards, setBoards] = useState<PartnerBoard[] | null>(null);
  const [target, setTarget] = useState<PartnerBoard | null>(null);
  const [targetLists, setTargetLists] = useState<BoardListSummary[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const otherLists = lists.filter((l) => l.id !== currentListId);

  const reset = useCallback(() => {
    setStep("actions");
    setBoards(null);
    setTarget(null);
    setTargetLists(null);
    setError(null);
  }, []);

  // A long-press on a different card reuses this component, so the wizard
  // has to be back at its first page when it reappears.
  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  function close() {
    reset();
    onClose();
  }

  async function openBoardPicker() {
    setStep("boards");
    if (boards) return;
    setError(null);
    try {
      const res = await partnerListBoards();
      setBoards(res.boards.filter((b) => b.id !== currentBoardId));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't load the boards."
      );
      setBoards([]);
    }
  }

  async function pickBoard(board: PartnerBoard) {
    setTarget(board);
    setTargetLists(null);
    setStep("boardLists");
    setError(null);
    try {
      const res = await partnerListBoardLists(board.id);
      setTargetLists(res.lists);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't load that board."
      );
      setTargetLists([]);
    }
  }

  const heading =
    step === "lists"
      ? "Move to list"
      : step === "boards"
        ? "Move to board"
        : step === "boardLists"
          ? (target?.title ?? "Move to board")
          : null;

  const goBack =
    step === "boardLists"
      ? () => setStep("boards")
      : () => setStep("actions");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <Pressable
        onPress={close}
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
            shadowColor: "#0a1124",
            shadowOpacity: 0.2,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: -6 },
            elevation: 12,
          }}
        >
          <View
            className="self-center mb-2 h-1.5 w-12 rounded-full"
            style={{ backgroundColor: "#e3d9c0" }}
          />
          <View className="px-5 pb-2">
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              Card
            </Text>
            <Text
              className="text-[18px] tracking-tight text-app-ink mt-0.5"
              style={{ fontFamily: "Crimson-SemiBold" }}
              numberOfLines={2}
            >
              {cardTitle}
            </Text>
          </View>

          {heading ? (
            <View
              className="px-5 py-2 flex-row items-center"
              style={{ gap: 8 }}
            >
              <Pressable onPress={goBack} hitSlop={6}>
                <Feather name="chevron-left" size={16} color="#7a7060" />
              </Pressable>
              <Text
                className="flex-1 text-[10px] uppercase text-app-fg-muted"
                style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.4 }}
                numberOfLines={1}
              >
                {heading}
              </Text>
            </View>
          ) : null}

          {error ? (
            <View className="px-5 pb-2">
              <Text
                className="text-[12.5px]"
                style={{ fontFamily: "Manrope", color: "#c14a37" }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {step === "actions" ? (
            <View>
              <SheetAction
                icon="arrow-right"
                label="Move to another list"
                onPress={() => setStep("lists")}
              />
              <SheetAction
                icon="corner-up-right"
                label="Move to another board"
                onPress={() => void openBoardPicker()}
              />
              <SheetAction
                icon="edit-2"
                label="Open card"
                onPress={() => {
                  onOpen();
                  close();
                }}
              />
              <SheetAction
                icon="trash-2"
                label="Delete card"
                tone="danger"
                onPress={() => {
                  onDelete();
                  close();
                }}
              />
              <View className="px-5 mt-2">
                <Pressable
                  onPress={close}
                  className="active:opacity-50 items-center"
                  style={{
                    paddingVertical: 12,
                    backgroundColor: "#f4ede0",
                    borderRadius: 10,
                  }}
                  accessibilityLabel="Cancel"
                >
                  <Text
                    className="text-[13px]"
                    style={{
                      fontFamily: "Manrope-Medium",
                      color: "#4d4538",
                    }}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === "lists" ? (
            <PickerList
              empty="No other lists on this board yet."
              rows={otherLists.map((l) => ({
                key: l.id,
                title: l.title,
                onPress: () => {
                  onMoveToList(l.id);
                  close();
                },
              }))}
            />
          ) : null}

          {step === "boards" ? (
            boards === null ? (
              <Loading />
            ) : (
              <PickerList
                empty="This is your only board."
                rows={boards.map((b) => ({
                  key: b.id,
                  title: b.title,
                  subtitle: b.description || undefined,
                  swatch: BOARD_COLOR_STYLES[b.color]?.gradient[0],
                  chevron: true,
                  onPress: () => void pickBoard(b),
                }))}
              />
            )
          ) : null}

          {step === "boardLists" ? (
            targetLists === null ? (
              <Loading />
            ) : (
              <PickerList
                empty="That board has no lists yet — add one there first."
                rows={targetLists.map((l) => ({
                  key: l.id,
                  title: l.title,
                  onPress: () => {
                    if (target) onMoveToBoard(l.id, target);
                    close();
                  },
                }))}
              />
            )
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Loading() {
  return (
    <View className="px-5 py-8 items-center">
      <ActivityIndicator color="#c5853a" />
    </View>
  );
}

type PickerRow = {
  key: string;
  title: string;
  subtitle?: string;
  /** Board colour dot, so a board is recognised the way it is on the list. */
  swatch?: string;
  chevron?: boolean;
  onPress: () => void;
};

function PickerList({ rows, empty }: { rows: PickerRow[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <View className="px-5 py-6">
        <Text
          className="text-[13px] text-app-fg-muted text-center"
          style={{ fontFamily: "Manrope" }}
        >
          {empty}
        </Text>
      </View>
    );
  }
  return (
    <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
      {rows.map((r) => (
        <Pressable
          key={r.key}
          onPress={r.onPress}
          className="active:bg-app-canvas-2"
          style={{
            paddingHorizontal: 20,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          {r.swatch ? (
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                backgroundColor: r.swatch,
              }}
            />
          ) : (
            <Feather name="arrow-right" size={14} color="#8a5821" />
          )}
          <View className="flex-1">
            <Text
              className="text-[14px] text-app-ink"
              style={{ fontFamily: "Manrope-SemiBold" }}
              numberOfLines={1}
            >
              {r.title}
            </Text>
            {r.subtitle ? (
              <Text
                className="text-[11px] mt-0.5 text-app-fg-muted"
                style={{ fontFamily: "Manrope" }}
                numberOfLines={1}
              >
                {r.subtitle}
              </Text>
            ) : null}
          </View>
          {r.chevron ? (
            <Feather name="chevron-right" size={14} color="#8a5821" />
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SheetAction({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  tone?: "danger";
  onPress: () => void;
}) {
  const colour = tone === "danger" ? "#c14a37" : "#0a1124";
  return (
    <Pressable
      onPress={onPress}
      className="active:bg-app-canvas-2"
      style={{
        paddingHorizontal: 20,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
      accessibilityRole="button"
    >
      <View
        className="h-7 w-7 items-center justify-center rounded-md"
        style={{
          backgroundColor: tone === "danger" ? "#f6dccd" : "#efe5d0",
        }}
      >
        <Feather name={icon} size={13} color={colour} />
      </View>
      <Text
        className="text-[14px]"
        style={{
          fontFamily: "Manrope-SemiBold",
          color: colour,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
