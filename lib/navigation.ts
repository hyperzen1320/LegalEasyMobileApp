import { router } from "expo-router";
import type { Href } from "expo-router";

// Two ways to move around this app, and they are not interchangeable.
//
//   openSection(href)  — go to a SECTION: a tab, or any screen that more
//                        than one place links to (the More menu, the
//                        dashboard tiles, the bell drawer). Reuses the
//                        screen if it is already showing rather than
//                        stacking a second copy of it.
//
//   router.push(href)  — go DEEPER from the screen you are standing on:
//                        a list to one of its rows, a record to its
//                        editor. The only thing that should ever add
//                        depth to a stack.
//
//   backToList(href)   — finish here and return to the list you came
//                        from, however deep you got. Pops back to it if
//                        it is behind you; replaces the current screen
//                        with it if it is not. `replace` was being used
//                        for this and it does something different — it
//                        swaps the top screen for the list WITHOUT
//                        removing what is underneath, so saving a matter
//                        left two copies of the dossier on the stack and
//                        going back walked through both.

/** Go to a section of the app. See the note above. */
export function openSection(href: Href): void {
  router.navigate(href);
}

/**
 * Return to a list after finishing with one of its records — a save, a
 * delete, a create. Unwinds everything above it.
 */
export function backToList(href: Href): void {
  router.dismissTo(href);
}
