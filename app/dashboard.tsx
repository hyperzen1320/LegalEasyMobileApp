import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";
import BootScreen from "../components/BootScreen";

// Post-login routing screen. Reads from AuthContext rather than re-
// running getMe — the provider's boot probe is the single round-trip
// for the whole app lifecycle.
//
//   global_admin → /(admin)/dashboard (Pocket Plex shell)
//   partner_admin / user → /(home)/home (Midnight Counsel shell)
//   no session → /signin
//
// While it decides, it shows the SAME boot screen index does. This route
// sits between the boot screen and the dashboard, so a bare spinner here
// meant the seal was replaced by a loading circle for a frame and then by
// the workspace — three screens where the office should see one.
export default function DashboardRouter() {
  const router = useRouter();
  const { status, isGlobalAdmin } = useAuth();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "guest") {
      router.replace("/signin");
      return;
    }
    router.replace(isGlobalAdmin ? "/(admin)/dashboard" : "/(home)/home");
  }, [status, isGlobalAdmin, router]);

  return <BootScreen />;
}
