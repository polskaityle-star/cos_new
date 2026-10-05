import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ message: "Brakujące dane." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return NextResponse.json({ message: "Użytkownik o takim nicku już istnieje." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Jesli to pierwszy uzytkownik w systemie, nadaj mu status ZARZAD i z automatu zaakeptuj (przydatne do startu)
    const usersCount = await prisma.user.count();
    const role = usersCount === 0 ? "ZARZAD" : "KIEROWCA";
    const status = usersCount === 0 ? "ACCEPTED" : "PENDING";
    const carrier = usersCount === 0 ? "VMPK" : null;

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role,
        status,
        carrier
      }
    });

    return NextResponse.json({ message: "Wniosek złożony pomyślnie.", userId: user.id }, { status: 201 });
  } catch (error) {
    console.error("REGISTER ERROR", error);
    return NextResponse.json({ message: "Błąd serwera." }, { status: 500 });
  }
}
