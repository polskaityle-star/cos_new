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
  const number = formData.get("number") as string;
  const startStop = formData.get("startStop") as string;
  const endStop = formData.get("endStop") as string;

  if (number && startStop && endStop) {
    await prisma.line.create({
      data: { number, startStop, endStop }
    });
  }

  redirect("/panel/zarzad");
}
