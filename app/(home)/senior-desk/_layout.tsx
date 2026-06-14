import { Stack } from "expo-router";

export default function SeniorDeskLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: 260,
        contentStyle: { backgroundColor: "#f4ede0" },
      }}
    />
  );
}
