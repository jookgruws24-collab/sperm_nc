export function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

export function formatDate(value) {
  if (!value) return "";
  const text = String(value);
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (isoMatch) return `${isoMatch[1]} ${isoMatch[2]}`;

  const usMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
  if (usMatch) return `${usMatch[3]}-${usMatch[1]}-${usMatch[2]} ${usMatch[4]}`;

  return text;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
