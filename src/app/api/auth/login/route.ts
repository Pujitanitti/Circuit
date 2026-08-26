import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/server/auth/password";
import { createSessionToken, setSessionCookie } from "@/server/auth/session";
import { RateLimiter } from "@/server/security/rateLimit";

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Deliberately generous per-IP but strict per-account would be the real
// production shape; per-IP only is the honest current scope.
const loginLimiter = new RateLimiter(10, 60_000);

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!loginLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many login attempts. Try again shortly." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Same generic message whether the email doesn't exist or the password is
  // wrong — narrowing it down helps an attacker enumerate valid accounts.
  const invalid = () => NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  if (!user) return invalid();
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return invalid();

  const token = await createSessionToken({ userId: user.id, email: user.email });
  await setSessionCookie(token);

  return NextResponse.json({ userId: user.id });
}
