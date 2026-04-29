import { Stack } from "expo-router";

export default function CourtsStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#f4ede0" },
        animation: "slide_from_right",
      }}
    />
  );
}
