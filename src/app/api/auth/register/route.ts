import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateUniqueBadgeNumber } from "@/lib/roles";
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
    // Hasło używane dokładnie tak, jak wpisane (bez .trim())
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedCarrier = CARRIERS.includes(carrier) ? carrier : "VMPK";
    const ageNum = age ? parseInt(String(age), 10) : NaN;
    const validAge = Number.isFinite(ageNum) && ageNum >= 10 && ageNum <= 100 ? ageNum : null;

    // Atomowa transakcja rejestracji pierwszego użytkownika lub kierowcy
    const user = await prisma.$transaction(async (tx) => {
      const currentCount = await tx.user.count();

      // Zarezerwowane nicki
      if (currentCount > 0 && RESERVED.includes(username.toLowerCase())) {
        throw new Error("RESERVED_NICK");
      }

      const existingUser = await tx.user.findFirst({
        where: { username: { equals: username, mode: "insensitive" } },
      });
      if (existingUser) {
        throw new Error("USER_EXISTS");
      }

      let isOwner = currentCount === 0;
      if (isOwner && process.env.OWNER_SETUP_TOKEN) {
        const setupToken = req.headers.get("x-owner-setup-token");
        if (setupToken !== process.env.OWNER_SETUP_TOKEN) {
          isOwner = false;
        }
      }

      const role = isOwner ? "WLASCICIEL" : "KIEROWCA";
      const status = isOwner ? "ACCEPTED" : "PENDING";
      const badgeNumber = await generateUniqueBadgeNumber(role, tx);

      return tx.user.create({
        data: {
          username,
          password: hashedPassword,
          role,
          status,
          carrier: assignedCarrier,
          age: validAge,
          bio: bio || null,
          badgeNumber,
        },
      });
    });

    if (user.status === "PENDING") {
      await runAfter(() =>
        sendToChannel("REKRUTACJA", [
          {
            title: "Nowe zgłoszenie rekrutacyjne",
            color: COLORS.info,
            fields: [
              { name: "Nick", value: username, inline: true },
              { name: "Numer", value: user.badgeNumber || "-", inline: true },
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
        success: true,
        message:
          user.role === "WLASCICIEL"
            ? "Witaj Właścicielu! Twoje konto zostało pomyślnie utworzone."
            : "Rejestracja pomyślna. Twoje konto oczekuje na weryfikację przez Zarząd.",
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json({ message: "Login lub numer służbowy jest już zajęty." }, { status: 409 });
    }
    if ((err as Error)?.message === "USER_EXISTS") {
      return NextResponse.json({ message: "Użytkownik o takim nicku już istnieje." }, { status: 400 });
    }
    if ((err as Error)?.message === "RESERVED_NICK") {
      return NextResponse.json({ message: "Ten nick jest zarezerwowany." }, { status: 400 });
    }
    console.error("REGISTER ERROR", err);
    return NextResponse.json({ message: "Błąd podczas rejestracji." }, { status: 500 });
  }
}
