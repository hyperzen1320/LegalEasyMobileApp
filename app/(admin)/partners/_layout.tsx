import { Stack } from "expo-router";

export default function PartnersStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#fafaf7" },
        animation: "slide_from_right",
      }}
    />
  );
}
