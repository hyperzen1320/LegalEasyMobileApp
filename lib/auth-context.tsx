import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getMe,
  getToken,
  login as apiLogin,
  logout as apiLogout,
  setUnauthorizedHandler,
  type MobileUser,
  type MobilePartner,
} from "./api";

// Single source of truth for "who is signed in". Replaces the five-plus
// screens that each called getMe() on focus and stored the result in
// their own state. The provider runs one boot probe on mount, then every
// downstream screen reads the snapshot via useAuth().
//
// The global 401 interceptor lives here too: lib/api.ts notifies through
// setUnauthorizedHandler() whenever any authenticated request comes back
// 401 (throttled, real HTTP 401s only — never network failures), and the
// provider clears the dead token + flips to guest. The (home)/(admin)
// layout redirects handle navigation from there.
//
// What's intentionally NOT here:
//  - Token refresh — JWTs are long-lived and the server doesn't issue
//    refresh tokens today, so there's nothing to refresh against.

export type AuthStatus = "loading" | "guest" | "authenticated";

export type AuthState = {
  status: AuthStatus;
  user: MobileUser | null;
  partner: MobilePartner | null;
  // Partner-side office admin (chambers owner). Drives "+ New user",
  // delete-request approve/reject, etc.
  isPartnerAdmin: boolean;
  // Global LegalEasy admin. Drives access to the (admin) shell.
  isGlobalAdmin: boolean;
  // Set when the boot probe failed (typically expired session). Cleared
  // on the next successful refresh().
  error: string | null;
};

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<MobileUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const GUEST_STATE: AuthState = {
  status: "guest",
  user: null,
  partner: null,
  isPartnerAdmin: false,
  isGlobalAdmin: false,
  error: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ...GUEST_STATE,
    status: "loading",
  });

  // Guard against setState after unmount — the boot probe is async and
  // the provider can theoretically unmount in HMR or test scenarios.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const applyMe = useCallback(
    (data: { user: MobileUser; partner: MobilePartner | null }) => {
      if (!aliveRef.current) return;
      setState({
        status: "authenticated",
        user: data.user,
        partner: data.partner,
        isPartnerAdmin: data.user.userType === "partner_admin",
        isGlobalAdmin: data.user.userType === "global_admin",
        error: null,
      });
    },
    []
  );

  const applyGuest = useCallback((error: string | null) => {
    if (!aliveRef.current) return;
    setState({ ...GUEST_STATE, error });
  }, []);

  const refresh = useCallback(async () => {
    try {
      // Skip the round-trip entirely on first launch — no token means no
      // session, no point asking the server. Saves a guaranteed 401.
      const token = await getToken();
      if (!token) {
        applyGuest(null);
        return;
      }
      const data = await getMe();
      applyMe(data);
    } catch (err) {
      // /me failed — treat as a dead session and clear the token so the
      // next launch doesn't keep retrying invalid creds. We swallow any
      // error from the logout call itself (network was probably the
      // original problem; secondary failures here are noise).
      await apiLogout().catch(() => undefined);
      applyGuest(err instanceof Error ? err.message : "Session expired.");
    }
  }, [applyMe, applyGuest]);

  // One probe on mount. Every downstream screen reads from the snapshot
  // instead of re-fetching — that's the whole point of the provider.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Bridge from lib/api.ts: any authenticated request returning 401 means
  // the stored token is dead — drop it and become a guest in one place
  // instead of every screen handling it separately.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      apiLogout().catch(() => undefined);
      applyGuest("Your session expired. Please sign in again.");
    });
    return () => setUnauthorizedHandler(null);
  }, [applyGuest]);

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await apiLogin(email, password);
      // apiLogin has already persisted the token; refresh() hydrates
      // partner + role flags from /me so guards downstream are accurate
      // immediately, not on next focus.
      await refresh();
      return user;
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await apiLogout();
    applyGuest(null);
  }, [applyGuest]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, refresh, login, logout }),
    [state, refresh, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth must be used inside <AuthProvider />. Wrap the root layout."
    );
  }
  return ctx;
}
