import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COLORS, runAfter, sendToChannel } from "@/lib/discord";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  // Rate limit: 10 wiadomości na godzinę na użytkownika
  const rlKey = `msg-zarzad:user:${session.user.id}`;
  if (!rateLimit(rlKey, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { message: "Zbyt wiele wysłanych wiadomości. Limit to 10 wiadomości na godzinę." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const rawTitle = formData.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const rawMessage = formData.get("message");
  const message = typeof rawMessage === "string" ? rawMessage.trim() : "";

  if (!title || !message) {
    return NextResponse.json({ message: "Wszystkie pola są wymagane" }, { status: 400 });
  }

  if (title.length > 120) {
    return NextResponse.json({ message: "Tytuł wiadomości może mieć maksymalnie 120 znaków" }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ message: "Treść wiadomości może mieć maksymalnie 2000 znaków" }, { status: 400 });
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
      {
        title: `Wiadomość do Zarządu: ${title}`,
        description: message,
        color: COLORS.info,
        fields: [{ name: "Od", value: senderText }],
      },
    ])
  );

  redirect("/panel/kierowca#wiadomosci");
}
