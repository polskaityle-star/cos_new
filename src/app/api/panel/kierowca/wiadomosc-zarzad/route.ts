import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COLORS, runAfter, sendToChannel } from "@/lib/discord";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  const formData = await req.formData();
  const title = (formData.get("title") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  if (!title || !message) {
    return NextResponse.json({ message: "Wszystkie pola są wymagane" }, { status: 400 });
  }

  const senderBadge = session.user.badgeNumber ? ` [${session.user.badgeNumber}]` : "";
  const senderText = `${session.user.username}${senderBadge}`;

  await prisma.driverNotification.create({
    data: {
      userId: session.user.id,
      sender: senderText,
      title,
      message,
      direction: "TO_MANAGEMENT",
    },
  });

  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  await runAfter(() =>
    sendToChannel("WIADOMOSCI", [
      { title: `Wiadomość do Zarządu: ${title}`, description: message, color: COLORS.info, fields: [{ name: "Od", value: senderText }] },
    ])
  );

  redirect("/panel/kierowca#wiadomosci");
}
