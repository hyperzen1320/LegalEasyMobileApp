import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";

export default function AdminLayout() {
  const router = useRouter();
  const { status, isGlobalAdmin } = useAuth();

  // Mirror of home/_layout.tsx — partner users that wander into the
  // admin shell get bounced back, expired sessions land on signin.
  useEffect(() => {
    if (status === "loading") return;
    if (status === "guest") {
      router.replace("/signin");
      return;
    }
    if (!isGlobalAdmin) router.replace("/(home)/home");
  }, [status, isGlobalAdmin, router]);

  if (status !== "authenticated" || !isGlobalAdmin) {
    return (
      <View className="flex-1 bg-admin-bg items-center justify-center">
        <ActivityIndicator color="#0e7c4a" size="large" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarActiveTintColor: "#0e7c4a",
        tabBarInactiveTintColor: "#8a929e",
        // The navigator adds the device's bottom safe area itself — no
        // manual inset math, so the bar never collides with gesture
        // pills or 3-button navigation.
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e8e6e0",
          borderTopWidth: 1,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "PlexMono-Medium",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          marginTop: 4,
        },
        tabBarItemStyle: { paddingVertical: 4 },
        sceneStyle: { backgroundColor: "#fafaf7" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Feather
              name="grid"
              size={20}
              color={color}
              style={{ opacity: focused ? 1 : 0.85 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="partners"
        options={{
          tabBarLabel: "Partners",
          tabBarIcon: ({ color, focused }) => (
            <Feather
              name="users"
              size={20}
              color={color}
              style={{ opacity: focused ? 1 : 0.85 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          tabBarLabel: "Plans",
          tabBarIcon: ({ color, focused }) => (
            <Feather
              name="credit-card"
              size={20}
              color={color}
              style={{ opacity: focused ? 1 : 0.85 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarLabel: "Activity",
          tabBarIcon: ({ color, focused }) => (
            <Feather
              name="activity"
              size={20}
              color={color}
              style={{ opacity: focused ? 1 : 0.85 }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
