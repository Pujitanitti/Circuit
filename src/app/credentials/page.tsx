import { prisma } from "@/lib/prisma";
import { listCredentials } from "@/server/services/credentials";
import { CredentialsList } from "@/components/credentials/CredentialsList";

export default async function CredentialsPage() {
  const workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });

  return (
    <div className="p-8">
      <h1 className="font-display text-xl font-medium text-ink">Credentials</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        Encrypted at rest (AES-256-GCM) — only a masked preview is ever shown, here or from the API.
      </p>

      {!workspace ? (
        <p className="mt-8 text-[13px] text-ink-muted">
          No workspace exists yet — run <code className="rounded bg-canvas-raised px-1 py-0.5 font-mono text-[11px]">npm run seed</code> to create one.
        </p>
      ) : (
        <CredentialsSection workspaceId={workspace.id} />
      )}
    </div>
  );
}

async function CredentialsSection({ workspaceId }: { workspaceId: string }) {
  const credentials = await listCredentials(workspaceId);
  return (
    <div className="mt-6">
      <CredentialsList
        workspaceId={workspaceId}
        initial={credentials.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      />
    </div>
  );
}
