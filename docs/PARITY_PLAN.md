# 📱 LegalEasy Mobile — Full Web-Parity Plan

> Approved 2026-06-10. Tracks the work to bring the mobile app to full feature parity with the web app, with every export/import working natively and fully adaptive layouts. Companion to the web repo at `../legaleasy`.

## Context

The web app (`Hyp/legaleasy`, Next.js 16, live at legalezi.com on the client's server) has grown well past the mobile app (`Hyp/legaleasymobileapp`, Expo SDK 54). This plan brings the mobile app to **full feature parity**, makes **every export and import work natively**, and makes the whole app **adaptive to every screen size** (small Androids → iPads/foldables). No stubs, no patchwork — each phase ships complete.

**Database access:** the mobile app already reads/writes the **same MongoDB database** as the web app, the right way: phone → HTTPS (Cloudflare tunnel, `legalezi.com`) → Next.js API routes (JWT `Authorization: Bearer`, enforced by `requirePartner()` in `src/lib/partner-auth.ts`) → MongoDB in Docker on the server. Mongo is bound to the server only — a direct DB connection from a phone is neither possible nor desirable (credentials would live in the app binary; all validation/role checks would be bypassed). Full parity = adding screens + calling the **existing** endpoints, never a second data path.

**Key audit finding:** every endpoint mobile needs **already exists** with Bearer + CORS support — **zero web-repo changes required**. (66 API routes verified by enumeration.)

## Verified gap analysis

Mobile today (45 screens, TS strict, NativeWind, JWT in SecureStore): cases/clients/courts/hearings/users/profile/prompts/boards CRUD-ish + full admin shell. Missing vs web:

**A. Entire modules missing**
1. **Senior Desk** — chat (1 office group room + private DMs; send/edit/delete, read markers, unread badge) + **Reminders** (create/assign/complete/delete; UI lives inside Senior Desk on web). APIs: `/api/app/chat/*`, `/api/app/reminders*`.
2. **Case Documents** — upload (multipart, ≤12 files/batch, **25 MB** each, ext whitelist `pdf doc docx jpg jpeg png gif webp bmp heic heif`), list, preview, download/share/save/print, delete → GridFS via `/api/app/cases/[id]/documents*`.
3. **All exports** (detail below) — none exist on mobile.
4. **Attendance** — admin grid (present/absent/half-day/leave/holiday) via GET+POST `/api/app/attendance`.
5. **Office Activity screen** — partner-wide audit log w/ cursor pagination (mobile only has board-scoped + admin variants).
6. **Office Settings** — activity retention (null/90/365), admin-only PATCH `/api/app/settings`.
7. **Disposed cases** — archive screen (`/api/app/cases/disposed`), dispose/reopen actions on case detail.

**B. Partial parity**
8. Clients: edit/delete/detail missing (web has `/api/app/clients/[id]`).
9. Courts: edit/delete missing.
10. Cases list: filters (court/place/byWhom/status), server pagination/infinite scroll, duplicate-case action.
11. Hearings: next-date update w/ remarks from the hearings screen; court-wise grouping; export.
12. Workflow: real **drag & drop** (move/reorder endpoints exist; today move = action sheet only), board rename/color/delete, board snapshot export.
13. Admin: plan edit form has no submit (PATCH helper already exists).
14. `forgot-password.tsx` is a dead stub (web's flow = office admin resets) → replace with proper guidance screen.
15. Dead call: mobile POSTs `/api/mobile/logout` which **doesn't exist** server-side → remove (JWT logout is client-side token deletion).

**C. Cross-cutting quality**
16. All long lists are `ScrollView` → swap to **FlashList v2** + server pagination where available.
17. No global 401 handling (TODO already in `auth-context.tsx`) → interceptor + auto sign-out.
18. Responsiveness: portrait-locked, no breakpoints, hardcoded `LIST_WIDTH = 280`, no font-scaling clamps, no tablet layouts.
19. No prod env wiring (`EXPO_PUBLIC_API_URL=https://legalezi.com`) / no `eas.json`.

**D. Deliberately NOT ported** (decided, not skipped): marketing/landing pages; XYFlow infinite-canvas zoom/pan + live mouse cursors (presence avatars + heartbeat already cover it on touch); NextAuth cookie session (JWT is the mobile path). Web has **no** CSV export, bulk import, email, or push — so none are parity items (noted as future ideas only).

## Export & import coverage — every single one

| Artifact | Server side (exists) | Mobile implementation |
|---|---|---|
| Cases report (XLSX/DOCX/PDF, column picker + filters, admin-only, 5000 cap) | `POST /api/app/cases/export` | Export sheet → `downloadAuthorized()` (POST→bytes→`File.write`) → Share / Save / Print(pdf) |
| Disposed-cases report (same formats, disposed column preset) | same endpoint, disposed filter | Same sheet, launched from Disposed archive |
| Hearing track (XLSX/DOCX/PDF; bucket today/tomorrow/pending/**all** + search) | `GET /api/app/hearings/export` | Export sheet → native `File.downloadFileAsync` w/ auth header |
| Board data (XLSX only) | `GET /api/app/boards/[id]/export?format=xlsx` | Board export sheet → download → share/save |
| Board snapshot PNG | client-side on web (html-to-image) | `react-native-view-shot` capture of a dedicated full-content `BoardSnapshotView` (4096 px cap, scale-to-fit) |
| Board snapshot PDF | client-side on web (jsPDF, A4 auto-orient) | PNG → `expo-print printToFileAsync` (A4, 28 pt margins, auto-orient — mirrors web) |
| Case document download/preview | `GET …/documents/[docId]` (streams, RFC5987 filename) | Download → inline image preview / open-with (`File.contentUri` on Android, share-sheet QuickLook on iOS) / Share / Save / Print |
| **Import:** case documents | `POST …/documents` (multipart `files`, partial-success `errors[]`) | `expo-document-picker` + camera/gallery via `expo-image-picker` → `apiUpload()` (never sets Content-Type) → per-file error UI |
| **Import:** access request (signup) | `POST /api/mobile/access-requests` | ✅ already live |

Save-to-device: Android = SAF folder picker (`Directory.pickDirectoryAsync`, session-cached), iOS = share sheet ("Save to Files"). Filenames parsed from `Content-Disposition` (RFC 5987 dual-form parser). Export buttons role-gated to office admin in UI (server enforces 403 anyway).

## Architecture decisions

- **One data path:** same DB through existing JWT API; nothing new server-side. (Any future web edits must follow `legaleasy/AGENTS.md`: read bundled Next 16 docs first; `proxy.ts` not `middleware.ts`.)
- **`lib/files.ts`** is the single front door for binary IO — verified against installed `expo-file-system@19.0.22`: new object API (`File`, `Directory`, `Paths`) for GET downloads with headers, `file.write(Uint8Array)` for POST-binary (via `expo/fetch` → `res.bytes()`, no base64), SAF via `Directory.pickDirectoryAsync()`, `file.contentUri` for Android open-with. Failure taxonomy: cancelled / permission_denied / too_large / unsupported / http / network / no_app.
- **`apiUpload()`** alongside `api()` — FormData parts `{uri, name, type}`, **no manual Content-Type** (boundary must be auto-set or Next's `request.formData()` rejects).
- **401 interceptor:** `setUnauthorizedHandler()` in `lib/api.ts`, fired on true 401s only (never network status 0), 5 s throttle → AuthContext clears token → existing layout redirects.
- **Chat = port of web's `src/lib/use-chat-room.ts`** (read from source): poll newest-50 every 2 s active / 8 s background (AppState instead of visibilitychange), merge by id, optimistic `tmp-` sends, `before` cursor for history, mark-read on focus + arrival. Unread badge = clone of existing `lib/notification-count.ts` singleton at 12 s (web sidebar cadence) → More-tab badge.
- **Chat list = FlashList v2 non-inverted** with `maintainVisibleContentPosition: { startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }` + `onStartReached` — the supported v2 chat pattern (new arch is on). Keyboard: iOS `KeyboardAvoidingView behavior="padding"` + header offset; Android relies on `adjustResize` (edge-to-edge) — **no** keyboard-controller dep, stays Expo Go-compatible.
- **Kanban drag & drop:** per-card `Gesture.Pan().activateAfterLongPress(300)`; on lift, disable `scrollEnabled` on all ScrollViews (programmatic `scrollTo` still works → autoscroll via reanimated `useFrameCallback`); drop zone = arithmetic from fixed column geometry + per-column card layout registry; floating clone overlay (reanimated, screen-root, `pointerEvents="none"`); optimistic reorder → `POST /tasks/[id]/move` → snapshot rollback on failure. Card long-press no longer opens the action sheet — a visible "⋯" button keeps the sheet as the accessible fallback path.
- **Breakpoints 600/840** (Material 3 window classes): `useBreakpoint()` on `useWindowDimensions` for *structural* changes; NativeWind `screens: {sm:600, md:840, lg:1240}` for cosmetic ones. Same numbers, two consumption modes.
- **Tablet two-pane = state-driven master-detail** inside the list screen (extract `CaseDetailView` from `cases/[id].tsx`; `[id]` route stays registered so deep links/phone stack are untouched). Route-driven panes rejected: expo-router has no supporting-pane primitive; dual sources of truth break back/deep-links.
- **Orientation:** runtime policy (`expo-screen-orientation` + `expo-device`): phones locked portrait, tablets unlocked. (Static app.json field is ignored by Expo Go anyway.)
- **Font scaling:** `maxFontSizeMultiplier` clamps — 1.3 body/inputs, 1.15 dense chrome — as exported constants, applied in shared components.
- `LIST_WIDTH=280` → adaptive: compact `min(300, 78% width)` (next-column peek), medium 320, expanded 340 + snapping off.

## New dependencies (exact, all Expo Go SDK 54-compatible)

`expo-file-system@~19.0.22`, `expo-sharing@~14.0.8`, `expo-print@~15.0.8`, `expo-document-picker@~14.0.8`, `expo-image-picker@~17.0.11`, `expo-device@~8.0.10`, `expo-screen-orientation@~9.0.9`, `@shopify/flash-list@2.0.2`, `react-native-view-shot@4.0.3`. (reanimated/gesture-handler/safe-area/haptics/clipboard already installed.) `react-native-keyboard-controller` deliberately avoided (not Expo Go-compatible, not needed).

## Phases (each ships complete — no stubs)

**P0 — Foundations**
Install deps · `lib/files.ts` (download/share/save/print/pick/upload + CD-filename parser) · `apiUpload` + 401 interceptor + ~20 endpoint helpers in `lib/api.ts` (chat, reminders, documents, exports, attendance, settings, clients/[id], courts/[id], boards/[id], disposed) · FlashList swaps (cases/clients/courts/users/boards lists) · `lib/useBreakpoint.ts` + tailwind `screens` · orientation policy in `app/_layout.tsx` · forgot-password → real guidance screen ("your office admin resets passwords", matching web) · remove dead `/api/mobile/logout` call · document `EXPO_PUBLIC_API_URL=https://legalezi.com` + add `eas.json` build profiles.
*Done when:* upload+download round-trip works against local dev server from a real device; 401 auto-signs-out; lists scroll 60 fps with 500 rows.

**P1 — Case documents + data exports**
Documents section on case detail (`components/files/DocumentPickerSheet.tsx`: camera/gallery/files; staged-batch UI w/ per-file size/type rejection; upload w/ partial-success errors; list w/ uploader+date; image inline preview; PDF/DOC open-with/share/save/print; delete admin-gated w/ existing `deleteRequestRequired()` flow) · `components/ExportSheet.tsx` (shared: format chips XLSX/DOCX/PDF, live row context, admin-gated) wired to Cases (column picker + current filters), Hearings (bucket incl. "all" + search), Board XLSX.
*Done when:* every artifact in the coverage table above (except board PNG/PDF) opens correctly in Excel/Word/PDF viewers from share sheet on both platforms; a doc uploaded from phone appears on web instantly, and vice-versa.

**P2 — CRUD parity sweep**
Clients detail/edit/delete · courts edit/delete · cases: filter sheet (court/place/byWhom/status) + infinite scroll (server pagination) + duplicate action + dispose/reopen + **Disposed archive screen** (with its export) · hearings: next-date+remarks update sheet, court-grouping toggle · board rename/color/delete · admin plan edit submit · dashboard stat cards deep-link to pre-filtered lists.
*Done when:* every web capability per feature area has a mobile equivalent or a recorded "not ported" rationale.

**P3 — Senior Desk + office admin surface**
`app/(home)/senior-desk/` (segmented Group / Private / Reminders) · thread screen per architecture above · message edit/delete/copy sheets, tombstones, optimistic send w/ retry · `lib/chat-unread.ts` → More-tab badge (12 s, AppState-aware) · Reminders panel (buckets mine/office × active/done, due-count, create/assign sheet) · Office Activity screen (cursor "load more", action filters) · Settings screen (retention picker, admin-only).
*Done when:* two devices chat live (2 s cadence), unread badges match web, reminders round-trip, activity paginates.

**P4 — Kanban drag & drop + board snapshot + attendance**
DnD per architecture (`components/workflow/dnd/*`: DndContext, useCardDragGesture, DragOverlay, useAutoscroll; haptics on lift/drop; copper drop-indicator; rollback on API failure; live-feed resync suppressed mid-drag) · `BoardSnapshotView` + `lib/boardSnapshot.ts` → PNG/PDF share/save/print from `BoardExportSheet` · Attendance screen (admin): date nav, per-user status cycling, month summary.
*Done when:* drag works through both scroll axes with autoscroll on a 6-list board; snapshot of a 10-list board exports legibly; attendance matches web grid for the same date.

**P5 — Adaptive polish + QA matrix**
Two-pane master-detail on expanded for Cases (then Senior Desk rooms/thread, Clients) · form max-widths on md+ · stat-card grids 2→4 cols · font-scale clamp sweep + audit at 1.0/1.3/1.5 · landscape tablet pass · device matrix: 320×568, 360×640, 390×844, 412×915, 768×1024, 1024×1366 + split-screen/foldable widths · perf pass (FlashList tuning) · final Pocket Pamphlet polish.
*Done when:* no clipped/overflowing layout anywhere in the matrix; tablet two-pane navigates correctly incl. deep links and back behavior.

## Design language (new screens)

Stay loyal to the existing three-system identity — **Editorial Gravitas** (auth/splash), **Midnight Counsel** (partner app: `#f4ede0` paper canvas, navy ink `#0a1124`, copper `#c5853a`, aqua `#56a0a8`), **Pocket Plex** (admin). New screens follow Midnight Counsel's "pocket ledger" character: oversized Fraunces/Crimson Pro serif headers, DM Mono uppercase eyebrows, hairline rules, stamp-like status pills, copper underline accents — bold and editorial, never generic. Chat bubbles as ledger entries (sender rule + mono timestamp) rather than round chat-app blobs; export sheet uses format chips styled as wax-seal toggles; attendance grid as a bound-register table. Haptics on lift/drop/send/export-complete; staggered reanimated entrances on dashboards; empty states with engraved-style marks. Touch targets ≥44 pt everywhere.

## Verification

- Dev loop: `npm run dev` in `legaleasy` + Expo Go on LAN device/emulator (config.ts already resolves LAN/10.0.2.2); `npx tsc --noEmit` green per phase.
- Cross-client round-trips are the acceptance bar for files: phone-upload → web-visible; web-upload → phone-preview; every export opened in real Excel/Word/PDF apps on both platforms.
- Chat verified with two simultaneous sessions (phone + web).
- Per-phase device spot-checks; full matrix in P5. Prod smoke test against `https://legalezi.com` with `EXPO_PUBLIC_API_URL` set before calling any phase done-done.

## Top risks & mitigations

1. RN FormData ↔ Next `formData()` interop → dedicated `apiUpload` (no Content-Type), `copyToCacheDirectory:true`, integration-test in P0.
2. FlashList v2 bottom-anchored chat quirks → component kept list-agnostic; mechanical fallback to FlatList + `maintainVisibleContentPosition`.
3. Android view-shot clipping/memory → `collapsable={false}`, attached-but-occluded snapshot mount, 4096 px cap.
4. DnD vs nested scrolling → long-press activation + `scrollEnabled` kill-switch; "⋯" sheet remains full fallback.
5. OneDrive sync churn on `node_modules` → exclude from sync before P0 installs.
