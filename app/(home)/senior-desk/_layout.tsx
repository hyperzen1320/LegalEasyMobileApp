import { Stack } from "expo-router";

export default function SeniorDeskLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#f4ede0" },
      }}
    />
  );
}
