
    // -----------------------------
    // Simple reveal-on-scroll animation
    // -----------------------------
    const revealItems = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
        }
      });
    }, { threshold: 0.15 });

    revealItems.forEach(item => revealObserver.observe(item));

    // -----------------------------
    // Animated counters
    // -----------------------------
    const counters = document.querySelectorAll('[data-counter]');
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const target = Number(el.dataset.counter);
        let current = 0;
        const duration = 1400;
        const stepTime = Math.max(16, duration / target);

        const timer = setInterval(() => {
          current += 1;
          el.textContent = current;
          if (current >= target) {
            clearInterval(timer);
            if (target === 100) el.textContent = '100%';
            if (target === 24) el.textContent = '24/7';
            if (target === 99) el.textContent = '99%';
          }
        }, stepTime);

        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    counters.forEach(counter => counterObserver.observe(counter));

    // -----------------------------
    // Demo contact form behavior
    // -----------------------------
    const contactForm = document.getElementById('contactForm');
    const formMessage = document.getElementById('formMessage');

    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      formMessage.textContent = 'Thanks! This demo form is ready to be connected to your real email or backend workflow.';
      formMessage.classList.remove('text-white-50');
      formMessage.classList.add('text-success');
      contactForm.reset();
    });

    // -----------------------------
    // Firebase auth navbar placeholder
    // Replace this later with real Firebase auth logic
    // -----------------------------
    const authStatus = document.getElementById('authStatus');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    let demoLoggedIn = false;

    function updateAuthUI() {
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

    loginBtn.addEventListener('click', () => {
      demoLoggedIn = true;
      updateAuthUI();
    });

    signupBtn.addEventListener('click', () => {
      demoLoggedIn = true;
      updateAuthUI();
    });

    logoutBtn.addEventListener('click', () => {
      demoLoggedIn = false;
      updateAuthUI();
    });

    updateAuthUI();

    // -----------------------------
    // Auto-highlight navbar links on scroll
    // -----------------------------
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
      let current = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (window.scrollY >= sectionTop) current = section.getAttribute('id');
      });

      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
          link.classList.add('active');
        }
      });
    });
