import type { DailyData as Daily021 } from "../0.2.1/daily";
export type DailyData = Omit<Daily021, "daily_version"> & { daily_version: "0.2.2" };
