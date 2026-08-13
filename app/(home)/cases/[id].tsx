import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import CaseDetailView from "../../../components/cases/CaseDetailView";
import { useCaseOrigin } from "../../../components/cases/useCaseOrigin";

// Phone route for one matter — a thin chrome shell around
// CaseDetailView (which the tablet two-pane embeds directly). Keeping
// the route registered means deep links and every router.push keep
// working on all devices.
//
// Back follows the `?from=` the opener set: Hearing Track and the
// dashboard get their own list back, everything else pops to the vault.
// See useCaseOrigin.

export default function CaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { label, goBack } = useCaseOrigin();

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center gap-3">
          <Pressable
            onPress={goBack}
            hitSlop={10}
            className="active:opacity-50"
            accessibilityRole="button"
            accessibilityLabel={`Back to ${label}`}
          >
            <Feather name="arrow-left" size={18} color="#0a1124" />
          </Pressable>
          <Text
            className="text-[14px] font-semibold text-app-ink"
            style={{ fontFamily: "Manrope-SemiBold" }}
          >
            {label}
          </Text>
        </View>
        <CaseDetailView
          caseId={String(id)}
          onDeleted={() => router.replace("/(home)/cases")}
        />
      </SafeAreaView>
    </View>
  );
}
