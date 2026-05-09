const { invoke } = window.__TAURI__.core;

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
const statusText = document.querySelector("#status-text");
const pageTitle = document.querySelector("#page-title");
const recordForm = document.querySelector("#record-form");
const recordsBody = document.querySelector("#records-body");
const assemblyList = document.querySelector("#assembly-list");
const assemblySearch = document.querySelector("#assembly-search");
const assemblyDate = document.querySelector("#assembly-date");
const salaryDateInput = document.querySelector("#salary-date-input");
const salaryDateMeta = document.querySelector("#salary-date-meta");
const salaryFilterForm = document.querySelector("#salary-filter-form");
const salaryContent = document.querySelector("#salary-content");
const salaryStatus = document.querySelector("#salary-status");
const refreshButton = document.querySelector("#refresh-button");
const syncButton = document.querySelector("#sync-button");
const syncPanel = document.querySelector(".sync-panel");
const serverUrlInput = document.querySelector("#server-url");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const partsInput = document.querySelector("#parts");
const partsAdjustInput = document.querySelector("#parts-adjust");
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
  records: [],
  salaryRecords: [],
  filteredRecords: [],
  selectedRecordIds: new Set(),
  currentPage: 1,
  perPage: 100,
  datesInitialized: false,
  editingRecordKey: "",
  pendingEditRecordKey: "",
};

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

function loadSyncSettings() {
  const saved = localStorage.getItem("serverUrl");
  const serverUrl = saved || "https://velo95moto.ru";
  const username = localStorage.getItem("username") || "";
  serverUrlInput.value = serverUrl;
  usernameInput.value = username;
  loginServerUrlInput.value = serverUrl;
  loginUsernameInput.value = username;
}

function saveSyncSettings() {
  localStorage.setItem("serverUrl", serverUrlInput.value.trim() || loginServerUrlInput.value.trim());
  localStorage.setItem("username", usernameInput.value.trim() || loginUsernameInput.value.trim());
}

function currentSettings() {
  return {
    server_url: (serverUrlInput.value || loginServerUrlInput.value || "https://velo95moto.ru").trim(),
    username: (usernameInput.value || loginUsernameInput.value).trim(),
    password: passwordInput.value || loginPasswordInput.value,
  };
}

const ADMIN_VIEWS = new Set(["timesheet", "audit", "operator", "users", "shop"]);

function switchView(viewName) {
  if (viewName === "disabled") {
    setStatus("Этот раздел пока открывается только на сайте. Основные офлайн-разделы уже доступны здесь.");
    return;
  }
  state.currentView = viewName;
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName || (viewName === "add-record" && button.dataset.view === "records"));
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `${viewName}-view`);
  });
  const titles = {
    assembly: "Сборка",
    "add-record": "Добавление записи",
    salary: "Зарплаты",
    timesheet: "Бухгалтерия",
    audit: "Журнал действий",
    operator: "Кабинет оператора",
    users: "Управление пользователями",
    shop: "Управление магазином",
    accounting: "Бухгалтерия",
  };
  pageTitle.textContent = titles[viewName] || "Список записей";

  if (ADMIN_VIEWS.has(viewName)) {
    loadAdminView(viewName);
  } else if (viewName === "salary") {
    loadSalaryView();
  }
}

function renderNavigation() {
  const nav = state.bootstrap?.nav || [
    { id: "records", label: "Список", view: "records" },
    { id: "assembly", label: "Сборка", view: "assembly" },
  ];
  navItems.innerHTML = "";
  const canAddRecord = hasPermission("records.add_record") && !state.bootstrap?.roles?.is_view_only_role;
  for (const item of nav) {
    const button = document.createElement("button");
    button.className = "nav-tab";
    button.type = "button";
    button.dataset.view = item.view;
    button.textContent = item.label;
    button.addEventListener("click", () => switchView(item.view));
    if (item.view === "records" && canAddRecord) {
      const wrapper = document.createElement("div");
      wrapper.className = "nav-dropdown";
      const menu = document.createElement("div");
      menu.className = "nav-dropdown-menu";
      const addButton = document.createElement("button");
      addButton.className = "nav-dropdown-item";
      addButton.type = "button";
      addButton.textContent = "Добавить работу";
      addButton.addEventListener("click", () => switchView("add-record"));
      menu.append(addButton);
      wrapper.append(button, menu);
      navItems.append(wrapper);
    } else {
      navItems.append(button);
    }
  }
  const currentInNav = nav.some((item) => item.view === state.currentView) || state.currentView === "add-record";
  const currentIsAdminView = ADMIN_VIEWS.has(state.currentView);
  if (currentInNav || currentIsAdminView) {
    // Навигация перестроена, но страница не меняется — только восстанавливаем active-класс
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === state.currentView || (state.currentView === "add-record" && btn.dataset.view === "records"));
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

function fillMasterFilters(items) {
  fillSelect(masterSelect, items, "— Выберите мастера —");
  fillSelect(editMasterSelect, items, "— Выберите мастера —");
  fillSelect(masterFilter, items, "Выбрать мастера");
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
  const canSeeSettings = bootstrap.user?.is_superuser || bootstrap.user?.is_staff;
  settingsWrapper.classList.toggle("is-hidden", !canSeeSettings);
}

function hasPermission(permission) {
  const user = state.bootstrap?.user || {};
  return Boolean(user.is_superuser || (user.permissions || []).includes(permission));
}

function updateRecordTotal() {
  totalAmountEl.textContent = formatMoney(asInt(partsInput.value) + asInt(servicesInput.value));
  updateRecordSubmitState();
}

function applyPartsAdjustment(direction) {
  const amount = asInt(partsAdjustInput.value);
  if (!amount) {
    partsAdjustInput.value = "";
    return;
  }
  const nextValue = direction === "subtract"
    ? Math.max(0, asInt(partsInput.value) - amount)
    : asInt(partsInput.value) + amount;
  partsInput.value = String(nextValue);
  partsAdjustInput.value = "";
  updateRecordTotal();
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

function updateRecordSubmitState() {
  if (!submitRecordButton) return;
  submitRecordButton.disabled = Boolean(validateRecordForm());
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
  const collectedText = record.collected
    ? `Забрал ${formatDate(record.collected_date)}`
    : "Забрал";
  return `
    <div class="table-actions">
      <button type="button" class="btn-action btn-action-icon view-details" data-id="${id}" title="Подробнее">▣</button>
      <button type="button" class="btn-action btn-action-icon edit-record" data-id="${id}" title="Изменить">✎</button>
      <button type="button" class="btn-action btn-action-icon notify-client-btn ${notificationCount > 0 || record.client_notified ? "is-notified" : "is-pending"}" data-id="${id}" title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}">
        <span class="notify-client-btn__bell">🔔</span>
        <span class="notify-client-btn__count ${notificationCount <= 0 ? "is-empty" : ""}">${notificationCount > 0 ? notificationCount : ""}</span>
      </button>
      <button type="button" class="btn-action btn-action-main ${record.collected ? "btn-collected" : "btn-collect"}" data-id="${id}" ${record.collected ? "disabled" : ""}>${collectedText}</button>
    </div>
  `;
}

function renderRecords() {
  const totalPages = Math.max(1, Math.ceil(state.filteredRecords.length / state.perPage));
  const start = (state.currentPage - 1) * state.perPage;
  const pageRecords = state.filteredRecords.slice(start, start + state.perPage);
  recordsBody.innerHTML = "";

  if (!pageRecords.length) {
    showTableMessage(recordsBody, 8, "Записей не найдено");
  } else {
    pageRecords.forEach((record, index) => {
      const id = recordStableId(record);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input type="checkbox" class="record-checkbox" data-id="${id}" ${state.selectedRecordIds.has(id) ? "checked" : ""}></td>
        <td>${start + index + 1}</td>
        <td>${formatDate(record.record_date)}</td>
        <td class="text-truncate">${escapeHtml(record.title || "—")}</td>
        <td class="cell-nowrap"><a href="#" class="record-phone-link whatsapp-link" data-id="${id}" data-phone="7${String(record.phone || "").replace(/\D/g, "").slice(-10)}" data-amount="${Number(record.total_amount || 0)}">${formatPhone(record.phone)}</a></td>
        <td class="record-total-amount">${formatPaymentAmount(record.total_amount)}</td>
        <td>${escapeHtml(record.master || "—")}</td>
        <td>${buildRecordActions(record)}</td>
      `;
      recordsBody.append(row);
    });
  }

  selectAllCheckbox.checked = pageRecords.length > 0 && pageRecords.every((record) => state.selectedRecordIds.has(recordStableId(record)));
  renderPagination(totalPages);
  updateSelectionTotals();
}

function showRecordDetails(record) {
  document.querySelector("#modal-title").value = record.title || "";
  document.querySelector("#modal-name").value = record.client_name || record.name || "";
  document.querySelector("#modal-phone").value = formatPhone(record.phone);
  document.querySelector("#modal-parts").value = formatMoney(record.parts);
  document.querySelector("#modal-services").value = formatMoney(record.display_services || record.services);
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

function buildWhatsAppUrl(record) {
  const amount = Number(record.total_amount || 0);
  const paymentText = amount <= 0 ? "По гарантии" : `${formatMoney(amount)} руб.`;
  const message = `Ассаламу 1алайкум! Добрый день!
Ремонт Вашей техники завершён.
Сумма к оплате: ${paymentText}
Можете забирать в любое удобное время.

Рабочее время магазина: с 9:00 до 19:00, без выходных.
Контактный номер: +7 989 908-97-42`;
  const phone = `7${String(record.phone || "").replace(/\D/g, "").slice(-10)}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

async function notifyClient(record, method = "call") {
  const settings = currentSettings();
  if (!settings.server_url || !settings.username || !settings.password) {
    setStatus("Для отметки уведомления нужен вход в аккаунт.");
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
    setStatus(method === "whatsapp" ? "WhatsApp открыт, уведомление клиента отмечено." : "Уведомление клиента отмечено.");
    return true;
  } catch (error) {
    console.error(error);
    setStatus(`Не удалось отметить уведомление клиента: ${error}`);
    return false;
  }
}

function logout() {
  window.clearInterval(state.pollTimer);
  state.bootstrap = null;
  state.records = [];
  state.filteredRecords = [];
  state.selectedRecordIds.clear();
  passwordInput.value = "";
  loginPasswordInput.value = "";
  appShell.classList.add("is-locked");
  loginScreen.classList.remove("is-hidden");
  loginStatus.textContent = "Вы вышли из аккаунта. Введите логин и пароль.";
  settingsWrapper.classList.add("is-hidden");
  settingsDropdown.classList.add("is-hidden");
}

function updateEditTotal() {
  editTotalAmount.textContent = formatMoney(asInt(editPartsInput.value) + asInt(editServicesInput.value));
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
    return;
  }

  try {
    await invoke("update_record", {
      record: {
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
        total_amount: parts + services,
      },
    });
    recordEditModal.close();
    await loadRecords();
    setStatus("Изменения сохранены локально. Отправляю на сайт...");
    await syncNow("Изменения записи синхронизированы с сайтом.");
  } catch (error) {
    console.error(error);
    setStatus(`Не удалось сохранить изменения: ${error}`);
  }
}

async function loadRecords() {
  const rows = await invoke("list_records");
  state.records = rows;
  if (!state.datesInitialized && rows.length) {
    const lastDate = rows.map((record) => record.record_date).sort().at(-1);
    startDateFilter.value = lastDate;
    endDateFilter.value = lastDate;
    state.datesInitialized = true;
  }
  state.pendingRecords = rows.filter((record) => record.sync_status !== "synced").length;
  updateSyncButton();
  filterRecords();
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

async function loadAssemblies() {
  const rows = await invoke("list_assemblies");
  state.pendingAssemblies = rows.filter((row) => row.sync_status !== "synced").length;
  updateSyncButton();
  const query = assemblySearch.value.trim().toLowerCase();
  const grouped = new Map(groupAssemblies(rows).map((item) => [item.name, item]));
  const collectors = (state.bootstrap?.collectors || []).map((item) => item.value || item.label || item);
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
    const chips = group.rows
      .map((row) => `<span class="assembly-chip">${formatMoney(row.amount)} ₽ <b>${escapeHtml(row.sync_status)}</b></span>`)
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
        <button class="assembly-button" type="button" data-assembly-add="${inputId}" data-collector-name="${escapeHtml(group.name)}">+ Сборка</button>
      </div>
    `;
    assemblyList.append(card);
  }
}

async function saveAssemblyForCollector(collectorName, amountInput, button) {
  const amount = asInt(amountInput.value);
  if (!collectorName || !amount) {
    setStatus("Укажите сумму сборки.");
    amountInput.focus();
    return;
  }

  button.disabled = true;
  try {
    const localId = await invoke("save_assembly", {
      assembly: {
        sync_uuid: crypto.randomUUID(),
        entry_date: todayIsoDate(),
        collector_name: collectorName,
        amount,
        assembly_count: 1,
      },
    });
    amountInput.value = "0";
    await loadAssemblies();
    setStatus(`Сборка L-${localId} сохранена локально. Отправляю на сайт...`);
    await syncNow(`Сборка L-${localId} сохранена и синхронизирована с сайтом.`);
  } catch (error) {
    console.error(error);
    setStatus(`Ошибка сохранения сборки: ${error}`);
  } finally {
    button.disabled = false;
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
        За выбранную дату нет записей со статусом выдачи.
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
                  <td>${formatPhone(record.phone)}</td>
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

async function loadSalaryView() {
  if (!salaryContent) return;
  const dateValue = salaryDateInput.value || "";
  setAdminStatus(salaryStatus, "Загружаю...");
  try {
    const query = dateValue ? `?date=${encodeURIComponent(dateValue)}` : "";
    const data = await apiRequest("GET", `mobile/salary/${query}`);
    salaryDateInput.value = data.date || dateValue || todayIsoDate();
    salaryDateMeta.textContent = data.date ? formatDate(data.date) : "Выбери дату";
    const masters = data.masters || [];
    const assemblers = (data.assemblers || []).map((item) => ({
      name: `Сборщик - ${item.name || "—"}`,
      earned: item.earned || 0,
    }));
    const records = data.records || [];
    state.salaryRecords = records;
    salaryContent.innerHTML = `
      ${renderSalaryList("Мастера", masters, "По мастерам пока пусто", "За эту дату начислений для мастеров не найдено.")}
      ${renderSalaryList("Сборщики", assemblers, "По сборке пока пусто", "За выбранную дату начислений для сборщиков не найдено.")}
      ${renderSalaryRecords(records)}
    `;
    setAdminStatus(salaryStatus, "");
  } catch (error) {
    console.error(error);
    setAdminStatus(salaryStatus, `Ошибка: ${error}`, true);
  }
}

async function refreshAll() {
  await loadRecords();
  await loadAssemblies();
  if (state.currentView === "salary") {
    await loadSalaryView();
  }
}

function updateSyncButton() {
  const count = state.pendingRecords + state.pendingAssemblies;
  syncButton.classList.toggle("sync-hidden", count <= 0);
  syncButton.textContent = count > 0 ? `Синхр. ${count}` : "Синхр.";
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
    return;
  }

  try {
    setStatus("Сохраняю запись в локальную базу...");
    const localId = await invoke("save_record", {
      record: {
        sync_uuid: crypto.randomUUID(),
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
      },
    });
    recordForm.reset();
    partsInput.value = "0";
    servicesInput.value = "0";
    updateRecordTotal();
    updateRecordSubmitState();
    await loadRecords();
    setStatus(`Запись L-${localId} сохранена локально. Отправляю на сайт...`);
    await syncNow(`Запись L-${localId} сохранена и синхронизирована с сайтом.`);
  } catch (error) {
    console.error(error);
    setStatus(`Ошибка сохранения записи: ${error}`);
  }
}

async function syncPendingRecords() {
  saveSyncSettings();
  const settings = currentSettings();
  if (!settings.server_url) {
    setStatus("Укажите адрес сайта.");
    return;
  }
  if (!settings.username || !settings.password) {
    setStatus("Введите логин и пароль от сайта.");
    return;
  }

  try {
    setStatus("Отправляю локальные записи на сайт...");
    const message = await invoke("sync_records", {
      settings,
    });
    await invoke("pull_records", { settings });
    await refreshAll();
    setStatus(message);
  } catch (error) {
    console.error(error);
    setStatus(`Ошибка синхронизации: ${error}`);
  }
}

async function syncNow(successMessage = "Действие синхронизировано с сайтом.") {
  const settings = currentSettings();
  if (!settings.server_url || !settings.username || !settings.password) {
    await refreshAll();
    setStatus("Сохранено локально. Для отправки на сайт нужен вход в аккаунт.");
    return false;
  }

  try {
    const message = await invoke("sync_records", { settings });
    await invoke("pull_records", { settings });
    await refreshAll();
    setStatus(message.includes("уже отметили") ? message : (successMessage || message));
    return true;
  } catch (error) {
    console.error(error);
    await refreshAll();
    setStatus(`Сохранено локально, но сайт сейчас не принял синхронизацию: ${error}`);
    return false;
  }
}

async function pullFromSite(reason = "Обновляю данные с сайта...") {
  const settings = currentSettings();
  if (!settings.server_url || !settings.username || !settings.password) {
    return;
  }
  try {
    setStatus(reason);
    const bootstrap = await invoke("login_and_bootstrap", { settings });
    applyBootstrap(bootstrap);
    await invoke("pull_records", { settings });
    await refreshAll();
    setStatus(`Синхронизировано в ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}.`);
  } catch (error) {
    console.error(error);
    setStatus("Не синхронизировано с сайтом.");
  }
}

async function login(event) {
  event.preventDefault();
  serverUrlInput.value = loginServerUrlInput.value.trim();
  usernameInput.value = loginUsernameInput.value.trim();
  passwordInput.value = loginPasswordInput.value;
  saveSyncSettings();
  try {
    loginStatus.textContent = "Входим и скачиваем актуальные данные...";
    const settings = currentSettings();
    const bootstrap = await invoke("login_and_bootstrap", { settings });
    applyBootstrap(bootstrap);
    loginScreen.classList.add("is-hidden");
    appShell.classList.remove("is-locked");
    syncPanel.classList.add("is-hidden");
    try {
      await invoke("pull_records", { settings });
    } catch (pullError) {
      console.error(pullError);
      setStatus("Вход выполнен, но данные с сайта пока не скачались.");
    }
    await refreshAll();
    if (!statusText.textContent.startsWith("Вход выполнен, но")) {
      setStatus("Вход выполнен. Данные с сайта загружены, офлайн-режим готов.");
    }
    window.clearInterval(state.pollTimer);
    state.pollTimer = window.setInterval(() => pullFromSite("Автоматически обновляю данные с сайта..."), 30000);
  } catch (error) {
    console.error(error);
    loginStatus.textContent = `Ошибка входа: ${error}`;
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  loadSyncSettings();
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
    await refreshAll();
    renderNavigation();
    setStatus("Введите логин и пароль, чтобы загрузить данные с сайта.");
  } catch (error) {
    console.error(error);
    setStatus(`Ошибка локальной базы: ${error}`);
  }

  document.querySelector("#parts-add-btn").addEventListener("click", () => applyPartsAdjustment("add"));
  document.querySelector("#parts-subtract-btn").addEventListener("click", () => applyPartsAdjustment("subtract"));
  partsAdjustInput.addEventListener("input", () => {
    partsAdjustInput.value = String(partsAdjustInput.value || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  });
  partsAdjustInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyPartsAdjustment("add");
    }
  });
  partsInput.addEventListener("input", updateRecordTotal);
  servicesInput.addEventListener("input", updateRecordTotal);
  servicesInput.addEventListener("blur", () => {
    normalizeAmountField(servicesInput);
    updateRecordTotal();
  });
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
  phoneFilter.addEventListener("input", () => {
    state.currentPage = 1;
    filterRecords();
  });
  [masterFilter, collectedFilter, startDateFilter, endDateFilter].forEach((input) => {
    input.addEventListener("change", () => {
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
  recordsBody.addEventListener("change", (event) => {
    if (!event.target.classList.contains("record-checkbox")) return;
    const id = event.target.dataset.id;
    if (event.target.checked) {
      state.selectedRecordIds.add(id);
    } else {
      state.selectedRecordIds.delete(id);
    }
    renderRecords();
  });
  recordsBody.addEventListener("click", async (event) => {
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
      const record = state.records.find((item) => recordStableId(item) === notifyButton.dataset.id);
      if (record) await notifyClient(record, "call");
      return;
    }

    const phoneLink = event.target.closest(".whatsapp-link");
    if (phoneLink) {
      event.preventDefault();
      const record = state.records.find((item) => recordStableId(item) === phoneLink.dataset.id);
      if (!record) return;
      await notifyClient(record, "whatsapp");
      window.open(buildWhatsAppUrl(record), "_blank");
      return;
    }

    const collectButton = event.target.closest(".btn-collect");
    if (collectButton) {
      try {
        await invoke("mark_record_collected", { recordKey: collectButton.dataset.id });
        await loadRecords();
        setStatus("Запись отмечена как 'Забрал'. Отправляю на сайт...");
        await syncNow("Запись отмечена как 'Забрал' и синхронизирована с сайтом.");
      } catch (error) {
        console.error(error);
        setStatus(`Не удалось отметить 'Забрал': ${error}`);
      }
    }
  });
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

    const collectButton = event.target.closest(".salary-collect-record");
    if (collectButton) {
      try {
        await invoke("mark_record_collected", { recordKey: collectButton.dataset.id });
        setAdminStatus(salaryStatus, "Запись отмечена как 'Забрал'. Отправляю на сайт...");
        await syncNow("Запись отмечена как 'Забрал' и синхронизирована с сайтом.");
        await loadSalaryView();
      } catch (error) {
        console.error(error);
        setAdminStatus(salaryStatus, `Не удалось отметить 'Забрал': ${error}`, true);
      }
    }
  });
  loginForm.addEventListener("submit", login);
  headerSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    phoneFilter.value = headerPhoneSearch.value.trim();
    state.currentPage = 1;
    switchView("records");
    filterRecords();
  });
  logoutButton.addEventListener("click", logout);
  refreshButton.addEventListener("click", () => pullFromSite("Обновляю данные с сайта..."));
  syncButton.addEventListener("click", syncPendingRecords);
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

  // ── Admin views init ──────────────────────────────────────────────
  initTimesheetView();
  initEmpAddModal();
  initAuditView();
  initOperatorView();
  initUsersView();
  initShopView();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSettings() {
  return {
    server_url: (serverUrlInput.value || loginServerUrlInput.value || "http://localhost:8000").trim(),
    username: (usernameInput.value || loginUsernameInput.value || "").trim(),
    password: passwordInput.value || loginPasswordInput.value || "",
  };
}

function getToken() {
  return state.bootstrap?.access_token || "";
}

async function apiRequest(method, path, body = null) {
  const serverUrl = getSettings().server_url;
  const token = getToken();
  const args = { serverUrl, token, method, path };
  if (body !== null) args.body = body;
  return invoke("api_request", args);
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

// ── БУХГАЛТЕРИЯ ───────────────────────────────────────────────────────────────

let buhEmployeeMap = {};
let buhPositions = [];
let buhDepartments = [];
let buhWeekdays = [];

function initTimesheetView() {
  initInlineEmployeeForm();
  initEmpModal();
  initDebtPanels();
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
    const employees = data.employees || [];
    renderBuhTable(employees);
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
      <td><button class="ts-gear-btn" data-emp-id="${emp.id}" title="Настройки">⚙</button></td>
    `;
    tbody.append(tr);
  }

  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest(".ts-gear-btn");
    if (!btn) return;
    const emp = buhEmployeeMap[parseInt(btn.dataset.empId, 10)];
    if (emp) openEmpModal(emp);
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
    fillAuditFilters(data.users || [], data.actions || []);
    renderAuditTable(data.logs || []);
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
    opt.textContent = a.label;
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
      <td><span class="audit-badge">${log.action_label || log.action}</span></td>
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
    const imgHtml = p.image_url
      ? `<img src="${p.image_url}" alt="${p.name}" class="admin-image-thumb" />`
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
      document.querySelector("#shop-product-image-preview").innerHTML = product.image_url
        ? `<img src="${product.image_url}" alt="preview" class="admin-image-thumb" />`
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
