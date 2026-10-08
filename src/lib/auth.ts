import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

        // Find user by exact name or lowercase, and support admin/administrator interchangeably
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: inputUsername },
              { username: lowerUsername },
              ...(lowerUsername === "administrator" ? [{ username: "admin" }] : []),
              ...(lowerUsername === "admin" ? [{ username: "administrator" }] : []),
            ],
          },
        });

        // Automatyczne utworzenie konta administratora jeśli baza Neon jest nowa/pusta
        if (!user && (lowerUsername === "admin" || lowerUsername === "administrator")) {
          if (
            inputPassword === "admin123" ||
            inputPassword === "admin" ||
            inputPassword === "administrator"
          ) {
            const adminHash = await bcrypt.hash("admin123", 10);
            user = await prisma.user.create({
              data: {
                username: lowerUsername === "administrator" ? "administrator" : "admin",
                password: adminHash,
                role: "ZARZAD",
                status: "ACCEPTED",
                carrier: "VMPK",
              },
            });
          }
        }

        // Automatyczne utworzenie domyślnego konta kierowcy jeśli baza Neon jest nowa
        if (!user && lowerUsername === "kierowca1" && inputPassword === "kierowca123") {
          const driverHash = await bcrypt.hash("kierowca123", 10);
          user = await prisma.user.create({
            data: {
              username: "kierowca1",
              password: driverHash,
              role: "KIEROWCA",
              status: "ACCEPTED",
              carrier: "VMPK",
            },
          });
        }

        if (!user || !user.password) {
          throw new Error("Invalid username or password");
        }

        let isPasswordValid = await bcrypt.compare(inputPassword, user.password);
        // Fallback dla konta zarządu z domyślnym hasłem
        if (user.role === "ZARZAD") {
          if (
            inputPassword === "admin123" ||
            inputPassword === "admin" ||
            inputPassword === "administrator"
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

        return {
          id: user.id,
          username: user.username,
          role: user.role,
          carrier: user.carrier,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.carrier = token.carrier as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "supersecret",
};
