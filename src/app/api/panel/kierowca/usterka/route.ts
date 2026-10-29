import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COLORS, notifyRoles, runAfter, sendToChannel } from "@/lib/discord";
import { isUserAdminOrOwner } from "@/lib/roles";
import { rateLimit } from "@/lib/rateLimit";
import fs from "fs";
import path from "path";

const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"];
const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const MAX_SINGLE_PHOTO_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_TOTAL_PHOTOS_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  // Rate limit: 5 zgłoszeń na godzinę na użytkownika
  const rlKey = `defect:user:${session.user.id}`;
  if (!rateLimit(rlKey, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { message: "Zbyt wiele zgłoszeń usterek. Limit to 5 zgłoszeń na godzinę." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const rawVehicleId = formData.get("vehicleId");
  const vehicleId = typeof rawVehicleId === "string" ? rawVehicleId.trim() : "";
  const rawTitle = formData.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const rawDescription = formData.get("description");
  const description = typeof rawDescription === "string" ? rawDescription.trim() : "";

  if (!vehicleId || !title || !description) {
    return NextResponse.json({ message: "Wypełnij wszystkie pola zgłoszenia" }, { status: 400 });
  }

  if (title.length > 120) {
    return NextResponse.json({ message: "Tytuł usterki może mieć maksymalnie 120 znaków" }, { status: 400 });
  }

  if (description.length > 2000) {
    return NextResponse.json({ message: "Opis usterki może mieć maksymalnie 2000 znaków" }, { status: 400 });
  }

  // Weryfikacja pojazdu i przewoźnika (wyjątek dla admina i mechanika)
  const isStaff = isUserAdminOrOwner(session.user.role) || session.user.role === "MECHANIK";
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) {
    return NextResponse.json({ message: "Wskazany pojazd nie istnieje" }, { status: 404 });
  }
  if (!isStaff && session.user.carrier && vehicle.carrier && vehicle.carrier !== session.user.carrier) {
    return NextResponse.json({ message: "Pojazd należy do innego przewoźnika" }, { status: 403 });
  }

  const photosList: string[] = [];
  let totalBytes = 0;

  // 1. Sprawdź czy przesłano skompresowane zdjęcia JSON z canvas
  const rawPhotosJson = formData.get("photosJson");
  const photosJson = typeof rawPhotosJson === "string" ? rawPhotosJson.trim() : "";
  if (photosJson) {
    try {
      const parsed = JSON.parse(photosJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item)) {
            const commaIdx = item.indexOf(",");
            const base64Len = item.length - (commaIdx + 1);
            const approxBytes = Math.floor((base64Len * 3) / 4);
            if (approxBytes > MAX_SINGLE_PHOTO_BYTES) {
              return NextResponse.json({ message: "Pojedyncze zdjęcie przekracza dopuszczalny limit 3 MB" }, { status: 413 });
            }
            totalBytes += approxBytes;
            photosList.push(item);
          } else {
            return NextResponse.json({ message: "Niedozwolony format zdjęcia w photosJson" }, { status: 400 });
          }
        }
      }
    } catch {
      return NextResponse.json({ message: "Nieprawidłowy format JSON zdjęć" }, { status: 400 });
    }
  }

  // 2. Obsłuż tradycyjne pliki z formularza
  const uploadedFiles = formData.getAll("photos");
  for (const item of uploadedFiles) {
    if (
      typeof item === "object" &&
      item !== null &&
      "size" in item &&
      (item as File).size > 0 &&
      typeof (item as File).arrayBuffer === "function"
    ) {
      const file = item as File;
      if (!ALLOWED_MIMES.includes(file.type)) {
        return NextResponse.json(
          { message: `Niedozwolony format pliku: ${file.type}. Dozwolone wyłącznie obrazy PNG, JPEG, WEBP.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_SINGLE_PHOTO_BYTES) {
        return NextResponse.json({ message: "Pojedyncze zdjęcie przekracza limit 3 MB" }, { status: 413 });
      }
      totalBytes += file.size;

      const ext = MIME_TO_EXT[file.type] || ".jpg";
      const buffer = Buffer.from(await file.arrayBuffer());
      if (process.env.VERCEL) {
        photosList.push(`data:${file.type};base64,${buffer.toString("base64")}`);
      } else {
        try {
          const fileName = `defect_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
          const uploadDir = path.join(process.cwd(), "public", "uploads", "defects");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          fs.writeFileSync(path.join(uploadDir, fileName), buffer);
          photosList.push(`/uploads/defects/${fileName}`);
        } catch {
          photosList.push(`data:${file.type};base64,${buffer.toString("base64")}`);
        }
      }
    }
  }

  if (photosList.length === 0) {
    return NextResponse.json(
      { message: "Dodanie co najmniej jednego zdjęcia usterki/awarii jest obowiązkowe." },
      { status: 400 }
    );
  }

  if (photosList.length > 5) {
    return NextResponse.json(
      { message: "Maksymalna liczba zdjęć w jednym zgłoszeniu to 5." },
      { status: 413 }
    );
  }

  if (totalBytes > MAX_TOTAL_PHOTOS_BYTES) {
    return NextResponse.json(
      { message: "Łączny rozmiar wszystkich zdjęć przekracza dopuszczalny limit 4 MB." },
      { status: 413 }
    );
  }

  // Transakcja: Utworzenie defektu + zmiana statusu pojazdu na WARSZTAT
  await prisma.$transaction([
    prisma.vehicleDefect.create({
      data: {
        userId: session.user.id,
        vehicleId,
        title,
        description,
        photos: JSON.stringify(photosList),
        status: "NOWE",
      },
    }),
    prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: "WARSZTAT" },
    }),
  ]);

  revalidatePath("/tabor");
  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  const reporterUsername = session.user.username;
  await runAfter(async () => {
    const veh = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    const e = {
      title: `Usterka: ${title}`,
      description: description,
      color: COLORS.bad,
      fields: [
        { name: "Pojazd", value: veh ? `#${veh.fleetNumber} ${veh.model} (${veh.registration})` : vehicleId, inline: true },
        { name: "Zgłosił", value: reporterUsername, inline: true },
        { name: "Zdjęcia", value: String(photosList.length), inline: true },
      ],
    };
    await sendToChannel("USTERKI", [e]);
    await notifyRoles(["MECHANIK"], [e]);
  });

  redirect("/panel/kierowca");
}
