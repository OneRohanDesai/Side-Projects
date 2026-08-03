import { browser } from "$app/environment";

export async function ensureNotifyPermission(): Promise<boolean> {
  if (!browser || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export function notify(title: string, body?: string) {
  if (!browser || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/favicon.svg",
      tag: "the-waitlist",
    });
  } catch {
    // ignore
  }
}
