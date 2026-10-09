import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const adminPassword = await bcrypt.hash("admin123", 10);

    // Upewnij się, że konto Godksawiss istnieje i ma hasło admin123 oraz rolę WLASCICIEL
    const user = await prisma.user.upsert({
      where: { username: "Godksawiss" },
      update: {
        password: adminPassword,
        role: "WLASCICIEL",
        badgeNumber: "W1",
        status: "ACCEPTED",
        carrier: "VMPK",
      },
      create: {
        username: "Godksawiss",
        password: adminPassword,
        role: "WLASCICIEL",
        badgeNumber: "W1",
        status: "ACCEPTED",
        carrier: "VMPK",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Hasło konta administratora (Godksawiss) zostało pomyślnie zresetowane do: admin123. Możesz się teraz zalogować!",
      user: {
        username: user.username,
        role: user.role,
        badgeNumber: user.badgeNumber,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Błąd podczas resetowania konta administratora" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
