import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { canManageFleet } from "@/lib/roles";

const ALLOWED_CARRIERS = ["VMPK", "VBP"];
const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"];
const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageFleet(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania taborem" }, { status: 403 });
  }

  const formData = await req.formData();
  const rawCarrier = formData.get("carrier");
  const carrier = typeof rawCarrier === "string" ? rawCarrier.trim() : "";
  const rawModel = formData.get("model");
  const model = typeof rawModel === "string" ? rawModel.trim() : "";
  const rawRegistration = formData.get("registration");
  const registration = typeof rawRegistration === "string" ? rawRegistration.trim() : "";
  const rawFleetNumber = formData.get("fleetNumber");
  const fleetNumber = typeof rawFleetNumber === "string" ? rawFleetNumber.trim() : "";
  const rawMileageStr = formData.get("mileage");
  const mileageStr = typeof rawMileageStr === "string" ? rawMileageStr.trim() : "0";
  const mileage = parseInt(mileageStr || "0", 10);
  const rawImage = formData.get("image");
  const imageFile =
    typeof rawImage === "object" && rawImage !== null && "size" in rawImage && (rawImage as File).size > 0
      ? (rawImage as File)
      : null;

  if (!ALLOWED_CARRIERS.includes(carrier)) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "invalid_carrier");
    return NextResponse.redirect(url, 303);
  }

  if (!model || !registration || !fleetNumber) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "missing_fields");
    return NextResponse.redirect(url, 303);
  }

  if (isNaN(mileage) || mileage < 0) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "invalid_mileage");
    return NextResponse.redirect(url, 303);
  }

  let imageUrl: string | null = null;

  if (imageFile && typeof imageFile.arrayBuffer === "function") {
    if (!ALLOWED_MIMES.includes(imageFile.type)) {
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "invalid_image_type");
      return NextResponse.redirect(url, 303);
    }
    if (imageFile.size > 3 * 1024 * 1024) {
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "image_too_large");
      return NextResponse.redirect(url, 303);
    }

    const ext = MIME_TO_EXT[imageFile.type] || ".jpg";
    const buffer = Buffer.from(await imageFile.arrayBuffer());

    if (process.env.VERCEL) {
      imageUrl = `data:${imageFile.type};base64,${buffer.toString("base64")}`;
    } else {
      try {
        const fileName = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads", "vehicles");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        fs.writeFileSync(path.join(uploadDir, fileName), buffer);
        imageUrl = `/uploads/vehicles/${fileName}`;
      } catch {
        imageUrl = `data:${imageFile.type};base64,${buffer.toString("base64")}`;
      }
    }
  }

  try {
    await prisma.vehicle.create({
      data: {
        carrier,
        model,
        registration,
        fleetNumber,
        mileage,
        imageUrl: imageUrl || null,
      },
    });
    revalidatePath("/tabor");
    revalidatePath("/panel/zarzad");
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "registration_exists");
      return NextResponse.redirect(url, 303);
    }
    throw err;
  }

  redirect("/panel/zarzad");
}
