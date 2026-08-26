/**
 * Seeds a demo workspace so the app looks populated on first run (see
 * README §41 in the original brief). This file is what `npm run seed`
 * actually runs — it did not exist before this audit pass even though
 * package.json referenced it, which would have made `npm run seed` fail
 * immediately on a fresh clone. See PLAN.md's Phase 8 audit notes.
 *
 * Reuses the real seeding functions from server/services rather than
 * duplicating their logic — seedBuiltinTools and seedBuiltinTemplates
 * already existed but, until this file, were never called from anywhere
 * actually runnable.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { seedBuiltinTools } from "../src/server/services/tools";
import { seedBuiltinTemplates } from "../src/server/services/templateInstances";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@circuit.local";
  const existing = await prisma.user.findUnique({ where: { email } });

  const user =
    existing ??
    (await prisma.user.create({
      data: { email, name: "Demo User", passwordHash: await hashPassword("demo-password-change-me") },
    }));

  let workspace = await prisma.workspace.findUnique({ where: { slug: "demo-workspace" } });
  if (!workspace) {
    workspace = await prisma.workspace.create({ data: { name: "Demo Workspace", slug: "demo-workspace" } });
    await prisma.workspaceMember.create({ data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" } });
  }

  await seedBuiltinTools(workspace.id);
  await seedBuiltinTemplates();

  console.log(`Seeded demo workspace "${workspace.name}" (${workspace.id}) with builtin tools and templates.`);
  console.log(`Demo login: ${email} / demo-password-change-me`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
