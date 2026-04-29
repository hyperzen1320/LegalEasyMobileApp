import {
  ScrollView,
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useState } from "react";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import UnderlineField from "../../components/UnderlineField";
import PrimaryButton from "../../components/PrimaryButton";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function onSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSent(true);
    }, 700);
  }

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" backgroundColor="#f4ecda" />
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            contentContainerClassName="grow pb-12"
            keyboardShouldPersistTaps="handled"
          >
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

            <View className="px-5 pt-6">
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
                A new
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.duration(600).delay(200)}
                className="font-display-italic text-[44px] leading-[1.04] tracking-tight text-ink-2"
              >
                key, then.
              </Animated.Text>

              <Animated.Text
                entering={FadeInDown.duration(600).delay(280)}
                className="mt-5 font-body text-[16px] leading-[26px] text-ink-2"
              >
                Tell us the email you sign in with. We&rsquo;ll send a one-time
                link to set a fresh password.
              </Animated.Text>

              {!sent ? (
                <>
                  <Animated.View
                    entering={FadeInDown.duration(600).delay(380)}
                    className="mt-9"
                  >
                    <UnderlineField
                      index="01"
                      label="Office Email"
                      type="email"
                      value={email}
                      onChangeText={setEmail}
                      placeholder="advocate@chambers.in"
                      required
                    />
                  </Animated.View>

                  <Animated.View
                    entering={FadeInDown.duration(600).delay(500)}
                    className="mt-9"
                  >
                    <PrimaryButton
                      label={submitting ? "Sending…" : "Send Reset Link"}
                      onPress={onSubmit}
                      loading={submitting}
                    />
                  </Animated.View>
                </>
              ) : (
                <Animated.View
                  entering={FadeIn.duration(500)}
                  className="mt-9 border border-brass/40 bg-paper-2/60 px-4 py-4"
                >
                  <Text
                    className="font-mono text-[10px] uppercase text-brass-deep"
                    style={{ letterSpacing: 2.5 }}
                  >
                    On its way
                  </Text>
                  <Text className="mt-2 font-body text-[14px] leading-[22px] text-ink-2">
                    If{" "}
                    <Text
                      className="font-mono text-[12px] text-ink"
                      style={{ letterSpacing: 1 }}
                    >
                      {email}
                    </Text>{" "}
                    matches an account, the reset link is in the post.
                    It&rsquo;ll arrive within a minute and expires in one hour.
                  </Text>
                </Animated.View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
