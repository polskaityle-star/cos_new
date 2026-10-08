import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return new NextResponse("Brak ID użytkownika", { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (!user || !user.avatar) {
      return new NextResponse("Brak awatara", { status: 404 });
    }

    // Jeśli to zewnętrzny URL
    if (user.avatar.startsWith("http://") || user.avatar.startsWith("https://")) {
      return NextResponse.redirect(user.avatar, 307);
    }

    // Jeśli to base64 data URL
    if (user.avatar.startsWith("data:")) {
      const commaIndex = user.avatar.indexOf(",");
      if (commaIndex !== -1) {
        const header = user.avatar.substring(0, commaIndex);
        const base64Data = user.avatar.substring(commaIndex + 1);
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const buffer = Buffer.from(base64Data, "base64");

        return new NextResponse(buffer, {
          headers: {
            "Content-Type": mime,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
          },
        });
      }
    }

    return new NextResponse("Nieprawidłowy format", { status: 400 });
  } catch (error) {
    console.error("GET AVATAR ERROR", error);
    return new NextResponse("Błąd serwera", { status: 500 });
  }
}

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

    const publicUrl = avatar.startsWith("http")
      ? avatar
      : `/api/panel/avatar?userId=${session.user.id}&t=${Date.now()}`;

    return NextResponse.json({ success: true, avatar: publicUrl });
  } catch (error) {
    console.error("AVATAR UPDATE ERROR", error);
    return NextResponse.json({ message: "Błąd zapisu zdjęcia profilowego" }, { status: 500 });
  }
}
