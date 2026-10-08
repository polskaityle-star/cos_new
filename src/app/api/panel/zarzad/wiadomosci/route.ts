import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canAccessManagementPanel } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canAccessManagementPanel(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("id");
  const action = searchParams.get("action");

  if (!messageId || !action) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  if (action === "read") {
    await prisma.contactMessage.update({
      where: { id: messageId },
      data: { status: "PRZECZYTANA" }
    });
  } else if (action === "reply") {
    const formData = await req.formData().catch(() => null);
    const reply = formData?.get("reply") as string;
    if (reply) {
      await prisma.contactMessage.update({
        where: { id: messageId },
        data: {
          reply,
          repliedAt: new Date(),
          status: "ODPOWIEDZIANO"
        }
      });
    }
  } else if (action === "delete") {
    await prisma.contactMessage.delete({
      where: { id: messageId }
    });
  }

  revalidatePath("/panel/zarzad");

  redirect("/panel/zarzad");
}
