import test from "node:test";
import assert from "node:assert/strict";
import {
  LONG_UNSYNCED_MS,
  getSyncStatusMessage,
  shouldAutoSyncAfterReconnect,
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
