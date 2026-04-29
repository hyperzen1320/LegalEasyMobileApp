// Shared RBAC role metadata for the mobile Users / Advocates screens.

export type RoleMeta = {
  key: string;
  label: string;
  description: string;
  bg: string;
  fg: string;
};

export const STAFF_ROLES: RoleMeta[] = [
  {
    key: "advocate",
    label: "Advocate",
    description: "Full case, client and hearing access.",
    bg: "rgba(10,17,36,0.10)",
    fg: "#0a1124",
  },
  {
    key: "junior",
    label: "Junior",
    description: "Update cases & hearings, view clients & courts.",
    bg: "#d2e6e7",
    fg: "#56a0a8",
  },
  {
    key: "clerk",
    label: "Clerk",
    description: "Data entry across cases and clients.",
    bg: "rgba(138,88,33,0.14)",
    fg: "#8a5821",
  },
  {
    key: "viewer",
    label: "Viewer",
    description: "Read-only access across the office.",
    bg: "#efe5d0",
    fg: "#7a7060",
  },
];

const ADMIN_META: RoleMeta = {
  key: "admin",
  label: "Office Admin",
  description: "Full control over every module in the office.",
  bg: "rgba(197,133,58,0.18)",
  fg: "#8a5821",
};

export function rolePill(role: string): RoleMeta {
  if (role === "admin") return ADMIN_META;
  return (
    STAFF_ROLES.find((r) => r.key === role) ?? {
      key: role,
      label: "Staff",
      bg: "#efe5d0",
      fg: "#7a7060",
      description: "",
    }
  );
}

export const STAFF_ROLE_KEYS = STAFF_ROLES.map((r) => r.key);
export const STAFF_ROLE_LABELS = STAFF_ROLES.map((r) => r.label);

export function roleKeyFromLabel(label: string): string {
  return STAFF_ROLES.find((r) => r.label === label)?.key ?? "junior";
}

export function roleLabel(role: string): string {
  return rolePill(role).label;
}
