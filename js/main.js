/* ============================================================
   PHONETASTIC – main.js
   Mobile-Navigation, Header-Effekt, Scroll-Reveal, Formular
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- Jahr im Footer ---- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Mobile Navigation ---- */
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');

  const closeNav = () => {
    nav.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    // Menü schließen bei Klick auf einen Link
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
    // Schließen bei Klick außerhalb
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) closeNav();
    });
  }

  /* ---- Header-Schatten beim Scrollen ---- */
  const header = document.getElementById('header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- Scroll-Reveal-Animation ---- */
  const revealEls = document.querySelectorAll(
    '.card, .price-card, .about__text, .about__box, .contact__form, .contact__info, .section__head'
  );
  revealEls.forEach(el => el.classList.add('reveal'));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('visible'));
  }

  /* ---- Kontaktformular ---- */
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');

  if (form) {
    const showError = (id, on) => {
      const group = document.getElementById(id)?.closest('.form-group');
      if (group) group.classList.toggle('error', on);
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      let valid = true;
      showError('name', !name); if (!name) valid = false;
      showError('email', !emailOk); if (!emailOk) valid = false;
      showError('message', !message); if (!message) valid = false;

      if (!valid) {
        status.textContent = 'Bitte fülle die markierten Pflichtfelder korrekt aus.';
        status.className = 'form-status bad';
        return;
      }

      /* Ohne Backend: Anfrage per E-Mail-Programm vorbereiten (mailto).
         Für echten Versand hier eine Form-API (z.B. Formspree) eintragen. */
      const subject = encodeURIComponent('Anfrage über die Website – ' + name);
      const body = encodeURIComponent(
        `Name: ${name}\n` +
        `E-Mail: ${email}\n` +
        `Telefon: ${form.phone.value.trim() || '-'}\n` +
        `Gerät/Problem: ${form.device.value.trim() || '-'}\n\n` +
        `Nachricht:\n${message}`
      );

      window.location.href =
        `mailto:info@phonetastic.at?subject=${subject}&body=${body}`;

      status.textContent = 'Danke! Dein E-Mail-Programm öffnet sich – oder ruf uns direkt an: 01 234 56 78';
      status.className = 'form-status ok';
      form.reset();
    });

    // Fehler-Markierung beim Tippen entfernen
    form.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('input', () => el.closest('.form-group')?.classList.remove('error'));
    });
  }
});
