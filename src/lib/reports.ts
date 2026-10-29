import { prisma } from "./prisma";
import { COLORS, notifyUser, runAfter } from "./discord";

export interface ReviewReportOptions {
  reportId: string;
  action: "accept" | "reject";
  rejectReason?: string;
  reviewerId?: string;
  reviewerRole?: string;
}

export interface ReviewReportResult {
  ok: boolean;
  status: number;
  message: string;
  report?: unknown;
}

export async function reviewReport(options: ReviewReportOptions): Promise<ReviewReportResult> {
  const { reportId, action } = options;

  const existingReport = await prisma.report.findUnique({
    where: { id: reportId },
    include: { duty: { include: { line: true } } },
  });

  if (!existingReport) {
    return { ok: false, status: 404, message: "Raport nie istnieje" };
  }

  if (existingReport.status !== "PENDING") {
    return { ok: false, status: 409, message: "Raport został już rozpatrzony" };
  }

  if (action === "accept") {
    const distance = Math.max(0, existingReport.endMileage - existingReport.startMileage);

    await prisma.report.update({
      where: { id: reportId },
      data: { status: "ACCEPTED" },
    });

    if (existingReport.duty?.vehicleId && distance > 0) {
      await prisma.vehicle.update({
        where: { id: existingReport.duty.vehicleId },
        data: {
          mileage: { increment: distance },
        },
      });
    }
  } else if (action === "reject") {
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "REJECTED" },
    });
  }

  const ok = action === "accept";
  if (existingReport.duty) {
    await runAfter(() =>
      notifyUser(existingReport.duty.userId, [
        {
          title: ok ? "Raport zaakceptowany" : "Raport odrzucony",
          color: ok ? COLORS.ok : COLORS.bad,
          description: `Służba z ${existingReport.duty.date.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}, linia ${existingReport.duty.line?.number ?? "-"}.`,
        },
      ])
    );
  }

  return {
    ok: true,
    status: 200,
    message: ok ? "Raport zaakceptowany" : "Raport odrzucony",
    report: existingReport,
  };
}
