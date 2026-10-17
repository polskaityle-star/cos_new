import { NextResponse } from "next/server";
import packageInfo from "@/../package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      version: packageInfo.version,
      release: `${packageInfo.version}-beta`,
      status: "online",
      deployedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
}
