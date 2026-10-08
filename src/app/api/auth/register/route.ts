import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateBadgeNumber } from "@/lib/roles";

export async function POST(req: Request) {
  try {
    const { username, password, carrier, age, bio } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ message: "Brakujące dane (login i hasło są wymagane)." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return NextResponse.json({ message: "Użytkownik o takim nicku już istnieje." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Jeśli to pierwszy użytkownik w systemie, nadaj mu status WLASCICIEL i z automatu zaakceptuj
    const usersCount = await prisma.user.count();
    const role = usersCount === 0 ? "WLASCICIEL" : "KIEROWCA";
    const status = usersCount === 0 ? "ACCEPTED" : "PENDING";
    const assignedCarrier = carrier || (usersCount === 0 ? "VMPK" : "VMPK");
    const badgeNumber = generateBadgeNumber(role);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role,
        status,
        carrier: assignedCarrier,
        age: age ? parseInt(age, 10) : null,
        bio: bio || null,
        badgeNumber,
      }
    });

    return NextResponse.json({
      message: `Wniosek złożony pomyślnie! Przydzielono numer kierowcy: ${badgeNumber}. Poczekaj na akceptację przez Zarząd.`,
      userId: user.id,
      badgeNumber,
    }, { status: 201 });
  } catch (error) {
    console.error("REGISTER ERROR", error);
    return NextResponse.json({ message: "Błąd serwera podczas rejestracji." }, { status: 500 });
  }
}
