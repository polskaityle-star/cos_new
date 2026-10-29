import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyPassword } from "@/lib/password";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;
const GENERIC_ERROR = "Nieprawidłowy login lub dotychczasowe hasło.";
const TOO_MANY = "Zbyt wiele prób. Spróbuj ponownie za kilkanaście minut.";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers);
    if (!rateLimit(`pw:ip:${ip}`, 10, WINDOW_MS)) {
      return NextResponse.json({ message: TOO_MANY }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const oldPassword = typeof body?.oldPassword === "string" ? body.oldPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!username || !oldPassword || !newPassword) {
      return NextResponse.json({ message: "Wszystkie pola są wymagane" }, { status: 400 });
    }
    if (username.length > 64 || oldPassword.length > 128) {
      return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return NextResponse.json({ message: "Nowe hasło musi mieć od 8 do 128 znaków" }, { status: 400 });
    }

    if (!rateLimit(`pw:user:${username.toLowerCase()}`, 5, WINDOW_MS)) {
      return NextResponse.json({ message: TOO_MANY }, { status: 429 });
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { username: username.toLowerCase() }] },
    });

    if (!user || !user.password) {
      return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
    }

    const { ok } = await verifyPassword(oldPassword, user.password);
    if (!ok) {
      return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
    }

    // Zmieniamy WYŁĄCZNIE hasło. Rola i status zostają bez zmian.
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return NextResponse.json({
      success: true,
      message: "Hasło zostało pomyślnie zmienione! Możesz się teraz zalogować nowym hasłem.",
    });
  } catch {
    return NextResponse.json({ message: "Wystąpił błąd podczas zmiany hasła." }, { status: 500 });
  }
}
