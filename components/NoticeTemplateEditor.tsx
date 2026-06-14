import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { NOTICE_TOKENS } from "../lib/notice-template";
import { partnerSaveNoticeTemplate } from "../lib/api";

// The office's pre-filled WhatsApp message. Admins edit and save it; everyone
// else sees it read-only. Tapping a field chip drops a merge token like
// {{caseNo}} / {{nextHearingDate}} at the cursor, filled per matter when the
// advocate taps WhatsApp on a hearing. (RN port of the web editor; the web's
// live "@" popup is replaced by tap-to-insert chips.)

export default function NoticeTemplateEditor({
  initialTemplate,
  isAdmin,
}: {
  initialTemplate: string;
  isAdmin: boolean;
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const [saved, setSaved] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Last known caret, so a chip inserts where the advocate was typing.
  const sel = useRef<{ start: number; end: number }>({
    start: initialTemplate.length,
    end: initialTemplate.length,
  });

  const dirty = template !== saved;

  function insertToken(token: string) {
    const piece = `{{${token}}}`;
    const { start, end } = sel.current;
    const next = template.slice(0, start) + piece + template.slice(end);
    setTemplate(next);
    const pos = start + piece.length;
    sel.current = { start: pos, end: pos };
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await partnerSaveNoticeTemplate(template);
      setSaved(res.template ?? template);
      setFlash(true);
      setTimeout(() => setFlash(false), 2200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save the template."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      className="rounded-2xl bg-app-paper p-5"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text
            className="text-[10px] uppercase text-app-copper-deep"
            style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
          >
            Hearing Track
          </Text>
          <Text
            className="mt-1 text-[18px] font-semibold tracking-tight text-app-ink"
            style={{ fontFamily: "Crimson-SemiBold" }}
          >
            Pre-filled WhatsApp message
          </Text>
          <Text
            className="mt-1.5 text-[12.5px] leading-5 text-app-fg-muted"
            style={{ fontFamily: "Manrope" }}
          >
            This is what fills in when you tap WhatsApp on a hearing.
            {isAdmin
              ? " Tap a field below to insert a detail like the case number or next date."
              : " Only the office admin can edit it."}
          </Text>
        </View>
        {flash ? (
          <Text
            className="text-[10px] uppercase"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.6,
              color: "#56a0a8",
            }}
          >
            Saved ✓
          </Text>
        ) : null}
      </View>

      {isAdmin ? (
        <>
          <TextInput
            value={template}
            onChangeText={setTemplate}
            onSelectionChange={(e) => {
              sel.current = e.nativeEvent.selection;
            }}
            multiline
            textAlignVertical="top"
            placeholder="Your WhatsApp message…"
            placeholderTextColor="#a89c80"
            className="mt-4 rounded-md border bg-app-canvas-2 px-3.5 py-3 text-[13.5px] text-app-ink"
            style={{
              fontFamily: "Manrope",
              borderColor: "#e3d9c0",
              minHeight: 184,
              lineHeight: 22,
            }}
          />

          {/* Field chips — tap to insert a merge token at the cursor */}
          <View className="mt-3 flex-row flex-wrap gap-1.5">
            {NOTICE_TOKENS.map((t) => (
              <Pressable
                key={t.token}
                onPress={() => insertToken(t.token)}
                className="rounded-full px-2.5 py-1 active:opacity-70"
                style={{
                  backgroundColor: "#efe5d0",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 11,
                    color: "#8a5821",
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {error ? (
            <Text
              className="mt-3 text-[12.5px]"
              style={{ fontFamily: "Manrope", color: "#c14a37" }}
            >
              {error}
            </Text>
          ) : null}

          <View className="mt-5 flex-row justify-end">
            <Pressable
              onPress={save}
              disabled={saving || !dirty}
              className="rounded-md flex-row items-center justify-center gap-2 px-6 py-2.5 active:opacity-90"
              style={{
                backgroundColor: dirty ? "#c5853a" : "#efe5d0",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#2a1c08" />
              ) : null}
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 13,
                  color: dirty ? "#2a1c08" : "#a89c80",
                }}
              >
                {saving ? "Saving…" : "Save Message"}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View
          className="mt-4 rounded-md px-4 py-3"
          style={{
            backgroundColor: "#efe5d0",
            borderWidth: 1,
            borderColor: "#e3d9c0",
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope",
              fontSize: 13.5,
              color: "#0a1124",
              lineHeight: 22,
            }}
          >
            {template}
          </Text>
        </View>
      )}
    </View>
  );
}
