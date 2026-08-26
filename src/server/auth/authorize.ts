import { prisma } from "@/lib/prisma";
import { getSession } from "./session";
import { isRoleSufficient, type Role } from "./roles";

export type { Role } from "./roles";

export type AuthzResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; status: 401 | 403; message: string };

/**
 * The one function every workspace-scoped route handler should call before
 * touching Prisma for that workspace. Per #48 rule: never rely on frontend
 * route protection — this is what makes it real. See README.md#authentication--authorization.
 */
export async function authorizeWorkspaceAccess(workspaceId: string, minimumRole: Role = "MEMBER"): Promise<AuthzResult> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, message: "Not signed in." };

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.userId, workspaceId } },
  });
  if (!membership) return { ok: false, status: 403, message: "Not a member of this workspace." };

  if (!isRoleSufficient(membership.role, minimumRole)) {
    return { ok: false, status: 403, message: `Requires ${minimumRole} role or higher.` };
  }

  return { ok: true, userId: session.userId, role: membership.role };
}
