import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { discordOAuthConfigured } from "@/lib/discord";
import { canManageUsers } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { discordId: true, discordUsername: true, discordNotify: true },
  });
  return NextResponse.json({
    enabled: discordOAuthConfigured(),
    botEnabled: !!process.env.DISCORD_BOT_TOKEN,
    webhookEnabled: !!(process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_WIADOMOSCI),
    linked: !!u?.discordId,
    username: u?.discordUsername ?? null,
    notify: u?.discordNotify ?? true,
    canSync: canManageUsers(session.user.role),
  });
}
