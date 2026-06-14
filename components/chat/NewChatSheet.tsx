import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Sheet from "../Sheet";
import { rolePill } from "../RoleHelpers";
import {
  ApiError,
  partnerChatStartPrivate,
  partnerListUsers,
  type ChatRoomDTO,
} from "../../lib/api";

// Teammate picker for starting (or jumping back into) a private chat.
// The server get-or-creates the room per pair, so picking someone you
// already talk to just reopens the thread.

export default function NewChatSheet({
  visible,
  onClose,
  onOpened,
}: {
  visible: boolean;
  onClose: () => void;
  onOpened: (room: ChatRoomDTO) => void;
}) {
  const [people, setPeople] = useState<
    { id: string; name: string; role: string }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || people) return;
    (async () => {
      try {
        const res = await partnerListUsers();
        setPeople(
          res.users
            .filter((u) => u.active !== false && u.id !== res.currentUserId)
            .map((u) => ({
              id: u.id,
              name: u.name || u.email,
              role: u.role,
            }))
        );
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Couldn't load the roster."
        );
      }
    })();
  }, [visible, people]);

  async function start(userId: string) {
    if (startingId) return;
    setStartingId(userId);
    setError(null);
    try {
      const res = await partnerChatStartPrivate(userId);
      onOpened(res.room);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't open the chat."
      );
    } finally {
      setStartingId(null);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="Senior Desk"
      title="Start a private chat"
      containerStyle={{ maxHeight: "75%" }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}
      >
        {error ? (
          <View
            className="rounded-md px-3.5 py-2.5 mb-3"
            style={{ backgroundColor: "#f6dccd" }}
          >
            <Text
              className="text-[12.5px]"
              style={{ fontFamily: "Manrope", color: "#c14a37" }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {people === null ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#c5853a" size="small" />
          </View>
        ) : people.length === 0 ? (
          <Text
            className="text-[13px] text-app-fg-muted py-6 text-center"
            style={{ fontFamily: "Manrope" }}
          >
            Nobody else in the office yet.
          </Text>
        ) : (
          people.map((p, i) => {
            const pill = rolePill(p.role);
            return (
              <Pressable
                key={p.id}
                onPress={() => start(p.id)}
                disabled={startingId !== null}
                className="flex-row items-center gap-3 active:opacity-70"
                style={{
                  minHeight: 56,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "#efe5d0",
                }}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${p.name}`}
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#efe5d0" }}
                >
                  <Text
                    className="text-[14px] uppercase"
                    style={{ fontFamily: "Crimson-SemiBold", color: "#8a5821" }}
                  >
                    {p.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((x) => x[0] || "")
                      .join("")}
                  </Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Text
                    className="text-[14.5px] text-app-ink"
                    style={{ fontFamily: "Manrope-SemiBold" }}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  <Text
                    className="text-[10px] uppercase mt-0.5"
                    style={{
                      fontFamily: "DMMono-Medium",
                      letterSpacing: 1.2,
                      color: pill.fg,
                    }}
                  >
                    {pill.label}
                  </Text>
                </View>
                {startingId === p.id ? (
                  <ActivityIndicator size="small" color="#8a5821" />
                ) : (
                  <Feather name="message-square" size={15} color="#8a5821" />
                )}
              </Pressable>
            );
          })
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </Sheet>
  );
}
