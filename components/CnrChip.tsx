import { useCallback, useState } from "react";
import { Pressable, Text, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { ECOURTS_CNR_SEARCH } from "../lib/ecourts";

// Tappable CNR pill — on press it copies the number to the clipboard AND opens
// the eCourts case-status portal (captcha-gated, so the CNR rides on the
// clipboard to paste). Renders "CNR <number> ↗"; flips to "copied ✓" for a
// beat after a tap. `tone="dark"` is for the navy hero cards, "light" for the
// pale list rows. Mirrors the web <CnrLink/>.
export default function CnrChip({
  cnr,
  tone = "light",
}: {
  cnr: string;
  tone?: "light" | "dark";
}) {
  const [copied, setCopied] = useState(false);

  const onPress = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(cnr);
    } catch {
      // Clipboard can fail silently — opening eCourts is still useful.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
    Linking.openURL(ECOURTS_CNR_SEARCH).catch(() => undefined);
  }, [cnr]);

  const labelColor = tone === "dark" ? "rgba(245,235,214,0.55)" : "#a89c80";
  const valueColor = tone === "dark" ? "#ddb074" : "#8a5821";
  const doneColor = "#3f9a8c";

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Copy CNR ${cnr} and open eCourts`}
      className="flex-row items-center active:opacity-60"
      style={{ gap: 5, alignSelf: "flex-start" }}
    >
      <Text
        style={{
          fontFamily: "DMMono-Medium",
          fontSize: 11,
          letterSpacing: 0.4,
          color: labelColor,
        }}
        maxFontSizeMultiplier={1.2}
      >
        CNR
      </Text>
      <Text
        style={{
          fontFamily: "DMMono-Medium",
          fontSize: 11,
          letterSpacing: 0.4,
          color: copied ? doneColor : valueColor,
          textDecorationLine: copied ? "none" : "underline",
        }}
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
      >
        {copied ? "copied ✓" : cnr}
      </Text>
      {!copied ? (
        <Feather name="external-link" size={11} color={valueColor} />
      ) : null}
    </Pressable>
  );
}
