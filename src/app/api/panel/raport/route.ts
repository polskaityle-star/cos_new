import { isSafeStoredFile } from "@/lib/files";
import { isUserAdminOrOwner } from "@/lib/roles";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COLORS, runAfter, sendToChannel } from "@/lib/discord";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

const ALLOWED_UPLOAD_MIME = ["image/png", "image/jpeg", "image/webp", "text/plain"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

class FileValidationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function saveUploadFile(file: File, prefix: string): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new FileValidationError(`Plik ${file.name} przekracza maksymalny dopuszczalny rozmiar 5 MB.`, 400);
  }

  const mimeType = (file.type || (prefix.includes("summary") ? "text/plain" : "image/png")).toLowerCase();
  if (!ALLOWED_UPLOAD_MIME.includes(mimeType)) {
    throw new FileValidationError(`Plik ${file.name} ma niedozwolony typ MIME (${mimeType}). Dozwolone: PNG, JPEG, WebP, TXT.`, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.VERCEL) {
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  try {
    const extMap: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/webp": ".webp",
      "text/plain": ".txt",
    };
    const safeExt = extMap[mimeType] || (prefix.includes("summary") ? ".txt" : ".png");
    const safeName = `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "reports");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, safeName), buffer);
    return `/uploads/reports/${safeName}`;
  } catch {
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dutyId = searchParams.get("dutyId");

    if (!dutyId) {
      return NextResponse.json({ message: "Brak dutyId" }, { status: 400 });
    }

    const duty = await prisma.duty.findUnique({
      where: { id: dutyId },
      include: {
        line: true,
        vehicle: true,
        replacementVehicle: true,
      },
    });

    if (!duty) {
      return NextResponse.json({ message: "Służba nie znaleziona" }, { status: 404 });
    }

    // Check if user is owner of duty or ZARZAD
    if (duty.userId !== session.user.id && !isUserAdminOrOwner(session.user.role)) {
      return NextResponse.json({ message: "Brak uprawnień do tej służby" }, { status: 403 });
    }

    return NextResponse.json({ duty });
  } catch (err) {
    console.error("GET DUTY ERROR", err);
    return NextResponse.json({ message: "Błąd serwera" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    let dutyId = "";
    let startMileage = 0;
    let endMileage = 0;
    let startScreenshot = "";
    let endScreenshot = "";
    let summaryFile = "";
    const depotScreenshotsObj: Record<string, string> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      dutyId = formData.get("dutyId") as string;
      startMileage = parseInt((formData.get("startMileage") as string) || "0");
      endMileage = parseInt((formData.get("endMileage") as string) || "0");

      const startFile = formData.get("startScreenshotFile") as File | null;
      const endFile = formData.get("endScreenshotFile") as File | null;
      const summaryDoc = formData.get("summaryDocFile") as File | null;

      if (startFile && startFile.size > 0) {
        startScreenshot = await saveUploadFile(startFile, "start");
      } else {
        startScreenshot = (formData.get("startScreenshot") as string) || "";
      }

      if (endFile && endFile.size > 0) {
        endScreenshot = await saveUploadFile(endFile, "end");
      } else {
        endScreenshot = (formData.get("endScreenshot") as string) || "";
      }

      if (summaryDoc && summaryDoc.size > 0) {
        summaryFile = await saveUploadFile(summaryDoc, "summary");
      } else {
        summaryFile = (formData.get("summaryFile") as string) || "";
      }

      // Opcjonalne screeny z wyjazdu i zjazdu do zajezdni (Wymóg 10)
      const dep1File = formData.get("depotDep1File") as File | null;
      const arr1File = formData.get("depotArr1File") as File | null;
      const dep2File = formData.get("depotDep2File") as File | null;
      const arr2File = formData.get("depotArr2File") as File | null;

      if (dep1File && dep1File.size > 0) {
        depotScreenshotsObj.depotDep1 = await saveUploadFile(dep1File, "depot_dep1");
      }
      if (arr1File && arr1File.size > 0) {
        depotScreenshotsObj.depotArr1 = await saveUploadFile(arr1File, "depot_arr1");
      }
      if (dep2File && dep2File.size > 0) {
        depotScreenshotsObj.depotDep2 = await saveUploadFile(dep2File, "depot_dep2");
      }
      if (arr2File && arr2File.size > 0) {
        depotScreenshotsObj.depotArr2 = await saveUploadFile(arr2File, "depot_arr2");
      }
    } else {
      const body = await req.json();
      dutyId = body.dutyId;
      startMileage = body.startMileage;
      endMileage = body.endMileage;
      startScreenshot = body.startScreenshot;
      endScreenshot = body.endScreenshot;
      summaryFile = body.summaryFile;
      if (body.depotScreenshots) {
        Object.assign(depotScreenshotsObj, body.depotScreenshots);
      }
    }

        if (
      !isSafeStoredFile(startScreenshot, "image") ||
      !isSafeStoredFile(endScreenshot, "image") ||
      !isSafeStoredFile(summaryFile, "text")
    ) {
      return NextResponse.json(
        { message: "Nieprawidłowy format lub ścieżka pliku raportu (dozwolone: data URI, https:// lub /uploads/reports/ bez ..)." },
        { status: 400 }
      );
    }

    for (const val of Object.values(depotScreenshotsObj)) {
      if (!isSafeStoredFile(val, "image")) {
        return NextResponse.json(
          { message: "Nieprawidłowy format lub ścieżka zdjęcia z zajezdni." },
          { status: 400 }
        );
      }
    }

    if (!dutyId || isNaN(startMileage) || isNaN(endMileage) || !startScreenshot || !endScreenshot || !summaryFile) {
      return NextResponse.json({ message: "Wszystkie podstawowe pola i pliki raportu są wymagane." }, { status: 400 });
    }

    if (!Number.isInteger(startMileage) || !Number.isInteger(endMileage) || startMileage < 0 || endMileage < 0 || endMileage < startMileage) {
      return NextResponse.json(
        { message: "Nieprawidłowy przebieg: wartości muszą być liczbami całkowitymi >= 0, a stan końcowy musi być większy lub równy początkowemu." },
        { status: 400 }
      );
    }

    // Weryfikacja czy służba należy do tego kierowcy i nie ma jeszcze raportu
    const duty = await prisma.duty.findUnique({
      where: { id: dutyId },
      include: { report: true }
    });

    if (!duty) {
      return NextResponse.json({ message: "Służba nie znaleziona" }, { status: 404 });
    }

    if (duty.userId !== session.user.id && !isUserAdminOrOwner(session.user.role)) {
      return NextResponse.json({ message: "To nie jest twoja służba" }, { status: 403 });
    }

    if (duty.report) {
      return NextResponse.json({ message: "Raport dla tej służby już istnieje" }, { status: 400 });
    }

    // Blokada raportu dla przyszłych służb
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const dutyD = new Date(duty.date);
    const dutyStr = `${dutyD.getFullYear()}-${String(dutyD.getMonth() + 1).padStart(2, "0")}-${String(dutyD.getDate()).padStart(2, "0")}`;

    if (dutyStr > todayStr && session.user.role === "KIEROWCA") {
      return NextResponse.json({
        message: `Służba jest zaplanowana na przyszłość (${dutyD.toLocaleDateString("pl-PL")}). Raport możesz złożyć dopiero w dniu odbywania służby lub po jej zakończeniu.`
      }, { status: 400 });
    }

    const depotScreenshotsJson = Object.keys(depotScreenshotsObj).length > 0
      ? JSON.stringify(depotScreenshotsObj)
      : null;

    // Tworzenie raportu i aktualizacja statusu służby
    const transactions = [
      prisma.report.create({
        data: {
          dutyId,
          startMileage,
          endMileage,
          startScreenshot,
          endScreenshot,
          summaryFile,
          depotScreenshots: depotScreenshotsJson,
        }
      }),
      prisma.duty.update({
        where: { id: dutyId },
        data: { status: "COMPLETED" }
      })
    ];

    await prisma.$transaction(transactions);

    const driverName = session.user.username;
    await runAfter(() =>
      sendToChannel("RAPORTY", [
        {
          title: "Nowy raport do sprawdzenia",
          color: COLORS.info,
          fields: [
            { name: "Kierowca", value: driverName, inline: true },
            { name: "Służba", value: `${dutyStr}${duty.brigade ? ` • ${duty.brigade}` : ""}`, inline: true },
            { name: "Przebieg", value: `${Math.max(0, endMileage - startMileage)} km`, inline: true },
          ],
        },
      ])
    );

    revalidatePath("/panel/kierowca");
    revalidatePath("/panel/zarzad");
    revalidatePath("/tabor");

    return NextResponse.json({ message: "Raport został wysłany pomyślnie." }, { status: 201 });
  } catch (err) {
    if (err instanceof FileValidationError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("REPORT ERROR", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ message: "Błąd serwera podczas zapisywania raportu." }, { status: 500 });
  }
}
