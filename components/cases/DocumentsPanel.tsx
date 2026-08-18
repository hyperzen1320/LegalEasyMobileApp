import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Sheet from "../Sheet";
import ConfirmSheet from "../ConfirmSheet";
import RequestDeleteSheet from "../workflow/RequestDeleteSheet";
import AttachDocumentsSheet from "../files/AttachDocumentsSheet";
import {
  ApiError,
  caseDocumentPath,
  deleteRequestRequired,
  partnerDeleteCaseDocument,
  partnerListCaseDocuments,
  type CaseDocumentDTO,
  type DeleteRequestRequiredError,
} from "../../lib/api";
import {
  downloadAuthorized,
  openFile,
  printFile,
  saveToDevice,
  shareFile,
  type DownloadedFile,
} from "../../lib/files";
import { formatBytes } from "../../lib/exports";
import { useAuth } from "../../lib/auth-context";

// The case's briefcase — list, upload, view, and (for the office admin)
// share / save / print / delete of GridFS-stored documents.
//
// Everyone in chambers can add papers and read them. Taking one OUT of
// the office — sharing it, saving it to the phone, printing it — and
// removing one are the admin's calls.
//
// DELETE is genuinely enforced server-side (non-admins get a 403 and must
// raise a delete request). Share / save / print are NOT, and can't be:
// anyone allowed to view a document necessarily receives its bytes. The
// gate there is which buttons this sheet renders. Worth being clear-eyed
// about rather than mistaking the earlier ?download=1 check for a data
// boundary — it only ever changed a Content-Disposition header.

export default function DocumentsPanel({ caseId }: { caseId: string }) {
  const { isPartnerAdmin } = useAuth();
  const [docs, setDocs] = useState<CaseDocumentDTO[] | null>(null);
  // The list is folded until asked for. It only ever grows — a matter a
  // few years old carries twenty-odd papers — and left open it buried the
  // hearing history and the disposal record below it.
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  // Which picker the Upload menu should open the attach sheet with.
  const [uploadMenu, setUploadMenu] = useState(false);
  const [uploadSource, setUploadSource] =
    useState<"files" | "library" | "camera" | null>(null);
  const [active, setActive] = useState<CaseDocumentDTO | null>(null);
  const [busy, setBusy] = useState<
    null | "preview" | "view" | "share" | "save" | "print" | "delete"
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [requestTarget, setRequestTarget] =
    useState<DeleteRequestRequiredError | null>(null);
  const [confirmDelDoc, setConfirmDelDoc] = useState<CaseDocumentDTO | null>(
    null
  );
  const [preview, setPreview] = useState<{
    doc: CaseDocumentDTO;
    file: DownloadedFile;
  } | null>(null);

  // Downloaded-file cache per document id — repeat actions on the same
  // paper shouldn't re-pull 20 MB over the tunnel.
  const cacheRef = useRef(new Map<string, DownloadedFile>());

  const load = useCallback(async () => {
    try {
      const res = await partnerListCaseDocuments(caseId);
      setDocs(res.documents);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't load documents"
      );
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  // Pull the bytes into the app cache.
  //
  // Deliberately WITHOUT ?download=1. That flag only flips the server's
  // Content-Disposition from `inline` to `attachment` — which matters to a
  // browser and to nothing else. The app reads the bytes off the local
  // file for every action (share, save, print, view), so the header is
  // irrelevant here; the filename still arrives either way.
  //
  // It was actively harmful: the server 403s ?download=1 for non-admins,
  // so asking for it meant a plain user couldn't even VIEW a document —
  // the one action they're allowed. Which buttons exist is what enforces
  // the permission (see the sheet below), not this query parameter.
  async function ensureLocal(doc: CaseDocumentDTO): Promise<DownloadedFile> {
    const hit = cacheRef.current.get(doc.id);
    if (hit) return hit;
    const file = await downloadAuthorized(
      caseDocumentPath(caseId, doc.id),
      { fallbackName: doc.filename, mime: doc.contentType }
    );
    cacheRef.current.set(doc.id, file);
    return file;
  }

  async function act(
    action: "preview" | "view" | "share" | "save" | "print"
  ) {
    if (!active || busy) return;
    setBusy(action);
    setActionError(null);
    try {
      const file = await ensureLocal(active);
      if (action === "preview") {
        setPreview({ doc: active, file });
        setActive(null);
      } else if (action === "view") {
        // Read-only: hands the paper to a viewer, never to a send target.
        await openFile(file.uri, file.mime);
        setActive(null);
      } else if (action === "share") {
        await shareFile(file.uri, file.mime, active.filename);
      } else if (action === "save") {
        await saveToDevice(file.uri, active.filename, file.mime);
      } else {
        await printFile(file.uri, file.mime);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "That didn't work. Try again."
      );
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    if (!active || busy) return;
    // Hand the actions sheet over to the custom confirm sheet.
    setActionError(null);
    setConfirmDelDoc(active);
    setActive(null);
  }

  async function doDelete(doc: CaseDocumentDTO) {
    setBusy("delete");
    setActionError(null);
    try {
      await partnerDeleteCaseDocument(caseId, doc.id);
      cacheRef.current.delete(doc.id);
      setConfirmDelDoc(null);
      await load();
    } catch (err) {
      const reqd = deleteRequestRequired(err);
      if (reqd) {
        setConfirmDelDoc(null);
        setRequestTarget(reqd);
      } else {
        setActionError(
          err instanceof ApiError ? err.message : "Couldn't delete. Try again."
        );
      }
    } finally {
      setBusy(null);
    }
  }

  const count = docs?.length ?? 0;

  return (
    <View
      className="mt-4 rounded-xl bg-app-paper p-4"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {/* Header — the title block is the disclosure control */}
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => setOpen((v) => !v)}
          disabled={count === 0}
          className="flex-1 flex-row items-center gap-2 active:opacity-70"
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={
            count === 0
              ? "Documents"
              : open
                ? `Hide ${count} documents`
                : `Show ${count} documents`
          }
        >
          <View>
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              Briefcase
            </Text>
            <View className="flex-row items-baseline gap-2 mt-0.5">
              <Text
                className="text-[16px] tracking-tight text-app-ink"
                style={{ fontFamily: "Crimson-SemiBold" }}
              >
                Documents
              </Text>
              {count > 0 ? (
                <Text
                  className="text-[11px] text-app-fg-muted tabular-nums"
                  style={{ fontFamily: "DMMono", letterSpacing: 0.5 }}
                >
                  · {count}
                </Text>
              ) : null}
            </View>
          </View>
          {count > 0 ? (
            <Feather
              name={open ? "chevron-up" : "chevron-down"}
              size={16}
              color="#8a5821"
            />
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => setUploadMenu(true)}
          className="rounded-md flex-row items-center gap-1.5 px-3 py-2 active:opacity-90"
          style={{ backgroundColor: "#c5853a" }}
          accessibilityRole="button"
          accessibilityLabel="Upload documents"
        >
          <Feather name="upload" size={13} color="#2a1c08" />
          <Text
            className="text-[12px]"
            style={{ fontFamily: "Manrope-SemiBold", color: "#2a1c08" }}
          >
            Upload
          </Text>
          <Feather name="chevron-down" size={13} color="#2a1c08" />
        </Pressable>
      </View>

      {/* Body */}
      {docs === null && !error ? (
        <View className="items-center py-6">
          <ActivityIndicator color="#c5853a" size="small" />
        </View>
      ) : error ? (
        <Pressable
          onPress={load}
          className="mt-3 rounded-md px-3.5 py-2.5 active:opacity-70"
          style={{ backgroundColor: "#f6dccd" }}
        >
          <Text
            className="text-[12.5px]"
            style={{ fontFamily: "Manrope", color: "#c14a37" }}
          >
            {error} — tap to retry
          </Text>
        </Pressable>
      ) : count === 0 ? (
        <View
          className="mt-3.5 rounded-lg items-center py-7 px-4"
          style={{
            borderWidth: 1.5,
            borderColor: "#e3d9c0",
            borderStyle: "dashed",
            backgroundColor: "#faf6ed",
          }}
        >
          <Feather name="file-plus" size={18} color="#a89c80" />
          <Text
            className="mt-2 text-[12.5px] text-app-fg-muted text-center"
            style={{ fontFamily: "Manrope" }}
          >
            No papers attached yet. Pleadings, orders, vakalats — keep the
            whole brief with the matter.
          </Text>
        </View>
      ) : !open ? (
        // Folded. A matter that has been running a few years carries
        // twenty-odd papers, and the list used to push the hearing
        // history and the disposal record off the bottom of the dossier.
        // The count is on the header above; this is the door.
        <Pressable
          onPress={() => setOpen(true)}
          className="mt-3.5 flex-row items-center justify-center gap-2 rounded-lg py-3 active:opacity-70"
          style={{
            borderWidth: 1,
            borderColor: "#e3d9c0",
            backgroundColor: "#faf6ed",
          }}
          accessibilityRole="button"
          accessibilityLabel={`Show ${count} documents`}
        >
          <Feather name="folder" size={14} color="#8a5821" />
          <Text
            className="text-[12.5px]"
            style={{ fontFamily: "Manrope-SemiBold", color: "#8a5821" }}
          >
            {count === 1 ? "1 paper on file" : `${count} papers on file`}
          </Text>
          <Feather name="chevron-down" size={14} color="#8a5821" />
        </Pressable>
      ) : (
        <View className="mt-3.5">
          {docs!.map((d, i) => (
            <Pressable
              key={d.id}
              onPress={() => {
                setActionError(null);
                setActive(d);
              }}
              className="flex-row items-center gap-3 active:opacity-70"
              style={{
                minHeight: 52,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "#efe5d0",
              }}
              accessibilityRole="button"
              accessibilityLabel={`Document ${d.filename}`}
            >
              <View
                className="h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: "#efe5d0" }}
              >
                <Feather name={glyphFor(d)} size={15} color="#8a5821" />
              </View>
              <View className="flex-1 min-w-0">
                <Text
                  className="text-[13.5px] text-app-ink"
                  style={{ fontFamily: "Manrope-SemiBold" }}
                  numberOfLines={1}
                >
                  {d.filename}
                </Text>
                <Text
                  className="text-[10px] mt-0.5 text-app-fg-muted"
                  style={{ fontFamily: "DMMono", letterSpacing: 0.4 }}
                  numberOfLines={1}
                >
                  {d.uploadedByName || "—"} ·{" "}
                  {new Date(d.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                  {d.size ? ` · ${formatBytes(d.size)}` : ""}
                </Text>
              </View>
              <Feather name="more-horizontal" size={16} color="#8a5821" />
            </Pressable>
          ))}
        </View>
      )}

      {/* Attach flow */}
      <AttachDocumentsSheet
        visible={attachOpen}
        initialSource={uploadSource}
        onClose={() => {
          setAttachOpen(false);
          setUploadSource(null);
        }}
        caseId={caseId}
        onUploaded={async () => {
          // Unfold after an upload — you've just added a paper and the
          // next thing you want is to see it land.
          await load();
          setOpen(true);
        }}
      />

      {/* Upload ▾ — pick where the papers come from, then the staging
          sheet opens with that picker already running. */}
      <Sheet
        visible={uploadMenu}
        onClose={() => setUploadMenu(false)}
        eyebrow="Briefcase"
        title="Upload documents"
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 6,
            paddingBottom: 20,
            gap: 10,
          }}
        >
          {(
            [
              { key: "files", icon: "file", label: "Files on this device" },
              { key: "library", icon: "image", label: "Photo library" },
              { key: "camera", icon: "camera", label: "Take a photo" },
            ] as const
          ).map((o) => (
            <DocAction
              key={o.key}
              icon={o.icon}
              label={o.label}
              onPress={() => {
                setUploadMenu(false);
                setUploadSource(o.key);
                setAttachOpen(true);
              }}
            />
          ))}
        </View>
      </Sheet>

      {/* Per-document actions */}
      <Sheet
        visible={Boolean(active)}
        onClose={busy ? () => {} : () => setActive(null)}
        eyebrow="Document"
        title={active?.filename ?? ""}
        showClose={!busy}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          {actionError ? (
            <View
              className="rounded-md px-3.5 py-2.5 mb-3"
              style={{ backgroundColor: "#f6dccd" }}
            >
              <Text
                className="text-[12.5px]"
                style={{ fontFamily: "Manrope", color: "#c14a37" }}
              >
                {actionError}
              </Text>
            </View>
          ) : null}

          <View className="gap-2.5">
            {/* View is everyone's. Images open in the in-app viewer;
                anything else is handed to a system viewer. */}
            {active && active.contentType.startsWith("image/") ? (
              <DocAction
                icon="eye"
                label="View"
                busy={busy === "preview"}
                onPress={() => act("preview")}
                primary
              />
            ) : (
              <DocAction
                icon="eye"
                label="View"
                busy={busy === "view"}
                onPress={() => act("view")}
                primary
              />
            )}

            {/* Everything that takes the paper out of the office is the
                office admin's call. The API says the same thing. */}
            {isPartnerAdmin ? (
              <>
                <DocAction
                  icon="share-2"
                  label="Share"
                  busy={busy === "share"}
                  onPress={() => act("share")}
                />
                <DocAction
                  icon="folder"
                  label="Save to device"
                  busy={busy === "save"}
                  onPress={() => act("save")}
                />
                {active &&
                (active.contentType === "application/pdf" ||
                  active.contentType.startsWith("image/")) ? (
                  <DocAction
                    icon="printer"
                    label="Print"
                    busy={busy === "print"}
                    onPress={() => act("print")}
                  />
                ) : null}
                <DocAction
                  icon="trash-2"
                  label="Remove from case"
                  busy={busy === "delete"}
                  onPress={confirmDelete}
                  danger
                />
              </>
            ) : (
              <Text
                className="text-[11.5px] text-app-fg-muted"
                style={{ fontFamily: "Manrope", lineHeight: 17 }}
              >
                Sharing, saving and removing papers are the office admin&rsquo;s
                to do.
              </Text>
            )}
          </View>
          <View style={{ height: 16 }} />
        </View>
      </Sheet>

      {/* Non-admin delete → reason sheet (same flow as boards/cases) */}
      <RequestDeleteSheet
        target={requestTarget}
        onClose={() => setRequestTarget(null)}
        onSubmitted={() => {
          setRequestTarget(null);
          Alert.alert("Sent for review", "The office admin has been notified.");
        }}
      />

      <ConfirmSheet
        visible={confirmDelDoc !== null}
        onClose={() => {
          setConfirmDelDoc(null);
          setActionError(null);
        }}
        onConfirm={() => {
          if (confirmDelDoc) void doDelete(confirmDelDoc);
        }}
        busy={busy === "delete"}
        error={actionError}
        title="Remove this document?"
        message={`“${
          confirmDelDoc?.filename ?? "This document"
        }” will be removed from the case file. This can't be undone.`}
        confirmLabel="Remove"
      />

      {/* Full-screen image preview */}
      <ImagePreview
        item={preview}
        canShare={isPartnerAdmin}
        onClose={() => setPreview(null)}
        onShare={async () => {
          if (!preview) return;
          try {
            await shareFile(
              preview.file.uri,
              preview.file.mime,
              preview.doc.filename
            );
          } catch {
            /* user cancelled or no share target — nothing to do */
          }
        }}
      />
    </View>
  );
}

function glyphFor(d: CaseDocumentDTO): keyof typeof Feather.glyphMap {
  if (d.contentType.startsWith("image/")) return "image";
  if (d.contentType === "application/pdf") return "file-text";
  return "file";
}

function DocAction({
  icon,
  label,
  onPress,
  busy,
  primary,
  danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  busy?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const fg = danger ? "#c14a37" : primary ? "#2a1c08" : "#0a1124";
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className="flex-row items-center gap-3 rounded-xl px-4 active:opacity-85"
      style={{
        minHeight: 48,
        backgroundColor: primary ? "#c5853a" : "#ffffff",
        borderWidth: 1,
        borderColor: danger ? "rgba(193,74,55,0.35)" : primary ? "#8a5821" : "#e3d9c0",
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Feather
          name={icon}
          size={16}
          color={danger ? "#c14a37" : primary ? "#2a1c08" : "#8a5821"}
        />
      )}
      <Text
        className="text-[14px]"
        style={{ fontFamily: "Manrope-SemiBold", color: fg }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ImagePreview({
  item,
  canShare,
  onClose,
  onShare,
}: {
  item: { doc: CaseDocumentDTO; file: DownloadedFile } | null;
  // Sharing out of the office is admin-only; everyone else just looks.
  canShare: boolean;
  onClose: () => void;
  onShare: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={Boolean(item)}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: "#0a1124" }}>
        <View
          className="flex-row items-center justify-between px-5"
          style={{ paddingTop: insets.top + 8, paddingBottom: 10 }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={10}
            className="h-9 w-9 items-center justify-center rounded-md active:opacity-60"
            style={{ backgroundColor: "rgba(245,235,214,0.12)" }}
            accessibilityLabel="Close preview"
          >
            <Feather name="x" size={18} color="#f5ebd6" />
          </Pressable>
          <Text
            className="flex-1 mx-3 text-center text-[12px]"
            style={{ fontFamily: "DMMono", color: "#c4baa3" }}
            numberOfLines={1}
          >
            {item?.doc.filename ?? ""}
          </Text>
          {canShare ? (
            <Pressable
              onPress={onShare}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-md active:opacity-60"
              style={{ backgroundColor: "rgba(245,235,214,0.12)" }}
              accessibilityLabel="Share image"
            >
              <Feather name="share-2" size={16} color="#f5ebd6" />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>
        {item ? (
          <Image
            source={{ uri: item.file.uri }}
            resizeMode="contain"
            style={{ flex: 1, marginBottom: insets.bottom }}
          />
        ) : null}
      </View>
    </Modal>
  );
}
