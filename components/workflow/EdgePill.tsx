import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";

/**
 * A small "← From / To →" pill rendered above a list when an edge
 * connects this list to another. The mobile UI doesn't draw curved
 * connection lines (that's a desktop canvas concept) — instead each
 * list shows the relationships it has as compact chips so users
 * understand the workflow graph without losing scrollability.
 */
export default function EdgePill({
  direction,
  label,
  otherListTitle,
  color,
}: {
  direction: "incoming" | "outgoing";
  label?: string;
  otherListTitle: string;
  color: string;
}) {
  const icon = direction === "incoming" ? "arrow-down-left" : "arrow-up-right";
  return (
    <View
      className="flex-row items-center"
      style={{
        alignSelf: "flex-start",
        gap: 5,
        backgroundColor: `${color}15`,
        borderWidth: 1,
        borderColor: `${color}33`,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        maxWidth: "100%",
      }}
    >
      <Feather name={icon} size={9} color={color} />
      <Text
        numberOfLines={1}
        style={{
          fontFamily: "DMMono-Medium",
          fontSize: 9,
          letterSpacing: 0.6,
          color,
          textTransform: "uppercase",
        }}
      >
        {label ? `${label} · ` : ""}
        {direction === "incoming" ? "from" : "to"} {otherListTitle}
      </Text>
    </View>
  );
}
