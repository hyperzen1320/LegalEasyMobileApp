import { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { partnerCreateUser, ApiError } from "../../../lib/api";
import { Field, SheetField } from "../../../components/CaseFields";
import {
  STAFF_ROLES,
  STAFF_ROLE_LABELS,
  roleKeyFromLabel,
} from "../../../components/RoleHelpers";

export default function NewUser() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<string>>(new Set());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleLabel, setRoleLabel] = useState("Junior");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");

  function clearMissing(key: string) {
    if (missing.has(key)) {
      const next = new Set(missing);
      next.delete(key);
      setMissing(next);
    }
  }

  async function save() {
    setError(null);
    const m = new Set<string>();
    if (!email.trim()) m.add("email");
    if (!password.trim() || password.length < 8) m.add("password");
    if (!firstName.trim()) m.add("firstName");
    if (m.size > 0) {
      setMissing(m);
      setError(
        m.has("password") && password.length > 0
          ? "Password must be at least 8 characters."
          : "Email, password and first name are required."
      );
      return;
    }
    setMissing(new Set());
    setSubmitting(true);
    try {
      await partnerCreateUser({
        email,
        password,
        firstName,
        lastName,
        role: roleKeyFromLabel(roleLabel),
        designation,
        phone,
      });
      router.replace("/(home)/users");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
      setSubmitting(false);
    }
  }

  const roleMeta =
    STAFF_ROLES.find((r) => r.label === roleLabel) ?? STAFF_ROLES[1];

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
            Users / Advocates
          </Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            contentContainerClassName="px-5 pt-5 pb-12 sm:max-w-[560px] sm:self-center sm:w-full"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Text
              className="text-[10px] uppercase text-app-copper-deep"
              style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
            >
              New team member
            </Text>
            <Text
              className="mt-1.5 text-[28px] font-semibold tracking-tight leading-tight text-app-ink"
              style={{ fontFamily: "Crimson-SemiBold" }}
            >
              Add a User
            </Text>
            <Text
              className="mt-2 text-[13px] leading-[20px] text-app-fg-muted"
              style={{ fontFamily: "Manrope" }}
            >
              They&rsquo;ll log in with this email and password and see only
              your office&rsquo;s data.
            </Text>

            <View
              className="mt-5 rounded-2xl bg-app-paper p-5"
              style={{
                shadowColor: "#0a1124",
                shadowOpacity: 0.04,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              }}
            >
              <View className="gap-4">
                <Field
                  label="Email (login id)"
                  required
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    clearMissing("email");
                  }}
                  placeholder="junior@officemail.com"
                  keyboardType="email-address"
                  invalid={missing.has("email")}
                />

                {/* Password with show/hide */}
                <View>
                  <Text
                    className="text-[10px] font-semibold uppercase text-app-fg-muted"
                    style={{
                      fontFamily: "DMMono-Medium",
                      letterSpacing: 1.6,
                    }}
                  >
                    Password{" "}
                    <Text style={{ color: "#c5853a" }}>{"  *"}</Text>
                  </Text>
                  <View className="relative mt-1.5">
                    <TextInput
                      value={password}
                      onChangeText={(v) => {
                        setPassword(v);
                        clearMissing("password");
                      }}
                      secureTextEntry={!showPwd}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      className="rounded-md border bg-app-paper px-3.5 py-3 text-[15px] text-app-ink"
                      style={{
                        fontFamily: "DMMono-Medium",
                        borderColor: missing.has("password")
                          ? "#c14a37"
                          : "#e3d9c0",
                        letterSpacing: 0.5,
                        paddingRight: 64,
                      }}
                    />
                    <Pressable
                      onPress={() => setShowPwd((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 active:opacity-50"
                      hitSlop={6}
                    >
                      <Text
                        className="text-[10px] font-semibold uppercase"
                        style={{
                          fontFamily: "DMMono-Medium",
                          letterSpacing: 1.4,
                          color: "#8a5821",
                        }}
                      >
                        {showPwd ? "Hide" : "Show"}
                      </Text>
                    </Pressable>
                  </View>
                  <Text
                    className="mt-1.5 text-[11px]"
                    style={{
                      fontFamily: "Manrope",
                      color: "#7a7060",
                    }}
                  >
                    At least 8 characters. Share with the team member.
                  </Text>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Field
                      label="First name"
                      required
                      value={firstName}
                      onChangeText={(v) => {
                        setFirstName(v);
                        clearMissing("firstName");
                      }}
                      placeholder="Aarav"
                      autoCapitalize="words"
                      invalid={missing.has("firstName")}
                    />
                  </View>
                  <View className="flex-1">
                    <Field
                      label="Last name"
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Iyer"
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View>
                  <SheetField
                    label="Role"
                    value={roleLabel}
                    options={STAFF_ROLE_LABELS}
                    onChange={setRoleLabel}
                  />
                  <Text
                    className="mt-1.5 text-[11px]"
                    style={{
                      fontFamily: "Manrope",
                      color: "#7a7060",
                    }}
                  >
                    {roleMeta.description}
                  </Text>
                </View>

                <Field
                  label="Designation"
                  value={designation}
                  onChangeText={setDesignation}
                  placeholder="Junior Advocate / Office Manager"
                  autoCapitalize="words"
                />

                <Field
                  label="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+91 98xxx 43210"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {error ? (
              <View
                className="mt-4 rounded-md px-4 py-3"
                style={{ backgroundColor: "#f6dccd" }}
              >
                <Text
                  className="text-[12px]"
                  style={{ fontFamily: "Manrope", color: "#c14a37" }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={() => router.back()}
                disabled={submitting}
                className="flex-1 rounded-md py-3.5 items-center active:opacity-50"
                style={{
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e3d9c0",
                }}
              >
                <Text
                  className="text-[13px] font-medium text-app-fg-soft"
                  style={{ fontFamily: "Manrope-Medium" }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={submitting}
                className="flex-[1.4] rounded-md py-3.5 items-center flex-row justify-center gap-2"
                style={{
                  backgroundColor: "#c5853a",
                  opacity: submitting ? 0.6 : 1,
                  shadowColor: "#c5853a",
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 5,
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#2a1c08" size="small" />
                ) : (
                  <Text
                    className="text-[13px] font-semibold"
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      color: "#2a1c08",
                    }}
                  >
                    Save User
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
