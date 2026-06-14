import { Pressable, Text, View, ActivityIndicator } from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost";
};

export default function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
}: Props) {
  const isPrimary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={
        isPrimary
          ? "bg-ink active:bg-ink-2 py-4 px-6 flex-row items-center justify-center gap-3"
          : "border border-ink/30 active:bg-paper-2 py-4 px-6 flex-row items-center justify-center gap-3"
      }
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      {loading ? (
        <ActivityIndicator
          color={isPrimary ? "#b68b3c" : "#0e1a2b"}
          size="small"
        />
      ) : null}
      <Text
        className={
          isPrimary
            ? "font-mono text-[12px] uppercase text-paper"
            : "font-mono text-[12px] uppercase text-ink"
        }
        style={{ letterSpacing: 2.5 }}
        // Dense mono chrome clips before it wraps — clamp accessibility
        // scaling here (FONT_CLAMP.chrome).
        maxFontSizeMultiplier={1.15}
      >
        {label}
      </Text>
      {!loading ? (
        <Text className={isPrimary ? "text-brass" : "text-brass-deep"}>→</Text>
      ) : null}
    </Pressable>
  );
}
