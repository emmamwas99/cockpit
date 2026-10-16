"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Bell, BellOff, Download, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  MY_WEB_PUSH_STATUS,
  REMOVE_ALL_WEB_PUSH_SUBSCRIPTIONS,
  SAVE_WEB_PUSH_SUBSCRIPTION,
} from "@/graphql/operations";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function decodeVapidKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function supportsPush(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "PushManager" in window &&
    "serviceWorker" in navigator
  );
}

export function AdminPwaMenuItems() {
  const { data, loading, refetch } = useQuery(MY_WEB_PUSH_STATUS, {
    fetchPolicy: "cache-and-network",
    skip: !supportsPush(),
  });
  const [saveSubscription, { loading: saving }] = useMutation(SAVE_WEB_PUSH_SUBSCRIPTION);
  const [removeSubscriptions, { loading: removing }] = useMutation(REMOVE_ALL_WEB_PUSH_SUBSCRIPTIONS);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && Boolean(navigator.standalone)),
    );
    if (window.isSecureContext && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setStandalone(true);
      toast.success("Shopi Admin installed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      toast.info("To install, use your browser menu and choose “Install app” or “Add to Home Screen”.");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setStandalone(true);
    setInstallPrompt(null);
  }

  async function enablePush() {
    if (!supportsPush()) {
      toast.error("Push notifications need a supported browser and a secure connection.");
      return;
    }

    const currentStatus = data?.myWebPushStatus;
    if (!currentStatus?.isAvailable || !currentStatus.publicKey) {
      toast.error("Push notifications are not configured on the API yet.");
      return;
    }

    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Allow notifications in your browser settings to receive review alerts.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const existingKey = subscription.options.applicationServerKey;
        const expectedKey = decodeVapidKey(currentStatus.publicKey);
        const matches =
          existingKey &&
          encodeBase64Url(existingKey) === encodeBase64Url(expectedKey.buffer as ArrayBuffer);
        if (!matches) {
          await subscription.unsubscribe();
          subscription = null;
        }
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(currentStatus.publicKey),
      });

      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!p256dh || !auth) throw new Error("The browser returned an incomplete push subscription.");

      await saveSubscription({
        variables: {
          input: {
            endpoint: subscription.endpoint,
            p256dh: encodeBase64Url(p256dh),
            auth: encodeBase64Url(auth),
            locale: navigator.language,
            userAgent: navigator.userAgent,
          },
        },
      });
      await refetch();
      toast.success("Post review notifications are on for this device.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enable push notifications.");
    }
  }

  async function disablePush() {
    try {
      await removeSubscriptions();
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
      await refetch();
      toast.success("Push notifications are off for this account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not turn off push notifications.");
    }
  }

  const status = data?.myWebPushStatus;
  const pushSupported = supportsPush();

  return (
    <>
      {!standalone && (
        <DropdownMenuItem onSelect={() => void installApp()}>
          <Download /> Install Shopi Admin
        </DropdownMenuItem>
      )}
      {loading && !status ? (
        <DropdownMenuItem disabled>
          <Bell /> Checking notifications…
        </DropdownMenuItem>
      ) : status?.isEnabled ? (
        <DropdownMenuItem disabled={removing} onSelect={() => void disablePush()}>
          <BellOff /> Turn off post review notifications
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem
          disabled={!pushSupported || !status?.isAvailable || saving}
          onSelect={() => void enablePush()}
        >
          {pushSupported ? <Bell /> : <Smartphone />}
          {pushSupported ? "Enable post review notifications" : "Push unavailable in this browser"}
        </DropdownMenuItem>
      )}
    </>
  );
}
