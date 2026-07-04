document.addEventListener('DOMContentLoaded', () => {
  const currentPage = document.body?.dataset.page || '';
  const pageNavLinks = document.querySelectorAll('[data-page-link]');

  pageNavLinks.forEach((link) => {
    const isActive = link.dataset.pageLink === currentPage;
    link.classList.toggle('active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

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

  const tiltScenes = document.querySelectorAll('[data-tilt-scene]');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

  tiltScenes.forEach((scene) => {
    const object = scene.querySelector('[data-tilt-object]');
    const halo = scene.querySelector('.interactive-stage__ring--halo');
    const orbit = scene.querySelector('.interactive-stage__ring--orbit');
    const outer = scene.querySelector('.interactive-stage__ring--outer');
    const inner = scene.querySelector('.interactive-stage__ring--inner');
    const core = scene.querySelector('.interactive-stage__ring--core');
    const shadow = scene.querySelector('.interactive-stage__shadow');

    if (!object || !halo || !orbit || !outer || !inner || !core || !shadow) return;

    const state = {
      currentX: 0,
      currentY: 0,
      targetX: 0,
      targetY: 0,
      pointerX: 0,
      pointerY: 0,
      scrollX: 0,
      scrollY: 0,
      isTouching: false,
      frame: null
    };

    const clampMotion = (value) => Math.max(-1, Math.min(1, value));

    function applyTransforms(xValue, yValue) {
      const isDesktopMotion = finePointerQuery.matches;
      // Keep direct pointer interaction available for reduced-motion users,
      // but substantially limit the travel and rotation.
      const accessibilityScale = reducedMotionQuery.matches ? 0.28 : 1;
      const motionScale = (isDesktopMotion ? 1.55 : 1) * accessibilityScale;
      const objectX = xValue * 24 * motionScale;
      const objectY = yValue * 16 * motionScale;
      const rotateY = xValue * 22 * motionScale;
      const rotateX = yValue * -18 * motionScale;
      const rotateZ = xValue * 10 * motionScale - 6;
      const haloRotation = (xValue * 14 + yValue * 8) * motionScale;
      const haloScale = 1 + Math.abs(yValue) * (isDesktopMotion ? 0.04 : 0.02);
      const orbitRotation = (xValue * 68 - yValue * 14) * motionScale;
      const orbitScale = 1 + Math.abs(xValue) * (isDesktopMotion ? 0.06 : 0.035);
      const outerRotation = (xValue * 50 + yValue * -10) * motionScale;
      const innerRotation = (yValue * -36 + xValue * 10) * motionScale;
      const innerScale = 1 + Math.abs(yValue) * (isDesktopMotion ? 0.045 : 0.025);
      const coreRotation = (xValue * -24 + yValue * 18) * motionScale;
      const shadowX = xValue * 9 * motionScale;
      const shadowY = yValue * 6 * motionScale;
      const shadowScale = 1 + Math.abs(xValue) * (isDesktopMotion ? 0.09 : 0.055) + Math.abs(yValue) * (isDesktopMotion ? 0.04 : 0.025);

      object.style.transform =
        `translate(-50%, -50%) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) translate3d(${objectX}px, ${objectY}px, 0)`;
      object.style.boxShadow =
        `${-xValue * 12}px ${26 + Math.abs(yValue) * 14}px 58px rgba(0, 0, 0, 0.38), 0 12px 34px rgba(255, 122, 26, 0.2), 0 0 38px rgba(47, 125, 79, 0.1)`;

      halo.style.transform = `translate(-50%, -50%) rotate(${haloRotation}deg) scale(${haloScale})`;
      orbit.style.transform = `translate(-50%, -50%) rotate(${orbitRotation}deg) scale(${orbitScale})`;
      outer.style.transform = `translate(-50%, -50%) rotate(${outerRotation}deg)`;
      inner.style.transform = `translate(-50%, -50%) rotate(${innerRotation}deg) scale(${innerScale})`;
      core.style.transform = `translate(-50%, -50%) rotate(${coreRotation}deg)`;
      shadow.style.transform =
        `translate(-50%, -50%) translate3d(${shadowX}px, ${shadowY}px, 0) scale(${shadowScale})`;
    }

    function finishFrame() {
      if (Math.abs(state.targetX - state.currentX) < 0.002 && Math.abs(state.targetY - state.currentY) < 0.002) {
        state.currentX = state.targetX;
        state.currentY = state.targetY;
        state.frame = null;
        return;
      }

      state.frame = window.requestAnimationFrame(renderTilt);
    }

    function renderTilt() {
      state.currentX += (state.targetX - state.currentX) * 0.1;
      state.currentY += (state.targetY - state.currentY) * 0.1;

      applyTransforms(state.currentX, state.currentY);

      finishFrame();
    }

    function queueRender() {
      if (!state.frame) {
        state.frame = window.requestAnimationFrame(renderTilt);
      }
    }

    function syncTargets() {
      state.targetX = clampMotion(state.pointerX + state.scrollX);
      state.targetY = clampMotion(state.pointerY + state.scrollY);
      queueRender();
    }

    function resetTilt(force = false) {
      state.pointerX = 0;
      state.pointerY = 0;

      if (force) {
        state.scrollX = 0;
        state.scrollY = 0;
      }

      if (force) {
        state.targetX = 0;
        state.targetY = 0;
        state.currentX = 0;
        state.currentY = 0;
        if (state.frame) {
          window.cancelAnimationFrame(state.frame);
          state.frame = null;
        }
        applyTransforms(0, 0);
        return;
      }

      syncTargets();
    }

    function updatePointerTilt(event, strength = 1) {
      const relativeX = finePointerQuery.matches
        ? ((event.clientX / window.innerWidth) - 0.5) * 2
        : ((event.clientX - scene.getBoundingClientRect().left) / scene.getBoundingClientRect().width - 0.5) * 2;
      const relativeY = finePointerQuery.matches
        ? ((event.clientY / window.innerHeight) - 0.5) * 2
        : ((event.clientY - scene.getBoundingClientRect().top) / scene.getBoundingClientRect().height - 0.5) * 2;

      state.pointerX = clampMotion(relativeX * strength);
      state.pointerY = clampMotion(relativeY * strength);
      syncTargets();
    }

    function updateScrollTilt() {
      if (reducedMotionQuery.matches) {
        state.scrollX = 0;
        state.scrollY = 0;
        syncTargets();
        return;
      }

      if (finePointerQuery.matches) {
        state.scrollX = 0;
        state.scrollY = 0;
        syncTargets();
        return;
      }

      const rect = scene.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const sceneCenter = rect.top + rect.height / 2;
      const scrollProgress = clampMotion((viewportCenter - sceneCenter) / (window.innerHeight * 0.7));

      state.scrollX = scrollProgress * 0.34;
      state.scrollY = scrollProgress * 0.64;
      syncTargets();
    }

    object.addEventListener('pointerdown', (event) => {
      state.isTouching = true;
      object.setPointerCapture?.(event.pointerId);
      updatePointerTilt(event, 1.25);
      event.preventDefault();
    });

    function updateViewportPointer(event) {
      if (!finePointerQuery.matches || state.isTouching) return;

      updatePointerTilt(event, 1.15);
    }

    window.addEventListener('pointermove', updateViewportPointer, { passive: true });

    object.addEventListener('pointermove', (event) => {
      if (state.isTouching) {
        updatePointerTilt(event, 1.25);
      }
    });

    object.addEventListener('pointerup', (event) => {
      state.isTouching = false;
      object.releasePointerCapture?.(event.pointerId);
      resetTilt();
    });

    object.addEventListener('pointerleave', () => {
      if (!state.isTouching && finePointerQuery.matches) resetTilt();
    });
    object.addEventListener('pointercancel', (event) => {
      state.isTouching = false;
      object.releasePointerCapture?.(event.pointerId);
      resetTilt();
    });
    window.addEventListener('scroll', updateScrollTilt, { passive: true });
    window.addEventListener('resize', updateScrollTilt);

    const syncTiltMode = () => {
      resetTilt(true);
      updateScrollTilt();
    };

    if (typeof reducedMotionQuery.addEventListener === 'function') {
      reducedMotionQuery.addEventListener('change', syncTiltMode);
      finePointerQuery.addEventListener('change', syncTiltMode);
    } else {
      reducedMotionQuery.addListener(syncTiltMode);
      finePointerQuery.addListener(syncTiltMode);
    }

    syncTiltMode();
  });

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

  syncMobileMenuState(true);
});
