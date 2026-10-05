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
  const userId = searchParams.get("userId");
  const action = searchParams.get("action");
  
  const formData = await req.formData();
  const carrier = formData.get("carrier") as string;

  if (!userId || !action) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  if (action === "accept") {
    if (!carrier) return NextResponse.json({ message: "Brak wybranego przewoźnika" }, { status: 400 });
    await prisma.user.update({
      where: { id: userId },
      data: { status: "ACCEPTED", carrier }
    });
  } else if (action === "reject") {
    await prisma.user.update({
      where: { id: userId },
      data: { status: "REJECTED" }
    });
  }

  redirect("/panel/zarzad");
}
