import { prisma } from "@/lib/prisma";
import { encryptCredential, decryptCredential, maskCredential } from "@/server/security/crypto";

function encryptionKey(): string {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) throw new Error("CREDENTIAL_ENCRYPTION_KEY is not set.");
  return key;
}

/** List/detail responses only ever include this shape — encryptedValue never leaves the server. */
export type CredentialSummary = { id: string; name: string; provider: string; maskedPreview: string; createdAt: Date };

export async function createCredential(workspaceId: string, name: string, provider: string, plaintext: string): Promise<CredentialSummary> {
  const encryptedValue = encryptCredential(plaintext, encryptionKey());
  const maskedPreview = maskCredential(plaintext);

  const credential = await prisma.credential.create({
    data: { workspaceId, name, provider, encryptedValue, maskedPreview },
  });

  return { id: credential.id, name: credential.name, provider: credential.provider, maskedPreview, createdAt: credential.createdAt };
}

export async function listCredentials(workspaceId: string): Promise<CredentialSummary[]> {
  const rows = await prisma.credential.findMany({
    where: { workspaceId },
    select: { id: true, name: true, provider: true, maskedPreview: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

/**
 * The only function anywhere that decrypts a credential — called exclusively
 * by the execution engine when a node config references a credential id,
 * never by any API response path. See README.md#credential-security.
 */
export async function resolveCredentialForExecution(credentialId: string): Promise<string> {
  const credential = await prisma.credential.findUniqueOrThrow({ where: { id: credentialId } });
  return decryptCredential(credential.encryptedValue, encryptionKey());
}
