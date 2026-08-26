import { NextRequest } from "next/server";
import { resolveApproval } from "@/server/services/approval";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return resolveApproval(id, "rejected");
}
