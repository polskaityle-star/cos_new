import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

async function saveUploadFile(file: File, prefix: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || (prefix.includes("summary") ? "text/plain" : "image/png");

  try {
    const ext = path.extname(file.name) || (prefix.includes("summary") ? ".txt" : ".png");
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "reports");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    return `/uploads/reports/${fileName}`;
  } catch {
    // Fallback dla hostingu serverless (np. Vercel)
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
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

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      dutyId = formData.get("dutyId") as string;
      startMileage = parseInt(formData.get("startMileage") as string || "0");
      endMileage = parseInt(formData.get("endMileage") as string || "0");

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
    } else {
      const body = await req.json();
      dutyId = body.dutyId;
      startMileage = body.startMileage;
      endMileage = body.endMileage;
      startScreenshot = body.startScreenshot;
      endScreenshot = body.endScreenshot;
      summaryFile = body.summaryFile;
    }

    if (!dutyId || isNaN(startMileage) || isNaN(endMileage) || !startScreenshot || !endScreenshot || !summaryFile) {
      return NextResponse.json({ message: "Wszystkie pola i pliki raportu są wymagane." }, { status: 400 });
    }

    // Weryfikacja czy służba należy do tego kierowcy i nie ma jeszcze raportu
    const duty = await prisma.duty.findUnique({
      where: { id: dutyId },
      include: { report: true }
    });

    if (!duty) {
      return NextResponse.json({ message: "Służba nie znaleziona" }, { status: 404 });
    }

    if (duty.userId !== session.user.id) {
      return NextResponse.json({ message: "To nie jest twoja służba" }, { status: 403 });
    }

    if (duty.report) {
      return NextResponse.json({ message: "Raport dla tej służby już istnieje" }, { status: 400 });
    }

    // Tworzenie raportu i aktualizacja statusu służby oraz przebiegu pojazdu
    const transactions: any[] = [
      prisma.report.create({
        data: {
          dutyId,
          startMileage,
          endMileage,
          startScreenshot,
          endScreenshot,
          summaryFile
        }
      }),
      prisma.duty.update({
        where: { id: dutyId },
        data: { status: "COMPLETED" }
      })
    ];

    if (duty.vehicleId && endMileage > 0) {
      transactions.push(
        prisma.vehicle.update({
          where: { id: duty.vehicleId },
          data: { mileage: endMileage }
        })
      );
    }

    await prisma.$transaction(transactions);

    revalidatePath("/panel/kierowca");
    revalidatePath("/panel/zarzad");
    revalidatePath("/tabor");

    return NextResponse.json({ message: "Raport został wysłany." }, { status: 201 });
  } catch (error) {
    console.error("REPORT ERROR", error);
    return NextResponse.json({ message: "Błąd serwera podczas zapisywania raportu." }, { status: 500 });
  }
}
