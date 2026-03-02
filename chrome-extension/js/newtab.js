/**
 * Grid New Tab — onboarding (modal) + verification email via Vercel API
 */

const STORAGE_KEY = 'grid-newtab';
const COLS = 12;
const ROWS = 8;

// Set your Vercel deployment URL (e.g. https://your-app.vercel.app)
const VERIFY_API_BASE = '';

const onboardingEl = document.getElementById('onboarding');
const appEl = document.getElementById('app');
const gridEl = document.getElementById('widget-grid');

let state = {
  step: 0,
  loginMethod: null,
  email: '',
  firstName: '',
  lastName: '',
  theme: 'light',
  verified: false,
};

async function loadState() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    if (data[STORAGE_KEY]?.onboardingComplete) {
      const prefs = data[STORAGE_KEY].preferences || {};
      state = { ...state, ...prefs };
      return true;
    }
  } catch (_) {}
  return false;
}

async function saveState(complete, preferences = {}) {
  const payload = {
    onboardingComplete: complete,
    preferences: complete
      ? {
          firstName: state.firstName,
          lastName: state.lastName,
          name: `${state.firstName} ${state.lastName}`.trim(),
          theme: state.theme,
          email: state.email,
          loginMethod: state.loginMethod,
        }
      : preferences,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: payload });
}

function applyTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-glass');
  if (theme === 'dark') document.body.classList.add('theme-dark');
  if (theme === 'glass') document.body.classList.add('theme-glass');
}

function showStep(step) {
  state.step = step;
  document.querySelectorAll('.onboard-step').forEach((el) => {
    el.hidden = parseInt(el.dataset.step, 10) !== step;
  });
}

function showApp() {
  document.body.classList.remove('onboarding-active');
  onboardingEl.hidden = true;
  appEl.hidden = false;
  applyTheme(state.theme);
  renderGrid();
  initBottomNav();
}

// --- Vercel email API (verification link) ---
async function sendVerificationEmail(email) {
  if (!VERIFY_API_BASE) return { ok: true };
  const res = await fetch(`${VERIFY_API_BASE}/api/send-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Failed to send email');
  return data;
}

async function checkVerified(email) {
  if (!VERIFY_API_BASE) return true;
  const res = await fetch(`${VERIFY_API_BASE}/api/check-verified?email=${encodeURIComponent(email)}`);
  const data = await res.json().catch(() => ({}));
  return res.ok && data.verified === true;
}

// --- Step 0: Email or Google ---
function initStep0() {
  const form = document.getElementById('onboard-form-0');
  const emailInput = document.getElementById('onboard-email');
  const googleBtn = document.getElementById('onboard-google');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (emailInput.value || '').trim();
    if (!email) return;
    state.loginMethod = 'email';
    state.email = email;
    await saveState(false, { email: state.email, loginMethod: state.loginMethod });
    showStep(1);
  });

  googleBtn.addEventListener('click', async () => {
    state.loginMethod = 'google';
    state.verified = true;
    await saveState(false, { loginMethod: state.loginMethod });
    showStep(1);
  });
}

// --- Step 1: First name, Last name + Theme cards ---
function initStep1() {
  const form = document.getElementById('onboard-form-1');
  const firstNameInput = document.getElementById('onboard-first-name');
  const lastNameInput = document.getElementById('onboard-last-name');
  const backBtn = document.getElementById('onboard-back-1');
  const themeCards = document.querySelectorAll('.theme-card');

  themeCards.forEach((btn) => {
    btn.addEventListener('click', () => {
      themeCards.forEach((b) => {
        b.classList.remove('selected');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
      state.theme = btn.dataset.theme;
    });
  });

  backBtn.addEventListener('click', () => showStep(0));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = (firstNameInput.value || '').trim();
    if (!firstName) {
      firstNameInput.focus();
      firstNameInput.reportValidity?.();
      return;
    }
    state.firstName = firstName;
    state.lastName = (lastNameInput.value || '').trim();
    state.theme = document.querySelector('.theme-card.selected')?.dataset.theme || 'light';
    applyTheme(state.theme);
    await saveState(false, {
      firstName: state.firstName,
      lastName: state.lastName,
      theme: state.theme,
    });

    if (state.loginMethod === 'google') {
      await saveState(true);
      showApp();
    } else {
      showStep(2);
      sendVerificationEmail(state.email).catch(() => {});
    }
  });
}

// --- Step 2: Verification link (email only) ---
function initStep2() {
  const descEl = document.getElementById('onboard-verify-desc');
  const errorEl = document.getElementById('onboard-verify-error');
  const submitBtn = document.getElementById('onboard-verify-btn');
  const backBtn = document.getElementById('onboard-back-2');

  backBtn.addEventListener('click', () => showStep(1));

  submitBtn.addEventListener('click', async () => {
    errorEl.hidden = true;
    submitBtn.disabled = true;

    try {
      const verified = await checkVerified(state.email);
      if (verified) {
        state.verified = true;
        await saveState(true);
        showApp();
      } else {
        errorEl.textContent = 'Email not verified yet. Click the link we sent you, then try again.';
        errorEl.hidden = false;
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong. Try again.';
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function initOnboarding() {
  document.body.classList.add('onboarding-active');
  onboardingEl.hidden = false;
  appEl.hidden = true;
  showStep(0);
  initStep0();
  initStep1();
  initStep2();
}

// --- Grid ---
function renderGrid() {
  gridEl.innerHTML = '';
  let index = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      index++;
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.index = index;
      cell.textContent = index;
      gridEl.appendChild(cell);
    }
  }
}

function showPage(pageId) {
  document.querySelectorAll('.app-page').forEach((el) => {
    el.hidden = el.id !== `page-${pageId}`;
  });
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });
}

function initBottomNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page) showPage(page);
    });
  });
}

// --- Boot ---
(async () => {
  const complete = await loadState();
  if (complete) {
    document.body.classList.remove('onboarding-active');
    applyTheme(state.theme);
    appEl.hidden = false;
    onboardingEl.hidden = true;
    renderGrid();
    initBottomNav();
  } else {
    initOnboarding();
  }
})();
