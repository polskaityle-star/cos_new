import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.notify !== "boolean") {
    return NextResponse.json({ message: "Nieprawidłowe dane" }, { status: 400 });
  }
  await prisma.user.update({ where: { id: session.user.id }, data: { discordNotify: body.notify } });
  return NextResponse.json({ success: true });
}
