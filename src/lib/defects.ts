import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export interface ReviewDefectOptions {
  defectId: string;
  status: "NOWE" | "WARSZTAT" | "NAPRAWIONE" | "ODRZUCONE";
  defectType?: string;
  workshopStart?: Date;
  workshopEnd?: Date;
  adminNotes?: string;
}

export interface ReviewDefectResult {
  ok: boolean;
  status: number;
  message: string;
  defect?: unknown;
}

export async function reviewDefect(options: ReviewDefectOptions): Promise<ReviewDefectResult> {
  const { defectId, status, defectType, workshopStart, workshopEnd, adminNotes } = options;

  const existingDefect = await prisma.vehicleDefect.findUnique({
    where: { id: defectId },
  });

  if (!existingDefect) {
    return { ok: false, status: 404, message: "Usterka nie istnieje" };
  }

  const updateData: Prisma.VehicleDefectUpdateInput = {
    status,
  };

  if (defectType !== undefined) updateData.defectType = defectType;
  if (workshopStart !== undefined) updateData.workshopStart = workshopStart;
  if (workshopEnd !== undefined) updateData.workshopEnd = workshopEnd;
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

  const defect = await prisma.$transaction(async (tx) => {
    const updated = await tx.vehicleDefect.update({
      where: { id: defectId },
      data: updateData,
    });

    // Aktualizacja statusu pojazdu
    if (status === "NAPRAWIONE" || status === "ODRZUCONE") {
      const activeDefects = await tx.vehicleDefect.count({
        where: {
          vehicleId: updated.vehicleId,
          status: { in: ["NOWE", "WARSZTAT"] },
        },
      });

      if (activeDefects === 0) {
        await tx.vehicle.update({
          where: { id: updated.vehicleId },
          data: { status: "SPRAWNY" },
        });
      }
    } else if (status === "WARSZTAT") {
      await tx.vehicle.update({
        where: { id: updated.vehicleId },
        data: { status: "WARSZTAT" },
      });
    }

    return updated;
  });

  return {
    ok: true,
    status: 200,
    message:
      status === "WARSZTAT"
        ? "Usterka skierowana do warsztatu"
        : status === "NAPRAWIONE"
          ? "Usterka oznaczona jako naprawiona"
          : "Status usterki zaktualizowany",
    defect,
  };
}
