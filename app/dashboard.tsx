import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter } from "expo-router";
import { getMe, logout } from "../lib/api";

/**
 * Post-login routing screen.
 *  - global_admin → /admin/dashboard (Pocket Plex tabbed experience)
 *  - partner_admin / user → /home (the partner-side stub, TBD)
 *  - if token is invalid → /signin
 */
export default function DashboardRouter() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getMe();
        if (!alive) return;
        if (data.user.userType === "global_admin") {
          router.replace("/(admin)/dashboard");
        } else {
          router.replace("/(home)/home");
        }
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

  return (
    <View className="flex-1 bg-paper items-center justify-center">
      <ActivityIndicator color="#b68b3c" size="large" />
      <Text
        className="mt-4 font-mono text-[10px] uppercase text-ink-soft"
        style={{ letterSpacing: 2.5 }}
      >
        Opening chambers…
      </Text>
    </View>
  );
}
