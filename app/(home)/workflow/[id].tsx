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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  partnerListBoards,
  type PartnerBoard,
} from "../../../lib/api";
import { BOARD_COLOR_STYLES } from "../../../components/BoardColors";

export default function BoardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [board, setBoard] = useState<PartnerBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await partnerListBoards();
        if (!alive) return;
        const found = data.boards.find((b) => b.id === String(id));
        if (!found) {
          setError("Board not found.");
        } else {
          setBoard(found);
        }
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            className="active:opacity-50"
          >
            <Feather name="arrow-left" size={18} color="#0a1124" />
          </Pressable>
          <Text
            className="text-[14px] font-semibold text-app-ink"
            style={{ fontFamily: "Manrope-SemiBold" }}
          >
            Work Flow
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : !board ? (
          <View className="flex-1 items-center justify-center px-8">
            <Feather name="alert-circle" size={28} color="#c14a37" />
            <Text
              className="mt-3 text-[14px] text-app-fg-muted text-center"
              style={{ fontFamily: "Manrope" }}
            >
              {error ?? "Board not found."}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="px-5 pt-5 pb-12"
            showsVerticalScrollIndicator={false}
          >
            <Hero board={board} />
            <View
              className="mt-6 rounded-xl px-5 py-12 items-center"
              style={{
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#e3d9c0",
                borderStyle: "dashed",
              }}
            >
              <Feather name="layout" size={26} color="#8a5821" />
              <Text
                className="mt-4 text-[20px] font-semibold tracking-tight text-app-ink text-center"
                style={{ fontFamily: "Crimson-SemiBold" }}
              >
                Kanban columns coming next.
              </Text>
              <Text
                className="mt-1.5 text-[12px] text-app-fg-muted text-center max-w-[280px]"
                style={{ fontFamily: "Manrope" }}
              >
                Lists, task cards, drag-and-drop and assignment land in the
                next iteration.
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function Hero({ board }: { board: PartnerBoard }) {
  const styles =
    BOARD_COLOR_STYLES[board.color] ?? BOARD_COLOR_STYLES.copper;
  return (
    <View
      className="rounded-3xl overflow-hidden"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <LinearGradient
        colors={styles.gradient as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 24, minHeight: 160 }}
      >
        <View
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            height: 10,
            width: 10,
            borderRadius: 5,
            backgroundColor: styles.accent,
            opacity: 0.85,
          }}
        />
        <Text
          className="mt-3 text-[34px] leading-[1.05] tracking-tight"
          style={{
            fontFamily: "Crimson-SemiBold",
            color: styles.text,
          }}
          numberOfLines={2}
        >
          {board.title}
        </Text>
        {board.description ? (
          <Text
            className="mt-2 text-[13px] leading-[1.5]"
            style={{
              fontFamily: "Manrope",
              color: styles.text,
              opacity: 0.85,
            }}
          >
            {board.description}
          </Text>
        ) : null}
      </LinearGradient>
    </View>
  );
}
