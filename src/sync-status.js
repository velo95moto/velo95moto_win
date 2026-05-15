export const LONG_UNSYNCED_MS = 30 * 60 * 1000;
export const OFFLINE_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];
export const ONLINE_RETRY_DELAY_MS = 120_000;

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
  if (uiStatus === "error") return uiMessage || "Ошибка синхронизации";
  if (longWarningVisible) return "Давно не синхронизировано";
  if (uiStatus === "offline" || !online) return "Нет интернета";
  if (Number(pendingTotal || 0) > 0) return "Есть локальные изменения";
  if (lastSuccessfulSyncAt) return "Синхронизировано";
  return uiMessage || "Ожидание";
}

export function syncResultHasProblems(message = "") {
  const text = String(message || "");
  const conflictMatch = text.match(/Конфликты:\s*(\d+)/);
  const errorMatch = text.match(/Ошибки:\s*(\d+)/);
  return Number(conflictMatch?.[1] || 0) > 0 || Number(errorMatch?.[1] || 0) > 0;
}

export function shouldAutoSyncAfterReconnect({ wasOnline = false, isOnline = false, pendingTotal = 0 } = {}) {
  return Boolean(isOnline && !wasOnline && Number(pendingTotal || 0) > 0);
}

export function shouldAutoSyncWhenOnline({
  isOnline = false,
  pendingTotal = 0,
  syncInProgress = false,
} = {}) {
  return Boolean(isOnline && !syncInProgress && Number(pendingTotal || 0) > 0);
}

export function nextReconnectDelayMs({ online = false, attempts = 0 } = {}) {
  if (online) return ONLINE_RETRY_DELAY_MS;
  const index = Math.max(0, Math.min(Number(attempts || 0), OFFLINE_RETRY_DELAYS_MS.length - 1));
  return OFFLINE_RETRY_DELAYS_MS[index];
}

export function shouldAttemptBackgroundSync({
  online = false,
  syncInProgress = false,
  pendingTotal = 0,
  force = false,
} = {}) {
  if (syncInProgress) return false;
  if (!online && !force) return false;
  return force || Number(pendingTotal || 0) > 0;
}

export function shouldFastFailManualSync({
  browserOnline = true,
  syncInProgress = false,
  trustBrowserOnline = true,
} = {}) {
  if (syncInProgress) return false;
  return trustBrowserOnline && browserOnline === false;
}

export function offlineSyncMessage() {
  return "Нет подключения к интернету. Синхронизация невозможна.";
}
