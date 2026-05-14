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
  if (text.includes("404") || text.toLowerCase().includes("not found")) {
    return "Не удалось проверить обновления: манифест latest.json не найден в GitHub Releases.";
  }
  if (text.toLowerCase().includes("signature") || text.toLowerCase().includes("sign")) {
    return "Не удалось проверить обновления: ошибка подписи обновления.";
  }
  return `Не удалось проверить обновления: ${text}`;
}
