const SECRET_KEY_RE = /(password|pass|token|authorization|cookie|secret|csrf|access_token|refresh_token)/i;
const MAX_STRING_LENGTH = 2000;

export function redactSensitive(value, depth = 0) {
  if (depth > 6) return "[MaxDepth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactSensitive(item, depth + 1));

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = SECRET_KEY_RE.test(key) ? "[REDACTED]" : redactSensitive(item, depth + 1);
  }
  return result;
}

export function buildDesktopLogEvent({
  level = "INFO",
  action = "desktop_event",
  description = "",
  details = {},
  context = {},
  now = new Date(),
} = {}) {
  const normalizedLevel = String(level || "INFO").toUpperCase();
  return {
    timestamp: now.toISOString(),
    level: ["DEBUG", "INFO", "WARNING", "ERROR"].includes(normalizedLevel) ? normalizedLevel : "INFO",
    action: String(action || "desktop_event"),
    description: String(description || ""),
    username: context.username || "",
    display_name: context.displayName || "",
    roles: context.roles || {},
    view: context.view || "",
    online: Boolean(context.online),
    details: redactSensitive(details),
  };
}

export function createDesktopLogger({ invoke, getContext = () => ({}), consoleTarget = console } = {}) {
  async function write(level, action, description, details = {}) {
    const event = buildDesktopLogEvent({
      level,
      action,
      description,
      details,
      context: getContext(),
    });
    try {
      if (typeof invoke === "function") {
        await invoke("append_desktop_log", { event });
      }
    } catch (error) {
      consoleTarget?.warn?.("[desktop-log] write failed", error);
    }
    const method = event.level === "ERROR" ? "error" : event.level === "WARNING" ? "warn" : "info";
    consoleTarget?.[method]?.(`[desktop-log] ${event.action}: ${event.description}`, event.details);
    return event;
  }

  return {
    debug: (action, description, details) => write("DEBUG", action, description, details),
    info: (action, description, details) => write("INFO", action, description, details),
    warning: (action, description, details) => write("WARNING", action, description, details),
    error: (action, description, details) => write("ERROR", action, description, details),
  };
}
