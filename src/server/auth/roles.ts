export type Role = "OWNER" | "ADMIN" | "MEMBER";

const ROLE_RANK: Record<Role, number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 };

/** True if `role` meets or exceeds `minimumRole`. Pure — no DB — see authorize.ts for the DB-backed guard that uses this. */
export function isRoleSufficient(role: Role, minimumRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}
