import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_GET_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024; // ~1.5 MB

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return new NextResponse("Brak ID użytkownika", {
        status: 400,
        headers: { "X-Content-Type-Options": "nosniff" },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (!user || !user.avatar) {
      return new NextResponse("Brak awatara", {
        status: 404,
        headers: { "X-Content-Type-Options": "nosniff" },
      });
    }

    // Jeśli to zewnętrzny URL
    if (user.avatar.startsWith("https://") || user.avatar.startsWith("http://")) {
      return NextResponse.redirect(user.avatar, 307);
    }

    // Jeśli to base64 data URL
    if (user.avatar.startsWith("data:")) {
      const commaIndex = user.avatar.indexOf(",");
      if (commaIndex !== -1) {
        const header = user.avatar.substring(0, commaIndex);
        const base64Data = user.avatar.substring(commaIndex + 1);
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1].toLowerCase() : "";

        if (!ALLOWED_GET_MIME.includes(mime)) {
          return new NextResponse("Niedozwolony format MIME", {
            status: 400,
            headers: { "X-Content-Type-Options": "nosniff" },
          });
        }

        const buffer = Buffer.from(base64Data, "base64");

        return new NextResponse(buffer, {
          headers: {
            "Content-Type": mime,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
          },
        });
      }
    }

    return new NextResponse("Nieprawidłowy format", {
      status: 400,
      headers: { "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    console.error("GET AVATAR ERROR", error);
    return new NextResponse("Błąd serwera", {
      status: 500,
      headers: { "X-Content-Type-Options": "nosniff" },
    });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
    }

    const body = await req.json();
    const avatar = body?.avatar;
    if (!avatar || typeof avatar !== "string") {
      return NextResponse.json({ message: "Nieprawidłowy format zdjęcia" }, { status: 400 });
    }

    const trimmed = avatar.trim();

    // Akceptujemy tylko data:image/(png|jpeg|webp|gif);base64,... albo URL https://
    const isHttps = trimmed.startsWith("https://");
    const isSafeDataUri = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed);

    if (!isHttps && !isSafeDataUri) {
      return NextResponse.json(
        { message: "Niedozwolony format awatara. Dozwolone wyłącznie https:// lub data:image/(png|jpeg|webp|gif);base64." },
        { status: 400 }
      );
    }

    // Limit rozmiaru ~1.5 MB
    if (trimmed.length > MAX_AVATAR_BYTES * 1.4) {
      return NextResponse.json(
        { message: "Rozmiar awatara przekracza dopuszczalny limit (~1.5 MB)." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatar: trimmed },
    });

    const publicUrl = isHttps
      ? trimmed
      : `/api/panel/avatar?userId=${session.user.id}&t=${Date.now()}`;

    return NextResponse.json({ success: true, avatar: publicUrl });
  } catch (error) {
    console.error("AVATAR UPDATE ERROR", error);
    return NextResponse.json({ message: "Błąd zapisu zdjęcia profilowego" }, { status: 500 });
  }
}
