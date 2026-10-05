import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  const formData = await req.formData();
  const type = formData.get("type") as string;
  const reason = formData.get("reason") as string;
  const dateStartStr = formData.get("dateStart") as string;
  const dateEndStr = formData.get("dateEnd") as string;
  const dutyId = formData.get("dutyId") as string;
  const details = formData.get("details") as string;

  if (!type || !reason) {
    return NextResponse.json({ message: "Brakujące pola wniosku" }, { status: 400 });
  }

  await prisma.driverRequest.create({
    data: {
      userId: session.user.id,
      type,
      reason,
      dateStart: dateStartStr ? new Date(dateStartStr) : null,
      dateEnd: dateEndStr ? new Date(dateEndStr) : null,
      dutyId: dutyId || null,
      details: details || null,
      status: "PENDING",
    }
  });

  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  redirect("/panel/kierowca");
}
