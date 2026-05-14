import test from "node:test";
import assert from "node:assert/strict";
import {
  LONG_UNSYNCED_MS,
  nextReconnectDelayMs,
  OFFLINE_RETRY_DELAYS_MS,
  ONLINE_RETRY_DELAY_MS,
  getSyncStatusMessage,
  offlineSyncMessage,
  shouldAttemptBackgroundSync,
  shouldAutoSyncAfterReconnect,
  shouldAutoSyncWhenOnline,
  shouldFastFailManualSync,
  shouldShowLongSyncWarning,
} from "./sync-status.js";

const now = Date.parse("2026-05-13T13:00:00Z");

test("local changes without internet show offline and keep button context", () => {
  assert.equal(getSyncStatusMessage({
    online: false,
    uiStatus: "offline",
    pendingTotal: 1,
  }), "Нет интернета");
});

test("restored internet with pending changes shows local changes", () => {
  assert.equal(getSyncStatusMessage({
    online: true,
    uiStatus: "idle",
    pendingTotal: 2,
  }), "Есть локальные изменения");
});

test("auto sync starts after internet is restored when local changes exist", () => {
  assert.equal(shouldAutoSyncAfterReconnect({
    wasOnline: false,
    isOnline: true,
    pendingTotal: 1,
  }), true);
});

test("auto sync starts when online is confirmed even if previous state was stale", () => {
  assert.equal(shouldAutoSyncWhenOnline({
    isOnline: true,
    pendingTotal: 1,
    syncInProgress: false,
  }), true);
});

test("auto sync after confirmed online does not start without local changes", () => {
  assert.equal(shouldAutoSyncWhenOnline({
    isOnline: true,
    pendingTotal: 0,
    syncInProgress: false,
  }), false);
});

test("auto sync after confirmed online does not start during active sync", () => {
  assert.equal(shouldAutoSyncWhenOnline({
    isOnline: true,
    pendingTotal: 1,
    syncInProgress: true,
  }), false);
});

test("auto sync does not start after reconnect when there are no local changes", () => {
  assert.equal(shouldAutoSyncAfterReconnect({
    wasOnline: false,
    isOnline: true,
    pendingTotal: 0,
  }), false);
});

test("auto sync and manual sync show syncing state while running", () => {
  assert.equal(getSyncStatusMessage({
    syncInProgress: true,
    online: true,
    pendingTotal: 1,
  }), "Синхронизация...");
});

test("manual sync without internet can show explicit no-internet status", () => {
  assert.equal(getSyncStatusMessage({
    online: false,
    uiStatus: "offline",
    pendingTotal: 3,
  }), "Нет интернета");
});

test("warning appears after 30 minutes with pending local changes", () => {
  assert.equal(shouldShowLongSyncWarning({
    pendingTotal: 1,
    lastSuccessfulSyncAt: new Date(now - LONG_UNSYNCED_MS - 1).toISOString(),
    now,
  }), true);
});

test("warning disappears after successful sync clears local changes", () => {
  assert.equal(shouldShowLongSyncWarning({
    pendingTotal: 0,
    lastSuccessfulSyncAt: new Date(now - LONG_UNSYNCED_MS - 1).toISOString(),
    now,
  }), false);
  assert.equal(getSyncStatusMessage({
    online: true,
    pendingTotal: 0,
    lastSuccessfulSyncAt: new Date(now).toISOString(),
  }), "Синхронизировано");
});

test("server or network error shows error without implying pending data is removed", () => {
  assert.equal(getSyncStatusMessage({
    online: true,
    uiStatus: "error",
    pendingTotal: 1,
  }), "Ошибка синхронизации");
});

test("server error can show the full sync reason", () => {
  assert.equal(getSyncStatusMessage({
    online: true,
    uiStatus: "error",
    pendingTotal: 1,
    uiMessage: "Ошибка синхронизации: Сборка 2026-05-13 на 200 ₽ для Дадаев Ислам не отправлена: duplicate daily total",
  }), "Ошибка синхронизации: Сборка 2026-05-13 на 200 ₽ для Дадаев Ислам не отправлена: duplicate daily total");
});

test("offline reconnect retry uses capped backoff", () => {
  assert.deepEqual(OFFLINE_RETRY_DELAYS_MS, [5_000, 15_000, 30_000, 60_000]);
  assert.equal(nextReconnectDelayMs({ online: false, attempts: 0 }), 5_000);
  assert.equal(nextReconnectDelayMs({ online: false, attempts: 1 }), 15_000);
  assert.equal(nextReconnectDelayMs({ online: false, attempts: 2 }), 30_000);
  assert.equal(nextReconnectDelayMs({ online: false, attempts: 3 }), 60_000);
  assert.equal(nextReconnectDelayMs({ online: false, attempts: 99 }), 60_000);
});

test("online reconnect retry is infrequent", () => {
  assert.equal(ONLINE_RETRY_DELAY_MS, 120_000);
  assert.equal(nextReconnectDelayMs({ online: true, attempts: 99 }), ONLINE_RETRY_DELAY_MS);
});

test("background sync does not start while offline", () => {
  assert.equal(shouldAttemptBackgroundSync({
    online: false,
    syncInProgress: false,
    pendingTotal: 3,
  }), false);
});

test("manual forced sync may perform one offline health check", () => {
  assert.equal(shouldAttemptBackgroundSync({
    online: false,
    syncInProgress: false,
    pendingTotal: 3,
    force: true,
  }), true);
});

test("only one sync job can run at a time", () => {
  assert.equal(shouldAttemptBackgroundSync({
    online: true,
    syncInProgress: true,
    pendingTotal: 3,
  }), false);
});

test("background sync waits when there are no local changes", () => {
  assert.equal(shouldAttemptBackgroundSync({
    online: true,
    syncInProgress: false,
    pendingTotal: 0,
  }), false);
});

test("sync button without internet fails fast before network requests", () => {
  assert.equal(shouldFastFailManualSync({
    browserOnline: false,
    syncInProgress: false,
  }), true);
  assert.equal(offlineSyncMessage(), "Нет подключения к интернету. Синхронизация невозможна.");
});

test("sync button does not start another job while sync is running", () => {
  assert.equal(shouldFastFailManualSync({
    browserOnline: false,
    syncInProgress: true,
  }), false);
});

test("manual sync may do a short health check when browser thinks it is online", () => {
  assert.equal(shouldFastFailManualSync({
    browserOnline: true,
    syncInProgress: false,
  }), false);
});

test("successful sync status can show online green state with last sync time", () => {
  const lastSuccessfulSyncAt = new Date(now).toISOString();
  assert.equal(getSyncStatusMessage({
    online: true,
    uiStatus: "ok",
    pendingTotal: 0,
    lastSuccessfulSyncAt,
  }), "Синхронизировано");
});

test("reconnect clears offline status when sync state is ok", () => {
  assert.equal(getSyncStatusMessage({
    online: true,
    uiStatus: "ok",
    pendingTotal: 0,
    lastSuccessfulSyncAt: new Date(now).toISOString(),
  }), "Синхронизировано");
});
