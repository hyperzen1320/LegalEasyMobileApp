import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import UnderlineField from "../../components/UnderlineField";
import PrimaryButton from "../../components/PrimaryButton";
import {
  ApiError,
  passwordResetStart,
  passwordResetVerify,
  passwordResetComplete,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

// Self-serve password reset, against the same three endpoints the web
// app uses:
//
//   email  →  six-digit code  →  new password  →  signed in
//
// The code is proof of the mailbox; the server exchanges a correct one
// for a short-lived signed ticket, and only that ticket can write the new
// password. Nothing here is trusted to have "already verified".
//
// The email step answers identically whether or not the address has an
// account — the server won't confirm who banks with it — so the copy says
// "if it's on record" rather than claiming a code was definitely sent.

type Step = "email" | "code" | "password";

const CODE_LENGTH = 6;

export default function ForgotPassword() {
  const router = useRouter();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function messageFor(err: unknown, fallback: string): string {
    return err instanceof ApiError ? err.message : fallback;
  }

  async function requestCode(resend = false) {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const res = await passwordResetStart(email.trim().toLowerCase());
      setCooldown(res.retryAfterSeconds ?? 60);
      setStep("code");
      setNote(
        res.throttled
          ? "A code was already sent a moment ago — check your inbox."
          : resend
            ? "A fresh code is on its way."
            : `If ${email.trim().toLowerCase()} is on record, a six-digit code is on its way.`
      );
    } catch (err) {
      setError(messageFor(err, "Couldn't send that code. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const res = await passwordResetVerify(
        email.trim().toLowerCase(),
        code.trim()
      );
      setTicket(res.ticket);
      setStep("password");
    } catch (err) {
      setError(messageFor(err, "That code doesn't match."));
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword() {
    setError(null);
    if (password.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await passwordResetComplete(ticket, password);
      // The password is in hand — walk them straight in rather than
      // dropping them on the sign-in screen to type it again. If the
      // auto-login trips for any reason the password IS still changed, so
      // send them to sign in rather than leaving them stranded here.
      try {
        await login(email.trim().toLowerCase(), password);
        router.replace("/dashboard");
      } catch {
        router.replace("/signin");
      }
    } catch (err) {
      setError(messageFor(err, "Couldn't set that password."));
      setBusy(false);
    }
  }

  function onSubmit() {
    if (busy) return;
    if (step === "email") void requestCode();
    else if (step === "code") void verifyCode();
    else void submitPassword();
  }

  const canSubmit =
    step === "email"
      ? /^\S+@\S+\.\S+$/.test(email.trim())
      : step === "code"
        ? code.replace(/\D/g, "").length === CODE_LENGTH
        : password.length >= 8 && confirm.length >= 8;

  const ctaLabel =
    step === "email"
      ? "Email me a code"
      : step === "code"
        ? "Verify code"
        : "Set password & sign in";

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
                Cut a new
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.duration(600).delay(200)}
                className="font-display-italic text-[44px] leading-[1.04] tracking-tight text-ink-2"
              >
                key.
              </Animated.Text>

              <Animated.Text
                entering={FadeInDown.duration(600).delay(280)}
                className="mt-5 font-body text-[16px] leading-[26px] text-ink-2"
              >
                We&rsquo;ll email a one-time code to the address you sign in
                with. Enter it here and set a new password — nobody else needs
                to be involved.
              </Animated.Text>

              <Animated.View
                entering={FadeInDown.duration(600).delay(360)}
                className="mt-8"
              >
                <StepRail step={step} />
              </Animated.View>

              <View className="mt-7 gap-6">
                {step === "email" ? (
                  <UnderlineField
                    index="01"
                    label="Office Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="advocate@chambers.in"
                    type="email"
                    required
                  />
                ) : null}

                {step === "code" ? (
                  <View>
                    <View className="flex-row items-baseline justify-between">
                      <Text
                        className="font-mono text-[10px] uppercase text-brass-deep"
                        style={{ letterSpacing: 2.5 }}
                      >
                        <Text className="text-brass">02</Text>  Six-digit code
                      </Text>
                      <Pressable
                        onPress={() => {
                          setStep("email");
                          setCode("");
                          setNote(null);
                          setError(null);
                        }}
                        hitSlop={8}
                        className="active:opacity-50"
                      >
                        <Text
                          className="font-mono text-[10px] uppercase text-ink-soft"
                          style={{ letterSpacing: 2 }}
                        >
                          Change email
                        </Text>
                      </Pressable>
                    </View>
                    <TextInput
                      value={code}
                      onChangeText={(v) =>
                        setCode(v.replace(/\D/g, "").slice(0, CODE_LENGTH))
                      }
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      maxLength={CODE_LENGTH}
                      placeholder="••••••"
                      placeholderTextColor="rgba(14,26,43,0.25)"
                      className="mt-3 border-b border-ink/25 pb-2 text-ink"
                      style={{
                        fontFamily: "JetBrainsMono-Medium",
                        fontSize: 28,
                        letterSpacing: 14,
                      }}
                      accessibilityLabel="Six-digit code"
                    />
                    <View className="mt-3 flex-row items-center gap-3">
                      <Pressable
                        onPress={() => void requestCode(true)}
                        disabled={cooldown > 0 || busy}
                        hitSlop={8}
                        className="active:opacity-50"
                      >
                        <Text
                          className="font-mono text-[10px] uppercase"
                          style={{
                            letterSpacing: 2,
                            color:
                              cooldown > 0 || busy
                                ? "rgba(14,26,43,0.35)"
                                : "#8a6a2f",
                          }}
                        >
                          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                        </Text>
                      </Pressable>
                      <Text className="text-rule">·</Text>
                      <Text
                        className="font-mono text-[10px] uppercase text-ink-soft flex-1"
                        style={{ letterSpacing: 2 }}
                        numberOfLines={1}
                      >
                        {email.trim().toLowerCase()}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {step === "password" ? (
                  <>
                    <UnderlineField
                      index="03"
                      label="New Password"
                      value={password}
                      onChangeText={setPassword}
                      placeholder="At least 8 characters"
                      type="password"
                      required
                    />
                    <UnderlineField
                      index="04"
                      label="Repeat It"
                      value={confirm}
                      onChangeText={setConfirm}
                      placeholder="Type it once more"
                      type="password"
                      required
                    />
                  </>
                ) : null}
              </View>

              {note && !error ? (
                <View className="mt-6 border border-brass/40 bg-brass/5 px-4 py-3">
                  <Text
                    className="font-mono text-[10px] uppercase text-brass-deep"
                    style={{ letterSpacing: 2.5 }}
                  >
                    ✓  Filed
                  </Text>
                  <Text className="mt-2 font-body text-[14px] leading-[22px] text-ink-2">
                    {note}
                  </Text>
                </View>
              ) : null}

              {error ? (
                <View className="mt-6 border border-vermillion/40 bg-vermillion/5 px-4 py-3">
                  <Text
                    className="font-mono text-[10px] uppercase text-vermillion"
                    style={{ letterSpacing: 2.5 }}
                  >
                    ✗  Notice from the bench
                  </Text>
                  <Text className="mt-2 font-body text-[14px] leading-[22px] text-ink-2">
                    {error}
                  </Text>
                </View>
              ) : null}

              <View className="mt-9">
                <PrimaryButton
                  label={ctaLabel}
                  onPress={onSubmit}
                  loading={busy}
                  disabled={!canSubmit}
                />
              </View>

              <Text className="mt-6 font-body text-[13.5px] leading-[21px] text-ink-soft">
                Codes expire in 10 minutes. Still stuck? Your office admin can
                set you a password from Users / Advocates.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ─── Step rail ─── */

function StepRail({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "email", label: "Email" },
    { key: "code", label: "Code" },
    { key: "password", label: "Password" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <View className="flex-row items-center" style={{ gap: 10 }}>
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <View key={s.key} className="flex-row items-center" style={{ gap: 10 }}>
            <Text
              className="font-mono text-[10px] uppercase"
              style={{
                letterSpacing: 2,
                color: active
                  ? "#0e1a2b"
                  : done
                    ? "#8a6a2f"
                    : "rgba(14,26,43,0.35)",
              }}
            >
              {done ? "✓ " : ""}
              {s.label}
            </Text>
            {i < steps.length - 1 ? (
              <View
                style={{
                  height: 1,
                  width: 22,
                  backgroundColor: done ? "#b68b3c" : "rgba(14,26,43,0.18)",
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
