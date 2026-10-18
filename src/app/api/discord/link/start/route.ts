import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { createLinkState } from "@/lib/discordOauth";
import { discordOAuthConfigured, siteUrl } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const base = siteUrl(req);
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", base));
  }
  if (!discordOAuthConfigured()) {
    return NextResponse.json({ message: "Integracja z Discordem nie jest skonfigurowana." }, { status: 503 });
  }

  const { state, nonce } = createLinkState(session.user.id);
  const jar = await cookies();
  jar.set("dc_link_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/discord/link",
    maxAge: 600,
  });

  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID as string);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("redirect_uri", `${base}/api/discord/link/callback`);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return NextResponse.redirect(url);
}
