export type NotificationPermissionState = NotificationPermission | "unsupported";

const ALERTS_ENABLED_KEY = "alerts.enabled";

export function getPermission(): NotificationPermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermissionState> {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.requestPermission();
}

export function areAlertsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(ALERTS_ENABLED_KEY);
    if (raw === "0") return false;
    if (raw === "1") return getPermission() === "granted";
  } catch {
    // localStorage bloqueado — trata como desligado
  }
  return getPermission() === "granted";
}

export function setAlertsEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ALERTS_ENABLED_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
}
