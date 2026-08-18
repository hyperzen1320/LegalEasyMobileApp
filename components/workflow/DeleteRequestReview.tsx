import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  partnerApproveDeleteRequest,
  partnerRejectDeleteRequest,
  type DeleteRequestRow,
} from "../../lib/api";

// The office admin's approve/reject surface for delete requests, shared by
// the board bell drawer (workflow/[id]/activity) and the office-wide
// Delete Requests inbox.
//
// It lived only inside the board drawer, which is why requests about
// cases, documents, clients and courts were invisible: that screen filters
// by boardId and those requests carry none. Extracting it means the two
// screens can never drift on what a request looks like or what reviewing
// one does.

/* ─── Human labels for the eight target types ─── */

const TARGET_LABEL: Record<string, string> = {
  case: "case",
  case_document: "document",
  client: "client",
  court: "court",
  board: "board",
  list: "list",
  task: "card",
  prompt: "prompt",
};

export function targetLabel(targetType: string): string {
  return TARGET_LABEL[targetType] ?? targetType.replace(/_/g, " ");
}

const TARGET_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  case: "briefcase",
  case_document: "file-text",
  client: "user",
  court: "home",
  board: "layout",
  list: "columns",
  task: "square",
  prompt: "zap",
};

/* ─── One request ─── */

export function DeleteRequestCard({
  row,
  isAdmin,
  onApprove,
  onReject,
}: {
  row: DeleteRequestRow;
  isAdmin: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View
      className="rounded-xl px-3.5 py-3"
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e3d9c0",
      }}
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: "#c14a37" }}
        >
          <Feather
            name={TARGET_ICON[row.targetType] ?? "trash-2"}
            size={11}
            color="#ffffff"
          />
        </View>
        <View className="flex-1">
          <Text
            className="text-[13px] text-app-ink"
            style={{ fontFamily: "Manrope-SemiBold" }}
            numberOfLines={1}
          >
            {row.requesterName}
          </Text>
          <Text
            className="text-[10px] uppercase mt-0.5"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.2,
              color: "#7a7060",
            }}
            numberOfLines={2}
          >
            wants to delete {targetLabel(row.targetType)} ·{" "}
            {row.targetName || "—"}
          </Text>
        </View>
        <Text
          className="text-[10px]"
          style={{ fontFamily: "DMMono", color: "#a89c80" }}
        >
          {relativeDay(row.createdAt)}
        </Text>
      </View>

      {row.reason ? (
        <Text
          className="mt-2 text-[12px] text-app-fg-soft"
          style={{ fontFamily: "Manrope", fontStyle: "italic" }}
        >
          “{row.reason}”
        </Text>
      ) : null}

      {isAdmin ? (
        <View className="mt-3 flex-row" style={{ gap: 8 }}>
          <Pressable
            onPress={onReject}
            className="flex-1 rounded-md py-2.5 items-center active:opacity-70"
            style={{
              backgroundColor: "#ffffff",
              borderWidth: 1,
              borderColor: "#c14a37",
            }}
            accessibilityRole="button"
            accessibilityLabel={`Reject ${row.requesterName}'s request`}
          >
            <Text
              className="text-[12px]"
              style={{ fontFamily: "Manrope-SemiBold", color: "#c14a37" }}
            >
              Reject
            </Text>
          </Pressable>
          <Pressable
            onPress={onApprove}
            className="flex-1 rounded-md py-2.5 items-center active:opacity-70"
            style={{ backgroundColor: "#56a0a8" }}
            accessibilityRole="button"
            accessibilityLabel={`Approve ${row.requesterName}'s request`}
          >
            <Text
              className="text-[12px]"
              style={{ fontFamily: "Manrope-SemiBold", color: "#ffffff" }}
            >
              Approve
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function relativeDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round(
    (startOf(new Date()) - startOf(d)) / (24 * 60 * 60 * 1000)
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/* ─── The approve/reject flow ─── */

/**
 * Owns the note modal and the two API calls. Returns the opener plus the
 * modal to render — so a screen only has to say WHICH requests to show,
 * never how reviewing one works.
 *
 * `onReviewed` fires with the request id once the server has accepted it,
 * so the caller can drop the row without a refetch.
 */
export function useDeleteRequestReview(onReviewed: (id: string) => void) {
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const open = useCallback((id: string, next: "approve" | "reject") => {
    setReviewingId(id);
    setMode(next);
    setNote("");
  }, []);

  const close = useCallback(() => {
    setReviewingId(null);
    setMode(null);
    setNote("");
  }, []);

  async function commit() {
    if (!reviewingId || !mode || busy) return;
    setBusy(true);
    try {
      if (mode === "approve") {
        await partnerApproveDeleteRequest(reviewingId, note);
      } else {
        await partnerRejectDeleteRequest(reviewingId, note);
      }
      onReviewed(reviewingId);
      close();
    } catch (err) {
      Alert.alert(
        "Couldn't submit review",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const sheet = (
    <Modal
      visible={reviewingId !== null}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable
        onPress={close}
        className="flex-1 justify-center"
        style={{
          backgroundColor: "rgba(10,17,36,0.55)",
          paddingHorizontal: 20,
        }}
      >
        <Pressable
          className="rounded-2xl"
          style={{ backgroundColor: "#ffffff", padding: 18 }}
          onPress={() => {
            /* swallow taps inside the card */
          }}
        >
          <Text
            className="text-[10px] uppercase text-app-copper-deep"
            style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
          >
            {mode === "approve" ? "Approve" : "Reject"}
          </Text>
          <Text
            className="mt-0.5 text-[18px] tracking-tight text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
          >
            Add a note (optional)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional context for the requester."
            placeholderTextColor="#a89c80"
            multiline
            style={{
              marginTop: 12,
              borderWidth: 1,
              borderColor: "#e3d9c0",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontFamily: "Manrope",
              fontSize: 13,
              color: "#0a1124",
              minHeight: 64,
              textAlignVertical: "top",
            }}
          />
          <View className="mt-3 flex-row" style={{ gap: 8 }}>
            <Pressable
              onPress={close}
              disabled={busy}
              className="flex-1 rounded-md py-3 items-center active:opacity-50"
              style={{
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#e3d9c0",
              }}
            >
              <Text
                className="text-[13px]"
                style={{ fontFamily: "Manrope-Medium", color: "#4d4538" }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={commit}
              disabled={busy}
              className="flex-[1.4] rounded-md py-3 items-center"
              style={{
                backgroundColor: mode === "approve" ? "#56a0a8" : "#c14a37",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text
                className="text-[13px]"
                style={{ fontFamily: "Manrope-SemiBold", color: "#ffffff" }}
              >
                {busy
                  ? "Saving…"
                  : mode === "approve"
                    ? "Approve"
                    : "Reject"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return { open, sheet };
}
