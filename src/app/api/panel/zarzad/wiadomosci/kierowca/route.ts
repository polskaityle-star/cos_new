import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canAccessManagementPanel, getRoleLabel } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canAccessManagementPanel(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const formData = await req.formData();
  const userId = formData.get("userId") as string;
  const title = formData.get("title") as string;
  const message = formData.get("message") as string;

  if (!userId || !title || !message) {
    return NextResponse.json({ message: "Wszystkie pola są wymagane" }, { status: 400 });
  }

  const senderRole = getRoleLabel(session.user.role);

  await prisma.driverNotification.create({
    data: {
      userId,
      sender: `${session.user.username} (${senderRole})`,
      title,
      message,
    },
  });

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  redirect("/panel/zarzad");
}
