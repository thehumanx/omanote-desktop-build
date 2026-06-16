import { isTauri } from "./desktop";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// Web Push needs a service worker, which the Tauri desktop shell does not
// support; desktop reminders fire as native OS notifications instead.
function pushUnavailable() {
  return isTauri() || !("serviceWorker" in navigator);
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output.buffer as ArrayBuffer;
}

export function extractSubscriptionKeys(subscription: PushSubscription): { p256dh: string; auth: string } {
  const rawKey = subscription.getKey("p256dh");
  const rawAuth = subscription.getKey("auth");
  if (!rawKey || !rawAuth) throw new Error("Push subscription missing keys");
  return {
    p256dh: btoa(String.fromCharCode(...new Uint8Array(rawKey))),
    auth: btoa(String.fromCharCode(...new Uint8Array(rawAuth))),
  };
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (pushUnavailable()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) return null;
  if (pushUnavailable() || !("PushManager" in window)) return null;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
  });
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (pushUnavailable()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function unsubscribeFromPush(): Promise<string | null> {
  if (pushUnavailable()) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
