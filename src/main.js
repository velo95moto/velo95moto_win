import {
  AUTO_SYNC_INTERVAL_MS,
  getSyncStatusMessage,
  nextReconnectDelayMs,
  offlineSyncMessage,
  parseSyncDate,
  shouldAttemptBackgroundSync,
  shouldFastFailManualSync,
  shouldAutoSyncWhenOnline,
  shouldShowLongSyncWarning,
  shouldAutoSyncAfterReconnect,
  syncResultHasProblems,
} from "./sync-status.js";
import {
  canShowAssemblyOrderCreate,
  canShowAssemblyOrdersList,
  canShowAdminHelper,
  canShowFileExchange,
} from "./nav-policy.js";
import { createDesktopLogger } from "./desktop-logger.js";
import {
  UPDATE_MANIFEST_URL,
  updateCheckMessage,
  updateErrorMessage,
} from "./updater-policy.js";
import {
  buildWhatsAppDesktopUrl,
  buildWhatsAppWebUrl,
  normalizeWhatsAppPhone,
  shouldDisableClientContact,
} from "./whatsapp-policy.js";

const { invoke } = window.__TAURI__.core;
let updateCheckInProgress = false;
let startupUpdateCheckStarted = false;

const DEFAULT_SERVER_URL = "https://velo95moto.ru";
const DATA_PROFILE = "localhost-dev-v1";
const PRODUCTION_SERVER_URL = "https://velo95moto.ru";
const UPDATE_CHECK_TIMEOUT_MS = 3500;
const ADMIN_HELPER_CACHE_KEY = "adminHelperFeatures";
const ADMIN_HELPER_SYNONYMS = {
  "зп": ["зарплата", "заработал", "оклад", "начисления", "ставка"],
  "зарплата": ["зп", "заработал", "оклад", "начисления", "ставка"],
  "заработал": ["зарплата", "зп", "начисления", "итог"],
  "оклад": ["зарплата", "зп", "ставка", "начисления"],
  "начисления": ["зарплата", "заработал", "расчет", "расчёт"],
  "расчет": ["расчёт", "считать", "посчитать", "сумма", "авторасчет"],
  "расчёт": ["расчет", "считать", "посчитать", "сумма", "авторасчёт"],
  "посчитать": ["считать", "расчет", "сумма", "авторасчет"],
  "считать": ["посчитать", "расчет", "расчёт", "сумма", "авторасчет"],
  "сумма": ["расчет", "расчёт", "считать", "итог", "начисления"],
  "авторасчет": ["авторасчёт", "автоматический", "расчет", "сразу", "считать"],
  "авторасчёт": ["авторасчет", "автоматический", "расчёт", "сразу", "считать"],
  "настройка": ["параметры", "шестеренка", "шестерёнка", "тумблер", "переключатель"],
  "шестеренка": ["шестерёнка", "настройка", "параметры", "gear", "сотрудник"],
  "шестерёнка": ["шестеренка", "настройка", "параметры", "gear", "сотрудник"],
  "тумблер": ["переключатель", "настройка", "toggle"],
  "переключатель": ["тумблер", "настройка", "toggle"],
  "сотрудник": ["мастер", "работник", "персонал"],
  "мастер": ["сотрудник", "работник", "зарплата"],
  "выходной": ["в", "отдых", "не работал"],
  "праздник": ["праздничный", "оплачиваемый", "выходной"],
  "аванс": ["выдать деньги", "деньги", "выплата"],
  "журнал": ["итог", "итоговая", "сводка", "баланс"],
  "итог": ["журнал", "итоговая", "баланс", "сумма"],
  "табель": ["день", "отметка", "рабочий", "выходной"],
  "запись": ["ремонт", "заказ", "работа"],
  "ремонт": ["запись", "заказ", "работа"],
  "отчет": ["отчёт", "история", "детализация"],
  "отчёт": ["отчет", "история", "детализация"],
};

const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const loginServerUrlInput = document.querySelector("#login-server-url");
const loginUsernameInput = document.querySelector("#login-username");
const loginPasswordInput = document.querySelector("#login-password");
const navItems = document.querySelector("#nav-items");
const userChip = document.querySelector("#user-chip");
const headerSearchForm = document.querySelector("#header-search-form");
const headerPhoneSearch = document.querySelector("#header-phone-search");
const logoutButton = document.querySelector("#logout-button");
const adminHelperOpen = document.querySelector("#admin-helper-open");
const fileExchangeOpen = document.querySelector("#file-exchange-open");
const adminHelperPanel = document.querySelector("#admin-helper-panel");
const adminHelperClose = document.querySelector("#admin-helper-close");
const adminHelperQuery = document.querySelector("#admin-helper-query");
const adminHelperStatus = document.querySelector("#admin-helper-status");
const adminHelperResults = document.querySelector("#admin-helper-results");
const recordForm = document.querySelector("#record-form");
const recordsBody = document.querySelector("#records-body");
const searchRecordsBody = document.querySelector("#search-records-body");
const searchRecordsTitle = document.querySelector("#records-search-title");
const searchRecordsMeta = document.querySelector("#records-search-meta");
const searchSelectAllCheckbox = document.querySelector("#search-select-all");
const assemblyList = document.querySelector("#assembly-list");
const assemblySearch = document.querySelector("#assembly-search");
const assemblyDate = document.querySelector("#assembly-date");
const salaryDateInput = document.querySelector("#salary-date-input");
const salaryDateToInput = document.querySelector("#salary-date-to-input");
const salaryDateMeta = document.querySelector("#salary-date-meta");
const salaryFilterForm = document.querySelector("#salary-filter-form");
const salaryContent = document.querySelector("#salary-content");
const salaryStatus = document.querySelector("#salary-status");
const dailyTimesheetDateInput = document.querySelector("#daily-timesheet-date");
const dailyTimesheetDateForm = document.querySelector("#daily-timesheet-date-form");
const dailyTimesheetCurrentDate = document.querySelector("#daily-timesheet-current-date");
const dailyTimesheetStatus = document.querySelector("#daily-timesheet-status");
const dailyTimesheetBody = document.querySelector("#daily-timesheet-body");
const dailyTimesheetSaveForm = document.querySelector("#daily-timesheet-save-form");
const dailyReportButton = document.querySelector("#daily-report-button");
const dailyReportModal = document.querySelector("#daily-report-modal");
const dailyReportBody = document.querySelector("#daily-report-body");
const journalMonthForm = document.querySelector("#journal-month-form");
const journalMonthInput = document.querySelector("#journal-month");
const journalMonthPicker = document.querySelector("#journal-month-picker");
const journalSearch = document.querySelector("#journal-search");
const journalEmployeeType = document.querySelector("#journal-employee-type");
const journalHighlightFilter = document.querySelector("#journal-highlight-filter");
const journalFilterStatus = document.querySelector("#journal-filter-status");
const journalStatus = document.querySelector("#journal-status");
const journalHead = document.querySelector("#journal-head");
const journalBody = document.querySelector("#journal-body");
const journalFilterEmpty = document.querySelector("#journal-filter-empty");
const journalSidePanel = document.querySelector("#journal-side-panel");
const syncButton = document.querySelector("#sync-button");
const syncPanel = document.querySelector(".sync-panel");
const serverUrlInput = document.querySelector("#server-url");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const partsInput = document.querySelector("#parts");
const servicesInput = document.querySelector("#services");
const totalAmountEl = document.querySelector("#client-total-amount");
const masterSelect = document.querySelector("#master");
const titleInput = document.querySelector("#title");
const newRecordPhoneInput = document.querySelector("#phone");
const clientNameInput = document.querySelector("#client-name");
const commentsInput = document.querySelector("#comments");
const freeRepairInput = document.querySelector("#free-repair");
const submitRecordButton = recordForm?.querySelector("button[type='submit']");
const equipmentOptions = document.querySelector("#equipment-options");
const settingsWrapper = document.querySelector("#settings-wrapper");
const settingsButton = document.querySelector("#settings-button");
const settingsDropdown = document.querySelector("#settings-dropdown");
const phoneFilter = document.querySelector("#phone-input");
const masterFilter = document.querySelector("#master-filter");
const collectedFilter = document.querySelector("#collected-filter");
const startDateFilter = document.querySelector("#start-date-filter");
const endDateFilter = document.querySelector("#end-date-filter");
const filtersPanel = document.querySelector("#filters");
const selectAllCheckbox = document.querySelector("#select-all");
const paginationSummary = document.querySelector("#pagination-summary");
const paginationControls = document.querySelector("#pagination-controls");
const pageHeroMeta = document.querySelector("#page-hero-meta");
const totalAmountSummary = document.querySelector("#total-amount");
const totalMasterSummary = document.querySelector("#total-master-amount");
const totalPartsSummary = document.querySelector("#total-parts-amount");
const selectedCountEl = document.querySelector("#selected-records-count");
const floatingTotalAmount = document.querySelector("#floating-total-amount");
const floatingMasterAmount = document.querySelector("#floating-master-amount");
const floatingPartsAmount = document.querySelector("#floating-parts-amount");
const floatingSelection = document.querySelector("#selection-summary-floating");
const recordDetailsModal = document.querySelector("#record-details-modal");
const recordEditModal = document.querySelector("#record-edit-modal");
const editRecordForm = document.querySelector("#edit-record-form");
const editPasswordModal = document.querySelector("#edit-password-modal");
const editPasswordForm = document.querySelector("#edit-password-form");
const editPasswordInput = document.querySelector("#edit-password-input");
const editPasswordError = document.querySelector("#edit-password-error");
const editMasterSelect = document.querySelector("#edit-master");
const editPartsInput = document.querySelector("#edit-parts");
const editServicesInput = document.querySelector("#edit-services");
const editTotalAmount = document.querySelector("#edit-total-amount");
const assemblyFilterStatus = document.querySelector("#assembly-filter-status");
const assemblyOrderForm = document.querySelector("#assembly-order-form");
const assemblyOrderName = document.querySelector("#assembly-order-name");
const assemblyOrderQuantity = document.querySelector("#assembly-order-quantity");
const assemblyOrderUrgent = document.querySelector("#assembly-order-urgent");
const assemblyOrderCreateStatus = document.querySelector("#assembly-order-create-status");
const assemblyOrderCreateList = document.querySelector("#assembly-order-create-list");
const assemblyOrdersList = document.querySelector("#assembly-orders-list");
const advancesDate = document.querySelector("#advances-date");
const advancesSearch = document.querySelector("#advances-search");
const advancesFilterStatus = document.querySelector("#advances-filter-status");
const advancesFilterEmpty = document.querySelector("#advances-filter-empty");
const advancesList = document.querySelector("#advances-list");
const advancesDebtPanels = document.querySelector("#advances-debt-panels");
const employeeForm = document.querySelector("#employee-form");
const employeeFormError = document.querySelector("#employee-form-error");
const employeeBody = document.querySelector("#desktop-add-employee-body");
const employeeToggle = document.querySelector("#desktop-add-employee-toggle");
const employeeChevron = document.querySelector("#desktop-add-employee-chevron");
const employeeIsActive = document.querySelector("#employee-is-active");
const employeeFixedDaily = document.querySelector("#employee-fixed-daily");
const employeeDepartment = document.querySelector("#employee-department");
const employeePrimaryPosition = document.querySelector("#employee-primary-position");
const employeeSecondaryPosition = document.querySelector("#employee-secondary-position");
const employeeDayOff = document.querySelector("#employee-day-off");
const employeeDayOffWrap = document.querySelector("#employee-day-off-wrap");
const employeeSalaryWrap = document.querySelector("#employee-salary-wrap");
const employeeDailySalaryWrap = document.querySelector("#employee-daily-salary-wrap");

const state = {
  bootstrap: null,
  pollTimer: null,
  currentView: "records",
  pendingRecords: 0,
  pendingAssemblies: 0,
  pendingAdvances: 0,
  pendingOrders: 0,
  pendingTotal: 0,
  pendingConflicts: 0,
  lastSuccessfulSyncAt: null,
  longSyncWarningVisible: false,
  syncUiStatus: "idle",
  syncUiMessage: "Ожидание",
  records: [],
  assemblyOrders: [],
  adminHelperFeatures: [],
  employeeAdvances: [],
  employeesBalance: [],
  dailyTimesheet: {
    date: "",
    employees: [],
    monthEntries: [],
    salaryByName: {},
  },
  journal: {
    month: "",
    rows: [],
    days: [],
    selectedId: "",
  },
  salaryRecords: [],
  salaryCache: null,
  filteredRecords: [],
  headerSearchQuery: "",
  selectedRecordIds: new Set(),
  currentPage: 1,
  perPage: 100,
  datesInitialized: false,
  recordsFiltersDirty: false,
  editingRecordKey: "",
  pendingEditRecordKey: "",
  previousView: null,
  network: {
    online: false,
    mode: "unknown",
    reconnectTimer: null,
    reconnectAttempts: 0,
    syncInProgress: false,
    manualSyncInProgress: false,
    lastHealth: null,
    lastOfflineAt: 0,
    lastOfflineLogAt: 0,
  },
};

const DesktopAudit = createDesktopLogger({
  invoke,
  getContext: () => ({
    username: state.bootstrap?.user?.username || usernameInput?.value || loginUsernameInput?.value || "",
    displayName: state.bootstrap?.user?.display_name || "",
    roles: state.bootstrap?.roles || {},
    view: state.currentView || "",
    online: state.network?.online,
  }),
});

function auditInfo(action, description, details = {}) {
  DesktopAudit.info(action, description, details);
}

function auditWarning(action, description, details = {}) {
  DesktopAudit.warning(action, description, details);
}

function auditError(action, description, details = {}) {
  DesktopAudit.error(action, description, details);
}

let lastUiFreezeLogAt = 0;
let lastWakeRecoveryAt = 0;
const SLEEP_GAP_THRESHOLD_MS = 30_000;

// Heuristic: a long gap between two ticks means the OS suspended us
// (laptop lid closed, Windows sleep, debugger pause). Re-probe the network
// and re-arm sync — timers that fired during sleep are lost.
async function handleSystemWake(reason, gapMs) {
  if (Date.now() - lastWakeRecoveryAt < 5_000) return;
  lastWakeRecoveryAt = Date.now();
  auditInfo("system_wake_detected", "Обнаружено пробуждение системы, переинициализирую соединение.", {
    reason,
    gap_ms: Math.round(gapMs),
  });
  try {
    state.network.reconnectAttempts = 0;
    const online = await runHealthCheck("system-wake");
    if (online) {
      await handleConfirmedOnline("system-wake");
    } else {
      scheduleReconnectWorker();
    }
  } catch (error) {
    auditError("system_wake_recover_failed", "Ошибка восстановления после пробуждения.", {
      error: String(error),
    });
  }
}

function startUiFreezeWatchdog() {
  let expected = performance.now() + 5000;
  window.setInterval(() => {
    const now = performance.now();
    const lag = now - expected;
    expected = now + 5000;
    if (lag > SLEEP_GAP_THRESHOLD_MS) {
      handleSystemWake("watchdog_clock_gap", lag);
      return;
    }
    if (lag > 1500 && Date.now() - lastUiFreezeLogAt > 60_000) {
      lastUiFreezeLogAt = Date.now();
      auditWarning("ui_freeze_detected", "Обнаружена долгая задержка UI-потока.", {
        lag_ms: Math.round(lag),
      });
    }
  }, 5000);

  // Belt-and-suspenders: also react when the window regains focus after the
  // OS routed events elsewhere (Spaces switch, RDP reconnect, etc.) — the
  // visibilitychange path catches cases where the clock gap is small.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !state.network.online) {
      handleSystemWake("visibility_visible", 0);
    }
  });
}

// Promise wrapper that rejects if a Tauri IPC call hangs. Rust's HTTP client
// has its own timeouts, but the IPC channel itself can stall on disk lock,
// keychain prompts, or platform glitches — without this wrapper, JS would
// await forever and the watchdog (which only sees JS event-loop freezes) would
// stay quiet.
async function invokeWithTimeout(name, args, timeoutMs = 30_000) {
  return withTimeout(invoke(name, args), timeoutMs, `tauri ${name}`);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("ru-RU");
}

function asInt(value) {
  const number = Number.parseInt(String(value || "0").replace(/\D/g, ""), 10);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeServerUrl(value) {
  const serverUrl = String(value || "").trim();
  if (!serverUrl) return DEFAULT_SERVER_URL;
  try {
    const hostname = new URL(serverUrl).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") return DEFAULT_SERVER_URL;
    if (hostname === new URL(PRODUCTION_SERVER_URL).hostname) return DEFAULT_SERVER_URL;
  } catch {
    return serverUrl;
  }
  return serverUrl;
}

function normalizeResourceUrl(value) {
  const resourceUrl = String(value || "").trim();
  if (!resourceUrl) return "";
  try {
    const url = new URL(resourceUrl);
    if (url.hostname === new URL(PRODUCTION_SERVER_URL).hostname) {
      return `${DEFAULT_SERVER_URL}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return resourceUrl;
  }
  return resourceUrl;
}

function setStatus(message, isError = false) {
  if (message) showToast(message, isError);
}

function setSyncUiStatus(status, message = "") {
  state.syncUiStatus = status;
  state.syncUiMessage = message;
  if (typeof SyncService !== "undefined") SyncService.renderIndicator();
}

function hasPendingLocalChanges() {
  return Number(state.pendingTotal || 0) > 0;
}

function updateLongSyncWarning() {
  const shouldWarn = shouldShowLongSyncWarning({
    pendingTotal: state.pendingTotal,
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
  });
  state.longSyncWarningVisible = shouldWarn;
  if (typeof SyncService !== "undefined") SyncService.renderIndicator();
}

function loadSyncSettings() {
  if (localStorage.getItem("dataProfile") !== DATA_PROFILE) {
    localStorage.removeItem("lastAuthHash");
    localStorage.removeItem("lastAuthUser");
    localStorage.removeItem("lastBootstrap");
    localStorage.removeItem(ADMIN_HELPER_CACHE_KEY);
    localStorage.setItem("dataProfile", DATA_PROFILE);
  }
  const saved = localStorage.getItem("serverUrl");
  const serverUrl = normalizeServerUrl(saved);
  const username = localStorage.getItem("username") || "";
  localStorage.setItem("serverUrl", serverUrl);
  serverUrlInput.value = serverUrl;
  usernameInput.value = username;
  loginServerUrlInput.value = serverUrl;
  loginUsernameInput.value = username;
}

function saveSyncSettings() {
  localStorage.setItem("serverUrl", normalizeServerUrl(serverUrlInput.value || loginServerUrlInput.value));
  localStorage.setItem("username", usernameInput.value.trim() || loginUsernameInput.value.trim());
}

function currentSettings() {
  return {
    server_url: normalizeServerUrl(serverUrlInput.value || loginServerUrlInput.value),
    username: (usernameInput.value || loginUsernameInput.value).trim(),
    password: passwordInput.value || loginPasswordInput.value,
  };
}

function hasSyncCredentials(settings = currentSettings()) {
  return Boolean(settings.server_url && settings.username && settings.password);
}

async function authFingerprint(settings) {
  const text = `${settings.server_url.trim().toLowerCase()}|${settings.username.trim().toLowerCase()}|${settings.password}`;
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function rememberSuccessfulLogin(settings, bootstrap) {
  const offlineBootstrap = { ...bootstrap };
  delete offlineBootstrap.access_token;
  localStorage.setItem("lastAuthUser", settings.username.trim().toLowerCase());
  localStorage.setItem("lastBootstrap", JSON.stringify(offlineBootstrap));
}

async function rememberSuccessfulPassword(settings) {
  localStorage.setItem("lastAuthHash", await authFingerprint(settings));
}

async function canOpenOfflineWithPassword(settings) {
  const savedHash = localStorage.getItem("lastAuthHash") || "";
  const savedUser = localStorage.getItem("lastAuthUser") || "";
  if (!savedHash || savedUser !== settings.username.trim().toLowerCase()) return false;
  return savedHash === await authFingerprint(settings);
}

function restoreOfflineBootstrap() {
  try {
    const raw = localStorage.getItem("lastBootstrap") || "";
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function showLocalUi() {
  loginScreen.classList.add("is-hidden");
  appShell.classList.remove("is-locked");
}

function browserIsOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function markNetworkOffline(source = "network", reason = "") {
  state.network.online = false;
  state.network.mode = "offline";
  state.network.lastOfflineAt = Date.now();
  setSyncUiStatus("offline", "Нет интернета");
  if (Date.now() - Number(state.network.lastOfflineLogAt || 0) > 15_000) {
    state.network.lastOfflineLogAt = Date.now();
    auditWarning("network_marked_offline", "Программа переведена в офлайн-режим.", {
      source,
      reason,
    });
  }
}

function shouldFastFailNetworkRequest() {
  if (!browserIsOnline()) return true;
  return state.network.mode === "offline";
}

function isNetworkErrorText(error) {
  const text = String(error || "").toLowerCase();
  return [
    "timeout",
    "timed out",
    "network",
    "dns",
    "offline",
    "connection",
    "connect",
    "refused",
    "reset",
    "unreachable",
    "недоступ",
    "интернет",
  ].some((needle) => text.includes(needle));
}

function withTimeout(promise, timeoutMs, label = "operation") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

async function runHealthCheck(source = "startup", timeoutMs = 1500) {
  const settings = currentSettings();
  if (!settings.server_url) {
    markNetworkOffline(source, "missing_server_url");
    auditWarning("network_health_check", "Проверка сети пропущена: не указан сайт.", { source });
    return false;
  }

  const started = performance.now();
  const wasOffline = !state.network.online;
  try {
    const result = await withTimeout(
      invoke("health_check", {
        serverUrl: settings.server_url,
        timeoutMs,
      }),
      Math.max(2000, timeoutMs * 2 + 1000),
      "health_check",
    );
    state.network.lastHealth = result;
    state.network.online = Boolean(result.online);
    state.network.mode = result.online ? "online" : "offline";
    if (state.network.online) {
      // Any successful health-check resets the backoff. Previously this was
      // only done by the reconnect worker, so a degraded-but-up scenario
      // (DNS flapping while navigator.onLine stayed true) could keep us on
      // the maximum 120s delay forever.
      state.network.reconnectAttempts = 0;
      if (state.syncUiStatus === "offline") {
        setSyncUiStatus(state.lastSuccessfulSyncAt ? "ok" : "idle", state.lastSuccessfulSyncAt ? "Синхронизировано" : "");
      }
      if (typeof SyncService !== "undefined") SyncService.markOnlineDetected();
      // If we just transitioned offline->online without a browser-level
      // 'online' event firing (common for short DNS drops), drain the queue.
      if (wasOffline) {
        handleConfirmedOnline(source).catch((error) => {
          console.warn("[offline-startup] handleConfirmedOnline failed", error);
        });
      }
    } else {
      markNetworkOffline(source, result.error || "health_check_offline");
    }
    const duration = result.duration_ms ?? Math.round(performance.now() - started);
    console.info(`[offline-startup] health-check source=${source} online=${state.network.online} duration_ms=${duration}`);
    auditInfo(
      result.online ? "network_online" : "network_offline",
      result.online ? "Сервер доступен." : "Сервер недоступен, программа работает офлайн.",
      { source, duration_ms: duration, status: result.status, error: result.error },
    );
    return state.network.online;
  } catch (error) {
    markNetworkOffline(source, String(error));
    console.warn(`[offline-startup] health-check source=${source} failed`, error);
    auditError("network_health_check_failed", "Ошибка проверки сети.", {
      source,
      duration_ms: Math.round(performance.now() - started),
      error: String(error),
    });
    return false;
  }
}

function scheduleReconnectWorker(delayMs = nextReconnectDelayMs({
  online: state.network.online,
  attempts: state.network.reconnectAttempts,
})) {
  window.clearTimeout(state.network.reconnectTimer);
  state.network.reconnectTimer = window.setTimeout(async () => {
    state.network.reconnectAttempts += 1;
    console.info(`[offline-startup] reconnect attempt=${state.network.reconnectAttempts}`);
    auditInfo("network_reconnect_attempt", "Попытка восстановления связи.", {
      attempt: state.network.reconnectAttempts,
      delay_ms: delayMs,
    });
    const wasOnline = state.network.online;
    const isOnline = await runHealthCheck("reconnect");
    if (isOnline) state.network.reconnectAttempts = 0;
    await refreshPendingSyncSummary();
    if (
      shouldAutoSyncAfterReconnect({ wasOnline, isOnline, pendingTotal: state.pendingTotal })
      || shouldAutoSyncWhenOnline({
        isOnline,
        pendingTotal: state.pendingTotal,
        syncInProgress: state.network.syncInProgress,
      })
    ) {
      auditInfo("sync_auto_after_reconnect", "Запущена автоматическая синхронизация после восстановления связи.", {
        pending_total: state.pendingTotal,
      });
      queueBackgroundSync("reconnect", "Данные синхронизированы после восстановления связи.");
    }
    scheduleReconnectWorker(nextReconnectDelayMs({
      online: isOnline,
      attempts: state.network.reconnectAttempts,
    }));
  }, delayMs);
}

function queueBackgroundSync(reason = "background", successMessage = "Данные синхронизированы с сайтом.") {
  window.setTimeout(() => {
    if (!shouldAttemptBackgroundSync({
      online: state.network.online,
      syncInProgress: state.network.syncInProgress,
      pendingTotal: state.pendingTotal,
    })) {
      if (!state.network.online) {
        setSyncUiStatus("offline", "Нет интернета");
        scheduleReconnectWorker();
      }
      return;
    }
    syncNow(successMessage, { reason, background: true });
  }, 0);
}

async function handleConfirmedOnline(source = "online") {
  await refreshPendingSyncSummary();
  SyncService.markOnlineDetected();
  if (shouldAutoSyncWhenOnline({
    isOnline: state.network.online,
    pendingTotal: state.pendingTotal,
    syncInProgress: state.network.syncInProgress,
  })) {
    queueBackgroundSync(source, "Данные синхронизированы после восстановления связи.");
  }
}

const ADMIN_VIEWS = new Set(["timesheet", "audit", "operator", "users", "shop"]);

function desktopNavView(item) {
  if ((item.id === "advances" || item.label === "Авансы") && item.view === "disabled") {
    return "advances";
  }
  if ((item.id === "timesheet" || item.label === "Табель") && item.view === "disabled") {
    return "daily-timesheet";
  }
  if ((item.id === "journal" || item.label === "Журнал") && item.view === "disabled") {
    return "journal";
  }
  if ((item.id === "assembly_order" || item.label === "Заказ сборки") && item.view === "disabled") {
    return "assembly-order";
  }
  if ((item.id === "assembly_orders" || item.label === "Заказы сборок") && item.view === "disabled") {
    return "assembly-orders";
  }
  return item.view;
}

function getDefaultRecordsDate(records = state.records) {
  return records[0]?.record_date || todayIsoDate();
}

function applyDefaultRecordsDate() {
  const defaultDate = getDefaultRecordsDate();
  startDateFilter.value = defaultDate;
  endDateFilter.value = defaultDate;
}

function resetRecordsViewState() {
  phoneFilter.value = "";
  masterFilter.value = "";
  collectedFilter.value = "";
  applyDefaultRecordsDate();
  filtersPanel?.classList.add("is-hidden");
  headerPhoneSearch.value = "";
  state.headerSearchQuery = "";
  state.previousView = null;
  state.currentPage = 1;
  state.recordsFiltersDirty = false;
  state.selectedRecordIds.clear();
  selectAllCheckbox.checked = false;
  if (searchSelectAllCheckbox) searchSelectAllCheckbox.checked = false;
  filterRecords();
}

function openDefaultRecordsView() {
  switchView("records", { resetRecords: true });
}

function switchView(viewName, options = {}) {
  if (viewName === "disabled") {
    setStatus("Этот раздел пока открывается только на сайте. Основные офлайн-разделы уже доступны здесь.");
    return;
  }
  closeAllDropdowns();
  state.currentView = viewName;
  if (viewName === "records" && options.resetRecords) {
    resetRecordsViewState();
  }
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.view === viewName ||
        (viewName === "records-search" && button.dataset.view === "records") ||
        (viewName === "add-record" && button.dataset.view === "records") ||
        (viewName.startsWith("assembly-") && button.dataset.view === "assembly")
    );
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `${viewName}-view`);
  });
  const titles = {
    assembly: "Сборка",
    "assembly-order": "Заказ сборки",
    "assembly-orders": "Заказы сборок",
    advances: "Авансы",
    "records-search": "Поиск записей",
    "add-record": "Добавление записи",
    salary: "Зарплаты",
    "daily-timesheet": "Табель",
    journal: "Журнал",
    timesheet: "Бухгалтерия",
    audit: "Журнал действий",
    operator: "Кабинет оператора",
    users: "Управление пользователями",
    shop: "Управление магазином",
    accounting: "Бухгалтерия",
  };
  if (ADMIN_VIEWS.has(viewName)) {
    loadAdminView(viewName);
  } else if (viewName === "salary") {
    loadSalaryView();
  } else if (viewName === "advances") {
    loadAdvancesView();
  } else if (viewName === "daily-timesheet") {
    loadDailyTimesheetView();
  } else if (viewName === "journal") {
    loadJournalView();
  } else if (viewName === "assembly") {
    loadAssemblies();
  } else if (viewName === "assembly-order" || viewName === "assembly-orders") {
    loadAssemblyOrders();
  }
}

function closeAllDropdowns() {
  document.querySelectorAll(".nav-dropdown.is-open").forEach((el) => {
    el.classList.remove("is-open");
  });
}

function renderNavigation() {
  const nav = state.bootstrap?.nav || [
    { id: "records", label: "Список", view: "records" },
    { id: "assembly", label: "Сборка", view: "assembly" },
  ];
  navItems.innerHTML = "";
  const canAddRecord = hasPermission("records.add_record") && !state.bootstrap?.roles?.is_view_only_role;
  const hasAssemblyDropdown = nav.some((item) => item.id === "assembly" && item.view === "assembly");
  for (const item of nav) {
    if (hasAssemblyDropdown && (item.id === "assembly_order" || item.id === "assembly_orders")) continue;
    const view = desktopNavView(item);
    // Бухгалтерия доступна через шестерёнку — в основном nav дублировать не нужно
    if (view === "timesheet") continue;
    const button = document.createElement("button");
    button.className = "nav-tab";
    button.type = "button";
    button.dataset.view = view;
    if (view === "assembly-orders") {
      button.innerHTML = `${escapeHtml(item.label)} <span id="assembly-orders-nav-badge" class="nav-live-badge is-hidden"></span>`;
      button.addEventListener("click", () => { AssemblyOrderPoller.markSeen(); switchView(view); });
    } else if (view === "records") {
      button.textContent = item.label;
      button.addEventListener("click", openDefaultRecordsView);
    } else {
      button.textContent = item.label;
      button.addEventListener("click", () => switchView(view));
    }
    if (view === "records" && canAddRecord) {
      const wrapper = document.createElement("div");
      wrapper.className = "nav-dropdown";
      const menu = document.createElement("div");
      menu.className = "nav-dropdown-menu";
      const addButton = document.createElement("button");
      addButton.className = "nav-dropdown-item";
      addButton.type = "button";
      addButton.textContent = "Добавить работу";
      addButton.addEventListener("click", () => {
        closeAllDropdowns();
        switchView("add-record");
      });
      menu.append(addButton);
      
      // Attach mouseenter/mouseleave for dropdown management
      wrapper.addEventListener("mouseenter", () => {
        wrapper.classList.add("is-open");
      });
      wrapper.addEventListener("mouseleave", () => {
        wrapper.classList.remove("is-open");
      });
      
      wrapper.append(button, menu);
      navItems.append(wrapper);
    } else if (view === "assembly") {
      const showOrderCreate = canShowAssemblyOrderCreate(state.bootstrap);
      const showOrdersList = canShowAssemblyOrdersList(state.bootstrap);
      const wrapper = document.createElement("div");
      wrapper.className = "nav-dropdown";
      const menu = document.createElement("div");
      menu.className = "nav-dropdown-menu";
      if (showOrderCreate) {
        const orderButton = document.createElement("button");
        orderButton.className = "nav-dropdown-item";
        orderButton.type = "button";
        orderButton.textContent = "Заказ сборки";
        orderButton.addEventListener("click", () => {
          closeAllDropdowns();
          switchView("assembly-order");
        });
        menu.append(orderButton);
      }
      if (showOrdersList) {
        const ordersButton = document.createElement("button");
        ordersButton.className = "nav-dropdown-item";
        ordersButton.type = "button";
        ordersButton.dataset.view = "assembly-orders";
        ordersButton.innerHTML = 'Заказы сборок <span id="assembly-orders-nav-badge" class="nav-live-badge is-hidden"></span>';
        ordersButton.addEventListener("click", () => {
          AssemblyOrderPoller.markSeen();
          closeAllDropdowns();
          switchView("assembly-orders");
        });
        menu.append(ordersButton);
      }
      if (menu.children.length) {
        // Attach mouseenter/mouseleave for dropdown management
        wrapper.addEventListener("mouseenter", () => {
          wrapper.classList.add("is-open");
        });
        wrapper.addEventListener("mouseleave", () => {
          wrapper.classList.remove("is-open");
        });
        
        wrapper.append(button, menu);
        navItems.append(wrapper);
      } else {
        navItems.append(button);
      }
    } else {
      navItems.append(button);
    }
  }
  const currentInNav = nav.some((item) => desktopNavView(item) === state.currentView) || state.currentView === "add-record" || state.currentView.startsWith("assembly-");
  const currentIsAdminView = ADMIN_VIEWS.has(state.currentView);
  if (currentInNav || currentIsAdminView) {
    // Навигация перестроена, но страница не меняется — только восстанавливаем active-класс
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.classList.toggle(
        "is-active",
        btn.dataset.view === state.currentView ||
          (state.currentView === "add-record" && btn.dataset.view === "records") ||
          (state.currentView.startsWith("assembly-") && btn.dataset.view === "assembly")
      );
    });
  } else {
    switchView("records");
  }
}


function fillSelect(select, items, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  for (const item of items || []) {
    const option = document.createElement("option");
    option.value = item.value || item;
    option.textContent = item.label || item.value || item;
    select.append(option);
  }
}

function normalizeMasterFilterName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
}

function formatMasterFilterLabel(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function sortMasterFilterItems(items) {
  return [...items].sort((a, b) => (
    normalizeMasterFilterName(a.label).localeCompare(normalizeMasterFilterName(b.label), "ru")
  ));
}

function buildMasterFilterGroups(activeMasters = state.bootstrap?.masters || [], selectedMaster = masterFilter?.value || "") {
  const recordMastersByKey = new Map();
  const recordMasterNames = [...new Set(
    (state.records || [])
      .map((record) => record.master)
      .filter((name) => String(name || "").trim())
  )].sort((a, b) => normalizeMasterFilterName(a).localeCompare(normalizeMasterFilterName(b), "ru"));

  for (const name of recordMasterNames) {
    const key = normalizeMasterFilterName(name);
    if (key && !recordMastersByKey.has(key)) recordMastersByKey.set(key, name);
  }

  const selectedKey = normalizeMasterFilterName(selectedMaster);
  const currentMastersByKey = new Map();
  for (const item of activeMasters || []) {
    const rawValue = item.value || item.label || item;
    const label = formatMasterFilterLabel(item.label || item.value || item);
    const key = normalizeMasterFilterName(rawValue || label);
    if (!key || currentMastersByKey.has(key)) continue;
    currentMastersByKey.set(key, {
      value: recordMastersByKey.get(key) || rawValue || label,
      label,
      selected: key === selectedKey,
    });
  }

  const former = [];
  for (const [key, value] of recordMastersByKey.entries()) {
    if (currentMastersByKey.has(key)) continue;
    former.push({
      value,
      label: formatMasterFilterLabel(value),
      selected: key === selectedKey,
    });
  }

  return {
    current: sortMasterFilterItems(currentMastersByKey.values()),
    former: sortMasterFilterItems(former),
  };
}

function appendMasterFilterGroup(select, label, items) {
  if (!items.length) return;
  const group = document.createElement("optgroup");
  group.label = label;
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    option.selected = item.selected;
    group.append(option);
  }
  select.append(group);
}

function fillRecordMasterFilter(activeMasters = state.bootstrap?.masters || []) {
  if (!masterFilter) return;
  const selectedMaster = masterFilter.value;
  masterFilter.innerHTML = '<option value="">Выбрать мастера</option>';
  const groups = buildMasterFilterGroups(activeMasters, selectedMaster);
  appendMasterFilterGroup(masterFilter, "Актуальные мастера", groups.current);
  appendMasterFilterGroup(masterFilter, "Бывшие / неактуальные мастера", groups.former);
}

function fillMasterFilters(items) {
  fillSelect(masterSelect, items, "— Выберите мастера —");
  fillSelect(editMasterSelect, items, "— Выберите мастера —");
  fillRecordMasterFilter(items);
}

function fillDatalist(datalist, items) {
  datalist.innerHTML = "";
  for (const item of items || []) {
    const option = document.createElement("option");
    option.value = item.value || item;
    datalist.append(option);
  }
}

function fillChoices(select, items, placeholder) {
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  for (const item of items || []) {
    const option = document.createElement("option");
    option.value = item.value ?? item.id ?? "";
    option.textContent = item.label ?? item.name ?? item.value ?? "";
    select.append(option);
  }
}

function fillEmployeeChoices(bootstrap) {
  fillChoices(employeeDepartment, bootstrap.department_choices, "— Выберите отдел —");
  fillChoices(employeePrimaryPosition, bootstrap.positions, "— Выберите должность —");
  fillChoices(employeeSecondaryPosition, bootstrap.positions, "Без дополнительной должности");
  fillChoices(employeeDayOff, bootstrap.weekday_choices, "— Выберите выходной —");
  syncEmployeeFormVisibility();
}

function selectOptionByText(select, text) {
  if (!select || select.value) return;
  const target = String(text || "").toLowerCase();
  const option = Array.from(select.options).find((item) => item.textContent.trim().toLowerCase() === target);
  if (option) select.value = option.value;
}

function syncEmployeeFormVisibility() {
  if (!employeeForm) return;
  const isActive = employeeIsActive?.checked ?? true;
  const useFixedDaily = employeeFixedDaily?.checked ?? false;

  employeeForm.querySelectorAll(".timesheet-active-only").forEach((element) => {
    element.classList.toggle("is-hidden", !isActive);
  });
  employeeSalaryWrap?.classList.toggle("is-hidden", useFixedDaily);
  employeeDailySalaryWrap?.classList.toggle("is-hidden", !useFixedDaily);
  employeeDayOffWrap?.classList.toggle("is-hidden", useFixedDaily);

  if (isActive) {
    selectOptionByText(employeeDepartment, "Вело95Мото");
  } else {
    if (employeeDepartment) employeeDepartment.value = "";
    if (employeePrimaryPosition) employeePrimaryPosition.value = "";
    if (employeeSecondaryPosition) employeeSecondaryPosition.value = "";
    if (employeeDayOff) employeeDayOff.value = "";
  }

  if (useFixedDaily) {
    const salary = document.querySelector("#employee-salary");
    if (salary) salary.value = "0";
    if (employeeDayOff) employeeDayOff.value = "";
  } else {
    const dailySalary = document.querySelector("#employee-daily-salary");
    if (dailySalary) dailySalary.value = "0";
  }
}

function setEmployeeFormError(message) {
  if (!employeeFormError) return;
  employeeFormError.textContent = message || "";
}

function validateEmployeeFormPayload(payload) {
  if (!payload.full_name) return "Укажите ФИО сотрудника.";
  if (payload.is_active && !payload.department) return "Укажите отдел для активного сотрудника.";
  if (payload.is_active && !payload.primary_position_id) return "Укажите основную должность.";
  if (payload.is_active && !payload.use_fixed_daily_salary && !payload.day_off) return "Укажите выходной день.";
  if (payload.primary_position_id && payload.secondary_position_id && payload.primary_position_id === payload.secondary_position_id) {
    return "Дополнительная должность должна отличаться от основной.";
  }
  return "";
}

async function saveEmployeeFromPage(event) {
  event.preventDefault();
  if (!employeeForm) return;
  setEmployeeFormError("");

  const isActive = employeeIsActive?.checked ?? true;
  const useFixedDaily = isActive && (employeeFixedDaily?.checked ?? false);
  const primaryPositionId = isActive && employeePrimaryPosition?.value ? Number(employeePrimaryPosition.value) : null;
  const secondaryPositionId = isActive && employeeSecondaryPosition?.value ? Number(employeeSecondaryPosition.value) : null;
  const payload = {
    full_name: document.querySelector("#employee-full-name").value.trim(),
    department: isActive ? employeeDepartment.value : "",
    primary_position_id: primaryPositionId,
    secondary_position_id: secondaryPositionId,
    is_active: isActive,
    debt: asInt(document.querySelector("#employee-debt").value),
    salary: isActive && !useFixedDaily ? asInt(document.querySelector("#employee-salary").value) : 0,
    day_off: isActive && !useFixedDaily ? employeeDayOff.value : "",
    use_fixed_daily_salary: useFixedDaily,
    daily_salary: useFixedDaily ? asInt(document.querySelector("#employee-daily-salary").value) : 0,
  };

  const validationError = validateEmployeeFormPayload(payload);
  if (validationError) {
    setEmployeeFormError(validationError);
    return;
  }

  const submitButton = employeeForm.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  try {
    const result = await apiRequest("POST", "mobile/employees/create/", payload);
    showToast(`Сотрудник «${result.full_name || payload.full_name}» добавлен.`);
    employeeForm.reset();
    employeeIsActive.checked = true;
    employeeFixedDaily.checked = false;
    syncEmployeeFormVisibility();
    await loadBuhgalteria();
    try {
      const bootstrap = await invoke("login_and_bootstrap", { settings: currentSettings() });
      applyBootstrap(bootstrap);
    } catch (bootstrapError) {
      console.error(bootstrapError);
    }
  } catch (error) {
    setEmployeeFormError(String(error));
    showToast(String(error), true);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function initInlineEmployeeForm() {
  if (!employeeForm) return;
  employeeToggle?.addEventListener("click", () => {
    const willOpen = employeeBody.classList.contains("is-hidden");
    employeeBody.classList.toggle("is-hidden", !willOpen);
    employeeChevron?.classList.toggle("is-open", willOpen);
  });
  employeeIsActive?.addEventListener("change", syncEmployeeFormVisibility);
  employeeFixedDaily?.addEventListener("change", syncEmployeeFormVisibility);
  employeeForm.addEventListener("submit", saveEmployeeFromPage);
  syncEmployeeFormVisibility();
}

function applyBootstrap(bootstrap) {
  state.bootstrap = bootstrap;
  userChip.textContent = bootstrap.user?.display_name || bootstrap.user?.username || "";
  renderNavigation();
  fillMasterFilters(bootstrap.masters);
  fillDatalist(equipmentOptions, bootstrap.equipment_names);
  fillEmployeeChoices(bootstrap);
  if ((bootstrap.masters || []).length === 1) {
    masterSelect.value = bootstrap.masters[0].value;
  }
  const user = bootstrap.user || {};
  const canShop    = user.is_superuser || user.is_staff;
  const canOp      = hasPermission("records.add_collector") || hasPermission("records.delete_collector");
  const canAdmin   = hasPermission("auth.change_user");
  const canBuh     = Boolean(user.is_superuser);
  const canAudit   = hasPermission("records.view_auditlog");
  adminHelperOpen?.classList.toggle("is-hidden", !canShowAdminHelper(bootstrap));
  fileExchangeOpen?.classList.toggle("is-hidden", !canShowFileExchange(bootstrap));
  document.querySelector("#sd-shop")?.classList.toggle("is-hidden", !canShop);
  document.querySelector("#sd-operator")?.classList.toggle("is-hidden", !canOp);
  document.querySelector("#sd-admin")?.classList.toggle("is-hidden", !canAdmin);
  document.querySelector("#sd-timesheet")?.classList.toggle("is-hidden", !canBuh);
  document.querySelector("#sd-audit")?.classList.toggle("is-hidden", !canAudit);
  const canSeeSettings = true;
  settingsWrapper.classList.toggle("is-hidden", !canSeeSettings);
  if (canShowAdminHelper(bootstrap)) {
    refreshAdminHelperCatalog().catch(() => loadAdminHelperCache());
  } else {
    state.adminHelperFeatures = [];
  }
}

function hasPermission(permission) {
  const user = state.bootstrap?.user || {};
  return Boolean(user.is_superuser || (user.permissions || []).includes(permission));
}

function updateRecordTotal() {
  totalAmountEl.textContent = formatMoney(asInt(partsInput.value) + asInt(servicesInput.value));
  updateRecordSubmitState();
}


function getPhoneNationalDigits(value) {
  const rawValue = String(value || "").trim();
  let digits = String(value || "").replace(/\D/g, "");
  if (rawValue.startsWith("+7")) {
    digits = digits.slice(1);
  } else if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

function formatPhoneInputValue(value) {
  const digits = getPhoneNationalDigits(value);
  return digits ? `+7${digits}` : "+7";
}

function normalizeAmountField(input) {
  if (!input) return;
  let value = String(input.value || "").replace(/\D/g, "");
  value = value ? value.replace(/^0+(?=\d)/, "") : "0";
  input.value = value;
}

function validateRecordForm() {
  if (!recordForm) return "";
  const formData = new FormData(recordForm);
  const parts = asInt(partsInput.value);
  const services = asInt(servicesInput.value);
  return validateRecord(formData, parts, services);
}

function highlightRecordFields() {
  if (!recordForm) return;
  const formData = new FormData(recordForm);
  const parts    = asInt(partsInput.value);
  const services = asInt(servicesInput.value);

  const setInvalid = (el, invalid) => el?.classList.toggle("is-invalid", Boolean(invalid));

  const phone = getPhoneNationalDigits(String(formData.get("phone") || ""));
  setInvalid(newRecordPhoneInput, phone.length !== 10);
  setInvalid(titleInput,      !String(formData.get("title")      || "").trim());
  setInvalid(clientNameInput, !String(formData.get("clientName") || "").trim());
  setInvalid(masterSelect,    !String(formData.get("master")     || "").trim());
  setInvalid(commentsInput,   !String(formData.get("comments")   || "").trim());

  const pricesInvalid = !formData.get("freeRepair") && parts <= 0 && services <= 0;
  setInvalid(partsInput,    pricesInvalid);
  setInvalid(servicesInput, pricesInvalid);
}

function updateRecordSubmitState() {
  if (!submitRecordButton) return;
  const error = validateRecordForm();
  submitRecordButton.disabled = Boolean(error);
  submitRecordButton.title = error ? "Форма заполнена не полностью" : "";
  highlightRecordFields();
  if (error) console.debug(`[record-form] save blocked: ${error}`);
}

function showTableMessage(target, colspan, message) {
  target.innerHTML = "";
  const row = document.createElement("tr");
  row.className = "empty-row";
  row.innerHTML = `<td colspan="${colspan}">${message}</td>`;
  target.append(row);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return year && month && day ? `${day}.${month}.${year}` : dateString;
}

function formatDateTime(value) {
  if (!value) return "—";
  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone ? `+7${digits}` : "—";
  return `+7${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
}

function formatPaymentAmount(amount) {
  return Number(amount || 0) === 0 ? "По гарантии" : `${formatMoney(amount)} Р`;
}

function recordStableId(record) {
  return String(record.server_id || `L-${record.local_id}`);
}

function filterRecords() {
  const phone = phoneFilter.value.trim().replace(/\D/g, "");
  const master = masterFilter.value;
  const collected = collectedFilter.value;
  const startDate = startDateFilter.value;
  const endDate = endDateFilter.value;

  state.filteredRecords = state.records.filter((record) => {
    const recordPhone = String(record.phone || "");
    if (phone && !recordPhone.includes(phone)) return false;
    if (master && record.master !== master) return false;
    if (collected === "yes" && !record.collected) return false;
    if (collected === "no" && record.collected) return false;
    if (startDate && record.record_date < startDate) return false;
    if (endDate && record.record_date > endDate) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(state.filteredRecords.length / state.perPage));
  state.currentPage = Math.min(state.currentPage, totalPages);
  renderRecords();
}

function updateSelectionTotals() {
  const selected = state.records.filter((record) => state.selectedRecordIds.has(recordStableId(record)));
  const total = selected.reduce((sum, record) => sum + Number(record.total_amount || 0), 0);
  const master = selected.reduce((sum, record) => sum + Number(record.mast_50_5 || 0), 0);
  const parts = selected.reduce((sum, record) => sum + Number(record.parts || 0), 0);

  totalAmountSummary.textContent = total.toFixed(2);
  totalMasterSummary.textContent = master.toFixed(2);
  totalPartsSummary.textContent = parts.toFixed(2);
  selectedCountEl.textContent = String(selected.length);
  floatingTotalAmount.textContent = `${total.toFixed(2)} Р`;
  floatingMasterAmount.textContent = `${master.toFixed(2)} Р`;
  floatingPartsAmount.textContent = `${parts.toFixed(2)} Р`;
  floatingSelection.classList.toggle("is-visible", selected.length > 0);
}

function renderPagination(totalPages) {
  paginationSummary.textContent = `Страница ${state.currentPage} из ${totalPages} | Всего записей: ${state.filteredRecords.length}`;
  pageHeroMeta.textContent = `Страница ${state.currentPage} из ${totalPages}`;
  paginationControls.innerHTML = "";

  const addButton = (label, page, active = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pagination-btn${active ? " is-active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => {
      state.currentPage = page;
      renderRecords();
    });
    paginationControls.append(button);
  };

  if (state.currentPage > 1) addButton("Назад", state.currentPage - 1);
  const start = Math.max(1, state.currentPage - 2);
  const end = Math.min(totalPages, state.currentPage + 2);
  for (let page = start; page <= end; page += 1) {
    addButton(String(page), page, page === state.currentPage);
  }
  if (state.currentPage < totalPages) addButton("Вперёд", state.currentPage + 1);
}

function buildRecordActions(record) {
  const id = recordStableId(record);
  const notificationCount = Number(record.notification_count || 0);
  const tooltip = record.notification_tooltip || "Клиент не уведомлен";
  const notifyDisabled = Boolean(record.collected);
  const notifyTitle = notifyDisabled ? "Недоступно после выдачи" : tooltip;
  const collectedText = record.collected
    ? `Забрал ${formatDate(record.collected_date)}`
    : "Забрал";
  return `
    <div class="table-actions">
      <button type="button" class="btn-action btn-action-icon view-details" data-id="${id}" title="Подробнее"><svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path fill='currentColor' d='M13.586 2A2 2 0 0 1 15 2.586L19.414 7A2 2 0 0 1 20 8.414V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM12 4H6v16h12V10h-4.5A1.5 1.5 0 0 1 12 8.5zm0 8a3 3 0 0 1 2.708 4.293l.706.707A1 1 0 1 1 14 18.414l-.707-.706A3 3 0 1 1 12 12m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2m2-9.586V8h3.586z'/></svg></button>
      <button type="button" class="btn-action btn-action-icon edit-record" data-id="${id}" title="Изменить"><svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path fill='currentColor' d='M5 2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h3v-2H5V4h12v4h2V4a2 2 0 0 0-2-2zm3 5a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2zm7.949 3.811a3 3 0 0 1 4.242 4.243l-5.656 5.657a1 1 0 0 1-.707.293h-2.829a1 1 0 0 1-1-1v-2.829a1 1 0 0 1 .293-.707zm2.828 1.414a1 1 0 0 0-1.414 0l1.414 1.415a1 1 0 0 0 0-1.415m-1.414 2.829-1.414-1.414-3.95 3.95v1.414h1.414z'/></svg></button>
      <button type="button" class="btn-action btn-action-icon notify-client-btn ${notificationCount > 0 || record.client_notified ? "is-notified" : "is-pending"} ${notifyDisabled ? "is-disabled" : ""}" data-id="${id}" data-notification-tooltip="${escapeHtml(notifyTitle)}" aria-label="${escapeHtml(notifyTitle)}" title="${escapeHtml(notifyTitle)}" ${notifyDisabled ? "disabled aria-disabled=\"true\"" : ""}>
        <span class="notify-client-btn__bell">🔔</span>
        <span class="notify-client-btn__count ${notificationCount <= 0 ? "is-empty" : ""}">${notificationCount > 0 ? notificationCount : ""}</span>
      </button>
      <button type="button" class="btn-action btn-action-main ${record.collected ? "btn-collected" : "btn-collect"}" data-id="${id}" ${record.collected ? "disabled" : ""}>${collectedText}</button>
    </div>
  `;
}

function buildRecordPhoneCell(record) {
  const id = recordStableId(record);
  const phone = normalizeWhatsAppPhone(record.phone);
  const label = formatPhone(record.phone);
  if (shouldDisableClientContact(record)) {
    const title = record.collected ? "Недоступно после выдачи" : "Некорректный номер телефона";
    return `<span class="record-phone-link record-phone-link--disabled" aria-disabled="true" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
  }
  return `<a href="#" class="record-phone-link whatsapp-link" data-id="${id}" data-phone="${phone}" data-amount="${Number(record.total_amount || 0)}">${escapeHtml(label)}</a>`;
}

function renderRecordRows(targetBody, records, startIndex = 0) {
  targetBody.innerHTML = "";
  if (!records.length) {
    showTableMessage(targetBody, 8, "Записей не найдено");
    return;
  }
  records.forEach((record, index) => {
    const id = recordStableId(record);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" class="record-checkbox" data-id="${id}" ${state.selectedRecordIds.has(id) ? "checked" : ""}></td>
      <td>${startIndex + index + 1}</td>
      <td>${formatDate(record.record_date)}</td>
      <td class="text-truncate">${escapeHtml(record.title || "—")}</td>
      <td class="cell-nowrap">${buildRecordPhoneCell(record)}</td>
      <td class="record-total-amount">${formatPaymentAmount(record.total_amount)}</td>
      <td>${escapeHtml(record.master || "—")}</td>
      <td>${buildRecordActions(record)}</td>
    `;
    targetBody.append(row);
  });
}

function renderRecords() {
  const totalPages = Math.max(1, Math.ceil(state.filteredRecords.length / state.perPage));
  const start = (state.currentPage - 1) * state.perPage;
  const pageRecords = state.filteredRecords.slice(start, start + state.perPage);
  renderRecordRows(recordsBody, pageRecords, start);

  selectAllCheckbox.checked = pageRecords.length > 0 && pageRecords.every((record) => state.selectedRecordIds.has(recordStableId(record)));
  renderPagination(totalPages);
  updateSelectionTotals();
}

function renderHeaderSearchResults(query) {
  const rawQuery = String(query || "").trim();
  state.headerSearchQuery = rawQuery;
  const digits = rawQuery.replace(/\D/g, "");
  const results = digits
    ? state.records.filter((record) => String(record.phone || "").replace(/\D/g, "").includes(digits))
    : [];
  if (searchRecordsTitle) {
    searchRecordsTitle.textContent = results.length
      ? `Результаты поиска по номеру: ${rawQuery}`
      : (rawQuery ? `Ничего не найдено по номеру: ${rawQuery}` : "Ничего не найдено");
  }
  if (searchRecordsMeta) searchRecordsMeta.textContent = `${results.length} записей`;
  renderRecordRows(searchRecordsBody, results, 0);
  if (searchSelectAllCheckbox) {
    searchSelectAllCheckbox.checked = results.length > 0 && results.every((record) => state.selectedRecordIds.has(recordStableId(record)));
  }
  updateSelectionTotals();
}

function refreshActiveRecordList() {
  if (state.currentView === "records-search") {
    renderHeaderSearchResults(state.headerSearchQuery);
  } else {
    renderRecords();
  }
}

async function handleRecordTableClick(event) {
  const detailsButton = event.target.closest(".view-details");
  if (detailsButton) {
    const record = state.records.find((item) => recordStableId(item) === detailsButton.dataset.id);
    if (record) showRecordDetails(record);
    return;
  }

  const editButton = event.target.closest(".edit-record");
  if (editButton) {
    await requestEditPassword(editButton.dataset.id);
    return;
  }

  const notifyButton = event.target.closest(".notify-client-btn");
  if (notifyButton) {
    if (notifyButton.disabled || notifyButton.classList.contains("is-disabled")) return;
    const record = state.records.find((item) => recordStableId(item) === notifyButton.dataset.id);
    if (record && !record.collected) await notifyClient(record, "call");
    return;
  }

  const phoneLink = event.target.closest(".whatsapp-link");
  if (phoneLink) {
    event.preventDefault();
    const record = state.records.find((item) => recordStableId(item) === phoneLink.dataset.id);
    if (!record || record.collected) return;
    const opened = await openWhatsAppForRecord(record);
    if (opened) await notifyClient(record, "whatsapp");
    return;
  }

  const collectButton = event.target.closest(".btn-collect");
  if (collectButton) {
    try {
      await invoke("mark_record_collected", { recordKey: collectButton.dataset.id });
      auditInfo("record_collected_local", "Запись отмечена как забранная локально.", {
        record_key: collectButton.dataset.id,
        queued_for_sync: true,
      });
      await loadRecords();
      if (state.currentView === "records-search") renderHeaderSearchResults(state.headerSearchQuery);
      setStatus("Запись отмечена как 'Забрал' локально. Синхронизация пойдёт в фоне.");
      queueBackgroundSync("record-collected", "Запись отмечена как 'Забрал' и синхронизирована с сайтом.");
    } catch (error) {
      console.error(error);
      auditError("record_collected_failed", "Ошибка отметки записи как забранной.", {
        record_key: collectButton.dataset.id,
        error: String(error),
      });
      setStatus(`Не удалось отметить 'Забрал': ${error}`);
    }
  }
}

function handleRecordCheckboxChange(event) {
  if (!event.target.classList.contains("record-checkbox")) return;
  const id = event.target.dataset.id;
  if (event.target.checked) {
    state.selectedRecordIds.add(id);
  } else {
    state.selectedRecordIds.delete(id);
  }
  refreshActiveRecordList();
}

function showRecordDetails(record) {
  document.querySelector("#modal-title").value = record.title || "";
  document.querySelector("#modal-name").value = record.client_name || record.name || "";
  document.querySelector("#modal-phone").value = formatPhone(record.phone);
  document.querySelector("#modal-parts").value = formatMoney(record.parts);
  document.querySelector("#modal-services").value = formatMoney(record.master_only ? record.mast_50_5 : record.services);
  document.querySelector("#modal-master").value = record.master || "";
  document.querySelector("#modal-free-repair").checked = Boolean(record.free_repair);
  document.querySelector("#modal-master-only").checked = Boolean(record.master_only);
  document.querySelector("#modal-master-only-wrap")?.classList.toggle("is-hidden", !record.master_only);
  document.querySelector("#modal-discount-amount").textContent = formatMoney(record.discount_amount);
  document.querySelector("#modal-original-parts-amount").textContent = formatMoney(record.original_parts_amount);
  document.querySelector("#modal-original-shop-service-amount").textContent = formatMoney(record.original_shop_service_amount);
  document.querySelector("#modal-comments").value = record.comments || "";
  if (recordDetailsModal && recordDetailsModal.parentElement !== document.body) {
    document.body.append(recordDetailsModal);
  }
  if (recordDetailsModal.open) {
    recordDetailsModal.close();
  }
  recordDetailsModal.showModal();
}

function buildWhatsAppMessage(record) {
  const amount = Number(record.total_amount || 0);
  const paymentText = amount <= 0 ? "По гарантии" : `${formatMoney(amount)} руб.`;
  return `Ассаламу 1алайкум! Добрый день!
Ремонт Вашей техники завершён.
Сумма к оплате: ${paymentText}
Можете забирать в любое удобное время.

Рабочее время магазина: с 9:00 до 19:00, без выходных.
Контактный номер: +7 989 908-97-42`;
}

function buildWhatsAppUrl(record) {
  const message = buildWhatsAppMessage(record);
  return buildWhatsAppWebUrl(record.phone, message);
}

function buildWhatsAppDesktopRecordUrl(record) {
  const message = buildWhatsAppMessage(record);
  return buildWhatsAppDesktopUrl(record.phone, message);
}

function isWindowsPlatform() {
  const uaPlatform = navigator.userAgentData?.platform || navigator.platform || "";
  return /win/i.test(uaPlatform) || /windows/i.test(navigator.userAgent || "");
}

async function openWhatsAppForRecord(record) {
  const phone = normalizeWhatsAppPhone(record.phone);
  if (!phone) {
    setStatus("Некорректный номер телефона для WhatsApp.");
    return false;
  }
  if (record.collected) return false;

  const webUrl = buildWhatsAppUrl(record);
  if (!isWindowsPlatform()) {
    await window.__TAURI__.opener.openUrl(webUrl);
    auditInfo("whatsapp_open_web", "Открыт WhatsApp Web для клиента.", {
      record_key: recordStableId(record),
      phone,
    });
    return true;
  }

  const desktopUrl = buildWhatsAppDesktopRecordUrl(record);
  try {
    await window.__TAURI__.opener.openUrl(desktopUrl);
    auditInfo("whatsapp_open_desktop_attempt", "Попытка открыть WhatsApp Desktop через protocol handler.", {
      record_key: recordStableId(record),
      phone,
    });
    window.setTimeout(() => {
      if (!document.hasFocus()) return;
      window.__TAURI__.opener.openUrl(webUrl)
        .then(() => auditInfo("whatsapp_open_web_fallback", "Открыт WhatsApp Web после неудачной попытки WhatsApp Desktop.", {
          record_key: recordStableId(record),
          phone,
        }))
        .catch((error) => auditError("whatsapp_open_web_fallback_failed", "Не удалось открыть WhatsApp Web fallback.", {
          record_key: recordStableId(record),
          phone,
          error: String(error),
        }));
    }, 1200);
    return true;
  } catch (error) {
    auditWarning("whatsapp_open_desktop_failed", "WhatsApp Desktop не открылся, пробуем WhatsApp Web.", {
      record_key: recordStableId(record),
      phone,
      error: String(error),
    });
    await window.__TAURI__.opener.openUrl(webUrl);
    auditInfo("whatsapp_open_web_fallback", "Открыт WhatsApp Web fallback.", {
      record_key: recordStableId(record),
      phone,
    });
    return true;
  }
}

async function notifyClient(record, method = "call") {
  const settings = currentSettings();
  if (!settings.server_url || !settings.username || !settings.password) {
    setStatus("Для отметки уведомления нужен вход в аккаунт.");
    auditWarning("client_notify_blocked", "Уведомление клиента не отмечено: нет учётных данных.", {
      record_key: recordStableId(record),
      method,
    });
    return false;
  }
  try {
    await invoke("notify_record_client", {
      recordKey: recordStableId(record),
      method,
      settings,
    });
    await invoke("pull_records", { settings });
    await refreshAll();
    auditInfo("client_notify_success", "Уведомление клиента отмечено.", {
      record_key: recordStableId(record),
      method,
      notification_count: Number(record.notification_count || 0) + 1,
    });
    setStatus(method === "whatsapp" ? "WhatsApp открыт, уведомление клиента отмечено." : "Уведомление клиента отмечено.");
    return true;
  } catch (error) {
    console.error(error);
    auditError("client_notify_failed", "Ошибка отметки уведомления клиента.", {
      record_key: recordStableId(record),
      method,
      error: String(error),
    });
    setStatus(`Не удалось отметить уведомление клиента: ${error}`);
    return false;
  }
}

function logout() {
  auditInfo("logout", "Пользователь вышел из desktop-программы.");
  SyncService.stop();
  AssemblyOrderPoller.stop();
  state.bootstrap = null;
  state.records = [];
  state.filteredRecords = [];
  state.selectedRecordIds.clear();
  passwordInput.value = "";
  loginPasswordInput.value = "";
  appShell.classList.add("is-locked");
  loginScreen.classList.remove("is-hidden");
  loginStatus.textContent = "Вы вышли из аккаунта. Введите логин и пароль.";
  adminHelperOpen?.classList.add("is-hidden");
  fileExchangeOpen?.classList.add("is-hidden");
  settingsWrapper.classList.add("is-hidden");
  settingsDropdown.classList.add("is-hidden");
}

function updateEditTotal() {
  const isMasterOnly = document.querySelector("#edit-master-only")?.checked;
  const services = asInt(editServicesInput.value);
  const parts = asInt(editPartsInput.value);
  editTotalAmount.textContent = formatMoney(isMasterOnly ? Math.floor(services / 2) : parts + services);
}

function showEditRecord(record) {
  state.editingRecordKey = recordStableId(record);
  document.querySelector("#edit-title").value = record.title || "";
  document.querySelector("#edit-client-name").value = record.client_name || "";
  document.querySelector("#edit-phone").value = formatPhone(record.phone).replace(/-/g, "");
  editMasterSelect.value = record.master || "";
  editPartsInput.value = String(record.parts || 0);
  editServicesInput.value = String(record.services || 0);
  document.querySelector("#edit-comments").value = record.comments || "";
  document.querySelector("#edit-free-repair").checked = Boolean(record.free_repair);
  document.querySelector("#edit-master-only").checked = Boolean(record.master_only);
  updateEditTotal();
  recordEditModal.showModal();
}

function closeEditPasswordModal() {
  editPasswordInput.value = "";
  editPasswordError.classList.remove("is-visible");
  editPasswordModal.close();
}

async function requestEditPassword(recordKey) {
  state.pendingEditRecordKey = recordKey;
  editPasswordInput.value = "";
  editPasswordError.classList.remove("is-visible");
  editPasswordModal.showModal();
  window.setTimeout(() => editPasswordInput.focus(), 50);
}

async function confirmEditPassword(event) {
  event.preventDefault();
  const password = editPasswordInput.value.trim();
  if (!password) {
    editPasswordError.classList.add("is-visible");
    return;
  }

  try {
    const ok = await invoke("verify_operator_password", {
      settings: currentSettings(),
      password,
    });
    if (!ok) {
      editPasswordError.classList.add("is-visible");
      return;
    }
    const record = state.records.find((item) => recordStableId(item) === state.pendingEditRecordKey);
    closeEditPasswordModal();
    if (record) showEditRecord(record);
  } catch (error) {
    console.error(error);
    setStatus(`Не удалось проверить пароль: ${error}`);
  }
}

async function saveEditedRecord(event) {
  event.preventDefault();
  const formData = new FormData(editRecordForm);
  const parts = asInt(editPartsInput.value);
  const services = asInt(editServicesInput.value);
  const validationError = validateRecord(formData, parts, services);
  if (validationError) {
    setStatus(validationError);
    auditWarning("record_edit_validation_failed", "Изменения записи не сохранены: ошибка валидации.", {
      record_key: state.editingRecordKey,
      reason: validationError,
      parts,
      services,
    });
    return;
  }

  try {
    const payload = {
      record_key: state.editingRecordKey,
      title: String(formData.get("title") || "").trim(),
      client_name: String(formData.get("clientName") || "").trim(),
      phone: String(formData.get("phone") || "").replace(/\D/g, "").slice(-10),
      master: String(formData.get("master") || "").trim(),
      parts,
      services,
      comments: String(formData.get("comments") || "").trim(),
      free_repair: Boolean(formData.get("freeRepair")),
      master_only: Boolean(formData.get("masterOnly")),
      total_amount: Boolean(formData.get("masterOnly")) ? Math.floor(services / 2) : parts + services,
    };
    await invoke("update_record", {
      record: payload,
    });
    auditInfo("record_update_local", "Запись изменена локально и поставлена в очередь синхронизации.", {
      record_key: payload.record_key,
      total_amount: payload.total_amount,
      parts,
      services,
      master: payload.master,
      queued_for_sync: true,
    });
    recordEditModal.close();
    await loadRecords();
    setStatus("Изменения сохранены локально. Синхронизация пойдёт в фоне.");
    queueBackgroundSync("record-edit", "Изменения записи синхронизированы с сайтом.");
  } catch (error) {
    console.error(error);
    auditError("record_update_failed", "Ошибка сохранения изменений записи.", {
      record_key: state.editingRecordKey,
      error: String(error),
    });
    setStatus(`Не удалось сохранить изменения: ${error}`);
  }
}

async function loadRecords() {
  const rows = await invoke("list_records");
  const shouldApplyDefaultDate = !state.datesInitialized || !state.recordsFiltersDirty;
  state.records = rows;
  fillRecordMasterFilter();
  if (shouldApplyDefaultDate) {
    applyDefaultRecordsDate();
  }
  state.datesInitialized = true;
  state.pendingRecords = rows.filter((record) => record.sync_status !== "synced").length;
  updateSyncButton();
  filterRecords();
  if (state.currentView === "records-search") renderHeaderSearchResults(state.headerSearchQuery);
}

function groupAssemblies(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = row.collector_name || "Без имени";
    if (!grouped.has(key)) {
      grouped.set(key, { name: key, total: 0, count: 0, rows: [] });
    }
    const item = grouped.get(key);
    item.total += Number(row.amount || 0);
    item.count += Number(row.assembly_count || 0);
    item.rows.push(row);
  }
  return Array.from(grouped.values());
}

function assemblyOrderStatusLabel(status) {
  return {
    assembly: "Сборка",
    in_progress: "В работе",
    done: "Сделано",
    out_of_stock: "Нет в наличии",
  }[status] || status;
}

function collectorNames() {
  return (state.bootstrap?.collectors || []).map((item) => item.value || item.label || item);
}

function splitAssemblyOrders() {
  const active = state.assemblyOrders.filter((order) => !order.is_done);
  const done = state.assemblyOrders.filter((order) => order.status === "done");
  const outOfStock = state.assemblyOrders.filter((order) => order.status === "out_of_stock");
  return { active, done, outOfStock };
}

function renderAssemblyOrderRows(orders, section, startIndex = 1) {
  const collectors = collectorNames();
  return orders.map((order, index) => {
    const number = section === "active" ? startIndex + index : "—";
    const collector = order.assigned_collector_name
      ? `<span class="assembly-order-collector">${escapeHtml(order.assigned_collector_name)}</span>`
      : `<span class="assembly-order-collector-empty">—</span>`;
    const urgency = order.is_urgent ? `<span class="assembly-order-urgent">Срочно</span>` : "Обычный";
    let actionHtml = "";
    if (section === "active") {
      const assignMenu = collectors.length
        ? `<span class="assembly-order-assign-menu">${collectors.map((name) => `<button type="button" class="assembly-order-collector-option" data-order-action="assign" data-order-id="${order.local_id}" data-collector-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("")}</span>`
        : "";
      const advanceButton = order.status === "assembly"
        ? `<span class="assembly-order-assign"><button type="button" class="btn-status-assembly" data-order-action="advance" data-order-id="${order.local_id}">Сборка</button>${assignMenu}</span>`
        : `<button type="button" class="btn-status-in-progress" data-order-action="advance" data-order-id="${order.local_id}">В работе</button>`;
      actionHtml = `<div class="assembly-order-actions-inline">${advanceButton}<button type="button" class="btn-status-out-of-stock" data-order-action="out_of_stock" data-order-id="${order.local_id}">Нет в наличии</button></div>`;
    } else {
      const cls = order.status === "out_of_stock" ? " assembly-order-status-out-of-stock" : "";
      actionHtml = `<span class="assembly-order-status${cls}">${assemblyOrderStatusLabel(order.status)}</span>`;
    }
    return `
      <tr class="${section === "active" ? "" : "assembly-order-row-done"}">
        <td class="assembly-order-number">${number}</td>
        <td>${escapeHtml(order.name)}</td>
        <td>${collector}</td>
        <td>${urgency}</td>
        <td>${formatDateTime(order.created_at)}</td>
        <td class="text-center">${actionHtml}</td>
      </tr>
    `;
  }).join("");
}

function renderAssemblyOrderSection(label, orders, section) {
  if (!orders.length) return "";
  return `
    <div class="assembly-order-section-label ${section === "active" ? "is-active" : ""}">${label} &nbsp;(${orders.length})</div>
    <table class="records-site-table assembly-order-table">
      <thead>
        <tr>
          <th class="assembly-order-number">№</th>
          <th>Название</th>
          <th>Сборщик</th>
          <th>Срочно</th>
          <th>Дата создания</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${renderAssemblyOrderRows(orders, section)}</tbody>
    </table>
  `;
}

function renderAssemblyOrders(target) {
  if (!target) return;
  const { active, done, outOfStock } = splitAssemblyOrders();
  if (!active.length && !done.length && !outOfStock.length) {
    target.innerHTML = `<div class="assembly-order-empty">Активных заказов сборки нет.</div>`;
    return;
  }
  target.innerHTML = [
    renderAssemblyOrderSection("Активные", active, "active"),
    renderAssemblyOrderSection("Выполнено", done, "done"),
    renderAssemblyOrderSection("Нет в наличии", outOfStock, "out_of_stock"),
  ].join("");
}

async function loadAssemblyOrders() {
  state.assemblyOrders = await invoke("list_assembly_orders");
  renderAssemblyOrders(assemblyOrderCreateList);
  renderAssemblyOrders(assemblyOrdersList);
  if (state.currentView === "assembly") {
    await loadAssemblies();
  }
}

async function createAssemblyOrder(event) {
  event.preventDefault();
  const name = assemblyOrderName.value.trim();
  const quantity = Number.parseInt(assemblyOrderQuantity.value || "1", 10);
  try {
    const created = await invoke("create_assembly_orders", {
      order: { name, quantity, is_urgent: assemblyOrderUrgent.checked },
    });
    assemblyOrderForm.reset();
    assemblyOrderQuantity.value = "1";
    assemblyOrderCreateStatus.textContent = `Создано заказов: ${created}.`;
    auditInfo("assembly_order_create_local", "Заказ сборки создан локально и поставлен в очередь синхронизации.", {
      name,
      quantity,
      is_urgent: assemblyOrderUrgent.checked,
      created_count: created,
      queued_for_sync: true,
    });
    await loadAssemblyOrders();
    await refreshPendingSyncSummary();
    queueBackgroundSync("assembly-order-create", "Заказ сборки синхронизирован с сайтом.");
  } catch (error) {
    console.error(error);
    auditError("assembly_order_create_failed", "Ошибка создания заказа сборки.", {
      name,
      quantity,
      is_urgent: assemblyOrderUrgent.checked,
      error: String(error),
    });
    assemblyOrderCreateStatus.textContent = String(error);
  }
}

async function changeAssemblyOrder(orderId, action, collectorName = "") {
  try {
    await invoke("update_assembly_order_status", {
      orderId: Number(orderId),
      action,
      collectorName: collectorName || null,
    });
    auditInfo("assembly_order_update_local", "Статус заказа сборки изменён локально.", {
      local_id: Number(orderId),
      action,
      collector_name: collectorName || "",
      queued_for_sync: true,
    });
    await loadAssemblyOrders();
    await refreshPendingSyncSummary();
    queueBackgroundSync("assembly-order-update", "Изменения заказа синхронизированы с сайтом.");
  } catch (error) {
    auditError("assembly_order_update_failed", "Ошибка изменения заказа сборки.", {
      local_id: Number(orderId),
      action,
      collector_name: collectorName || "",
      error: String(error),
    });
    throw error;
  }
}

async function loadAssemblies() {
  state.assemblyOrders = await invoke("list_assembly_orders");
  const allRows = await invoke("list_assemblies");
  const rows = allRows.filter((row) => row.entry_date === todayIsoDate());
  state.pendingAssemblies = allRows.filter((row) => row.sync_status !== "synced").length;
  updateSyncButton();
  const query = assemblySearch.value.trim().toLowerCase();
  const grouped = new Map(groupAssemblies(rows).map((item) => [item.name, item]));
  const collectors = collectorNames();
  const knownCollectorNames = new Set(collectors);
  const extraCollectorNames = Array.from(grouped.keys()).filter((name) => !knownCollectorNames.has(name));
  const groups = [...collectors, ...extraCollectorNames]
    .map((name) => grouped.get(name) || { name, total: 0, count: 0, rows: [] })
    .filter((item) => item.name.toLowerCase().includes(query));
  assemblyList.innerHTML = "";

  if (!groups.length) {
    assemblyList.innerHTML = `<div class="site-card empty-assembly">${query ? "По запросу никого не найдено." : "Нет активных сборщиков."}</div>`;
    if (assemblyFilterStatus) assemblyFilterStatus.textContent = "";
    return;
  }

  if (assemblyFilterStatus) {
    const totalCollectors = collectors.length + extraCollectorNames.length;
    assemblyFilterStatus.textContent = query ? `Показано ${groups.length} из ${totalCollectors}` : "";
  }

  for (const group of groups) {
    const card = document.createElement("article");
    card.className = "assembly-card";
    card.dataset.collectorName = group.name.toLowerCase();
    const inputId = `assembly-amount-${Math.random().toString(36).slice(2)}`;
    const pendingOrders = state.assemblyOrders.filter((order) => (
      order.status === "in_progress" &&
      !order.is_done &&
      order.assigned_collector_name === group.name
    ));
    const orderOptions = pendingOrders.length
      ? `${pendingOrders.map((order) => `<option value="${order.local_id}">${escapeHtml(order.name)}</option>`).join("")}<option value="">Без заказа</option>`
      : `<option value="">Без заказа</option>`;
    const chips = group.rows
      .map((row) => `<span class="assembly-chip" id="assembly-chip-${row.local_id}">${formatMoney(row.amount)} ₽ <button type="button" class="assembly-chip-delete" data-assembly-entry-id="${row.local_id}" title="Удалить">×</button></span>`)
      .join("");
    card.innerHTML = `
      <div class="assembly-card-top">
        <strong>${escapeHtml(group.name)}</strong>
        <div class="assembly-totals">
          <span class="assembly-total-label">Итого:</span>
          <span class="assembly-total ${group.total ? "" : "is-zero"}">${formatMoney(group.total)} ₽</span>
          <span class="assembly-count ${group.count ? "" : "is-zero"}">${group.count} шт</span>
        </div>
      </div>
      <div class="assembly-history">${chips}</div>
      <div class="assembly-input-row">
        <div class="assembly-input-wrap">
          <input id="${inputId}" class="assembly-amount-input" type="number" min="1" step="100" value="0" placeholder="Сумма сборки" />
          <span class="assembly-input-suffix">₽</span>
        </div>
        <div class="assembly-quick-buttons">
          <button type="button" data-assembly-quick="${inputId}" data-amount="150">150</button>
          <button type="button" data-assembly-quick="${inputId}" data-amount="200">200</button>
          <button type="button" data-assembly-quick="${inputId}" data-amount="300">300</button>
        </div>
        <select class="assembly-order-select" aria-label="Заказ сборки">
          ${orderOptions}
        </select>
        <button class="assembly-button" type="button" data-assembly-add="${inputId}" data-collector-name="${escapeHtml(group.name)}">+ Сборка</button>
      </div>
    `;
    assemblyList.append(card);
  }
}

async function saveAssemblyForCollector(collectorName, amountInput, button) {
  const amount = asInt(amountInput.value);
  const orderSelect = button.closest(".assembly-input-row")?.querySelector(".assembly-order-select");
  const assemblyOrderId = orderSelect?.value ? Number(orderSelect.value) : null;
  if (!collectorName || !amount) {
    setStatus("Укажите сумму сборки.");
    amountInput.focus();
    return;
  }

  button.disabled = true;
  try {
    const syncUuid = crypto.randomUUID();
    await invoke("save_assembly", {
      assembly: {
        sync_uuid: syncUuid,
        entry_date: todayIsoDate(),
        collector_name: collectorName,
        amount,
        assembly_count: 1,
        assembly_order_id: assemblyOrderId,
      },
    });
    auditInfo("assembly_create_local", "Сборка сохранена локально и поставлена в очередь синхронизации.", {
      sync_uuid: syncUuid,
      collector_name: collectorName,
      amount,
      assembly_count: 1,
      assembly_order_id: assemblyOrderId,
      queued_for_sync: true,
    });
    amountInput.value = "0";
    await loadAssemblies();
    await refreshPendingSyncSummary();
  } catch (error) {
    console.error(error);
    auditError("assembly_create_failed", "Ошибка сохранения сборки.", {
      collector_name: collectorName,
      amount,
      assembly_order_id: assemblyOrderId,
      error: String(error),
    });
    setStatus(`Ошибка сохранения сборки: ${error}`);
  } finally {
    button.disabled = false;
  }
}

async function deleteAssemblyEntry(localId) {
  await invoke("delete_assembly_entry", { localId: Number(localId), settings: currentSettings() });
  auditInfo("assembly_delete_local", "Сборка удалена локально.", { local_id: Number(localId), queued_for_sync: true });
  loadAssemblies(); // без await — список обновляется в фоне
}

function advanceDateLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return formatDate(dateString);
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function readAdvanceEmployeeCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem("advanceEmployees") || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function uniqueSortedNames(names) {
  return Array.from(new Set(
    names
      .map((name) => String(name || "").trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, "ru"));
}

function advanceEmployeeNames() {
  const cached = readAdvanceEmployeeCache();
  const bootstrapNames = [
    ...(state.bootstrap?.collectors || []).map((item) => item.value || item.label || item),
    ...(state.bootstrap?.masters || []).map((item) => item.value || item.label || item),
  ];
  const historyNames = (state.employeeAdvances || []).map((item) => item.employee_name);
  return uniqueSortedNames([...cached, ...bootstrapNames, ...historyNames]);
}

function canIssueEmployeeDebt() {
  return hasPermission("records.add_employeedebtpayment");
}

async function refreshAdvanceEmployeeCache() {
  if (!state.network.online || !getToken()) return;
  try {
    const employees = await apiRequest("GET", "mobile/employees/");
    const names = uniqueSortedNames((employees || []).map((item) => item.full_name || item.employee_name || item.name));
    if (!names.length) return;
    localStorage.setItem("advanceEmployees", JSON.stringify(names));
    if (state.currentView === "advances") renderAdvances();
  } catch (error) {
    console.info("[advances] employee cache refresh skipped", error);
  }
}

function fillAdvanceDebtSelects(employees) {
  const issueSelect = document.querySelector("#adv-debt-issue-emp");
  const returnSelect = document.querySelector("#adv-debt-return-emp");
  if (!issueSelect || !returnSelect) return;

  issueSelect.innerHTML = `<option value="">— выберите —</option>`;
  returnSelect.innerHTML = `<option value="">— выберите —</option>`;
  for (const emp of employees || []) {
    const label = `${emp.full_name}${Number(emp.debt || 0) ? ` · долг ${formatMoney(emp.debt)} ₽` : ""}`;
    const issueOption = document.createElement("option");
    issueOption.value = emp.id;
    issueOption.textContent = label;
    issueSelect.append(issueOption);

    const returnOption = document.createElement("option");
    returnOption.value = emp.id;
    returnOption.textContent = label;
    returnOption.dataset.debt = emp.debt || 0;
    returnOption.disabled = Number(emp.debt || 0) <= 0;
    returnSelect.append(returnOption);
  }
}

async function loadAdvanceDebtPanels() {
  if (!advancesDebtPanels) return;
  const allowed = canIssueEmployeeDebt();
  advancesDebtPanels.classList.toggle("is-hidden", !allowed);
  if (!allowed || !state.network.online || !getToken()) return;
  try {
    const data = await apiRequest("GET", "mobile/employees/debt/");
    fillAdvanceDebtSelects(data.employees || []);
  } catch (error) {
    console.info("[advances] debt panels unavailable", error);
  }
}

function groupTodayAdvances() {
  const today = todayIsoDate();
  const grouped = new Map();
  for (const row of state.employeeAdvances || []) {
    if (row.advance_date !== today) continue;
    const name = row.employee_name || "";
    if (!grouped.has(name)) grouped.set(name, { total: 0, rows: [] });
    const group = grouped.get(name);
    group.total += Number(row.amount || 0);
    group.rows.push(row);
  }
  return grouped;
}

function renderAdvances() {
  if (!advancesList) return;
  const query = (advancesSearch?.value || "").trim().toLowerCase();
  const grouped = groupTodayAdvances();
  const names = advanceEmployeeNames();
  const groups = names
    .map((name) => ({ name, ...(grouped.get(name) || { total: 0, rows: [] }) }))
    .filter((item) => item.name.toLowerCase().includes(query));

  if (advancesDate) advancesDate.textContent = advanceDateLabel(todayIsoDate());
  if (advancesFilterStatus) {
    advancesFilterStatus.textContent = query ? `Показано ${groups.length} из ${names.length}` : "";
  }
  if (advancesFilterEmpty) {
    advancesFilterEmpty.style.display = groups.length ? "none" : "block";
    advancesFilterEmpty.textContent = names.length ? "По запросу сотрудников не найдено." : "Нет активных сотрудников.";
  }

  const balanceMap = new Map(
    (state.employeesBalance || []).map((b) => [b.full_name, b])
  );

  advancesList.innerHTML = groups.map((group, index) => {
    const inputId = `advance-input-${index}`;
    const chips = group.rows.map((row) => `
      <span class="adv-chip">
        ${formatMoney(row.amount)} ₽
        <button type="button" class="adv-chip-delete" data-advance-id="${row.local_id}" title="Удалить аванс">×</button>
      </span>
    `).join("");

    const bal = balanceMap.get(group.name);
    let limitBanner = "";
    if (bal) {
      if (bal.advance_status === "positive") {
        limitBanner = `<div class="adv-limit-banner adv-limit-ok">💡 В день может взять аванс: ${formatMoney(bal.daily_limit)} ₽</div>`;
      } else if (bal.advance_status === "negative") {
        limitBanner = `<div class="adv-limit-banner adv-limit-blocked">⚠ Аванс выдавать нельзя — сотрудник в минусе</div>`;
      }
    }

    return `
      <article class="adv-card" data-employee-name="${escapeHtml(group.name)}">
        <div class="adv-card-top">
          <div class="adv-name">${escapeHtml(group.name)}</div>
          <div class="adv-total-wrap">
            <span class="adv-total-label">Итого:</span>
            <span class="adv-total-value ${group.total ? "" : "is-zero"}">${formatMoney(group.total)} ₽</span>
          </div>
        </div>
        ${limitBanner}
        <div class="adv-history">${chips}</div>
        <div class="adv-input-row">
          <div class="adv-input-wrap">
            <input id="${inputId}" class="adv-input" type="number" min="1" step="100" placeholder="Сумма аванса" />
            <span class="adv-input-suffix">₽</span>
          </div>
          <div class="adv-quick-btns">
            <button type="button" class="adv-quick-btn" data-advance-quick="${inputId}" data-amount="500">500</button>
            <button type="button" class="adv-quick-btn" data-advance-quick="${inputId}" data-amount="1000">1 000</button>
          </div>
          <button type="button" class="adv-add-btn" data-advance-add="${inputId}" data-employee-name="${escapeHtml(group.name)}">+ Записать</button>
        </div>
      </article>
    `;
  }).join("");
}

async function refreshTodayAdvancesFromSite() {
  if (!hasSyncCredentials()) return false;
  const online = state.network.online || await runHealthCheck("advances-open");
  if (!online) return false;
  await invoke("pull_all_today", { settings: currentSettings() });
  return true;
}

async function loadAdvancesView() {
  const today = todayIsoDate();
  if (advancesDate) advancesDate.textContent = advanceDateLabel(today);
  const t0 = performance.now();
  try {
    try {
      await refreshTodayAdvancesFromSite();
    } catch (syncError) {
      console.warn("[advances] server refresh skipped", syncError);
    }
    state.employeeAdvances = await invoke("list_employee_advances", { date: today });
    console.debug(`[advances] loaded ${state.employeeAdvances.length} rows for ${today} in ${Math.round(performance.now() - t0)}ms (local DB only)`);
    // Загружаем балансы сотрудников с сервера (лимиты авансов)
    if (hasSyncCredentials()) {
      try {
        const balData = await apiRequest("GET", `mobile/advances/?date=${today}`);
        state.employeesBalance = balData.employees_balance || [];
      } catch (balErr) {
        console.warn("[advances] balance fetch skipped:", balErr);
        state.employeesBalance = [];
      }
    }
    renderAdvances();
    refreshAdvanceEmployeeCache();
    loadAdvanceDebtPanels();
  } catch (error) {
    console.error(error);
    setStatus(`Не удалось открыть авансы: ${error}`);
  }
}

async function saveAdvanceForEmployee(employeeName, input, button) {
  const amount = asInt(input.value);
  if (!employeeName || !amount) {
    setStatus("Укажите сумму аванса.");
    input.focus();
    return;
  }

  button.disabled = true;
  try {
    const advanceDate = todayIsoDate();
    await invoke("save_employee_advance", {
      employeeName,
      amount,
      advanceDate,
    });
    auditInfo("advance_create_local", "Аванс сохранён локально и поставлен в очередь синхронизации.", {
      employee_name: employeeName,
      amount,
      advance_date: advanceDate,
      queued_for_sync: true,
    });
    input.value = "";
    state.employeeAdvances = await invoke("list_employee_advances", { date: advanceDate });
    renderAdvances();
    await refreshPendingSyncSummary();
    setStatus("Аванс сохранён локально.");
    queueBackgroundSync("advance-save", "Аванс синхронизирован с сайтом.");
  } catch (error) {
    console.error(error);
    auditError("advance_create_failed", "Ошибка сохранения аванса.", {
      employee_name: employeeName,
      amount,
      error: String(error),
    });
    setStatus(`Ошибка сохранения аванса: ${error}`);
  } finally {
    button.disabled = false;
  }
}

function initAdvanceDebtPanels() {
  const issueForm = document.querySelector("#adv-debt-issue-form");
  const returnForm = document.querySelector("#adv-debt-return-form");

  issueForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const resultEl = document.querySelector("#adv-debt-issue-result");
    resultEl.textContent = "";
    resultEl.className = "debt-panel__result";
    const employeeId = parseInt(document.querySelector("#adv-debt-issue-emp").value, 10);
    const amount = parseInt(document.querySelector("#adv-debt-issue-amount").value, 10);
    const comment = document.querySelector("#adv-debt-issue-comment").value.trim();
    if (!employeeId || !amount || amount <= 0) return;
    try {
      const data = await apiRequest("POST", "mobile/employees/debt/", { action_type: "issue_debt", employee_id: employeeId, amount, comment });
      showToast(data.message);
      issueForm.reset();
      document.querySelector("#adv-debt-issue-panel").open = false;
      await loadAdvanceDebtPanels();
    } catch (error) {
      resultEl.textContent = String(error);
      resultEl.classList.add("is-error");
    }
  });

  returnForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const resultEl = document.querySelector("#adv-debt-return-result");
    resultEl.textContent = "";
    resultEl.className = "debt-panel__result";
    const empSelect = document.querySelector("#adv-debt-return-emp");
    const employeeId = parseInt(empSelect.value, 10);
    const amount = parseInt(document.querySelector("#adv-debt-return-amount").value, 10);
    const comment = document.querySelector("#adv-debt-return-comment").value.trim();
    if (!employeeId || !amount || amount <= 0) return;
    const currentDebt = parseInt(empSelect.selectedOptions[0]?.dataset.debt || "0", 10);
    if (currentDebt > 0 && amount > currentDebt) {
      resultEl.textContent = `Нельзя вернуть больше долга (${currentDebt} ₽)`;
      resultEl.classList.add("is-error");
      return;
    }
    try {
      const data = await apiRequest("POST", "mobile/employees/debt/", { action_type: "debt_payment", employee_id: employeeId, amount, comment });
      showToast(data.message);
      returnForm.reset();
      document.querySelector("#adv-debt-return-panel").open = false;
      await loadAdvanceDebtPanels();
    } catch (error) {
      resultEl.textContent = String(error);
      resultEl.classList.add("is-error");
    }
  });
}

async function deleteAdvance(localId) {
  await invoke("delete_employee_advance", { localId: Number(localId), settings: currentSettings() });
  auditInfo("advance_delete_local", "Аванс удалён локально.", { local_id: Number(localId), queued_for_sync: true });
  state.employeeAdvances = await invoke("list_employee_advances", { date: todayIsoDate() });
  renderAdvances();
  setStatus("Аванс удалён локально.");
}

function monthValue(dateString) {
  return String(dateString || todayIsoDate()).slice(0, 7);
}

function dayOffMatches(dayOff, dateString) {
  const map = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };
  if (!dayOff || !(dayOff in map)) return false;
  const date = new Date(`${dateString}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.getDay() === map[dayOff];
}

function dailyEntryFor(employee) {
  return employee.entry || {};
}

function dailyStatusFor(employee) {
  const entry = dailyEntryFor(employee);
  if (entry.status) return entry.status;
  if (employee.default_status) return employee.default_status;
  return dayOffMatches(employee.day_off, state.dailyTimesheet.date) ? "weekend" : "present";
}

function dailyAdvanceFor(employee) {
  const entry = dailyEntryFor(employee);
  if (entry.id) return Number(entry.advance || 0);
  const employeeName = employee.employee_name || employee.full_name || "";
  const localAdvance = (state.employeeAdvances || [])
    .filter((item) => item.advance_date === state.dailyTimesheet.date && item.employee_name === employeeName)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return localAdvance;
}

function normName(str) {
  return String(str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildSalaryByName(data) {
  const map = {};
  for (const m of data?.masters || []) {
    const key = normName(m.name);
    if (key) map[key] = (map[key] || 0) + Number(m.earned || 0);
  }
  for (const a of data?.assemblers || []) {
    const key = normName(a.name);
    if (key) map[key] = (map[key] || 0) + Number(a.earned || 0);
  }
  return map;
}

function dailySideJobFor(employee) {
  const entry = dailyEntryFor(employee);
  if (entry.id && Number(entry.side_job || 0) > 0) return Number(entry.side_job);
  const key = normName(employee.employee_name || employee.full_name || "");
  return state.dailyTimesheet.salaryByName?.[key] || 0;
}

function dailyLateCount(employee) {
  const employeeId = Number(employee.employee_id || employee.id);
  return (state.dailyTimesheet.monthEntries || []).filter((entry) => (
    Number(entry.employee || entry.employee_id) === employeeId &&
    entry.is_late &&
    entry.entry_date !== state.dailyTimesheet.date
  )).length + (dailyEntryFor(employee).is_late ? 1 : 0);
}

function renderDailyTimesheet() {
  if (!dailyTimesheetBody) return;
  const employees = state.dailyTimesheet.employees || [];
  dailyTimesheetDateInput.value = state.dailyTimesheet.date || todayIsoDate();
  dailyTimesheetDateInput.max = todayIsoDate();
  dailyTimesheetCurrentDate.textContent = formatDate(state.dailyTimesheet.date);

  if (!employees.length) {
    dailyTimesheetBody.innerHTML = `<tr class="empty-row"><td colspan="6">Табель пока не заполнен. Сначала добавьте сотрудников.</td></tr>`;
    return;
  }

  dailyTimesheetBody.innerHTML = employees.map((employee) => {
    const id = employee.employee_id || employee.id;
    const name = employee.employee_name || employee.full_name || "—";
    const positions = employee.positions || "";
    const status = dailyStatusFor(employee);
    const entry = dailyEntryFor(employee);
    const isLate = Boolean(entry.is_late);
    const lateCount = dailyLateCount(employee);
    const advance = dailyAdvanceFor(employee);
    const sideJob = dailySideJobFor(employee);
    const note = entry.note || "";
    return `
      <tr data-employee-id="${id}" data-employee-name="${escapeHtml(name)}">
        <td>
          <div class="daily-timesheet-name">${escapeHtml(name)}</div>
          ${positions ? `<div class="daily-timesheet-role">${escapeHtml(positions)}</div>` : ""}
        </td>
        <td data-label="Статус">
          <div class="daily-timesheet-toggle">
            <input id="status_present_${id}" type="radio" name="status_${id}" value="present" ${status === "present" ? "checked" : ""}>
            <label class="daily-timesheet-option present" for="status_present_${id}">✓</label>
            <input id="status_weekend_${id}" type="radio" name="status_${id}" value="weekend" ${status === "weekend" ? "checked" : ""}>
            <label class="daily-timesheet-option weekend" for="status_weekend_${id}">В</label>
          </div>
        </td>
        <td data-label="Опоздание">
          <button type="button" class="btn-late-toggle ${isLate ? "is-active" : ""}" data-late-toggle="${id}" ${status !== "present" ? "disabled" : ""} title="${lateCount >= 3 ? `Опоздание #${lateCount + 1} — штраф 300 р.` : `Опоздание (${lateCount}/3 без штрафа)`}">
            Опоздание
            <span class="late-badge">${lateCount}</span>
          </button>
        </td>
        <td data-label="Аванс">
          <div class="daily-money-input">
            <input class="daily-money-field js-daily-money" data-kind="advance" inputmode="numeric" value="${advance || 0}" autocomplete="off">
            <span>₽</span>
          </div>
        </td>
        <td data-label="Подработка">
          <div class="daily-money-input">
            <input class="daily-money-field js-daily-money" data-kind="side_job" inputmode="numeric" value="${sideJob || 0}" autocomplete="off">
            <span>₽</span>
          </div>
        </td>
        <td data-label="Комментарий">
          <input class="daily-note-input" value="${escapeHtml(note)}" placeholder="Комментарий">
        </td>
      </tr>
    `;
  }).join("");
}

async function loadDailyTimesheetView() {
  const selectedDate = dailyTimesheetDateInput?.value || state.dailyTimesheet.date || todayIsoDate();
  state.dailyTimesheet.date = selectedDate;
  const hasCached = state.dailyTimesheet.employees.length > 0 && state.dailyTimesheet._cachedDate === selectedDate;
  if (hasCached) {
    renderDailyTimesheet();
    Promise.all([
      apiRequest("GET", `mobile/timesheet/daily/?date=${selectedDate}`),
      apiRequest("GET", `mobile/timesheet/monthly/?month=${monthValue(selectedDate)}`),
      invoke("list_employee_advances", { date: selectedDate }),
      apiRequest("GET", `mobile/salary/?date=${selectedDate}`).catch(() => ({})),
    ]).then(([dayData, monthData, localAdvances, salaryData]) => {
      state.dailyTimesheet.date = dayData.date || selectedDate;
      state.dailyTimesheet._cachedDate = dayData.date || selectedDate;
      state.dailyTimesheet.employees = dayData.employees || [];
      state.dailyTimesheet.monthEntries = monthData.entries || [];
      state.dailyTimesheet.salaryByName = buildSalaryByName(salaryData);
      state.employeeAdvances = localAdvances || [];
      renderDailyTimesheet();
      setAdminStatus(dailyTimesheetStatus, "");
    }).catch(() => {});
    return;
  }
  setAdminStatus(dailyTimesheetStatus, "Загружаю табель...");
  const t0Timesheet = performance.now();
  try {
    const [dayData, monthData, localAdvances, salaryData] = await Promise.all([
      apiRequest("GET", `mobile/timesheet/daily/?date=${selectedDate}`),
      apiRequest("GET", `mobile/timesheet/monthly/?month=${monthValue(selectedDate)}`),
      invoke("list_employee_advances", { date: selectedDate }),
      apiRequest("GET", `mobile/salary/?date=${selectedDate}`).catch(() => ({})),
    ]);
    console.debug(`[timesheet] loaded for ${selectedDate}: ${(dayData.employees||[]).length} employees, ${localAdvances.length} local advances in ${Math.round(performance.now() - t0Timesheet)}ms`);
    state.dailyTimesheet.date = dayData.date || selectedDate;
    state.dailyTimesheet._cachedDate = dayData.date || selectedDate;
    state.dailyTimesheet.employees = dayData.employees || [];
    state.dailyTimesheet.monthEntries = monthData.entries || [];
    state.dailyTimesheet.salaryByName = buildSalaryByName(salaryData);
    state.employeeAdvances = localAdvances || [];
    renderDailyTimesheet();
    setAdminStatus(dailyTimesheetStatus, "");
  } catch (error) {
    console.error(error);
    setAdminStatus(dailyTimesheetStatus, `Ошибка загрузки табеля: ${error}`, true);
  }
}

function normalizeDailyMoneyInput(input) {
  const value = String(input.value || "").replace(/\D/g, "");
  input.value = value ? String(parseInt(value, 10)) : "0";
}

function syncDailyLateButton(row) {
  const present = row.querySelector(`input[value="present"]`)?.checked;
  const button = row.querySelector(".btn-late-toggle");
  if (!button) return;
  button.disabled = !present;
  if (!present) button.classList.remove("is-active");
}

function collectDailyTimesheetRows() {
  return Array.from(dailyTimesheetBody.querySelectorAll("tr[data-employee-id]")).map((row) => {
    const employeeId = Number(row.dataset.employeeId);
    const status = row.querySelector(`input[name="status_${employeeId}"]:checked`)?.value || "present";
    return {
      employee_id: employeeId,
      status,
      advance: asInt(row.querySelector('[data-kind="advance"]')?.value),
      side_job: asInt(row.querySelector('[data-kind="side_job"]')?.value),
      is_late: row.querySelector(".btn-late-toggle")?.classList.contains("is-active") || false,
      note: row.querySelector(".daily-note-input")?.value.trim() || "",
    };
  });
}

async function saveDailyTimesheet(event) {
  event.preventDefault();
  dailyTimesheetBody.querySelectorAll(".js-daily-money").forEach(normalizeDailyMoneyInput);
  const rows = collectDailyTimesheetRows();
  if (!rows.length) return;
  setAdminStatus(dailyTimesheetStatus, "Сохраняю табель...");
  try {
    auditInfo("timesheet_save_start", "Начато сохранение табеля.", {
      date: state.dailyTimesheet.date,
      rows_count: rows.length,
    });
    const result = await apiRequest("POST", "mobile/timesheet/daily/", {
      date: state.dailyTimesheet.date,
      rows,
    });
    auditInfo("timesheet_save_success", "Табель сохранён через mobile API.", {
      date: state.dailyTimesheet.date,
      rows_count: rows.length,
      saved: result.saved || rows.length,
    });
    setAdminStatus(dailyTimesheetStatus, `Табель сохранён. Строк: ${result.saved || rows.length}.`);
    showToast("Табель сохранён.");
    await loadDailyTimesheetView();
  } catch (error) {
    console.error(error);
    auditError("timesheet_save_failed", "Ошибка сохранения табеля через mobile API.", {
      endpoint: "mobile/timesheet/daily/",
      date: state.dailyTimesheet.date,
      rows_count: rows.length,
      error: String(error),
    });
    setAdminStatus(dailyTimesheetStatus, `Ошибка сохранения табеля: ${error}`, true);
  }
}

function openDailyReport() {
  const rows = Array.from(dailyTimesheetBody.querySelectorAll("tr[data-employee-id]"));
  const present = [];
  const weekend = [];
  let advTotal = 0;
  for (const row of rows) {
    const name = row.dataset.employeeName || "—";
    const isPresent = row.querySelector(`input[value="present"]`)?.checked;
    const isWeekend = row.querySelector(`input[value="weekend"]`)?.checked;
    const adv = asInt(row.querySelector('[data-kind="advance"]')?.value);
    advTotal += adv;
    if (isPresent) present.push({ name, adv });
    if (isWeekend) weekend.push({ name, adv });
  }
  const timeStr = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const cashier = state.bootstrap?.user?.display_name || state.bootstrap?.user?.username || "";
  const buildGrid = (items, cls) => items.map((item) => `
    <div class="daily-report-item ${cls}">
      <span class="dr-dot"></span>
      <span class="dr-name">${escapeHtml(item.name)}${item.adv > 0 ? ` <span class="dr-adv">— ${formatMoney(item.adv)} ₽</span>` : ""}</span>
    </div>
  `).join("");
  dailyReportBody.innerHTML = `
    <div class="daily-report-card">
      <div class="daily-report-card-head">
        <span class="daily-report-card-brand">Мастерская Вело 95 Мото</span>
        <span class="daily-report-card-date">Отчёт за ${formatDate(state.dailyTimesheet.date)}</span>
      </div>
      <div class="daily-report-stats">
        <div class="daily-report-stat present"><span class="daily-report-stat-num">${present.length}</span><span class="daily-report-stat-lbl">на работе</span></div>
        <div class="daily-report-stat weekend"><span class="daily-report-stat-num">${weekend.length}</span><span class="daily-report-stat-lbl">выходной</span></div>
      </div>
      ${present.length ? `<div class="daily-report-section"><div class="daily-report-section-label">На работе</div><div class="daily-report-grid">${buildGrid(present, "present")}</div></div>` : ""}
      ${weekend.length ? `<div class="daily-report-section"><div class="daily-report-section-label">Выходной</div><div class="daily-report-grid">${buildGrid(weekend, "weekend")}</div></div>` : ""}
      <div class="daily-report-total"><span class="daily-report-total-label">Авансов итого</span><span class="daily-report-total-value">${advTotal > 0 ? `${formatMoney(advTotal)} ₽` : "—"}</span></div>
      <div class="daily-report-footer"><span>Кассир: <strong>${escapeHtml(cashier)}</strong></span><span>${timeStr}</span></div>
    </div>
  `;
  dailyReportModal.showModal();
}

function monthDays(month) {
  const [year, mon] = String(month || monthValue(todayIsoDate())).split("-").map(Number);
  const count = new Date(year, mon, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;
    const iso = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, iso, weekday: new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", { weekday: "short" }) };
  });
}

function previousMonthValue(month) {
  const [year, mon] = String(month || monthValue(todayIsoDate())).split("-").map(Number);
  const date = new Date(year, mon - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const JOURNAL_MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function normalizedJournalMonth(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthValue(todayIsoDate());
  const month = Number(match[2]);
  if (month < 1 || month > 12) return monthValue(todayIsoDate());
  return `${match[1]}-${match[2]}`;
}

function renderJournalMonthPicker(baseMonth = journalMonthInput?.value || state.journal.month) {
  if (!journalMonthPicker) return;
  const currentMonth = normalizedJournalMonth(baseMonth);
  const [year, month] = currentMonth.split("-").map(Number);
  journalMonthPicker.dataset.year = String(year);
  journalMonthPicker.innerHTML = `
    <div class="journal-month-popover__head">
      <button type="button" class="journal-month-nav" data-month-nav="-1" aria-label="Предыдущий год">‹</button>
      <strong>${year}</strong>
      <button type="button" class="journal-month-nav" data-month-nav="1" aria-label="Следующий год">›</button>
    </div>
    <div class="journal-month-grid">
      ${JOURNAL_MONTH_NAMES.map((name, index) => {
        const value = `${year}-${String(index + 1).padStart(2, "0")}`;
        const isSelected = index + 1 === month;
        return `<button type="button" class="journal-month-option ${isSelected ? "is-selected" : ""}" data-month-value="${value}">${name}</button>`;
      }).join("")}
    </div>
  `;
}

function showJournalMonthPicker() {
  if (!journalMonthPicker) return;
  renderJournalMonthPicker();
  journalMonthPicker.classList.add("is-open");
}

function hideJournalMonthPicker() {
  journalMonthPicker?.classList.remove("is-open");
}

function entryByEmployeeAndDay(entries) {
  const map = new Map();
  for (const entry of entries || []) {
    const day = Number(String(entry.entry_date || "").slice(8, 10));
    map.set(`${entry.employee}-${day}`, entry);
  }
  return map;
}

function journalCell(entry) {
  if (!entry) return { value: "", cls: "is-empty", detail: "" };
  const parts = [];
  const holidayBreakdown = Array.isArray(entry.holiday_pay_breakdown)
    ? entry.holiday_pay_breakdown
    : [];
  const fallbackHolidayPay = Number(entry.holiday_pay_amount || 0);
  const holidayItems = holidayBreakdown.length
    ? holidayBreakdown
    : (fallbackHolidayPay > 0
      ? [{
          label: entry.status === "present" ? "Работа в праздничный день" : "Оплачиваемый праздничный день",
          amount: fallbackHolidayPay,
        }]
      : []);
  const holidayPay = holidayItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  for (const item of holidayItems) {
    const amount = Number(item.amount || 0);
    if (amount > 0) {
      parts.push(`<span class="summary6-hover-row"><span class="summary6-hover-label">${escapeHtml(item.label || "Праздничное начисление")}</span><span class="summary6-hover-value">+${formatMoney(amount)} ₽</span></span>`);
    }
  }
  if (entry.is_late) parts.push(`<span class="summary6-hover-row"><span class="summary6-hover-label">Опоздание</span><span class="summary6-hover-value${entry.late_penalty ? " is-debt" : ""}">${entry.late_penalty ? `−${formatMoney(entry.late_penalty)} ₽` : "без штрафа"}</span></span>`);
  if (entry.advance) parts.push(`<span class="summary6-hover-row"><span class="summary6-hover-label">Аванс</span><span class="summary6-hover-value">${formatMoney(entry.advance)} ₽</span></span>`);
  if (entry.side_job) parts.push(`<span class="summary6-hover-row"><span class="summary6-hover-label">Подработка</span><span class="summary6-hover-value">${formatMoney(entry.side_job)} ₽</span></span>`);
  if (entry.note) parts.push(`<span class="summary6-hover-row"><span class="summary6-hover-label">Комментарий</span><span class="summary6-hover-value">${escapeHtml(entry.note)}</span></span>`);
  const baseCls = entry.status === "weekend" ? "is-weekend" : "is-present";
  const cls = [
    baseCls,
    entry.advance ? "has-advance" : "",
    entry.side_job ? "has-side-job" : "",
    holidayPay > 0 ? "has-holiday-pay" : "",
  ].filter(Boolean).join(" ");
  const detail = parts.length ? `<span class="summary6-hover-card summary6-cell-detail-card"><span class="summary6-hover-title">Подробности дня</span><span class="summary6-hover-grid">${parts.join("")}</span></span>` : "";
  const mark = holidayPay > 0 ? '<span class="summary6-holiday-pay-mark">✦</span>' : "";
  return { value: `${entry.status === "weekend" ? "В" : "+"}${mark}`, cls, detail };
}

function buildJournalRows(summaryData, monthData, previousSummaryData = null) {
  const days = monthDays(summaryData.month);
  const holidayDates = new Set(summaryData.holidays || monthData.holidays || []);
  days.forEach((day) => {
    day.isHoliday = holidayDates.has(day.iso);
  });
  const entries = entryByEmployeeAndDay(monthData.entries || []);
  const previousRows = [
    ...(previousSummaryData?.active_employees || []),
    ...(previousSummaryData?.inactive_employees || []),
  ];
  const previousById = new Map(previousRows.map((employee) => [Number(employee.id), employee]));
  const makeRows = (items, type) => (items || []).map((employee) => {
    const cells = days.map((day) => journalCell(entries.get(`${employee.id}-${day.day}`)));
    const previous = previousById.get(Number(employee.id));
    const apiPreviousTotal = employee.previous_total ?? null;
    const previousTotal = apiPreviousTotal !== null ? apiPreviousTotal : previous?.total ?? null;
    const apiDiff = employee.trend_diff ?? null;
    const diff = apiDiff !== null ? Number(apiDiff) : (previous ? Number(employee.total || 0) - Number(previous.total || 0) : null);
    const trend = employee.trend || (
      Number(employee.total || 0) < 0 && diff
        ? (diff > 0 ? "better" : "worse")
        : null
    );
    return { ...employee, employeeType: type, cells, previous_total: previousTotal, trend_diff: diff, trend, stable_id: `${type}-${employee.id}` };
  });
  return { days, rows: [...makeRows(summaryData.active_employees, "active"), ...makeRows(summaryData.inactive_employees, "inactive")] };
}

function journalTrendHtml(employee) {
  if (!employee?.trend) return "";
  return `
    <span class="summary6-trend-anchor" tabindex="0">
      <span class="summary6-trend ${employee.trend}">${employee.trend === "better" ? "▼" : "▲"}</span>
      <span class="summary6-hover-card summary6-trend-card">
        <span class="summary6-hover-title">Сравнение с прошлым месяцем</span>
        <span class="summary6-hover-grid">
          <span class="summary6-hover-row"><span class="summary6-hover-label">Прошлый месяц</span><span class="summary6-hover-value">${formatMoney(employee.previous_total || 0)} ₽</span></span>
          <span class="summary6-hover-row"><span class="summary6-hover-label">Этот месяц</span><span class="summary6-hover-value">${formatMoney(employee.total || 0)} ₽</span></span>
          <span class="summary6-hover-row"><span class="summary6-hover-label">Изменение</span><span class="summary6-hover-value ${employee.trend === "better" ? "summary6-trend-val-better" : "summary6-trend-val-worse"}">${employee.trend_diff > 0 ? "+" : ""}${formatMoney(employee.trend_diff || 0)} ₽</span></span>
        </span>
      </span>
    </span>
  `;
}

function setJournalSelection(journalId) {
  state.journal.selectedId = journalId || "";
  const rows = Array.from(journalBody?.querySelectorAll(".summary6-data-row") || []);
  rows.forEach((row) => row.classList.toggle("is-selected", row.dataset.journalId === state.journal.selectedId));
  const selectedEmployee = state.journal.rows.find((employee) => employee.stable_id === state.journal.selectedId);
  renderJournalSidePanel(selectedEmployee || null);
}

function renderJournalSidePanel(employee = null) {
  if (!journalSidePanel) return;
  if (!employee) {
    journalSidePanel.innerHTML = `<div class="journal-side-empty">Выберите сотрудника в журнале.</div>`;
    return;
  }
  const total = Number(employee.total || 0);
  const debt = Number(employee.debt || 0);
  journalSidePanel.innerHTML = `
    <div class="journal-side-head">
      <div class="journal-side-title-row">
        <span class="journal-side-label">Итоги за месяц</span>
        <button class="journal-side-close" type="button" aria-label="Закрыть подробности">×</button>
      </div>
      <h2 title="${escapeHtml(employee.full_name || "—")}">${escapeHtml(employee.full_name || "—")}</h2>
      <p>${employee.employeeType === "inactive" ? "Уволившийся сотрудник" : "Активный сотрудник"}${employee.day_off_label ? ` · выходной: ${escapeHtml(employee.day_off_label)}` : ""}</p>
    </div>
    <div class="journal-side-grid">
      <div class="journal-side-stat"><span>Авансы</span><strong>${formatMoney(employee.advance_total || 0)} ₽</strong></div>
      <div class="journal-side-stat"><span>Подработка</span><strong>${formatMoney(employee.side_job_total || 0)} ₽</strong></div>
      <div class="journal-side-stat"><span>Заработал</span><strong>${formatMoney(employee.earned_total || 0)} ₽</strong></div>
      <div class="journal-side-stat ${total < 0 ? "is-debt" : "is-good"}"><span>Итоговая сумма</span><strong><span>${formatMoney(total)} ₽</span>${journalTrendHtml(employee)}</strong></div>
      <div class="journal-side-stat ${debt ? "is-debt" : ""}"><span>Долг</span><strong>${debt ? `−${formatMoney(debt)} ₽` : "0 ₽"}</strong></div>
    </div>
  `;
}

function renderJournal() {
  if (!journalHead || !journalBody) return;
  const { days, rows } = state.journal;
  const emptyDayIndexes = days.map((_, dayIndex) => rows.every((employee) => employee.cells[dayIndex]?.cls === "is-empty"));
  journalHead.innerHTML = `
    <tr>
      <th class="sticky-left summary6-index">№</th>
      <th class="sticky-left second summary6-name">ФИО</th>
      ${days.map((day, dayIndex) => `<th class="summary6-day-header ${emptyDayIndexes[dayIndex] ? "is-empty-day" : ""} ${day.isHoliday ? "is-paid-holiday" : ""}" ${day.isHoliday ? 'title="Праздничный день"' : ""}><span class="summary6-day-number">${day.day}${day.isHoliday ? '<span class="summary6-holiday-mark">*</span>' : ""}</span><span class="summary6-day-weekday">${escapeHtml(day.weekday)}</span></th>`).join("")}
    </tr>
  `;
  if (!rows.length) {
    journalBody.innerHTML = `<tr class="empty-row"><td colspan="${days.length + 2}">Журнал пока пуст. Сначала заполните табель.</td></tr>`;
    renderJournalSidePanel(null);
    syncJournalFilters();
    return;
  }

  let activeIndex = 0;
  let inactiveIndex = 0;
  journalBody.innerHTML = rows.map((employee) => {
    const index = employee.employeeType === "inactive" ? ++inactiveIndex : ++activeIndex;
    const inactiveClass = employee.employeeType === "inactive" ? " summary6-row-inactive" : "";
    const name = employee.full_name || "—";
    return `
      <tr class="summary6-data-row${inactiveClass}"
          data-journal-id="${employee.stable_id}"
          data-employee-name="${escapeHtml(name.toLowerCase())}"
          data-employee-type="${employee.employeeType}"
          data-has-debt="${Number(employee.debt || 0) ? "1" : "0"}"
          data-has-advance="${Number(employee.advance_total || 0) ? "1" : "0"}"
          data-has-sidejob="${Number(employee.side_job_total || 0) ? "1" : "0"}"
          data-advance-total="${employee.advance_total || 0}"
          data-sidejob-total="${employee.side_job_total || 0}"
          data-earned-total="${employee.earned_total || 0}"
          data-summary-total="${employee.total || 0}">
        <td class="sticky-left summary6-index">${index}</td>
        <td class="sticky-left second summary6-name">
          <span class="summary6-name-anchor" tabindex="0">
            <span class="summary6-name-text">${escapeHtml(name)}</span>
            <span class="summary6-hover-card">
              <span class="summary6-hover-title">Данные сотрудника</span>
              <span class="summary6-hover-grid">
                <span class="summary6-hover-row is-debt"><span class="summary6-hover-label">Долг</span><span class="summary6-hover-value is-debt">${employee.debt ? `−${formatMoney(employee.debt)} ₽` : "0 ₽"}</span></span>
                <span class="summary6-hover-row"><span class="summary6-hover-label">Выходной</span><span class="summary6-hover-value">${escapeHtml(employee.day_off_label || "—")}</span></span>
                <span class="summary6-hover-row"><span class="summary6-hover-label">Зарплата</span><span class="summary6-hover-value">${formatMoney(employee.salary || 0)} ₽</span></span>
                <span class="summary6-hover-row"><span class="summary6-hover-label">Зарплата в день</span><span class="summary6-hover-value">${formatMoney(employee.daily_salary || 0)} ₽</span></span>
              </span>
            </span>
          </span>
        </td>
        ${employee.cells.map((cell, dayIndex) => `<td class="summary6-cell ${cell.cls} ${emptyDayIndexes[dayIndex] ? "is-empty-day" : ""}"><span class="summary6-cell-anchor" tabindex="0"><span>${cell.value}</span>${cell.detail}</span></td>`).join("")}
      </tr>
    `;
  }).join("");
  syncJournalFilters();
}

function syncJournalFilters() {
  const rows = Array.from(journalBody?.querySelectorAll(".summary6-data-row") || []);
  const search = (journalSearch?.value || "").trim().toLowerCase();
  const type = journalEmployeeType?.value || "active";
  const highlight = journalHighlightFilter?.value || "all";
  let visible = 0;
  let advances = 0;
  let sideJobs = 0;
  let earned = 0;
  let total = 0;
  rows.forEach((row) => {
    let ok = !search || (row.dataset.employeeName || "").includes(search);
    ok = ok && (type === "all" || row.dataset.employeeType === type);
    if (highlight === "debt") ok = ok && row.dataset.hasDebt === "1";
    if (highlight === "nonnegative") ok = ok && Number(row.dataset.summaryTotal || 0) >= 0;
    if (highlight === "advance") ok = ok && row.dataset.hasAdvance === "1";
    if (highlight === "sidejob") ok = ok && row.dataset.hasSidejob === "1";
    row.classList.toggle("summary6-row-hidden", !ok);
    if (ok) {
      visible += 1;
      advances += Number(row.dataset.advanceTotal || 0);
      sideJobs += Number(row.dataset.sidejobTotal || 0);
      earned += Number(row.dataset.earnedTotal || 0);
      total += Number(row.dataset.summaryTotal || 0);
    }
  });
  const visibleRows = rows.filter((row) => !row.classList.contains("summary6-row-hidden"));
  if (!visibleRows.some((row) => row.dataset.journalId === state.journal.selectedId)) {
    state.journal.selectedId = visibleRows[0]?.dataset.journalId || "";
  }
  setJournalSelection(state.journal.selectedId);
  document.querySelector("#journal-kpi-employees").textContent = visible;
  document.querySelector("#journal-kpi-advances").textContent = `${formatMoney(advances)} ₽`;
  document.querySelector("#journal-kpi-sidejobs").textContent = `${formatMoney(sideJobs)} ₽`;
  document.querySelector("#journal-kpi-earned").textContent = `${formatMoney(earned)} ₽`;
  document.querySelector("#journal-kpi-total").textContent = `${formatMoney(total)} ₽`;
  if (journalFilterStatus) journalFilterStatus.textContent = `Показано ${visible} из ${rows.length} сотрудников.`;
  journalFilterEmpty?.classList.toggle("is-visible", rows.length > 0 && visible === 0);
}

async function loadJournalView() {
  const month = journalMonthInput?.value || state.journal.month || monthValue(todayIsoDate());
  state.journal.month = month;
  if (journalMonthInput) journalMonthInput.value = month;
  renderJournalMonthPicker(month);
  const hasCached = state.journal.rows.length > 0 && state.journal._cachedMonth === month;
  if (hasCached) {
    renderJournal();
    const previousMonth = previousMonthValue(month);
    Promise.all([
      apiRequest("GET", `mobile/summary/?month=${month}`),
      apiRequest("GET", `mobile/timesheet/monthly/?month=${month}`),
      apiRequest("GET", `mobile/summary/?month=${previousMonth}`),
    ]).then(([summaryData, monthData, previousSummaryData]) => {
      const built = buildJournalRows(summaryData, monthData, previousSummaryData);
      state.journal.month = summaryData.month || month;
      state.journal._cachedMonth = summaryData.month || month;
      state.journal.days = built.days;
      state.journal.rows = built.rows;
      renderJournal();
      setAdminStatus(journalStatus, "");
    }).catch(() => {});
    return;
  }
  setAdminStatus(journalStatus, "Загружаю журнал...");
  try {
    const previousMonth = previousMonthValue(month);
    const [summaryData, monthData, previousSummaryData] = await Promise.all([
      apiRequest("GET", `mobile/summary/?month=${month}`),
      apiRequest("GET", `mobile/timesheet/monthly/?month=${month}`),
      apiRequest("GET", `mobile/summary/?month=${previousMonth}`),
    ]);
    const built = buildJournalRows(summaryData, monthData, previousSummaryData);
    state.journal.month = summaryData.month || month;
    state.journal._cachedMonth = summaryData.month || month;
    state.journal.days = built.days;
    state.journal.rows = built.rows;
    renderJournal();
    setAdminStatus(journalStatus, "");
  } catch (error) {
    console.error(error);
    setAdminStatus(journalStatus, `Ошибка загрузки журнала: ${error}`, true);
  }
}

function renderSalaryList(title, items, emptyTitle, emptyText) {
  if (!items.length) {
    return `
      <div class="salary-empty-state empty-state">
        <strong>${escapeHtml(emptyTitle)}</strong>
        ${escapeHtml(emptyText)}
      </div>
    `;
  }
  return `
    <h2 class="section-label">${escapeHtml(title)}</h2>
    <div class="salary-list">
      ${items.map((item) => `
        <div class="salary-item">
          <span class="salary-item__name">${escapeHtml(item.name || "—")}</span>
          <span class="salary-item__amount">${formatMoney(item.earned || 0)} ₽</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderSalaryRecords(records) {
  if (!records.length) {
    return `
      <div class="salary-empty-state empty-state">
        <strong>Ничего не выдали</strong>
        За выбранный период нет записей со статусом выдачи.
      </div>
    `;
  }

  const canCollect = hasPermission("records.change_record");
  return `
    <h2 class="section-label">Выданные работы</h2>
    <section class="table-shell salary-records-shell">
      <div class="table-responsive-shell">
        <table class="records-site-table admin-table salary-records-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Дата</th>
              <th>Название техники</th>
              <th>Номер телефона</th>
              <th>Оплатил</th>
              <th>Мастер</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((record, index) => {
              const id = recordStableId(record);
              const collectedText = record.collected ? `Забрал ${formatDate(record.collected_date)}` : "Забрал";
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${formatDate(record.record_date)}</td>
                  <td class="text-truncate">${escapeHtml(record.title || "—")}</td>
                  <td class="cell-nowrap">${buildRecordPhoneCell(record)}</td>
                  <td class="record-total-amount">${formatPaymentAmount(record.total_amount)}</td>
                  <td>${escapeHtml(record.master || "—")}</td>
                  <td>
                    <div class="table-actions">
                      <button type="button" class="btn-action btn-action-icon salary-view-details" data-id="${id}" title="Подробнее">▣</button>
                      ${canCollect ? `<button type="button" class="btn-action btn-action-main ${record.collected ? "btn-collected" : "btn-collect salary-collect-record"}" data-id="${id}" ${record.collected ? "disabled" : ""}>${collectedText}</button>` : ""}
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function salaryRangeLabel(data) {
  const from = data.date_from || data.date || todayIsoDate();
  const to = data.date_to || data.date || from;
  return from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`;
}

function renderSalaryData(data) {
  const masters = data.masters || [];
  const assemblers = (data.assemblers || []).map((item) => ({
    name: `Сборщик - ${item.name || "—"}`,
    earned: item.earned || 0,
  }));
  const records = data.records || [];
  state.salaryRecords = records;
  const from = data.date_from || data.date || todayIsoDate();
  const to = data.date_to || data.date || from;
  salaryDateInput.value = from;
  if (salaryDateToInput) salaryDateToInput.value = to;
  salaryDateMeta.textContent = salaryRangeLabel(data);
  salaryContent.innerHTML = `
    ${renderSalaryList("Мастера", masters, "По мастерам пока пусто", "За выбранный период начислений для мастеров не найдено.")}
    ${renderSalaryList("Сборщики", assemblers, "По сборке пока пусто", "За выбранный период начислений для сборщиков не найдено.")}
    ${renderSalaryRecords(records)}
  `;
}

function isoDateRange(from, to) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [todayIsoDate()];
  const dates = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function normalizeSalaryRange() {
  let from = salaryDateInput?.value || salaryDateToInput?.value || todayIsoDate();
  let to = salaryDateToInput?.value || from;
  if (from > to) [from, to] = [to, from];
  if (salaryDateInput) salaryDateInput.value = from;
  if (salaryDateToInput) salaryDateToInput.value = to;
  return { from, to, dates: isoDateRange(from, to) };
}

function aggregateSalaryList(days, key) {
  const totals = new Map();
  for (const day of days) {
    for (const item of day?.[key] || []) {
      const name = item.name || "";
      if (!name) continue;
      totals.set(name, (totals.get(name) || 0) + Number(item.earned || 0));
    }
  }
  return Array.from(totals.entries())
    .map(([name, earned]) => ({ name, earned }))
    .sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name, "ru"));
}

function aggregateSalaryData(days, from, to) {
  const records = days.flatMap((day) => day?.records || []);
  records.sort((a, b) => String(b.collected_date || b.record_date || "").localeCompare(String(a.collected_date || a.record_date || "")));
  return {
    date: from,
    date_from: from,
    date_to: to,
    masters: aggregateSalaryList(days, "masters"),
    assemblers: aggregateSalaryList(days, "assemblers"),
    records,
    total: days.reduce((sum, day) => sum + Number(day?.total || 0), 0),
  };
}

function salaryCacheKey(dateValue) {
  return `salaryCache:${dateValue || todayIsoDate()}`;
}

function readSalaryCache(dateValue) {
  const memoryCache = state.salaryCache;
  if (memoryCache && memoryCache.date === dateValue) return memoryCache;
  try {
    const raw = localStorage.getItem(salaryCacheKey(dateValue));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSalaryCache(data) {
  if (!data?.date) return;
  state.salaryCache = data;
  try {
    localStorage.setItem(salaryCacheKey(data.date), JSON.stringify(data));
  } catch (error) {
    console.info("[salary] persistent cache skipped", error);
  }
}

async function loadLocalSalaryFallback(dateValue) {
  const cached = readSalaryCache(dateValue);
  if (cached) return { data: cached, source: "cache" };
  const data = await invoke("local_salary_report", { date: dateValue });
  return { data, source: "sqlite" };
}

async function loadSalaryFallbackRange(dates) {
  const results = await Promise.all(dates.map((dateValue) => loadLocalSalaryFallback(dateValue)));
  const source = results.every((result) => result.source === "cache") ? "cache" : "sqlite";
  return { data: results.map((result) => result.data), source };
}

async function fetchSalaryRange(dates) {
  const days = await Promise.all(dates.map(async (dateValue) => {
    const data = await apiRequest("GET", `mobile/salary/?date=${encodeURIComponent(dateValue)}`);
    writeSalaryCache(data);
    return data;
  }));
  return days;
}

async function loadSalaryView() {
  if (!salaryContent) return;
  if (!salaryDateInput.value) salaryDateInput.value = todayIsoDate();
  if (salaryDateToInput && !salaryDateToInput.value) salaryDateToInput.value = salaryDateInput.value;
  const { from, to, dates } = normalizeSalaryRange();
  const cachedDays = dates.map(readSalaryCache);
  const hasFullCache = cachedDays.every(Boolean);
  if (hasFullCache) {
    renderSalaryData(aggregateSalaryData(cachedDays, from, to));
    if (!state.network.online || !browserIsOnline()) {
      setAdminStatus(salaryStatus, "Показаны последние сохранённые данные (офлайн).");
      auditInfo("salary_offline_cache_used", "Зарплата открыта из сохранённого кэша офлайн.", { date_from: from, date_to: to });
      return;
    }
    const t0Salary = performance.now();
    fetchSalaryRange(dates).then((days) => {
      console.debug(`[salary] background refresh for ${from}..${to} in ${Math.round(performance.now() - t0Salary)}ms`);
      renderSalaryData(aggregateSalaryData(days, from, to));
      setAdminStatus(salaryStatus, "");
      auditInfo("salary_cache_refreshed", "Кэш зарплаты обновлён с сайта.", { date_from: from, date_to: to });
    }).catch(() => {});
    return;
  }

  if (!state.network.online || !browserIsOnline()) {
    try {
      const { data, source } = await loadSalaryFallbackRange(dates);
      renderSalaryData(aggregateSalaryData(data, from, to));
      setAdminStatus(
        salaryStatus,
        source === "cache"
          ? "Показаны последние сохранённые данные (офлайн)."
          : "Показаны данные из локальной базы (офлайн).",
      );
      auditInfo("salary_offline_fallback_used", "Зарплата открыта из локальных данных офлайн.", { date_from: from, date_to: to, source });
    } catch (error) {
      console.error(error);
      auditError("salary_offline_fallback_failed", "Не удалось открыть зарплату офлайн.", { date_from: from, date_to: to, error: String(error) });
      setAdminStatus(salaryStatus, "Нет сохранённых данных зарплаты для офлайн-просмотра.", true);
    }
    return;
  }

  setAdminStatus(salaryStatus, "Загружаю...");
  const t0Salary = performance.now();
  try {
    const days = await fetchSalaryRange(dates);
    console.debug(`[salary] loaded for ${from}..${to} in ${Math.round(performance.now() - t0Salary)}ms`);
    renderSalaryData(aggregateSalaryData(days, from, to));
    setAdminStatus(salaryStatus, "");
    auditInfo("salary_load_success", "Зарплата загружена с сайта и сохранена в кэш.", { date_from: from, date_to: to });
  } catch (error) {
    console.error(error);
    try {
      const { data, source } = await loadSalaryFallbackRange(dates);
      renderSalaryData(aggregateSalaryData(data, from, to));
      setAdminStatus(
        salaryStatus,
        source === "cache"
          ? "Сервер недоступен. Показаны последние сохранённые данные."
          : "Сервер недоступен. Показаны данные из локальной базы.",
      );
      auditWarning("salary_online_failed_fallback_used", "Сервер зарплаты недоступен, показаны локальные данные.", {
        date_from: from,
        date_to: to,
        source,
        error: String(error),
      });
    } catch {
      auditError("salary_load_failed", "Не удалось загрузить зарплату ни с сайта, ни локально.", { date_from: from, date_to: to, error: String(error) });
      setAdminStatus(salaryStatus, `Ошибка: ${error}`, true);
    }
  }
}

async function refreshAll() {
  await loadRecords();
  await loadAssemblies();
  const view = state.currentView;
  if (view === "salary") {
    await loadSalaryView();
  } else if (view === "advances") {
    state.employeeAdvances = await invoke("list_employee_advances", { date: todayIsoDate() });
    renderAdvances();
  } else if (view === "assembly-order" || view === "assembly-orders") {
    state.assemblyOrders = await invoke("list_assembly_orders");
    renderAssemblyOrders(assemblyOrderCreateList);
    renderAssemblyOrders(assemblyOrdersList);
  }
  await refreshPendingSyncSummary();
}

async function refreshPendingSyncSummary() {
  try {
    const summary = await invoke("get_pending_sync_summary");
    state.pendingRecords = Number(summary.records || 0);
    state.pendingAssemblies = Number(summary.assemblies || 0);
    state.pendingAdvances = Number(summary.advances || 0);
    state.pendingOrders = Number(summary.orders || 0);
    state.pendingTotal = Number(summary.total || 0);
    state.pendingConflicts = Number(summary.conflicts || 0);
    state.lastSuccessfulSyncAt = summary.last_successful_sync_at || summary.last_records_sync_at || state.lastSuccessfulSyncAt;
  } catch (error) {
    console.warn("[sync] pending summary unavailable", error);
    state.pendingTotal = state.pendingRecords + state.pendingAssemblies + state.pendingAdvances + state.pendingOrders;
  }
  updateSyncButton();
  updateLongSyncWarning();
  updateConflictBanner();
}

function updateConflictBanner() {
  const count = Number(state.pendingConflicts || 0);
  let banner = document.getElementById("conflict-banner");
  if (count <= 0) {
    banner?.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "conflict-banner";
    banner.className = "conflict-banner";
    banner.innerHTML = `
      <span class="conflict-banner__text"></span>
      <button type="button" class="conflict-banner__open">Открыть</button>
    `;
    document.body.append(banner);
    banner.querySelector(".conflict-banner__open").addEventListener("click", showConflictsDialog);
  }
  banner.querySelector(".conflict-banner__text").textContent =
    `Конфликты синхронизации: ${count}. Запись изменилась на сервере, выберите, какую версию оставить.`;
}

async function showConflictsDialog() {
  let conflicts = [];
  try {
    conflicts = await invokeWithTimeout("list_conflicts", {}, 10_000);
  } catch (error) {
    setStatus(`Не удалось загрузить конфликты: ${error}`, true);
    return;
  }
  if (!Array.isArray(conflicts) || conflicts.length === 0) {
    setStatus("Конфликтов синхронизации нет.");
    return;
  }
  document.getElementById("conflict-dialog")?.remove();
  const dialog = document.createElement("div");
  dialog.id = "conflict-dialog";
  dialog.className = "modal conflict-dialog";
  dialog.innerHTML = `
    <div class="modal__backdrop"></div>
    <div class="modal__card conflict-dialog__card">
      <div class="modal__header">
        <h2>Конфликты синхронизации</h2>
        <button type="button" class="modal__close" aria-label="Закрыть">×</button>
      </div>
      <div class="conflict-dialog__body"></div>
    </div>
  `;
  document.body.append(dialog);
  const body = dialog.querySelector(".conflict-dialog__body");
  conflicts.forEach((conflict) => body.append(renderConflictRow(conflict)));
  dialog.querySelector(".modal__close").addEventListener("click", () => dialog.remove());
  dialog.querySelector(".modal__backdrop").addEventListener("click", () => dialog.remove());
}

function renderConflictRow(conflict) {
  const wrap = document.createElement("div");
  wrap.className = "conflict-row";
  const local = conflict.local || {};
  const server = conflict.server || {};
  const fmt = (record, key, fallback = "—") => {
    const value = record?.[key];
    if (value === null || value === undefined || value === "") return fallback;
    return escapeHtml(String(value));
  };
  wrap.innerHTML = `
    <div class="conflict-row__title">${fmt(local, "title")} — ${fmt(local, "client_name")}</div>
    <div class="conflict-row__sides">
      <div class="conflict-row__side">
        <div class="conflict-row__heading">Моя версия (локально)</div>
        <div>Дата: ${fmt(local, "record_date")}</div>
        <div>Мастер: ${fmt(local, "master")}</div>
        <div>Запчасти: ${fmt(local, "parts", "0")} ₽</div>
        <div>Услуги: ${fmt(local, "services", "0")} ₽</div>
        <div>Сумма: ${fmt(local, "total_amount", "0")} ₽</div>
        <div>Забрано: ${local.collected ? "да" : "нет"}</div>
        <div>Комментарий: ${fmt(local, "comments", "")}</div>
      </div>
      <div class="conflict-row__side">
        <div class="conflict-row__heading">Версия с сайта</div>
        <div>Дата: ${fmt(server, "date") !== "—" ? fmt(server, "date") : fmt(server, "record_date")}</div>
        <div>Мастер: ${fmt(server, "master")}</div>
        <div>Запчасти: ${fmt(server, "parts", "0")} ₽</div>
        <div>Услуги: ${fmt(server, "services", "0")} ₽</div>
        <div>Сумма: ${fmt(server, "total_amount", "0")} ₽</div>
        <div>Забрано: ${server.collected ? "да" : "нет"}</div>
        <div>Комментарий: ${fmt(server, "comments", "")}</div>
      </div>
    </div>
    <div class="conflict-row__actions">
      <button type="button" data-choice="server">Взять версию с сайта</button>
      <button type="button" data-choice="client">Оставить мою версию</button>
    </div>
  `;
  wrap.querySelectorAll("button[data-choice]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const choice = btn.dataset.choice;
      btn.disabled = true;
      try {
        await invokeWithTimeout("resolve_conflict", {
          syncUuid: conflict.sync_uuid,
          choice,
        }, 10_000);
        auditInfo("conflict_resolved", "Пользователь разрешил конфликт записи.", {
          sync_uuid: conflict.sync_uuid,
          choice,
        });
        wrap.remove();
        await refreshPendingSyncSummary();
        await refreshActiveRecordList?.();
        if (choice === "client") queueBackgroundSync("conflict-resolve");
        const remaining = document.querySelectorAll(".conflict-row").length;
        if (remaining === 0) document.getElementById("conflict-dialog")?.remove();
      } catch (error) {
        btn.disabled = false;
        setStatus(`Не удалось разрешить конфликт: ${error}`, true);
      }
    });
  });
  return wrap;
}

function syncStatusMessage() {
  return getSyncStatusMessage({
    syncInProgress: state.network.syncInProgress || state.network.manualSyncInProgress,
    uiStatus: state.syncUiStatus,
    online: state.network.online,
    longWarningVisible: state.longSyncWarningVisible,
    pendingTotal: state.pendingTotal,
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    uiMessage: state.syncUiMessage,
  });
}

function updateSyncButton() {
  const count = Number(state.pendingTotal || (state.pendingRecords + state.pendingAssemblies + state.pendingAdvances + state.pendingOrders));
  syncButton.classList.toggle("sync-hidden", count <= 0);
  syncButton.disabled = state.network.syncInProgress || state.network.manualSyncInProgress;
  syncButton.textContent = count > 0 ? `Синхр. ${count}` : "Синхр.";
  syncButton.title = syncStatusMessage();
  if (typeof SyncService !== "undefined") SyncService.renderIndicator();
}

function validateRecord(formData, parts, services) {
  const required = [
    ["phone", "Укажите телефон клиента."],
    ["title", "Укажите название техники."],
    ["clientName", "Укажите имя клиента."],
    ["master", "Выберите мастера."],
    ["comments", "Заполните комментарий."],
  ];
  for (const [field, message] of required) {
    if (!String(formData.get(field) || "").trim()) {
      return message;
    }
  }
  const phone = String(formData.get("phone") || "").replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) {
    return "Телефон должен содержать 10 цифр.";
  }
  if (!formData.get("freeRepair") && parts <= 0 && services <= 0) {
    return "Укажите сумму больше 0 в работе или запчастях, либо отметьте гарантию.";
  }
  return "";
}

async function saveRecord(event) {
  event.preventDefault();
  const formData = new FormData(recordForm);
  const parts = asInt(partsInput.value);
  const services = asInt(servicesInput.value);
  const validationError = validateRecord(formData, parts, services);
  if (validationError) {
    setStatus(validationError);
    auditWarning("record_validation_failed", "Запись не сохранена: ошибка валидации.", {
      reason: validationError,
      parts,
      services,
    });
    return;
  }

  try {
    setStatus("Сохраняю запись в локальную базу...");
    const syncUuid = crypto.randomUUID();
    const recordPayload = {
      sync_uuid: syncUuid,
      record_date: todayIsoDate(),
      title: String(formData.get("title") || "").trim(),
      client_name: String(formData.get("clientName") || "").trim(),
      phone: String(formData.get("phone") || "").replace(/\D/g, "").slice(-10),
      master: String(formData.get("master") || "").trim(),
      parts,
      services,
      comments: String(formData.get("comments") || "").trim(),
      free_repair: Boolean(formData.get("freeRepair")),
      master_only: Boolean(formData.get("masterOnly")),
      total_amount: parts + services,
    };
    const localId = await invoke("save_record", {
      record: recordPayload,
    });
    auditInfo("record_create_local", "Запись сохранена локально и поставлена в очередь синхронизации.", {
      local_id: localId,
      sync_uuid: syncUuid,
      total_amount: recordPayload.total_amount,
      parts,
      services,
      master: recordPayload.master,
      queued_for_sync: true,
    });
    recordForm.reset();
    clientNameInput.value = "Клиент";
    partsInput.value = "0";
    servicesInput.value = "0";
    updateRecordTotal();
    updateRecordSubmitState();
    await loadRecords();
    await refreshPendingSyncSummary();
    switchView("records");
    setStatus(`Запись L-${localId} сохранена локально. Синхронизация пойдёт в фоне.`);
    queueBackgroundSync("record-save", `Запись L-${localId} синхронизирована с сайтом.`);
  } catch (error) {
    console.error(error);
    auditError("record_create_failed", "Ошибка сохранения записи в локальную базу.", { error: String(error), parts, services });
    setStatus(`Ошибка сохранения записи: ${error}`);
  }
}

async function syncPendingRecords() {
  if (state.network.manualSyncInProgress || state.network.syncInProgress) {
    setStatus("Синхронизация уже выполняется.");
    auditWarning("sync_manual_skipped", "Ручная синхронизация пропущена: уже выполняется другая синхронизация.", {
      pending_total: state.pendingTotal,
      manual_preflight: state.network.manualSyncInProgress,
    });
    return;
  }
  state.network.manualSyncInProgress = true;
  updateSyncButton();
  saveSyncSettings();
  try {
    await refreshPendingSyncSummary();
    const settings = currentSettings();
    if (!settings.server_url) {
      setStatus("Укажите адрес сайта.");
      auditWarning("sync_manual_blocked", "Ручная синхронизация не запущена: не указан сайт.");
      return;
    }
    if (!settings.username || !settings.password) {
      setStatus("Введите логин и пароль от сайта.");
      auditWarning("sync_manual_blocked", "Ручная синхронизация не запущена: нет логина или пароля.");
      return;
    }
    if (shouldFastFailManualSync({
      browserOnline: browserIsOnline(),
      syncInProgress: state.network.syncInProgress,
      trustBrowserOnline: false,
    })) {
      markNetworkOffline("manual-sync", "browser_offline");
      const message = offlineSyncMessage();
      setStatus(message, true);
      auditWarning("sync_manual_offline", "Ручная синхронизация невозможна: нет подключения к интернету.", {
        pending_total: state.pendingTotal,
      });
      scheduleReconnectWorker();
      return;
    }
    setSyncUiStatus("syncing", "Проверяю интернет...");
    const online = await runHealthCheck("manual-preflight", 700);
    if (!online) {
      const message = offlineSyncMessage();
      markNetworkOffline("manual-sync", "preflight_failed");
      setStatus(message, true);
      auditWarning("sync_manual_offline", "Ручная синхронизация остановлена после быстрой проверки сети.", {
        pending_total: state.pendingTotal,
      });
      scheduleReconnectWorker();
      return;
    }
    await syncNow("Данные синхронизированы с сайтом.", { reason: "manual", forceHealth: false });
  } catch (error) {
    console.error(error);
    auditError("sync_manual_failed", "Ошибка ручной синхронизации.", { error: String(error), pending_total: state.pendingTotal });
    setStatus(`Ошибка синхронизации: ${error}`);
  } finally {
    state.network.manualSyncInProgress = false;
    updateSyncButton();
  }
}

async function syncNow(successMessage = "Действие синхронизировано с сайтом.", options = {}) {
  const settings = currentSettings();
  if (!hasSyncCredentials(settings)) {
    await refreshAll();
    if (!options.background) setStatus("Введите логин и пароль от сайта.", true);
    auditWarning("sync_skipped_no_credentials", "Синхронизация не запущена: нет учётных данных.", {
      reason: options.reason || "background",
      background: Boolean(options.background),
    });
    return false;
  }
  if (state.network.syncInProgress) {
    console.info(`[offline-startup] sync skipped reason=${options.reason || "background"} already_running=true`);
    if (!options.background) setStatus("Синхронизация уже выполняется.");
    auditWarning("sync_skipped_already_running", "Синхронизация пропущена: другая синхронизация уже выполняется.", {
      reason: options.reason || "background",
      pending_total: state.pendingTotal,
    });
    return false;
  }

  state.network.syncInProgress = true;
  updateSyncButton();
  const syncStartedAt = performance.now();
  try {
    if (options.background) {
      if (shouldFastFailNetworkRequest()) {
        markNetworkOffline(options.reason || "background-sync", "fast_offline_state");
        console.info(`[offline-startup] background sync fast-skip reason=${options.reason || "background"} mode=offline`);
        auditWarning("sync_deferred_offline_fast", "Фоновая синхронизация быстро отложена: сеть уже считается недоступной.", {
          reason: options.reason || "background",
          pending_total: state.pendingTotal,
        });
        scheduleReconnectWorker();
        return false;
      }

      const online = await runHealthCheck(options.reason || "background-preflight", 700);
      if (!online) {
        console.info(`[offline-startup] background sync preflight-failed reason=${options.reason || "background"}`);
        auditWarning("sync_deferred_offline_preflight", "Фоновая синхронизация отложена после быстрой проверки сети.", {
          reason: options.reason || "background",
          duration_ms: Math.round(performance.now() - syncStartedAt),
          pending_total: state.pendingTotal,
        });
        scheduleReconnectWorker();
        return false;
      }
    }

    if (options.background && !state.network.online && !options.forceHealth) {
      markNetworkOffline(options.reason || "background-sync", "offline_state");
      console.info(`[offline-startup] background sync skipped reason=${options.reason || "background"} mode=offline`);
      auditWarning("sync_deferred_offline", "Фоновая синхронизация отложена: программа офлайн.", {
        reason: options.reason || "background",
        pending_total: state.pendingTotal,
      });
      scheduleReconnectWorker();
      return false;
    }

    setSyncUiStatus("syncing", "Синхронизация...");
    auditInfo("sync_start", "Начата синхронизация desktop-программы.", {
      reason: options.reason || "background",
      background: Boolean(options.background),
      pending_records: state.pendingRecords,
      pending_assemblies: state.pendingAssemblies,
      pending_advances: state.pendingAdvances,
      pending_orders: state.pendingOrders,
      pending_total: state.pendingTotal,
    });
    if (!state.network.online || options.forceHealth) {
      const online = await runHealthCheck(options.reason || "sync");
      if (!online) {
        await refreshAll();
        markNetworkOffline(options.reason || "sync", "health_check_failed");
        if (!options.background) setStatus("Нет подключения к интернету.", true);
        console.info(`[offline-startup] sync deferred reason=${options.reason || "background"} mode=offline`);
        auditWarning("sync_deferred_offline", "Синхронизация отложена: сайт недоступен.", {
          reason: options.reason || "background",
          duration_ms: Math.round(performance.now() - syncStartedAt),
          pending_total: state.pendingTotal,
        });
        return false;
      }
    }

    console.info(`[offline-startup] sync started reason=${options.reason || "background"}`);
    // Each leg gets its own timeout: the Rust side already enforces a 6s
    // network timeout per request, but if IPC itself stalls (DB lock, OS
    // file flush) we don't want the sync loop to wait forever.
    const message = await invokeWithTimeout("sync_records", { settings }, 60_000);
    await invokeWithTimeout("pull_records", { settings }, 60_000);
    await invokeWithTimeout("pull_all_today", { settings }, 60_000);
    await refreshAll();
    if (syncResultHasProblems(message)) {
      const partialMessage = `Синхронизация выполнена частично: ${message}`;
      setSyncUiStatus("error", partialMessage);
      auditWarning("sync_partial", "Синхронизация завершилась частично, часть очереди осталась локально.", {
        reason: options.reason || "background",
        duration_ms: Math.round(performance.now() - syncStartedAt),
        result: message,
        pending_total: state.pendingTotal,
      });
      if (!options.background) setStatus(partialMessage, true);
      return false;
    }
    state.lastSuccessfulSyncAt = await invoke("mark_sync_success");
    state.network.online = true;
    state.network.mode = "online";
    setSyncUiStatus("ok", "Синхронизировано");
    SyncService.markOnlineSuccess(state.lastSuccessfulSyncAt);
    if (successMessage && !options.background) setStatus(successMessage);
    else if (message.includes("уже отметили")) setStatus(message);
    console.info(`[offline-startup] sync success reason=${options.reason || "background"}`);
    auditInfo("sync_success", "Синхронизация успешно завершена.", {
      reason: options.reason || "background",
      duration_ms: Math.round(performance.now() - syncStartedAt),
      result: message,
      last_successful_sync_at: state.lastSuccessfulSyncAt,
    });
    return true;
  } catch (error) {
    console.error(error);
    const errorMessage = `Ошибка синхронизации: ${String(error)}`;
    if (isNetworkErrorText(error)) {
      markNetworkOffline(options.reason || "sync", String(error));
      scheduleReconnectWorker();
    } else {
      setSyncUiStatus("error", errorMessage);
    }
    console.warn(`[offline-startup] sync error reason=${options.reason || "background"}`, error);
    auditError("sync_failed", "Синхронизация завершилась ошибкой.", {
      reason: options.reason || "background",
      duration_ms: Math.round(performance.now() - syncStartedAt),
      error: String(error),
      pending_total: state.pendingTotal,
    });
    if (!options.background) setStatus(errorMessage, true);
    await refreshAll();
    return false;
  } finally {
    state.network.syncInProgress = false;
    updateSyncButton();
  }
}

const SyncService = (() => {
  let _timer = null;
  let _lastSyncAt = null;
  let _error = null;
  let _offline = false;
  const INTERVAL = AUTO_SYNC_INTERVAL_MS;

  function _el() { return document.getElementById("sync-indicator"); }

  function _renderIndicator() {
    const el = _el();
    if (!el) return;
    const timeEl    = el.querySelector(".sync-widget__time");
    const statusEl  = el.querySelector(".sync-widget__status");
    const labelEl   = el.querySelector(".sync-widget__label");
    const btn       = el.querySelector(".sync-widget__btn");
    const label = syncStatusMessage();
    const lastDate = parseSyncDate(state.lastSuccessfulSyncAt);
    const lastText = lastDate
      ? lastDate.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : "--:--";
    if (labelEl) labelEl.textContent = label;
    if (statusEl) statusEl.title = label;
    if (btn) {
      btn.disabled = state.network.syncInProgress;
      btn.title = state.network.syncInProgress ? "Идет синхронизация данных" : label;
    }

    if (state.network.syncInProgress) {
      el.className = "sync-widget sync-widget--syncing";
      if (timeEl)   timeEl.textContent = "...";
    } else if (state.longSyncWarningVisible) {
      el.className = "sync-widget sync-widget--warning";
      if (timeEl)   timeEl.textContent = lastText;
    } else if ((_error && state.syncUiStatus !== "ok") || state.syncUiStatus === "error") {
      el.className = "sync-widget sync-widget--error";
      if (timeEl)   timeEl.textContent = "Ошибка";
    } else if (_offline || state.syncUiStatus === "offline" || !state.network.online) {
      el.className = "sync-widget sync-widget--offline";
      if (timeEl)   timeEl.textContent = "--:--";
    } else if (hasPendingLocalChanges()) {
      el.className = "sync-widget sync-widget--pending";
      if (timeEl)   timeEl.textContent = lastText;
    } else if (_lastSyncAt || state.lastSuccessfulSyncAt) {
      el.className = "sync-widget sync-widget--ok";
      if (timeEl)   timeEl.textContent = lastText;
    } else {
      el.className = "sync-widget sync-widget--idle";
      if (timeEl)   timeEl.textContent = "--:--";
    }
  }

  async function _run() {
    if (state.network.syncInProgress) return;
    if (!state.network.online) {
      _offline = true;
      _renderIndicator();
      scheduleReconnectWorker();
      return;
    }
    _offline = false;
    await refreshPendingSyncSummary();
    const hasPendingSync = shouldAttemptBackgroundSync({
      online: state.network.online,
      syncInProgress: state.network.syncInProgress,
      pendingTotal: state.pendingTotal,
    });
    _renderIndicator();
    try {
      const ok = await syncNow("", {
        reason: hasPendingSync ? "auto" : "auto-periodic",
        background: true,
        periodic: !hasPendingSync,
      });
      if (ok) {
        _lastSyncAt = new Date();
        _error = null;
        _offline = false;
      } else if (!state.network.online) {
        _offline = true;
      } else if (hasPendingLocalChanges()) {
        _error = "Синхронизация не завершилась";
      }
    } catch (e) {
      _error = String(e).slice(0, 80);
      _offline = false;
      setSyncUiStatus("error", "Ошибка синхронизации");
    }
    _renderIndicator();
  }

  return {
    start() {
      if (_timer) clearInterval(_timer);
      _run();
      _timer = setInterval(_run, INTERVAL);
    },
    stop() {
      clearInterval(_timer);
      _timer = null;
    },
    markOnlineSuccess(marker = null) {
      _lastSyncAt = marker ? parseSyncDate(marker) || new Date() : new Date();
      _error = null;
      _offline = false;
      _renderIndicator();
    },
    markOnlineDetected() {
      _error = null;
      _offline = false;
      _renderIndicator();
    },
    runNow: _run,
    renderIndicator: _renderIndicator,
  };
})();

const AssemblyOrderPoller = (() => {
  const INTERVAL = 5000;
  const STORAGE_KEY = "assemblyOrdersDesktopLastSeenId";
  let _timer = null;
  let _inFlight = false;
  let _initialized = false;
  let _lastSeenId = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
  let _unseenCount = 0;
  let _urgentCount = 0;
  let _latestOrders = [];

  function _saveSeen(id) {
    _lastSeenId = id;
    localStorage.setItem(STORAGE_KEY, String(id));
  }

  function _updateBadge() {
    const badge = document.getElementById("assembly-orders-nav-badge");
    if (!badge) return;
    if (_unseenCount <= 0) {
      badge.classList.add("is-hidden");
    } else {
      badge.textContent = _unseenCount > 99 ? "99+" : String(_unseenCount);
      badge.classList.remove("is-hidden");
    }
  }

  function _hideNotice() {
    document.getElementById("assembly-orders-notice")?.remove();
  }

  function _showNotice() {
    _hideNotice();
    if (_unseenCount <= 0) return;
    const urgentText = _urgentCount > 0 ? ` Срочных: ${_urgentCount}.` : "";
    const names = _latestOrders.slice(-3).map((o) => o.name).filter(Boolean);
    const text = names.length ? names.join(", ") : "Откройте список заказов сборок.";
    const notice = document.createElement("div");
    notice.id = "assembly-orders-notice";
    notice.className = "assembly-orders-notice";
    notice.innerHTML = `
      <div class="assembly-orders-notice__main">
        <div class="assembly-orders-notice__title">Новый заказ сборки: ${_unseenCount}${urgentText}</div>
        <div class="assembly-orders-notice__text">${escapeHtml(text)}</div>
      </div>
      <div class="assembly-orders-notice__actions">
        <button type="button" class="assembly-orders-notice__open">Открыть</button>
        <button type="button" class="assembly-orders-notice__close" aria-label="Скрыть">×</button>
      </div>`;
    document.body.append(notice);
    notice.querySelector(".assembly-orders-notice__open").addEventListener("click", () => {
      AssemblyOrderPoller.markSeen();
      switchView("assembly-orders");
    });
    notice.querySelector(".assembly-orders-notice__close").addEventListener("click", _hideNotice);
  }

  function _showDesktopNotification(orders) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const count = orders.length;
    if (!count) return;
    const urgentInBatch = orders.filter((o) => o.is_urgent).length;
    const names = orders.slice(-3).map((o) => o.name).filter(Boolean);
    let body = names.length ? names.join(", ") : "Откройте заказы сборок.";
    if (urgentInBatch > 0) body += ` Срочных: ${urgentInBatch}.`;
    const n = new Notification(count === 1 ? "Новый заказ сборки" : `Новые заказы сборки: ${count}`, {
      body,
      tag: "assembly-orders",
    });
    n.onclick = () => { AssemblyOrderPoller.markSeen(); switchView("assembly-orders"); n.close(); };
  }

  async function _poll() {
    if (_inFlight || !state.network.online) return;
    _inFlight = true;
    try {
      const query = !_initialized
        ? "mobile/assembly/orders/?notifications&init=1"
        : `mobile/assembly/orders/?notifications&last_seen_id=${_lastSeenId}`;
      const data = await apiRequest("GET", query);
      if (!_initialized) {
        _saveSeen(data.last_seen_id ?? 0);
        _initialized = true;
        return;
      }
      const newOrders = data.orders || [];
      if (!newOrders.length) return;
      newOrders.forEach((o) => {
        _unseenCount++;
        if (o.is_urgent) _urgentCount++;
        _latestOrders.push(o);
        if (_latestOrders.length > 10) _latestOrders.shift();
        if (o.id > _lastSeenId) _saveSeen(o.id);
      });
      _updateBadge();
      _showNotice();
      _showDesktopNotification(newOrders);
    } catch (e) {
      // offline or no permission — silent
    } finally {
      _inFlight = false;
    }
  }

  return {
    start() {
      if (_timer) return;
      if (Notification.permission === "default") Notification.requestPermission().catch(() => {});
      _poll();
      _timer = setInterval(_poll, INTERVAL);
    },
    stop() {
      clearInterval(_timer);
      _timer = null;
      _initialized = false;
    },
    markSeen() {
      _unseenCount = 0;
      _urgentCount = 0;
      _updateBadge();
      _hideNotice();
    },
  };
})();

async function checkForUpdate({ manual = false } = {}) {
  if (!manual && (!state.network.online || shouldFastFailNetworkRequest())) {
    auditInfo("update_check_skipped_offline", "Проверка обновлений пропущена: нет интернета.", {
      manifest_url: UPDATE_MANIFEST_URL,
      manual,
      online: state.network.online,
      browser_online: browserIsOnline(),
    });
    return { available: false, skipped: "offline" };
  }
  if (updateCheckInProgress) {
    if (manual) showToast("Проверка обновлений уже выполняется.");
    return { available: false, in_progress: true };
  }
  updateCheckInProgress = true;
  const started = performance.now();
  auditInfo("update_check_start", manual ? "Ручная проверка обновлений запущена." : "Авто-проверка обновлений запущена.", {
    manifest_url: UPDATE_MANIFEST_URL,
    manual,
  });
  try {
    const result = await withTimeout(
      invoke("check_for_update"),
      UPDATE_CHECK_TIMEOUT_MS,
      "update check",
    );
    auditInfo("update_check_result", result?.available ? "Найдена новая версия программы." : "Новая версия программы не найдена.", {
      manifest_url: result?.manifest_url || UPDATE_MANIFEST_URL,
      current_version: result?.current_version,
      latest_version: result?.version,
      available: Boolean(result?.available),
      timeout_ms: UPDATE_CHECK_TIMEOUT_MS,
      duration_ms: Math.round(performance.now() - started),
      manual,
    });
    if (!result?.available) {
      if (manual) showToast(updateCheckMessage(result));
      return result;
    }
    showUpdateBanner(result.version, result.notes, result);
    return result;
  } catch (e) {
    const message = updateErrorMessage(e);
    auditError("update_check_failed", "Ошибка проверки обновлений.", {
      manifest_url: UPDATE_MANIFEST_URL,
      error: String(e),
      timeout_ms: UPDATE_CHECK_TIMEOUT_MS,
      duration_ms: Math.round(performance.now() - started),
      manual,
    });
    console.info("[updater] check skipped:", e);
    if (manual) {
      showToast(message, true);
      setStatus(message, true);
    }
    return { available: false, error: String(e) };
  } finally {
    updateCheckInProgress = false;
  }
}

function scheduleStartupUpdateCheck(source = "startup") {
  if (startupUpdateCheckStarted) return;
  startupUpdateCheckStarted = true;
  window.setTimeout(async () => {
    if (!state.network.online || shouldFastFailNetworkRequest()) {
      auditInfo("update_check_skipped_offline", "Стартовая проверка обновлений пропущена: нет интернета.", {
        source,
        online: state.network.online,
        browser_online: browserIsOnline(),
      });
      return;
    }
    await checkForUpdate({ manual: false });
  }, 0);
}

function showUpdateBanner(version, notes, result = {}) {
  const existing = document.getElementById("update-banner");
  if (existing) existing.remove();
  const banner = document.createElement("div");
  banner.id = "update-banner";
  banner.className = "update-banner";
  banner.innerHTML = `
    <div class="update-banner__icon" aria-hidden="true">↗</div>
    <div class="update-banner__content">
      <div class="update-banner__title">Доступно обновление</div>
      <div class="update-banner__text">
        Новая версия <strong>v${escapeHtml(version)}</strong> готова к установке.
      </div>
      <div class="update-banner__actions">
        <button class="update-banner__btn" id="update-apply-btn" type="button">Обновить</button>
        <button class="update-banner__btn update-banner__btn--secondary" id="update-dismiss-action-btn" type="button">Позже</button>
      </div>
    </div>
    <button class="update-banner__close" id="update-dismiss-btn" type="button" aria-label="Позже">×</button>
  `;
  document.body.append(banner);
  document.getElementById("update-apply-btn").addEventListener("click", async () => {
    const btn = document.getElementById("update-apply-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Устанавливаю..."; }
    auditInfo("update_install_start", "Начата установка обновления.", {
      current_version: result.current_version,
      latest_version: version,
      manifest_url: result.manifest_url || UPDATE_MANIFEST_URL,
    });
    try {
      await invoke("apply_update");
      auditInfo("update_install_success", "Обновление установлено, программа перезапускается.", {
        latest_version: version,
      });
    } catch (e) {
      const message = `Ошибка обновления: ${e}`;
      auditError("update_install_failed", "Ошибка установки обновления.", {
        latest_version: version,
        error: String(e),
      });
      showToast(message, true);
      setStatus(message, true);
      if (btn) { btn.disabled = false; btn.textContent = "Обновить"; }
    }
  });
  document.getElementById("update-dismiss-action-btn").addEventListener("click", () => banner.remove());
  document.getElementById("update-dismiss-btn").addEventListener("click", () => banner.remove());
}

async function pullFromSite(reason = "Обновляю данные с сайта...") {
  const settings = currentSettings();
  if (!hasSyncCredentials(settings)) {
    return;
  }
  const isAuto = reason.includes("Автоматически");
  try {
    if (!isAuto) setStatus(reason);
    auditInfo("pull_from_site_start", "Начато обновление локальных данных с сайта.", { reason, auto: isAuto });
    const online = await runHealthCheck(isAuto ? "auto-refresh" : "manual-refresh");
    if (!online) {
      if (!isAuto) setStatus("Сервер недоступен. Показаны локальные данные.");
      auditWarning("pull_from_site_offline", "Обновление с сайта отложено: сервер недоступен.", { reason, auto: isAuto });
      return;
    }
    const bootstrap = await invoke("login_and_bootstrap", { settings });
    applyBootstrap(bootstrap);
    await invoke("pull_records", { settings });
    await invoke("pull_all_today", { settings });
    await refreshAll();
    if (!isAuto) {
      setStatus(`Синхронизировано в ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}.`);
    }
    auditInfo("pull_from_site_success", "Локальные данные обновлены с сайта.", { reason, auto: isAuto });
  } catch (error) {
    console.error(error);
    auditError("pull_from_site_failed", "Ошибка обновления локальных данных с сайта.", { reason, auto: isAuto, error: String(error) });
    if (!isAuto) setStatus("Не синхронизировано с сайтом.");
  }
}

// ── Touch ID ──────────────────────────────────────────────────────────────────

let touchIdAvailable = false;

async function initTouchId() {
  try {
    touchIdAvailable = await invoke("check_biometric_available");
  } catch {
    touchIdAvailable = false;
  }
  updateTouchIdUi();

  const btn = document.querySelector("#touch-id-login-button");
  if (btn) {
    btn.addEventListener("click", loginWithBiometric);
  }

  const sdItem = document.querySelector("#sd-touch-id");
  if (sdItem) {
    sdItem.addEventListener("click", async () => {
      settingsDropdown.classList.add("is-hidden");
      const isEnabled = localStorage.getItem("touchIdEnabled") === "1";
      if (isEnabled) {
        await disableTouchId();
      } else {
        await enableTouchId();
      }
    });
  }
}

function updateTouchIdUi() {
  const isEnabled = localStorage.getItem("touchIdEnabled") === "1";
  const btn = document.querySelector("#touch-id-login-button");
  const sdItem = document.querySelector("#sd-touch-id");
  const sdLabel = document.querySelector("#sd-touch-id-label");

  if (btn) btn.classList.toggle("is-hidden", !(touchIdAvailable && isEnabled));
  if (sdItem) sdItem.classList.toggle("is-hidden", !touchIdAvailable);
  if (sdLabel) sdLabel.textContent = isEnabled ? "Выключить Touch ID" : "Включить Touch ID";
}

async function loginWithBiometric() {
  const btn = document.querySelector("#touch-id-login-button");
  if (btn) { btn.disabled = true; btn.textContent = "Подождите…"; }
  try {
    const password = await invoke("authenticate_and_get_password", {
      reason: "Войти в приложение Velo95Moto",
    });
    loginPasswordInput.value = password;
    await login({ preventDefault: () => {} });
  } catch (err) {
    showToast(String(err), true);
  } finally {
    if (btn) { btn.disabled = false; updateTouchIdUi(); }
  }
}

async function enableTouchId() {
  const password = currentSettings().password;
  if (!password) {
    showToast("Не удалось получить пароль. Перезайдите в систему.", true);
    return;
  }
  try {
    await invoke("save_credentials_to_keychain", { password });
    localStorage.setItem("touchIdEnabled", "1");
    updateTouchIdUi();
    showToast("Touch ID включён. Теперь можно входить по отпечатку.");
  } catch (err) {
    showToast("Не удалось сохранить в Keychain: " + String(err), true);
  }
}

async function disableTouchId() {
  try {
    await invoke("delete_credentials_from_keychain");
    localStorage.removeItem("touchIdEnabled");
    updateTouchIdUi();
    showToast("Touch ID выключен.");
  } catch (err) {
    showToast("Ошибка: " + String(err), true);
  }
}

function maybePromptTouchId() {
  if (!touchIdAvailable) return;
  if (localStorage.getItem("touchIdEnabled") === "1") return;
  setTimeout(() => {
    showToastWithAction("Хотите входить через Touch ID?", "Включить", enableTouchId);
  }, 800);
}

// ─────────────────────────────────────────────────────────────────────────────

async function startOfflineFirstStartup() {
  // Показываем форму немедленно, не ждём сеть
  loginStatus.textContent = "Введите пароль, чтобы открыть программу.";
  // Health check — в фоне, только обновляет статус-строку
  runHealthCheck("startup").then((online) => {
    console.info(`[offline-startup] startup mode=${online ? "online" : "offline"}`);
    auditInfo(online ? "startup_online" : "startup_offline", online ? "Запуск с доступным сервером." : "Запуск без интернета, используются локальные данные.", {
      online,
    });
    if (!online) {
      loginStatus.textContent = "Офлайн-режим. Введите пароль, чтобы открыть локальную базу.";
      scheduleReconnectWorker(nextReconnectDelayMs({ online: false, attempts: 0 }));
    } else {
      loginStatus.textContent = "Сервер доступен. Введите пароль, чтобы открыть программу.";
      scheduleReconnectWorker(nextReconnectDelayMs({ online: true }));
      scheduleStartupUpdateCheck("startup-online");
    }
  });
}

async function login(event) {
  event?.preventDefault?.();
  serverUrlInput.value = normalizeServerUrl(loginServerUrlInput.value);
  loginServerUrlInput.value = serverUrlInput.value;
  usernameInput.value = loginUsernameInput.value.trim();
  passwordInput.value = loginPasswordInput.value;
  saveSyncSettings();
  const settings = currentSettings();
  if (!hasSyncCredentials(settings)) {
    loginStatus.textContent = "Введите сайт, логин и пароль.";
    auditWarning("login_validation_failed", "Вход не начат: не заполнены сайт, логин или пароль.", {
      username: settings.username,
      server_url: settings.server_url,
    });
    return;
  }

  loginStatus.textContent = "Проверяю пароль...";
  auditInfo("login_start", "Пользователь начал вход в desktop-программу.", {
    username: settings.username,
    server_url: settings.server_url,
  });

  // Сначала мгновенная проверка локального пароля (не нужна сеть)
  const offlineAllowed = await canOpenOfflineWithPassword(settings);
  if (offlineAllowed) {
    const offlineBootstrap = restoreOfflineBootstrap();
    if (offlineBootstrap) applyBootstrap(offlineBootstrap);
    showLocalUi();
    syncPanel.classList.add("is-hidden");
    setStatus("Локальная база открыта. Синхронизация пойдёт в фоне.");
    auditInfo("login_offline_success", "Вход выполнен по локально подтверждённому паролю.", {
      username: settings.username,
      has_cached_bootstrap: Boolean(offlineBootstrap),
    });
    SyncService.start();
    scheduleReconnectWorker(nextReconnectDelayMs({ online: state.network.online, attempts: 0 }));
    maybePromptTouchId();
    if (state.bootstrap?.roles?.is_operator_role) AssemblyOrderPoller.start();
    return;
  }

  // Локальный пароль не совпал — нужен сервер
  loginStatus.textContent = "Проверяю через сервер...";
  const online = await runHealthCheck("login");

  if (!online) {
    loginStatus.textContent = "Нет связи с сервером, и этот пароль не подтверждён локально. Локальная база не открыта.";
    setStatus("Вход не выполнен.");
    auditWarning("login_offline_denied", "Вход офлайн отклонён: пароль не был подтверждён локально.", {
      username: settings.username,
    });
    scheduleReconnectWorker(nextReconnectDelayMs({ online: false, attempts: 0 }));
    return;
  }

  try {
    const bootstrap = await invoke("login_and_bootstrap", { settings });
    applyBootstrap(bootstrap);
    rememberSuccessfulLogin(settings, bootstrap);
    await rememberSuccessfulPassword(settings);
    showLocalUi();
    syncPanel.classList.add("is-hidden");
    setStatus("Вход выполнен. Локальная база открыта, синхронизация пойдёт в фоне.");
    auditInfo("login_success", "Вход выполнен через сервер.", {
      username: settings.username,
      display_name: bootstrap.user?.display_name || "",
      roles: bootstrap.roles || {},
    });
    SyncService.start();
    scheduleReconnectWorker(nextReconnectDelayMs({ online: true }));
    maybePromptTouchId();
    scheduleStartupUpdateCheck("login-online");
    if (state.bootstrap?.roles?.is_operator_role) AssemblyOrderPoller.start();
  } catch (error) {
    console.error(error);
    loginStatus.textContent = `Неверный логин или пароль. Локальная база не открыта.`;
    setStatus("Вход не выполнен.");
    auditError("login_failed", "Ошибка авторизации через сервер.", {
      username: settings.username,
      server_url: settings.server_url,
      error: String(error),
    });
  }
}

let loginHandlerAttached = false;

function attachLoginHandler() {
  if (loginHandlerAttached || !loginForm) return;
  loginForm.addEventListener("submit", login);
  loginHandlerAttached = true;
}

window.__VELO_LOGIN_SUBMIT__ = login;
window.__VELO_LOGIN_READY__ = true;
attachLoginHandler();

function initFloatingHoverCards() {
  const triggerSelector = ".summary6-name-anchor, .summary6-cell-anchor, .summary6-trend-anchor";
  let activeTrigger = null;
  let floatingCard = null;

  document.documentElement.classList.add("js-floating-tooltips");

  const getTrigger = (target) => {
    if (!target || !target.closest) return null;
    return target.closest(triggerSelector);
  };

  const removeFloatingCard = () => {
    activeTrigger = null;
    if (floatingCard) {
      floatingCard.remove();
      floatingCard = null;
    }
  };

  const positionFloatingCard = () => {
    if (!floatingCard || !activeTrigger || !activeTrigger.isConnected) {
      removeFloatingCard();
      return;
    }

    const margin = 12;
    const gap = 8;
    const rect = activeTrigger.getBoundingClientRect();

    floatingCard.style.left = "0px";
    floatingCard.style.top = "0px";
    floatingCard.style.visibility = "hidden";

    const cardRect = floatingCard.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + gap;

    if (left + cardRect.width > window.innerWidth - margin) {
      left = window.innerWidth - cardRect.width - margin;
    }
    if (left < margin) left = margin;

    if (top + cardRect.height > window.innerHeight - margin) {
      top = rect.top - cardRect.height - gap;
    }
    if (top < margin) top = margin;

    floatingCard.style.left = `${Math.round(left)}px`;
    floatingCard.style.top = `${Math.round(top)}px`;
    floatingCard.style.visibility = "visible";
  };

  const showFloatingCard = (trigger) => {
    const source = trigger?.querySelector(".summary6-hover-card");
    if (!source) {
      removeFloatingCard();
      return;
    }

    if (trigger === activeTrigger && floatingCard) {
      positionFloatingCard();
      return;
    }

    removeFloatingCard();
    activeTrigger = trigger;
    floatingCard = source.cloneNode(true);
    floatingCard.classList.add("is-floating");
    floatingCard.setAttribute("aria-hidden", "true");
    document.body.appendChild(floatingCard);
    positionFloatingCard();
  };

  document.addEventListener("mouseover", (event) => {
    const trigger = getTrigger(event.target);
    if (!trigger || trigger.contains(event.relatedTarget)) return;
    showFloatingCard(trigger);
  }, true);

  document.addEventListener("mouseout", (event) => {
    const trigger = getTrigger(event.target);
    if (!trigger || trigger.contains(event.relatedTarget)) return;
    removeFloatingCard();
  }, true);

  document.addEventListener("focusin", (event) => {
    const trigger = getTrigger(event.target);
    if (trigger) showFloatingCard(trigger);
  }, true);

  document.addEventListener("focusout", (event) => {
    const trigger = getTrigger(event.target);
    if (!trigger) return;
    window.setTimeout(() => {
      if (!document.activeElement || !trigger.contains(document.activeElement)) {
        removeFloatingCard();
      }
    }, 0);
  }, true);

  document.addEventListener("scroll", positionFloatingCard, true);
  window.addEventListener("resize", positionFloatingCard);
}

function normalizeAdminHelperText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}_\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function adminHelperTerms(query) {
  const terms = normalizeAdminHelperText(query).split(" ").filter(Boolean);
  const expanded = [];
  const seen = new Set();
  for (const term of terms) {
    const variants = [term, ...(ADMIN_HELPER_SYNONYMS[term] || [])];
    for (const variant of variants) {
      const normalized = normalizeAdminHelperText(variant);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        expanded.push(normalized);
      }
    }
  }
  return { terms, expanded };
}

function loadAdminHelperCache() {
  try {
    const raw = localStorage.getItem(ADMIN_HELPER_CACHE_KEY) || "[]";
    const parsed = JSON.parse(raw);
    state.adminHelperFeatures = Array.isArray(parsed) ? parsed : [];
  } catch {
    state.adminHelperFeatures = [];
  }
}

function saveAdminHelperCache(items) {
  state.adminHelperFeatures = Array.isArray(items) ? items : [];
  localStorage.setItem(ADMIN_HELPER_CACHE_KEY, JSON.stringify(state.adminHelperFeatures));
}

async function refreshAdminHelperCatalog() {
  if (!canShowAdminHelper(state.bootstrap)) return [];
  const data = await apiRequest("GET", "mobile/admin-helper/search/?limit=100");
  saveAdminHelperCache(data.results || []);
  return state.adminHelperFeatures;
}

function localAdminHelperSearch(query) {
  const normalized = normalizeAdminHelperText(query);
  const { terms, expanded } = adminHelperTerms(query);
  const source = state.adminHelperFeatures || [];
  const scored = [];

  for (const item of source) {
    const title = normalizeAdminHelperText(item.title);
    const fields = [
      [item.title, 120],
      [item.keywords, 80],
      [item.category, 45],
      [item.path_hint, 42],
      [item.open_hint, 35],
      [item.description, 28],
      [item.how_it_works, 24],
      [(item.related || []).join(" "), 14],
      [item.feature_type, 10],
    ];
    let score = normalized ? 0 : 1;
    if (normalized && title === normalized) score += 12000;
    else if (normalized && title.includes(normalized)) score += 4500;

    const matchedTerms = new Set();
    const matchedExpanded = new Set();
    for (const [value, weight] of fields) {
      const haystack = normalizeAdminHelperText(value);
      if (!haystack) continue;
      if (normalized && haystack.includes(normalized)) score += weight * 6;
      for (const term of terms) {
        if (haystack.includes(term)) {
          score += weight * 2;
          matchedTerms.add(term);
          matchedExpanded.add(term);
        }
      }
      for (const term of expanded) {
        if (haystack.includes(term)) {
          score += weight;
          matchedExpanded.add(term);
        }
      }
    }
    if (terms.length && matchedTerms.size === terms.length) score += 1800;
    else if (terms.length) score += Math.floor(700 * (matchedTerms.size / terms.length));
    if (expanded.length) score += Math.floor(250 * (matchedExpanded.size / expanded.length));
    score += Number(item.search_weight || 100);
    if (!normalized || score > Number(item.search_weight || 100)) scored.push({ score, item });
  }

  return scored
    .sort((a, b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title), "ru"))
    .slice(0, 12)
    .map((row) => row.item);
}

function adminHelperDesktopView(url) {
  const path = String(url || "").replace(PRODUCTION_SERVER_URL, "");
  if (path === "/staff/" || path.startsWith("/staff/?")) return "records";
  if (path.startsWith("/staff/assembly-order/new/")) return "assembly-order";
  if (path.startsWith("/staff/assembly-orders/")) return "assembly-orders";
  if (path.startsWith("/staff/assembly/")) return "assembly";
  if (path.startsWith("/staff/salary/")) return "salary";
  if (path.startsWith("/staff/advances/")) return "advances";
  if (path.startsWith("/staff/daily-timesheet/")) return "daily-timesheet";
  if (path.startsWith("/staff/summary/")) return "journal";
  if (path.startsWith("/staff/timesheet/")) return "timesheet";
  if (path.startsWith("/staff/audit-log/")) return "audit";
  if (path.startsWith("/staff/operator-cabinet/")) return "operator";
  if (path.startsWith("/staff/user-permissions/")) return "users";
  if (path.startsWith("/shop/manage/")) return "shop";
  return "";
}

function adminHelperSiteUrl(url) {
  const base = normalizeServerUrl(serverUrlInput.value || loginServerUrlInput.value || PRODUCTION_SERVER_URL);
  if (!url) return base;
  if (/^https?:\/\//i.test(url)) return url;
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

function fileExchangeSiteUrl() {
  return adminHelperSiteUrl("/staff/file-exchange/");
}

function renderAdminHelperResults(items, query, sourceLabel = "") {
  if (!adminHelperResults || !adminHelperStatus) return;
  adminHelperResults.innerHTML = "";
  if (!query) {
    adminHelperStatus.textContent = "Введите запрос, чтобы найти функцию.";
    return;
  }
  if (!items.length) {
    adminHelperStatus.textContent = "Ничего не найдено. Попробуйте другое слово.";
    return;
  }
  adminHelperStatus.textContent = `Найдено: ${items.length}${sourceLabel}`;

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "admin-helper-card";
    const top = document.createElement("div");
    top.className = "admin-helper-card-top";
    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = item.title || "Без названия";
    titleWrap.append(title);
    if (item.category) {
      const category = document.createElement("span");
      category.className = "admin-helper-category";
      category.textContent = item.category;
      titleWrap.append(category);
    }
    const openButton = document.createElement("button");
    openButton.className = "admin-helper-open";
    openButton.type = "button";
    const desktopView = adminHelperDesktopView(item.url);
    openButton.textContent = desktopView ? "Открыть" : "Открыть сайт";
    openButton.addEventListener("click", async () => {
      if (desktopView) {
        closeAdminHelper();
        switchView(desktopView);
        return;
      }
      await window.__TAURI__.opener.openUrl(adminHelperSiteUrl(item.url));
    });
    top.append(titleWrap, openButton);
    card.append(top);
    if (item.description) {
      const description = document.createElement("p");
      description.textContent = item.description;
      card.append(description);
    }
    if (item.path_hint) {
      const path = document.createElement("div");
      path.className = "admin-helper-path";
      path.textContent = `Где находится: ${item.path_hint}`;
      card.append(path);
    }
    if (item.how_it_works) {
      const how = document.createElement("p");
      how.textContent = item.how_it_works;
      card.append(how);
    }
    if (item.open_hint) {
      const openHint = document.createElement("p");
      openHint.textContent = item.open_hint;
      card.append(openHint);
    }
    if (!desktopView) {
      const siteOnly = document.createElement("p");
      siteOnly.textContent = "Доступно только на сайте.";
      card.append(siteOnly);
    }
    if (item.related?.length) {
      const related = document.createElement("div");
      related.className = "admin-helper-related";
      for (const label of item.related) {
        const chip = document.createElement("span");
        chip.textContent = label;
        related.append(chip);
      }
      card.append(related);
    }
    adminHelperResults.append(card);
  }
}

let adminHelperDebounce = null;

async function searchAdminHelper({ refresh = false } = {}) {
  const query = adminHelperQuery?.value.trim() || "";
  if (!query) {
    renderAdminHelperResults([], "");
    return;
  }
  let sourceLabel = "";
  try {
    if (refresh || !state.adminHelperFeatures.length) {
      adminHelperStatus.textContent = "Обновляю справочник...";
      await refreshAdminHelperCatalog();
    }
  } catch {
    loadAdminHelperCache();
    sourceLabel = state.adminHelperFeatures.length ? " (офлайн-кэш)" : "";
  }
  renderAdminHelperResults(localAdminHelperSearch(query), query, sourceLabel);
}

function scheduleAdminHelperSearch() {
  window.clearTimeout(adminHelperDebounce);
  adminHelperDebounce = window.setTimeout(() => searchAdminHelper(), 220);
}

function openAdminHelper() {
  if (!canShowAdminHelper(state.bootstrap)) return;
  if (!adminHelperPanel || !adminHelperQuery) return;
  adminHelperPanel.classList.add("is-open");
  adminHelperPanel.setAttribute("aria-hidden", "false");
  adminHelperQuery.focus();
  searchAdminHelper();
}

async function openFileExchange() {
  if (!canShowFileExchange(state.bootstrap)) return;
  try {
    await window.__TAURI__.opener.openUrl(fileExchangeSiteUrl());
  } catch (error) {
    setStatus(`Не удалось открыть файлообменник: ${error}`);
  }
}

function closeAdminHelper() {
  adminHelperPanel?.classList.remove("is-open");
  adminHelperPanel?.setAttribute("aria-hidden", "true");
}

function initAdminHelper() {
  loadAdminHelperCache();
  adminHelperQuery?.setAttribute("autocomplete", "off");
  adminHelperQuery?.setAttribute("data-lpignore", "true");
  adminHelperQuery?.setAttribute("data-1p-ignore", "true");
  adminHelperOpen?.addEventListener("click", openAdminHelper);
  fileExchangeOpen?.addEventListener("click", openFileExchange);
  adminHelperClose?.addEventListener("click", closeAdminHelper);
  adminHelperPanel?.addEventListener("click", (event) => {
    if (event.target === adminHelperPanel) closeAdminHelper();
  });
  adminHelperQuery?.addEventListener("input", scheduleAdminHelperSearch);
  adminHelperQuery?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchAdminHelper({ refresh: true });
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && adminHelperPanel?.classList.contains("is-open")) {
      closeAdminHelper();
    }
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  loadSyncSettings();
  attachLoginHandler();
  initFloatingHoverCards();
  initAdminHelper();
  invoke("get_desktop_log_path").then((path) => {
    auditInfo("desktop_log_ready", "Файл журнала desktop-программы готов.", { path });
  }).catch(() => {});
  if (recordDetailsModal && recordDetailsModal.parentElement !== document.body) {
    document.body.append(recordDetailsModal);
  }
  assemblyDate.textContent = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  try {
    await invoke("init_database");
    auditInfo("desktop_startup", "Desktop-программа запущена, локальная база инициализирована.");
    startUiFreezeWatchdog();
    // Мгновенный старт: UI из локальной SQLite, сеть не ждём
    await refreshAll();
    renderNavigation();
    // Показываем статус синхронизации из прошлого сеанса
    try {
      const syncInfo = await invoke("get_sync_info");
      if (syncInfo.is_first_sync) {
        setStatus("Введите логин и пароль, чтобы загрузить данные с сайта.");
      } else {
        state.lastSuccessfulSyncAt = syncInfo.last_successful_sync_at || syncInfo.last_records_sync_at || state.lastSuccessfulSyncAt;
        const ts = state.lastSuccessfulSyncAt;
        const dt = ts ? new Date(ts) : null;
        const timeStr = dt
          ? dt.toLocaleTimeString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
          : "—";
        setStatus(`Последняя синхронизация: ${timeStr}. Данные из локальной базы.`);
      }
      await refreshPendingSyncSummary();
    } catch {
      setStatus("Данные из локальной базы.");
    }
    window.setTimeout(startOfflineFirstStartup, 0);
  } catch (error) {
    console.error(error);
    auditError("desktop_startup_failed", "Ошибка запуска desktop-программы или локальной базы.", { error: String(error) });
    setStatus(`Ошибка локальной базы: ${error}`);
  }

  function applyMoneyFieldBehavior(input) {
    input.addEventListener("focus", () => {
      if (input.value === "0") input.value = "";
    });
    input.addEventListener("input", () => {
      const raw = String(input.value || "").replace(/\D/g, "");
      input.value = raw ? raw.replace(/^0+(?=\d)/, "") : "";
      updateRecordTotal();
    });
    input.addEventListener("blur", () => {
      normalizeAmountField(input);
      updateRecordTotal();
      updateRecordSubmitState();
    });
  }
  applyMoneyFieldBehavior(partsInput);
  applyMoneyFieldBehavior(servicesInput);
  newRecordPhoneInput.addEventListener("focus", () => {
    if (!newRecordPhoneInput.value.trim()) newRecordPhoneInput.value = "+7";
  });
  newRecordPhoneInput.addEventListener("keydown", (event) => {
    if ((event.key === "Backspace" || event.key === "Delete") && newRecordPhoneInput.selectionStart <= 2 && newRecordPhoneInput.selectionEnd <= 2) {
      event.preventDefault();
    }
  });
  newRecordPhoneInput.addEventListener("input", () => {
    newRecordPhoneInput.value = formatPhoneInputValue(newRecordPhoneInput.value);
    updateRecordSubmitState();
  });
  newRecordPhoneInput.addEventListener("paste", (event) => {
    event.preventDefault();
    const pasted = (event.clipboardData || window.clipboardData).getData("text") || "";
    newRecordPhoneInput.value = formatPhoneInputValue(pasted);
    updateRecordSubmitState();
  });
  [titleInput, clientNameInput, masterSelect, commentsInput, freeRepairInput].forEach((input) => {
    input?.addEventListener("input", updateRecordSubmitState);
    input?.addEventListener("change", updateRecordSubmitState);
  });
  updateRecordSubmitState();
  assemblySearch.addEventListener("input", loadAssemblies);


  advancesSearch?.addEventListener("input", renderAdvances);
  phoneFilter.addEventListener("input", () => {
    state.recordsFiltersDirty = true;
    state.currentPage = 1;
    filterRecords();
  });
  [masterFilter, collectedFilter, startDateFilter, endDateFilter].forEach((input) => {
    input.addEventListener("change", () => {
      state.recordsFiltersDirty = true;
      state.currentPage = 1;
      filterRecords();
    });
  });
  document.querySelector("#toggle-filters").addEventListener("click", () => {
    filtersPanel.classList.toggle("is-hidden");
  });
  document.querySelector("#reset-filters").addEventListener("click", () => {
    phoneFilter.value = "";
    masterFilter.value = "";
    collectedFilter.value = "";
    startDateFilter.value = "";
    endDateFilter.value = "";
    state.recordsFiltersDirty = true;
    state.currentPage = 1;
    filterRecords();
  });
  selectAllCheckbox.addEventListener("change", () => {
    const start = (state.currentPage - 1) * state.perPage;
    const pageRecords = state.filteredRecords.slice(start, start + state.perPage);
    for (const record of pageRecords) {
      const id = recordStableId(record);
      if (selectAllCheckbox.checked) {
        state.selectedRecordIds.add(id);
      } else {
        state.selectedRecordIds.delete(id);
      }
    }
    renderRecords();
  });
  searchSelectAllCheckbox?.addEventListener("change", () => {
    const digits = String(state.headerSearchQuery || "").replace(/\D/g, "");
    const results = digits
      ? state.records.filter((record) => String(record.phone || "").replace(/\D/g, "").includes(digits))
      : [];
    for (const record of results) {
      const id = recordStableId(record);
      if (searchSelectAllCheckbox.checked) {
        state.selectedRecordIds.add(id);
      } else {
        state.selectedRecordIds.delete(id);
      }
    }
    renderHeaderSearchResults(state.headerSearchQuery);
  });
  recordsBody.addEventListener("change", handleRecordCheckboxChange);
  searchRecordsBody?.addEventListener("change", handleRecordCheckboxChange);
  recordsBody.addEventListener("click", handleRecordTableClick);
  searchRecordsBody?.addEventListener("click", handleRecordTableClick);
  recordForm.addEventListener("submit", saveRecord);
  editRecordForm.addEventListener("submit", saveEditedRecord);
  editPasswordForm.addEventListener("submit", confirmEditPassword);
  document.querySelector("#edit-password-close").addEventListener("click", closeEditPasswordModal);
  document.querySelector("#edit-password-cancel").addEventListener("click", closeEditPasswordModal);
  editPartsInput.addEventListener("input", updateEditTotal);
  editServicesInput.addEventListener("input", updateEditTotal);
  document.querySelector("#edit-close-button").addEventListener("click", () => recordEditModal.close());
  document.querySelector("#edit-cancel-button").addEventListener("click", () => recordEditModal.close());
  assemblyList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".assembly-chip-delete");
    if (deleteButton) {
      const entryId = deleteButton.dataset.assemblyEntryId;
      console.debug(`[assembly] clicked delete, entry_id=${entryId}`);
      const confirmed = await showConfirm("Удалить запись сборки?");
      console.debug(`[assembly] confirm=${confirmed}`);
      if (confirmed) {
        console.debug(`[assembly] delete request started, entry_id=${entryId}`);
        try {
          await deleteAssemblyEntry(entryId);
          console.debug(`[assembly] delete success, entry_id=${entryId}`);
        } catch (error) {
          console.error(`[assembly] delete error:`, error);
          setStatus(`Не удалось удалить сборку: ${error}`);
        }
      }
      return;
    }

    const quickButton = event.target.closest("[data-assembly-quick]");
    if (quickButton) {
      const input = document.getElementById(quickButton.dataset.assemblyQuick);
      if (input) {
        input.value = quickButton.dataset.amount;
        input.focus();
      }
      return;
    }

    const addButton = event.target.closest("[data-assembly-add]");
    if (addButton) {
      const input = document.getElementById(addButton.dataset.assemblyAdd);
      if (input) await saveAssemblyForCollector(addButton.dataset.collectorName, input, addButton);
    }
  });
  assemblyList.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" || !event.target.classList.contains("assembly-amount-input")) return;
    event.preventDefault();
    const card = event.target.closest(".assembly-card");
    const addButton = card?.querySelector("[data-assembly-add]");
    if (addButton) await saveAssemblyForCollector(addButton.dataset.collectorName, event.target, addButton);
  });
  assemblyOrderForm?.addEventListener("submit", createAssemblyOrder);
  [assemblyOrderCreateList, assemblyOrdersList].forEach((target) => {
    target?.addEventListener("click", async (event) => {
      const actionButton = event.target.closest("[data-order-action]");
      if (!actionButton) return;
      try {
        const action = actionButton.dataset.orderAction === "assign" ? "advance" : actionButton.dataset.orderAction;
        await changeAssemblyOrder(actionButton.dataset.orderId, action, actionButton.dataset.collectorName || "");
      } catch (error) {
        console.error(error);
        setStatus(`Не удалось изменить заказ сборки: ${error}`);
      }
    });
  });
  advancesList?.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".adv-chip-delete");
    if (deleteButton) {
      const localId = deleteButton.dataset.advanceId;
      console.debug(`[advances] clicked delete, local_id=${localId}`);
      const confirmed = await showConfirm("Удалить запись аванса? Это действие нельзя отменить.");
      console.debug(`[advances] confirm=${confirmed}`);
      if (confirmed) {
        console.debug(`[advances] delete request started, local_id=${localId}`);
        try {
          await deleteAdvance(localId);
          console.debug(`[advances] delete success, local_id=${localId}`);
        } catch (error) {
          console.error(`[advances] delete error:`, error);
          setStatus(`Не удалось удалить аванс: ${error}`);
        }
      }
      return;
    }

    const quickButton = event.target.closest("[data-advance-quick]");
    if (quickButton) {
      const input = document.getElementById(quickButton.dataset.advanceQuick);
      if (input) {
        input.value = quickButton.dataset.amount;
        input.focus();
      }
      return;
    }

    const addButton = event.target.closest("[data-advance-add]");
    if (addButton) {
      const input = document.getElementById(addButton.dataset.advanceAdd);
      if (input) await saveAdvanceForEmployee(addButton.dataset.employeeName, input, addButton);
    }
  });
  advancesList?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" || !event.target.classList.contains("adv-input")) return;
    event.preventDefault();
    const card = event.target.closest(".adv-card");
    const addButton = card?.querySelector("[data-advance-add]");
    if (addButton) await saveAdvanceForEmployee(addButton.dataset.employeeName, event.target, addButton);
  });
  dailyTimesheetDateForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    loadDailyTimesheetView();
  });
  dailyTimesheetSaveForm?.addEventListener("submit", saveDailyTimesheet);
  dailyTimesheetBody?.addEventListener("click", (event) => {
    const lateButton = event.target.closest(".btn-late-toggle");
    if (!lateButton || lateButton.disabled) return;
    lateButton.classList.toggle("is-active");
  });
  dailyTimesheetBody?.addEventListener("change", (event) => {
    if (!event.target.matches('input[type="radio"][name^="status_"]')) return;
    const row = event.target.closest("tr[data-employee-id]");
    if (row) syncDailyLateButton(row);
  });
  dailyTimesheetBody?.addEventListener("focusin", (event) => {
    if (event.target.classList.contains("js-daily-money") && event.target.value === "0") event.target.value = "";
  });
  dailyTimesheetBody?.addEventListener("input", (event) => {
    if (!event.target.classList.contains("js-daily-money")) return;
    event.target.value = String(event.target.value || "").replace(/\D/g, "");
  });
  dailyTimesheetBody?.addEventListener("focusout", (event) => {
    if (event.target.classList.contains("js-daily-money")) normalizeDailyMoneyInput(event.target);
  });
  dailyReportButton?.addEventListener("click", openDailyReport);
  document.querySelector("#daily-report-close")?.addEventListener("click", () => dailyReportModal.close());
  journalMonthForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    hideJournalMonthPicker();
    loadJournalView();
  });
  journalMonthInput?.addEventListener("focus", showJournalMonthPicker);
  journalMonthInput?.addEventListener("click", showJournalMonthPicker);
  journalMonthPicker?.addEventListener("click", (event) => {
    const navButton = event.target.closest("[data-month-nav]");
    if (navButton) {
      const year = Number(journalMonthPicker.dataset.year || new Date().getFullYear()) + Number(navButton.dataset.monthNav || 0);
      renderJournalMonthPicker(`${year}-${String(Number((journalMonthInput?.value || state.journal.month || monthValue(todayIsoDate())).slice(5, 7)) || 1).padStart(2, "0")}`);
      journalMonthPicker.classList.add("is-open");
      return;
    }
    const monthButton = event.target.closest("[data-month-value]");
    if (!monthButton) return;
    if (journalMonthInput) journalMonthInput.value = monthButton.dataset.monthValue;
    state.journal.month = monthButton.dataset.monthValue;
    renderJournalMonthPicker(monthButton.dataset.monthValue);
    hideJournalMonthPicker();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".journal-month-picker-wrap")) return;
    hideJournalMonthPicker();
  });
  [journalSearch, journalEmployeeType, journalHighlightFilter].forEach((input) => {
    input?.addEventListener("input", syncJournalFilters);
    input?.addEventListener("change", syncJournalFilters);
  });
  journalBody?.addEventListener("click", (event) => {
    const row = event.target.closest(".summary6-data-row");
    if (!row || row.classList.contains("summary6-row-hidden")) return;
    setJournalSelection(row.dataset.journalId);
  });
  journalSidePanel?.addEventListener("click", (event) => {
    if (!event.target.closest(".journal-side-close")) return;
    setJournalSelection("");
  });
  salaryFilterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadSalaryView();
  });
  salaryContent.addEventListener("click", async (event) => {
    const detailsButton = event.target.closest(".salary-view-details");
    if (detailsButton) {
      const record = state.salaryRecords.find((item) => recordStableId(item) === detailsButton.dataset.id);
      if (record) showRecordDetails(record);
      return;
    }

    const phoneLink = event.target.closest(".whatsapp-link");
    if (phoneLink) {
      event.preventDefault();
      const record = state.salaryRecords.find((item) => recordStableId(item) === phoneLink.dataset.id);
      if (!record || record.collected) return;
      const opened = await openWhatsAppForRecord(record);
      if (opened) await notifyClient(record, "whatsapp");
      return;
    }

    const collectButton = event.target.closest(".salary-collect-record");
    if (collectButton) {
      try {
        await invoke("mark_record_collected", { recordKey: collectButton.dataset.id });
        auditInfo("salary_record_collected_local", "Запись из раздела зарплаты отмечена как забранная локально.", {
          record_key: collectButton.dataset.id,
          queued_for_sync: true,
        });
        setAdminStatus(salaryStatus, "Запись отмечена как 'Забрал' локально. Синхронизация пойдёт в фоне.");
        queueBackgroundSync("salary-record-collected", "Запись отмечена как 'Забрал' и синхронизирована с сайтом.");
        await loadSalaryView();
      } catch (error) {
        console.error(error);
        auditError("salary_record_collected_failed", "Ошибка отметки записи как забранной из раздела зарплаты.", {
          record_key: collectButton.dataset.id,
          error: String(error),
        });
        setAdminStatus(salaryStatus, `Не удалось отметить 'Забрал': ${error}`, true);
      }
    }
  });
  attachLoginHandler();
  function openSearch() {
    const query = headerPhoneSearch.value.trim();
    if (!query) return;
    if (state.currentView !== "records-search") {
      state.previousView = state.currentView;
      console.debug("[search] previousView saved:", state.previousView);
    }
    console.debug("[search] search opened");
    switchView("records-search");
    renderHeaderSearchResults(query);
  }

  function closeSearch() {
    const target = state.previousView || "records";
    state.previousView = null;
    console.debug("[search] search cleared, returned to:", target);
    switchView(target);
  }

  headerSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    openSearch();
  });

  // Обрабатываем очистку: input (Backspace/ввод) и search (× кнопка в WebKit)
  function handleSearchInput() {
    if (headerPhoneSearch.value === "" && state.currentView === "records-search") {
      closeSearch();
    }
  }
  headerPhoneSearch.addEventListener("input", handleSearchInput);
  headerPhoneSearch.addEventListener("search", handleSearchInput);
  logoutButton.addEventListener("click", logout);
  document.querySelector("#brand-title-btn")?.addEventListener("click", openDefaultRecordsView);
  document.querySelector("#brand-mark-btn")?.addEventListener("click", openDefaultRecordsView);
  document.querySelector("#sync-run-btn")?.addEventListener("click", syncPendingRecords);
  syncButton.addEventListener("click", syncPendingRecords);
  window.addEventListener("offline", () => {
    state.network.online = false;
    state.network.mode = "offline";
    setSyncUiStatus("offline", "Нет интернета");
    setStatus("Нет интернета.");
    auditWarning("network_offline", "Браузер сообщил о потере интернета.", {
      pending_total: state.pendingTotal,
    });
    scheduleReconnectWorker(nextReconnectDelayMs({ online: false, attempts: 0 }));
  });
  window.addEventListener("online", async () => {
    auditInfo("network_online_event", "Браузер сообщил о восстановлении интернета.");
    const online = await runHealthCheck("browser-online");
    if (online) {
      await handleConfirmedOnline("browser-online");
    }
  });
  updateRecordTotal();

  settingsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    settingsDropdown.classList.toggle("is-hidden");
  });

  document.addEventListener("click", (event) => {
    if (!settingsWrapper.contains(event.target)) {
      settingsDropdown.classList.add("is-hidden");
    }
  });

  document.querySelector("#sd-timesheet").addEventListener("click", () => { settingsDropdown.classList.add("is-hidden"); switchView("timesheet"); });
  document.querySelector("#sd-audit").addEventListener("click", () => { settingsDropdown.classList.add("is-hidden"); switchView("audit"); });
  document.querySelector("#sd-operator").addEventListener("click", () => { settingsDropdown.classList.add("is-hidden"); switchView("operator"); });
  document.querySelector("#sd-admin").addEventListener("click", () => { settingsDropdown.classList.add("is-hidden"); switchView("users"); });
  document.querySelector("#sd-shop").addEventListener("click", () => { settingsDropdown.classList.add("is-hidden"); switchView("shop"); });
  document.querySelector("#sd-update").addEventListener("click", () => {
    settingsDropdown.classList.add("is-hidden");
    checkForUpdate({ manual: true });
  });

  initTouchId();

  // ── Collapsible filter in journal ────────────────────────────────
  const filterToggle = document.querySelector("#journal-filter-toggle");
  const filterBody   = document.querySelector("#journal-filter-body");
  if (filterToggle && filterBody) {
    filterToggle.addEventListener("click", () => {
      const isOpen = filterBody.classList.toggle("is-open");
      filterToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // ── Collapsible KPI summary in journal ───────────────────────────
  const kpiToggle = document.querySelector("#journal-kpi-toggle");
  const kpiBody   = document.querySelector("#journal-kpi-body");
  if (kpiToggle && kpiBody) {
    kpiToggle.addEventListener("click", () => {
      const isOpen = kpiBody.classList.toggle("is-open");
      kpiToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // ── Admin views init ──────────────────────────────────────────────
  initTimesheetView();
  initAdvanceDebtPanels();
  initEmpAddModal();
  initAuditView();
  initOperatorView();
  initUsersView();
  initShopView();

  // ── Notification tooltip ──────────────────────────────────────────
  const notifyTooltipEl = document.getElementById("notify-tooltip");
  function placeNotifyTooltip(button) {
    const rect = button.getBoundingClientRect();
    const margin = 10;
    const w = notifyTooltipEl.offsetWidth;
    const h = notifyTooltipEl.offsetHeight;
    let left = rect.left + rect.width / 2 - w / 2;
    let top = rect.bottom + margin;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    if (top + h > window.innerHeight - 12) top = Math.max(12, rect.top - h - margin);
    notifyTooltipEl.style.left = `${left}px`;
    notifyTooltipEl.style.top = `${top}px`;
  }
  document.addEventListener("mouseover", (event) => {
    const btn = event.target.closest(".notify-client-btn");
    if (!btn) return;
    if (btn.disabled || btn.classList.contains("is-disabled")) return;
    if (btn.contains(event.relatedTarget)) return;
    const text = btn.dataset.notificationTooltip || "Клиент не уведомлен";
    notifyTooltipEl.textContent = text;
    notifyTooltipEl.classList.add("is-visible");
    placeNotifyTooltip(btn);
  });
  document.addEventListener("mouseout", (event) => {
    const btn = event.target.closest(".notify-client-btn");
    if (!btn) return;
    if (btn.contains(event.relatedTarget)) return;
    notifyTooltipEl.classList.remove("is-visible");
  });
  document.addEventListener("scroll", () => notifyTooltipEl.classList.remove("is-visible"), true);
  window.addEventListener("resize", () => notifyTooltipEl.classList.remove("is-visible"));

  // Close dropdowns when clicking outside them
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".nav-dropdown")) {
      closeAllDropdowns();
    }
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSettings() {
  return {
    server_url: normalizeServerUrl(serverUrlInput.value || loginServerUrlInput.value),
    username: (usernameInput.value || loginUsernameInput.value || "").trim(),
    password: passwordInput.value || loginPasswordInput.value || "",
  };
}

function getToken() {
  return state.bootstrap?.access_token || "";
}

async function apiRequest(method, path, body = null) {
  const settings = currentSettings();
  const serverUrl = settings.server_url;
  let token = getToken();
  const started = performance.now();

  if (shouldFastFailNetworkRequest()) {
    const message = "Нет подключения к интернету";
    auditWarning("api_request_skipped_offline", "Запрос mobile API пропущен: программа офлайн.", {
      method,
      endpoint: path,
    });
    throw new Error(message);
  }

  // Токен пустой — случается после офлайн-входа (access_token не хранится в localStorage).
  // Пробуем получить свежий, если сеть доступна.
  if (!token && hasSyncCredentials(settings) && state.network.online) {
    try {
      const freshBootstrap = await invoke("login_and_bootstrap", { settings });
      applyBootstrap(freshBootstrap);
      token = getToken();
      console.debug(`[api] token refreshed for ${method} ${path} — scheme=Bearer len=${token.length}`);
      auditInfo("auth_token_refreshed", "Токен авторизации обновлён для mobile API.", { method, endpoint: path });
    } catch (err) {
      console.warn(`[api] token refresh failed for ${method} ${path}:`, String(err).slice(0, 120));
      auditWarning("auth_token_refresh_failed", "Не удалось обновить токен авторизации.", {
        method,
        endpoint: path,
        error: String(err),
      });
    }
  }

  if (!token) {
    console.warn(`[api] ${method} ${path} — token MISSING, request will fail`);
    auditWarning("api_request_no_token", "Запрос mobile API выполняется без токена.", { method, endpoint: path });
  } else {
    console.debug(`[api] ${method} ${path} — auth=Bearer present`);
  }

  const args = { serverUrl, token, method, path };
  if (body !== null) args.body = body;
  try {
    // Rust's ureq enforces a 6s total timeout per request, but the IPC bridge
    // itself can stall (Tauri queueing, DB lock on writes) — cap end-to-end.
    const result = await invokeWithTimeout("api_request", args, 20_000);
    const duration = Math.round(performance.now() - started);
    if (duration > 1500) {
      auditWarning("api_request_slow", "Медленный запрос mobile API.", { method, endpoint: path, duration_ms: duration });
    } else if (String(method).toUpperCase() !== "GET") {
      auditInfo("api_request_success", "Запрос mobile API выполнен.", { method, endpoint: path, duration_ms: duration });
    }
    return result;
  } catch (error) {
    if (isNetworkErrorText(error)) {
      markNetworkOffline(`api:${method}`, String(error));
      scheduleReconnectWorker();
    }
    auditError("api_request_failed", "Ошибка запроса mobile API.", {
      method,
      endpoint: path,
      duration_ms: Math.round(performance.now() - started),
      payload: body,
      error: String(error),
    });
    throw error;
  }
}

function setAdminStatus(el, msg, isError = false) {
  if (!el) return;
  el.textContent = msg;
  el.className = "page-status" + (msg ? " is-visible" : "") + (isError ? " is-error" : "");
}

function showToast(message, isError = false) {
  const container = document.querySelector("#toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast" + (isError ? " toast--error" : "");
  toast.textContent = message;
  container.append(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));
  setTimeout(() => {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showToastWithAction(message, actionLabel, actionFn) {
  const container = document.querySelector("#toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast toast--action";

  const msgSpan = document.createElement("span");
  msgSpan.textContent = message;

  const btn = document.createElement("button");
  btn.className = "toast__action-btn";
  btn.textContent = actionLabel;
  btn.addEventListener("click", () => {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 300);
    actionFn();
  });

  toast.append(msgSpan, btn);
  container.append(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));
  setTimeout(() => {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 300);
  }, 9000);
}

function showConfirm(message, okLabel = "Удалить") {
  return new Promise((resolve) => {
    const dialog = document.querySelector("#confirm-dialog");
    const msgEl  = document.querySelector("#confirm-dialog-message");
    const okBtn  = document.querySelector("#confirm-dialog-ok");
    const cancelBtn = document.querySelector("#confirm-dialog-cancel");
    if (!dialog) { resolve(false); return; }

    msgEl.textContent = message;
    okBtn.textContent = okLabel;

    const cleanup = (result) => {
      dialog.removeEventListener("keydown", onKey);
      dialog.removeEventListener("click",   onBackdrop);
      okBtn.removeEventListener("click",    onOk);
      cancelBtn.removeEventListener("click", onCancel);
      dialog.close();
      resolve(result);
    };

    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onKey    = (e) => { if (e.key === "Enter") { e.preventDefault(); cleanup(true); } };
    const onBackdrop = (e) => { if (e.target === dialog) cleanup(false); };

    okBtn.addEventListener("click",    onOk);
    cancelBtn.addEventListener("click", onCancel);
    dialog.addEventListener("keydown", onKey);
    dialog.addEventListener("click",   onBackdrop);

    dialog.showModal();
    okBtn.focus();
  });
}

// ── БУХГАЛТЕРИЯ ───────────────────────────────────────────────────────────────

let buhEmployeeMap = {};
let buhPositions = [];
let buhDepartments = [];
let buhWeekdays = [];
let buhHolidayMonth = "";
let buhHolidayDates = new Set();
let buhHolidayMonthClosed = false;

function initTimesheetView() {
  initInlineEmployeeForm();
  initEmpModal();
  initEmpReportModal();
  initDebtPanels();
  initPaidHolidayModal();
}

function initDebtPanels() {
  const issueForm = document.querySelector("#debt-issue-form");
  const returnForm = document.querySelector("#debt-return-form");

  issueForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const resultEl = document.querySelector("#debt-issue-result");
    resultEl.textContent = "";
    resultEl.className = "debt-panel__result";
    const employeeId = parseInt(document.querySelector("#debt-issue-emp").value, 10);
    const amount = parseInt(document.querySelector("#debt-issue-amount").value, 10);
    const comment = document.querySelector("#debt-issue-comment").value.trim();
    if (!employeeId || !amount || amount <= 0) return;
    try {
      const data = await apiRequest("POST", "mobile/employees/debt/", { action_type: "issue_debt", employee_id: employeeId, amount, comment });
      showToast(data.message);
      issueForm.reset();
      document.querySelector("#debt-issue-panel").open = false;
      await loadBuhgalteria();
    } catch (err) {
      resultEl.textContent = String(err);
      resultEl.classList.add("is-error");
    }
  });

  returnForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const resultEl = document.querySelector("#debt-return-result");
    resultEl.textContent = "";
    resultEl.className = "debt-panel__result";
    const empSelect = document.querySelector("#debt-return-emp");
    const employeeId = parseInt(empSelect.value, 10);
    const amount = parseInt(document.querySelector("#debt-return-amount").value, 10);
    const comment = document.querySelector("#debt-return-comment").value.trim();
    if (!employeeId || !amount || amount <= 0) return;
    const currentDebt = parseInt(empSelect.selectedOptions[0]?.dataset.debt || "0", 10);
    if (currentDebt > 0 && amount > currentDebt) {
      resultEl.textContent = `Нельзя вернуть больше долга (${currentDebt} ₽)`;
      resultEl.classList.add("is-error");
      return;
    }
    try {
      const data = await apiRequest("POST", "mobile/employees/debt/", { action_type: "debt_payment", employee_id: employeeId, amount, comment });
      showToast(data.message);
      returnForm.reset();
      document.querySelector("#debt-return-panel").open = false;
      await loadBuhgalteria();
    } catch (err) {
      resultEl.textContent = String(err);
      resultEl.classList.add("is-error");
    }
  });
}

async function loadBuhgalteria() {
  const statusEl = document.querySelector("#buh-status");
  setAdminStatus(statusEl, "Загружаю...");
  try {
    const today = todayIsoDate();
    let path = `mobile/buhgalteria/?date=${today}`;
    const data = await apiRequest("GET", path);
    buhPositions = data.positions || [];
    buhDepartments = data.departments || [];
    buhWeekdays = data.weekdays || [];
    buhHolidayMonth = monthValue(data.date || today);
    buhHolidayDates = new Set(data.holidays || []);
    buhHolidayMonthClosed = Boolean(data.holiday_month_closed);
    const employees = data.employees || [];
    renderBuhTable(employees);
    renderPaidHolidaySummary();
    updateDebtSelects(employees);
    const info = `Сотрудников: ${employees.length}` + (data.archived_count > 0 && !buhShowArchived ? ` (архив: ${data.archived_count})` : "");
    setAdminStatus(statusEl, info);
  } catch (err) {
    setAdminStatus(statusEl, `Ошибка: ${err}`, true);
  }
}

function updateDebtSelects(employees) {
  const active = employees.filter(e => !e.is_archived);
  const withDebt = active.filter(e => (e.debt || 0) > 0);

  const issueSelect = document.querySelector("#debt-issue-emp");
  const returnSelect = document.querySelector("#debt-return-emp");

  const savedIssue = issueSelect.value;
  const savedReturn = returnSelect.value;

  issueSelect.innerHTML = '<option value="">— выберите —</option>';
  active.forEach(emp => {
    const opt = document.createElement("option");
    opt.value = emp.id;
    opt.textContent = emp.full_name;
    if (String(emp.id) === savedIssue) opt.selected = true;
    issueSelect.appendChild(opt);
  });

  returnSelect.innerHTML = '<option value="">— выберите —</option>';
  withDebt.forEach(emp => {
    const opt = document.createElement("option");
    opt.value = emp.id;
    opt.dataset.debt = emp.debt || 0;
    opt.textContent = `${emp.full_name} (долг: ${emp.debt} ₽)`;
    if (String(emp.id) === savedReturn) opt.selected = true;
    returnSelect.appendChild(opt);
  });

  if (!withDebt.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Нет сотрудников с долгом";
    opt.disabled = true;
    returnSelect.appendChild(opt);
  }
}

function renderPaidHolidaySummary() {
  const summary = document.querySelector("#paid-holidays-summary");
  if (!summary) return;
  const dates = Array.from(buhHolidayDates).sort();
  summary.textContent = dates.length
    ? `Выбрано: ${dates.map((d) => Number(d.slice(8, 10))).join(", ")}`
    : "Праздники не выбраны";
  summary.classList.toggle("is-closed", buhHolidayMonthClosed);
  if (buhHolidayMonthClosed) summary.textContent += ". Месяц закрыт";
}

function renderPaidHolidayModal() {
  const grid = document.querySelector("#paid-holidays-grid");
  const title = document.querySelector("#paid-holidays-title");
  const status = document.querySelector("#paid-holidays-status");
  const saveBtn = document.querySelector("#paid-holidays-save");
  if (!grid) return;
  const month = buhHolidayMonth || monthValue(todayIsoDate());
  if (title) title.textContent = `Оплачиваемые праздники: ${month}`;
  if (status) {
    status.textContent = buhHolidayMonthClosed ? "Месяц закрыт. Праздники менять нельзя." : "";
    status.className = "page-status" + (status.textContent ? " is-visible is-error" : "");
  }
  if (saveBtn) saveBtn.disabled = buhHolidayMonthClosed;
  grid.innerHTML = monthDays(month).map((day) => `
    <label class="paid-holiday-day">
      <input type="checkbox" value="${day.iso}" ${buhHolidayDates.has(day.iso) ? "checked" : ""} ${buhHolidayMonthClosed ? "disabled" : ""}>
      <span>${day.day}</span>
      <span>${escapeHtml(day.weekday)}</span>
    </label>
  `).join("");
}

function initPaidHolidayModal() {
  const modal = document.querySelector("#paid-holidays-modal");
  const openBtn = document.querySelector("#paid-holidays-open");
  const closeBtn = document.querySelector("#paid-holidays-close");
  const cancelBtn = document.querySelector("#paid-holidays-cancel");
  const form = document.querySelector("#paid-holidays-form");
  if (!modal || !openBtn || !form) return;

  openBtn.addEventListener("click", () => {
    renderPaidHolidayModal();
    modal.showModal();
  });
  closeBtn?.addEventListener("click", () => modal.close());
  cancelBtn?.addEventListener("click", () => modal.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (buhHolidayMonthClosed) return;
    const dates = Array.from(form.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
    const status = document.querySelector("#paid-holidays-status");
    setAdminStatus(status, "Сохраняю праздники...");
    try {
      const result = await apiRequest("POST", "mobile/paid-holidays/", {
        month: buhHolidayMonth || monthValue(todayIsoDate()),
        dates,
      });
      buhHolidayDates = new Set((result.holidays || []).map((item) => item.date));
      showToast(result.message || "Праздничные дни сохранены.");
      modal.close();
      await loadBuhgalteria();
      if (state.currentView === "journal") await loadJournalView();
    } catch (err) {
      setAdminStatus(status, `Ошибка: ${err}`, true);
    }
  });
}

function renderBuhTable(employees) {
  buhEmployeeMap = {};
  const tbody = document.querySelector("#buh-body");
  tbody.innerHTML = "";
  if (!employees.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-row">Нет сотрудников</td></tr>';
    return;
  }
  for (const emp of employees) {
    buhEmployeeMap[emp.id] = emp;
    const statusBadge = emp.is_archived
      ? '<span class="inactive-chip">архив</span>'
      : (!emp.is_active ? '<span class="inactive-chip">уволен</span>' : '');
    const tr = document.createElement("tr");
    if (!emp.is_active) tr.classList.add("ts-row-inactive");
    tr.innerHTML = `
      <td><b>${emp.full_name}</b> ${statusBadge}</td>
      <td class="text-muted">${emp.department_label || "—"}</td>
      <td class="text-muted">${emp.positions || "—"}</td>
      <td class="${emp.debt > 0 ? "buh-debt" : "text-muted"}">${emp.debt || 0} ₽</td>
      <td class="text-muted">${emp.salary_on_date || 0} ₽</td>
      <td class="text-muted">${emp.daily_salary_on_date || 0} ₽</td>
      <td class="text-muted">${emp.current_salary || 0} ₽</td>
      <td class="text-muted">${emp.day_off_label || "—"}</td>
      <td class="text-muted">${emp.monthly_accrual || 0} ₽</td>
      <td class="erm-actions-cell">
        <button class="ts-gear-btn" data-emp-id="${emp.id}" title="Настройки">⚙</button>
        <button class="ts-report-btn" data-emp-id="${emp.id}" data-emp-name="${escapeHtml(emp.full_name)}" title="Отчёт по сотруднику">📋</button>
      </td>
    `;
    tbody.append(tr);
  }

  tbody.addEventListener("click", (e) => {
    const gearBtn = e.target.closest(".ts-gear-btn");
    if (gearBtn) {
      const emp = buhEmployeeMap[parseInt(gearBtn.dataset.empId, 10)];
      if (emp) openEmpModal(emp);
      return;
    }
    const reportBtn = e.target.closest(".ts-report-btn");
    if (reportBtn) {
      openEmpReportModal(parseInt(reportBtn.dataset.empId, 10), reportBtn.dataset.empName);
    }
  });
}

function initEmpModal() {
  const modal = document.querySelector("#emp-settings-modal");
  document.querySelector("#emp-modal-close").addEventListener("click", () => modal.close());

  // Переключение вкладок
  modal.addEventListener("click", (e) => {
    const tabBtn = e.target.closest(".emp-tab-btn");
    if (!tabBtn) return;
    const tabName = tabBtn.dataset.tab;
    modal.querySelectorAll(".emp-tab-btn").forEach(b => b.classList.toggle("is-active", b === tabBtn));
    modal.querySelectorAll(".emp-modal-tab-pane").forEach(p => p.classList.toggle("is-hidden", p.id !== `emp-tab-${tabName}`));
  });

  // Изменение оклада
  document.querySelector("#emp-salary-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const empId = document.querySelector("#emp-modal-id").value;
    const statusEl = document.querySelector("#emp-modal-status");
    setAdminStatus(statusEl, "Сохраняю...");
    try {
      const result = await apiRequest("PATCH", `mobile/employees/${empId}/`, {
        action_type: "change_salary",
        new_salary: document.querySelector("#emp-new-salary").value,
        effective_from: document.querySelector("#emp-salary-from").value,
      });
      renderEmpSalaryHistory(result.salary_history || []);
      setAdminStatus(statusEl, `Оклад изменён: ${result.salary} ₽`);
      showToast(`Оклад сотрудника изменён: ${result.salary} ₽`);
      await loadBuhgalteria();
    } catch (err) {
      setAdminStatus(statusEl, `Ошибка: ${err}`, true);
    }
  });

  // Кнопки сохранения полей
  document.querySelector("#emp-tab-fields").addEventListener("click", async (e) => {
    const modeButton = e.target.closest("#emp-save-master-salary-mode");
    if (modeButton) {
      const empId = document.querySelector("#emp-modal-id").value;
      const statusEl = document.querySelector("#emp-modal-status");
      const enabled = document.querySelector("#emp-count-salary-on-record-creation").checked;
      setAdminStatus(statusEl, "Сохраняю...");
      try {
        await apiRequest("PATCH", `mobile/employees/${empId}/`, {
          action_type: "change_master_salary_mode",
          count_salary_on_record_creation: enabled,
        });
        setAdminStatus(statusEl, "Настройка расчёта сохранена.");
        showToast("Настройка расчёта зарплаты сохранена.");
        const emp = buhEmployeeMap[parseInt(empId, 10)];
        if (emp) emp.count_salary_on_record_creation = enabled;
        await loadBuhgalteria();
      } catch (err) {
        setAdminStatus(statusEl, `Ошибка: ${err}`, true);
      }
      return;
    }

    const btn = e.target.closest("[data-field]");
    if (!btn) return;
    const empId = document.querySelector("#emp-modal-id").value;
    const fieldName = btn.dataset.field;
    const sourceId = btn.dataset.source;
    const inputEl = document.querySelector(`#emp-field-${sourceId}`);
    const newValue = inputEl ? inputEl.value : "";
    const statusEl = document.querySelector("#emp-modal-status");
    setAdminStatus(statusEl, "Сохраняю...");
    try {
      await apiRequest("PATCH", `mobile/employees/${empId}/`, {
        action_type: "change_field",
        field_name: fieldName,
        new_value: newValue,
      });
      setAdminStatus(statusEl, "Сохранено.");
      showToast("Данные сохранены.");
      const emp = buhEmployeeMap[parseInt(empId, 10)];
      if (emp) emp[fieldName === "full_name" ? "full_name" : fieldName] = newValue;
      await loadBuhgalteria();
    } catch (err) {
      setAdminStatus(statusEl, `Ошибка: ${err}`, true);
    }
  });

  // Изменение должностей
  document.querySelector("#emp-positions-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const empId = document.querySelector("#emp-modal-id").value;
    const statusEl = document.querySelector("#emp-modal-status");
    setAdminStatus(statusEl, "Сохраняю...");
    try {
      const result = await apiRequest("PATCH", `mobile/employees/${empId}/`, {
        action_type: "change_positions",
        primary_position_id: document.querySelector("#emp-pos-primary").value || null,
        secondary_position_id: document.querySelector("#emp-pos-secondary").value || null,
      });
      setAdminStatus(statusEl, `Должности обновлены: ${result.positions}`);
      showToast("Должности обновлены.");
      await loadBuhgalteria();
    } catch (err) {
      setAdminStatus(statusEl, `Ошибка: ${err}`, true);
    }
  });
}

function openEmpModal(emp) {
  const modal = document.querySelector("#emp-settings-modal");
  document.querySelector("#emp-modal-id").value = emp.id;
  document.querySelector("#emp-modal-title").textContent = emp.full_name;
  document.querySelector("#emp-modal-status").className = "page-status";
  document.querySelector("#emp-modal-status").textContent = "";

  // Переключить на первую вкладку
  modal.querySelectorAll(".emp-tab-btn").forEach((b, i) => b.classList.toggle("is-active", i === 0));
  modal.querySelectorAll(".emp-modal-tab-pane").forEach((p, i) => p.classList.toggle("is-hidden", i !== 0));

  // Вкладка: Оклад
  document.querySelector("#emp-new-salary").value = emp.current_salary || 0;
  document.querySelector("#emp-salary-from").value = todayIsoDate();
  renderEmpSalaryHistory(emp.salary_history || []);

  // Вкладка: Данные — заполнить поля
  document.querySelector("#emp-field-fullname").value = emp.full_name;
  document.querySelector("#emp-field-dailysalary").value = emp.daily_salary || 0;
  document.querySelector("#emp-field-debt").value = emp.debt || 0;
  document.querySelector("#emp-master-salary-mode-row").classList.toggle("is-hidden", !emp.is_master);
  document.querySelector("#emp-count-salary-on-record-creation").checked = Boolean(emp.count_salary_on_record_creation);

  const deptSel = document.querySelector("#emp-field-department");
  deptSel.innerHTML = '<option value="">— Нет —</option>';
  buhDepartments.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.value; opt.textContent = d.label;
    if (d.value === emp.department) opt.selected = true;
    deptSel.append(opt);
  });

  const daySel = document.querySelector("#emp-field-dayoff");
  daySel.innerHTML = '<option value="">— Нет —</option>';
  buhWeekdays.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.value; opt.textContent = w.label;
    if (w.value === emp.day_off) opt.selected = true;
    daySel.append(opt);
  });

  // Вкладка: Должности
  [document.querySelector("#emp-pos-primary"), document.querySelector("#emp-pos-secondary")].forEach((sel, i) => {
    sel.innerHTML = i === 0 ? '<option value="">— Нет —</option>' : '<option value="">— Нет —</option>';
    buhPositions.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.name;
      const curId = i === 0 ? emp.primary_position_id : emp.secondary_position_id;
      if (p.id === curId) opt.selected = true;
      sel.append(opt);
    });
  });

  // Вкладка: Статус
  const statusTitle = document.querySelector("#emp-status-title");
  const statusDesc = document.querySelector("#emp-status-desc");
  const statusActions = document.querySelector("#emp-status-actions");
  statusActions.innerHTML = "";

  if (emp.is_active) {
    statusTitle.textContent = "Увольнение";
    statusDesc.textContent = "Сотрудник исчезнет из рабочего списка. История и взаиморасчёты сохранятся.";
    const btn = document.createElement("button");
    btn.className = "round-action btn-danger";
    btn.textContent = "Уволить сотрудника";
    btn.addEventListener("click", async () => {
      if (!confirm(`Уволить «${emp.full_name}»? История сохранится.`)) return;
      const statusEl = document.querySelector("#emp-modal-status");
      setAdminStatus(statusEl, "Сохраняю...");
      try {
        await apiRequest("PATCH", `mobile/employees/${emp.id}/`, { action_type: "deactivate_employee" });
        showToast(`Сотрудник «${emp.full_name}» уволен.`);
        modal.close();
        await loadBuhgalteria();
      } catch (err) { setAdminStatus(statusEl, `Ошибка: ${err}`, true); }
    });
    statusActions.append(btn);
  } else if (emp.is_archived) {
    statusTitle.textContent = "В архиве";
    statusDesc.textContent = "Все данные сохранены. Сотрудник скрыт из обычного списка.";
    const btn = document.createElement("button");
    btn.className = "round-action";
    btn.textContent = "Вернуть из архива";
    btn.addEventListener("click", async () => {
      const statusEl = document.querySelector("#emp-modal-status");
      setAdminStatus(statusEl, "Сохраняю...");
      try {
        await apiRequest("PATCH", `mobile/employees/${emp.id}/`, { action_type: "restore_employee" });
        showToast(`Сотрудник «${emp.full_name}» восстановлен.`);
        modal.close();
        await loadBuhgalteria();
      } catch (err) { setAdminStatus(statusEl, `Ошибка: ${err}`, true); }
    });
    statusActions.append(btn);
  } else {
    statusTitle.textContent = "Архивирование";
    if (emp.can_archive) {
      statusDesc.textContent = "Сотрудник уволен и взаиморасчёты закрыты. Можно убрать в архив.";
      const btn = document.createElement("button");
      btn.className = "round-action btn-danger";
      btn.textContent = "Убрать в архив";
      btn.addEventListener("click", async () => {
        if (!confirm(`Убрать «${emp.full_name}» в архив?`)) return;
        const statusEl = document.querySelector("#emp-modal-status");
        setAdminStatus(statusEl, "Сохраняю...");
        try {
          await apiRequest("PATCH", `mobile/employees/${emp.id}/`, { action_type: "archive_employee" });
          showToast(`Сотрудник «${emp.full_name}» убран в архив.`);
          modal.close();
          await loadBuhgalteria();
        } catch (err) { setAdminStatus(statusEl, `Ошибка: ${err}`, true); }
      });
      statusActions.append(btn);
    } else {
      statusDesc.textContent = "Нельзя архивировать: есть ненулевой остаток по взаиморасчётам. Сначала закройте расчёты.";
    }
  }

  modal.showModal();
}

function renderEmpSalaryHistory(items) {
  const el = document.querySelector("#emp-salary-history");
  if (!items.length) { el.innerHTML = '<div class="emp-history-empty">История пуста</div>'; return; }
  el.innerHTML = '<div class="emp-modal-section-title" style="margin-top:1rem">История оклада</div>' +
    items.map(h =>
      `<div class="emp-history-item"><span class="emp-history-date">${h.effective_from}</span><span class="emp-history-val">${h.salary} ₽</span></div>`
    ).join("");
}

// ── ОТЧЁТ ПО СОТРУДНИКУ ───────────────────────────────────────────────────────

function initEmpReportModal() {
  const modal = document.querySelector("#emp-report-modal");
  if (!modal) return;
  document.querySelector("#erm-close").addEventListener("click", () => modal.close());
  document.querySelector("#erm-load-btn").addEventListener("click", () => {
    const empId = parseInt(modal.dataset.empId, 10);
    const dateFrom = document.querySelector("#erm-date-from").value;
    const dateTo   = document.querySelector("#erm-date-to").value;
    if (empId && dateFrom && dateTo) loadEmpReport(empId, dateFrom, dateTo);
  });
}

function openEmpReportModal(empId, empName) {
  const modal = document.querySelector("#emp-report-modal");
  if (!modal) return;
  modal.dataset.empId = empId;
  document.querySelector("#erm-title").textContent = empName;

  const today = todayIsoDate();
  const fromDefault = today.slice(0, 8) + "01";
  document.querySelector("#erm-date-from").value = fromDefault;
  document.querySelector("#erm-date-to").value   = today;

  setAdminStatus(document.querySelector("#erm-status"), "");
  document.querySelector("#erm-body").innerHTML =
    '<div class="erm-hint-text">Выберите период и нажмите OK</div>';

  modal.showModal();
}

async function loadEmpReport(empId, dateFrom, dateTo) {
  const statusEl = document.querySelector("#erm-status");
  const bodyEl   = document.querySelector("#erm-body");
  setAdminStatus(statusEl, "Загружаю...");
  bodyEl.innerHTML = "";
  try {
    const data = await apiRequest("GET", `mobile/employees/${empId}/report/?date_from=${dateFrom}&date_to=${dateTo}`);
    if (!data.ok) {
      setAdminStatus(statusEl, "Ошибка загрузки данных", true);
      return;
    }
    setAdminStatus(statusEl, "");
    bodyEl.innerHTML = renderEmpReportContent(data);
  } catch (err) {
    setAdminStatus(statusEl, `Ошибка: ${err}`, true);
  }
}

function renderEmpReportContent(data) {
  const rows = data.rows || [];
  const t    = data.totals || {};

  if (!rows.length) {
    return '<div class="erm-empty">Нет событий за выбранный период</div>';
  }

  function fmtM(v) { return `${formatMoney(Math.abs(v || 0))} ₽`; }
  function signedM(v) {
    const s = `${formatMoney(Math.abs(v || 0))} ₽`;
    return (v || 0) >= 0 ? `+${s}` : `−${s}`;
  }
  // Приглушённый баланс для информационных строк (без финансового изменения)
  function signedMuted(v) {
    const s = `${formatMoney(Math.abs(v || 0))} ₽`;
    const sign = (v || 0) >= 0 ? "+" : "−";
    return `<span class="erm-bal-muted">${sign}${s}</span>`;
  }

  // Строки, где баланс не меняется (информационные)
  function isInfoRow(row) {
    return row.type === "advance"
      || row.type === "salary_change"
      || row.type === "hired"
      || (row.type === "entry" && !row.accrued && !row.advance);
  }

  function typeInfo(row) {
    switch (row.type) {
      case "entry":        return (row.accrued || row.advance)
                                    ? ["erm-type-work", "Рабочий день"]
                                    : ["erm-type-weekend", "Выходной"];
      case "salary_change":return ["erm-type-salary", "Оклад"];
      case "debt_given":   return ["erm-type-debt-neg", "Долг −"];
      case "debt_returned":return ["erm-type-debt-pos", "Долг +"];
      case "advance":      return ["erm-type-advance", "Аванс *"];
      case "hired":        return ["erm-type-hired", "Принят"];
      default:             return ["erm-type-other", row.title || "—"];
    }
  }

  const rowsHtml = rows.map(row => {
    const [typeClass, typeLabel] = typeInfo(row);

    let descHtml = "";
    if (row.description) descHtml += `<div class="erm-desc-text">${escapeHtml(row.description)}</div>`;
    if (row.type === "entry" && (row.accrued || row.advance)) {
      descHtml += `<div class="erm-detail-text">Нач: ${fmtM(row.accrued)}${row.advance > 0 ? ` · Ав: −${fmtM(row.advance)}` : ""}</div>`;
    } else if ((row.type === "debt_given" || row.type === "debt_returned") && row.amount > 0) {
      descHtml += `<div class="erm-detail-text">${fmtM(row.amount)}</div>`;
    } else if (row.type === "advance" && row.amount > 0) {
      descHtml += `<div class="erm-detail-text erm-detail-muted" title="Зафиксирован на стр. «Авансы». В баланс входит через табель.">${fmtM(row.amount)} *</div>`;
    } else if (row.type === "salary_change" && row.salary > 0) {
      descHtml += `<div class="erm-detail-text">Оклад: ${fmtM(row.salary)}</div>`;
    }

    // Баланс после: цветной для финансовых строк, серый для информационных
    const balVal = row.balance_after || 0;
    const balHtml = isInfoRow(row)
      ? signedMuted(balVal)
      : `<span class="${balVal >= 0 ? "erm-bal-pos" : "erm-bal-neg"}">${signedM(balVal)}</span>`;

    let debtHtml = "—";
    if (row.type === "debt_given"    && row.amount > 0) debtHtml = `<span class="erm-bal-neg">−${fmtM(row.amount)}</span>`;
    else if (row.type === "debt_returned" && row.amount > 0) debtHtml = `<span class="erm-bal-pos">+${fmtM(row.amount)}</span>`;

    // Аванс из табеля — оранжевый (реальный вычет)
    // Отдельный аванс — серый (информационный, показывается в descHtml)
    const accruedHtml = (row.type === "entry" && row.accrued > 0) ? `+${fmtM(row.accrued)}` : "—";
    const advHtml     = (row.type === "entry" && row.advance > 0) ? `−${fmtM(row.advance)}` : "—";

    return `<tr>
      <td class="erm-col-date">${escapeHtml(row.date)}</td>
      <td class="erm-col-type"><span class="${typeClass}">${escapeHtml(typeLabel)}</span></td>
      <td class="erm-col-desc">${descHtml}</td>
      <td class="erm-col-num">${accruedHtml}</td>
      <td class="erm-col-num">${advHtml}</td>
      <td class="erm-col-num">${debtHtml}</td>
      <td class="erm-col-bal">${balHtml}</td>
    </tr>`;
  }).join("");

  const totalsItems = [
    ["Начислено",          fmtM(t.total_accrued),                    "erm-tot-green"],
    t.total_side_job > 0     ? ["Подработка",     fmtM(t.total_side_job),             "erm-tot-green"]  : null,
    t.total_bonus > 0        ? ["Доплата",         fmtM(t.total_bonus),                "erm-tot-green"]  : null,
    t.total_penalty > 0      ? ["Штрафы",          fmtM(t.total_penalty),              "erm-tot-red"]    : null,
    ["Авансы (табель)",    `−${fmtM(t.total_advances_timesheet)}`,   "erm-tot-orange"],
    t.total_standalone_advances > 0 ? ["Авансы (стр.)*", fmtM(t.total_standalone_advances), "erm-tot-muted"] : null,
    t.total_debt_given > 0   ? ["Долг выдан",     `−${fmtM(t.total_debt_given)}`,     "erm-tot-red"]    : null,
    t.total_debt_returned > 0 ? ["Долг возврат.",  `+${fmtM(t.total_debt_returned)}`,  "erm-tot-green"]  : null,
  ].filter(Boolean);

  const totalsHtml = totalsItems.map(([label, value, cls]) =>
    `<div class="erm-tot-item"><div class="erm-tot-label">${escapeHtml(label)}</div><div class="erm-tot-value ${cls}">${escapeHtml(value)}</div></div>`
  ).join("");

  const openBalClass  = (t.opening_balance || 0) >= 0 ? "erm-bal-pos" : "erm-bal-neg";
  const closeBalClass = (t.closing_balance  || 0) >= 0 ? "erm-bal-pos" : "erm-bal-neg";

  const standaloneNote = t.total_standalone_advances > 0
    ? `<div class="erm-note">* — Аванс зафиксирован на странице «Авансы» до заполнения табеля. В баланс входит через поле «аванс» при сохранении табеля того дня.</div>`
    : "";

  return `
    <div class="erm-table-wrap">
      <table class="erm-table">
        <colgroup>
          <col style="width:82px">
          <col style="width:110px">
          <col>
          <col style="width:80px">
          <col style="width:72px">
          <col style="width:76px">
          <col style="width:90px">
        </colgroup>
        <thead>
          <tr>
            <th>Дата</th><th>Событие</th><th>Описание</th>
            <th>Начислено</th><th>Аванс</th><th>Долг</th><th>Баланс после</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <div class="erm-totals">
      <div class="erm-totals-title">Итоги за период</div>
      <div class="erm-totals-grid">${totalsHtml}</div>
    </div>
    <div class="erm-balance-row">
      <div>
        <div class="erm-bal-label">Входящий баланс</div>
        <div class="erm-bal-big ${openBalClass}">${signedM(t.opening_balance || 0)}</div>
      </div>
      <div class="erm-bal-arrow">→</div>
      <div style="text-align:right">
        <div class="erm-bal-label">Исходящий баланс</div>
        <div class="erm-bal-big ${closeBalClass}">${signedM(t.closing_balance || 0)}</div>
      </div>
    </div>
    ${standaloneNote}
  `;
}

async function openEmpAddModal() {
  const modal = document.querySelector("#emp-add-modal");
  document.querySelector("#emp-add-error").classList.add("is-hidden");
  document.querySelector("#emp-add-form").reset();

  // Сбросить состояние тумблеров и зависимых блоков
  document.querySelector("#emp-add-is-active").checked = true;
  document.querySelector("#emp-add-active-fields").classList.remove("is-hidden");
  document.querySelector("#emp-add-use-fixed-daily").checked = false;
  document.querySelector("#emp-add-daily-salary-wrap").classList.add("is-hidden");
  document.querySelector("#emp-add-dayoff-wrap").classList.remove("is-hidden");

  let positions = buhPositions, departments = buhDepartments, weekdays = buhWeekdays;
  if (!positions.length) {
    try {
      const data = await apiRequest("GET", "mobile/positions/");
      positions = data.positions || [];
      departments = data.departments || [];
      weekdays = data.weekdays || [];
    } catch (err) {
      showToast(`Ошибка загрузки данных: ${err}`, true);
      return;
    }
  }

  const deptSel = document.querySelector("#emp-add-department");
  deptSel.innerHTML = '<option value="">— Выберите отдел —</option>';
  departments.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.value; opt.textContent = d.label;
    deptSel.append(opt);
  });

  [document.querySelector("#emp-add-position"), document.querySelector("#emp-add-position2")].forEach((sel, i) => {
    sel.innerHTML = i === 0 ? '<option value="">— Выберите должность —</option>' : '<option value="">— Нет —</option>';
    positions.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.name;
      sel.append(opt);
    });
  });

  const daySel = document.querySelector("#emp-add-dayoff");
  daySel.innerHTML = '<option value="">— Выберите день —</option>';
  weekdays.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.value; opt.textContent = w.label;
    daySel.append(opt);
  });

  modal.showModal();
}

function initEmpAddModal() {
  const modal = document.querySelector("#emp-add-modal");
  document.querySelector("#emp-add-modal-close").addEventListener("click", () => modal.close());
  document.querySelector("#emp-add-cancel").addEventListener("click", () => modal.close());

  // Тумблер: активный сотрудник — скрывает/показывает блок полей
  document.querySelector("#emp-add-is-active").addEventListener("change", (e) => {
    document.querySelector("#emp-add-active-fields").classList.toggle("is-hidden", !e.target.checked);
  });

  // Тумблер: фиксированный дневной оклад — скрывает/показывает поле daily_salary и выходной
  document.querySelector("#emp-add-use-fixed-daily").addEventListener("change", (e) => {
    document.querySelector("#emp-add-daily-salary-wrap").classList.toggle("is-hidden", !e.target.checked);
    document.querySelector("#emp-add-dayoff-wrap").classList.toggle("is-hidden", e.target.checked);
  });

  document.querySelector("#emp-add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.querySelector("#emp-add-error");
    errorEl.classList.add("is-hidden");
    const isActive = document.querySelector("#emp-add-is-active").checked;
    const useFixedDaily = document.querySelector("#emp-add-use-fixed-daily").checked;
    const body = {
      full_name: document.querySelector("#emp-add-fullname").value.trim(),
      is_active: isActive,
      department: document.querySelector("#emp-add-department").value,
      primary_position_id: document.querySelector("#emp-add-position").value || null,
      secondary_position_id: document.querySelector("#emp-add-position2").value || null,
      salary: parseInt(document.querySelector("#emp-add-salary").value || "0", 10),
      day_off: document.querySelector("#emp-add-dayoff").value,
      debt: parseInt(document.querySelector("#emp-add-debt").value || "0", 10),
      use_fixed_daily_salary: useFixedDaily,
      daily_salary: parseInt(document.querySelector("#emp-add-daily-salary").value || "0", 10),
    };
    try {
      const result = await apiRequest("POST", "mobile/employees/create/", body);
      showToast(`Сотрудник «${result.full_name}» добавлен.`);
      modal.close();
      await loadBuhgalteria();
    } catch (err) {
      errorEl.textContent = String(err);
      errorEl.classList.remove("is-hidden");
    }
  });
}

// ── ЖУРНАЛ ДЕЙСТВИЙ ──────────────────────────────────────────────────────────

let auditCurrentPage = 1;
const AUDIT_ROLE_VIEW_ONLY = "Вело95Мото";
const AUDIT_ACTION_LABELS = {
  add: "Создание",
  create: "Создание",
  change: "Изменение",
  update: "Изменение",
  edit: "Изменение",
  delete: "Удаление",
  remove: "Удаление",
  view: "Просмотр",
};

function auditActionLabel(action, fallback = "") {
  const value = String(action || "");
  return fallback || AUDIT_ACTION_LABELS[value] || value;
}

function canDisplayAuditLog(log) {
  if (!state.bootstrap?.roles?.is_operator_role) return true;
  const roles = Array.isArray(log?.user_roles) ? log.user_roles : [];
  return !roles.includes(AUDIT_ROLE_VIEW_ONLY);
}

function canDisplayAuditUser(user) {
  if (!state.bootstrap?.roles?.is_operator_role) return true;
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return !roles.includes(AUDIT_ROLE_VIEW_ONLY);
}

function initAuditView() {
  document.querySelector("#audit-search-btn").addEventListener("click", () => { auditCurrentPage = 1; loadAuditLog(); });
  document.querySelector("#audit-reset-btn").addEventListener("click", () => {
    document.querySelector("#audit-user-filter").value = "";
    document.querySelector("#audit-action-filter").value = "";
    document.querySelector("#audit-date-from").value = "";
    document.querySelector("#audit-date-to").value = "";
    auditCurrentPage = 1;
    loadAuditLog();
  });
}

async function loadAuditLog() {
  const statusEl = document.querySelector("#audit-status");
  const user = document.querySelector("#audit-user-filter").value;
  const action = document.querySelector("#audit-action-filter").value;
  const dateFrom = document.querySelector("#audit-date-from").value;
  const dateTo = document.querySelector("#audit-date-to").value;
  let qs = `mobile/audit-log/?page=${auditCurrentPage}`;
  if (user) qs += `&user=${user}`;
  if (action) qs += `&action=${encodeURIComponent(action)}`;
  if (dateFrom) qs += `&date_from=${dateFrom}`;
  if (dateTo) qs += `&date_to=${dateTo}`;
  setAdminStatus(statusEl, "Загружаю...");
  try {
    const data = await apiRequest("GET", qs);
    const logs = (data.logs || []).filter(canDisplayAuditLog);
    fillAuditFilters((data.users || []).filter(canDisplayAuditUser), data.actions || []);
    renderAuditTable(logs);
    renderAuditPagination(data.current_page, data.pages, data.total);
    setAdminStatus(statusEl, `Всего записей: ${data.total || 0}`);
  } catch (err) {
    setAdminStatus(statusEl, `Ошибка: ${err}`, true);
  }
}

function fillAuditFilters(users, actions) {
  const userSel = document.querySelector("#audit-user-filter");
  const curUser = userSel.value;
  userSel.innerHTML = '<option value="">Все пользователи</option>';
  users.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.username;
    if (String(u.id) === curUser) opt.selected = true;
    userSel.append(opt);
  });

  const actionSel = document.querySelector("#audit-action-filter");
  const curAction = actionSel.value;
  actionSel.innerHTML = '<option value="">Все действия</option>';
  actions.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.value;
    opt.textContent = auditActionLabel(a.value, a.label);
    if (a.value === curAction) opt.selected = true;
    actionSel.append(opt);
  });
}

function renderAuditTable(logs) {
  const tbody = document.querySelector("#audit-body");
  tbody.innerHTML = "";
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Записей нет</td></tr>';
    return;
  }
  for (const log of logs) {
    const dt = new Date(log.created_at);
    const dateStr = `${dt.toLocaleDateString("ru-RU")} ${dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="text-muted">${dateStr}</td>
      <td>${log.username || "—"}</td>
      <td><span class="audit-badge">${auditActionLabel(log.action, log.action_label)}</span></td>
      <td>${log.description}</td>
      <td class="text-muted">${log.ip_address || "—"}</td>
    `;
    tbody.append(tr);
  }
}

function renderAuditPagination(current, total, count) {
  const el = document.querySelector("#audit-pagination");
  el.innerHTML = "";
  if (total <= 1) return;
  const summary = document.createElement("span");
  summary.className = "pagination-summary";
  summary.textContent = `Страница ${current} из ${total} (всего ${count})`;
  el.append(summary);
  if (current > 1) {
    const prev = document.createElement("button");
    prev.textContent = "←";
    prev.className = "pagination-btn";
    prev.addEventListener("click", () => { auditCurrentPage = current - 1; loadAuditLog(); });
    el.append(prev);
  }
  if (current < total) {
    const next = document.createElement("button");
    next.textContent = "→";
    next.className = "pagination-btn";
    next.addEventListener("click", () => { auditCurrentPage = current + 1; loadAuditLog(); });
    el.append(next);
  }
}

// ── КАБИНЕТ ОПЕРАТОРА ─────────────────────────────────────────────────────────

function initOperatorView() {
  document.querySelector("#operator-pw-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.querySelector("#operator-status");
    const body = {
      current_password: document.querySelector("#op-cur-pw").value,
      new_password: document.querySelector("#op-new-pw").value,
      confirm_password: document.querySelector("#op-confirm-pw").value,
    };
    setAdminStatus(statusEl, "Сохраняю...");
    try {
      await apiRequest("POST", "mobile/operator-cabinet/", body);
      document.querySelector("#op-cur-pw").value = "";
      document.querySelector("#op-new-pw").value = "";
      document.querySelector("#op-confirm-pw").value = "";
      setAdminStatus(statusEl, "Пароль обновлён.");
    } catch (err) {
      setAdminStatus(statusEl, `Ошибка: ${err}`, true);
    }
  });
}

async function loadOperatorView() {
  const statusEl = document.querySelector("#operator-status");
  setAdminStatus(statusEl, "Загружаю...");
  try {
    const data = await apiRequest("GET", "mobile/operator-cabinet/");
    const colList = document.querySelector("#operator-collectors");
    const masList = document.querySelector("#operator-masters");
    colList.innerHTML = (data.collectors || []).map(n => `<li>${n}</li>`).join("") || "<li>Нет</li>";
    masList.innerHTML = (data.masters || []).map(n => `<li>${n}</li>`).join("") || "<li>Нет</li>";
    const warn = document.querySelector("#operator-pw-default-warn");
    warn.classList.toggle("is-hidden", !data.delete_password_is_default);
    setAdminStatus(statusEl, "");
  } catch (err) {
    setAdminStatus(statusEl, `Ошибка: ${err}`, true);
  }
}

// ── УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ─────────────────────────────────────────────────

let usersData = { users: [], roles: [], master_choices: [] };

function initUsersView() {
  const addModal = document.querySelector("#users-add-modal");
  const roleModal = document.querySelector("#users-role-modal");
  const pwModal = document.querySelector("#users-pw-modal");

  document.querySelector("#users-add-btn").addEventListener("click", () => {
    fillUserFormSelects(document.querySelector("#new-user-role"), document.querySelector("#new-user-master"));
    document.querySelector("#new-user-role").addEventListener("change", function () {
      document.querySelector("#new-user-master-label").classList.toggle("is-hidden", this.value !== "Мастер");
    }, { once: false });
    addModal.showModal();
  });
  document.querySelector("#users-add-close").addEventListener("click", () => addModal.close());
  document.querySelector("#users-add-cancel").addEventListener("click", () => addModal.close());

  document.querySelector("#users-add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.querySelector("#users-status");
    const body = {
      username: document.querySelector("#new-user-username").value.trim(),
      password: document.querySelector("#new-user-password").value,
      full_name: document.querySelector("#new-user-fullname").value.trim(),
      email: document.querySelector("#new-user-email").value.trim(),
      role_name: document.querySelector("#new-user-role").value,
      master_name: document.querySelector("#new-user-master").value,
    };
    setAdminStatus(statusEl, "Создаю...");
    try {
      await apiRequest("POST", "mobile/users/", body);
      addModal.close();
      e.target.reset();
      setAdminStatus(statusEl, "Пользователь создан.");
      await loadUsersView();
    } catch (err) {
      setAdminStatus(statusEl, `Ошибка: ${err}`, true);
    }
  });

  document.querySelector("#users-role-close").addEventListener("click", () => roleModal.close());
  document.querySelector("#users-role-cancel").addEventListener("click", () => roleModal.close());
  document.querySelector("#users-role-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.querySelector("#users-status");
    const userId = document.querySelector("#role-user-id").value;
    const body = {
      action_type: "change_role",
      role_name: document.querySelector("#role-user-role").value,
      master_name: document.querySelector("#role-user-master").value,
    };
    setAdminStatus(statusEl, "Сохраняю...");
    try {
      await apiRequest("PATCH", `mobile/users/${userId}/`, body);
      roleModal.close();
      setAdminStatus(statusEl, "Роль обновлена.");
      await loadUsersView();
    } catch (err) {
      setAdminStatus(statusEl, `Ошибка: ${err}`, true);
    }
  });

  document.querySelector("#role-user-role").addEventListener("change", function () {
    document.querySelector("#role-master-label").classList.toggle("is-hidden", this.value !== "Мастер");
  });

  document.querySelector("#users-pw-close").addEventListener("click", () => pwModal.close());
  document.querySelector("#users-pw-cancel").addEventListener("click", () => pwModal.close());
  document.querySelector("#users-pw-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.querySelector("#users-status");
    const userId = document.querySelector("#pw-user-id").value;
    const newPw = document.querySelector("#pw-new-password").value;
    const errEl = document.querySelector("#pw-error");
    if (newPw.length < 4) { errEl.textContent = "Минимум 4 символа."; errEl.classList.remove("is-hidden"); return; }
    errEl.classList.add("is-hidden");
    setAdminStatus(statusEl, "Сохраняю...");
    try {
      await apiRequest("PATCH", `mobile/users/${userId}/`, { action_type: "change_password", new_password: newPw });
      pwModal.close();
      e.target.reset();
      setAdminStatus(statusEl, "Пароль обновлён.");
    } catch (err) {
      setAdminStatus(statusEl, `Ошибка: ${err}`, true);
    }
  });
}

function fillUserFormSelects(roleSel, masterSel) {
  roleSel.innerHTML = '<option value="">— Без роли —</option>';
  usersData.roles.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r; opt.textContent = r;
    roleSel.append(opt);
  });
  masterSel.innerHTML = '<option value="">— Выберите мастера —</option>';
  usersData.master_choices.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.value; opt.textContent = m.label;
    masterSel.append(opt);
  });
}

async function loadUsersView() {
  const statusEl = document.querySelector("#users-status");
  setAdminStatus(statusEl, "Загружаю...");
  try {
    const data = await apiRequest("GET", "mobile/users/");
    usersData = data;
    renderUsersTable(data.users || []);
    setAdminStatus(statusEl, `Пользователей: ${(data.users || []).length}`);
  } catch (err) {
    setAdminStatus(statusEl, `Ошибка: ${err}`, true);
  }
}

function renderUsersTable(users) {
  const tbody = document.querySelector("#users-body");
  tbody.innerHTML = "";
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Нет пользователей</td></tr>';
    return;
  }
  for (const u of users) {
    const roleBadge = u.current_role
      ? `<span class="role-badge">${u.current_role}</span>`
      : '<span class="text-muted">—</span>';
    const superBadge = u.is_superuser ? '<span class="role-badge role-badge--super">Супер</span>' : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${u.username}</b></td>
      <td>${u.full_name || "—"}</td>
      <td class="text-muted">${u.email || "—"}</td>
      <td>${roleBadge}${superBadge}</td>
      <td class="text-muted">${u.master_name || "—"}</td>
      <td><span class="${u.is_active ? "active-chip" : "inactive-chip"}">${u.is_active ? "Да" : "Нет"}</span></td>
      <td class="action-cell">
        <button class="btn-action btn-sm" data-action="role" data-id="${u.id}" data-role="${u.current_role}" data-master="${u.master_name}">Роль</button>
        <button class="btn-action btn-sm" data-action="pw" data-id="${u.id}">Пароль</button>
        <button class="btn-action btn-sm btn-danger" data-action="del" data-id="${u.id}" data-name="${u.username}">Удалить</button>
      </td>
    `;
    tbody.append(tr);
  }

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id, role, master, name } = btn.dataset;
    if (action === "role") {
      document.querySelector("#role-user-id").value = id;
      fillUserFormSelects(document.querySelector("#role-user-role"), document.querySelector("#role-user-master"));
      document.querySelector("#role-user-role").value = role || "";
      document.querySelector("#role-master-label").classList.toggle("is-hidden", role !== "Мастер");
      document.querySelector("#role-user-master").value = master || "";
      document.querySelector("#users-role-modal").showModal();
    } else if (action === "pw") {
      document.querySelector("#pw-user-id").value = id;
      document.querySelector("#pw-new-password").value = "";
      document.querySelector("#pw-error").classList.add("is-hidden");
      document.querySelector("#users-pw-modal").showModal();
    } else if (action === "del") {
      if (!confirm(`Удалить пользователя «${name}»? Это действие необратимо.`)) return;
      const statusEl = document.querySelector("#users-status");
      setAdminStatus(statusEl, "Удаляю...");
      try {
        await apiRequest("DELETE", `mobile/users/${id}/`);
        setAdminStatus(statusEl, `Пользователь «${name}» удалён.`);
        await loadUsersView();
      } catch (err) {
        setAdminStatus(statusEl, `Ошибка: ${err}`, true);
      }
    }
  });
}

// ── УПРАВЛЕНИЕ МАГАЗИНОМ ──────────────────────────────────────────────────────

let shopCategories = [];

function initShopView() {
  // ── Переключение вкладок ──
  const tabProducts = document.querySelector("#shop-tab-products");
  const tabCategories = document.querySelector("#shop-tab-categories");
  const productsPane = document.querySelector("#shop-products-tab");
  const categoriesPane = document.querySelector("#shop-categories-tab");

  tabProducts.addEventListener("click", () => {
    tabProducts.classList.add("is-active-tab");
    tabProducts.classList.remove("secondary-button");
    tabCategories.classList.remove("is-active-tab");
    tabCategories.classList.add("secondary-button");
    productsPane.classList.remove("is-hidden");
    categoriesPane.classList.add("is-hidden");
  });

  tabCategories.addEventListener("click", async () => {
    tabCategories.classList.add("is-active-tab");
    tabCategories.classList.remove("secondary-button");
    tabProducts.classList.remove("is-active-tab");
    tabProducts.classList.add("secondary-button");
    categoriesPane.classList.remove("is-hidden");
    productsPane.classList.add("is-hidden");
    await loadShopCategoriesTab();
  });

  // ── Модал категории ──
  const catModal = document.querySelector("#shop-cat-modal");
  document.querySelector("#shop-cat-modal-close").addEventListener("click", () => catModal.close());
  document.querySelector("#shop-cat-modal-cancel").addEventListener("click", () => catModal.close());
  document.querySelector("#shop-add-cat-btn").addEventListener("click", () => {
    document.querySelector("#shop-cat-modal-title").textContent = "Добавить категорию";
    document.querySelector("#shop-cat-id").value = "";
    document.querySelector("#shop-cat-name").value = "";
    catModal.showModal();
  });
  document.querySelector("#shop-cat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.querySelector("#shop-status");
    const catId = document.querySelector("#shop-cat-id").value;
    const name = document.querySelector("#shop-cat-name").value.trim();
    const isEdit = !!catId;
    setAdminStatus(statusEl, isEdit ? "Сохраняю..." : "Добавляю...");
    try {
      if (isEdit) {
        await apiRequest("PATCH", `mobile/shop/categories/${catId}/`, { name });
      } else {
        await apiRequest("POST", "mobile/shop/categories/", { name });
      }
      catModal.close();
      showToast(isEdit ? `Категория «${name}» обновлена.` : `Категория «${name}» добавлена.`);
      const catData = await apiRequest("GET", "mobile/shop/categories/");
      shopCategories = catData.categories || [];
      fillShopCategoryFilter(shopCategories);
      setAdminStatus(statusEl, "");
      await loadShopCategoriesTab();
    } catch (err) {
      setAdminStatus(statusEl, `Ошибка: ${err}`, true);
    }
  });

  // ── Делегирование кликов в таблице категорий ──
  document.querySelector("#shop-cat-body").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cat-action]");
    if (!btn) return;
    const { catAction, catId, catName } = btn.dataset;
    const statusEl = document.querySelector("#shop-status");
    if (catAction === "edit") {
      document.querySelector("#shop-cat-modal-title").textContent = "Изменить категорию";
      document.querySelector("#shop-cat-id").value = catId;
      document.querySelector("#shop-cat-name").value = catName;
      catModal.showModal();
    } else if (catAction === "del") {
      if (!confirm(`Удалить категорию «${catName}»? Это невозможно, если в ней есть товары.`)) return;
      setAdminStatus(statusEl, "Удаляю...");
      try {
        await apiRequest("DELETE", `mobile/shop/categories/${catId}/`);
        showToast(`Категория «${catName}» удалена.`);
        const catData = await apiRequest("GET", "mobile/shop/categories/");
        shopCategories = catData.categories || [];
        fillShopCategoryFilter(shopCategories);
        setAdminStatus(statusEl, "");
        await loadShopCategoriesTab();
      } catch (err) {
        setAdminStatus(statusEl, `Ошибка: ${err}`, true);
      }
    }
  });

  // ── Товары ──
  const modal = document.querySelector("#shop-product-modal");
  document.querySelector("#shop-add-btn").addEventListener("click", () => {
    document.querySelector("#shop-modal-title").textContent = "Добавить товар";
    document.querySelector("#shop-product-id").value = "";
    document.querySelector("#shop-product-form").reset();
    document.querySelector("#shop-product-image-preview").innerHTML = "";
    fillShopCategorySelect();
    modal.showModal();
  });
  document.querySelector("#shop-modal-close").addEventListener("click", () => modal.close());
  document.querySelector("#shop-modal-cancel").addEventListener("click", () => modal.close());

  document.querySelector("#shop-category-filter").addEventListener("change", loadShopProducts);

  document.querySelector("#shop-product-image").addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;
    const preview = document.querySelector("#shop-product-image-preview");
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" alt="preview" class="admin-image-thumb" />`;
    };
    reader.readAsDataURL(file);
  });

  document.querySelector("#shop-product-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.querySelector("#shop-status");
    const productId = document.querySelector("#shop-product-id").value;
    const body = {
      name: document.querySelector("#shop-product-name").value.trim(),
      description: document.querySelector("#shop-product-description").value.trim(),
      price: document.querySelector("#shop-product-price").value,
      category_id: document.querySelector("#shop-product-category").value,
      is_available: document.querySelector("#shop-product-available").checked,
    };

    const imageFile = document.querySelector("#shop-product-image").files[0];
    if (imageFile) {
      const b64 = await fileToBase64(imageFile);
      body.image_b64 = b64;
      body.image_name = imageFile.name;
    }

    const isEdit = !!productId;
    setAdminStatus(statusEl, isEdit ? "Сохраняю..." : "Добавляю...");
    try {
      if (isEdit) {
        await apiRequest("PATCH", `mobile/shop/products/${productId}/`, body);
      } else {
        await apiRequest("POST", "mobile/shop/products/", body);
      }
      modal.close();
      const productMsg = isEdit ? `Товар «${body.name}» обновлён.` : `Товар «${body.name}» добавлен.`;
      setAdminStatus(statusEl, productMsg);
      showToast(productMsg);
      await loadShopProducts();
    } catch (err) {
      setAdminStatus(statusEl, `Ошибка: ${err}`, true);
    }
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result;
      const b64 = result.split(",")[1];
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadShopView() {
  const statusEl = document.querySelector("#shop-status");
  setAdminStatus(statusEl, "Загружаю...");
  try {
    const catData = await apiRequest("GET", "mobile/shop/categories/");
    shopCategories = catData.categories || [];
    fillShopCategoryFilter(shopCategories);
    await loadShopProducts();
  } catch (err) {
    setAdminStatus(statusEl, `Ошибка: ${err}`, true);
  }
}

async function loadShopCategoriesTab() {
  const statusEl = document.querySelector("#shop-status");
  setAdminStatus(statusEl, "Загружаю категории...");
  try {
    const data = await apiRequest("GET", "mobile/shop/categories/");
    renderShopCategoriesTable(data.categories || []);
    setAdminStatus(statusEl, `Категорий: ${(data.categories || []).length}`);
  } catch (err) {
    setAdminStatus(statusEl, `Ошибка: ${err}`, true);
  }
}

function renderShopCategoriesTable(categories) {
  const tbody = document.querySelector("#shop-cat-body");
  tbody.innerHTML = "";
  if (!categories.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-row">Нет категорий</td></tr>';
    return;
  }
  for (const c of categories) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${c.name}</b></td>
      <td class="text-muted">${c.slug || ""}</td>
      <td class="action-cell">
        <button class="btn-action btn-sm" data-cat-action="edit" data-cat-id="${c.id}" data-cat-name="${c.name}">Изменить</button>
        <button class="btn-action btn-sm btn-danger" data-cat-action="del" data-cat-id="${c.id}" data-cat-name="${c.name}">Удалить</button>
      </td>
    `;
    tbody.append(tr);
  }
}

function fillShopCategoryFilter(categories) {
  const sel = document.querySelector("#shop-category-filter");
  const cur = sel.value;
  sel.innerHTML = '<option value="">Все категории</option>';
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id; opt.textContent = c.name;
    if (String(c.id) === cur) opt.selected = true;
    sel.append(opt);
  });
}

function fillShopCategorySelect() {
  const sel = document.querySelector("#shop-product-category");
  sel.innerHTML = '<option value="">— Выберите категорию —</option>';
  shopCategories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id; opt.textContent = c.name;
    sel.append(opt);
  });
}

async function loadShopProducts() {
  const statusEl = document.querySelector("#shop-status");
  const categoryId = document.querySelector("#shop-category-filter").value;
  let path = "mobile/shop/products/";
  if (categoryId) path += `?category=${categoryId}`;
  setAdminStatus(statusEl, "Загружаю товары...");
  try {
    const data = await apiRequest("GET", path);
    renderShopTable(data.products || []);
    setAdminStatus(statusEl, `Товаров: ${(data.products || []).length}`);
  } catch (err) {
    setAdminStatus(statusEl, `Ошибка: ${err}`, true);
  }
}

function renderShopTable(products) {
  const tbody = document.querySelector("#shop-body");
  tbody.innerHTML = "";
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Нет товаров</td></tr>';
    return;
  }
  for (const p of products) {
    const imageUrl = normalizeResourceUrl(p.image_url);
    const imgHtml = p.image_url
      ? `<img src="${imageUrl}" alt="${p.name}" class="admin-image-thumb" />`
      : '<span class="text-muted">—</span>';
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${imgHtml}</td>
      <td><b>${p.name}</b></td>
      <td class="text-muted">${p.category_name}</td>
      <td>${p.price} ₽</td>
      <td>
        <button class="availability-toggle ${p.is_available ? "btn-available" : "btn-unavailable"}"
          data-id="${p.id}" data-available="${p.is_available}">
          ${p.is_available ? "✓ В наличии" : "✗ Нет"}
        </button>
      </td>
      <td class="action-cell">
        <button class="btn-action btn-sm" data-action="edit" data-id="${p.id}">Изменить</button>
        <button class="btn-action btn-sm btn-danger" data-action="del" data-id="${p.id}" data-name="${p.name}">Удалить</button>
      </td>
    `;
    tbody.append(tr);
  }

  tbody.addEventListener("click", async (e) => {
    const avBtn = e.target.closest(".availability-toggle");
    if (avBtn) {
      const id = avBtn.dataset.id;
      const newVal = avBtn.dataset.available !== "true";
      try {
        await apiRequest("PATCH", `mobile/shop/products/${id}/`, { is_available: newVal });
        await loadShopProducts();
      } catch (err) {
        setAdminStatus(document.querySelector("#shop-status"), `Ошибка: ${err}`, true);
      }
      return;
    }
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id, name } = btn.dataset;
    if (action === "edit") {
      const product = products.find(p => String(p.id) === id);
      if (!product) return;
      document.querySelector("#shop-modal-title").textContent = "Изменить товар";
      document.querySelector("#shop-product-id").value = id;
      document.querySelector("#shop-product-name").value = product.name;
      document.querySelector("#shop-product-description").value = product.description;
      document.querySelector("#shop-product-price").value = product.price;
      document.querySelector("#shop-product-available").checked = product.is_available;
      fillShopCategorySelect();
      document.querySelector("#shop-product-category").value = product.category_id;
      const imageUrl = normalizeResourceUrl(product.image_url);
      document.querySelector("#shop-product-image-preview").innerHTML = product.image_url
        ? `<img src="${imageUrl}" alt="preview" class="admin-image-thumb" />`
        : "";
      document.querySelector("#shop-product-modal").showModal();
    } else if (action === "del") {
      if (!confirm(`Удалить товар «${name}»?`)) return;
      const statusEl = document.querySelector("#shop-status");
      setAdminStatus(statusEl, "Удаляю...");
      try {
        await apiRequest("DELETE", `mobile/shop/products/${id}/`);
        setAdminStatus(statusEl, `Товар «${name}» удалён.`);
        await loadShopProducts();
      } catch (err) {
        setAdminStatus(statusEl, `Ошибка: ${err}`, true);
      }
    }
  });
}

// ── Точка входа для admin views ───────────────────────────────────────────────

function loadAdminView(viewName) {
  switch (viewName) {
    case "timesheet": loadBuhgalteria(); break;
    case "audit": loadAuditLog(); break;
    case "operator": loadOperatorView(); break;
    case "users": loadUsersView(); break;
    case "shop": loadShopView(); break;
  }
}
