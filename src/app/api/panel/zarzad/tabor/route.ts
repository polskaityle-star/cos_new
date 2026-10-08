import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { canManageFleet } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user || !canManageFleet(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania taborem" }, { status: 403 });
  }

  const formData = await req.formData();
  const carrier = formData.get("carrier") as string;
  const model = formData.get("model") as string;
  const registration = formData.get("registration") as string;
  const fleetNumber = formData.get("fleetNumber") as string;
  const mileageStr = formData.get("mileage") as string;
  const mileage = parseInt(mileageStr || "0");
  const imageFile = formData.get("image") as File | null;

  let imageUrl: string | null = null;

  if (imageFile && imageFile.size > 0 && typeof imageFile.arrayBuffer === "function") {
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const mime = imageFile.type || "image/jpeg";
    if (process.env.VERCEL) {
      imageUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    } else {
      try {
        const ext = path.extname(imageFile.name) || ".jpg";
        const fileName = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads", "vehicles");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        fs.writeFileSync(path.join(uploadDir, fileName), buffer);
        imageUrl = `/uploads/vehicles/${fileName}`;
      } catch {
        imageUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      }
    }
  }

  if (carrier && model && registration && fleetNumber) {
    await prisma.vehicle.create({
      data: {
        carrier,
        model,
        registration,
        fleetNumber,
        mileage: isNaN(mileage) ? 0 : mileage,
        imageUrl: imageUrl || null
      }
    });
    revalidatePath("/tabor");
    revalidatePath("/panel/zarzad");
  }

  redirect("/panel/zarzad");
}
