import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COLORS, notifyUser, runAfter } from "@/lib/discord";
import { canAccessManagementPanel, getRoleLabel } from "@/lib/roles";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canAccessManagementPanel(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const formData = await req.formData();
  const rawUserId = formData.get("userId");
  const userId = typeof rawUserId === "string" ? rawUserId.trim() : "";
  const rawTitle = formData.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const rawMessage = formData.get("message");
  const message = typeof rawMessage === "string" ? rawMessage.trim() : "";

  if (!userId || !title || !message) {
    return NextResponse.json({ message: "Wszystkie pola są wymagane" }, { status: 400 });
  }

  if (title.length > 120) {
    return NextResponse.json({ message: "Tytuł wiadomości może mieć maksymalnie 120 znaków" }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ message: "Treść wiadomości może mieć maksymalnie 2000 znaków" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return NextResponse.json({ message: "Wskazany kierowca nie istnieje" }, { status: 404 });
  }

  const senderRole = getRoleLabel(session.user.role);
  const senderLabel = `${session.user.username} (${senderRole})`;

  await prisma.driverNotification.create({
    data: {
      userId,
      sender: senderLabel,
      title,
      message,
    },
  });

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  await runAfter(() =>
    notifyUser(userId, [
      {
        title: `Wiadomość od Zarządu: ${title}`,
        description: message,
        color: COLORS.info,
        fields: [{ name: "Od", value: senderLabel }],
      },
    ])
  );

  redirect("/panel/zarzad");
}
