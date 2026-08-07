import type { Application } from "./types";

export const STATUS_LABEL: Record<Application["status"], string> = {
  draft: "Draft",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  closed: "Closed",
};

export const STATUS_TONE: Record<
  Application["status"],
  "neutral" | "success" | "warning" | "error" | "info"
> = {
  draft: "neutral",
  applied: "info",
  interview: "warning",
  offer: "success",
  rejected: "error",
  closed: "neutral",
};

export const STATUS_FLOW: Application["status"][] = [
  "draft",
  "applied",
  "interview",
  "offer",
];

export const NEXT_STATUS: Record<Application["status"], Application["status"]> = {
  draft: "applied",
  applied: "interview",
  interview: "offer",
  offer: "offer",
  rejected: "rejected",
  closed: "closed",
};

export const STATUS_OPTIONS: Application["status"][] = [
  "draft",
  "applied",
  "interview",
  "offer",
  "rejected",
  "closed",
];
