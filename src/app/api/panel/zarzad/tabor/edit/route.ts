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
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const formData = await req.formData();
  const id = formData.get("id") as string;
  const carrier = formData.get("carrier") as string;
  const model = formData.get("model") as string;
  const registration = formData.get("registration") as string;
  const fleetNumber = formData.get("fleetNumber") as string;
  const status = formData.get("status") as string;
  const mileageStr = formData.get("mileage") as string;
  const imageFile = formData.get("image") as File | null;

  let newImageUrl: string | undefined = undefined;

  if (imageFile && imageFile.size > 0 && typeof imageFile.arrayBuffer === "function") {
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const mime = imageFile.type || "image/jpeg";
    if (process.env.VERCEL) {
      newImageUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    } else {
      try {
        const ext = path.extname(imageFile.name) || ".jpg";
        const fileName = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads", "vehicles");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        fs.writeFileSync(path.join(uploadDir, fileName), buffer);
        newImageUrl = `/uploads/vehicles/${fileName}`;
      } catch {
        newImageUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      }
    }
  }

  if (id && carrier && model && registration && fleetNumber) {
    const updateData: any = {
      carrier,
      model,
      registration,
      fleetNumber,
      status: status || "SPRAWNY"
    };

    if (mileageStr !== null && mileageStr !== undefined && mileageStr !== "") {
      const parsedMileage = parseInt(mileageStr);
      if (!isNaN(parsedMileage)) {
        updateData.mileage = parsedMileage;
      }
    }

    if (newImageUrl) {
      updateData.imageUrl = newImageUrl;
    }

    await prisma.vehicle.update({
      where: { id },
      data: updateData
    });

    if (status === "SPRAWNY") {
      await prisma.vehicleDefect.updateMany({
        where: { vehicleId: id, status: { in: ["NOWE", "WARSZTAT"] } },
        data: {
          status: "NAPRAWIONE",
          adminNotes: "Naprawione - pojazd oznaczony jako sprawny w zarządzaniu taborem",
        },
      });
    }

    revalidatePath("/tabor");
    revalidatePath("/panel/kierowca");
    revalidatePath("/panel/zarzad");
  }

  redirect("/panel/zarzad");
}
