import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Sheet from "../Sheet";
import { ActionRow } from "../ExportSheet";
import { formatBytes } from "../../lib/exports";
import {
  FileOpError,
  printFile,
  saveToDevice,
  shareFile,
  type DownloadedFile,
} from "../../lib/files";

// Board-specific export sheet — mirrors the web canvas's Save menu:
//   Picture (.png)   · snapshot of the whole board
//   Document (.pdf)  · the snapshot on an A4 page
//   Data (.xlsx)     · server-generated workbook
// PNG/PDF need the screen to mount the capture view, so the screen owns
// those via `capture`; xlsx goes through the normal download pipeline.

type Option = "png" | "pdf" | "xlsx";

const OPTIONS: {
  key: Option;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
}[] = [
  {
    key: "png",
    icon: "image",
    label: "Picture",
    hint: "The whole board as one .png",
  },
  {
    key: "pdf",
    icon: "file-text",
    label: "Document",
    hint: "Print-ready A4 .pdf snapshot",
  },
  {
    key: "xlsx",
    icon: "grid",
    label: "Data",
    hint: "Lists, cards & checklists as .xlsx",
  },
];

export default function BoardExportSheet({
  visible,
  onClose,
  contextLine,
  exportXlsx,
  capture,
}: {
  visible: boolean;
  onClose: () => void;
  contextLine: string;
  exportXlsx: () => Promise<DownloadedFile>;
  capture: (format: "png" | "pdf") => Promise<DownloadedFile>;
}) {
  const [working, setWorking] = useState<Option | null>(null);
  const [file, setFile] = useState<DownloadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setWorking(null);
      setFile(null);
      setError(null);
      setSavedNote(null);
    }
  }, [visible]);

  async function run(option: Option) {
    if (working) return;
    setWorking(option);
    setError(null);
    try {
      const out =
        option === "xlsx" ? await exportXlsx() : await capture(option);
      setFile(out);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Export failed. Try again."
      );
    } finally {
      setWorking(null);
    }
  }

  async function handle(action: "share" | "save" | "print") {
    if (!file) return;
    setSavedNote(null);
    try {
      if (action === "share") {
        await shareFile(file.uri, file.mime, file.filename);
      } else if (action === "save") {
        const res = await saveToDevice(file.uri, file.filename, file.mime);
        if (res === "saved") setSavedNote("Saved to the chosen folder.");
      } else {
        await printFile(file.uri, file.mime);
      }
    } catch (err) {
      setError(
        err instanceof FileOpError || err instanceof Error
          ? err.message
          : "That didn't work. Try again."
      );
    }
  }

  const printable =
    file &&
    (file.mime === "application/pdf" || file.mime.startsWith("image/"));

  return (
    <Sheet
      visible={visible}
      onClose={working ? () => {} : onClose}
      eyebrow="Workflow"
      title="Save this board"
      showClose={!working}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Text
          className="text-[11px] text-app-fg-muted mb-3"
          style={{ fontFamily: "DMMono", letterSpacing: 0.6 }}
        >
          {contextLine}
        </Text>

        {error ? (
          <View
            className="rounded-md px-3.5 py-2.5 mb-3 flex-row items-start gap-2"
            style={{ backgroundColor: "#f6dccd" }}
          >
            <Feather name="alert-triangle" size={14} color="#c14a37" />
            <Text
              className="flex-1 text-[12.5px] leading-[18px]"
              style={{ fontFamily: "Manrope", color: "#c14a37" }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {file ? (
          <>
            <View
              className="rounded-xl bg-app-paper px-4 py-3.5 flex-row items-center gap-3"
              style={{
                borderWidth: 1,
                borderColor: "#e3d9c0",
                borderLeftWidth: 3,
                borderLeftColor: "#6c9858",
              }}
            >
              <View
                className="h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: "#efe5d0" }}
              >
                <Feather
                  name={file.mime.startsWith("image/") ? "image" : "file-text"}
                  size={18}
                  color="#8a5821"
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-[13.5px] text-app-ink"
                  style={{ fontFamily: "Manrope-SemiBold" }}
                  numberOfLines={2}
                >
                  {file.filename}
                </Text>
                <Text
                  className="text-[10px] mt-0.5 text-app-fg-muted"
                  style={{ fontFamily: "DMMono", letterSpacing: 0.6 }}
                >
                  READY{file.size ? ` · ${formatBytes(file.size)}` : ""}
                </Text>
              </View>
              <Feather name="check-circle" size={18} color="#6c9858" />
            </View>
            {savedNote ? (
              <Text
                className="mt-2 text-[11px]"
                style={{
                  fontFamily: "DMMono",
                  color: "#6c9858",
                  letterSpacing: 0.4,
                }}
              >
                {savedNote}
              </Text>
            ) : null}
            <View className="mt-4 gap-2.5">
              <ActionRow
                icon="share-2"
                label="Share"
                onPress={() => handle("share")}
                primary
              />
              <ActionRow
                icon="folder"
                label="Save to device"
                onPress={() => handle("save")}
              />
              {printable ? (
                <ActionRow
                  icon="printer"
                  label="Print"
                  onPress={() => handle("print")}
                />
              ) : null}
            </View>
            <View className="mt-4 flex-row items-center justify-between">
              <Pressable
                onPress={() => setFile(null)}
                hitSlop={8}
                className="active:opacity-50"
              >
                <Text
                  className="text-[11px] uppercase"
                  style={{
                    fontFamily: "DMMono-Medium",
                    letterSpacing: 1.4,
                    color: "#8a5821",
                  }}
                >
                  Save another
                </Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                className="active:opacity-50"
              >
                <Text
                  className="text-[11px] uppercase"
                  style={{
                    fontFamily: "DMMono-Medium",
                    letterSpacing: 1.4,
                    color: "#7a7060",
                  }}
                >
                  Done
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View className="gap-2.5">
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => run(opt.key)}
                disabled={working !== null}
                className="flex-row items-center gap-3 rounded-xl px-4 active:opacity-85"
                style={{
                  minHeight: 56,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                  opacity: working && working !== opt.key ? 0.5 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
              >
                {working === opt.key ? (
                  <ActivityIndicator size="small" color="#8a5821" />
                ) : (
                  <Feather name={opt.icon} size={17} color="#8a5821" />
                )}
                <View className="flex-1">
                  <Text
                    className="text-[14px] text-app-ink"
                    style={{ fontFamily: "Manrope-SemiBold" }}
                  >
                    {working === opt.key ? "Preparing…" : opt.label}
                  </Text>
                  <Text
                    className="text-[11px] mt-0.5 text-app-fg-muted"
                    style={{ fontFamily: "Manrope" }}
                  >
                    {opt.hint}
                  </Text>
                </View>
                <Feather name="chevron-right" size={14} color="#8a5821" />
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ height: 16 }} />
      </View>
    </Sheet>
  );
}
