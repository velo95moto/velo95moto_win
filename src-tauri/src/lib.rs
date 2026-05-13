use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tauri::Manager;

const DEFAULT_SERVER_URL: &str = "https://velo95moto.ru";
const LOCAL_DATABASE_FILE: &str = "velo95moto-offline.db";

fn normalize_server_url(value: &str) -> String {
    let server_url = value.trim().trim_end_matches('/');
    if server_url.is_empty() {
        DEFAULT_SERVER_URL.to_string()
    } else {
        server_url.to_string()
    }
}

fn deserialize_server_url<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;
    Ok(normalize_server_url(&value))
}

#[derive(Debug, Deserialize)]
struct NewRecord {
    sync_uuid: String,
    record_date: String,
    title: String,
    client_name: String,
    phone: String,
    master: String,
    parts: i64,
    services: i64,
    comments: String,
    free_repair: bool,
    master_only: bool,
    total_amount: i64,
}

#[derive(Debug, Deserialize)]
struct UpdatedRecord {
    record_key: String,
    title: String,
    client_name: String,
    phone: String,
    master: String,
    parts: i64,
    services: i64,
    comments: String,
    free_repair: bool,
    master_only: bool,
    total_amount: i64,
}

#[derive(Debug, Deserialize)]
struct NewAssembly {
    sync_uuid: String,
    entry_date: String,
    collector_name: String,
    amount: i64,
    assembly_count: i64,
    assembly_order_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct NewAssemblyOrder {
    name: String,
    quantity: i64,
    is_urgent: bool,
}

#[derive(Debug, Serialize)]
struct LocalAssemblyOrder {
    local_id: i64,
    server_id: Option<i64>,
    sync_uuid: String,
    name: String,
    assigned_collector_name: String,
    is_urgent: bool,
    status: String,
    is_done: bool,
    created_at: String,
    completed_at: String,
}

#[derive(Debug, Serialize)]
struct LocalEmployeeAdvance {
    local_id: i64,
    sync_uuid: String,
    employee_name: String,
    amount: i64,
    advance_date: String,
    created_at: String,
    sync_status: String,
}

#[derive(Debug, Deserialize)]
struct NewEmployee {
    full_name: String,
    department: String,
    primary_position_id: Option<i64>,
    secondary_position_id: Option<i64>,
    is_active: bool,
    debt: i64,
    salary: i64,
    day_off: String,
    use_fixed_daily_salary: bool,
    daily_salary: i64,
}

#[derive(Debug, Deserialize)]
struct SyncSettings {
    #[serde(deserialize_with = "deserialize_server_url")]
    server_url: String,
    username: String,
    password: String,
}

#[derive(Debug, Serialize)]
struct LocalRecord {
    local_id: i64,
    server_id: Option<i64>,
    sync_status: String,
    record_date: String,
    title: String,
    client_name: String,
    phone: String,
    master: String,
    parts: i64,
    services: i64,
    comments: String,
    free_repair: bool,
    master_only: bool,
    mast_50_5: i64,
    management_10: i64,
    collected: bool,
    collected_date: String,
    client_notified: bool,
    notification_count: i64,
    notification_tooltip: String,
    total_amount: i64,
    discount_amount: i64,
    original_parts_amount: i64,
    original_shop_service_amount: i64,
}

#[derive(Debug, Serialize)]
struct LocalAssembly {
    local_id: i64,
    server_id: Option<i64>,
    sync_status: String,
    entry_date: String,
    collector_name: String,
    amount: i64,
    assembly_count: i64,
}

#[derive(Debug)]
struct PendingRecord {
    sync_uuid: String,
    base_sync_version: Option<i64>,
    record_date: String,
    title: String,
    client_name: String,
    phone: String,
    master: String,
    parts: i64,
    services: i64,
    comments: String,
    free_repair: bool,
    master_only: bool,
    collected: bool,
    collected_date: String,
    total_amount: i64,
}

#[derive(Debug)]
struct PendingAssembly {
    local_id: i64,
    sync_uuid: String,
    entry_date: String,
    collector_name: String,
    amount: i64,
    assembly_count: i64,
}

#[derive(Debug)]
#[allow(dead_code)]
struct PendingAdvance {
    local_id: i64,
    sync_uuid: String,
    employee_name: String,
    amount: i64,
    advance_date: String,
}

#[derive(Debug)]
#[allow(dead_code)]
struct PendingOrder {
    local_id: i64,
    server_id: Option<i64>,
    sync_uuid: String,
    name: String,
    is_urgent: bool,
    status: String,
    assigned_collector_name: String,
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|error| error.to_string())?;
    Ok(app_dir.join(LOCAL_DATABASE_FILE))
}

fn open_database(app: &tauri::AppHandle) -> Result<Connection, String> {
    Connection::open(database_path(app)?).map_err(|error| error.to_string())
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| error.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    if !columns.iter().any(|name| name == column) {
        conn.execute(&format!("ALTER TABLE {table} ADD COLUMN {definition}"), [])
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

// ── Sync state helpers ────────────────────────────────────────────────────────

fn get_sync_state(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM sync_state WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .ok()
}

fn set_sync_state(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO sync_state (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
fn init_database(app: tauri::AppHandle) -> Result<(), String> {
    let conn = open_database(&app)?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS records (
            local_id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER,
            sync_uuid TEXT NOT NULL UNIQUE,
            base_sync_version INTEGER,
            sync_status TEXT NOT NULL DEFAULT 'pending',
            record_date TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            client_name TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            master TEXT NOT NULL DEFAULT '',
            parts INTEGER NOT NULL DEFAULT 0,
            services INTEGER NOT NULL DEFAULT 0,
            comments TEXT NOT NULL DEFAULT '',
            free_repair INTEGER NOT NULL DEFAULT 0,
            master_only INTEGER NOT NULL DEFAULT 0,
            total_amount INTEGER NOT NULL DEFAULT 0,
            mast_50_5 INTEGER NOT NULL DEFAULT 0,
            management_10 INTEGER NOT NULL DEFAULT 0,
            collected INTEGER NOT NULL DEFAULT 0,
            collected_date TEXT NOT NULL DEFAULT '',
            client_notified INTEGER NOT NULL DEFAULT 0,
            notification_count INTEGER NOT NULL DEFAULT 0,
            notification_tooltip TEXT NOT NULL DEFAULT 'Клиент не уведомлен',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_error TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS assemblies (
            local_id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER,
            sync_uuid TEXT NOT NULL UNIQUE,
            sync_status TEXT NOT NULL DEFAULT 'pending',
            entry_date TEXT NOT NULL,
            collector_name TEXT NOT NULL DEFAULT '',
            amount INTEGER NOT NULL DEFAULT 0,
            assembly_count INTEGER NOT NULL DEFAULT 1,
            assembly_order_id INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_error TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS assembly_orders (
            local_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL DEFAULT '',
            assigned_collector_name TEXT NOT NULL DEFAULT '',
            is_urgent INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'assembly',
            is_done INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT NOT NULL DEFAULT '',
            sync_status TEXT NOT NULL DEFAULT 'pending',
            last_error TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS employee_advances (
            local_id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_name TEXT NOT NULL DEFAULT '',
            amount INTEGER NOT NULL DEFAULT 0,
            advance_date TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'pending',
            last_error TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS sync_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_employee_advances_date ON employee_advances(advance_date);
        "#,
    )
    .map_err(|error| error.to_string())?;
    ensure_column(
        &conn,
        "records",
        "master",
        "master TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        &conn,
        "records",
        "free_repair",
        "free_repair INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        &conn,
        "records",
        "master_only",
        "master_only INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        &conn,
        "records",
        "mast_50_5",
        "mast_50_5 INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        &conn,
        "records",
        "management_10",
        "management_10 INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        &conn,
        "records",
        "collected",
        "collected INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        &conn,
        "records",
        "collected_date",
        "collected_date TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        &conn,
        "assemblies",
        "assembly_order_id",
        "assembly_order_id INTEGER",
    )?;
    ensure_column(
        &conn,
        "assembly_orders",
        "server_id",
        "server_id INTEGER",
    )?;
    ensure_column(
        &conn,
        "assembly_orders",
        "sync_uuid",
        "sync_uuid TEXT",
    )?;
    // Backfill sync_uuid for existing assembly_orders rows.
    let mut stmt_ao = conn
        .prepare("SELECT local_id FROM assembly_orders WHERE sync_uuid IS NULL OR sync_uuid = ''")
        .map_err(|e| e.to_string())?;
    let ao_ids: Vec<i64> = stmt_ao
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();
    drop(stmt_ao);
    for id in ao_ids {
        let new_uuid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "UPDATE assembly_orders SET sync_uuid = ?1 WHERE local_id = ?2",
            params![new_uuid, id],
        )
        .map_err(|e| e.to_string())?;
    }
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_assembly_orders_sync_uuid ON assembly_orders(sync_uuid)",
        [],
    )
    .map_err(|e| e.to_string())?;
    ensure_column(
        &conn,
        "employee_advances",
        "server_id",
        "server_id INTEGER",
    )?;
    ensure_column(
        &conn,
        "employee_advances",
        "sync_uuid",
        "sync_uuid TEXT",
    )?;
    // Backfill sync_uuid for existing rows that don't have one yet.
    let mut stmt = conn
        .prepare("SELECT local_id FROM employee_advances WHERE sync_uuid IS NULL OR sync_uuid = ''")
        .map_err(|e| e.to_string())?;
    let ids: Vec<i64> = stmt
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();
    drop(stmt);
    for id in ids {
        let new_uuid = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "UPDATE employee_advances SET sync_uuid = ?1 WHERE local_id = ?2",
            params![new_uuid, id],
        )
        .map_err(|e| e.to_string())?;
    }
    // Index for fast lookup by sync_uuid.
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_advances_sync_uuid ON employee_advances(sync_uuid)",
        [],
    )
    .map_err(|e| e.to_string())?;
    ensure_column(
        &conn,
        "records",
        "client_notified",
        "client_notified INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        &conn,
        "records",
        "notification_count",
        "notification_count INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        &conn,
        "records",
        "notification_tooltip",
        "notification_tooltip TEXT NOT NULL DEFAULT 'Клиент не уведомлен'",
    )?;
    ensure_column(
        &conn,
        "records",
        "discount_amount",
        "discount_amount INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        &conn,
        "records",
        "original_parts_amount",
        "original_parts_amount INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        &conn,
        "records",
        "original_shop_service_amount",
        "original_shop_service_amount INTEGER NOT NULL DEFAULT 0",
    )?;
    Ok(())
}

#[tauri::command]
fn save_record(app: tauri::AppHandle, record: NewRecord) -> Result<i64, String> {
    let conn = open_database(&app)?;
    conn.execute(
        r#"
        INSERT INTO records (
            sync_uuid, sync_status, record_date, title, client_name, phone, master,
            parts, services, comments, free_repair, master_only, total_amount
        ) VALUES (?1, 'pending', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        "#,
        params![
            record.sync_uuid,
            record.record_date,
            record.title,
            record.client_name,
            record.phone,
            record.master,
            record.parts,
            record.services,
            record.comments,
            record.free_repair as i64,
            record.master_only as i64,
            record.total_amount,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn list_records(app: tauri::AppHandle) -> Result<Vec<LocalRecord>, String> {
    let conn = open_database(&app)?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT local_id, server_id, sync_status, record_date, title, client_name,
                   phone, master, parts, services, comments, free_repair, master_only,
                   mast_50_5, management_10, collected, collected_date, client_notified,
                   notification_count, notification_tooltip, total_amount,
                   discount_amount, original_parts_amount, original_shop_service_amount
            FROM records
            ORDER BY record_date DESC, COALESCE(server_id, local_id) DESC
            "#,
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(LocalRecord {
                local_id: row.get(0)?,
                server_id: row.get(1)?,
                sync_status: row.get(2)?,
                record_date: row.get(3)?,
                title: row.get(4)?,
                client_name: row.get(5)?,
                phone: row.get(6)?,
                master: row.get(7)?,
                parts: row.get(8)?,
                services: row.get(9)?,
                comments: row.get(10)?,
                free_repair: row.get::<_, i64>(11)? != 0,
                master_only: row.get::<_, i64>(12)? != 0,
                mast_50_5: row.get(13)?,
                management_10: row.get(14)?,
                collected: row.get::<_, i64>(15)? != 0,
                collected_date: row.get(16)?,
                client_notified: row.get::<_, i64>(17)? != 0,
                notification_count: row.get(18)?,
                notification_tooltip: row.get(19)?,
                total_amount: row.get(20)?,
                discount_amount: row.get(21)?,
                original_parts_amount: row.get(22)?,
                original_shop_service_amount: row.get(23)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn mark_record_collected(app: tauri::AppHandle, record_key: String) -> Result<(), String> {
    let conn = open_database(&app)?;
    let today = chrono_like_today();
    let changed = if let Ok(server_id) = record_key.parse::<i64>() {
        conn.execute(
            r#"
            UPDATE records
            SET collected = 1,
                collected_date = ?1,
                sync_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
            WHERE server_id = ?2
            "#,
            params![today, server_id],
        )
        .map_err(|error| error.to_string())?
    } else {
        let local_id = record_key
            .trim_start_matches("L-")
            .parse::<i64>()
            .unwrap_or(0);
        conn.execute(
            r#"
            UPDATE records
            SET collected = 1,
                collected_date = ?1,
                sync_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
            WHERE local_id = ?2
            "#,
            params![today, local_id],
        )
        .map_err(|error| error.to_string())?
    };
    if changed == 0 {
        return Err("Запись не найдена в локальной базе.".to_string());
    }
    Ok(())
}

#[tauri::command]
fn update_record(app: tauri::AppHandle, record: UpdatedRecord) -> Result<(), String> {
    let conn = open_database(&app)?;
    let mast_50_5 = record.services / 2;
    let management_10 = if record.master_only { 0 } else { record.services / 20 };
    let corrected_total = if record.master_only { mast_50_5 } else { record.parts + record.services };
    let changed = if let Ok(server_id) = record.record_key.parse::<i64>() {
        conn.execute(
            r#"
            UPDATE records
            SET title = ?1,
                client_name = ?2,
                phone = ?3,
                master = ?4,
                parts = ?5,
                services = ?6,
                comments = ?7,
                free_repair = ?8,
                master_only = ?9,
                total_amount = ?10,
                mast_50_5 = ?11,
                management_10 = ?12,
                sync_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
            WHERE server_id = ?13
            "#,
            params![
                record.title,
                record.client_name,
                record.phone,
                record.master,
                record.parts,
                record.services,
                record.comments,
                record.free_repair as i64,
                record.master_only as i64,
                corrected_total,
                mast_50_5,
                management_10,
                server_id,
            ],
        )
        .map_err(|error| error.to_string())?
    } else {
        let local_id = record
            .record_key
            .trim_start_matches("L-")
            .parse::<i64>()
            .unwrap_or(0);
        conn.execute(
            r#"
            UPDATE records
            SET title = ?1,
                client_name = ?2,
                phone = ?3,
                master = ?4,
                parts = ?5,
                services = ?6,
                comments = ?7,
                free_repair = ?8,
                master_only = ?9,
                total_amount = ?10,
                mast_50_5 = ?11,
                management_10 = ?12,
                sync_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
            WHERE local_id = ?13
            "#,
            params![
                record.title,
                record.client_name,
                record.phone,
                record.master,
                record.parts,
                record.services,
                record.comments,
                record.free_repair as i64,
                record.master_only as i64,
                corrected_total,
                mast_50_5,
                management_10,
                local_id,
            ],
        )
        .map_err(|error| error.to_string())?
    };
    if changed == 0 {
        return Err("Запись не найдена в локальной базе.".to_string());
    }
    Ok(())
}

#[tauri::command]
fn notify_record_client(
    app: tauri::AppHandle,
    record_key: String,
    method: String,
    settings: SyncSettings,
) -> Result<serde_json::Value, String> {
    let conn = open_database(&app)?;
    let server_id = if let Ok(server_id) = record_key.parse::<i64>() {
        Some(server_id)
    } else {
        let local_id = record_key
            .trim_start_matches("L-")
            .parse::<i64>()
            .unwrap_or(0);
        conn.query_row(
            "SELECT server_id FROM records WHERE local_id = ?1",
            params![local_id],
            |row| row.get::<_, Option<i64>>(0),
        )
        .map_err(|error| error.to_string())?
    };

    let response = if let Some(server_id) = server_id {
        let token = fetch_token(&settings)?;
        let url = format!(
            "{}/mobile/records/{}/notify/",
            settings.server_url.trim_end_matches('/'),
            server_id
        );
        ureq::post(&url)
            .set("Authorization", &format!("Bearer {token}"))
            .send_json(json!({ "method": method }))
            .map_err(|error| error.to_string())?
            .into_json()
            .map_err(|error| error.to_string())?
    } else {
        json!({
            "success": true,
            "count": 1,
            "tooltip": "Уведомление ожидает синхронизации",
            "client_notified": true,
        })
    };

    let count = response
        .get("count")
        .and_then(|value| value.as_i64())
        .unwrap_or(1);
    let tooltip = response
        .get("tooltip")
        .and_then(|value| value.as_str())
        .unwrap_or("Клиент уведомлен");

    if let Ok(server_id) = record_key.parse::<i64>() {
        conn.execute(
            r#"
            UPDATE records
            SET client_notified = 1,
                notification_count = ?1,
                notification_tooltip = ?2,
                updated_at = CURRENT_TIMESTAMP
            WHERE server_id = ?3
            "#,
            params![count, tooltip, server_id],
        )
        .map_err(|error| error.to_string())?;
    } else {
        let local_id = record_key
            .trim_start_matches("L-")
            .parse::<i64>()
            .unwrap_or(0);
        conn.execute(
            r#"
            UPDATE records
            SET client_notified = 1,
                notification_count = ?1,
                notification_tooltip = ?2,
                updated_at = CURRENT_TIMESTAMP
            WHERE local_id = ?3
            "#,
            params![count, tooltip, local_id],
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(response)
}

#[tauri::command]
fn verify_operator_password(settings: SyncSettings, password: String) -> Result<bool, String> {
    let token = fetch_token(&settings)?;
    let url = format!(
        "{}/mobile/auth/verify-operator-password/",
        settings.server_url.trim_end_matches('/')
    );
    let response: serde_json::Value = ureq::post(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .send_json(json!({ "password": password }))
        .map_err(|error| error.to_string())?
        .into_json()
        .map_err(|error| error.to_string())?;
    Ok(response
        .get("success")
        .and_then(|value| value.as_bool())
        .unwrap_or(false))
}

#[tauri::command]
fn create_employee(
    settings: SyncSettings,
    employee: NewEmployee,
) -> Result<serde_json::Value, String> {
    let token = fetch_token(&settings)?;
    let url = format!(
        "{}/mobile/employees/create/",
        settings.server_url.trim_end_matches('/')
    );
    ureq::post(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .send_json(json!({
            "full_name": employee.full_name,
            "department": employee.department,
            "primary_position_id": employee.primary_position_id,
            "secondary_position_id": employee.secondary_position_id,
            "is_active": employee.is_active,
            "debt": employee.debt,
            "salary": employee.salary,
            "day_off": employee.day_off,
            "use_fixed_daily_salary": employee.use_fixed_daily_salary,
            "daily_salary": employee.daily_salary,
        }))
        .map_err(|error| error.to_string())?
        .into_json()
        .map_err(|error| error.to_string())
}

fn chrono_like_today() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0);
    let days = seconds / 86_400;
    civil_from_days(days)
}

fn civil_from_days(days: i64) -> String {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    let year = y + if m <= 2 { 1 } else { 0 };
    format!("{year:04}-{m:02}-{d:02}")
}

#[tauri::command]
fn save_assembly(app: tauri::AppHandle, assembly: NewAssembly) -> Result<i64, String> {
    let mut conn = open_database(&app)?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    if let Some(order_id) = assembly.assembly_order_id {
        let order_count: i64 = tx
            .query_row(
                r#"
                SELECT COUNT(*)
                FROM assembly_orders
                WHERE local_id = ?1
                  AND assigned_collector_name = ?2
                  AND status = 'in_progress'
                  AND is_done = 0
                "#,
                params![order_id, assembly.collector_name],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if order_count == 0 {
            return Err("Выбранный заказ уже закрыт или назначен другому сборщику.".to_string());
        }
    }

    tx.execute(
        r#"
        INSERT INTO assemblies (
            sync_uuid, sync_status, entry_date, collector_name, amount, assembly_count, assembly_order_id
        ) VALUES (?1, 'pending', ?2, ?3, ?4, ?5, ?6)
        "#,
        params![
            assembly.sync_uuid,
            assembly.entry_date,
            assembly.collector_name,
            assembly.amount,
            assembly.assembly_count,
            assembly.assembly_order_id,
        ],
    )
    .map_err(|error| error.to_string())?;
    let local_id = tx.last_insert_rowid();

    if let Some(order_id) = assembly.assembly_order_id {
        tx.execute(
            r#"
            UPDATE assembly_orders
            SET status = 'done',
                is_done = 1,
                completed_at = CURRENT_TIMESTAMP,
                sync_status = 'pending'
            WHERE local_id = ?1
            "#,
            params![order_id],
        )
        .map_err(|error| error.to_string())?;
    }

    tx.commit().map_err(|error| error.to_string())?;
    Ok(local_id)
}

#[tauri::command]
fn list_assemblies(app: tauri::AppHandle) -> Result<Vec<LocalAssembly>, String> {
    let conn = open_database(&app)?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT local_id, server_id, sync_status, entry_date, collector_name, amount, assembly_count
            FROM assemblies
            ORDER BY local_id DESC
            "#,
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(LocalAssembly {
                local_id: row.get(0)?,
                server_id: row.get(1)?,
                sync_status: row.get(2)?,
                entry_date: row.get(3)?,
                collector_name: row.get(4)?,
                amount: row.get(5)?,
                assembly_count: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_assembly_entry(app: tauri::AppHandle, local_id: i64, settings: SyncSettings) -> Result<(), String> {
    let conn = open_database(&app)?;

    // Проверяем: есть ли server_id у этой записи?
    let row: Option<(Option<i64>, String)> = conn.query_row(
        "SELECT server_id, sync_status FROM assemblies WHERE local_id = ?1 AND date(entry_date) = date('now', 'localtime')",
        params![local_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).ok();

    match &row {
        None => return Err("Запись не найдена или уже удалена.".to_string()),
        Some((Some(server_id), sync_status)) if sync_status == "synced" => {
            // Удаляем на сервере через JWT API
            if !settings.server_url.is_empty() && !settings.username.is_empty() && !settings.password.is_empty() {
                let agent = pull_agent();
                if let Ok(token) = fetch_token_with_agent(&agent, &settings) {
                    let url = format!(
                        "{}/mobile/assembly/entries/{}/",
                        settings.server_url.trim_end_matches('/'),
                        server_id,
                    );
                    let result = agent
                        .delete(&url)
                        .set("Authorization", &format!("Bearer {token}"))
                        .call();
                    match result {
                        Ok(_) => {}
                        Err(ureq::Error::Status(404, _)) => {} // уже удалена на сервере
                        Err(e) => return Err(format!("Не удалось удалить на сервере: {e}")),
                    }
                }
            }
        }
        _ => {} // pending или нет server_id — удаляем только локально
    }

    conn.execute(
        "DELETE FROM assemblies WHERE local_id = ?1 AND date(entry_date) = date('now', 'localtime')",
        params![local_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn clear_today_assemblies(app: tauri::AppHandle) -> Result<(), String> {
    let conn = open_database(&app)?;
    conn.execute(
        "DELETE FROM assemblies WHERE date(entry_date) = date('now', 'localtime')",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_employee_advance(
    app: tauri::AppHandle,
    employee_name: String,
    amount: i64,
    advance_date: String,
) -> Result<i64, String> {
    let employee_name = employee_name.trim();
    if employee_name.is_empty() {
        return Err("Сотрудник не найден.".to_string());
    }
    if amount <= 0 {
        return Err("Сумма должна быть положительным числом.".to_string());
    }
    if advance_date.trim().is_empty() {
        return Err("Дата аванса не указана.".to_string());
    }

    let conn = open_database(&app)?;
    let sync_uuid = uuid::Uuid::new_v4().to_string();
    conn.execute(
        r#"
        INSERT INTO employee_advances (employee_name, amount, advance_date, sync_status, sync_uuid)
        VALUES (?1, ?2, ?3, 'pending', ?4)
        "#,
        params![employee_name, amount, advance_date.trim(), sync_uuid],
    )
    .map_err(|error| error.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn list_employee_advances(
    app: tauri::AppHandle,
    date: Option<String>,
) -> Result<Vec<LocalEmployeeAdvance>, String> {
    let conn = open_database(&app)?;
    let filtered_date = date.as_deref().and_then(|d| {
        let t = d.trim();
        if t.is_empty() { None } else { Some(t.to_owned()) }
    });
    if let Some(d) = filtered_date {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT local_id, COALESCE(sync_uuid, ''), employee_name, amount, advance_date, created_at, sync_status
                FROM employee_advances
                WHERE advance_date = ?1
                ORDER BY datetime(created_at) ASC, local_id ASC
                "#,
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![d], |row| {
                Ok(LocalEmployeeAdvance {
                    local_id: row.get(0)?,
                    sync_uuid: row.get(1)?,
                    employee_name: row.get(2)?,
                    amount: row.get(3)?,
                    advance_date: row.get(4)?,
                    created_at: row.get(5)?,
                    sync_status: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    } else {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT local_id, COALESCE(sync_uuid, ''), employee_name, amount, advance_date, created_at, sync_status
                FROM employee_advances
                ORDER BY advance_date DESC, datetime(created_at) ASC, local_id ASC
                "#,
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(LocalEmployeeAdvance {
                    local_id: row.get(0)?,
                    sync_uuid: row.get(1)?,
                    employee_name: row.get(2)?,
                    amount: row.get(3)?,
                    advance_date: row.get(4)?,
                    created_at: row.get(5)?,
                    sync_status: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn delete_employee_advance(
    app: tauri::AppHandle,
    local_id: i64,
    settings: SyncSettings,
) -> Result<(), String> {
    let conn = open_database(&app)?;

    let row: Option<(String, String)> = conn.query_row(
        "SELECT COALESCE(sync_uuid, ''), sync_status FROM employee_advances WHERE local_id = ?1 AND advance_date = date('now', 'localtime')",
        params![local_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).ok();

    match &row {
        None => return Err("Запись не найдена или уже удалена.".to_string()),
        Some((sync_uuid, sync_status)) if sync_status == "synced" && !sync_uuid.is_empty() => {
            if !settings.server_url.is_empty() && !settings.username.is_empty() && !settings.password.is_empty() {
                let agent = pull_agent();
                if let Ok(token) = fetch_token_with_agent(&agent, &settings) {
                    let url = format!(
                        "{}/mobile/advances/",
                        settings.server_url.trim_end_matches('/'),
                    );
                    let result = agent
                        .delete(&url)
                        .set("Authorization", &format!("Bearer {token}"))
                        .send_json(json!({ "sync_uuid": sync_uuid }));
                    match result {
                        Ok(_) => {}
                        Err(ureq::Error::Status(404, _)) => {} // already deleted on server
                        Err(e) => return Err(format!("Не удалось удалить на сервере: {e}")),
                    }
                }
            }
        }
        _ => {} // pending or no sync_uuid — local-only delete
    }

    let changed = conn
        .execute(
            "DELETE FROM employee_advances WHERE local_id = ?1 AND advance_date = date('now', 'localtime')",
            params![local_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("Можно удалять только сегодняшние авансы.".to_string());
    }
    Ok(())
}

#[tauri::command]
fn create_assembly_orders(app: tauri::AppHandle, order: NewAssemblyOrder) -> Result<i64, String> {
    let name = order.name.trim();
    if name.is_empty() {
        return Err("Введите название заказа.".to_string());
    }
    if order.quantity < 1 || order.quantity > 100 {
        return Err("Количество должно быть от 1 до 100.".to_string());
    }

    let mut conn = open_database(&app)?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    for _ in 0..order.quantity {
        let sync_uuid = uuid::Uuid::new_v4().to_string();
        tx.execute(
            r#"
            INSERT INTO assembly_orders (name, is_urgent, status, is_done, sync_status, sync_uuid)
            VALUES (?1, ?2, 'assembly', 0, 'pending', ?3)
            "#,
            params![name, order.is_urgent as i64, sync_uuid],
        )
        .map_err(|error| error.to_string())?;
    }
    tx.commit().map_err(|error| error.to_string())?;
    Ok(order.quantity)
}

#[tauri::command]
fn list_assembly_orders(app: tauri::AppHandle) -> Result<Vec<LocalAssemblyOrder>, String> {
    let conn = open_database(&app)?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT local_id, server_id, COALESCE(sync_uuid, ''), name, assigned_collector_name,
                   is_urgent, status, is_done, created_at, completed_at
            FROM assembly_orders
            WHERE is_done = 0
               OR date(completed_at, 'localtime') = date('now', 'localtime')
               OR (
                    is_done = 1
                    AND completed_at = ''
                    AND date(created_at, 'localtime') = date('now', 'localtime')
               )
            ORDER BY is_done ASC, is_urgent DESC, datetime(created_at) DESC, local_id DESC
            "#,
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(LocalAssemblyOrder {
                local_id: row.get(0)?,
                server_id: row.get(1)?,
                sync_uuid: row.get(2)?,
                name: row.get(3)?,
                assigned_collector_name: row.get(4)?,
                is_urgent: row.get::<_, i64>(5)? != 0,
                status: row.get(6)?,
                is_done: row.get::<_, i64>(7)? != 0,
                created_at: row.get(8)?,
                completed_at: row.get(9)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn update_assembly_order_status(
    app: tauri::AppHandle,
    order_id: i64,
    action: String,
    collector_name: Option<String>,
) -> Result<(), String> {
    let conn = open_database(&app)?;
    let status: String = conn
        .query_row(
            "SELECT status FROM assembly_orders WHERE local_id = ?1",
            params![order_id],
            |row| row.get(0),
        )
        .map_err(|_| "Заказ не найден.".to_string())?;

    if action == "out_of_stock" {
        conn.execute(
            r#"
            UPDATE assembly_orders
            SET status = 'out_of_stock',
                is_done = 1,
                completed_at = CURRENT_TIMESTAMP,
                sync_status = 'pending'
            WHERE local_id = ?1
            "#,
            params![order_id],
        )
        .map_err(|error| error.to_string())?;
        return Ok(());
    }

    if action != "advance" {
        return Err("Неизвестное действие с заказом.".to_string());
    }

    if status == "assembly" {
        let collector = collector_name.unwrap_or_default().trim().to_string();
        conn.execute(
            r#"
            UPDATE assembly_orders
            SET status = 'in_progress',
                assigned_collector_name = ?2,
                sync_status = 'pending'
            WHERE local_id = ?1
            "#,
            params![order_id, collector],
        )
        .map_err(|error| error.to_string())?;
    } else if status == "in_progress" {
        conn.execute(
            r#"
            UPDATE assembly_orders
            SET status = 'done',
                is_done = 1,
                completed_at = CURRENT_TIMESTAMP,
                sync_status = 'pending'
            WHERE local_id = ?1
            "#,
            params![order_id],
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn fetch_token_with_agent(agent: &ureq::Agent, settings: &SyncSettings) -> Result<String, String> {
    let url = format!(
        "{}/mobile/auth/token/",
        settings.server_url.trim_end_matches('/')
    );
    let response_result = agent.post(&url).send_json(json!({
        "username": settings.username,
        "password": settings.password,
    }));

    let response = response_result.map_err(|error| match error {
        ureq::Error::Status(400, _) => {
            "Неверный запрос авторизации. Проверьте логин и пароль.".to_string()
        }
        ureq::Error::Status(401, _) => "Сайт не принял логин или пароль.".to_string(),
        ureq::Error::Status(code, _) => format!("Ошибка авторизации на сайте: HTTP {code}."),
        other => other.to_string(),
    })?;

    let response: serde_json::Value = response.into_json().map_err(|error| error.to_string())?;

    response
        .get("access")
        .and_then(|value| value.as_str())
        .map(ToOwned::to_owned)
        .ok_or_else(|| "Сайт не вернул access token.".to_string())
}

fn fetch_token(settings: &SyncSettings) -> Result<String, String> {
    let agent = ureq::AgentBuilder::new().build();
    fetch_token_with_agent(&agent, settings)
}

fn pull_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(5))
        .timeout_read(Duration::from_secs(8))
        .build()
}

fn fetch_bootstrap(settings: &SyncSettings, token: &str) -> Result<serde_json::Value, String> {
    let url = format!(
        "{}/mobile/bootstrap/",
        settings.server_url.trim_end_matches('/')
    );
    ureq::get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .call()
        .map_err(|error| error.to_string())?
        .into_json()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn health_check(server_url: String, timeout_ms: Option<u64>) -> Result<serde_json::Value, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(1500).clamp(500, 2000));
    let server_url = normalize_server_url(&server_url);
    let url = format!("{}/api/health/", server_url);
    let started = Instant::now();
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(timeout)
        .timeout_read(timeout)
        .build();

    let result = agent.get(&url).call();
    let duration_ms = started.elapsed().as_millis() as u64;

    match result {
        Ok(response) => {
            println!(
                "[offline-startup] health-check ok duration_ms={} status={}",
                duration_ms,
                response.status()
            );
            Ok(json!({
                "online": true,
                "duration_ms": duration_ms,
                "status": response.status(),
            }))
        }
        Err(ureq::Error::Status(status, _)) => {
            println!(
                "[offline-startup] health-check server-reachable duration_ms={} status={}",
                duration_ms, status
            );
            Ok(json!({
                "online": true,
                "duration_ms": duration_ms,
                "status": status,
            }))
        }
        Err(error) => {
            println!(
                "[offline-startup] health-check offline duration_ms={} error={}",
                duration_ms, error
            );
            Ok(json!({
                "online": false,
                "duration_ms": duration_ms,
                "error": error.to_string(),
            }))
        }
    }
}

#[tauri::command]
fn login_and_bootstrap(settings: SyncSettings) -> Result<serde_json::Value, String> {
    let token = fetch_token(&settings)?;
    let mut bootstrap = fetch_bootstrap(&settings, &token)?;
    bootstrap["access_token"] = json!(token);
    Ok(bootstrap)
}

fn pending_records(conn: &Connection) -> Result<Vec<PendingRecord>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT sync_uuid, base_sync_version, record_date, title, client_name,
                   phone, master, parts, services, comments, free_repair, master_only,
                   collected, collected_date, total_amount
            FROM records
            WHERE sync_status IN ('pending', 'error')
            ORDER BY local_id
            "#,
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PendingRecord {
                sync_uuid: row.get(0)?,
                base_sync_version: row.get(1)?,
                record_date: row.get(2)?,
                title: row.get(3)?,
                client_name: row.get(4)?,
                phone: row.get(5)?,
                master: row.get(6)?,
                parts: row.get(7)?,
                services: row.get(8)?,
                comments: row.get(9)?,
                free_repair: row.get::<_, i64>(10)? != 0,
                master_only: row.get::<_, i64>(11)? != 0,
                collected: row.get::<_, i64>(12)? != 0,
                collected_date: row.get(13)?,
                total_amount: row.get(14)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn pending_assemblies(conn: &Connection) -> Result<Vec<PendingAssembly>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT local_id, sync_uuid, entry_date, collector_name, amount, assembly_count
            FROM assemblies
            WHERE sync_status IN ('pending', 'error')
              AND date(entry_date) >= date('now', 'localtime', '-1 day')
            ORDER BY local_id
            "#,
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PendingAssembly {
                local_id: row.get(0)?,
                sync_uuid: row.get(1)?,
                entry_date: row.get(2)?,
                collector_name: row.get(3)?,
                amount: row.get(4)?,
                assembly_count: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn pending_orders(conn: &Connection) -> Result<Vec<PendingOrder>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT local_id, server_id, COALESCE(sync_uuid, ''), name, is_urgent, status,
                   assigned_collector_name
            FROM assembly_orders
            WHERE sync_status IN ('pending', 'error')
              AND sync_uuid IS NOT NULL AND sync_uuid <> ''
              AND date(created_at, 'localtime') >= date('now', 'localtime', '-1 day')
            ORDER BY local_id
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(PendingOrder {
                local_id: row.get(0)?,
                server_id: row.get(1)?,
                sync_uuid: row.get(2)?,
                name: row.get(3)?,
                is_urgent: row.get::<_, i64>(4)? != 0,
                status: row.get(5)?,
                assigned_collector_name: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn pending_advances(conn: &Connection) -> Result<Vec<PendingAdvance>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT local_id, COALESCE(sync_uuid, ''), employee_name, amount, advance_date
            FROM employee_advances
            WHERE sync_status IN ('pending', 'error')
              AND sync_uuid IS NOT NULL AND sync_uuid <> ''
              AND date(advance_date) >= date('now', 'localtime', '-1 day')
            ORDER BY local_id
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(PendingAdvance {
                local_id: row.get(0)?,
                sync_uuid: row.get(1)?,
                employee_name: row.get(2)?,
                amount: row.get(3)?,
                advance_date: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn save_server_records(conn: &Connection, records: &[serde_json::Value]) -> Result<usize, String> {
    let mut saved_count = 0;
    for record in records {
        let sync_uuid = record
            .get("sync_uuid")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        if sync_uuid.is_empty() {
            continue;
        }

        let server_id = record.get("server_id").and_then(|value| value.as_i64());
        let sync_version = record.get("sync_version").and_then(|value| value.as_i64());
        let date = record
            .get("date")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        let title = record
            .get("title")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        let client_name = record
            .get("name")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        let phone = record
            .get("phone")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        let master = record
            .get("master")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        let parts = record
            .get("parts")
            .and_then(|value| value.as_i64())
            .unwrap_or(0);
        let services = record
            .get("services")
            .and_then(|value| value.as_i64())
            .unwrap_or(0);
        let comments = record
            .get("comments")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        let free_repair = record
            .get("free_repair")
            .and_then(|value| value.as_bool())
            .unwrap_or(false) as i64;
        let master_only = record
            .get("master_only")
            .and_then(|value| value.as_bool())
            .unwrap_or(false) as i64;
        let total_amount = record
            .get("total_amount")
            .and_then(|value| value.as_i64())
            .unwrap_or(parts + services);
        let mast_50_5 = record
            .get("mast_50_5")
            .and_then(|value| value.as_i64())
            .unwrap_or(services / 2);
        let management_10 = record
            .get("management_10")
            .and_then(|value| value.as_i64())
            .unwrap_or(0);
        let collected = record
            .get("collected")
            .and_then(|value| value.as_bool())
            .unwrap_or(false) as i64;
        let collected_date = record
            .get("collected_date")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        let client_notified = record
            .get("client_notified")
            .and_then(|value| value.as_bool())
            .unwrap_or(false) as i64;
        let notification_count = record
            .get("notification_count")
            .and_then(|value| value.as_i64())
            .unwrap_or(0);
        let notification_tooltip = record
            .get("notification_tooltip")
            .and_then(|value| value.as_str())
            .unwrap_or("Клиент не уведомлен");
        let discount_amount = record
            .get("discount_amount")
            .and_then(|value| value.as_f64())
            .map(|v| v.round() as i64)
            .unwrap_or(0);
        let original_parts_amount = record
            .get("original_parts_amount")
            .and_then(|value| value.as_f64())
            .map(|v| v.round() as i64)
            .unwrap_or(0);
        let original_shop_service_amount = record
            .get("original_shop_service_amount")
            .and_then(|value| value.as_f64())
            .map(|v| v.round() as i64)
            .unwrap_or(0);

        conn.execute(
            r#"
            INSERT INTO records (
                server_id, sync_uuid, base_sync_version, sync_status, record_date, title,
                client_name, phone, master, parts, services, comments, free_repair,
                master_only, total_amount, mast_50_5, management_10, collected,
                collected_date, client_notified, notification_count, notification_tooltip,
                discount_amount, original_parts_amount, original_shop_service_amount,
                updated_at
            ) VALUES (?1, ?2, ?3, 'synced', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, CURRENT_TIMESTAMP)
            ON CONFLICT(sync_uuid) DO UPDATE SET
                server_id = excluded.server_id,
                base_sync_version = excluded.base_sync_version,
                sync_status = CASE
                    WHEN records.sync_status IN ('pending', 'error') THEN records.sync_status
                    ELSE 'synced'
                END,
                record_date = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.record_date ELSE excluded.record_date END,
                title = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.title ELSE excluded.title END,
                client_name = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.client_name ELSE excluded.client_name END,
                phone = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.phone ELSE excluded.phone END,
                master = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.master ELSE excluded.master END,
                parts = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.parts ELSE excluded.parts END,
                services = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.services ELSE excluded.services END,
                comments = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.comments ELSE excluded.comments END,
                free_repair = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.free_repair ELSE excluded.free_repair END,
                master_only = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.master_only ELSE excluded.master_only END,
                total_amount = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.total_amount ELSE excluded.total_amount END,
                mast_50_5 = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.mast_50_5 ELSE excluded.mast_50_5 END,
                management_10 = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.management_10 ELSE excluded.management_10 END,
                collected = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.collected ELSE excluded.collected END,
                collected_date = CASE WHEN records.sync_status IN ('pending', 'error') THEN records.collected_date ELSE excluded.collected_date END,
                client_notified = excluded.client_notified,
                notification_count = excluded.notification_count,
                notification_tooltip = excluded.notification_tooltip,
                discount_amount = excluded.discount_amount,
                original_parts_amount = excluded.original_parts_amount,
                original_shop_service_amount = excluded.original_shop_service_amount,
                updated_at = CURRENT_TIMESTAMP
            "#,
            params![
                server_id,
                sync_uuid,
                sync_version,
                date,
                title,
                client_name,
                phone,
                master,
                parts,
                services,
                comments,
                free_repair,
                master_only,
                total_amount,
                mast_50_5,
                management_10,
                collected,
                collected_date,
                client_notified,
                notification_count,
                notification_tooltip,
                discount_amount,
                original_parts_amount,
                original_shop_service_amount,
            ],
        )
        .map_err(|error| error.to_string())?;
        saved_count += 1;
    }
    Ok(saved_count)
}

// ── Incremental pull ──────────────────────────────────────────────────────────

#[tauri::command]
fn pull_records(app: tauri::AppHandle, settings: SyncSettings) -> Result<String, String> {
    let conn = open_database(&app)?;
    let agent = pull_agent();
    let token = fetch_token_with_agent(&agent, &settings)?;
    let base = settings.server_url.trim_end_matches('/');

    // Read last sync timestamp — None means first-ever sync
    let last_sync = get_sync_state(&conn, "last_records_sync_at");
    let is_full_sync = last_sync.is_none();

    let url = match &last_sync {
        Some(ts) => {
            // ISO timestamp contains '+' which must be percent-encoded in a query string
            let encoded = ts.replace('+', "%2B");
            format!("{base}/mobile/sync/records/?since={encoded}")
        }
        None => format!("{base}/mobile/sync/records/"),
    };

    let response: serde_json::Value = agent
        .get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .call()
        .map_err(|error| error.to_string())?
        .into_json()
        .map_err(|error| error.to_string())?;

    // server_time is used as the next ?since= value
    let server_time = response
        .get("server_time")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let records = response
        .get("records")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    // Split incoming records: active vs soft-deleted
    let mut active: Vec<serde_json::Value> = Vec::new();
    let mut deleted_uuids: Vec<String> = Vec::new();

    for record in &records {
        let sync_uuid = record
            .get("sync_uuid")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if sync_uuid.is_empty() {
            continue;
        }
        let is_deleted = record
            .get("sync_deleted_at")
            .map(|v| !v.is_null())
            .unwrap_or(false);

        if is_deleted {
            deleted_uuids.push(sync_uuid.to_string());
        } else {
            active.push(record.clone());
        }
    }

    // Upsert active records
    let saved_count = save_server_records(&conn, &active)?;

    // Delete soft-deleted records — skip if locally pending (unsent changes)
    let mut deleted_count = 0usize;
    for uuid in &deleted_uuids {
        let has_pending: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM records WHERE sync_uuid = ?1 AND sync_status IN ('pending', 'error')",
                params![uuid],
                |row| row.get::<_, i64>(0),
            )
            .unwrap_or(0)
            > 0;

        if !has_pending {
            conn.execute("DELETE FROM records WHERE sync_uuid = ?1", params![uuid])
                .map_err(|error| error.to_string())?;
            deleted_count += 1;
        }
    }

    // Persist the new high-water mark only after successful processing
    if !server_time.is_empty() {
        set_sync_state(&conn, "last_records_sync_at", &server_time)?;
    }

    if is_full_sync {
        Ok(format!(
            "Первая синхронизация завершена: загружено {saved_count} записей."
        ))
    } else {
        Ok(format!(
            "Обновлено: +{saved_count} изменений, -{deleted_count} удалений."
        ))
    }
}

// ── Pull assemblies from server ───────────────────────────────────────────────

#[tauri::command]
fn pull_assemblies(app: tauri::AppHandle, settings: SyncSettings) -> Result<String, String> {
    let conn = open_database(&app)?;
    let agent = pull_agent();
    let token = fetch_token_with_agent(&agent, &settings)?;
    let base = settings.server_url.trim_end_matches('/');
    let today = chrono_like_today();
    let url = format!("{base}/mobile/assembly/entries/?date={today}");

    let response: serde_json::Value = agent
        .get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .call()
        .map_err(|error| error.to_string())?
        .into_json()
        .map_err(|error| error.to_string())?;

    let entries = response
        .get("entries")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut inserted = 0usize;
    for entry in &entries {
        let server_id = match entry.get("id").and_then(|v| v.as_i64()) {
            Some(id) => id,
            None => continue,
        };
        let collector_name = entry.get("collector_name").and_then(|v| v.as_str()).unwrap_or("");
        let amount = entry.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
        let entry_date = entry.get("date").and_then(|v| v.as_str()).unwrap_or(&today);

        let already_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM assemblies WHERE server_id = ?1",
                params![server_id],
                |row| row.get::<_, i64>(0),
            )
            .unwrap_or(0)
            > 0;

        if !already_exists {
            let sync_uuid = format!("server-{server_id}");
            conn.execute(
                r#"
                INSERT OR IGNORE INTO assemblies
                    (server_id, sync_uuid, sync_status, entry_date, collector_name, amount, assembly_count)
                VALUES (?1, ?2, 'synced', ?3, ?4, ?5, 1)
                "#,
                params![server_id, sync_uuid, entry_date, collector_name, amount],
            )
            .map_err(|error| error.to_string())?;
            inserted += 1;
        }
    }

    Ok(format!("Загружено {inserted} новых записей сборки."))
}

// ── Pull all today's data in one token ───────────────────────────────────────

#[tauri::command]
fn pull_all_today(app: tauri::AppHandle, settings: SyncSettings) -> Result<serde_json::Value, String> {
    let conn = open_database(&app)?;
    let agent = pull_agent();
    let token = fetch_token_with_agent(&agent, &settings)?;
    let base = settings.server_url.trim_end_matches('/');
    let today = chrono_like_today();
    let auth = format!("Bearer {token}");

    let mut assemblies_added = 0usize;
    let mut orders_inserted = 0usize;
    let mut orders_updated = 0usize;
    let mut advances_added = 0usize;

    // --- assemblies for today ---
    if let Ok(resp) = agent
        .get(&format!("{base}/mobile/assembly/entries/?date={today}"))
        .set("Authorization", &auth)
        .call()
        .and_then(|r| r.into_json::<serde_json::Value>().map_err(Into::into))
    {
        let entries = resp.get("entries").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        // Собираем server_id которые вернул сервер
        let server_ids: Vec<i64> = entries.iter()
            .filter_map(|e| e.get("id").and_then(|v| v.as_i64()))
            .collect();

        // Удаляем локальные synced-записи за сегодня которых больше нет на сервере
        if !server_ids.is_empty() {
            let placeholders = server_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
            let _ = conn.execute(
                &format!("DELETE FROM assemblies WHERE date(entry_date) = ?1 AND sync_status = 'synced' AND server_id IS NOT NULL AND server_id NOT IN ({placeholders})"),
                params![today],
            );
        } else {
            // Сервер вернул пустой список — удаляем все synced за сегодня
            let _ = conn.execute(
                "DELETE FROM assemblies WHERE date(entry_date) = ?1 AND sync_status = 'synced'",
                params![today],
            );
        }

        // Добавляем новые записи с сервера
        for entry in &entries {
            let Some(server_id) = entry.get("id").and_then(|v| v.as_i64()) else { continue };
            let exists = conn.query_row(
                "SELECT COUNT(*) FROM assemblies WHERE server_id = ?1",
                params![server_id], |row| row.get::<_, i64>(0),
            ).unwrap_or(0) > 0;
            if !exists {
                let sync_uuid = format!("server-asm-{server_id}");
                let date = entry.get("date").and_then(|v| v.as_str()).unwrap_or(&today);
                let name = entry.get("collector_name").and_then(|v| v.as_str()).unwrap_or("");
                let amount = entry.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO assemblies (server_id, sync_uuid, sync_status, entry_date, collector_name, amount, assembly_count) VALUES (?1, ?2, 'synced', ?3, ?4, ?5, 1)",
                    params![server_id, sync_uuid, date, name, amount],
                );
                assemblies_added += 1;
            }
        }
    }

    // --- assembly orders ---
    if let Ok(resp) = agent
        .get(&format!("{base}/mobile/assembly/orders/"))
        .set("Authorization", &auth)
        .call()
        .and_then(|r| r.into_json::<serde_json::Value>().map_err(Into::into))
    {
        let orders_list = resp.get("orders").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        // Collect server_ids still present. The server cleans up orders older than today
        // automatically, so we use this list as the authoritative current state.
        let server_ids: Vec<i64> = orders_list.iter()
            .filter_map(|o| o.get("id").and_then(|v| v.as_i64()))
            .collect();

        // Soft-delete: remove local synced orders that the server no longer returns.
        // Never touch 'pending' rows — desktop's unsynced changes are preserved.
        if server_ids.is_empty() {
            let _ = conn.execute(
                "DELETE FROM assembly_orders WHERE sync_status = 'synced'",
                [],
            );
        } else {
            let placeholders = server_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
            let _ = conn.execute(
                &format!("DELETE FROM assembly_orders WHERE sync_status = 'synced' AND server_id IS NOT NULL AND server_id NOT IN ({placeholders})"),
                [],
            );
        }

        for order in &orders_list {
            let Some(server_id) = order.get("id").and_then(|v| v.as_i64()) else { continue };
            let sync_uuid = order.get("sync_uuid").and_then(|v| v.as_str()).unwrap_or("");
            let name = order.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let assigned = order.get("assigned_collector_name").and_then(|v| v.as_str()).unwrap_or("");
            let is_urgent = order.get("is_urgent").and_then(|v| v.as_bool()).unwrap_or(false) as i64;
            let status = order.get("status").and_then(|v| v.as_str()).unwrap_or("assembly");
            let is_done = order.get("is_done").and_then(|v| v.as_bool()).unwrap_or(false) as i64;
            let created_at = order.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
            let completed_at = order.get("completed_at").and_then(|v| v.as_str()).unwrap_or("");

            // Match by sync_uuid first (idempotent for our own pushes), then by server_id.
            let existing: Option<i64> = if !sync_uuid.is_empty() {
                conn.query_row(
                    "SELECT local_id FROM assembly_orders WHERE sync_uuid = ?1",
                    params![sync_uuid], |row| row.get(0),
                ).ok()
            } else {
                conn.query_row(
                    "SELECT local_id FROM assembly_orders WHERE server_id = ?1",
                    params![server_id], |row| row.get(0),
                ).ok()
            };

            if let Some(local_id) = existing {
                let _ = conn.execute(
                    "UPDATE assembly_orders SET server_id=?1, name=?2, assigned_collector_name=?3, is_urgent=?4, status=?5, is_done=?6, completed_at=?7, sync_status='synced', last_error='' WHERE local_id=?8 AND sync_status='synced'",
                    params![server_id, name, assigned, is_urgent, status, is_done, completed_at, local_id],
                );
                orders_updated += 1;
            } else {
                let final_uuid = if sync_uuid.is_empty() {
                    uuid::Uuid::new_v4().to_string()
                } else {
                    sync_uuid.to_string()
                };
                let _ = conn.execute(
                    "INSERT INTO assembly_orders (server_id, sync_uuid, name, assigned_collector_name, is_urgent, status, is_done, created_at, completed_at, sync_status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'synced')",
                    params![server_id, final_uuid, name, assigned, is_urgent, status, is_done, created_at, completed_at],
                );
                orders_inserted += 1;
            }
        }
    }

    // --- advances for today ---
    if let Ok(resp) = agent
        .get(&format!("{base}/mobile/advances/?date={today}"))
        .set("Authorization", &auth)
        .call()
        .and_then(|r| r.into_json::<serde_json::Value>().map_err(Into::into))
    {
        let entries = resp.get("advances").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        // Collect server_ids that are still present.
        let server_ids: Vec<i64> = entries.iter()
            .filter_map(|e| e.get("id").and_then(|v| v.as_i64()))
            .collect();

        // Delete local synced rows for today that the server no longer returns
        // (means web user deleted them). Never touch 'pending' rows.
        if server_ids.is_empty() {
            let _ = conn.execute(
                "DELETE FROM employee_advances WHERE advance_date = ?1 AND sync_status = 'synced'",
                params![today],
            );
        } else {
            let placeholders = server_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
            let _ = conn.execute(
                &format!("DELETE FROM employee_advances WHERE advance_date = ?1 AND sync_status = 'synced' AND server_id IS NOT NULL AND server_id NOT IN ({placeholders})"),
                params![today],
            );
        }

        for adv in &entries {
            let Some(server_id) = adv.get("id").and_then(|v| v.as_i64()) else { continue };
            let sync_uuid = adv.get("sync_uuid").and_then(|v| v.as_str()).unwrap_or("");
            // Match by sync_uuid first (idempotent if desktop pushed it), then by server_id.
            let existing_id: Option<i64> = if !sync_uuid.is_empty() {
                conn.query_row(
                    "SELECT local_id FROM employee_advances WHERE sync_uuid = ?1",
                    params![sync_uuid], |row| row.get(0),
                ).ok()
            } else {
                conn.query_row(
                    "SELECT local_id FROM employee_advances WHERE server_id = ?1",
                    params![server_id], |row| row.get(0),
                ).ok()
            };
            if let Some(local_id) = existing_id {
                // Update existing row to reflect server state, but only if it's already 'synced'
                // (don't overwrite local 'pending' edits).
                let _ = conn.execute(
                    "UPDATE employee_advances SET server_id = ?1, sync_status = 'synced', last_error = '' WHERE local_id = ?2 AND sync_status = 'synced'",
                    params![server_id, local_id],
                );
            } else {
                let employee_name = adv.get("employee_name").and_then(|v| v.as_str()).unwrap_or("");
                let amount = adv.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
                let date = adv.get("date").and_then(|v| v.as_str()).unwrap_or(&today);
                let final_uuid = if sync_uuid.is_empty() {
                    uuid::Uuid::new_v4().to_string()
                } else {
                    sync_uuid.to_string()
                };
                let _ = conn.execute(
                    "INSERT INTO employee_advances (server_id, sync_uuid, employee_name, amount, advance_date, sync_status) VALUES (?1,?2,?3,?4,?5,'synced')",
                    params![server_id, final_uuid, employee_name, amount, date],
                );
                advances_added += 1;
            }
        }
    }

    Ok(json!({
        "assemblies_added": assemblies_added,
        "orders_inserted": orders_inserted,
        "orders_updated": orders_updated,
        "advances_added": advances_added,
    }))
}

// ── Pull advances from server ─────────────────────────────────────────────────

#[tauri::command]
fn pull_advances(app: tauri::AppHandle, settings: SyncSettings) -> Result<String, String> {
    let conn = open_database(&app)?;
    let agent = pull_agent();
    let token = fetch_token_with_agent(&agent, &settings)?;
    let base = settings.server_url.trim_end_matches('/');
    let url = format!("{base}/mobile/advances/");

    let response: serde_json::Value = agent
        .get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .call()
        .map_err(|error| error.to_string())?
        .into_json()
        .map_err(|error| error.to_string())?;

    let advances = response
        .get("advances")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut inserted = 0usize;
    for adv in &advances {
        let server_id = match adv.get("id").and_then(|v| v.as_i64()) {
            Some(id) => id,
            None => continue,
        };
        let sync_uuid = adv.get("sync_uuid").and_then(|v| v.as_str()).unwrap_or("");
        let employee_name = adv.get("employee_name").and_then(|v| v.as_str()).unwrap_or("");
        let amount = adv.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
        let advance_date = adv.get("date").and_then(|v| v.as_str()).unwrap_or("");

        let existing_id: Option<i64> = if !sync_uuid.is_empty() {
            conn.query_row(
                "SELECT local_id FROM employee_advances WHERE sync_uuid = ?1",
                params![sync_uuid], |row| row.get(0),
            ).ok()
        } else {
            conn.query_row(
                "SELECT local_id FROM employee_advances WHERE server_id = ?1",
                params![server_id], |row| row.get(0),
            ).ok()
        };

        if let Some(local_id) = existing_id {
            // Only refresh metadata for synced rows; don't clobber local pending changes.
            let _ = conn.execute(
                "UPDATE employee_advances SET server_id = ?1, sync_status = 'synced', last_error = '' WHERE local_id = ?2 AND sync_status = 'synced'",
                params![server_id, local_id],
            );
        } else {
            let final_uuid = if sync_uuid.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                sync_uuid.to_string()
            };
            conn.execute(
                r#"
                INSERT INTO employee_advances
                    (server_id, sync_uuid, employee_name, amount, advance_date, sync_status)
                VALUES (?1, ?2, ?3, ?4, ?5, 'synced')
                "#,
                params![server_id, final_uuid, employee_name, amount, advance_date],
            )
            .map_err(|error| error.to_string())?;
            inserted += 1;
        }
    }

    Ok(format!("Загружено {inserted} новых авансов."))
}

// ── Pull assembly orders from server ─────────────────────────────────────────

#[tauri::command]
fn pull_assembly_orders(app: tauri::AppHandle, settings: SyncSettings) -> Result<String, String> {
    let conn = open_database(&app)?;
    let agent = pull_agent();
    let token = fetch_token_with_agent(&agent, &settings)?;
    let base = settings.server_url.trim_end_matches('/');
    let url = format!("{base}/mobile/assembly/orders/");

    let response: serde_json::Value = agent
        .get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .call()
        .map_err(|error| error.to_string())?
        .into_json()
        .map_err(|error| error.to_string())?;

    let orders = response
        .get("orders")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    // Server cleans up old orders; treat returned list as authoritative current state.
    let server_ids: Vec<i64> = orders.iter()
        .filter_map(|o| o.get("id").and_then(|v| v.as_i64()))
        .collect();

    // Soft-delete locally synced orders not returned by the server.
    if server_ids.is_empty() {
        let _ = conn.execute(
            "DELETE FROM assembly_orders WHERE sync_status = 'synced'",
            [],
        );
    } else {
        let placeholders = server_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
        let _ = conn.execute(
            &format!("DELETE FROM assembly_orders WHERE sync_status = 'synced' AND server_id IS NOT NULL AND server_id NOT IN ({placeholders})"),
            [],
        );
    }

    let mut inserted = 0usize;
    let mut updated = 0usize;
    for order in &orders {
        let server_id = match order.get("id").and_then(|v| v.as_i64()) {
            Some(id) => id,
            None => continue,
        };
        let sync_uuid = order.get("sync_uuid").and_then(|v| v.as_str()).unwrap_or("");
        let name = order.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let assigned = order.get("assigned_collector_name").and_then(|v| v.as_str()).unwrap_or("");
        let is_urgent = order.get("is_urgent").and_then(|v| v.as_bool()).unwrap_or(false) as i64;
        let status = order.get("status").and_then(|v| v.as_str()).unwrap_or("assembly");
        let is_done = order.get("is_done").and_then(|v| v.as_bool()).unwrap_or(false) as i64;
        let created_at = order.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
        let completed_at = order.get("completed_at").and_then(|v| v.as_str()).unwrap_or("");

        let existing: Option<i64> = if !sync_uuid.is_empty() {
            conn.query_row(
                "SELECT local_id FROM assembly_orders WHERE sync_uuid = ?1",
                params![sync_uuid], |row| row.get(0),
            ).ok()
        } else {
            conn.query_row(
                "SELECT local_id FROM assembly_orders WHERE server_id = ?1",
                params![server_id], |row| row.get(0),
            ).ok()
        };

        if let Some(local_id) = existing {
            // Only update if the local record hasn't been modified (sync_status = 'synced')
            conn.execute(
                r#"
                UPDATE assembly_orders
                SET server_id = ?1,
                    name = ?2,
                    assigned_collector_name = ?3,
                    is_urgent = ?4,
                    status = ?5,
                    is_done = ?6,
                    completed_at = ?7,
                    sync_status = 'synced',
                    last_error = ''
                WHERE local_id = ?8 AND sync_status = 'synced'
                "#,
                params![server_id, name, assigned, is_urgent, status, is_done, completed_at, local_id],
            )
            .map_err(|error| error.to_string())?;
            updated += 1;
        } else {
            let final_uuid = if sync_uuid.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                sync_uuid.to_string()
            };
            conn.execute(
                r#"
                INSERT INTO assembly_orders
                    (server_id, sync_uuid, name, assigned_collector_name, is_urgent, status, is_done,
                     created_at, completed_at, sync_status)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'synced')
                "#,
                params![server_id, final_uuid, name, assigned, is_urgent, status, is_done, created_at, completed_at],
            )
            .map_err(|error| error.to_string())?;
            inserted += 1;
        }
    }

    Ok(format!("Заказы сборок: +{inserted} новых, ~{updated} обновлено."))
}

// ── Sync info / reset ─────────────────────────────────────────────────────────

/// Returns sync metadata for the JS layer (last sync time, whether first sync).
#[tauri::command]
fn get_sync_info(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let conn = open_database(&app)?;
    let last_sync = get_sync_state(&conn, "last_records_sync_at");
    let is_first = last_sync.is_none();
    Ok(json!({
        "last_records_sync_at": last_sync,
        "is_first_sync": is_first,
    }))
}

/// Clears the incremental sync cursor so the next pull_records does a full sync.
#[tauri::command]
fn reset_sync(app: tauri::AppHandle) -> Result<(), String> {
    let conn = open_database(&app)?;
    conn.execute(
        "DELETE FROM sync_state WHERE key = 'last_records_sync_at'",
        [],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
fn sync_records(app: tauri::AppHandle, settings: SyncSettings) -> Result<String, String> {
    let conn = open_database(&app)?;
    let pending = pending_records(&conn)?;
    let pending_assembly_rows = pending_assemblies(&conn)?;
    let pending_advance_rows = pending_advances(&conn)?;
    let pending_order_rows = pending_orders(&conn)?;
    if pending.is_empty()
        && pending_assembly_rows.is_empty()
        && pending_advance_rows.is_empty()
        && pending_order_rows.is_empty()
    {
        return Ok("Нет данных для синхронизации.".to_string());
    }

    let token = fetch_token(&settings)?;
    let mut synced_count = 0;
    let mut conflicts_count = 0;
    let mut errors_count = 0;
    let mut already_collected_count = 0;

    if !pending.is_empty() {
        let payload_records: Vec<_> = pending
            .iter()
            .map(|record| {
                let mut item = json!({
                    "sync_uuid": record.sync_uuid,
                    "date": record.record_date,
                    "title": record.title,
                    "name": record.client_name,
                    "phone": record.phone,
                    "master": record.master,
                    "parts": record.parts,
                    "services": record.services,
                    "comments": record.comments,
                    "free_repair": record.free_repair,
                    "master_only": record.master_only,
                    "collected": record.collected,
                    "collected_date": if record.collected_date.is_empty() { serde_json::Value::Null } else { json!(record.collected_date) },
                    "total_amount": record.total_amount,
                });
                if let Some(version) = record.base_sync_version {
                    item["base_sync_version"] = json!(version);
                }
                item
            })
            .collect();

        let sync_url = format!(
            "{}/mobile/sync/records/",
            settings.server_url.trim_end_matches('/')
        );
        let response: serde_json::Value = ureq::post(&sync_url)
            .set("Authorization", &format!("Bearer {token}"))
            .send_json(json!({ "records": payload_records }))
            .map_err(|error| error.to_string())?
            .into_json()
            .map_err(|error| error.to_string())?;

        let saved = response
            .get("saved")
            .and_then(|value| value.as_array())
            .cloned()
            .unwrap_or_default();

        for saved_record in saved {
            let sync_uuid = saved_record
                .get("sync_uuid")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let server_id = saved_record
                .get("server_id")
                .and_then(|value| value.as_i64());
            let sync_version = saved_record
                .get("sync_version")
                .and_then(|value| value.as_i64());

            if !sync_uuid.is_empty() {
                conn.execute(
                    r#"
                    UPDATE records
                    SET server_id = ?1,
                        base_sync_version = ?2,
                        sync_status = 'synced',
                        last_error = '',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE sync_uuid = ?3
                    "#,
                    params![server_id, sync_version, sync_uuid],
                )
                .map_err(|error| error.to_string())?;
                synced_count += 1;
            }
        }

        conflicts_count = response
            .get("conflicts")
            .and_then(|value| value.as_array())
            .map(|items| items.len())
            .unwrap_or(0);
        if let Some(conflicts) = response.get("conflicts").and_then(|value| value.as_array()) {
            for conflict in conflicts {
                let Some(server_record) = conflict.get("server_record") else {
                    continue;
                };
                let sync_uuid = server_record
                    .get("sync_uuid")
                    .and_then(|value| value.as_str())
                    .unwrap_or_default();
                let server_collected = server_record
                    .get("collected")
                    .and_then(|value| value.as_bool())
                    .unwrap_or(false);
                let local_collected = pending
                    .iter()
                    .any(|record| record.sync_uuid == sync_uuid && record.collected);

                if server_collected && local_collected && !sync_uuid.is_empty() {
                    save_server_records(&conn, &[server_record.clone()])?;
                    conn.execute(
                        r#"
                        UPDATE records
                        SET sync_status = 'synced',
                            last_error = '',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE sync_uuid = ?1
                        "#,
                        params![sync_uuid],
                    )
                    .map_err(|error| error.to_string())?;
                    synced_count += 1;
                    already_collected_count += 1;
                    conflicts_count = conflicts_count.saturating_sub(1);
                }
            }
        }
        errors_count = response
            .get("errors")
            .and_then(|value| value.as_array())
            .map(|items| items.len())
            .unwrap_or(0);
    }

    let mut synced_assemblies = 0;
    let assembly_url = format!(
        "{}/mobile/assembly/",
        settings.server_url.trim_end_matches('/')
    );
    for assembly in pending_assembly_rows {
        let response: serde_json::Value = ureq::post(&assembly_url)
            .set("Authorization", &format!("Bearer {token}"))
            .send_json(json!({
                "sync_uuid": assembly.sync_uuid,
                "date": assembly.entry_date,
                "collector_name": assembly.collector_name,
                "amount": assembly.amount,
                "assembly_count": assembly.assembly_count,
            }))
            .map_err(|error| error.to_string())?
            .into_json()
            .map_err(|error| error.to_string())?;
        let server_id = response.get("id").and_then(|value| value.as_i64());
        conn.execute(
            r#"
            UPDATE assemblies
            SET server_id = ?1,
                sync_status = 'synced',
                last_error = '',
                updated_at = CURRENT_TIMESTAMP
            WHERE local_id = ?2
            "#,
            params![server_id, assembly.local_id],
        )
        .map_err(|error| error.to_string())?;
        synced_assemblies += 1;
    }

    // --- Push pending advances ---
    let mut synced_advances = 0;
    if !pending_advance_rows.is_empty() {
        let advances_url = format!(
            "{}/mobile/advances/",
            settings.server_url.trim_end_matches('/')
        );
        let payload_advances: Vec<_> = pending_advance_rows
            .iter()
            .map(|adv| {
                json!({
                    "sync_uuid": adv.sync_uuid,
                    "employee_name": adv.employee_name,
                    "amount": adv.amount,
                    "date": adv.advance_date,
                })
            })
            .collect();
        let response: Result<serde_json::Value, String> = ureq::post(&advances_url)
            .set("Authorization", &format!("Bearer {token}"))
            .send_json(json!({ "advances": payload_advances }))
            .map_err(|e| e.to_string())
            .and_then(|r| r.into_json().map_err(|e| e.to_string()));

        match response {
            Ok(resp) => {
                let saved_arr = resp
                    .get("saved")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                for item in saved_arr {
                    let sync_uuid = item
                        .get("sync_uuid")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default();
                    let server_id = item.get("id").and_then(|v| v.as_i64());
                    if !sync_uuid.is_empty() {
                        let _ = conn.execute(
                            r#"
                            UPDATE employee_advances
                            SET server_id = ?1,
                                sync_status = 'synced',
                                last_error = ''
                            WHERE sync_uuid = ?2
                            "#,
                            params![server_id, sync_uuid],
                        );
                        synced_advances += 1;
                    }
                }
                let err_arr = resp
                    .get("errors")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                for err in err_arr {
                    let idx = err.get("index").and_then(|v| v.as_i64()).unwrap_or(-1);
                    let err_msg = err
                        .get("error")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown");
                    if idx >= 0 {
                        if let Some(adv) = pending_advance_rows.get(idx as usize) {
                            let _ = conn.execute(
                                "UPDATE employee_advances SET sync_status = 'error', last_error = ?1 WHERE sync_uuid = ?2",
                                params![err_msg, adv.sync_uuid],
                            );
                            errors_count += 1;
                        }
                    }
                }
            }
            Err(e) => {
                // Network/server error: mark all as error but don't fail entire sync.
                for adv in &pending_advance_rows {
                    let _ = conn.execute(
                        "UPDATE employee_advances SET sync_status = 'error', last_error = ?1 WHERE sync_uuid = ?2",
                        params![e, adv.sync_uuid],
                    );
                }
                errors_count += pending_advance_rows.len();
            }
        }
    }

    // --- Push pending assembly orders ---
    let mut synced_orders = 0;
    if !pending_order_rows.is_empty() {
        let orders_url = format!(
            "{}/mobile/assembly/orders/",
            settings.server_url.trim_end_matches('/')
        );

        // Split into creates (no server_id) and status updates (have server_id).
        let creates: Vec<&PendingOrder> = pending_order_rows
            .iter()
            .filter(|o| o.server_id.is_none())
            .collect();
        let updates: Vec<&PendingOrder> = pending_order_rows
            .iter()
            .filter(|o| o.server_id.is_some())
            .collect();

        // POST: bulk-create new orders.
        if !creates.is_empty() {
            let payload: Vec<_> = creates
                .iter()
                .map(|o| {
                    json!({
                        "sync_uuid": o.sync_uuid,
                        "name": o.name,
                        "is_urgent": o.is_urgent,
                    })
                })
                .collect();
            let response: Result<serde_json::Value, String> = ureq::post(&orders_url)
                .set("Authorization", &format!("Bearer {token}"))
                .send_json(json!({ "orders": payload }))
                .map_err(|e| e.to_string())
                .and_then(|r| r.into_json().map_err(|e| e.to_string()));
            match response {
                Ok(resp) => {
                    let saved_arr = resp.get("saved").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                    for item in saved_arr {
                        let su = item.get("sync_uuid").and_then(|v| v.as_str()).unwrap_or("");
                        let sid = item.get("id").and_then(|v| v.as_i64());
                        if !su.is_empty() {
                            let _ = conn.execute(
                                "UPDATE assembly_orders SET server_id = ?1, sync_status = 'synced', last_error = '' WHERE sync_uuid = ?2",
                                params![sid, su],
                            );
                            synced_orders += 1;
                        }
                    }
                    let err_arr = resp.get("errors").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                    for err in err_arr {
                        let idx = err.get("index").and_then(|v| v.as_i64()).unwrap_or(-1);
                        let msg = err.get("error").and_then(|v| v.as_str()).unwrap_or("unknown");
                        if idx >= 0 {
                            if let Some(o) = creates.get(idx as usize) {
                                let _ = conn.execute(
                                    "UPDATE assembly_orders SET sync_status = 'error', last_error = ?1 WHERE sync_uuid = ?2",
                                    params![msg, o.sync_uuid],
                                );
                                errors_count += 1;
                            }
                        }
                    }
                }
                Err(e) => {
                    for o in &creates {
                        let _ = conn.execute(
                            "UPDATE assembly_orders SET sync_status = 'error', last_error = ?1 WHERE sync_uuid = ?2",
                            params![e, o.sync_uuid],
                        );
                    }
                    errors_count += creates.len();
                }
            }
        }

        // PATCH: send status updates one by one.
        for order in &updates {
            // Map local state -> server action.
            // status == 'in_progress' means desktop just advanced from 'assembly' -> 'in_progress'.
            // status == 'done' means advance from 'in_progress' -> 'done'.
            // status == 'out_of_stock' means explicit out_of_stock action.
            let action = if order.status == "out_of_stock" {
                "out_of_stock"
            } else {
                "advance"
            };
            let payload = json!({
                "sync_uuid": order.sync_uuid,
                "action": action,
                "collector_name": order.assigned_collector_name,
            });
            let resp = ureq::request("PATCH", &orders_url)
                .set("Authorization", &format!("Bearer {token}"))
                .send_json(payload);
            match resp {
                Ok(_) => {
                    let _ = conn.execute(
                        "UPDATE assembly_orders SET sync_status = 'synced', last_error = '' WHERE sync_uuid = ?1",
                        params![order.sync_uuid],
                    );
                    synced_orders += 1;
                }
                Err(ureq::Error::Status(404, _)) => {
                    // Order already gone on server — treat as synced to avoid retry loop.
                    let _ = conn.execute(
                        "UPDATE assembly_orders SET sync_status = 'synced', last_error = '' WHERE sync_uuid = ?1",
                        params![order.sync_uuid],
                    );
                }
                Err(e) => {
                    let _ = conn.execute(
                        "UPDATE assembly_orders SET sync_status = 'error', last_error = ?1 WHERE sync_uuid = ?2",
                        params![e.to_string(), order.sync_uuid],
                    );
                    errors_count += 1;
                }
            }
        }
    }

    if conflicts_count > 0 || errors_count > 0 {
        return Ok(format!(
            "Синхронизировано записей: {synced_count}, сборок: {synced_assemblies}, авансов: {synced_advances}, заказов: {synced_orders}. Конфликты: {conflicts_count}. Ошибки: {errors_count}."
        ));
    }

    if already_collected_count > 0 {
        return Ok(format!(
            "Эту технику уже отметили как забранную на сайте. Данные обновлены. Синхронизировано записей: {synced_count}, сборок: {synced_assemblies}, авансов: {synced_advances}, заказов: {synced_orders}."
        ));
    }

    Ok(format!(
        "Синхронизировано записей: {synced_count}, сборок: {synced_assemblies}, авансов: {synced_advances}, заказов: {synced_orders}."
    ))
}

#[tauri::command]
fn api_request(
    server_url: String,
    token: String,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    if token.trim().is_empty() {
        return Err("Ошибка авторизации: войдите в аккаунт и дождитесь синхронизации.".to_string());
    }
    let base = normalize_server_url(&server_url);
    let path_clean = path.trim_start_matches('/');
    let url = format!("{base}/{path_clean}");
    let auth = format!("Bearer {token}");

    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(8))
        .timeout_read(Duration::from_secs(20))
        .build();

    let request_result = match method.to_uppercase().as_str() {
        "GET" => agent.get(&url).set("Authorization", &auth).call(),
        "POST" => {
            let b = body.unwrap_or(json!({}));
            agent.post(&url).set("Authorization", &auth).send_json(b)
        }
        "PATCH" => {
            let b = body.unwrap_or(json!({}));
            agent.patch(&url).set("Authorization", &auth).send_json(b)
        }
        "DELETE" => agent.delete(&url).set("Authorization", &auth).call(),
        m => return Err(format!("Неподдерживаемый метод: {m}")),
    };

    let response = match request_result {
        Ok(response) => response,
        Err(ureq::Error::Status(code, response)) => {
            return Err(api_error_message(code, response));
        }
        Err(error) => return Err(error.to_string()),
    };

    if response.status() == 204 {
        return Ok(json!({"ok": true}));
    }

    response.into_json().map_err(|e| e.to_string())
}

// ── Touch ID / Keychain ───────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod biometric {
    use security_framework::passwords::{delete_generic_password, get_generic_password, set_generic_password};

    const SERVICE: &str = "velo95moto-desktop";
    const ACCOUNT: &str = "default";

    extern "C" {
        fn velo_check_biometric_available() -> i32;
        fn velo_authenticate_biometric(reason: *const std::ffi::c_char) -> i32;
    }

    pub fn check_available() -> bool {
        unsafe { velo_check_biometric_available() != 0 }
    }

    pub fn authenticate(reason: &str) -> bool {
        let c_reason = std::ffi::CString::new(reason).unwrap_or_default();
        unsafe { velo_authenticate_biometric(c_reason.as_ptr()) != 0 }
    }

    pub fn save_password(password: &str) -> Result<(), String> {
        set_generic_password(SERVICE, ACCOUNT, password.as_bytes()).map_err(|e| e.to_string())
    }

    pub fn load_password() -> Result<String, String> {
        let bytes = get_generic_password(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
        String::from_utf8(bytes).map_err(|e| e.to_string())
    }

    pub fn delete_password() -> Result<(), String> {
        match delete_generic_password(SERVICE, ACCOUNT) {
            Ok(()) => Ok(()),
            Err(e) if e.code() == -25300 => Ok(()), // errSecItemNotFound — already deleted
            Err(e) => Err(e.to_string()),
        }
    }
}

#[tauri::command]
fn check_biometric_available() -> bool {
    #[cfg(target_os = "macos")]
    { biometric::check_available() }
    #[cfg(not(target_os = "macos"))]
    { false }
}

#[tauri::command]
fn save_credentials_to_keychain(password: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { biometric::save_password(&password) }
    #[cfg(not(target_os = "macos"))]
    { Err("Touch ID не поддерживается на этой платформе.".to_string()) }
}

#[tauri::command]
fn authenticate_and_get_password(reason: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        if !biometric::authenticate(&reason) {
            return Err("Биометрическая аутентификация не прошла.".to_string());
        }
        biometric::load_password()
    }
    #[cfg(not(target_os = "macos"))]
    { Err("Touch ID не поддерживается на этой платформе.".to_string()) }
}

#[tauri::command]
fn delete_credentials_from_keychain() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { biometric::delete_password() }
    #[cfg(not(target_os = "macos"))]
    { Ok(()) }
}

// ─────────────────────────────────────────────────────────────────────────────

fn api_error_message(status: u16, response: ureq::Response) -> String {
    let text = response.into_string().unwrap_or_default();
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
        if let Some(message) = value.get("error").and_then(|item| item.as_str()) {
            return message.to_string();
        }
        if let Some(message) = value.get("detail").and_then(|item| item.as_str()) {
            return message.to_string();
        }
        if let Some(errors) = value.get("errors") {
            return errors.to_string();
        }
    }
    if text.trim().is_empty() {
        format!("Ошибка сайта: status code {status}")
    } else {
        text
    }
}

#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(serde_json::json!({
            "available": true,
            "version": update.version,
            "notes": update.body.unwrap_or_default(),
        })),
        Ok(None) => Ok(serde_json::json!({ "available": false })),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn apply_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            init_database,
            login_and_bootstrap,
            health_check,
            save_record,
            list_records,
            mark_record_collected,
            update_record,
            notify_record_client,
            verify_operator_password,
            create_employee,
            save_assembly,
            list_assemblies,
            delete_assembly_entry,
            clear_today_assemblies,
            save_employee_advance,
            list_employee_advances,
            delete_employee_advance,
            create_assembly_orders,
            list_assembly_orders,
            update_assembly_order_status,
            pull_records,
            pull_all_today,
            pull_assemblies,
            pull_assembly_orders,
            pull_advances,
            sync_records,
            api_request,
            get_sync_info,
            reset_sync,
            check_biometric_available,
            save_credentials_to_keychain,
            authenticate_and_get_password,
            delete_credentials_from_keychain,
            check_for_update,
            apply_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
