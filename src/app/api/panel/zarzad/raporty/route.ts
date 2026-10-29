import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageRequests } from "@/lib/roles";
import { reviewReport } from "@/lib/reports";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageRequests(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień do sprawdzania raportów" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const reportId = searchParams.get("reportId");
  const action = searchParams.get("action");

  if (!reportId || !action) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ message: "Nieprawidłowa akcja" }, { status: 400 });
  }

  const result = await reviewReport({
    reportId,
    action,
    reviewerId: session.user.id,
    reviewerRole: session.user.role,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");
  revalidatePath("/tabor");
  redirect("/panel/zarzad");
}
