use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

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
    entry_date: String,
    collector_name: String,
    amount: i64,
    assembly_count: i64,
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|error| error.to_string())?;
    Ok(app_dir.join("velo95moto-offline.db"))
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
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_error TEXT NOT NULL DEFAULT ''
        );
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
                   notification_count, notification_tooltip, total_amount
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
    let management_10 = record.services / 20;
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
                record.total_amount,
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
                record.total_amount,
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
    let conn = open_database(&app)?;
    conn.execute(
        r#"
        INSERT INTO assemblies (
            sync_uuid, sync_status, entry_date, collector_name, amount, assembly_count
        ) VALUES (?1, 'pending', ?2, ?3, ?4, ?5)
        "#,
        params![
            assembly.sync_uuid,
            assembly.entry_date,
            assembly.collector_name,
            assembly.amount,
            assembly.assembly_count,
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(conn.last_insert_rowid())
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

fn fetch_token(settings: &SyncSettings) -> Result<String, String> {
    let url = format!(
        "{}/mobile/auth/token/",
        settings.server_url.trim_end_matches('/')
    );
    let response_result = ureq::post(&url).send_json(json!({
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
            SELECT local_id, entry_date, collector_name, amount, assembly_count
            FROM assemblies
            WHERE sync_status IN ('pending', 'error')
            ORDER BY local_id
            "#,
        )
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PendingAssembly {
                local_id: row.get(0)?,
                entry_date: row.get(1)?,
                collector_name: row.get(2)?,
                amount: row.get(3)?,
                assembly_count: row.get(4)?,
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

        conn.execute(
            r#"
            INSERT INTO records (
                server_id, sync_uuid, base_sync_version, sync_status, record_date, title,
                client_name, phone, master, parts, services, comments, free_repair,
                master_only, total_amount, mast_50_5, management_10, collected,
                collected_date, client_notified, notification_count, notification_tooltip, updated_at
            ) VALUES (?1, ?2, ?3, 'synced', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, CURRENT_TIMESTAMP)
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
            ],
        )
        .map_err(|error| error.to_string())?;
        saved_count += 1;
    }
    Ok(saved_count)
}

#[tauri::command]
fn pull_records(app: tauri::AppHandle, settings: SyncSettings) -> Result<String, String> {
    let conn = open_database(&app)?;
    let token = fetch_token(&settings)?;
    let url = format!(
        "{}/mobile/sync/records/",
        settings.server_url.trim_end_matches('/')
    );
    let response: serde_json::Value = ureq::get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .call()
        .map_err(|error| error.to_string())?
        .into_json()
        .map_err(|error| error.to_string())?;
    let records = response
        .get("records")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let saved_count = save_server_records(&conn, &records)?;
    Ok(format!("Получено записей с сайта: {saved_count}."))
}

#[tauri::command]
fn sync_records(app: tauri::AppHandle, settings: SyncSettings) -> Result<String, String> {
    let conn = open_database(&app)?;
    let pending = pending_records(&conn)?;
    let pending_assembly_rows = pending_assemblies(&conn)?;
    if pending.is_empty() && pending_assembly_rows.is_empty() {
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

    if conflicts_count > 0 || errors_count > 0 {
        return Ok(format!(
            "Синхронизировано записей: {synced_count}, сборок: {synced_assemblies}. Конфликты: {conflicts_count}. Ошибки: {errors_count}."
        ));
    }

    if already_collected_count > 0 {
        return Ok(format!(
            "Эту технику уже отметили как забранную на сайте. Данные обновлены. Синхронизировано записей: {synced_count}, сборок: {synced_assemblies}."
        ));
    }

    Ok(format!(
        "Синхронизировано записей: {synced_count}, сборок: {synced_assemblies}."
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
    let base = server_url.trim_end_matches('/');
    let path_clean = path.trim_start_matches('/');
    let url = format!("{base}/{path_clean}");
    let auth = format!("Bearer {token}");

    let request_result = match method.to_uppercase().as_str() {
        "GET" => ureq::get(&url).set("Authorization", &auth).call(),
        "POST" => {
            let b = body.unwrap_or(json!({}));
            ureq::post(&url).set("Authorization", &auth).send_json(b)
        }
        "PATCH" => {
            let b = body.unwrap_or(json!({}));
            ureq::patch(&url).set("Authorization", &auth).send_json(b)
        }
        "DELETE" => ureq::delete(&url).set("Authorization", &auth).call(),
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            init_database,
            login_and_bootstrap,
            save_record,
            list_records,
            mark_record_collected,
            update_record,
            notify_record_client,
            verify_operator_password,
            create_employee,
            save_assembly,
            list_assemblies,
            pull_records,
            sync_records,
            api_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
