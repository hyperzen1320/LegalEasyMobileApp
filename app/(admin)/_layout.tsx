import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { getMe, logout } from "../../lib/api";

export default function AdminLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getMe();
        if (!alive) return;
        if (data.user.userType !== "global_admin") {
          router.replace("/home");
          return;
        }
        setChecking(false);
      } catch {
        if (!alive) return;
        await logout();
        router.replace("/signin");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (checking) {
    return (
      <View className="flex-1 bg-admin-bg items-center justify-center">
        <ActivityIndicator color="#0e7c4a" size="large" />
      </View>
    );
  }

  // Respect device safe area at bottom (Android gesture indicator / iPhone home indicator).
  // Phones with hardware buttons or older Androids report 0 — fall back to 8.
  const bottomInset = Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0e7c4a",
        tabBarInactiveTintColor: "#8a929e",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e8e6e0",
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: bottomInset,
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
