import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/roles";
import { syncDiscordRoles } from "@/lib/discord";

export const maxDuration = 60;

// Ręczna synchronizacja ról Discord dla wszystkich powiązanych kont (przycisk w panelu).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManageUsers(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    where: { discordId: { not: null } },
    select: { id: true },
    take: 200,
  });
  let ok = 0;
  for (const u of users) {
    if (await syncDiscordRoles(u.id)) ok++;
    await new Promise((r) => setTimeout(r, 120)); // łagodnie wobec limitów API Discorda
  }
  return NextResponse.json({ total: users.length, synced: ok });
}
