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
  const notificationId = formData.get("notificationId") as string;
  const replyText = (formData.get("replyText") as string)?.trim();

  if (!notificationId || !replyText) {
    return NextResponse.json({ message: "Brak ID wiadomości lub treści odpowiedzi" }, { status: 400 });
  }

  const notification = await prisma.driverNotification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== session.user.id) {
    return NextResponse.json({ message: "Nie znaleziono wiadomości lub brak uprawnień" }, { status: 404 });
  }

  const senderBadge = session.user.badgeNumber ? ` [${session.user.badgeNumber}]` : "";
  const replyAuthor = `${session.user.username}${senderBadge}`;

  await prisma.driverNotification.update({
    where: { id: notificationId },
    data: {
      reply: replyText,
      repliedAt: new Date(),
      replyBy: replyAuthor,
    },
  });

  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  redirect("/panel/kierowca#wiadomosci");
}
