// Date/number formatting used across the app. Times are shown in Korea time (NFR-10).
const TIME_ZONE = "Asia/Seoul";

/** "Fri, Nov 21, 7:00 PM" */
export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "7:05 PM" (for chat messages) */
export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** True if the party starts within the next `hours` hours (for the "Starting soon" label, IR-12). */
export function startsSoon(iso: string, hours = 24) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < hours * 3600_000;
}

/** Value for <input type="datetime-local"> -> ISO string for the API. */
export function localInputToIso(value: string) {
  return value ? new Date(value).toISOString() : "";
}

export function formatKrw(amount: number) {
  return `${amount.toLocaleString("ko-KR")} KRW`;
}
