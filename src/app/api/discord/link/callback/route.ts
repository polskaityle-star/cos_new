import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForProfile, verifyLinkState } from "@/lib/discordOauth";
import { COLORS, notifyUser, runAfter, siteUrl, syncDiscordRoles } from "@/lib/discord";
import { canAccessManagementPanel } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const base = siteUrl();
  if (!session?.user) return NextResponse.redirect(new URL("/login", base));

  const back = (flag: string) =>
    NextResponse.redirect(
      new URL(`${canAccessManagementPanel(session.user.role) ? "/panel/zarzad" : "/panel/kierowca"}?discord=${flag}`, base)
    );

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (searchParams.get("error") || !code || !state) return back("cancelled");

  const jar = await cookies();
  const nonce = jar.get("dc_link_nonce")?.value;
  jar.delete("dc_link_nonce");

  let parsed: ReturnType<typeof verifyLinkState> = null;
  try {
    parsed = verifyLinkState(state);
  } catch {
    return back("error");
  }
  if (!parsed || !nonce || parsed.nonce !== nonce || parsed.userId !== session.user.id) return back("error");

  const profile = await exchangeCodeForProfile(code, `${base}/api/discord/link/callback`);
  if (!profile) return back("error");

  const taken = await prisma.user.findUnique({ where: { discordId: profile.id }, select: { id: true } });
  if (taken && taken.id !== session.user.id) return back("taken");

  const userId = session.user.id;
  await prisma.user.update({
    where: { id: userId },
    data: { discordId: profile.id, discordUsername: profile.global_name || profile.username, discordNotify: true },
  });

  await runAfter(async () => {
    await syncDiscordRoles(userId);
    await notifyUser(userId, [
      {
        title: "Konto Discord powiązane",
        description: "Od teraz będziesz dostawać tutaj powiadomienia z systemu VZTM Kielce. Możesz je wyłączyć w panelu.",
        color: COLORS.ok,
      },
    ]);
  });

  return back("linked");
}
