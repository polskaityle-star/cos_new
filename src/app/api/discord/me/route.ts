import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { discordOAuthConfigured, siteUrl } from "@/lib/discord";
import { canManageUsers } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { discordId: true, discordUsername: true, discordNotify: true },
  });

  const site = siteUrl(req);

  return NextResponse.json({
    enabled: discordOAuthConfigured(),
    botEnabled: !!process.env.DISCORD_BOT_TOKEN,
    webhookEnabled: !!(process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_WIADOMOSCI),
    hasPublicKey: !!process.env.DISCORD_PUBLIC_KEY,
    hasAppId: !!(process.env.DISCORD_APP_ID || process.env.DISCORD_CLIENT_ID),
    hasGuildId: !!process.env.DISCORD_GUILD_ID,
    interactionsEndpoint: `${site}/api/discord/interactions`,
    linked: !!u?.discordId,
    username: u?.discordUsername ?? null,
    notify: u?.discordNotify ?? true,
    canSync: canManageUsers(session.user.role),
  });
}
