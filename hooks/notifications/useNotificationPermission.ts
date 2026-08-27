"use client";

import { useCallback, useEffect, useState } from "react";

import { emitNotification } from "@/lib/notifications/emit";
import {
  areAlertsEnabled,
  getPermission,
  requestPermission,
  setAlertsEnabled,
  type NotificationPermissionState,
} from "@/lib/notifications/permission";
import { syncPushSubscription } from "@/lib/notifications/push_client";
import { ensureNotifyServiceWorker } from "@/lib/notifications/service_worker";
import { resumeAudio } from "@/lib/notifications/sounds";

function confirmOnOs(on: boolean): void {
  emitNotification({
    kind: "alerts_toggle",
    title: on ? "Alertas ligados" : "Alertas desligados",
    body: on
      ? "Novas mensagens aparecem na bandeja do sistema."
      : "Este navegador não vai mais avisar na bandeja.",
    force: true,
    sound: on ? "success" : "failure",
  });
}

export function useNotificationPermission(): {
  permission: NotificationPermissionState;
  enabled: boolean;
  request: () => Promise<NotificationPermissionState>;
  setEnabled: (on: boolean) => void;
} {
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    setPermission(getPermission());
    setEnabledState(areAlertsEnabled());
  }, []);

  const request = useCallback(async () => {
    await resumeAudio();
    const next = await requestPermission();
    setPermission(next);
    if (next === "granted") {
      setAlertsEnabled(true);
      setEnabledState(true);
      void ensureNotifyServiceWorker().then(() => syncPushSubscription());
      confirmOnOs(true);
    }
    return next;
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setAlertsEnabled(on);
    setEnabledState(on);
    if (on) {
      void resumeAudio();
      void ensureNotifyServiceWorker().then(() => syncPushSubscription());
    }
    confirmOnOs(on);
  }, []);

  return { permission, enabled, request, setEnabled };
}
