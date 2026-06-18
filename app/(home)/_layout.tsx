import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { useChatUnread } from "../../lib/chat-unread";

export default function HomeLayout() {
  const router = useRouter();
  const { status, isGlobalAdmin } = useAuth();
  // Senior Desk unread total rides on the More tab (web puts it on the
  // sidebar item). The singleton polls every 12s while the app is open.
  const { unread } = useChatUnread();
  const insets = useSafeAreaInsets();

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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Cross-fade + drift between tabs instead of a hard card swap.
        animation: "shift",
        tabBarActiveTintColor: "#c5853a",
        tabBarInactiveTintColor: "#7a7060",
        // Explicitly reserve the device's bottom inset. With edge-to-edge
        // enabled, leaving it to the navigator lets the system nav bar paint
        // over the labels — so we size the bar = content + inset and pad the
        // bottom by the inset (min 8). Labels then clear the gesture pill AND
        // 3-button navigation on every device size.
        tabBarStyle: {
          backgroundColor: "#0a1124",
          borderTopColor: "#1f2a45",
          borderTopWidth: 1,
          paddingTop: 6,
          // Older / smaller phones (no gesture pill → insets.bottom === 0)
          // were clipping the labels; a taller floor + a 12px bottom-padding
          // floor keeps all five fully visible everywhere.
          height: 66 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 12),
        },
        // 9.5px + tight tracking keeps all five labels on one line on the
        // narrowest phones.
        tabBarLabelStyle: {
          fontSize: 9.5,
          fontFamily: "DMMono-Medium",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginTop: 3,
        },
        tabBarItemStyle: { paddingVertical: 2 },
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
          tabBarBadge:
            unread.totalUnread > 0
              ? unread.totalUnread > 99
                ? "99+"
                : unread.totalUnread
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#c5853a",
            color: "#2a1c08",
            fontFamily: "DMMono-Medium",
            fontSize: 9,
          },
        }}
      />
      <Tabs.Screen name="clients" options={{ href: null }} />
      <Tabs.Screen name="courts" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="users" options={{ href: null }} />
      <Tabs.Screen name="workflow" options={{ href: null }} />
      <Tabs.Screen name="senior-desk" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="attendance" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
    </Tabs>
  );
}
