import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import firebaseConfig from './firebase-config.js';
import {
  bookingWindowDays,
  escapeHtml,
  formatDate,
  getConsultationSlotsForDate,
  getEligibleBookingDates,
  normalizeStatus,
  parseDateKey
} from './booking-utils.js';

const bookingNotificationEndpoint = 'https://formspree.io/f/mreoknyz';

const consultationForm = document.getElementById('consultationBookingForm');
const consultationDate = document.getElementById('consultationDate');
const consultationTime = document.getElementById('consultationTime');
const consultationType = document.getElementById('consultationType');
const consultationSubmitBtn = document.getElementById('consultationSubmitBtn');
const consultationSelectionMeta = document.getElementById('consultationSelectionMeta');
const consultationMessage = document.getElementById('consultationMessage');
const consultationMessageText = document.getElementById('consultationMessageText');

let db;
let bookingBlocks = [];
let renderedConsultationSlots = [];
let selectedConsultationBlockId = '';

function hasRealFirebaseConfig(config) {
  return Boolean(
    config &&
    config.apiKey &&
    config.projectId &&
    !config.apiKey.startsWith('YOUR_') &&
    !config.projectId.startsWith('YOUR_')
  );
}

function setConsultationMessage(message, tone = 'info') {
  if (!consultationMessage || !consultationMessageText) return;

  const toneClassMap = {
    info: 'portal-alert-info',
    success: 'portal-alert-success',
    warning: 'portal-alert-warning'
  };

  consultationMessage.hidden = false;
  consultationMessage.classList.remove('portal-alert-info', 'portal-alert-success', 'portal-alert-warning');
  consultationMessage.classList.add(toneClassMap[tone] || toneClassMap.info);
  consultationMessageText.textContent = message;
}

function clearConsultationMessage() {
  if (!consultationMessage || !consultationMessageText) return;
  consultationMessage.hidden = true;
  consultationMessage.classList.remove('portal-alert-info', 'portal-alert-success', 'portal-alert-warning');
  consultationMessageText.textContent = '';
}

function setConsultationDisabled(disabled) {
  if (!consultationForm) return;
  consultationForm.querySelectorAll('input, textarea, select, button').forEach((field) => {
    field.disabled = disabled;
  });
}

function getBlockedBlockIds() {
  return new Set(
    bookingBlocks
      .filter((block) => normalizeStatus(block.status) === 'booked')
      .map((block) => block.blockId || block.id)
  );
}

function updateConsultationSelectionMeta() {
  if (!consultationSelectionMeta || !consultationSubmitBtn) return;

  const slot = renderedConsultationSlots.find((item) => item.blockId === selectedConsultationBlockId);
  if (!slot) {
    consultationSelectionMeta.textContent = 'Choose a date and time to reserve your consultation.';
    consultationSubmitBtn.disabled = true;
    return;
  }

  consultationSelectionMeta.textContent = `${consultationType?.value || 'Phone Call'} on ${slot.dayLabel} at ${slot.timeLabel}`;
  consultationSubmitBtn.disabled = false;
}

function renderConsultationDateOptions() {
  if (!consultationDate) return;

  const eligibleDates = getEligibleBookingDates(bookingWindowDays);
  const currentValue = consultationDate.value;

  if (!eligibleDates.length) {
    consultationDate.innerHTML = '<option value="">No consultation dates available</option>';
    consultationDate.disabled = true;
    renderedConsultationSlots = [];
    selectedConsultationBlockId = '';
    if (consultationTime) {
      consultationTime.innerHTML = '<option value="">No consultation times available</option>';
      consultationTime.disabled = true;
    }
    updateConsultationSelectionMeta();
    return;
  }

  consultationDate.disabled = false;
  consultationDate.innerHTML = eligibleDates
    .map((date) => {
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return `<option value="${value}">${escapeHtml(
        new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        }).format(date)
      )}</option>`;
    })
    .join('');

  consultationDate.value = eligibleDates.some((date) => {
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return value === currentValue;
  })
    ? currentValue
    : `${eligibleDates[0].getFullYear()}-${String(eligibleDates[0].getMonth() + 1).padStart(2, '0')}-${String(
        eligibleDates[0].getDate()
      ).padStart(2, '0')}`;

  renderConsultationSlots();
}

function renderConsultationSlots() {
  if (!consultationDate || !consultationTime) return;

  const selectedDate = parseDateKey(consultationDate.value);
  if (!selectedDate) {
    renderedConsultationSlots = [];
    selectedConsultationBlockId = '';
    consultationTime.innerHTML = '<option value="">Choose a date first</option>';
    consultationTime.disabled = true;
    updateConsultationSelectionMeta();
    return;
  }

  const blockedBlockIds = getBlockedBlockIds();
  const now = Date.now();

  renderedConsultationSlots = getConsultationSlotsForDate(selectedDate).filter((slot) => slot.startAt.getTime() > now);

  if (!renderedConsultationSlots.some((slot) => slot.blockId === selectedConsultationBlockId)) {
    selectedConsultationBlockId = '';
  }

  if (!renderedConsultationSlots.length) {
    consultationTime.innerHTML = '<option value="">No future consultation times remain</option>';
    consultationTime.disabled = true;
    updateConsultationSelectionMeta();
    return;
  }

  consultationTime.disabled = false;
  consultationTime.innerHTML = [
    '<option value="">Choose a time</option>',
    ...renderedConsultationSlots.map((slot) => {
      const isBlocked = blockedBlockIds.has(slot.blockId);
      const isSelected = selectedConsultationBlockId === slot.blockId;
      return `<option value="${slot.blockId}" ${isBlocked ? 'disabled' : ''} ${isSelected ? 'selected' : ''}>${escapeHtml(
        `${slot.timeLabel}${isBlocked ? ' - Unavailable' : ''}`
      )}</option>`;
    })
  ].join('');

  updateConsultationSelectionMeta();
}

async function loadBookingBlocks() {
  const snapshot = await getDocs(collection(db, 'bookingBlocks'));
  bookingBlocks = snapshot.docs.map((blockDoc) => ({
    id: blockDoc.id,
    ...blockDoc.data()
  }));
}

async function sendConsultationNotification(payload) {
  const message = [
    'A new consultation was booked from the homepage.',
    '',
    `Name: ${payload.name}`,
    `Company: ${payload.companyName || 'Not provided'}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phoneNumber || 'Not provided'}`,
    `Consultation Type: ${payload.meetingType}`,
    `Date: ${payload.dayLabel || formatDate(payload.startAt)}`,
    `Time: ${payload.timeLabel}`,
    `Booking ID: ${payload.bookingId}`,
    `Notes: ${payload.notes || 'None'}`
  ].join('\n');

  const notificationData = new FormData();
  notificationData.append('_subject', `New consultation booking: ${payload.name}`);
  notificationData.append('source', 'Homepage Consultation Booking');
  notificationData.append('name', payload.name);
  notificationData.append('email', payload.email);
  notificationData.append('phone', payload.phoneNumber || 'Not provided');
  notificationData.append('company', payload.companyName || 'Not provided');
  notificationData.append('meetingType', payload.meetingType);
  notificationData.append('appointmentDate', payload.dayLabel || formatDate(payload.startAt));
  notificationData.append('appointmentTime', payload.timeLabel);
  notificationData.append('appointmentId', payload.bookingId);
  notificationData.append('message', message);

  const response = await fetch(bookingNotificationEndpoint, {
    method: 'POST',
    body: notificationData,
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Consultation notification failed with status ${response.status}.`);
  }
}

async function handleConsultationSubmit(event) {
  event.preventDefault();
  if (!db || !consultationForm) return;

  const slot = renderedConsultationSlots.find((item) => item.blockId === selectedConsultationBlockId);
  if (!slot) {
    setConsultationMessage('Choose an open consultation time before booking.', 'warning');
    return;
  }

  const blockedBlockIds = getBlockedBlockIds();
  if (blockedBlockIds.has(slot.blockId)) {
    setConsultationMessage('That consultation time is no longer available. Choose another open slot.', 'warning');
    await loadBookingBlocks();
    renderConsultationDateOptions();
    return;
  }

  const formData = new FormData(consultationForm);
  const name = String(formData.get('consultationName') || '').trim();
  const email = String(formData.get('consultationEmail') || '').trim();
  const phoneNumber = String(formData.get('consultationPhone') || '').trim();
  const companyName = String(formData.get('consultationCompany') || '').trim();
  const meetingType = String(formData.get('consultationType') || 'Phone Call').trim();
  const notes = String(formData.get('consultationNotes') || '').trim();
  const bookingId = `prospect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  setConsultationDisabled(true);
  clearConsultationMessage();

  try {
    await runTransaction(db, async (transaction) => {
      const blockRef = doc(db, 'bookingBlocks', slot.blockId);
      const blockSnapshot = await transaction.get(blockRef);

      if (blockSnapshot.exists()) {
        throw new Error('SLOT_TAKEN');
      }

      transaction.set(blockRef, {
        blockId: slot.blockId,
        bookingId,
        ownerKind: 'prospect',
        durationMinutes: 15,
        meetingType,
        dateKey: slot.dateKey,
        dayLabel: slot.dayLabel,
        startAt: slot.startAt,
        endAt: slot.endAt,
        status: 'booked',
        createdAt: serverTimestamp()
      });

      transaction.set(doc(db, 'publicBookings', bookingId), {
        bookingId,
        ownerKind: 'prospect',
        name,
        email,
        phoneNumber,
        companyName,
        meetingType,
        dateKey: slot.dateKey,
        dayLabel: slot.dayLabel,
        timeLabel: slot.timeLabel,
        blockId: slot.blockId,
        startAt: slot.startAt,
        endAt: slot.endAt,
        status: 'booked',
        notes,
        createdAt: serverTimestamp()
      });
    });

    try {
      await sendConsultationNotification({
        bookingId,
        name,
        email,
        phoneNumber,
        companyName,
        meetingType,
        dayLabel: slot.dayLabel,
        timeLabel: slot.timeLabel,
        startAt: slot.startAt,
        notes
      });
    } catch (notificationError) {
      console.error(notificationError);
    }

    consultationForm.reset();
    selectedConsultationBlockId = '';
    setConsultationMessage(`Consultation booked for ${slot.dayLabel} at ${slot.timeLabel}.`, 'success');
    await loadBookingBlocks();
    renderConsultationDateOptions();
  } catch (error) {
    console.error(error);
    if (error?.message === 'SLOT_TAKEN') {
      setConsultationMessage('That consultation slot was just booked. Choose another time.', 'warning');
      await loadBookingBlocks();
      renderConsultationDateOptions();
    } else {
      setConsultationMessage('We could not book the consultation right now. Please try again.', 'warning');
    }
  } finally {
    setConsultationDisabled(false);
    updateConsultationSelectionMeta();
  }
}

async function initializeConsultationBooking() {
  if (!consultationForm) return;

  if (!hasRealFirebaseConfig(firebaseConfig)) {
    consultationForm.setAttribute('hidden', '');
    setConsultationMessage('Firebase booking setup is still incomplete for consultations.', 'warning');
    return;
  }

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  consultationDate?.addEventListener('change', () => {
    clearConsultationMessage();
    selectedConsultationBlockId = '';
    renderConsultationSlots();
  });

  consultationType?.addEventListener('change', updateConsultationSelectionMeta);

  consultationTime?.addEventListener('change', () => {
    selectedConsultationBlockId = consultationTime.value || '';
    updateConsultationSelectionMeta();
  });

  consultationForm.addEventListener('submit', handleConsultationSubmit);

  await loadBookingBlocks();
  renderConsultationDateOptions();
}

initializeConsultationBooking().catch((error) => {
  console.error(error);
  setConsultationMessage('We could not load the consultation scheduler yet. Please refresh and try again.', 'warning');
});
