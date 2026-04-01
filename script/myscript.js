document.addEventListener('DOMContentLoaded', () => {
  // Reveal on scroll
  const revealItems = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
        }
      });
    }, { threshold: 0.15 });

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('show'));
  }

  // Counters
  const counters = document.querySelectorAll('[data-counter]');
  if ('IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const target = Number(el.dataset.counter) || 0;
        let current = 0;
        const duration = 1400;
        const stepTime = target > 0 ? Math.max(16, duration / target) : 16;

        const timer = setInterval(() => {
          current += 1;
          el.textContent = current;

          if (current >= target) {
            clearInterval(timer);
            if (target === 100) el.textContent = '100%';
            else if (target === 24) el.textContent = '24/7';
            else if (target === 99) el.textContent = '99%';
            else el.textContent = String(target);
          }
        }, stepTime);

        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    counters.forEach((counter) => counterObserver.observe(counter));
  }

// -----------------------------
// Contact form - working mailto version
// -----------------------------
const contactForm = document.getElementById('contactForm');
const formMessage = document.getElementById('formMessage');

if (contactForm && formMessage) {
  contactForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData(contactForm);

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json'
        }
      });

      if (response.ok) {
        formMessage.textContent = 'Inquiry sent successfully.';
        formMessage.classList.remove('text-white-50', 'text-warning');
        formMessage.classList.add('text-success');
        contactForm.reset();
      } else {
        formMessage.textContent = 'Something went wrong. Please try again.';
        formMessage.classList.remove('text-white-50', 'text-success');
        formMessage.classList.add('text-warning');
      }
    } catch (error) {
      formMessage.textContent = 'Connection error. Please try again.';
      formMessage.classList.remove('text-white-50', 'text-success');
      formMessage.classList.add('text-warning');
      console.error(error);
    }
  });
}

  // Auth UI
  const authStatus = document.getElementById('authStatus');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  let demoLoggedIn = false;

  function updateAuthUI() {
    if (!authStatus || !loginBtn || !signupBtn || !logoutBtn) return;

    if (demoLoggedIn) {
      authStatus.textContent = 'Signed in as demo@truebitforge.com';
      loginBtn.classList.add('d-none');
      signupBtn.classList.add('d-none');
      logoutBtn.classList.remove('d-none');
    } else {
      authStatus.textContent = 'Guest Mode';
      loginBtn.classList.remove('d-none');
      signupBtn.classList.remove('d-none');
      logoutBtn.classList.add('d-none');
    }
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      demoLoggedIn = true;
      updateAuthUI();
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener('click', () => {
      demoLoggedIn = true;
      updateAuthUI();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      demoLoggedIn = false;
      updateAuthUI();
    });
  }

  updateAuthUI();

  // Active nav links
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = '';

    sections.forEach((section) => {
      const sectionTop = section.offsetTop - 120;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
});