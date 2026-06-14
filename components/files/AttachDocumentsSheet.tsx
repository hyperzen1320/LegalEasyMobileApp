import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Sheet from "../Sheet";
import {
  FileOpError,
  MAX_DOC_LABEL,
  MAX_FILES_PER_BATCH,
  pickDocuments,
  pickImages,
  uploadCaseDocuments,
  type PickedFile,
  type RejectedFile,
} from "../../lib/files";
import { formatBytes } from "../../lib/exports";

// Staged-batch upload sheet for case documents. Sources: device files,
// photo library, camera (court orders photographed on the spot). The
// batch cap and per-file limits mirror the server exactly; rejected
// picks are listed with the reason instead of silently dropped. Upload
// is a single multipart POST — a 201 can still carry per-file errors
// (partial success), which stay on screen for a re-try.

const REJECT_LABEL: Record<RejectedFile["reason"], string> = {
  too_large: `over ${MAX_DOC_LABEL}`,
  unsupported: "type not accepted",
  empty: "empty file",
  overflow: `batch is full (${MAX_FILES_PER_BATCH} max)`,
};

export default function AttachDocumentsSheet({
  visible,
  onClose,
  caseId,
  onUploaded,
}: {
  visible: boolean;
  onClose: () => void;
  caseId: string;
  onUploaded: () => void;
}) {
  const [staged, setStaged] = useState<PickedFile[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStaged([]);
      setRejected([]);
      setUploading(false);
      setServerErrors([]);
      setNote(null);
      setError(null);
    }
  }, [visible]);

  async function pick(source: "files" | "library" | "camera") {
    setError(null);
    setNote(null);
    try {
      const res =
        source === "files"
          ? await pickDocuments(staged.length)
          : await pickImages(
              source === "camera" ? "camera" : "library",
              staged.length
            );
      if (!res) return; // user cancelled
      setStaged((prev) => [...prev, ...res.ok]);
      setRejected(res.rejected);
    } catch (err) {
      if (err instanceof FileOpError && err.code === "permission_denied") {
        Alert.alert("Camera is off", err.message, [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      setError(err instanceof Error ? err.message : "Couldn't open the picker.");
    }
  }

  function remove(uri: string) {
    setStaged((prev) => prev.filter((f) => f.uri !== uri));
  }

  async function upload() {
    if (staged.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    setServerErrors([]);
    try {
      const res = await uploadCaseDocuments(caseId, staged);
      onUploaded();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (res.errors.length === 0) {
        onClose();
      } else {
        // Partial success: the uploaded ones are in; surface what failed
        // so the user can fix and re-attach just those.
        setStaged([]);
        setRejected([]);
        setServerErrors(res.errors);
        setNote(
          res.documents.length > 0
            ? `${res.documents.length} uploaded · ${res.errors.length} failed`
            : null
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  const room = MAX_FILES_PER_BATCH - staged.length;

  return (
    <Sheet
      visible={visible}
      onClose={uploading ? () => {} : onClose}
      eyebrow="Briefcase"
      title="Attach documents"
      showClose={!uploading}
      containerStyle={{ maxHeight: "88%" }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14 }}
      >
        <Text
          className="text-[11px] text-app-fg-muted"
          style={{ fontFamily: "DMMono", letterSpacing: 0.5 }}
        >
          PDF · Word · images, up to {MAX_DOC_LABEL} each,{" "}
          {MAX_FILES_PER_BATCH} per batch
        </Text>

        {/* Sources */}
        <View className="flex-row gap-2.5 mt-3.5">
          <SourceButton
            icon="folder"
            label="Files"
            onPress={() => pick("files")}
            disabled={uploading || room <= 0}
          />
          <SourceButton
            icon="image"
            label="Photos"
            onPress={() => pick("library")}
            disabled={uploading || room <= 0}
          />
          <SourceButton
            icon="camera"
            label="Camera"
            onPress={() => pick("camera")}
            disabled={uploading || room <= 0}
          />
        </View>

        {error ? (
          <Banner tone="danger" text={error} />
        ) : null}
        {note ? <Banner tone="success" text={note} /> : null}

        {/* Server-side per-file failures (partial success) */}
        {serverErrors.length > 0 ? (
          <View
            className="mt-3 rounded-md px-3.5 py-2.5"
            style={{ backgroundColor: "#f6dccd" }}
          >
            {serverErrors.map((e, i) => (
              <Text
                key={i}
                className="text-[12px] leading-[18px]"
                style={{ fontFamily: "Manrope", color: "#c14a37" }}
              >
                · {e}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Rejected at pick time */}
        {rejected.length > 0 ? (
          <View
            className="mt-3 rounded-md px-3.5 py-2.5"
            style={{
              backgroundColor: "#efe5d0",
            }}
          >
            {rejected.map((r, i) => (
              <Text
                key={`${r.name}-${i}`}
                className="text-[12px] leading-[18px]"
                style={{ fontFamily: "Manrope", color: "#4d4538" }}
                numberOfLines={1}
              >
                · {r.name} — {REJECT_LABEL[r.reason]}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Staged batch */}
        {staged.length > 0 ? (
          <View
            className="mt-4 rounded-xl bg-app-paper overflow-hidden"
            style={{ borderWidth: 1, borderColor: "#e3d9c0" }}
          >
            {staged.map((f, i) => (
              <View
                key={f.uri}
                className="flex-row items-center gap-3 px-3.5"
                style={{
                  minHeight: 48,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "#efe5d0",
                }}
              >
                <Feather
                  name={
                    f.mimeType.startsWith("image/")
                      ? "image"
                      : f.mimeType === "application/pdf"
                        ? "file-text"
                        : "file"
                  }
                  size={15}
                  color="#8a5821"
                />
                <View className="flex-1 min-w-0">
                  <Text
                    className="text-[13px] text-app-ink"
                    style={{ fontFamily: "Manrope-SemiBold" }}
                    numberOfLines={1}
                  >
                    {f.name}
                  </Text>
                  <Text
                    className="text-[10px] text-app-fg-muted"
                    style={{ fontFamily: "DMMono", letterSpacing: 0.4 }}
                  >
                    {formatBytes(f.size)}
                  </Text>
                </View>
                {!uploading ? (
                  <Pressable
                    onPress={() => remove(f.uri)}
                    hitSlop={8}
                    className="active:opacity-50"
                    accessibilityLabel={`Remove ${f.name}`}
                  >
                    <Feather name="x" size={15} color="#7a7060" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Upload */}
        <Pressable
          onPress={upload}
          disabled={uploading || staged.length === 0}
          className="mt-5 rounded-xl items-center justify-center flex-row gap-2 active:opacity-90"
          style={{
            backgroundColor: staged.length === 0 ? "#c4baa3" : "#0a1124",
            paddingVertical: 14,
            shadowColor: "#0a1124",
            shadowOpacity: staged.length === 0 ? 0 : 0.22,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: staged.length === 0 ? 0 : 4,
          }}
          accessibilityRole="button"
          accessibilityLabel="Upload documents"
        >
          {uploading ? (
            <>
              <ActivityIndicator size="small" color="#f5ebd6" />
              <Text
                className="text-[13.5px]"
                style={{ fontFamily: "Manrope-SemiBold", color: "#f5ebd6" }}
              >
                Uploading {staged.length}…
              </Text>
            </>
          ) : (
            <>
              <Feather name="upload" size={15} color="#f5ebd6" />
              <Text
                className="text-[13.5px]"
                style={{ fontFamily: "Manrope-SemiBold", color: "#f5ebd6" }}
              >
                {staged.length === 0
                  ? "Pick something to attach"
                  : `Upload ${staged.length} ${staged.length === 1 ? "file" : "files"}`}
              </Text>
            </>
          )}
        </Pressable>
        <View style={{ height: 16 }} />
      </ScrollView>
    </Sheet>
  );
}

function SourceButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-1 items-center rounded-xl py-3.5 active:opacity-85"
      style={{
        backgroundColor: "#ffffff",
        borderWidth: 1.5,
        borderColor: "#e3d9c0",
        borderStyle: "dashed",
        opacity: disabled ? 0.45 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={`Attach from ${label}`}
    >
      <Feather name={icon} size={17} color="#8a5821" />
      <Text
        className="mt-1.5 text-[12px]"
        style={{ fontFamily: "Manrope-SemiBold", color: "#0a1124" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Banner({ tone, text }: { tone: "danger" | "success"; text: string }) {
  const danger = tone === "danger";
  return (
    <View
      className="mt-3 rounded-md px-3.5 py-2.5 flex-row items-start gap-2"
      style={{ backgroundColor: danger ? "#f6dccd" : "rgba(108,152,88,0.14)" }}
    >
      <Feather
        name={danger ? "alert-triangle" : "check-circle"}
        size={14}
        color={danger ? "#c14a37" : "#6c9858"}
      />
      <Text
        className="flex-1 text-[12.5px] leading-[18px]"
        style={{
          fontFamily: "Manrope",
          color: danger ? "#c14a37" : "#3a5a40",
        }}
      >
        {text}
      </Text>
    </View>
  );
}
