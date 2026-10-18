import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { discordId: null, discordUsername: null },
  });
  return NextResponse.json({ success: true });
}
