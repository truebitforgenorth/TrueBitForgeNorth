document.addEventListener('DOMContentLoaded', () => {
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

  const contactForm = document.getElementById('contactForm');
  const formMessage = document.getElementById('formMessage');

  if (contactForm && formMessage) {
    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();

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

  const mainNav = document.getElementById('mainNav');
  const navToggle = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelectorAll('.nav-link');
  const mobileNavQuery = window.matchMedia('(max-width: 991.98px)');

  function syncMobileMenuState(forceClosed = false) {
    const isOpen = !forceClosed && !!(mainNav && mobileNavQuery.matches && mainNav.classList.contains('show'));
    document.body.classList.toggle('mobile-menu-open', isOpen);

    if (navToggle) {
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.classList.toggle('collapsed', !isOpen);
    }
  }

  function openMobileMenu() {
    if (!mainNav || !mobileNavQuery.matches) return;
    mainNav.classList.add('show');
    syncMobileMenuState();
  }

  function closeMobileMenu() {
    if (!mainNav) return;
    mainNav.classList.remove('show');
    syncMobileMenuState(true);
  }

  function toggleMobileMenu() {
    if (!mainNav || !mobileNavQuery.matches) return;

    if (mainNav.classList.contains('show')) closeMobileMenu();
    else openMobileMenu();
  }

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      toggleMobileMenu();
    });
  }

  if (mobileNavQuery.addEventListener) {
    mobileNavQuery.addEventListener('change', () => closeMobileMenu());
  } else if (mobileNavQuery.addListener) {
    mobileNavQuery.addListener(() => closeMobileMenu());
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mainNav && mainNav.classList.contains('show')) {
      closeMobileMenu();
    }
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (mobileNavQuery.matches && mainNav && mainNav.classList.contains('show')) {
        closeMobileMenu();
      }
    });
  });

  if (mainNav) {
    mainNav.addEventListener('click', (event) => {
      if (mobileNavQuery.matches && event.target === mainNav) {
        closeMobileMenu();
      }
    });
  }

  const sectionNavLinks = Array.from(document.querySelectorAll('[data-section-link]'));
  const quickLinksBar = document.querySelector('.quick-links-bar');
  const trackedSections = sectionNavLinks
    .map((link) => {
      const target = document.querySelector(link.getAttribute('href'));
      return target ? { link, section: target } : null;
    })
    .filter(Boolean);

  function updateActiveSectionLink() {
    if (!trackedSections.length) return;

    let currentId = '';
    const headerOffset =
      (document.querySelector('.navbar')?.offsetHeight || 0) +
      (quickLinksBar?.offsetHeight || 0) +
      24;

    trackedSections.forEach(({ section }) => {
      const sectionTop = section.offsetTop - headerOffset;
      if (window.scrollY >= sectionTop) {
        currentId = section.id;
      }
    });

    sectionNavLinks.forEach((link) => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === `#${currentId}`);
    });
  }

  updateActiveSectionLink();
  window.addEventListener('scroll', updateActiveSectionLink);

  const galleries = document.querySelectorAll('[data-gallery]');

  galleries.forEach((gallery) => {
    const viewport = gallery.querySelector('.gfg-gallery-viewport');
    const track = gallery.querySelector('.gfg-gallery-track');
    const slides = Array.from(gallery.querySelectorAll('.gfg-gallery-item'));
    const prevButton = gallery.querySelector('[data-gallery-prev]');
    const nextButton = gallery.querySelector('[data-gallery-next]');
    const status = gallery.querySelector('[data-gallery-status]');

    if (!viewport || !track || !slides.length) return;

    let currentIndex = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    const updateGallery = () => {
      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      if (prevButton) prevButton.disabled = currentIndex === 0;
      if (nextButton) nextButton.disabled = currentIndex === slides.length - 1;

      if (status) {
        const title =
          slides[currentIndex].querySelector('.gfg-gallery-title')?.textContent?.trim() ||
          `Screen ${currentIndex + 1}`;
        status.textContent = `${currentIndex + 1} / ${slides.length} - ${title}`;
      }
    };

    const goToSlide = (nextIndex) => {
      const boundedIndex = Math.max(0, Math.min(nextIndex, slides.length - 1));
      if (boundedIndex === currentIndex) return;

      currentIndex = boundedIndex;
      updateGallery();
      slides[currentIndex].querySelector('.gfg-gallery-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
      viewport.focus({ preventScroll: true });
    };

    prevButton?.addEventListener('click', () => goToSlide(currentIndex - 1));
    nextButton?.addEventListener('click', () => goToSlide(currentIndex + 1));

    viewport.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToSlide(currentIndex - 1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToSlide(currentIndex + 1);
      }
    });

    viewport.addEventListener(
      'touchstart',
      (event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      },
      { passive: true }
    );

    viewport.addEventListener(
      'touchend',
      (event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;

        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;

        if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

        if (deltaX < 0) goToSlide(currentIndex + 1);
        if (deltaX > 0) goToSlide(currentIndex - 1);
      },
      { passive: true }
    );

    updateGallery();
  });

  syncMobileMenuState(true);
});
