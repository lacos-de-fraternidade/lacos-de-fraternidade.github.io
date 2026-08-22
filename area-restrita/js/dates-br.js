import { padDay, parseIsoDate } from "./datas.js";

export function isoToBr(value) {
  const parsed = parseIsoDate(value);
  if (!parsed) return "";
  return `${padDay(parsed.day)}/${padDay(parsed.month)}/${parsed.year}`;
}

export function isValidCalendarDate(day, month, year) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function maskBrDate(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function todayIso(from = new Date()) {
  return `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
}

export function isFutureIsoDate(iso, from = new Date()) {
  return Boolean(iso) && iso > todayIso(from);
}

export function parseFlexibleBrDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return { empty: true };
  const full = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (full) {
    const day = Number(full[1]);
    const month = Number(full[2]);
    const year = Number(full[3]);
    if (!isValidCalendarDate(day, month, year)) return { invalid: true };
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, month, year, iso };
  }
  const short = /^(\d{1,2})\/(\d{1,2})$/.exec(raw);
  if (short) {
    const day = Number(short[1]);
    const month = Number(short[2]);
    if (month < 1 || month > 12 || !isValidCalendarDate(day, month, 2024)) return { invalid: true };
    return { day, month, year: null, iso: null };
  }
  return { invalid: true };
}

export function formatBirthInput(day, month, year) {
  if (!day || !month) return "";
  const base = `${padDay(day)}/${padDay(month)}`;
  return year ? `${base}/${year}` : base;
}

export function brToIso(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = parseFlexibleBrDate(raw);
  if (parsed.empty) return "";
  if (parsed.invalid || !parsed.iso) return null;
  return parsed.iso;
}

export function bindBrDateInput(input) {
  if (!input) return;
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("placeholder", "dd/mm/aaaa");
  input.setAttribute("autocomplete", "off");
  if (input.type === "date") input.type = "text";
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.value)) input.value = isoToBr(input.value);
  input.addEventListener("input", () => {
    input.value = maskBrDate(input.value);
  });
  input.addEventListener("blur", () => {
    const parsed = parseFlexibleBrDate(input.value);
    if (parsed.iso) input.value = isoToBr(parsed.iso);
    else if (parsed.day && parsed.month) input.value = formatBirthInput(parsed.day, parsed.month, parsed.year);
  });
}

export function bindBrDatePicker(input) {
  if (!input || input.closest(".br-datepicker")) {
    bindBrDateInput(input);
    return;
  }
  bindBrDateInput(input);
  const wrap = document.createElement("div");
  wrap.className = "br-datepicker";
  input.parentNode?.insertBefore(wrap, input);
  wrap.append(input);
  const native = document.createElement("input");
  native.type = "date";
  native.className = "br-datepicker__native";
  native.tabIndex = -1;
  native.setAttribute("aria-hidden", "true");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "br-datepicker__trigger";
  button.setAttribute("aria-label", "Abrir calendário");
  button.textContent = "📅";
  wrap.append(native, button);
  native.addEventListener("change", () => {
    if (!native.value) return;
    input.value = isoToBr(native.value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  button.addEventListener("click", () => {
    const iso = brToIso(input.value);
    if (iso) native.value = iso;
    if (typeof native.showPicker === "function") native.showPicker();
    else native.focus();
  });
}

export function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDateTimeBr(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return isoToBr(value) || "";
  return `${isoToBr(localIsoDate(date))} · ${formatTime(date)}`;
}

export function splitDateTime(value) {
  if (!value) return { date: "", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  return { date: isoToBr(localIsoDate(date)), time: formatTime(date) };
}

function localIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function readIsoDate(input) {
  const iso = brToIso(input?.value);
  return iso === "" ? "" : iso;
}

export function joinDateTime(dateValue, timeValue) {
  const iso = brToIso(dateValue);
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  const [hour, minute] = String(timeValue || "00:00").split(":").map(Number);
  const local = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
  return Number.isNaN(local.getTime()) ? "" : local.toISOString();
}

export function bindBrTimeInput(input) {
  if (!input) return;
  input.setAttribute("placeholder", "hh:mm");
  input.setAttribute("inputmode", "numeric");
  input.addEventListener("blur", () => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(input.value || "").trim());
    if (!match) return;
    const hour = Math.min(23, Number(match[1]));
    const minute = Math.min(59, Number(match[2]));
    input.value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  });
}
