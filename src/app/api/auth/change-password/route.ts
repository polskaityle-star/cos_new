import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { username, oldPassword, newPassword } = await req.json();

    if (!username || !oldPassword || !newPassword) {
      return NextResponse.json({ message: "Wszystkie pola są wymagane" }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ message: "Nowe hasło musi mieć co najmniej 4 znaki" }, { status: 400 });
    }

    const inputUser = username.trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: inputUser },
          { username: inputUser.toLowerCase() },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ message: "Nie znaleziono użytkownika o podanym loginie" }, { status: 404 });
    }

    // Sprawdzenie starego hasła (zarówno haszowane jak i plaintext)
    let isCorrect = await bcrypt.compare(oldPassword, user.password);
    if (!isCorrect && oldPassword === user.password) {
      isCorrect = true;
    }

    if (!isCorrect) {
      return NextResponse.json({ message: "Dotychczasowe hasło jest nieprawidłowe" }, { status: 400 });
    }

    // Haszowanie nowego hasła
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
