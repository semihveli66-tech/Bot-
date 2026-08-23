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
    '.card, .shop-card, .price-card, .brand-chip, .step, .faq__item, .b2b__text, .b2b__box, ' +
    '.about__text, .about__box, .contact__form, .contact__info, .section__head'
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

  /* ---- Reparatur-Preisrechner ---- */
  const brandSel = document.getElementById('calcBrand');
  const modelSel = document.getElementById('calcModel');
  const results  = document.getElementById('calcResults');

  if (brandSel && modelSel && results && typeof PREISE !== 'undefined') {

    // Marken befüllen
    Object.keys(PREISE).forEach(brand => {
      brandSel.insertAdjacentHTML('beforeend', `<option value="${brand}">${brand}</option>`);
    });

    // "ab", weil der Endpreis von der gewaehlten Ersatzteil-Qualitaet abhaengt
    const fmt = (v) => v === null || v === undefined
      ? '<span class="pr-ask">auf Anfrage</span>'
      : `<span class="pr-preis"><em class="pr-ab">ab</em><span class="pr-val">${v},–&nbsp;€</span></span>`;

    const renderEmpty = (msg) => {
      results.innerHTML = `<p class="calc__hint">${msg}</p>`;
    };

    const renderPrices = (brand, model) => {
      const data = PREISE[brand][model];
      const rows = Object.keys(REPARATUR_LABELS)
        .filter(key => key in data)
        .map(key => {
          const l = REPARATUR_LABELS[key];
          return `<li class="pr-row">
            <span class="pr-icon" aria-hidden="true">${l.icon}</span>
            <span class="pr-name">${l.name}<em>${l.dauer}</em></span>
            ${fmt(data[key])}
          </li>`;
        }).join('');

      // Geraete-Retter-Praemie: gilt nur fuer bestimmte Geraetegruppen
      const foerderbar = typeof PRAEMIE_GRUPPEN !== 'undefined'
        && PRAEMIE_GRUPPEN.indexOf(brand) !== -1;

      const preise = Object.keys(data).map(k => data[k]).filter(v => typeof v === 'number');
      // Ersparnis nur beziffern, wenn ueberhaupt Preise hinterlegt sind
      const spanne = preise.length
        ? ` Bei den Preisen oben sind das rund <strong>${Math.round(Math.min.apply(null, preise) / 2)}–${Math.min(130, Math.round(Math.max.apply(null, preise) / 2))}&nbsp;€</strong> Ersparnis.`
        : '';
      const foerderBlock = foerderbar ? `
        <div class="calc__foerderung">
          <strong>🇦🇹 Geräte-Retter-Prämie möglich</strong>
          <p>
            Für Laptop-Reparaturen bekommst du <strong>50 % der Kosten zurück</strong>,
            maximal 130&nbsp;€.${spanne} Wir helfen dir beim Antrag.
          </p>
        </div>` : '';

      results.innerHTML = `
        <div class="calc__head">
          <h3>${brand} ${model}</h3>
          <p>Preise inklusive Arbeitszeit &amp; 12 Monate Garantie. Der Endpreis hängt von der gewählten Ersatzteil-Qualität ab.</p>
        </div>
        <ul class="pr-list">${rows}</ul>
        ${foerderBlock}
        <div class="calc__foot">
          <a href="#kontakt" class="btn btn--primary">Termin für dieses Gerät anfragen</a>
          <p class="calc__note">Steht bei deiner Reparatur „auf Anfrage“? Ruf kurz an – wir nennen dir den Preis sofort. Die Diagnose ist immer gratis.</p>
        </div>`;
    };

    brandSel.addEventListener('change', () => {
      const brand = brandSel.value;
      modelSel.innerHTML = '<option value="">Modell wählen …</option>';
      modelSel.disabled = !brand;
      if (!brand) { renderEmpty('Bitte zuerst die Marke wählen.'); return; }
      Object.keys(PREISE[brand]).forEach(m => {
        modelSel.insertAdjacentHTML('beforeend', `<option value="${m}">${m}</option>`);
      });
      renderEmpty('Jetzt noch dein Modell wählen – dann siehst du sofort alle Preise.');
    });

    modelSel.addEventListener('change', () => {
      const brand = brandSel.value, model = modelSel.value;
      if (brand && model) renderPrices(brand, model);
      else renderEmpty('Bitte ein Modell wählen.');
    });
  }

  /* ---- FAQ (Aufklappen) ---- */
  document.querySelectorAll('.faq__q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq__item');
      const open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---- Kontaktformular ---- */
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');

  if (form) {
    const showError = (id, on) => {
      const group = document.getElementById(id)?.closest('.form-group');
      if (group) group.classList.toggle('error', on);
    };

    const submitBtn = form.querySelector('button[type="submit"]');

    /* Notloesung, falls kontakt.php nicht erreichbar ist (z. B. Hosting
       ohne PHP): Anfrage ueber das E-Mail-Programm des Besuchers. */
    const perMailProgramm = (d) => {
      const betreff = encodeURIComponent('Anfrage über die Website – ' + d.name);
      const inhalt = encodeURIComponent(
        `Name: ${d.name}\nE-Mail: ${d.email}\nTelefon: ${d.phone || '-'}\n` +
        `Gerät/Problem: ${d.device || '-'}\n\nNachricht:\n${d.message}`
      );
      window.location.href = `mailto:info@phonetastic.at?subject=${betreff}&body=${inhalt}`;
      status.textContent = 'Dein E-Mail-Programm öffnet sich. Klappt das nicht, ruf uns an: 0660 651 12 62';
      status.className = 'form-status ok';
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const daten = {
        name:    form.name.value.trim(),
        email:   form.email.value.trim(),
        phone:   form.phone.value.trim(),
        device:  form.device.value.trim(),
        message: form.message.value.trim(),
        website: form.website ? form.website.value : ''   // Spam-Falle
      };
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(daten.email);

      let valid = true;
      showError('name', !daten.name);       if (!daten.name) valid = false;
      showError('email', !emailOk);         if (!emailOk) valid = false;
      showError('message', !daten.message); if (!daten.message) valid = false;

      if (!valid) {
        status.textContent = 'Bitte fülle die markierten Pflichtfelder korrekt aus.';
        status.className = 'form-status bad';
        return;
      }

      submitBtn.disabled = true;
      const beschriftung = submitBtn.textContent;
      submitBtn.textContent = 'Wird gesendet …';
      status.textContent = '';
      status.className = 'form-status';

      try {
        const antwort = await fetch('kontakt.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: new URLSearchParams(daten).toString()
        });

        // Kein PHP vorhanden? Dann kommt HTML statt JSON zurueck.
        const typ = antwort.headers.get('content-type') || '';
        if (!typ.includes('application/json')) throw new Error('kein-php');

        const ergebnis = await antwort.json();

        if (ergebnis.ok) {
          status.textContent = 'Danke! Deine Anfrage ist bei uns eingegangen – wir melden uns schnellstmöglich.';
          status.className = 'form-status ok';
          form.reset();
        } else {
          status.textContent = ergebnis.error || 'Das hat leider nicht geklappt. Bitte ruf uns an: 0660 651 12 62';
          status.className = 'form-status bad';
        }
      } catch (err) {
        perMailProgramm(daten);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = beschriftung;
      }
    });

    // Fehler-Markierung beim Tippen entfernen
    form.querySelectorAll('input, textarea').forEach(el => {
      el.addEventListener('input', () => el.closest('.form-group')?.classList.remove('error'));
    });
  }
});
