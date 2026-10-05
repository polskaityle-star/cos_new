import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, subject, message } = body;

    if (!name || !subject || !message) {
      return NextResponse.json({ message: "Wypełnij wymagane pola (Imię, Temat, Wiadomość)." }, { status: 400 });
    }

    await prisma.contactMessage.create({
      data: {
        name,
        email: email || "Brak emaila",
        subject,
        message,
        status: "NOWA"
      }
    });

    revalidatePath("/panel/zarzad");

    return NextResponse.json({ message: "Wiadomość została wysłana pomyślnie!" }, { status: 201 });
  } catch (error) {
    console.error("CONTACT MESSAGE ERROR", error);
    return NextResponse.json({ message: "Wystąpił błąd podczas wysyłania wiadomości." }, { status: 500 });
  }
}
