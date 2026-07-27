import { useCallback, useState } from "react";
import { Alert } from "react-native";
import {
  deleteRequestRequired,
  type DeleteRequestRequiredError,
} from "../lib/api";
import RequestDeleteSheet from "./workflow/RequestDeleteSheet";

// What happens when someone who isn't the office admin tries to delete
// something.
//
// The server answers 403 with code `delete_request_required` and a message
// telling them to raise a delete request. Several screens caught that and
// showed the message behind a single OK button — so the advice had nowhere
// to go, and the request the admin was waiting for was never sent.
//
// This is that missing step, in one place:
//
//   } catch (err) {
//     if (offerDeleteRequest(err)) return;   // handled — prompt shown
//     Alert.alert("Couldn't delete", …);     // some other failure
//   }
//   …
//   {deleteRequestSheet}
//
// Yes → the reason sheet → the request lands in the admin's inbox
// (More → Delete Requests). No → nothing is sent.
//
// `clients/[id].tsx` and `courts/index.tsx` already did this correctly with
// their own copies and are left as they are; anything NEW should use this.

export function useDeleteRequestFallback(opts?: {
  /** Shown after the request is sent. Defaults to a sensible line. */
  sentMessage?: string;
}) {
  const [target, setTarget] = useState<DeleteRequestRequiredError | null>(null);

  /**
   * Returns true when the error was "you need to ask an admin" and the
   * Yes/No prompt has been shown — the caller should stop there. Returns
   * false for every other error so the caller can report it normally.
   */
  const offerDeleteRequest = useCallback((err: unknown): boolean => {
    const needsRequest = deleteRequestRequired(err);
    if (!needsRequest) return false;
    Alert.alert(
      "Only the office admin can delete this",
      "Send a delete request to the admin?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes", onPress: () => setTarget(needsRequest) },
      ]
    );
    return true;
  }, []);

  const deleteRequestSheet = (
    <RequestDeleteSheet
      target={target}
      onClose={() => setTarget(null)}
      onSubmitted={() => {
        setTarget(null);
        Alert.alert(
          "Sent for review",
          opts?.sentMessage ??
            "The office admin will see it under More → Delete Requests."
        );
      }}
    />
  );

  return { offerDeleteRequest, deleteRequestSheet };
}
