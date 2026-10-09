import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  const formData = await req.formData();
  const vehicleId = formData.get("vehicleId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  if (!vehicleId || !title || !description) {
    return NextResponse.json({ message: "Wypełnij wszystkie pola zgłoszenia" }, { status: 400 });
  }

  const photosList: string[] = [];

  // 1. Sprawdź czy przesłano skompresowane zdjęcia JSON z canvas
  const photosJson = formData.get("photosJson") as string;
  if (photosJson) {
    try {
      const parsed = JSON.parse(photosJson);
      if (Array.isArray(parsed)) {
        photosList.push(...parsed);
      }
    } catch {}
  }

  // 2. Obsłuż tradycyjne pliki z formularza
  const uploadedFiles = formData.getAll("photos") as (File | string)[];
  for (const item of uploadedFiles) {
    if (typeof item === "object" && item.size > 0 && typeof item.arrayBuffer === "function") {
      const buffer = Buffer.from(await item.arrayBuffer());
      const mime = item.type || "image/jpeg";
      if (process.env.VERCEL) {
        photosList.push(`data:${mime};base64,${buffer.toString("base64")}`);
      } else {
        try {
          const ext = path.extname(item.name) || ".jpg";
          const fileName = `defect_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
          const uploadDir = path.join(process.cwd(), "public", "uploads", "defects");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          fs.writeFileSync(path.join(uploadDir, fileName), buffer);
          photosList.push(`/uploads/defects/${fileName}`);
        } catch {
          photosList.push(`data:${mime};base64,${buffer.toString("base64")}`);
        }
      }
    }
  }

  // Wymóg 6: Zdjęcia są obowiązkowe (co najmniej jedno)
  if (photosList.length === 0) {
    return NextResponse.json(
      { message: "Dodanie co najmniej jednego zdjęcia usterki/awarii jest obowiązkowe." },
      { status: 400 }
    );
  }

  // Utwórz zgłoszenie
  await prisma.vehicleDefect.create({
    data: {
      userId: session.user.id,
      vehicleId,
      title,
      description,
      photos: JSON.stringify(photosList),
      status: "NOWE",
    },
  });

  // Oznacz pojazd jako wymagający warsztatu
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { status: "WARSZTAT" },
  });

  revalidatePath("/tabor");
  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  redirect("/panel/kierowca");
}
