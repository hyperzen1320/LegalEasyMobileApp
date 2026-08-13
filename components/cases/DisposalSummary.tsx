import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

// The disposal record, read-only: where the certified copy has got to,
// and whether the client has it.
//
// Both facts render ALWAYS — including when the C.A. status is blank and
// when "received by client" is false. They used to appear only when
// truthy, so "the copy hasn't been collected" and "nobody wrote it down"
// looked identical on screen, and an unticked box looked like a field
// that didn't exist. An office chasing certified copies has to be able to
// tell those apart at a glance, which is the whole reason this record is
// kept.
//
// Shared by the case page (DisposePanel) and the archive rows, so the
// two can't describe the same matter differently.

export default function DisposalSummary({
  caStatus,
  receivedByClient,
}: {
  caStatus: string;
  receivedByClient: boolean;
}) {
  const ca = caStatus.trim();
  return (
    <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 8 }}>
      <View
        className="rounded px-2 py-1"
        style={{ backgroundColor: ca ? "#efe5d0" : "#f1ece0" }}
      >
        <Text
          className="text-[10px] uppercase"
          style={{
            fontFamily: "DMMono-Medium",
            letterSpacing: 1.2,
            color: ca ? "#8a5821" : "#a89c80",
          }}
        >
          C.A. · {ca || "Not recorded"}
        </Text>
      </View>

      <View
        className="flex-row items-center rounded px-2 py-1"
        style={{
          gap: 5,
          backgroundColor: receivedByClient ? "#d2e6e7" : "#f1ece0",
        }}
      >
        {/* A box, ticked or not — the same shape as the checkbox on the
            form that recorded it, so the two read as one thing. */}
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            borderWidth: 1.5,
            borderColor: receivedByClient ? "#3f9a8c" : "#c0b69c",
            backgroundColor: receivedByClient ? "#3f9a8c" : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {receivedByClient ? (
            <Feather name="check" size={8} color="#ffffff" />
          ) : null}
        </View>
        <Text
          className="text-[10px] uppercase"
          style={{
            fontFamily: "DMMono-Medium",
            letterSpacing: 1.2,
            color: receivedByClient ? "#3f9a8c" : "#a89c80",
          }}
        >
          {receivedByClient ? "Received by client" : "Not received yet"}
        </Text>
      </View>
    </View>
  );
}
