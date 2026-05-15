export const bookingWindowDays = 30;

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function toDateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return null;
}

export function formatDate(value) {
  const date = toDateValue(value);
  if (!date) return 'Not set';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

export function formatDateTime(value) {
  const date = toDateValue(value);
  if (!date) return 'Not set';

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export function formatTimeLabel(value) {
  const date = toDateValue(value);
  if (!date) return 'Not set';

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatDayLabel(date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function getBookingHours(dayIndex) {
  if (dayIndex >= 1 && dayIndex <= 5) return [12, 13, 14, 15, 16, 17];
  if (dayIndex === 6) return [15, 16, 17];
  return [];
}

export function buildBlockId(date) {
  return `${formatDateKey(date)}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
}

export function createQuarterHourSlot(date, hour, minute) {
  const startAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
  const endAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute + 15, 0, 0);

  return {
    blockId: buildBlockId(startAt),
    dateKey: formatDateKey(date),
    dayLabel: formatDayLabel(startAt),
    startAt,
    endAt,
    timeLabel: `${formatTimeLabel(startAt)} - ${formatTimeLabel(endAt)}`
  };
}

export function createClientMeetingSlot(date, hour) {
  const quarterSlots = [0, 15, 30, 45].map((minute) => createQuarterHourSlot(date, hour, minute));
  const firstSlot = quarterSlots[0];
  const lastSlot = quarterSlots[quarterSlots.length - 1];

  return {
    slotId: `${formatDateKey(date)}-${String(hour).padStart(2, '0')}00`,
    dateKey: formatDateKey(date),
    dayLabel: firstSlot.dayLabel,
    startAt: firstSlot.startAt,
    endAt: lastSlot.endAt,
    timeLabel: `${formatTimeLabel(firstSlot.startAt)} - ${formatTimeLabel(lastSlot.endAt)}`,
    blockIds: quarterSlots.map((slot) => slot.blockId),
    blocks: quarterSlots
  };
}

export function getEligibleBookingDates(daysAhead = bookingWindowDays) {
  const dates = [];
  const today = new Date();

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    if (!getBookingHours(candidate.getDay()).length) continue;
    dates.push(candidate);
  }

  return dates;
}

export function getConsultationSlotsForDate(date) {
  return getBookingHours(date.getDay()).flatMap((hour) => [0, 15, 30, 45].map((minute) => createQuarterHourSlot(date, hour, minute)));
}

export function getClientMeetingSlotsForDate(date) {
  return getBookingHours(date.getDay()).map((hour) => createClientMeetingSlot(date, hour));
}

export function normalizeStatus(status) {
  return String(status || 'open').trim().toLowerCase();
}

export function statusClassName(status) {
  const normalized = normalizeStatus(status);

  if (normalized === 'paid') return 'is-paid';
  if (normalized === 'overdue') return 'is-overdue';
  if (normalized === 'draft') return 'is-draft';
  if (normalized === 'booked') return 'is-booked';
  if (normalized === 'cancelled') return 'is-cancelled';
  return 'is-open';
}
