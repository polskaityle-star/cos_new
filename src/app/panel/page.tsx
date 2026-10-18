import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canAccessManagementPanel } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Punkt wejścia /panel: kieruje do właściwego panelu według roli (używane m.in. po logowaniu przez Discord).
export default async function PanelIndex() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  redirect(canAccessManagementPanel(session.user.role) ? "/panel/zarzad" : "/panel/kierowca");
}
