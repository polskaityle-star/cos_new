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

  // Fallback dla środowiska Vercel bez zewnętrznej bazy:
  // Kopiujemy seed.db do zapisywalnego katalogu /tmp
  if (process.env.VERCEL) {
    try {
      const fs = require("fs");
      const path = require("path");
      const tmpDb = "/tmp/dev.db";
      const seedDb = path.join(process.cwd(), "prisma", "seed.db");
      if (!fs.existsSync(tmpDb) && fs.existsSync(seedDb)) {
        fs.copyFileSync(seedDb, tmpDb);
      }
      process.env.DATABASE_URL = "file:/tmp/dev.db";
    } catch (e) {
      console.error("Vercel tmp db setup error:", e);
    }
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : ["error"],
  });
}

export const prisma = global.prisma || initPrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
