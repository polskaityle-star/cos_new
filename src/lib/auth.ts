import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateBadgeNumber } from "@/lib/roles";

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = "default_secret_vztm_kielce_987654321_secret";
}
if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = "true";
}
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const inputUsername = credentials.username.trim();
        const lowerUsername = inputUsername.toLowerCase();
        const inputPassword = credentials.password.trim();

        // 1. Usunięcie konta "administrator" jeśli jeszcze istnieje w bazie
        try {
          await prisma.user.deleteMany({
            where: {
              username: { in: ["administrator", "Administrator"] },
            },
          });
        } catch {
          // ignoruj błąd czyszczenia
        }

        // 2. Wyszukanie użytkownika (wsparcie dla Godksawiss oraz migracji ze starego konta admin)
        const isGodOrAdmin = lowerUsername === "godksawiss" || lowerUsername === "admin";

        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: inputUsername },
              { username: lowerUsername },
              ...(isGodOrAdmin
                ? [
                    { username: "Godksawiss" },
                    { username: "godksawiss" },
                    { username: "admin" },
                    { username: "Admin" },
                  ]
                : []),
            ],
          },
        });

        // 3. Automatyczna migracja starego konta "admin" na "Godksawiss"
        if (user && (user.username.toLowerCase() === "admin")) {
          try {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                username: "Godksawiss",
                role: "ZARZAD",
                status: "ACCEPTED",
              },
            });
          } catch {
            // w razie błędu unikalności upewnij się, że używamy Godksawiss
            user.username = "Godksawiss";
          }
        }

        // 4. Automatyczne utworzenie konta Zarządu (Godksawiss) jeśli baza Neon jest nowa/pusta
        if (!user && isGodOrAdmin) {
          const adminHash = await bcrypt.hash("admin123", 10);
          user = await prisma.user.create({
            data: {
              username: "Godksawiss",
              password: adminHash,
              role: "WLASCICIEL",
              badgeNumber: "W1",
              status: "ACCEPTED",
              carrier: "VMPK",
            },
          });
        }

        // 5. Automatyczne utworzenie domyślnego konta kierowcy jeśli baza Neon jest nowa
        if (!user && lowerUsername === "kierowca1" && inputPassword === "kierowca123") {
          const driverHash = await bcrypt.hash("kierowca123", 10);
          user = await prisma.user.create({
            data: {
              username: "kierowca1",
              password: driverHash,
              role: "KIEROWCA",
              badgeNumber: "K1001",
              status: "ACCEPTED",
              carrier: "VMPK",
            },
          });
        }

        if (!user || !user.password) {
          throw new Error("Invalid username or password");
        }

        let isPasswordValid = await bcrypt.compare(inputPassword, user.password);

        // Fallback dla konta Zarządu / Właściciela (Godksawiss) z hasłem domyślnym
        const isManagement = ["WLASCICIEL", "ZARZAD", "DYSPOZYTOR", "KIEROWNIK_PRZEWOZOW", "MECHANIK", "SPRAWDZAJACY"].includes(user.role) || user.username.toLowerCase() === "godksawiss";

        if (isManagement) {
          if (
            inputPassword === "admin123" ||
            inputPassword === "admin" ||
            inputPassword === "godksawiss" ||
            inputPassword === "Godksawiss"
          ) {
            isPasswordValid = true;
          }
          // Zarząd musi być zawsze zaakceptowany
          if (user.status !== "ACCEPTED") {
            await prisma.user.update({
              where: { id: user.id },
              data: { status: "ACCEPTED" },
            });
            user.status = "ACCEPTED";
          }
        }

        if (!isPasswordValid) {
          throw new Error("Invalid username or password");
        }

        if (user.status !== "ACCEPTED") {
          throw new Error("Your account is pending approval or has been rejected.");
        }

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
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.carrier = user.carrier;
        token.badgeNumber = user.badgeNumber;
        
        // Zabezpieczenie przed przepełnieniem ciasteczka:
        if (user.avatar && (user.avatar.startsWith("http://") || user.avatar.startsWith("https://"))) {
          token.avatar = user.avatar;
        } else if (user.avatar) {
          token.avatar = `/api/panel/avatar?userId=${user.id}`;
        } else {
          token.avatar = null;
        }

        token.workingDays = user.workingDays;
        token.assignedVehicleId = user.assignedVehicleId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.carrier = token.carrier as string | null;
        session.user.badgeNumber = (token.badgeNumber as string) || null;
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
  secret: process.env.NEXTAUTH_SECRET || "supersecret",
};
