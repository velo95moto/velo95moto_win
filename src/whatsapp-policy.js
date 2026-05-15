export function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `7${digits}` : "";
}

export function shouldDisableClientContact(record) {
  return Boolean(record?.collected) || !normalizeWhatsAppPhone(record?.phone);
}
