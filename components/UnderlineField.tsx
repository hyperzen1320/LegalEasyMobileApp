import { View, Text, TextInput, Pressable } from "react-native";
import { useState } from "react";

type Props = {
  index: string;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  type?: "email" | "password" | "text" | "phone" | "multiline";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  rightSlot?: React.ReactNode;
  required?: boolean;
};

export default function UnderlineField({
  index,
  label,
  value,
  onChangeText,
  placeholder,
  type = "text",
  autoCapitalize,
  rightSlot,
  required,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const isPassword = type === "password";
  const isMultiline = type === "multiline";

  const keyboardType =
    type === "email"
      ? "email-address"
      : type === "phone"
        ? "phone-pad"
        : "default";

  const cap =
    autoCapitalize ??
    (type === "email" || isPassword ? "none" : "sentences");

  return (
    <View>
      <View className="flex-row items-baseline justify-between">
        <Text
          className="font-mono text-[10px] uppercase text-brass-deep"
          style={{ letterSpacing: 2.5 }}
        >
          <Text className="text-brass">{index}</Text>  {label}
          {required ? <Text className="text-brass">  *</Text> : null}
        </Text>

        <View className="flex-row items-center gap-2">
          {isPassword && (
            <Pressable
              onPress={() => setShowPw((s) => !s)}
              hitSlop={8}
              className="active:opacity-50"
            >
              <Text
                className="font-mono text-[9px] uppercase text-ink-soft"
                style={{ letterSpacing: 2 }}
              >
                {showPw ? "Hide" : "Show"}
              </Text>
            </Pressable>
          )}
          {rightSlot}
        </View>
      </View>

      <View className="relative mt-3">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(74,84,104,0.4)"
          secureTextEntry={isPassword && !showPw}
          keyboardType={keyboardType}
          autoCapitalize={cap}
          autoCorrect={!isPassword && type !== "email"}
          multiline={isMultiline}
          numberOfLines={isMultiline ? 4 : 1}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="font-body text-[16px] text-ink"
          style={{
            paddingVertical: 8,
            paddingHorizontal: 0,
            minHeight: isMultiline ? 80 : 36,
            textAlignVertical: isMultiline ? "top" : "center",
          }}
        />

        {/* base underline */}
        <View className="absolute inset-x-0 bottom-0 h-px bg-ink/25" />
        {/* brass focus stroke */}
        <View
          className="absolute inset-x-0 bottom-0 h-[2px] bg-brass"
          style={{
            opacity: focused ? 1 : 0,
            transform: [{ scaleX: focused ? 1 : 0 }],
          }}
        />
      </View>
    </View>
  );
}
