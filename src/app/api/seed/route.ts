import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminPassword = await bcrypt.hash("admin123", 10);
    const driverPassword = await bcrypt.hash("kierowca123", 10);

    // 1. Zarząd: Godksawiss
    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { username: "Godksawiss" },
          { username: "godksawiss" },
          { role: "WLASCICIEL" }
        ]
      }
    });

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          username: "Godksawiss",
          password: adminPassword,
          role: "WLASCICIEL",
          badgeNumber: "W1",
          status: "ACCEPTED",
          carrier: "VMPK",
        },
      });
    } else {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          role: "WLASCICIEL",
          badgeNumber: existingAdmin.badgeNumber || "W1",
          status: "ACCEPTED",
          carrier: "VMPK",
          // Nie nadpisujemy hasła!
        },
      });
    }

    // 2. Kierowca1
    const existingDriver = await prisma.user.findUnique({ where: { username: "kierowca1" } });
    if (!existingDriver) {
      await prisma.user.create({
        data: {
          username: "kierowca1",
          password: driverPassword,
          role: "KIEROWCA",
          badgeNumber: "K1001",
          status: "ACCEPTED",
          carrier: "VMPK",
        },
      });
    }

    // 3. Linie
    const lineCount = await prisma.line.count();
    if (lineCount === 0) {
      await prisma.line.create({
        data: {
          number: "34",
          startStop: "Bukówka",
          endStop: "Wichrowa",
          directions: "Wariant A: Bukówka - Czarnowska - Wichrowa | Wariant B: Bukówka - Seminaryjska - Wichrowa",
          brigades: "34/1, 34/2, 34/3",
        },
      });
      await prisma.line.create({
        data: { number: "46", startStop: "Ślichowice", endStop: "Świętokrzyska" },
      });
      await prisma.line.create({
        data: { number: "102", startStop: "Dworzec PKP", endStop: "Targi Kielce" },
      });
    }

    // 4. Tabor
    const vehicleCount = await prisma.vehicle.count();
    if (vehicleCount === 0) {
      await prisma.vehicle.createMany({
        data: [
          { carrier: "VMPK", model: "Solaris Urbino 12 IV", registration: "TK 12345", fleetNumber: "#101", mileage: 125400 },
          { carrier: "VMPK", model: "Solaris Urbino 18 IV", registration: "TK 67890", fleetNumber: "#102", mileage: 98200 },
          { carrier: "VBP", model: "MAN Lion's City 12C", registration: "TK 54321", fleetNumber: "#201", mileage: 64100 },
          { carrier: "VBP", model: "Mercedes-Benz Conecto G", registration: "TK 98765", fleetNumber: "#202", mileage: 110500 },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      message: "Baza danych została pomyślnie zainicjalizowana! Zarząd: login 'Godksawiss', hasło 'admin123'.",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || "Błąd podczas inicjalizacji bazy",
    }, { status: 500 });
  }
}
