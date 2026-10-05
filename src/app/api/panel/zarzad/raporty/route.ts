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

  const { searchParams } = new URL(req.url);
  const reportId = searchParams.get("reportId");
  const action = searchParams.get("action");
  
  if (!reportId || !action) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  if (action === "accept") {
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "ACCEPTED" }
    });
  } else if (action === "reject") {
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "REJECTED" }
    });
  }

  redirect("/panel/zarzad");
}
