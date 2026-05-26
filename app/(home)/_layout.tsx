import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";

export default function HomeLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, isGlobalAdmin } = useAuth();

  // Two redirects this layout enforces:
  //  - no session → back to signin
  //  - global_admin landed here by accident → bounce to admin shell
  // We don't run our own getMe probe; AuthContext already did that on
  // mount and any session change re-renders this layout.
  useEffect(() => {
    if (status === "loading") return;
    if (status === "guest") {
      router.replace("/signin");
      return;
    }
    if (isGlobalAdmin) router.replace("/(admin)/dashboard");
  }, [status, isGlobalAdmin, router]);

  if (status !== "authenticated" || isGlobalAdmin) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: "#f4ede0" }}
      >
        <ActivityIndicator color="#c5853a" size="large" />
      </View>
    );
  }

  // Safe-area aware tab bar — same pattern we used for /admin tabs.
  const bottomInset = Math.max(insets.bottom, 8);
  const tabBarHeight = 58 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#c5853a",
        tabBarInactiveTintColor: "#7a7060",
        tabBarStyle: {
          backgroundColor: "#0a1124",
          borderTopColor: "#1f2a45",
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: bottomInset,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "DMMono-Medium",
          letterSpacing: 1.4,
          textTransform: "uppercase",
          marginTop: 4,
        },
        tabBarItemStyle: { paddingVertical: 4 },
        sceneStyle: { backgroundColor: "#f4ede0" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color }) => (
            <Feather name="grid" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          tabBarLabel: "Cases",
          tabBarIcon: ({ color }) => (
            <Feather name="briefcase" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="hearings"
        options={{
          tabBarLabel: "Hearings",
          tabBarIcon: ({ color }) => (
            <Feather name="calendar" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarLabel: "More",
          tabBarIcon: ({ color }) => (
            <Feather name="menu" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="clients" options={{ href: null }} />
      <Tabs.Screen name="courts" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="users" options={{ href: null }} />
      <Tabs.Screen name="workflow" options={{ href: null }} />
    </Tabs>
  );
}
