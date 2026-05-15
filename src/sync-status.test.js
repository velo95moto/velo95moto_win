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
  syncResultHasProblems,
} from "./sync-status.js";
import {
  canShowAssemblyOrderCreate,
  canShowAssemblyOrdersList,
} from "./nav-policy.js";
import {
  buildDesktopLogEvent,
  createDesktopLogger,
  redactSensitive,
} from "./desktop-logger.js";
import {
  UPDATE_MANIFEST_URL,
  updateCheckMessage,
  updateErrorMessage,
} from "./updater-policy.js";

const now = Date.parse("2026-05-13T13:00:00Z");

test("operator sees assembly orders list but not assembly order create", () => {
  const bootstrap = {
    roles: { is_operator_role: true, is_view_only_role: false },
    nav: [
      { id: "assembly", label: "Сборка", view: "assembly" },
      { id: "assembly_orders", label: "Заказы сборок", view: "disabled" },
    ],
  };
  assert.equal(canShowAssemblyOrderCreate(bootstrap), false);
  assert.equal(canShowAssemblyOrdersList(bootstrap), true);
});

test("Velo95Moto role sees assembly order create but not assembly orders list", () => {
  const bootstrap = {
    roles: { is_operator_role: false, is_view_only_role: true },
    nav: [
      { id: "assembly", label: "Сборка", view: "assembly" },
      { id: "assembly_order", label: "Заказ сборки", view: "disabled" },
    ],
  };
  assert.equal(canShowAssemblyOrderCreate(bootstrap), true);
  assert.equal(canShowAssemblyOrdersList(bootstrap), false);
});

test("superuser can see both assembly order actions", () => {
  const bootstrap = {
    user: { is_superuser: true },
    roles: { is_operator_role: false, is_view_only_role: false },
    nav: [{ id: "assembly", label: "Сборка", view: "assembly" }],
  };
  assert.equal(canShowAssemblyOrderCreate(bootstrap), true);
  assert.equal(canShowAssemblyOrdersList(bootstrap), true);
});

test("desktop log events redact credentials and tokens", () => {
  const event = buildDesktopLogEvent({
    level: "ERROR",
    action: "api_error",
    description: "Ошибка API",
    details: {
      endpoint: "mobile/sync/records/",
      password: "secret-password",
      nested: {
        access_token: "secret-token",
        payload: { amount: 200 },
      },
    },
    context: { username: "operator", view: "assembly", online: true },
    now: new Date(now),
  });
  assert.equal(event.level, "ERROR");
  assert.equal(event.username, "operator");
  assert.equal(event.details.password, "[REDACTED]");
  assert.equal(event.details.nested.access_token, "[REDACTED]");
  assert.equal(event.details.nested.payload.amount, 200);
});

test("desktop logger writes sync, offline and reconnect events through Tauri command", async () => {
  const written = [];
  const logger = createDesktopLogger({
    invoke: async (command, args) => written.push({ command, args }),
    getContext: () => ({ username: "operator", online: false, view: "records" }),
    consoleTarget: { info() {}, warn() {}, error() {} },
  });
  await logger.info("sync_start", "Старт синхронизации", { pending_total: 2, sync_uuid: "abc" });
  await logger.warning("network_offline", "Интернет пропал", { endpoint: "/api/health/" });
  await logger.info("network_reconnect", "Интернет появился", { retry_attempt: 1 });

  assert.equal(written.length, 3);
  assert.equal(written[0].command, "append_desktop_log");
  assert.equal(written[0].args.event.action, "sync_start");
  assert.equal(written[1].args.event.action, "network_offline");
  assert.equal(written[2].args.event.action, "network_reconnect");
});

test("error logs include endpoint and reason without leaking authorization", () => {
  const details = redactSensitive({
    endpoint: "mobile/assembly/",
    status: 500,
    reason: "status code 500",
    headers: { Authorization: "Bearer secret" },
    payload: { sync_uuid: "uuid-1", amount: 200 },
  });
  assert.equal(details.endpoint, "mobile/assembly/");
  assert.equal(details.status, 500);
  assert.equal(details.reason, "status code 500");
  assert.equal(details.headers.Authorization, "[REDACTED]");
  assert.equal(details.payload.sync_uuid, "uuid-1");
});

test("updater messages explain available, latest and missing manifest states", () => {
  assert.equal(UPDATE_MANIFEST_URL, "https://github.com/velo95moto/velo95moto_win/releases/latest/download/latest.json");
  assert.equal(
    updateCheckMessage({ available: true, version: "0.1.16" }),
    "Доступна новая версия программы v0.1.16.",
  );
  assert.equal(
    updateCheckMessage({ available: false, current_version: "0.1.15" }),
    "Установлена последняя версия v0.1.15.",
  );
  assert.equal(
    updateErrorMessage("404 Not Found"),
    "Не удалось проверить обновления: манифест latest.json не найден в GitHub Releases.",
  );
});

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

test("partial sync result with conflicts or errors is not treated as success", () => {
  assert.equal(syncResultHasProblems(
    "Синхронизировано записей: 1, сборок: 0, авансов: 0, заказов: 0. Конфликты: 1. Ошибки: 0.",
  ), true);
  assert.equal(syncResultHasProblems(
    "Синхронизировано записей: 1, сборок: 0, авансов: 0, заказов: 0. Конфликты: 0. Ошибки: 2.",
  ), true);
  assert.equal(syncResultHasProblems(
    "Синхронизировано записей: 1, сборок: 1, авансов: 1, заказов: 1.",
  ), false);
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

test("desktop manual sync does not trust stale browser offline state", () => {
  assert.equal(shouldFastFailManualSync({
    browserOnline: false,
    syncInProgress: false,
    trustBrowserOnline: false,
  }), false);
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
