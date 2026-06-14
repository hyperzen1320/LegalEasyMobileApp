import { useCallback, useEffect, useState } from "react";
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
import Animated, { FadeIn } from "react-native-reanimated";
import {
  partnerGetProfile,
  partnerUpdateProfile,
  partnerGetNoticeTemplate,
  ApiError,
  type PartnerProfile,
} from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import NoticeTemplateEditor from "../../../components/NoticeTemplateEditor";

export default function MyProfile() {
  const { isPartnerAdmin } = useAuth();
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [noticeTemplate, setNoticeTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Editable buffer
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [barEnrolmentNo, setBarEnrolmentNo] = useState("");
  const [designation, setDesignation] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");

  const load = useCallback(async () => {
    try {
      const [data, tpl] = await Promise.all([
        partnerGetProfile(),
        partnerGetNoticeTemplate().catch(() => ({ template: "" })),
      ]);
      setProfile(data.profile);
      setNoticeTemplate(tpl.template);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  function startEdit() {
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone);
    setState(profile.state);
    setCountry(profile.country);
    setBarEnrolmentNo(profile.barEnrolmentNo);
    setDesignation(profile.designation);
    setOfficeAddress(profile.officeAddress);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await partnerUpdateProfile({
        name,
        phone,
        state,
        country,
        barEnrolmentNo,
        designation,
        officeAddress,
      });
      setProfile(res.profile);
      setEditing(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-app-canvas">
      <StatusBar style="dark" backgroundColor="#f4ede0" />
      <SafeAreaView className="flex-1" edges={["top"]}>
        <TopBar />
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#c5853a" size="large" />
          </View>
        ) : !profile ? (
          <View className="flex-1 items-center justify-center px-8">
            <Feather name="alert-circle" size={28} color="#c14a37" />
            <Text
              className="mt-3 text-[14px] text-app-fg-muted text-center"
              style={{ fontFamily: "Manrope" }}
            >
              {error ?? "Couldn't load profile."}
            </Text>
          </View>
        ) : (
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
              <Hero profile={profile} savedFlash={savedFlash} />

              <View className="mt-5 gap-4">
                <ProfileField
                  label="Name"
                  required
                  value={editing ? name : profile.name}
                  display={profile.name}
                  onChangeText={setName}
                  editing={editing}
                  autoCapitalize="words"
                />
                <ProfileField
                  label="Phone"
                  value={editing ? phone : profile.phone}
                  display={profile.phone}
                  onChangeText={setPhone}
                  editing={editing}
                  keyboardType="phone-pad"
                  placeholder="+91 98xxx 43210"
                />
                <ProfileField
                  label="Email"
                  value={profile.email}
                  display={profile.email}
                  onChangeText={() => {}}
                  editing={false}
                  locked
                />
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <ProfileField
                      label="State"
                      value={editing ? state : profile.state}
                      display={profile.state}
                      onChangeText={setState}
                      editing={editing}
                      placeholder="Tamil Nadu"
                      autoCapitalize="words"
                    />
                  </View>
                  <View className="flex-1">
                    <ProfileField
                      label="Country"
                      value={editing ? country : profile.country}
                      display={profile.country}
                      onChangeText={setCountry}
                      editing={editing}
                      placeholder="India"
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <ProfileField
                  label="Bar Enrolment No."
                  value={editing ? barEnrolmentNo : profile.barEnrolmentNo}
                  display={profile.barEnrolmentNo}
                  onChangeText={setBarEnrolmentNo}
                  editing={editing}
                  placeholder="MS/1234/2010"
                  mono
                  autoCapitalize="characters"
                />
                <ProfileField
                  label="Designation"
                  value={editing ? designation : profile.designation}
                  display={profile.designation}
                  onChangeText={setDesignation}
                  editing={editing}
                  placeholder="Advocate, Madras High Court"
                  autoCapitalize="words"
                />
                <ProfileField
                  label="Office Address"
                  value={editing ? officeAddress : profile.officeAddress}
                  display={profile.officeAddress}
                  onChangeText={setOfficeAddress}
                  editing={editing}
                  placeholder="12, Law Chambers, Chennai - 600001"
                  multiline
                  autoCapitalize="sentences"
                />
              </View>

              {error ? (
                <View
                  className="mt-4 rounded-md px-4 py-3"
                  style={{ backgroundColor: "#f6dccd" }}
                >
                  <Text
                    className="text-[13px]"
                    style={{ fontFamily: "Manrope", color: "#c14a37" }}
                  >
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Action buttons */}
              <View className="mt-7">
                {editing ? (
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={cancelEdit}
                      disabled={saving}
                      className="flex-1 rounded-md py-3.5 items-center active:opacity-50"
                      style={{
                        backgroundColor: "#ffffff",
                        borderWidth: 1,
                        borderColor: "#e3d9c0",
                      }}
                    >
                      <Text
                        className="text-[13px] font-medium"
                        style={{
                          fontFamily: "Manrope-Medium",
                          color: "#4d4538",
                        }}
                      >
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={save}
                      disabled={saving}
                      className="flex-[1.4] rounded-md py-3.5 items-center justify-center flex-row gap-2"
                      style={{
                        backgroundColor: "#c5853a",
                        opacity: saving ? 0.6 : 1,
                        shadowColor: "#c5853a",
                        shadowOpacity: 0.35,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 5,
                      }}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#2a1c08" />
                      ) : (
                        <Text
                          className="text-[13px] font-semibold"
                          style={{
                            fontFamily: "Manrope-SemiBold",
                            color: "#2a1c08",
                          }}
                        >
                          Save Changes
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={startEdit}
                    className="rounded-md py-3.5 items-center justify-center flex-row gap-2 active:opacity-90"
                    style={{
                      backgroundColor: "#c5853a",
                      shadowColor: "#c5853a",
                      shadowOpacity: 0.3,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 4,
                    }}
                  >
                    <Feather name="edit-3" size={14} color="#2a1c08" />
                    <Text
                      className="text-[13px] font-semibold"
                      style={{
                        fontFamily: "Manrope-SemiBold",
                        color: "#2a1c08",
                      }}
                    >
                      Edit Profile
                    </Text>
                  </Pressable>
                )}
              </View>

              {noticeTemplate !== null ? (
                <View className="mt-6">
                  <NoticeTemplateEditor
                    initialTemplate={noticeTemplate}
                    isAdmin={isPartnerAdmin}
                  />
                </View>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

/* ─── Top bar ─── */

function TopBar() {
  const router = useRouter();
  return (
    <View className="border-b border-app-edge bg-app-canvas px-5 py-3.5 flex-row items-center gap-3">
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        className="active:opacity-50"
      >
        <Feather name="arrow-left" size={18} color="#0a1124" />
      </Pressable>
      <View className="flex-1">
        <Text
          className="text-[10px] uppercase text-app-copper-deep"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.8 }}
        >
          Identity
        </Text>
        <Text
          className="mt-0.5 text-[18px] font-semibold tracking-tight text-app-ink leading-none"
          style={{ fontFamily: "Crimson-SemiBold" }}
        >
          My Profile
        </Text>
      </View>
    </View>
  );
}

/* ─── Hero ─── */

function Hero({
  profile,
  savedFlash,
}: {
  profile: PartnerProfile;
  savedFlash: boolean;
}) {
  const initials =
    `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
  const designationLine = profile.designation || "Advocate";

  return (
    <View
      className="rounded-2xl bg-app-paper p-5 flex-row items-center gap-4"
      style={{
        shadowColor: "#0a1124",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <View
        className="h-20 w-20 rounded-full items-center justify-center"
        style={{
          backgroundColor: "#c5853a",
          shadowColor: "#c5853a",
          shadowOpacity: 0.4,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        {initials ? (
          <Text
            className="text-[26px]"
            style={{
              fontFamily: "Crimson-SemiBold",
              color: "#2a1c08",
            }}
          >
            {initials}
          </Text>
        ) : (
          <Feather name="user" size={32} color="#2a1c08" />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className="text-[24px] font-semibold tracking-tight leading-[1.15] text-app-ink"
          style={{ fontFamily: "Crimson-SemiBold" }}
          numberOfLines={2}
        >
          {profile.name || "—"}
        </Text>
        <Text
          className="mt-0.5 text-[12px] text-app-fg-muted"
          style={{ fontFamily: "Manrope" }}
          numberOfLines={1}
        >
          {designationLine}
        </Text>
        {savedFlash ? (
          <Animated.Text
            entering={FadeIn.duration(200)}
            className="mt-1.5 text-[10px] uppercase"
            style={{
              fontFamily: "DMMono-Medium",
              letterSpacing: 1.5,
              color: "#56a0a8",
            }}
          >
            Saved ✓
          </Animated.Text>
        ) : null}
      </View>
    </View>
  );
}

/* ─── Field ─── */

function ProfileField({
  label,
  value,
  display,
  onChangeText,
  editing,
  placeholder,
  required,
  locked,
  mono,
  multiline,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  display: string;
  onChangeText: (v: string) => void;
  editing: boolean;
  placeholder?: string;
  required?: boolean;
  locked?: boolean;
  mono?: boolean;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "phone-pad" | "numeric" | "email-address";
}) {
  const fontFamily = mono ? "DMMono-Medium" : "Manrope";
  const isReadOnly = !editing || locked;

  return (
    <View>
      <View className="flex-row items-center gap-1.5">
        <Text
          className="text-[10px] font-semibold uppercase text-app-fg-muted"
          style={{ fontFamily: "DMMono-Medium", letterSpacing: 1.6 }}
        >
          {label}
          {required ? <Text style={{ color: "#c5853a" }}>{"  *"}</Text> : null}
        </Text>
        {locked ? (
          <Feather name="lock" size={10} color="#a89c80" />
        ) : null}
      </View>

      {isReadOnly ? (
        <View
          className="mt-1.5 rounded-md px-3.5 py-3"
          style={{
            backgroundColor: "#efe5d0",
            minHeight: multiline ? 64 : 44,
            justifyContent: "center",
          }}
        >
          {display ? (
            <Text
              className="text-[14px] text-app-ink"
              style={{
                fontFamily,
                letterSpacing: mono ? 0.3 : 0,
                lineHeight: multiline ? 20 : undefined,
              }}
            >
              {display}
            </Text>
          ) : (
            <Text
              className="text-[13px] italic"
              style={{
                fontFamily: "Manrope",
                color: "#a89c80",
              }}
            >
              Not set
            </Text>
          )}
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#a89c80"
          autoCapitalize={autoCapitalize ?? "none"}
          autoCorrect={false}
          keyboardType={keyboardType}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          className="mt-1.5 rounded-md border bg-app-paper px-3.5 py-3 text-[15px] text-app-ink"
          style={{
            fontFamily,
            borderColor: "#e3d9c0",
            letterSpacing: mono ? 0.3 : 0,
            minHeight: multiline ? 72 : 46,
            lineHeight: multiline ? 20 : undefined,
          }}
        />
      )}
    </View>
  );
}
