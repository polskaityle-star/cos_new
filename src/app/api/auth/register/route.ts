import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateBadgeNumber } from "@/lib/roles";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { COLORS, runAfter, sendToChannel } from "@/lib/discord";

const HOUR_MS = 60 * 60 * 1000;
const NAME_RE = new RegExp("^[\\p{L}\\p{N}_. -]{3,32}$", "u");
const RESERVED = [
  "godksawiss", "admin", "administrator", "administator",
  "wlasciciel", "zarzad", "ksawe", "root", "system", "moderator",
];
const CARRIERS = ["VMPK", "VBP"];

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers);
    if (!rateLimit(`register:ip:${ip}`, 5, HOUR_MS)) {
      return NextResponse.json({ message: "Zbyt wiele prób. Spróbuj ponownie później." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const carrier = typeof body?.carrier === "string" ? body.carrier : "";
    const age = body?.age;
    const bio = typeof body?.bio === "string" ? body.bio.trim() : "";

    if (!username || !password) {
      return NextResponse.json({ message: "Brakujące dane (login i hasło są wymagane)." }, { status: 400 });
    }
    if (!NAME_RE.test(username)) {
      return NextResponse.json(
        { message: "Nick musi mieć 3-32 znaki (litery, cyfry, spacja, _ . -)." },
        { status: 400 }
      );
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ message: "Hasło musi mieć od 8 do 128 znaków." }, { status: 400 });
    }
    if (bio.length > 500) {
      return NextResponse.json({ message: "Opis może mieć maksymalnie 500 znaków." }, { status: 400 });
    }

    const usersCount = await prisma.user.count();

    // Zarezerwowane nicki (poza pierwszym użytkownikiem systemu)
    if (usersCount > 0 && RESERVED.includes(username.toLowerCase())) {
      return NextResponse.json({ message: "Ten nick jest zarezerwowany." }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });
    if (existingUser) {
      return NextResponse.json({ message: "Użytkownik o takim nicku już istnieje." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Jeśli to pierwszy użytkownik w systemie, nadaj mu status WLASCICIEL i z automatu zaakceptuj
    const role = usersCount === 0 ? "WLASCICIEL" : "KIEROWCA";
    const status = usersCount === 0 ? "ACCEPTED" : "PENDING";
    const assignedCarrier = CARRIERS.includes(carrier) ? carrier : "VMPK";
    const badgeNumber = generateBadgeNumber(role);

    const ageNum = age ? parseInt(String(age), 10) : NaN;

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role,
        status,
        carrier: assignedCarrier,
        age: Number.isFinite(ageNum) && ageNum >= 10 && ageNum <= 100 ? ageNum : null,
        bio: bio || null,
        badgeNumber,
      },
    });

    if (status === "PENDING") {
      await runAfter(() =>
        sendToChannel("REKRUTACJA", [
          {
            title: "Nowe zgłoszenie rekrutacyjne",
            color: COLORS.info,
            fields: [
              { name: "Nick", value: username, inline: true },
              { name: "Numer", value: badgeNumber, inline: true },
              { name: "Przewoźnik", value: assignedCarrier, inline: true },
              { name: "Wiek", value: user.age ? String(user.age) : "-", inline: true },
              { name: "O sobie", value: bio || "-" },
            ],
          },
        ])
      );
    }

    return NextResponse.json(
      {
        message: `Wniosek złożony pomyślnie! Przydzielono numer kierowcy: ${badgeNumber}. Poczekaj na akceptację przez Zarząd.`,
        userId: user.id,
        badgeNumber,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("REGISTER ERROR", error);
    return NextResponse.json({ message: "Błąd serwera podczas rejestracji." }, { status: 500 });
  }
}
