import { ScrollView, View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import PrimaryButton from "../../components/PrimaryButton";

// There is no self-serve email reset — by design, matching the web app:
// passwords are reset by a person you already trust. Office members ask
// their office admin (Users → reset password); office admins ask the
// LegalEasy desk. This screen says exactly that instead of pretending to
// send a reset link.

const STEPS = [
  {
    index: "01",
    title: "Office members",
    body: "Your office admin holds the keys. Ask them to open Users / Advocates, pick your name, and set you a fresh password — it takes them under a minute.",
  },
  {
    index: "02",
    title: "Office admins",
    body: "Chambers owners are reset by the LegalEasy desk. Reach the desk on the channel you onboarded with and a new key will be cut for you.",
  },
  {
    index: "03",
    title: "Back in",
    body: "Sign in with the new password, then change it from My Profile whenever you like.",
  },
];

export default function ForgotPassword() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" backgroundColor="#f4ecda" />
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <ScrollView contentContainerClassName="grow pb-12">
          {/* Masthead */}
          <View className="border-b border-rule/40 px-5 py-2.5">
            <View className="flex-row items-center justify-between">
              <Text
                className="font-mono text-[10px] uppercase text-brass-deep"
                style={{ letterSpacing: 3 }}
              >
                Vol. I · No. 01
              </Text>
              <Text
                className="font-mono text-[10px] uppercase text-ink-soft"
                style={{ letterSpacing: 3 }}
              >
                Lost Key
              </Text>
            </View>
          </View>

          {/* Back */}
          <View className="px-5 pt-4">
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              className="flex-row items-center gap-2 self-start active:opacity-50"
            >
              <Text className="text-ink text-[16px]">←</Text>
              <Text
                className="font-mono text-[10px] uppercase text-ink-soft"
                style={{ letterSpacing: 2.5 }}
              >
                Back
              </Text>
            </Pressable>
          </View>

          <View className="px-5 pt-6 sm:max-w-[560px] sm:self-center sm:w-full">
            <Animated.View
              entering={FadeInDown.duration(600).delay(50)}
              className="flex-row items-center gap-3"
            >
              <View className="h-px w-7 bg-brass" />
              <Text
                className="font-mono text-[10px] uppercase text-brass-deep"
                style={{ letterSpacing: 3 }}
              >
                Lost Key — § IX
              </Text>
            </Animated.View>

            <Animated.Text
              entering={FadeInDown.duration(600).delay(150)}
              className="mt-5 font-display text-[44px] leading-[1.04] tracking-tight text-ink"
            >
              Keys are cut
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.duration(600).delay(200)}
              className="font-display-italic text-[44px] leading-[1.04] tracking-tight text-ink-2"
            >
              in chambers.
            </Animated.Text>

            <Animated.Text
              entering={FadeInDown.duration(600).delay(280)}
              className="mt-5 font-body text-[16px] leading-[26px] text-ink-2"
            >
              LegalEasy doesn&rsquo;t email reset links. A person you already
              trust resets your password — here&rsquo;s who to ask.
            </Animated.Text>

            <View className="mt-9 gap-6">
              {STEPS.map((step, i) => (
                <Animated.View
                  key={step.index}
                  entering={FadeInDown.duration(600).delay(380 + i * 110)}
                  className="border-l-2 border-brass/50 pl-4"
                >
                  <View className="flex-row items-baseline gap-3">
                    <Text
                      className="font-mono text-[11px] text-brass-deep"
                      style={{ letterSpacing: 2 }}
                    >
                      {step.index}
                    </Text>
                    <Text className="font-display text-[19px] text-ink">
                      {step.title}
                    </Text>
                  </View>
                  <Text className="mt-1.5 font-body text-[14.5px] leading-[23px] text-ink-2">
                    {step.body}
                  </Text>
                </Animated.View>
              ))}
            </View>

            <Animated.View
              entering={FadeInDown.duration(600).delay(740)}
              className="mt-10"
            >
              <PrimaryButton
                label="Back to Sign In"
                onPress={() => router.back()}
              />
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
