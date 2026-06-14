import { useState } from "react";
import { View, Text, Pressable, TextInput, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import DatePickerSheet from "./workflow/DatePickerSheet";

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  invalid,
  autoCapitalize,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "phone-pad" | "numeric" | "email-address";
  multiline?: boolean;
}) {
  return (
    <View>
      <Text
        className="text-[10px] font-semibold uppercase text-app-fg-muted"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
      >
        {label}
        {required ? <Text style={{ color: "#c5853a" }}>{"  *"}</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a89c80"
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        keyboardType={keyboardType}
        multiline={multiline}
        className="mt-1.5 rounded-md border bg-app-paper px-3.5 py-3 text-[15px] text-app-ink"
        style={{
          fontFamily: "Manrope",
          borderColor: invalid ? "#c14a37" : "#e3d9c0",
          minHeight: multiline ? 72 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

export function SheetField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text
        className="text-[10px] font-semibold uppercase text-app-fg-muted"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
      >
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="mt-1.5 flex-row items-center justify-between rounded-md border bg-app-paper px-3.5 py-3 active:opacity-70"
        style={{ borderColor: "#e3d9c0" }}
      >
        <Text
          className="text-[15px] text-app-ink"
          style={{ fontFamily: "Manrope" }}
        >
          {value}
        </Text>
        <Feather name="chevron-down" size={16} color="#8a5821" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1"
          style={{ backgroundColor: "rgba(10,17,36,0.55)" }}
        >
          <View
            className="mt-auto rounded-t-3xl bg-app-paper px-5 pt-3 pb-8"
            style={{
              shadowColor: "#0a1124",
              shadowOpacity: 0.2,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: -6 },
              elevation: 12,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              className="self-center mb-3 h-1.5 w-12 rounded-full"
              style={{ backgroundColor: "#e3d9c0" }}
            />
            <Text
              className="text-[10px] uppercase text-app-copper-deep mb-3"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              {label}
            </Text>
            {options.map((opt) => {
              const active = value === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between py-3.5 active:opacity-50"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#efe5d0",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: active ? "Manrope-SemiBold" : "Manrope",
                      fontSize: 15,
                      color: active ? "#0a1124" : "#4d4538",
                    }}
                  >
                    {opt}
                  </Text>
                  {active ? (
                    <Feather name="check" size={16} color="#c5853a" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const initial = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

  return (
    <View>
      <Text
        className="text-[10px] font-semibold uppercase text-app-fg-muted"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
      >
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="mt-1.5 flex-row items-center justify-between rounded-md border bg-app-paper px-3.5 py-3 active:opacity-70"
        style={{ borderColor: "#e3d9c0" }}
      >
        <Text
          style={{
            fontFamily: value ? "DMMono-Medium" : "Manrope",
            fontSize: 15,
            color: value ? "#0a1124" : "#a89c80",
            letterSpacing: value ? 0.5 : 0,
          }}
        >
          {value ? formatDateForDisplay(value) : "Tap to set date"}
        </Text>
        <Feather name="calendar" size={15} color="#8a5821" />
      </Pressable>

      {/* Real month-grid calendar (today highlighted), shared with workflow. */}
      <DatePickerSheet
        visible={open}
        initial={initial}
        onClose={() => setOpen(false)}
        onPick={(d) => {
          onChange(d ? d.toISOString().slice(0, 10) : "");
          setOpen(false);
        }}
      />
    </View>
  );
}

export function formatDateForDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return iso;
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
