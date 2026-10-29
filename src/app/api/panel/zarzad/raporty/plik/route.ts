import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { canManageRequests } from "@/lib/roles";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "text/plain"];

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new Response("Brak autoryzacji", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get("reportId") || searchParams.get("id");
    const type = searchParams.get("type"); // "start", "end", "summary", "depot..."

    if (!reportId || !type) {
      return new Response("Brak parametrów reportId lub type", { status: 400 });
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: { duty: true },
    });

    if (!report) {
      return new Response("Raport nie został odnaleziony", { status: 404 });
    }

    // Zarząd / Właściciel lub przypisany kierowca
    if (!canManageRequests(session.user.role) && report.duty.userId !== session.user.id) {
      return new Response("Brak uprawnień do tego pliku", { status: 403 });
    }

    let fileData = "";
    if (type === "start") fileData = report.startScreenshot;
    else if (type === "end") fileData = report.endScreenshot;
    else if (type === "summary") fileData = report.summaryFile;
    else if (type.startsWith("depot") && report.depotScreenshots) {
      try {
        const depotObj = JSON.parse(report.depotScreenshots);
        fileData = depotObj[type] || "";
      } catch {}
    }

    if (!fileData) {
      return new Response("Brak zapisanego pliku dla tego typu", { status: 404 });
    }

    // 1. Obsługa Data URL (Base64)
    if (fileData.startsWith("data:")) {
      const commaIndex = fileData.indexOf(",");
      if (commaIndex !== -1) {
        const meta = fileData.substring(5, commaIndex);
        const rawData = fileData.substring(commaIndex + 1);
        const isBase64 = meta.includes("base64");
        let mimeType = meta.split(";")[0] || (type === "summary" ? "text/plain" : "image/png");

        let disposition = "inline";
        if (!ALLOWED_MIME.includes(mimeType)) {
          mimeType = "application/octet-stream";
          disposition = "attachment";
        }

        const buffer = isBase64
          ? Buffer.from(rawData, "base64")
          : Buffer.from(decodeURIComponent(rawData), "utf-8");

        const filename =
          type === "summary"
            ? `podsumowanie_${report.id}.txt`
            : `screen_${type}_${report.id}.${mimeType.includes("jpeg") ? "jpg" : mimeType.includes("webp") ? "webp" : "png"}`;

        return new Response(buffer, {
          headers: {
            "Content-Type": mimeType === "text/plain" ? "text/plain; charset=utf-8" : mimeType,
            "Content-Disposition": `${disposition}; filename="${filename}"`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
          },
        });
      }
    }

    // 2. Obsługa ścieżki na dysku lokalnym - tylko /uploads/reports/ bez możliwości path traversal
    if (fileData.startsWith("/uploads/reports/")) {
      const cleanPath = fileData.startsWith("/") ? fileData.slice(1) : fileData;
      const uploadsBase = path.resolve(process.cwd(), "public", "uploads");
      const fullPath = path.resolve(process.cwd(), "public", cleanPath);

      if (!fullPath.startsWith(uploadsBase)) {
        return new Response("Dostęp zabroniony (niedozwolona ścieżka)", { status: 403 });
      }

      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        let mimeType =
          ext === ".txt"
            ? "text/plain"
            : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".webp"
            ? "image/webp"
            : ext === ".png"
            ? "image/png"
            : "application/octet-stream";

        let disposition = "inline";
        if (!ALLOWED_MIME.includes(mimeType)) {
          mimeType = "application/octet-stream";
          disposition = "attachment";
        }

        return new Response(buffer, {
          headers: {
            "Content-Type": mimeType === "text/plain" ? "text/plain; charset=utf-8" : mimeType,
            "Content-Disposition": `${disposition}; filename="${path.basename(fullPath)}"`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
          },
        });
      }
    } else if (fileData.startsWith("/") || fileData.startsWith("uploads/")) {
      return new Response("Dostęp zabroniony (niedozwolona ścieżka)", { status: 403 });
    }

    // 3. Fallback
    return new Response(
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Plik niedostępny</title></head>
<body style="background:#0f172a;color:#f87171;font-family:sans-serif;padding:60px 20px;text-align:center;">
  <div style="max-width:500px;margin:0 auto;background:#1e293b;padding:30px;border-radius:12px;border:1px solid #334155;">
    <h2 style="color:#ef4444;margin-top:0;">⚠️ Plik z poprzedniej sesji</h2>
    <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
      Ten plik został przesłany w starej wersji przed wdrożeniem stałego zapisu w chmurze (Base64).<br><br>
      Wszystkie <b>nowo przesyłane raporty</b> są już w 100% trwale zapisywane w bazie danych Neon i wyświetlają się poprawnie.
    </p>
  </div>
</body>
</html>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
        status: 404,
      }
    );
  } catch (err) {
    console.error("REPORT FILE ERROR", err instanceof Error ? err.message : String(err));
    return new Response("Błąd serwera podczas odczytu pliku", { status: 500 });
  }
}
