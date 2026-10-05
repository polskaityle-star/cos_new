import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = "default_secret_vztm_kielce_987654321_secret";
}
if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = "true";
}

async function handler(req: NextRequest, ctx: any) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  process.env.NEXTAUTH_URL = `${proto}://${host}`;
  return NextAuth(req, ctx, authOptions);
}

export { handler as GET, handler as POST };
