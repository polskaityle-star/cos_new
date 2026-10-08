import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
    }

    const { avatar } = await req.json();
    if (!avatar || typeof avatar !== "string") {
      return NextResponse.json({ message: "Nieprawidłowy format zdjęcia" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatar },
    });

    return NextResponse.json({ success: true, avatar });
  } catch (error) {
    console.error("AVATAR UPDATE ERROR", error);
    return NextResponse.json({ message: "Błąd zapisu zdjęcia profilowego" }, { status: 500 });
  }
}
