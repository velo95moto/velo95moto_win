export const LONG_UNSYNCED_MS = 30 * 60 * 1000;

export function parseSyncDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function syncAgeMs(lastSuccessfulSyncAt, now = Date.now()) {
  const date = parseSyncDate(lastSuccessfulSyncAt);
  if (!date) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - date.getTime());
}

export function shouldShowLongSyncWarning({ pendingTotal = 0, lastSuccessfulSyncAt = null, now = Date.now() } = {}) {
  return Number(pendingTotal || 0) > 0 && syncAgeMs(lastSuccessfulSyncAt, now) >= LONG_UNSYNCED_MS;
}

export function getSyncStatusMessage({
  syncInProgress = false,
  uiStatus = "idle",
  online = false,
  longWarningVisible = false,
  pendingTotal = 0,
  lastSuccessfulSyncAt = null,
  uiMessage = "",
} = {}) {
  if (syncInProgress) return "Синхронизация...";
  if (uiStatus === "error") return "Ошибка синхронизации";
  if (longWarningVisible) return "Давно не синхронизировано";
  if (uiStatus === "offline" || !online) return "Нет интернета";
  if (Number(pendingTotal || 0) > 0) return "Есть локальные изменения";
  if (lastSuccessfulSyncAt) return "Синхронизировано";
  return uiMessage || "Ожидание";
}

export function shouldAutoSyncAfterReconnect({ wasOnline = false, isOnline = false, pendingTotal = 0 } = {}) {
  return Boolean(isOnline && !wasOnline && Number(pendingTotal || 0) > 0);
}
