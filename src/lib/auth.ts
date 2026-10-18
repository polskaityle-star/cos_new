import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateBadgeNumber } from "@/lib/roles";
import { verifyPassword } from "@/lib/password";
import { getClientIp, isBlocked, recordHit, clearKey } from "@/lib/rateLimit";

if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV === "production") {
  console.error("[auth] Brak zmiennej NEXTAUTH_SECRET - logowanie nie będzie działać. Ustaw ją w Vercel.");
}
if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = "true";
}
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const inputUsername = credentials.username.trim();
        const lowerUsername = inputUsername.toLowerCase();
        const inputPassword = credentials.password.trim();

        if (inputUsername.length > 64 || inputPassword.length > 128) {
          throw new Error("Invalid username or password");
        }

        // Limit prób logowania (best effort)
        const ipKey = `login:ip:${getClientIp(req?.headers)}`;
        const userKey = `login:user:${lowerUsername}`;
        if (isBlocked(ipKey, 30) || isBlocked(userKey, 8)) {
          throw new Error("Too many attempts. Try again later.");
        }

        function fail(): never {
          recordHit(ipKey, LOGIN_WINDOW_MS);
          recordHit(userKey, LOGIN_WINDOW_MS);
          throw new Error("Invalid username or password");
        }

        // 1. Wyszukanie użytkownika - tylko po jego własnym loginie (bez aliasów)
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ username: inputUsername }, { username: lowerUsername }],
          },
        });

        if (!user || !user.password) {
          return fail();
        }

        // 2. Weryfikacja hasła (bcrypt; stare hasła jawnym tekstem są po sukcesie zamieniane na hash)
        const { ok, needsUpgrade } = await verifyPassword(inputPassword, user.password);
        if (!ok) {
          return fail();
        }

        if (needsUpgrade) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { password: await bcrypt.hash(inputPassword, 10) },
            });
          } catch {
            // ignore
          }
        }

        if (user.status !== "ACCEPTED") {
          throw new Error("Your account is pending approval or has been rejected.");
        }

        clearKey(userKey);

        // Auto-przydział badgeNumber jeśli brakuje
        if (!user.badgeNumber) {
          const badge = user.username.toLowerCase() === "godksawiss" ? "W1" : generateBadgeNumber(user.role);
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { badgeNumber: badge },
            });
            user.badgeNumber = badge;
          } catch {
            // ignore
          }
        }

        // Sanityzacja awatara - zapobieganie 494 REQUEST_HEADER_TOO_LARGE:
        // Ciasteczko sesyjne JWT nie może zawierać długich ciągów znaków (base64)!
        let safeAvatar: string | null = null;
        if (user.avatar) {
          if (user.avatar.startsWith("http://") || user.avatar.startsWith("https://")) {
            safeAvatar = user.avatar;
          } else {
            safeAvatar = `/api/panel/avatar?userId=${user.id}`;
          }
        }

        return {
          id: user.id,
          username: user.username,
          role: user.role,
          carrier: user.carrier,
          badgeNumber: user.badgeNumber,
          avatar: safeAvatar,
          workingDays: user.workingDays,
          assignedVehicleId: user.assignedVehicleId,
        };
      },
    }),
    // Logowanie przez Discord - tylko dla kont wcześniej powiązanych w panelu (patrz callbacks.signIn)
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? [
          DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            authorization: { params: { scope: "identify" } },
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ account }) {
      if (account?.provider !== "discord") return true;
      if (!account?.providerAccountId) return false;
      const dbUser = await prisma.user.findUnique({ where: { discordId: account.providerAccountId } });
      // Brak powiązanego konta lub konto nieaktywne -> odmowa (nie tworzymy kont automatycznie)
      if (!dbUser || dbUser.status !== "ACCEPTED") return "/login?error=DiscordNotLinked";
      return true;
    },
    async jwt({ token, user, account }) {
      let currentUser = user;
      if (account?.provider === "discord" && account.providerAccountId) {
        const dbUser = await prisma.user.findUnique({ where: { discordId: account.providerAccountId } });
        if (dbUser && dbUser.status === "ACCEPTED") {
          currentUser = {
            id: dbUser.id,
            username: dbUser.username,
            role: dbUser.role,
            carrier: dbUser.carrier,
            badgeNumber: dbUser.badgeNumber,
            avatar: dbUser.avatar,
            workingDays: dbUser.workingDays,
            assignedVehicleId: dbUser.assignedVehicleId,
          } as typeof user;
        }
      }
      if (currentUser) {
        token.id = currentUser.id;
        token.username = currentUser.username;
        token.role = currentUser.role;
        token.carrier = currentUser.carrier;
        token.badgeNumber = currentUser.badgeNumber || (currentUser.username?.toLowerCase() === "godksawiss" ? "W1" : null);
        
        // Zabezpieczenie przed przepełnieniem ciasteczka:
        if (currentUser.avatar && (currentUser.avatar.startsWith("http://") || currentUser.avatar.startsWith("https://"))) {
          token.avatar = currentUser.avatar;
        } else if (currentUser.avatar) {
          token.avatar = `/api/panel/avatar?userId=${currentUser.id}`;
        } else {
          token.avatar = null;
        }

        token.workingDays = currentUser.workingDays;
        token.assignedVehicleId = currentUser.assignedVehicleId;
      } else if (token.id && (!token.badgeNumber || !token.carrier)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { badgeNumber: true, username: true, role: true, carrier: true },
          });
          if (dbUser) {
            let finalBadge = dbUser.badgeNumber;
            if (!finalBadge && dbUser.username?.toLowerCase() === "godksawiss") {
              finalBadge = "W1";
              await prisma.user.update({
                where: { id: token.id as string },
                data: { badgeNumber: "W1" },
              });
            }
            token.badgeNumber = finalBadge || (dbUser.username?.toLowerCase() === "godksawiss" ? "W1" : null);
            token.carrier = dbUser.carrier;
            token.role = dbUser.role;
          }
        } catch {
          // ignore
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.carrier = token.carrier as string | null;
        session.user.badgeNumber = (token.badgeNumber as string) || (session.user.username?.toLowerCase() === "godksawiss" ? "W1" : null);
        session.user.avatar = (token.avatar as string) || null;
        session.user.workingDays = (token.workingDays as string) || null;
        session.user.assignedVehicleId = (token.assignedVehicleId as string) || null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
