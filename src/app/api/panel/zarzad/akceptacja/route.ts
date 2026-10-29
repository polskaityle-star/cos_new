import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageUsers } from "@/lib/roles";
import { reviewCandidate } from "@/lib/recruitment";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !canManageUsers(session.user.role)) {
      return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");

    const formData = await req.formData();
    const carrier = formData.get("carrier") as string;

    if (!userId || !action) {
      return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
    }

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json({ message: "Nieprawidłowa akcja (dozwolone: accept, reject)" }, { status: 400 });
    }

    const result = await reviewCandidate({
      userId,
      action: action as "accept" | "reject",
      carrier,
    });

    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    revalidatePath("/panel/zarzad");
  } catch (error: unknown) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("AKCEPTACJA ERROR", error);
    return NextResponse.json({ message: "Wystąpił błąd podczas akceptacji użytkownika" }, { status: 500 });
  }

  redirect("/panel/zarzad");
}
