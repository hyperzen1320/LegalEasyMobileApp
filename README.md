<div align="center">

# 📱 LegalEasy — Mobile

### _The advocate's pocket chambers._

**Cases · Hearings · Clients · Court Hub · AI Assistant · Work Flow · Profile · RBAC team**
**One thumb. Real-time. Offline-tolerant.**

[![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=for-the-badge&logo=react&logoColor=000)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![NativeWind](https://img.shields.io/badge/NativeWind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://www.nativewind.dev)
[![expo-router](https://img.shields.io/badge/expo--router-6-000000?style=for-the-badge)](https://docs.expo.dev/router/introduction/)
[![Reanimated](https://img.shields.io/badge/Reanimated-4.1-9c27b0?style=for-the-badge)](https://docs.swmansion.com/react-native-reanimated/)

![Phase](https://img.shields.io/badge/phase-1%20MVP-c5853a?style=flat-square)
![iOS · Android](https://img.shields.io/badge/iOS%20%E2%80%A2%20Android-supported-3a5a40?style=flat-square)
![Theme](https://img.shields.io/badge/theme-Pocket%20Pamphlet-1f4e54?style=flat-square)

</div>

---

## 🪶 What is this?

The mobile half of **LegalEasy**. Same office, same Mongo, same role-based access — built natively for the advocate who's always between courts.

**Web counterpart** → [`LegalEasy`](https://github.com/hyperzen1320/LegalEasy)

The mobile and web apps share the **same partner-side REST API** (`/api/app/*`) hosted by the Next.js web service. The mobile client authenticates with a Bearer JWT; the same `requirePartner` server guard accepts both cookie sessions (web) and JWTs (mobile). Edits on phone show up on web instantly, and vice-versa.

---

## ✨ What lives in here

| Tab / Section | What it does |
|---|---|
| 🏠 **Home** | Greeting + tile counts (Today / Tomorrow / Pending / Vault), today's board, recent activity |
| 📁 **Cases** | Search-able vault, full case detail with hero card · Update Hearing · Call · WhatsApp · Hearing history · Delete |
| 🧑‍⚖️ **Hearings** | Today / Tomorrow / Pending segmented control; inline date+status update on Pending; Call / WhatsApp / Open per row |
| ☰ **More** | Client Crew · Court Hub · **Work Flow boards** · AI Assistant · My Profile · Users / Advocates · Sign out |

### 🔥 Highlights you'll feel

- 🎬 **`Reanimated FadeInDown` stagger** on every list — gentle, not thrown
- 📞 **Native `tel:` + WhatsApp deep-link** — tries `whatsapp://send?phone=…&text=…`, falls back to `wa.me/…` with the same pre-written professional reminder the web sends
- 📅 **Custom date pickers** — three numeric inputs in a bottom sheet, no native deps, perfectly accessible
- 🎚️ **Bottom-sheet selectors** for status / role / appearing-for — friendlier than wide pill rows on a phone
- 🌈 **Trello-style boards** with `expo-linear-gradient` colour tiles (forest · copper · sea · terracotta · ochre · plum · ink)
- 🔐 **5-role RBAC** mirrored from web: Admin · Advocate · Junior · Clerk · Viewer
- 🪄 **AI Assistant** with `expo-clipboard` for one-tap prompt copy
- 🔄 **Pull-to-refresh + focus-refresh** everywhere — your data is never stale

---

## 🎨 Theme — _Pocket Pamphlet_ × _Midnight Counsel_

| | |
|---|---|
| 🟫 **Canvas** | `#f4ede0` |
| ⚫ **Ink** | `#0a1124` |
| 🟠 **Copper** | `#c5853a` |
| 🤍 **Ivory** | `#f5ebd6` |
| 🌊 **Aqua** | `#56a0a8` |
| 🩸 **Danger** | `#c14a37` |

Typography: **Crimson Pro** (display) · **Manrope** (body) · **DM Mono** (caps & metadata) — loaded via `@expo-google-fonts/*`.

---

## 🏗️ Stack

```
┌─────────────────────────────────────────────┐
│  Expo SDK 54 · expo-router 6                 │
│  React Native 0.81 · React 19                │
│  TypeScript 5.9                              │
│  NativeWind v4 · tailwindcss 3.4             │
│  react-native-reanimated 4.1                 │
│  expo-linear-gradient · expo-clipboard       │
│  expo-secure-store (JWT)                     │
└─────────────────────────────────────────────┘
```

---

## 🚀 Getting started

### 1. Clone & install
```bash
git clone https://github.com/hyperzen1320/LegalEasyMobileApp.git
cd LegalEasyMobileApp
npm install
```

### 2. Point at the API
The mobile app talks to the LegalEasy web backend. `lib/config.ts` resolves the base URL automatically — **no code edits needed**:

| Priority | Source | When it applies |
|---|---|---|
| 1️⃣ | `EXPO_PUBLIC_API_URL` env var | Production / staging — set to `https://legalezi.com` |
| 2️⃣ | Expo dev server's LAN host (`hostUri` → port 3000) | Physical device on the same Wi-Fi as your laptop |
| 3️⃣ | `http://10.0.2.2:3000` | Android emulator |
| 4️⃣ | `http://localhost:3000` | iOS simulator |

```bash
# dev against the live server instead of localhost:
EXPO_PUBLIC_API_URL=https://legalezi.com npx expo start

# EAS builds bake it in via eas.json (preview + production profiles
# already carry EXPO_PUBLIC_API_URL=https://legalezi.com)
```

> 🖥️ Local dev: run the web repo with `npm run dev` (binds `-H 0.0.0.0` so your phone can reach it over Wi-Fi).

### 3. Run
```bash
npx expo start
```
Press `a` for Android, `i` for iOS, or scan the QR with the Expo Go app.

> Tip: if you add a new native module, restart Metro with `npx expo start --clear`.

### 4. Sign in
Use the same credentials you set up on the web (admin or staff). The login screen issues a JWT stored in `expo-secure-store`; it's attached to every API call as `Authorization: Bearer <token>`.

---

## 📂 Project structure

```
app/
├── (admin)/                · Global-admin shell (rare, mostly redirects)
├── (auth)/                 · /signin, /signup
├── (home)/
│   ├── _layout.tsx         · Tabs: Home · Cases · Hearings · More
│   ├── home.tsx            · Dashboard
│   ├── cases/              · Vault list, [id] detail, new
│   ├── hearings.tsx        · Today / Tomorrow / Pending segmented
│   ├── more.tsx            · Side menu (Client Crew · Court Hub · Work Flow · AI · Profile · Users · Sign out)
│   ├── clients/            · Client Crew list + new
│   ├── courts/             · Court Hub
│   ├── workflow/           · Boards landing + [id] detail (Kanban next)
│   ├── ai/                 · AI Assistant + new prompt template
│   ├── profile/            · My Profile (view / edit)
│   └── users/              · Users / Advocates list + new + [id]
├── _layout.tsx             · Root font / safe-area / providers
└── index.tsx               · Splash → routes to (home) or (auth)

components/
├── CaseFields.tsx          · Shared Field, SheetField, DateField (used by cases, profile, users, ai forms)
├── BoardColors.ts          · Gradient + accent presets per board colour
├── RoleHelpers.ts          · 5-role RBAC labels / pills / descriptions
├── PrimaryButton.tsx
└── UnderlineField.tsx

lib/
├── api.ts                  · Single source of API helpers (cases, clients, courts, hearings, ai, boards, users, profile)
├── config.ts               · API base URL helper
└── …
```

---

## 🔁 Shared API (with the web)

```ts
// every helper goes through this single fetch wrapper
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await SecureStore.getItemAsync("legaleasy_token");
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then(r => r.json());
}
```

| Module | Web endpoint | Mobile helper |
|---|---|---|
| Cases | `/api/app/cases` | `partnerListCases` · `partnerGetCase` · `partnerCreateCase` · `partnerUpdateCase` · `partnerDeleteCase` |
| Clients | `/api/app/clients` | `partnerListClients` · `partnerCreateClient` |
| Courts | `/api/app/courts` | `partnerListCourts` · `partnerCreateCourt` |
| Hearings | `/api/app/hearings` | `partnerListHearings(bucket)` |
| AI Prompts | `/api/app/prompts` | `partnerListPrompts` · `partnerCreatePrompt` · `partnerUpdatePrompt` · `partnerDeletePrompt` |
| Profile | `/api/app/profile` | `partnerGetProfile` · `partnerUpdateProfile` |
| Users | `/api/app/users` | `partnerListUsers` · `partnerCreateUser` · `partnerUpdateUser` · `partnerDeleteUser` |
| Boards | `/api/app/boards` | `partnerListBoards` · `partnerCreateBoard` |

All endpoints are tenant-scoped on the server. The mobile client never sees data outside its `partnerId`.

---

## 🪪 Native pieces worth calling out

| | |
|---|---|
| ☎️ **Phone** | `Linking.openURL("tel:...")` — falls back to `Alert` if device can't dial |
| 💬 **WhatsApp** | tries `whatsapp://send?phone=...&text=...`, falls back to `https://wa.me/...?text=...` |
| 📋 **Clipboard** | `expo-clipboard` for copying AI prompts |
| 🔑 **Secure store** | JWT lives in `expo-secure-store` (Keychain / Keystore) |
| 🌈 **Gradients** | `expo-linear-gradient` for board tiles |
| 🎞️ **Animations** | `react-native-reanimated` (FadeInDown stagger, opacity fades) |
| 📅 **Date input** | Custom 3-field bottom-sheet date picker — no native dep, no rebuild |

---

## 🛣️ Roadmap

- [x] **Phase 1 MVP** — every web module mirrored on mobile
- [x] **Phase 1.5** — Kanban detail inside boards, now with long-press **drag & drop**
- [x] **Full web parity** — case documents (upload/preview/share/print), every export (Excel · Word · PDF · board snapshots), Senior Desk chat + reminders, attendance register, disposed archive, office activity & settings, tablet two-pane layouts — see [`docs/PARITY_PLAN.md`](docs/PARITY_PLAN.md)
- [ ] **Next** — Push notifications for next-hearing reminders · Offline write queue

---

## 💌 The advocate's pact

> _All AI-generated drafts must be verified, edited and signed by an advocate before filing._

The phone is faster. The judgement is still yours.

---

<div align="center">

**Built for the Indian advocate.**
One office. One Mongo. Two clients.

⚖️ _Justice, in your pocket._

</div>
