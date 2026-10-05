import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function initPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "";
  const isCloudLibSql = tursoUrl.startsWith("libsql:") || tursoUrl.startsWith("https:");

  if (isCloudLibSql) {
    const client = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(client);
    return new PrismaClient({ adapter });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : ["error"],
  });
}

export const prisma = global.prisma || initPrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
