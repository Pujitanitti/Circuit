import { prisma } from "@/lib/prisma";

// Scoped intentionally small: there's no session-based "current workspace"
// resolution wired up yet (see README Known Limitations — the same
// hardcoded-workspaceId gap that affects "new workflow"/"use template").
// Rather than fake a workspace switcher here, this shows the first
// workspace that exists, real fields only, and says so plainly.
export default async function SettingsPage() {
  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { members: true, workflows: true } } },
  });

  return (
    <div className="p-8">
      <h1 className="font-display text-xl font-medium text-ink">Settings</h1>
      <p className="mt-1 text-[13px] text-ink-muted">Workspace configuration.</p>

      {!workspace ? (
        <p className="mt-8 text-[13px] text-ink-muted">
          No workspace exists yet — run <code className="rounded bg-canvas-raised px-1 py-0.5 font-mono text-[11px]">npm run seed</code> to create one.
        </p>
      ) : (
        <div className="mt-6 max-w-md space-y-4">
          <div className="panel p-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">Workspace name</p>
            <p className="mt-1 text-[14px] text-ink">{workspace.name}</p>
          </div>
          <div className="panel p-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">Slug</p>
            <p className="mt-1 font-mono text-[13px] text-ink-muted">{workspace.slug}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="panel p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">Members</p>
              <p className="mt-1 text-[18px] font-medium text-ink">{workspace._count.members}</p>
            </div>
            <div className="panel p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">Workflows</p>
              <p className="mt-1 text-[18px] font-medium text-ink">{workspace._count.workflows}</p>
            </div>
          </div>
          <p className="text-[11px] text-ink-faint">
            Workspace switching and editing aren&apos;t wired up yet — see the project README&apos;s Known Limitations.
          </p>
        </div>
      )}
    </div>
  );
}
