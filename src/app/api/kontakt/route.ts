import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { COLORS, runAfter, sendToChannel } from "@/lib/discord";

const HOUR_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers);
    if (!rateLimit(`contact:ip:${ip}`, 5, HOUR_MS)) {
      return NextResponse.json({ message: "Zbyt wiele wiadomości. Spróbuj ponownie później." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!name || !subject || !message) {
      return NextResponse.json({ message: "Wypełnij wymagane pola (Imię, Temat, Wiadomość)." }, { status: 400 });
    }
    if (name.length > 60 || subject.length > 150 || message.length > 2000 || email.length > 120) {
      return NextResponse.json({ message: "Któreś z pól jest zbyt długie." }, { status: 400 });
    }
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ message: "Podany adres e-mail jest nieprawidłowy." }, { status: 400 });
    }

    await prisma.contactMessage.create({
      data: {
        name,
        email: email || "Brak emaila",
        subject,
        message,
        status: "NOWA",
      },
    });

    revalidatePath("/panel/zarzad");

    await runAfter(() =>
      sendToChannel("KONTAKT", [
        {
          title: `Formularz kontaktowy: ${subject}`,
          description: message,
          color: COLORS.info,
          fields: [
            { name: "Od", value: name, inline: true },
            { name: "E-mail", value: email || "brak", inline: true },
          ],
        },
      ])
    );

    return NextResponse.json({ message: "Wiadomość została wysłana pomyślnie!" }, { status: 201 });
  } catch (error) {
    console.error("CONTACT MESSAGE ERROR", error);
    return NextResponse.json({ message: "Wystąpił błąd podczas wysyłania wiadomości." }, { status: 500 });
  }
}
