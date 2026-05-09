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
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import firebaseConfig from './firebase-config.js';

const portalShell = document.getElementById('portalShell');
const setupNotice = document.getElementById('setupNotice');
const authPanel = document.getElementById('authPanel');
const signedOutPanel = document.getElementById('signedOutPanel');
const portalDashboard = document.getElementById('portalDashboard');
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

let auth;
let db;
let activeMode = 'login';

function hasRealFirebaseConfig(config) {
  return Boolean(
    config &&
    config.apiKey &&
    config.projectId &&
    !config.apiKey.startsWith('YOUR_') &&
    !config.projectId.startsWith('YOUR_')
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

function setButtonsDisabled(form, disabled) {
  if (!form) return;
  form.querySelectorAll('button').forEach((button) => {
    button.disabled = disabled;
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
        : 'Log in to your invoice portal';
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

function toDateValue(value) {
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

function formatDate(value) {
  const date = toDateValue(value);
  if (!date) return 'Not set';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function invoiceSortValue(invoice) {
  const candidate = invoice.issuedAt || invoice.dueDate || invoice.createdAt || null;
  const date = toDateValue(candidate);
  return date ? date.getTime() : 0;
}

function normalizeStatus(status) {
  return String(status || 'open').trim().toLowerCase();
}

function statusClassName(status) {
  const normalized = normalizeStatus(status);

  if (normalized === 'paid') return 'is-paid';
  if (normalized === 'overdue') return 'is-overdue';
  if (normalized === 'draft') return 'is-draft';
  return 'is-open';
}

function renderEmptyInvoices() {
  if (!invoiceList) return;

  invoiceList.innerHTML = `
    <article class="invoice-card glass invoice-card-empty">
      <div>
        <div class="mini-label mb-2">No invoices yet</div>
        <h3 class="fw-bold h4 mb-3">Your portal is ready.</h3>
        <p class="mb-0 text-white-50">
          Once an invoice is added to your Firebase record, it will appear here automatically after you log in.
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
      const downloadLink = invoice.fileUrl
        ? `<a class="btn btn-outline-light-soft btn-sm" href="${escapeHtml(invoice.fileUrl)}" target="_blank" rel="noopener noreferrer">Open Invoice File</a>`
        : '';

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
            ${downloadLink}
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
    role: 'client',
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, 'clients', user.uid), profile, { merge: true });
}

function showSignedOut() {
  signedOutPanel?.removeAttribute('hidden');
  authPanel?.removeAttribute('hidden');
  portalDashboard?.setAttribute('hidden', '');
  logoutBtn?.setAttribute('hidden', '');
  renderEmptyInvoices();
}

function showSignedIn(user) {
  signedOutPanel?.setAttribute('hidden', '');
  authPanel?.removeAttribute('hidden');
  portalDashboard?.removeAttribute('hidden');
  logoutBtn?.removeAttribute('hidden');

  if (currentClientEmail) currentClientEmail.textContent = user.email || 'Signed in client';
  if (currentClientName) {
    currentClientName.textContent = user.displayName || 'Client account';
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (!auth) return;

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
    setPortalMessage('Login failed. Double-check the email and password for this client account.', 'warning');
  } finally {
    setButtonsDisabled(form, false);
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  if (!auth) return;

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
    setPortalMessage('Account created. The new client can now log in and see invoices posted to their record.', 'success');
    form.reset();
  } catch (error) {
    console.error(error);
    setPortalMessage('Sign-up failed. Firebase may already have this email, or the password may be too weak.', 'warning');
  } finally {
    setButtonsDisabled(form, false);
  }
}

async function handlePasswordReset() {
  if (!auth) return;

  const loginEmailInput = document.getElementById('loginEmail');
  const signupEmailInput = document.getElementById('signupEmail');
  const emailValue = String(
    loginEmailInput?.value || signupEmailInput?.value || ''
  ).trim();

  if (!emailValue) {
    setPortalMessage('Enter the client email address first, then use reset password.', 'warning');
    return;
  }

  try {
    await sendPasswordResetEmail(auth, emailValue);
    setPortalMessage('Password reset email sent.', 'success');
  } catch (error) {
    console.error(error);
    setPortalMessage('We could not send the reset email. Make sure the address belongs to an existing client account.', 'warning');
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
    if (auth) {
      signOut(auth);
    }
  });
  forgotPasswordBtn?.addEventListener('click', handlePasswordReset);

  setAuthMode(activeMode);
  showSignedOut();

  if (!hasRealFirebaseConfig(firebaseConfig)) {
    setupNotice?.removeAttribute('hidden');
    authPanel?.setAttribute('hidden', '');
    signedOutPanel?.setAttribute('hidden', '');
    portalDashboard?.removeAttribute('hidden');
    logoutBtn?.setAttribute('hidden', '');
    renderEmptyInvoices();
    if (invoiceUpdatedAt) {
      invoiceUpdatedAt.textContent = 'Firebase setup required before clients can log in.';
    }
    return;
  }

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  setupNotice?.setAttribute('hidden', '');

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showSignedOut();
      clearPortalMessage();
      return;
    }

    showSignedIn(user);
    await loadInvoices(user);
  });
}

if (portalShell) {
  initializePortal();
}
