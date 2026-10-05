import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user || session.user.role !== "ZARZAD") {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  const formData = await req.formData();
  const userId = formData.get("userId") as string;
  const lineId = formData.get("lineId") as string;
  const dateStr = formData.get("date") as string;

  if (userId && lineId && dateStr) {
    await prisma.duty.create({
      data: {
        userId,
        lineId,
        date: new Date(dateStr)
      }
    });
  }

  redirect("/panel/zarzad");
}
