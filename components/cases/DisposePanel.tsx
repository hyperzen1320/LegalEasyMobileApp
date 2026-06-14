import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Sheet from "../Sheet";
import { useAuth } from "../../lib/auth-context";
import {
  ApiError,
  partnerUpdateCase,
  type PartnerCase,
} from "../../lib/api";

// Disposal is the archive lever: status → "Disposed" stamps disposedAt
// and moves the matter to the archive; any other status clears it. Both
// transitions are office-admin only on the server, so the controls only
// render for the admin. Active cases get a "close the matter" row with
// an optional remarks note; disposed ones get the stamp + reopen.

export default function DisposePanel({
  c,
  onChanged,
}: {
  c: PartnerCase;
  onChanged: (next: PartnerCase) => void;
}) {
  const { isPartnerAdmin } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disposed = Boolean(c.disposedAt);

  async function dispose() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await partnerUpdateCase(c.id, {
        status: "Disposed",
        disposalRemarks: remarks.trim(),
      });
      setSheetOpen(false);
      setRemarks("");
      onChanged(res.case);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't dispose. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmReopen() {
    Alert.alert(
      "Reopen this matter?",
      `${c.caseNo} returns to the Case Vault with status “Filed”.`,
      [
        { text: "Keep archived", style: "cancel" },
        { text: "Reopen", onPress: () => void reopen() },
      ]
    );
  }

  async function reopen() {
    setBusy(true);
    try {
      const res = await partnerUpdateCase(c.id, { status: "Filed" });
      onChanged(res.case);
    } catch (err) {
      Alert.alert(
        "Couldn't reopen",
        err instanceof ApiError ? err.message : "Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (disposed) {
    const when = c.disposedAt
      ? new Date(c.disposedAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "";
    return (
      <View
        className="mt-4 rounded-xl p-4"
        style={{
          backgroundColor: "#faf6ed",
          borderWidth: 1,
          borderColor: "#e3d9c0",
        }}
      >
        <View className="flex-row items-center justify-between">
          <View
            className="rounded-sm px-2 py-1"
            style={{
              borderWidth: 1.5,
              borderColor: "rgba(126,119,99,0.6)",
              transform: [{ rotate: "-2deg" }],
            }}
          >
            <Text
              className="text-[10px] uppercase"
              style={{
                fontFamily: "DMMono-Medium",
                letterSpacing: 1.6,
                color: "#7e7763",
              }}
            >
              Disposed · {when}
            </Text>
          </View>
          {isPartnerAdmin ? (
            <Pressable
              onPress={confirmReopen}
              disabled={busy}
              className="flex-row items-center gap-1.5 rounded-md px-3 py-2 active:opacity-80"
              style={{ backgroundColor: "#efe5d0" }}
              accessibilityRole="button"
              accessibilityLabel="Reopen matter"
            >
              {busy ? (
                <ActivityIndicator size="small" color="#8a5821" />
              ) : (
                <Feather name="rotate-ccw" size={13} color="#8a5821" />
              )}
              <Text
                className="text-[12px]"
                style={{ fontFamily: "Manrope-SemiBold", color: "#8a5821" }}
              >
                Reopen
              </Text>
            </Pressable>
          ) : null}
        </View>
        {c.disposalRemarks ? (
          <Text
            className="mt-3 text-[13px] leading-[20px] text-app-fg-soft"
            style={{ fontFamily: "Manrope" }}
          >
            “{c.disposalRemarks}”
          </Text>
        ) : null}
      </View>
    );
  }

  if (!isPartnerAdmin) return null;

  return (
    <>
      <Pressable
        onPress={() => {
          setError(null);
          setSheetOpen(true);
        }}
        className="mt-4 rounded-xl bg-app-paper p-4 flex-row items-center gap-3 active:opacity-85"
        style={{
          shadowColor: "#0a1124",
          shadowOpacity: 0.05,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        }}
        accessibilityRole="button"
        accessibilityLabel="Mark case as disposed"
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: "#efe5d0" }}
        >
          <Feather name="archive" size={15} color="#8a5821" />
        </View>
        <View className="flex-1">
          <Text
            className="text-[14px] text-app-ink"
            style={{ fontFamily: "Manrope-SemiBold" }}
          >
            Close the matter
          </Text>
          <Text
            className="text-[11px] mt-0.5 text-app-fg-muted"
            style={{ fontFamily: "Manrope" }}
          >
            Mark as Disposed and move it to the archive.
          </Text>
        </View>
        <Feather name="chevron-right" size={15} color="#8a5821" />
      </Pressable>

      <Sheet
        visible={sheetOpen}
        onClose={busy ? () => {} : () => setSheetOpen(false)}
        eyebrow="The Archive"
        title={`Dispose ${c.caseNo}`}
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
            Disposal note (optional)
          </Text>
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Decree passed / settled / withdrawn — how did it end?"
            placeholderTextColor="#a89c80"
            multiline
            numberOfLines={3}
            className="rounded-xl bg-app-paper px-3.5 py-3 text-[14px] text-app-ink"
            style={{
              fontFamily: "Manrope",
              minHeight: 84,
              textAlignVertical: "top",
              borderWidth: 1,
              borderColor: "#e3d9c0",
            }}
          />

          <Pressable
            onPress={dispose}
            disabled={busy}
            className="mt-4 rounded-xl items-center justify-center flex-row gap-2 active:opacity-90"
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
            accessibilityLabel="Confirm disposal"
          >
            {busy ? (
              <ActivityIndicator size="small" color="#f5ebd6" />
            ) : (
              <Feather name="archive" size={15} color="#f5ebd6" />
            )}
            <Text
              className="text-[13.5px]"
              style={{ fontFamily: "Manrope-SemiBold", color: "#f5ebd6" }}
            >
              {busy ? "Archiving…" : "Dispose & archive"}
            </Text>
          </Pressable>
          <View style={{ height: 16 }} />
        </View>
      </Sheet>
    </>
  );
}
