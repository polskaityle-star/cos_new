import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canAccessManagementPanel, isUserAdminOrOwner } from "@/lib/roles";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canAccessManagementPanel(session.user.role, session.user.username)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("id");
  const action = searchParams.get("action");

  if (action === "clear_contact_history") {
    if (!isUserAdminOrOwner(session.user.role, session.user.username)) {
      return NextResponse.json({ message: "Brak uprawnień do czyszczenia historii" }, { status: 403 });
    }
    await prisma.contactMessage.deleteMany({});
    revalidatePath("/panel/zarzad");
    redirect("/panel/zarzad");
    return;
  }

  if (action === "clear_driver_notifications") {
    if (!isUserAdminOrOwner(session.user.role, session.user.username)) {
      return NextResponse.json({ message: "Brak uprawnień do czyszczenia powiadomień" }, { status: 403 });
    }
    await prisma.driverNotification.deleteMany({
      where: { direction: "TO_DRIVER" },
    });
    revalidatePath("/panel/zarzad");
    revalidatePath("/panel/kierowca");
    redirect("/panel/zarzad");
    return;
  }

  if (!messageId || !action) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  if (action === "delete") {
    if (!isUserAdminOrOwner(session.user.role, session.user.username)) {
      return NextResponse.json({ message: "Brak uprawnień do usuwania wiadomości" }, { status: 403 });
    }
    const existing = await prisma.contactMessage.findUnique({
      where: { id: messageId },
    });
    if (!existing) {
      return NextResponse.json({ message: "Wiadomość nie istnieje" }, { status: 404 });
    }
    await prisma.contactMessage.delete({
      where: { id: messageId },
    });
  } else if (action === "read") {
    const existing = await prisma.contactMessage.findUnique({
      where: { id: messageId },
    });
    if (!existing) {
      return NextResponse.json({ message: "Wiadomość nie istnieje" }, { status: 404 });
    }
    await prisma.contactMessage.update({
      where: { id: messageId },
      data: { status: "PRZECZYTANA" },
    });
  } else if (action === "reply") {
    const existing = await prisma.contactMessage.findUnique({
      where: { id: messageId },
    });
    if (!existing) {
      return NextResponse.json({ message: "Wiadomość nie istnieje" }, { status: 404 });
    }
    const formData = await req.formData().catch(() => null);
    const rawReply = formData?.get("reply");
    const reply = typeof rawReply === "string" ? rawReply.trim() : "";
    if (!reply) {
      return NextResponse.json({ message: "Treść odpowiedzi nie może być pusta" }, { status: 400 });
    }
    if (reply.length > 2000) {
      return NextResponse.json({ message: "Odpowiedź może mieć maksymalnie 2000 znaków" }, { status: 400 });
    }
    // TODO: Odpowiedź jest zapisywana w bazie danych, ale nie jest wysyłana e-mailem do autora (brak integracji SMTP).
    await prisma.contactMessage.update({
      where: { id: messageId },
      data: {
        reply,
        repliedAt: new Date(),
        status: "ODPOWIEDZIANO",
      },
    });
  }

  revalidatePath("/panel/zarzad");

  redirect("/panel/zarzad");
}
