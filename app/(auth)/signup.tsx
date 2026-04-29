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
import { useRouter, Link } from "expo-router";
import { useState } from "react";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import UnderlineField from "../../components/UnderlineField";
import PrimaryButton from "../../components/PrimaryButton";
import { requestAccess, ApiError } from "../../lib/api";

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [chambers, setChambers] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!name.trim() || !chambers.trim() || !email.trim() || !phone.trim()) {
      setError("Please fill in your name, chambers, email and phone.");
      return;
    }
    setSubmitting(true);
    try {
      await requestAccess({
        name: name.trim(),
        chambers: chambers.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: message.trim(),
      });
      setSubmitting(false);
      setSubmitted(true);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the server. Try again.";
      setError(msg);
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <SuccessState chambers={chambers} email={email} />;
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
            showsVerticalScrollIndicator={false}
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
                  Early Access
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

            {/* Hero */}
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
                  Early Access — § VIII
                </Text>
              </Animated.View>

              <Animated.Text
                entering={FadeInDown.duration(600).delay(150)}
                className="mt-5 font-display text-[44px] leading-[1.04] tracking-tight text-ink"
              >
                Begin
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.duration(600).delay(200)}
                className="font-display-italic text-[44px] leading-[1.04] tracking-tight text-ink-2"
              >
                a chambers.
              </Animated.Text>

              <Animated.Text
                entering={FadeInDown.duration(600).delay(280)}
                className="mt-5 font-body text-[16px] leading-[26px] text-ink-2"
              >
                Tell us about your office. We&rsquo;ll set up a 14-day trial
                and email your login. New chambers are added by invitation —
                this is the queue.
              </Animated.Text>

              {/* Form */}
              <Animated.View
                entering={FadeInDown.duration(600).delay(380)}
                className="mt-9 gap-7"
              >
                <UnderlineField
                  index="01"
                  label="Your Name"
                  type="text"
                  value={name}
                  onChangeText={setName}
                  placeholder="K S Nagendhran"
                  autoCapitalize="words"
                  required
                />
                <UnderlineField
                  index="02"
                  label="Chambers Name"
                  type="text"
                  value={chambers}
                  onChangeText={setChambers}
                  placeholder="Nagendhran & Associates"
                  autoCapitalize="words"
                  required
                />
                <UnderlineField
                  index="03"
                  label="Email"
                  type="email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ks@nagendhran.in"
                  required
                />
                <UnderlineField
                  index="04"
                  label="Phone"
                  type="phone"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+91 98765 43210"
                  required
                />
                <UnderlineField
                  index="05"
                  label="Anything we should know"
                  type="multiline"
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Optional · what kind of practice, how many advocates, where you sit"
                />
              </Animated.View>

              {/* Error */}
              {error ? (
                <Animated.View
                  entering={FadeIn.duration(400)}
                  className="mt-6 border border-vermillion/40 bg-vermillion/5 px-4 py-3"
                >
                  <Text
                    className="font-mono text-[10px] uppercase text-vermillion"
                    style={{ letterSpacing: 2.5 }}
                  >
                    A few details, please
                  </Text>
                  <Text className="mt-1.5 font-body-italic text-[13px] leading-5 text-ink-2">
                    {error}
                  </Text>
                </Animated.View>
              ) : null}

              {/* Submit */}
              <Animated.View
                entering={FadeInDown.duration(600).delay(500)}
                className="mt-9"
              >
                <PrimaryButton
                  label={submitting ? "Sending…" : "Request Access"}
                  onPress={onSubmit}
                  loading={submitting}
                />
              </Animated.View>

              {/* Footnote */}
              <Animated.View
                entering={FadeIn.duration(600).delay(650)}
                className="mt-10 border-t border-rule/40 pt-5"
              >
                <View className="flex-row items-baseline gap-2">
                  <Text className="font-body-italic text-[13px] leading-5 text-ink-soft">
                    Already in chambers?
                  </Text>
                  <Link href="/signin" asChild>
                    <Pressable hitSlop={6} className="active:opacity-50">
                      <Text
                        className="font-mono text-[11px] uppercase text-ink"
                        style={{ letterSpacing: 2 }}
                      >
                        Sign in →
                      </Text>
                    </Pressable>
                  </Link>
                </View>
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function SuccessState({
  chambers,
  email,
}: {
  chambers: string;
  email: string;
}) {
  const router = useRouter();
  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" backgroundColor="#f4ecda" />
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View className="flex-1 px-5 justify-center">
          {/* Vermillion seal */}
          <Animated.View
            entering={FadeIn.duration(600)}
            className="self-center mb-10"
          >
            <View className="h-24 w-24 rounded-full border-2 border-vermillion/70 bg-paper items-center justify-center">
              <Text
                className="font-mono text-[8px] uppercase text-vermillion text-center"
                style={{ letterSpacing: 2.5 }}
              >
                In{"\n"}Queue{"\n"}MMXXVI
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(700).delay(150)}
            className="flex-row items-center gap-3 self-center"
          >
            <View className="h-px w-7 bg-brass" />
            <Text
              className="font-mono text-[10px] uppercase text-brass-deep"
              style={{ letterSpacing: 3 }}
            >
              Received · § VIII.i
            </Text>
            <View className="h-px w-7 bg-brass" />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.duration(700).delay(250)}
            className="mt-6 text-center font-display text-[36px] leading-[1.05] tracking-tight text-ink"
          >
            Thank you,
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.duration(700).delay(320)}
            className="text-center font-display-italic text-[36px] leading-[1.05] tracking-tight text-ink-2"
          >
            we&rsquo;ll be in touch.
          </Animated.Text>

          <Animated.View
            entering={FadeInDown.duration(700).delay(420)}
            className="mt-8"
          >
            <Text className="text-center font-body text-[15px] leading-[24px] text-ink-2">
              We&rsquo;ve received your request for{" "}
              <Text className="font-body-italic">{chambers || "your chambers"}</Text>.
              You&rsquo;ll get a setup email at{" "}
              <Text
                className="font-mono text-[12px] text-ink"
                style={{ letterSpacing: 1 }}
              >
                {email}
              </Text>{" "}
              within a working day.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(700).delay(550)}
            className="mt-10"
          >
            <PrimaryButton
              label="Back to home"
              onPress={() => router.replace("/")}
              variant="ghost"
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
