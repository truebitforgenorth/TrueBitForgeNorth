import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import firebaseConfig from './firebase-config.js';
import {
  bookingWindowDays,
  escapeHtml,
  formatDate,
  formatDateTime,
  formatTimeLabel,
  getClientMeetingSlotsForDate,
  getEligibleBookingDates,
  normalizeStatus,
  statusClassName,
  toDateValue,
  parseDateKey
} from './booking-utils.js';

const accountNotificationEndpoint = 'https://formspree.io/f/mreoknyz';
const bookingNotificationEndpoint = 'https://formspree.io/f/mreoknyz';

const portalShell = document.getElementById('portalShell');
const setupNotice = document.getElementById('setupNotice');
const authPanel = document.getElementById('authPanel');
const signedOutPanel = document.getElementById('signedOutPanel');
const portalDashboard = document.getElementById('portalDashboard');
const authOnlyElements = Array.from(document.querySelectorAll('[data-portal-auth-only]'));
const signedOutOnlyElements = Array.from(document.querySelectorAll('[data-portal-signed-out-only]'));
const authTabs = Array.from(document.querySelectorAll('[data-auth-tab]'));
const authForms = Array.from(document.querySelectorAll('[data-auth-form]'));
const authHeadline = document.getElementById('authHeadline');
const portalMessage = document.getElementById('portalMessage');
const portalMessageText = document.getElementById('portalMessageText');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const logoutBtn = document.getElementById('logoutBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const currentClientEmail = document.getElementById('currentClientEmail');
const currentClientName = document.getElementById('currentClientName');
const invoiceList = document.getElementById('invoiceList');
const invoiceCount = document.getElementById('invoiceCount');
const openInvoiceCount = document.getElementById('openInvoiceCount');
const outstandingBalance = document.getElementById('outstandingBalance');
const invoiceUpdatedAt = document.getElementById('invoiceUpdatedAt');
const bookingForm = document.getElementById('bookingForm');
const bookingDateSelect = document.getElementById('bookingDate');
const bookingTimeSelect = document.getElementById('bookingTime');
const bookingMeetingType = document.getElementById('bookingMeetingType');
const bookingPhoneNumber = document.getElementById('bookingPhoneNumber');
const bookingNotes = document.getElementById('bookingNotes');
const bookingList = document.getElementById('bookingList');
const bookingMessage = document.getElementById('bookingMessage');
const bookingMessageText = document.getElementById('bookingMessageText');
const bookingSubmitBtn = document.getElementById('bookingSubmitBtn');
const selectedBookingMeta = document.getElementById('selectedBookingMeta');

let auth;
let db;
let activeMode = 'login';
let currentUser = null;
let currentClientProfile = null;
let bookingBlocks = [];
let currentAppointments = [];
let renderedClientSlots = [];
let selectedClientSlotId = '';

function hasRealFirebaseConfig(config) {
  return Boolean(
    config &&
    config.apiKey &&
    config.projectId &&
    !config.apiKey.startsWith('YOUR_') &&
    !config.projectId.startsWith('YOUR_')
  );
}

function setPortalMessage(message, tone = 'info') {
  if (!portalMessage || !portalMessageText) return;

  const toneClassMap = {
    info: 'portal-alert-info',
    success: 'portal-alert-success',
    warning: 'portal-alert-warning'
  };

  portalMessage.hidden = false;
  portalMessage.classList.remove('portal-alert-info', 'portal-alert-success', 'portal-alert-warning');
  portalMessage.classList.add(toneClassMap[tone] || toneClassMap.info);
  portalMessageText.textContent = message;
}

function clearPortalMessage() {
  if (!portalMessage || !portalMessageText) return;
  portalMessage.hidden = true;
  portalMessage.classList.remove('portal-alert-info', 'portal-alert-success', 'portal-alert-warning');
  portalMessageText.textContent = '';
}

function authErrorMessage(error, fallback = 'Client portal access failed. Please try again.') {
  const code = error?.code || '';

  const messages = {
    'auth/invalid-credential': 'Login failed. Double-check the email and password for this client account.',
    'auth/user-not-found': 'Login failed. No client account was found for that email address.',
    'auth/wrong-password': 'Login failed. Double-check the password for this client account.',
    'auth/too-many-requests': 'Too many login attempts. Wait a few minutes, then try again or reset the password.',
    'auth/network-request-failed': 'Login could not reach Firebase. Check your connection and try again.',
    'auth/unauthorized-domain': 'This website domain is not authorized for Firebase login yet.',
    'auth/email-already-in-use': 'An account already exists for that email. Use login or reset the password.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Enter a valid email address.'
  };

  return messages[code] || fallback;
}

function setBookingMessage(message, tone = 'info') {
  if (!bookingMessage || !bookingMessageText) return;

  const toneClassMap = {
    info: 'portal-alert-info',
    success: 'portal-alert-success',
    warning: 'portal-alert-warning'
  };

  bookingMessage.hidden = false;
  bookingMessage.classList.remove('portal-alert-info', 'portal-alert-success', 'portal-alert-warning');
  bookingMessage.classList.add(toneClassMap[tone] || toneClassMap.info);
  bookingMessageText.textContent = message;
}

function clearBookingMessage() {
  if (!bookingMessage || !bookingMessageText) return;
  bookingMessage.hidden = true;
  bookingMessage.classList.remove('portal-alert-info', 'portal-alert-success', 'portal-alert-warning');
  bookingMessageText.textContent = '';
}

function setPortalActionState(state) {
  const showAuthOnly = state === 'signed-in';
  const showSignedOutOnly = state === 'signed-out';

  authOnlyElements.forEach((element) => {
    element.hidden = !showAuthOnly;
  });

  signedOutOnlyElements.forEach((element) => {
    element.hidden = !showSignedOutOnly;
  });
}

function setButtonsDisabled(form, disabled) {
  if (!form) return;
  form.querySelectorAll('button, select, textarea, input').forEach((field) => {
    if (field.id === 'bookingDate' || field.id === 'bookingMeetingType' || field.id === 'bookingNotes') {
      field.disabled = disabled;
    } else if (field.tagName === 'BUTTON' || form.contains(field)) {
      field.disabled = disabled;
    }
  });
}

function setAuthMode(mode) {
  activeMode = mode;

  authTabs.forEach((tab) => {
    const isActive = tab.dataset.authTab === mode;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  authForms.forEach((form) => {
    form.hidden = form.dataset.authForm !== mode;
  });

  if (authHeadline) {
    authHeadline.textContent =
      mode === 'signup'
        ? 'Create a client account'
        : 'Log in to your client portal';
  }

  clearPortalMessage();
}

function formatCurrency(value) {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function invoiceSortValue(invoice) {
  const candidate = invoice.issuedAt || invoice.dueDate || invoice.createdAt || null;
  const date = toDateValue(candidate);
  return date ? date.getTime() : 0;
}

function appointmentSortValue(appointment) {
  const candidate = appointment.startAt || appointment.createdAt || null;
  const date = toDateValue(candidate);
  return date ? date.getTime() : 0;
}

function renderEmptyInvoices() {
  if (!invoiceList) return;

  invoiceList.innerHTML = `
    <article class="invoice-card glass invoice-card-empty">
      <div>
        <div class="mini-label mb-2">No invoices yet</div>
        <h3 class="fw-bold h4 mb-3">Your portal is ready.</h3>
        <p class="mb-0 text-white-50">
          When a new invoice is posted to your account, it will appear here automatically after you log in.
        </p>
      </div>
    </article>
  `;
}

function renderInvoices(invoices) {
  if (!invoiceList) return;

  if (!invoices.length) {
    renderEmptyInvoices();
    return;
  }

  invoiceList.innerHTML = invoices
    .map((invoice) => {
      const title = escapeHtml(invoice.title || invoice.invoiceNumber || 'Invoice');
      const amount = formatCurrency(invoice.amount);
      const status = escapeHtml(invoice.status || 'Open');
      const notes = invoice.notes
        ? `<p class="invoice-notes mb-0">${escapeHtml(invoice.notes)}</p>`
        : '';
      const actionLinks = [];

      if (invoice.pdfUrl) {
        const safePdfUrl = escapeHtml(invoice.pdfUrl);
        actionLinks.push(
          `<a class="btn btn-outline-light-soft btn-sm" href="${safePdfUrl}" target="_blank" rel="noopener noreferrer">View PDF</a>`
        );
        actionLinks.push(
          `<a class="btn btn-brand btn-sm" href="${safePdfUrl}" download>Download PDF</a>`
        );
      }

      if (invoice.excelUrl) {
        actionLinks.push(
          `<a class="btn btn-outline-light-soft btn-sm" href="${escapeHtml(invoice.excelUrl)}" target="_blank" rel="noopener noreferrer">Download Excel</a>`
        );
      }

      if (!actionLinks.length && invoice.fileUrl) {
        actionLinks.push(
          `<a class="btn btn-outline-light-soft btn-sm" href="${escapeHtml(invoice.fileUrl)}" target="_blank" rel="noopener noreferrer">Open Invoice File</a>`
        );
      }

      return `
        <article class="invoice-card glass">
          <div class="invoice-card-top">
            <div>
              <div class="mini-label mb-2">Invoice</div>
              <h3 class="fw-bold h4 mb-2">${title}</h3>
              <p class="invoice-id mb-0">${escapeHtml(invoice.invoiceNumber || invoice.id)}</p>
            </div>
            <div class="invoice-amount-wrap">
              <span class="invoice-status ${statusClassName(invoice.status)}">${status}</span>
              <div class="invoice-amount">${amount}</div>
            </div>
          </div>

          <div class="invoice-meta-grid">
            <div class="invoice-meta-item">
              <span class="mini-label">Issued</span>
              <strong>${formatDate(invoice.issuedAt)}</strong>
            </div>
            <div class="invoice-meta-item">
              <span class="mini-label">Due</span>
              <strong>${formatDate(invoice.dueDate)}</strong>
            </div>
            <div class="invoice-meta-item">
              <span class="mini-label">Description</span>
              <strong>${escapeHtml(invoice.description || 'Invoice posted to your client portal')}</strong>
            </div>
          </div>

          ${notes}

          <div class="invoice-card-actions">
            ${actionLinks.join('')}
          </div>
        </article>
      `;
    })
    .join('');
}

function updateInvoiceSummary(invoices) {
  const openInvoices = invoices.filter((invoice) => normalizeStatus(invoice.status) !== 'paid');
  const outstanding = openInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  if (invoiceCount) invoiceCount.textContent = String(invoices.length);
  if (openInvoiceCount) openInvoiceCount.textContent = String(openInvoices.length);
  if (outstandingBalance) outstandingBalance.textContent = formatCurrency(outstanding);
  if (invoiceUpdatedAt) {
    invoiceUpdatedAt.textContent = `Last refreshed ${new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date())}`;
  }
}

async function loadInvoices(user) {
  if (!db) return;

  setPortalMessage('Loading your invoices...', 'info');

  try {
    const invoicesRef = collection(db, 'clients', user.uid, 'invoices');
    const snapshot = await getDocs(invoicesRef);
    const invoices = snapshot.docs
      .map((invoiceDoc) => ({
        id: invoiceDoc.id,
        ...invoiceDoc.data()
      }))
      .sort((left, right) => invoiceSortValue(right) - invoiceSortValue(left));

    updateInvoiceSummary(invoices);
    renderInvoices(invoices);
    clearPortalMessage();
  } catch (error) {
    console.error(error);
    renderEmptyInvoices();
    setPortalMessage(
      'We could not load invoices yet. Double-check your Firestore rules and that this client has invoice documents.',
      'warning'
    );
  }
}

async function createClientProfile(user, signupFormData) {
  if (!db) return;

  const profile = {
    uid: user.uid,
    email: user.email,
    displayName: signupFormData.get('displayName') || '',
    companyName: signupFormData.get('companyName') || '',
    phoneNumber: signupFormData.get('phoneNumber') || '',
    role: 'client',
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, 'clients', user.uid), profile, { merge: true });
}

async function loadClientProfile(user) {
  if (!db) return null;

  const profileRef = doc(db, 'clients', user.uid);
  const snapshot = await getDoc(profileRef);
  currentClientProfile = snapshot.exists() ? snapshot.data() : null;
  return currentClientProfile;
}

async function sendNewAccountNotification(user, signupFormData) {
  const clientName = String(signupFormData.get('displayName') || '').trim();
  const companyName = String(signupFormData.get('companyName') || '').trim();
  const clientEmail = String(user?.email || signupFormData.get('email') || '').trim();
  const phoneNumber = String(signupFormData.get('phoneNumber') || '').trim();
  const message = [
    'A new client portal account was created.',
    '',
    `Name: ${clientName || 'Not provided'}`,
    `Company: ${companyName || 'Not provided'}`,
    `Email: ${clientEmail || 'Not provided'}`,
    `Phone: ${phoneNumber || 'Not provided'}`,
    `UID: ${user?.uid || 'Not available'}`
  ].join('\n');

  const notificationData = new FormData();
  notificationData.append('_subject', `New client portal account: ${companyName || clientName || clientEmail || 'New signup'}`);
  notificationData.append('source', 'Client Portal Signup');
  notificationData.append('name', clientName || 'Client Portal');
  notificationData.append('email', clientEmail || 'noreply@truebitforgenorth.com');
  notificationData.append('company', companyName || 'Not provided');
  notificationData.append('phone', phoneNumber || 'Not provided');
  notificationData.append('uid', user?.uid || 'Not available');
  notificationData.append('message', message);

  const response = await fetch(accountNotificationEndpoint, {
    method: 'POST',
    body: notificationData,
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Account notification request failed with status ${response.status}.`);
  }
}

async function sendBookingNotification(action, appointment) {
  const clientName = String(appointment.clientName || currentClientProfile?.displayName || currentUser?.displayName || '').trim();
  const companyName = String(appointment.companyName || currentClientProfile?.companyName || '').trim();
  const clientEmail = String(appointment.clientEmail || currentUser?.email || '').trim();
  const phoneNumber = String(appointment.phoneNumber || currentClientProfile?.phoneNumber || '').trim();
  const notes = String(appointment.notes || '').trim();
  const message = [
    `A client portal booking was ${action}.`,
    '',
    `Client: ${clientName || 'Not provided'}`,
    `Company: ${companyName || 'Not provided'}`,
    `Email: ${clientEmail || 'Not provided'}`,
    `Phone: ${phoneNumber || 'Not provided'}`,
    `Meeting Type: ${appointment.meetingType || 'Client Session'}`,
    `Date: ${appointment.dayLabel || formatDate(appointment.startAt)}`,
    `Time: ${appointment.timeLabel || 'Not provided'}`,
    `Status: ${appointment.status || action}`,
    `Appointment ID: ${appointment.appointmentId || 'Not available'}`,
    `Notes: ${notes || 'None'}`
  ].join('\n');

  const notificationData = new FormData();
  notificationData.append('_subject', `Client booking ${action}: ${clientName || clientEmail || 'Portal Client'}`);
  notificationData.append('source', 'Client Portal Booking');
  notificationData.append('action', action);
  notificationData.append('name', clientName || 'Portal Client');
  notificationData.append('email', clientEmail || 'noreply@truebitforgenorth.com');
  notificationData.append('company', companyName || 'Not provided');
  notificationData.append('phone', phoneNumber || 'Not provided');
  notificationData.append('meetingType', appointment.meetingType || 'Client Session');
  notificationData.append('appointmentDate', appointment.dayLabel || formatDate(appointment.startAt));
  notificationData.append('appointmentTime', appointment.timeLabel || 'Not provided');
  notificationData.append('appointmentId', appointment.appointmentId || 'Not available');
  notificationData.append('message', message);

  const response = await fetch(bookingNotificationEndpoint, {
    method: 'POST',
    body: notificationData,
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Booking notification request failed with status ${response.status}.`);
  }
}

function renderEmptyBookings() {
  if (!bookingList) return;

  bookingList.innerHTML = `
    <article class="invoice-card glass invoice-card-empty">
      <div>
        <div class="mini-label mb-2">No active client meetings</div>
        <h3 class="fw-bold h4 mb-3">Your calendar is open.</h3>
        <p class="mb-0 text-white-50">
          Select an available one-hour slot on the left to reserve your next client meeting.
        </p>
      </div>
    </article>
  `;
}

function renderAppointments(appointments) {
  if (!bookingList) return;

  if (!appointments.length) {
    renderEmptyBookings();
    return;
  }

  bookingList.innerHTML = appointments
    .map((appointment) => {
      const status = normalizeStatus(appointment.status || 'booked');
      const startsAt = toDateValue(appointment.startAt);
      const canCancel = status === 'booked' && startsAt && startsAt.getTime() > Date.now();

      return `
        <article class="invoice-card glass booking-card">
          <div class="invoice-card-top">
            <div>
              <div class="mini-label mb-2">Client Meeting</div>
              <h3 class="fw-bold h4 mb-2">${escapeHtml(appointment.dayLabel || formatDate(appointment.startAt))}</h3>
              <p class="invoice-id mb-0">${escapeHtml(appointment.appointmentId || 'Booking record')}</p>
            </div>
            <div class="invoice-amount-wrap">
              <span class="invoice-status ${statusClassName(status)}">${escapeHtml(status)}</span>
              <div class="booking-time-label">${escapeHtml(appointment.timeLabel || 'Time pending')}</div>
            </div>
          </div>

          <div class="invoice-meta-grid">
            <div class="invoice-meta-item">
              <span class="mini-label">Meeting Type</span>
              <strong>${escapeHtml(appointment.meetingType || 'Client Session')}</strong>
            </div>
            <div class="invoice-meta-item">
              <span class="mini-label">Starts</span>
              <strong>${escapeHtml(formatDateTime(appointment.startAt))}</strong>
            </div>
            <div class="invoice-meta-item">
              <span class="mini-label">Company</span>
              <strong>${escapeHtml(appointment.companyName || 'Not provided')}</strong>
            </div>
          </div>

          <p class="invoice-notes mb-0">${escapeHtml(appointment.notes || 'No project notes were added for this booking.')}</p>

          <div class="invoice-card-actions">
            ${canCancel
              ? `<button type="button" class="btn btn-outline-light-soft btn-sm" data-cancel-booking="${escapeHtml(
                  appointment.appointmentId || ''
                )}">Cancel Appointment</button>`
              : '<span class="booking-card-note">This booking is already canceled or has already started.</span>'}
          </div>
        </article>
      `;
    })
    .join('');
}

async function loadBookingBlocks() {
  if (!db) return;

  const snapshot = await getDocs(collection(db, 'bookingBlocks'));
  bookingBlocks = snapshot.docs.map((blockDoc) => ({
    id: blockDoc.id,
    ...blockDoc.data()
  }));
}

async function loadClientAppointments(user) {
  if (!db) return;

  const snapshot = await getDocs(collection(db, 'clients', user.uid, 'appointments'));
  currentAppointments = snapshot.docs
    .map((appointmentDoc) => ({
      id: appointmentDoc.id,
      ...appointmentDoc.data()
    }))
    .sort((left, right) => appointmentSortValue(left) - appointmentSortValue(right));
}

function getBlockedBlockIds() {
  return new Set(
    bookingBlocks
      .filter((block) => normalizeStatus(block.status) === 'booked')
      .map((block) => block.blockId || block.id)
  );
}

function updateSelectedBookingMeta() {
  const selectedSlot = renderedClientSlots.find((slot) => slot.slotId === selectedClientSlotId);

  if (!selectedBookingMeta || !bookingSubmitBtn) return;

  if (!selectedSlot) {
    selectedBookingMeta.textContent = 'No time selected yet.';
    bookingSubmitBtn.disabled = true;
    return;
  }

  const meetingTypeLabel = bookingMeetingType?.value || 'Client Session';
  selectedBookingMeta.textContent = `${meetingTypeLabel} on ${selectedSlot.dayLabel} at ${selectedSlot.timeLabel}`;
  bookingSubmitBtn.disabled = false;
}

function renderBookingDateOptions() {
  if (!bookingDateSelect) return;

  const eligibleDates = getEligibleBookingDates(bookingWindowDays);
  const currentValue = bookingDateSelect.value;

  if (!eligibleDates.length) {
    bookingDateSelect.innerHTML = '<option value="">No booking dates available</option>';
    bookingDateSelect.disabled = true;
    renderedClientSlots = [];
    selectedClientSlotId = '';
    if (bookingTimeSelect) {
      bookingTimeSelect.innerHTML = '<option value="">No appointment times available</option>';
      bookingTimeSelect.disabled = true;
    }
    updateSelectedBookingMeta();
    return;
  }

  bookingDateSelect.disabled = false;
  bookingDateSelect.innerHTML = eligibleDates
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

  bookingDateSelect.value = eligibleDates.some((date) => {
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return value === currentValue;
  })
    ? currentValue
    : `${eligibleDates[0].getFullYear()}-${String(eligibleDates[0].getMonth() + 1).padStart(2, '0')}-${String(
        eligibleDates[0].getDate()
      ).padStart(2, '0')}`;

  renderClientSlots();
}

function renderClientSlots() {
  if (!bookingTimeSelect || !bookingDateSelect) return;

  const selectedDate = parseDateKey(bookingDateSelect.value);
  if (!selectedDate) {
    renderedClientSlots = [];
    selectedClientSlotId = '';
    bookingTimeSelect.innerHTML = '<option value="">Choose a date first</option>';
    bookingTimeSelect.disabled = true;
    updateSelectedBookingMeta();
    return;
  }

  const blockedBlockIds = getBlockedBlockIds();
  const now = Date.now();

  renderedClientSlots = getClientMeetingSlotsForDate(selectedDate).filter((slot) => slot.startAt.getTime() > now);

  if (!renderedClientSlots.some((slot) => slot.slotId === selectedClientSlotId)) {
    selectedClientSlotId = '';
  }

  if (!renderedClientSlots.length) {
    bookingTimeSelect.innerHTML = '<option value="">No future appointment times remain</option>';
    bookingTimeSelect.disabled = true;
    updateSelectedBookingMeta();
    return;
  }

  bookingTimeSelect.disabled = false;
  bookingTimeSelect.innerHTML = [
    '<option value="">Choose a time</option>',
    ...renderedClientSlots.map((slot) => {
      const isBlocked = slot.blockIds.some((blockId) => blockedBlockIds.has(blockId));
      const isSelected = selectedClientSlotId === slot.slotId;
      return `<option value="${slot.slotId}" ${isBlocked ? 'disabled' : ''} ${isSelected ? 'selected' : ''}>${escapeHtml(
        `${slot.timeLabel}${isBlocked ? ' - Unavailable' : ''}`
      )}</option>`;
    })
  ].join('');

  updateSelectedBookingMeta();
}

async function loadBookings(user) {
  try {
    await Promise.all([loadBookingBlocks(), loadClientAppointments(user)]);
    renderBookingDateOptions();
    renderAppointments(currentAppointments);
  } catch (error) {
    console.error(error);
    renderEmptyBookings();
    setBookingMessage('We could not load the booking schedule yet. Please refresh and try again.', 'warning');
  }
}

function showSignedOut() {
  currentUser = null;
  currentClientProfile = null;
  bookingBlocks = [];
  currentAppointments = [];
  renderedClientSlots = [];
  selectedClientSlotId = '';

  setPortalActionState('signed-out');
  portalDashboard?.setAttribute('hidden', '');
  logoutBtn?.setAttribute('hidden', '');
  renderEmptyInvoices();
  renderEmptyBookings();
  clearBookingMessage();
}

function showSignedIn(user) {
  currentUser = user;
  setPortalActionState('signed-in');
  portalDashboard?.removeAttribute('hidden');
  logoutBtn?.removeAttribute('hidden');

  if (currentClientEmail) currentClientEmail.textContent = user.email || 'Signed in client';
  if (currentClientName) {
    currentClientName.textContent = currentClientProfile?.displayName || user.displayName || 'Client account';
  }

  if (bookingPhoneNumber) {
    bookingPhoneNumber.value = currentClientProfile?.phoneNumber || '';
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (!auth) {
    setPortalMessage('Client portal login is still loading. Wait a moment, then try again.', 'warning');
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  setButtonsDisabled(form, true);
  setPortalMessage('Signing you in...', 'info');

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setPortalMessage('Signed in successfully.', 'success');
    form.reset();
  } catch (error) {
    console.error(error);
    setPortalMessage(authErrorMessage(error, 'Login failed. Please try again.'), 'warning');
  } finally {
    setButtonsDisabled(form, false);
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  if (!auth) {
    setPortalMessage('Client portal sign-up is still loading. Wait a moment, then try again.', 'warning');
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const displayName = String(formData.get('displayName') || '').trim();

  setButtonsDisabled(form, true);
  setPortalMessage('Creating the client account...', 'info');

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }

    await createClientProfile(credential.user, formData);

    try {
      await sendNewAccountNotification(credential.user, formData);
    } catch (notificationError) {
      console.error(notificationError);
    }

    setPortalMessage(
      'Account created. You can now log in, book meetings, and review invoices from your dashboard.',
      'success'
    );
    form.reset();
  } catch (error) {
    console.error(error);
    setPortalMessage(authErrorMessage(error, 'Sign-up failed. Please double-check your information and try again.'), 'warning');
  } finally {
    setButtonsDisabled(form, false);
  }
}

async function handlePasswordReset() {
  if (!auth) {
    setPortalMessage('Client portal password reset is still loading. Wait a moment, then try again.', 'warning');
    return;
  }

  const loginEmailInput = document.getElementById('loginEmail');
  const signupEmailInput = document.getElementById('signupEmail');
  const emailValue = String(loginEmailInput?.value || signupEmailInput?.value || '').trim();

  if (!emailValue) {
    setPortalMessage('Enter the client email address first, then use reset password.', 'warning');
    return;
  }

  try {
    await sendPasswordResetEmail(auth, emailValue);
    setPortalMessage('Password reset email sent.', 'success');
  } catch (error) {
    console.error(error);
    setPortalMessage(
      authErrorMessage(error, 'We could not send the reset email. Make sure the address belongs to an existing client account.'),
      'warning'
    );
  }
}

async function handleBookingSubmit(event) {
  event.preventDefault();
  if (!db || !currentUser || !bookingForm) return;

  const slot = renderedClientSlots.find((item) => item.slotId === selectedClientSlotId);
  if (!slot) {
    setBookingMessage('Choose an open one-hour slot before booking your client meeting.', 'warning');
    return;
  }

  const blockedBlockIds = getBlockedBlockIds();
  if (slot.blockIds.some((blockId) => blockedBlockIds.has(blockId))) {
    setBookingMessage('That client meeting slot is no longer available. Choose another open time.', 'warning');
    await loadBookings(currentUser);
    return;
  }

  const notes = String(bookingNotes?.value || '').trim();
  const meetingType = String(bookingMeetingType?.value || 'Client Session').trim();
  const clientName = String(currentClientProfile?.displayName || currentUser.displayName || 'Client').trim();
  const companyName = String(currentClientProfile?.companyName || '').trim();
  const clientEmail = String(currentUser.email || '').trim();
  const phoneNumber = String(bookingPhoneNumber?.value || currentClientProfile?.phoneNumber || '').trim();
  const appointmentId = `${currentUser.uid}-${slot.slotId}`;
  const appointmentRef = doc(db, 'clients', currentUser.uid, 'appointments', appointmentId);
  const profileRef = doc(db, 'clients', currentUser.uid);

  setButtonsDisabled(bookingForm, true);
  clearBookingMessage();

  try {
    await runTransaction(db, async (transaction) => {
      const blockRefs = slot.blockIds.map((blockId) => doc(db, 'bookingBlocks', blockId));
      const blockSnapshots = await Promise.all(blockRefs.map((blockRef) => transaction.get(blockRef)));

      if (blockSnapshots.some((snapshot) => snapshot.exists())) {
        throw new Error('SLOT_TAKEN');
      }

      blockRefs.forEach((blockRef, index) => {
        const block = slot.blocks[index];
        transaction.set(blockRef, {
          blockId: slot.blockIds[index],
          bookingId: appointmentId,
          ownerKind: 'client',
          ownerUid: currentUser.uid,
          durationMinutes: 60,
          meetingType,
          dateKey: slot.dateKey,
          dayLabel: slot.dayLabel,
          startAt: block.startAt,
          endAt: block.endAt,
          status: 'booked',
          createdAt: serverTimestamp()
        });
      });

      transaction.set(appointmentRef, {
        appointmentId,
        uid: currentUser.uid,
        clientEmail,
        clientName,
        companyName,
        phoneNumber,
        meetingType,
        dateKey: slot.dateKey,
        dayLabel: slot.dayLabel,
        timeLabel: slot.timeLabel,
        startAt: slot.startAt,
        endAt: slot.endAt,
        blockIds: slot.blockIds,
        status: 'booked',
        notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      transaction.set(
        profileRef,
        {
          phoneNumber,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    });

    const appointment = {
      appointmentId,
      uid: currentUser.uid,
      clientEmail,
      clientName,
      companyName,
      phoneNumber,
      meetingType,
      dateKey: slot.dateKey,
      dayLabel: slot.dayLabel,
      timeLabel: slot.timeLabel,
      startAt: slot.startAt,
      endAt: slot.endAt,
      blockIds: slot.blockIds,
      status: 'booked',
      notes
    };

    try {
      await sendBookingNotification('booked', appointment);
    } catch (notificationError) {
      console.error(notificationError);
    }

    if (bookingNotes) bookingNotes.value = '';
    selectedClientSlotId = '';
    setBookingMessage(`Client meeting booked for ${slot.dayLabel} at ${slot.timeLabel}.`, 'success');
    await loadBookings(currentUser);
  } catch (error) {
    console.error(error);
    if (error?.message === 'SLOT_TAKEN') {
      setBookingMessage('That time was just booked. Choose another open slot.', 'warning');
      await loadBookings(currentUser);
    } else {
      setBookingMessage('We could not complete the booking right now. Please try again.', 'warning');
    }
  } finally {
    setButtonsDisabled(bookingForm, false);
    updateSelectedBookingMeta();
  }
}

async function handleBookingCancel(appointmentId) {
  if (!db || !currentUser || !appointmentId) return;

  const appointment = currentAppointments.find((item) => (item.appointmentId || item.id) === appointmentId);
  if (!appointment) {
    setBookingMessage('We could not find that appointment record anymore.', 'warning');
    return;
  }

  const batch = writeBatch(db);
  const blockIds = Array.isArray(appointment.blockIds) ? appointment.blockIds : [];

  blockIds.forEach((blockId) => {
    batch.delete(doc(db, 'bookingBlocks', blockId));
  });

  batch.set(
    doc(db, 'clients', currentUser.uid, 'appointments', appointmentId),
    {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  clearBookingMessage();

  try {
    await batch.commit();

    try {
      await sendBookingNotification('cancelled', {
        ...appointment,
        status: 'cancelled'
      });
    } catch (notificationError) {
      console.error(notificationError);
    }

    setBookingMessage(
      `Appointment canceled for ${appointment.dayLabel || formatDate(appointment.startAt)} at ${appointment.timeLabel || formatTimeLabel(
        appointment.startAt
      )}.`,
      'success'
    );
    await loadBookings(currentUser);
  } catch (error) {
    console.error(error);
    setBookingMessage('We could not cancel that appointment right now. Please try again.', 'warning');
  }
}

function initializePortal() {
  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      setAuthMode(tab.dataset.authTab || 'login');
    });
  });

  loginForm?.addEventListener('submit', handleLoginSubmit);
  signupForm?.addEventListener('submit', handleSignupSubmit);
  logoutBtn?.addEventListener('click', () => {
    if (auth) signOut(auth);
  });
  forgotPasswordBtn?.addEventListener('click', handlePasswordReset);

  bookingDateSelect?.addEventListener('change', () => {
    clearBookingMessage();
    selectedClientSlotId = '';
    renderClientSlots();
  });

  bookingMeetingType?.addEventListener('change', updateSelectedBookingMeta);

  bookingTimeSelect?.addEventListener('change', () => {
    selectedClientSlotId = bookingTimeSelect.value || '';
    updateSelectedBookingMeta();
  });

  bookingForm?.addEventListener('submit', handleBookingSubmit);
  bookingList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cancel-booking]');
    if (!button) return;
    handleBookingCancel(button.getAttribute('data-cancel-booking') || '');
  });

  setAuthMode(activeMode);
  showSignedOut();

  if (!hasRealFirebaseConfig(firebaseConfig)) {
    setPortalActionState('unavailable');
    setupNotice?.removeAttribute('hidden');
    authPanel?.setAttribute('hidden', '');
    signedOutPanel?.setAttribute('hidden', '');
    portalDashboard?.removeAttribute('hidden');
    logoutBtn?.setAttribute('hidden', '');
    renderEmptyInvoices();
    renderEmptyBookings();
    if (invoiceUpdatedAt) {
      invoiceUpdatedAt.textContent = 'Client access is temporarily unavailable.';
    }
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setupNotice?.setAttribute('hidden', '');
  } catch (error) {
    console.error(error);
    setPortalActionState('unavailable');
    setupNotice?.removeAttribute('hidden');
    authPanel?.setAttribute('hidden', '');
    signedOutPanel?.setAttribute('hidden', '');
    setPortalMessage('Client portal could not start. Please refresh and try again.', 'warning');
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showSignedOut();
      clearPortalMessage();
      return;
    }

    showSignedIn(user);

    try {
      await loadClientProfile(user);
      showSignedIn(user);
    } catch (error) {
      console.error(error);
      setPortalMessage('Signed in, but we could not load the client profile yet.', 'warning');
    }

    await Promise.all([loadInvoices(user), loadBookings(user)]);
  });
}

if (portalShell) {
  initializePortal();
}
