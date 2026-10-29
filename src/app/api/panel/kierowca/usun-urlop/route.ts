import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageRequests, isUserAdminOrOwner } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json({ message: "Brak ID wniosku" }, { status: 400 });
  }

  const vacationReq = await prisma.driverRequest.findUnique({
    where: { id: requestId },
  });

  if (!vacationReq) {
    return NextResponse.json({ message: "Wniosek nie istnieje" }, { status: 404 });
  }

  const isPrivileged = canManageRequests(session.user.role) || isUserAdminOrOwner(session.user.role);

  if (!isPrivileged) {
    if (vacationReq.userId !== session.user.id || vacationReq.type !== "URLOP") {
      return NextResponse.json({ message: "Brak uprawnień do usunięcia tego wniosku" }, { status: 403 });
    }
  }

  await prisma.driverRequest.delete({
    where: { id: requestId },
  });

  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  const referer = req.headers.get("referer") || "";
  if (referer.includes("/panel/zarzad")) {
    redirect("/panel/zarzad");
  } else {
    redirect("/panel/kierowca");
  }
}
