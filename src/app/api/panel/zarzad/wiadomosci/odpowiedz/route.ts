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
  const notificationId = formData.get("notificationId") as string;
  const replyText = (formData.get("replyText") as string)?.trim();

  if (!notificationId || !replyText) {
    return NextResponse.json({ message: "Brak ID wiadomości lub treści odpowiedzi" }, { status: 400 });
  }

  const roleLabel = getRoleLabel(session.user.role);
  const badge = session.user.badgeNumber ? ` [${session.user.badgeNumber}]` : "";
  const replyAuthor = `${session.user.username}${badge} (${roleLabel})`;

  await prisma.driverNotification.update({
    where: { id: notificationId },
    data: {
      reply: replyText,
      repliedAt: new Date(),
      replyBy: replyAuthor,
    },
  });

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  redirect("/panel/zarzad#wiadomosci");
}
