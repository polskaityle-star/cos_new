import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      role: string
      carrier: string | null
      badgeNumber?: string | null
      avatar?: string | null
      workingDays?: string | null
      assignedVehicleId?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    username: string
    role: string
    carrier: string | null
    badgeNumber?: string | null
    avatar?: string | null
    workingDays?: string | null
    assignedVehicleId?: string | null
  }
}
