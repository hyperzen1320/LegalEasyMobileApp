import { useState } from "react";
import { View, Text, Pressable, TextInput, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";

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
  const initial = parseDate(value);
  const [d, setD] = useState(initial.d);
  const [m, setM] = useState(initial.m);
  const [y, setY] = useState(initial.y);

  function openPicker() {
    const p = parseDate(value);
    setD(p.d);
    setM(p.m);
    setY(p.y);
    setOpen(true);
  }

  function commit() {
    const dn = parseInt(d, 10);
    const mn = parseInt(m, 10);
    const yn = parseInt(y, 10);
    if (
      Number.isFinite(dn) &&
      Number.isFinite(mn) &&
      Number.isFinite(yn) &&
      yn >= 1900 &&
      yn <= 2099 &&
      mn >= 1 &&
      mn <= 12 &&
      dn >= 1 &&
      dn <= 31
    ) {
      const iso = `${String(yn).padStart(4, "0")}-${String(mn).padStart(2, "0")}-${String(dn).padStart(2, "0")}`;
      onChange(iso);
    }
    setOpen(false);
  }

  function clear() {
    onChange("");
    setOpen(false);
  }

  return (
    <View>
      <Text
        className="text-[10px] font-semibold uppercase text-app-fg-muted"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
      >
        {label}
      </Text>
      <Pressable
        onPress={openPicker}
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
              className="text-[10px] uppercase text-app-copper-deep mb-4"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              {label}
            </Text>

            <View className="flex-row gap-3">
              <DatePart label="DD" value={d} onChange={setD} max={2} />
              <DatePart label="MM" value={m} onChange={setM} max={2} />
              <DatePart label="YYYY" value={y} onChange={setY} max={4} flex={2} />
            </View>

            <View className="mt-6 flex-row gap-3">
              <Pressable
                onPress={clear}
                className="flex-1 rounded-md py-3 items-center active:opacity-50"
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 13,
                    color: "#4d4538",
                  }}
                >
                  Clear
                </Text>
              </Pressable>
              <Pressable
                onPress={commit}
                className="flex-[1.4] rounded-md py-3 items-center"
                style={{
                  backgroundColor: "#c5853a",
                  shadowColor: "#c5853a",
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 5,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-SemiBold",
                    fontSize: 13,
                    color: "#2a1c08",
                  }}
                >
                  Set Date
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function DatePart({
  label,
  value,
  onChange,
  max,
  flex,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  flex?: number;
}) {
  return (
    <View style={{ flex: flex ?? 1 }}>
      <Text
        className="text-[9px] uppercase text-app-fg-muted text-center"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.4 }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, max))}
        keyboardType="numeric"
        maxLength={max}
        className="mt-1 rounded-md border bg-app-paper px-3 py-3 text-[20px] text-app-ink text-center"
        style={{
          fontFamily: "DMMono-Medium",
          borderColor: "#e3d9c0",
          letterSpacing: 1,
        }}
      />
    </View>
  );
}

export function parseDate(iso: string): { d: string; m: string; y: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return { d: "", m: "", y: "" };
  return { y: match[1], m: match[2], d: match[3] };
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
