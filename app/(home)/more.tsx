import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  getMe,
  logout,
  type MobileUser,
  type MobilePartner,
} from "../../lib/api";

type MoreItem = {
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  comingSoon?: boolean;
  onPress?: () => void;
};

export default function More() {
  const router = useRouter();
  const [user, setUser] = useState<MobileUser | null>(null);
  const [partner, setPartner] = useState<MobilePartner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getMe();
        if (!alive) return;
        setUser(data.user);
        setPartner(data.partner);
      } catch {
        /* handled by layout */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onSignOut() {
    await logout();
    router.replace("/");
  }

  const tools: MoreItem[] = [
    {
      label: "Client Crew",
      description: "Clients & linked matters",
      icon: "users",
      onPress: () => router.push("/(home)/clients"),
    },
    {
      label: "Court Hub",
      description: "Master list of courts",
      icon: "home",
      onPress: () => router.push("/(home)/courts"),
    },
    {
      label: "Work Flow",
      description: "Trello-style boards for office processes",
      icon: "layout",
      onPress: () => router.push("/(home)/workflow"),
    },
    {
      label: "AI Assistant",
      description: "Drafts, plaints, prompts",
      icon: "zap",
      onPress: () => router.push("/(home)/ai"),
    },
    {
      label: "Users / Advocates",
      description: "Office team & roles",
      icon: "user-plus",
      onPress: () => router.push("/(home)/users"),
    },
  ];

  const account: MoreItem[] = [
    {
      label: "My Profile",
      description: "Identity & signature",
      icon: "user",
      onPress: () => router.push("/(home)/profile"),
    },
    {
      label: "Sign out",
      description: "End this session",
      icon: "log-out",
      onPress: onSignOut,
    },
  ];

  if (loading) {
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
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar />
        <ScrollView
          contentContainerClassName="px-5 pt-5 pb-6"
          showsVerticalScrollIndicator={false}
        >
          {/* Identity card */}
          {user ? (
            <View
              className="rounded-2xl px-5 py-5 flex-row items-center gap-4"
              style={{
                backgroundColor: "#0a1124",
                shadowColor: "#0a1124",
                shadowOpacity: 0.18,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              <View
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: "#c5853a" }}
              >
                <Text
                  className="text-[18px] font-semibold uppercase"
                  style={{
                    fontFamily: "Crimson-SemiBold",
                    color: "#2a1c08",
                  }}
                >
                  {(user.firstName[0] || "").toUpperCase()}
                  {(user.lastName[0] || "").toUpperCase()}
                </Text>
              </View>
              <View className="flex-1 min-w-0">
                <Text
                  className="text-[10px] uppercase text-app-copper-bright"
                  style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
                >
                  Signed in
                </Text>
                <Text
                  className="mt-0.5 text-[18px] font-semibold tracking-tight text-app-ivory leading-tight"
                  style={{ fontFamily: "Crimson-SemiBold" }}
                  numberOfLines={1}
                >
                  {user.firstName} {user.lastName}
                </Text>
                <Text
                  className="mt-0.5 text-[11px] text-app-ivory-soft"
                  style={{ fontFamily: "DMMono", letterSpacing: 0.4 }}
                  numberOfLines={1}
                >
                  {user.email}
                </Text>
                {partner ? (
                  <Text
                    className="mt-1 text-[12px]"
                    style={{
                      fontFamily: "Manrope-Medium",
                      color: "#ddb074",
                    }}
                    numberOfLines={1}
                  >
                    {partner.name}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Tools section */}
          <SectionLabel>More tools</SectionLabel>
          <Section items={tools} />

          {/* Account section */}
          <SectionLabel>Account</SectionLabel>
          <Section items={account} />

          {/* Footer */}
          <View className="mt-8 items-center">
            <Text
              className="text-[10px] uppercase text-app-fg-muted"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.5 }}
            >
              v1.0 · Phase 1 MVP
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function TopBar() {
  return (
    <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5">
      <Text
        className="text-[10px] uppercase text-app-copper-deep"
        style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
      >
        Settings & shortcuts
      </Text>
      <Text
        className="mt-0.5 text-[18px] font-semibold tracking-tight text-app-ink leading-none"
        style={{ fontFamily: "Crimson-SemiBold" }}
      >
        More
      </Text>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className="mt-7 mb-3 text-[10px] uppercase text-app-copper-deep"
      style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
    >
      {children}
    </Text>
  );
}

function Section({ items }: { items: MoreItem[] }) {
  return (
    <View
      className="rounded-2xl bg-app-paper overflow-hidden"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {items.map((it, i) => (
        <Pressable
          key={it.label}
          onPress={it.onPress}
          disabled={!it.onPress && it.comingSoon}
          className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-50"
          style={{
            borderBottomWidth: i < items.length - 1 ? 1 : 0,
            borderBottomColor: "#efe5d0",
            opacity: it.comingSoon ? 0.7 : 1,
          }}
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-md"
            style={{ backgroundColor: "#efe5d0" }}
          >
            <Feather name={it.icon} size={16} color="#8a5821" />
          </View>
          <View className="flex-1">
            <Text
              className="text-[14px] font-semibold text-app-ink"
              style={{ fontFamily: "Manrope-SemiBold" }}
            >
              {it.label}
            </Text>
            <Text
              className="mt-0.5 text-[11px] text-app-fg-muted"
              style={{ fontFamily: "Manrope" }}
            >
              {it.description}
            </Text>
          </View>
          {it.comingSoon ? (
            <View
              className="rounded-sm px-1.5 py-0.5"
              style={{ backgroundColor: "#efe5d0" }}
            >
              <Text
                className="text-[9px] uppercase"
                style={{
                  fontFamily: "DMMono-Medium",
                  letterSpacing: 1.2,
                  color: "#8a5821",
                }}
              >
                Soon
              </Text>
            </View>
          ) : (
            <Feather name="chevron-right" size={14} color="#8a5821" />
          )}
        </Pressable>
      ))}
    </View>
  );
}
