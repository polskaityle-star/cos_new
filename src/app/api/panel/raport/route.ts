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

  // Bezpośredni fallback Base64 dla serverless (Vercel) zapobiegający utracie plików i błędom EROFS
  if (process.env.VERCEL) {
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

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
    if (duty.userId !== session.user.id && session.user.role !== "ZARZAD") {
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

    if (!dutyId || isNaN(startMileage) || isNaN(endMileage) || !startScreenshot || !endScreenshot || !summaryFile) {
      return NextResponse.json({ message: "Wszystkie podstawowe pola i pliki raportu są wymagane." }, { status: 400 });
    }

    // Weryfikacja czy służba należy do tego kierowcy i nie ma jeszcze raportu
    const duty = await prisma.duty.findUnique({
      where: { id: dutyId },
      include: { report: true }
    });

    if (!duty) {
      return NextResponse.json({ message: "Służba nie znaleziona" }, { status: 404 });
    }

    if (duty.userId !== session.user.id && session.user.role !== "ZARZAD") {
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
    const transactions: any[] = [
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

    revalidatePath("/panel/kierowca");
    revalidatePath("/panel/zarzad");
    revalidatePath("/tabor");

    return NextResponse.json({ message: "Raport został wysłany pomyślnie." }, { status: 201 });
  } catch (error) {
    console.error("REPORT ERROR", error);
    return NextResponse.json({ message: "Błąd serwera podczas zapisywania raportu." }, { status: 500 });
  }
}
