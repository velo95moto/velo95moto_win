export function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `7${digits}` : "";
}

export function buildWhatsAppWebUrl(phone, message) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) return "";
  return `https://api.whatsapp.com/send/?phone=${normalizedPhone}&text=${encodeURIComponent(String(message || ""))}`;
}

export function buildWhatsAppDesktopUrl(phone, message) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) return "";
  return `whatsapp://send?phone=${normalizedPhone}&text=${encodeURIComponent(String(message || ""))}`;
}

export function shouldDisableClientContact(record) {
  return Boolean(record?.collected) || !normalizeWhatsAppPhone(record?.phone);
}
