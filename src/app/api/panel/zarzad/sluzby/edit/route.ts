import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageDuties } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageDuties(session.user.role, (session.user as any)?.username)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const formData = await req.formData();
  const dutyId = formData.get("dutyId") as string;
  const userId = formData.get("userId") as string;
  const lineId = formData.get("lineId") as string;
  const vehicleId = formData.get("vehicleId") as string;
  const dateStr = formData.get("date") as string;
  const brigade = formData.get("brigade") as string;
  const shift = formData.get("shift") as string;
  const notes = formData.get("notes") as string;
  const status = formData.get("status") as string;

  if (!dutyId) {
    return NextResponse.json({ message: "Brak ID służby" }, { status: 400 });
  }

  const updateData: any = {};
  if (userId) updateData.userId = userId;
  if (lineId) updateData.lineId = lineId;
  if (vehicleId !== undefined) updateData.vehicleId = vehicleId || null;
  if (dateStr) updateData.date = new Date(dateStr);
  if (brigade !== undefined) updateData.brigade = brigade || null;
  if (shift !== undefined) updateData.shift = shift || null;
  if (notes !== undefined) updateData.notes = notes || null;
  if (status) updateData.status = status;

  await prisma.duty.update({
    where: { id: dutyId },
    data: updateData,
  });

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  redirect("/panel/zarzad");
}
