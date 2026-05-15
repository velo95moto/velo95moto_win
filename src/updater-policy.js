export const UPDATE_MANIFEST_URL = "https://github.com/velo95moto/velo95moto_win/releases/latest/download/latest.json";
export const RELEASES_URL = "https://github.com/velo95moto/velo95moto_win/releases/latest";

export function updateCheckMessage(result = {}) {
  if (result.available) {
    return `Доступна новая версия программы v${result.version}.`;
  }
  if (result.current_version) {
    return `Установлена последняя версия v${result.current_version}.`;
  }
  return "Установлена последняя версия программы.";
}

export function updateErrorMessage(error) {
  const text = String(error || "").trim();
  if (!text) return "Не удалось проверить обновления.";
  const lower = text.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Не удалось проверить обновления: сервер обновлений отвечает слишком долго.";
  }
  if (lower.includes("valid release json") || lower.includes("release json")) {
    return "Не удалось проверить обновления: файл latest.json недоступен публично. Проверьте, что релиз или сервер обновлений открыт для программы.";
  }
  if (text.includes("404") || text.toLowerCase().includes("not found")) {
    return "Не удалось проверить обновления: манифест latest.json не найден в GitHub Releases.";
  }
  if (lower.includes("signature") || lower.includes("sign")) {
    return "Не удалось проверить обновления: ошибка подписи обновления.";
  }
  return `Не удалось проверить обновления: ${text}`;
}
