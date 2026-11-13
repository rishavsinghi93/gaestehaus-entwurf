/*
  Gästehaus Biehler – Anfrage mit Preisrechner.
  Prototyp: Das Formular prüft die Angaben und zeigt eine Zusammenfassung, verschickt aber nichts
  und speichert keine persönlichen Daten.
  Preise laut bestehender Seite: 40 € pro Person und Nacht im Doppelzimmer mit Frühstück,
  ab 14 Nächten 35 €, Mindestaufenthalt 2 Nächte, Einzelbelegung auf Anfrage.
*/
(() => {
  const form = document.getElementById('booking-form');
  if (!form) return;

  const RATE = 40;
  const RATE_LONG = 35;
  const LONG_STAY = 14;
  const MIN_NIGHTS = 2;
  const DAY = 86400000;

  // Deutsche Texte für alles, was erst per Skript entsteht (Englisch steht in i18n.js)
  const DE = {
    'booking.quote.empty': 'Wählen Sie An- und Abreise – dann sehen Sie hier gleich Ihren Preis.',
    'booking.quote.total': 'inklusive Frühstück',
    'booking.quote.longStay': 'Langzeitpreis: 35 € statt 40 € ab 14 Nächten',
    'booking.quote.tip': 'Tipp: Ab 14 Nächten zahlen Sie nur 35 € pro Person und Nacht.',
    'booking.quote.single': 'Für die Einzelbelegung eines Doppelzimmers nennen wir Ihnen den Preis gern auf Anfrage.',
    'booking.quote.singleExtra': '+ 1 Person im Doppelzimmer zur Einzelbelegung: Preis auf Anfrage',
    'booking.quote.note': 'Unverbindlich – das Zimmer ist damit noch nicht reserviert.',
    'booking.quote.minStay': 'Mindestaufenthalt: 2 Nächte. Bitte wählen Sie eine spätere Abreise.',
    'booking.unit.night.one': 'Nacht',
    'booking.unit.night.other': 'Nächte',
    'booking.unit.guest.one': 'Person',
    'booking.unit.guest.other': 'Personen',
    'booking.unit.room.one': 'Doppelzimmer',
    'booking.unit.room.other': 'Doppelzimmer',
    'booking.err.required': 'Bitte ausfüllen.',
    'booking.err.email': 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    'booking.err.past': 'Die Anreise kann nicht in der Vergangenheit liegen.',
    'booking.err.order': 'Die Abreise muss nach der Anreise liegen.',
    'booking.err.minStay': 'Bitte wählen Sie mindestens 2 Nächte.',
    'booking.err.consent': 'Bitte stimmen Sie der Datenschutzerklärung zu.',
    'booking.err.summary': 'Bitte prüfen Sie die markierten Felder.',
    'booking.done.title': 'Vielen Dank, {name}!',
    'booking.sum.dates': 'Reisedaten',
    'booking.sum.guests': 'Personen',
    'booking.sum.rooms': 'Zimmerwunsch',
    'booking.sum.noRoom': 'Kein bestimmter Wunsch',
    'booking.sum.price': 'Preis',
    'booking.sum.priceOnRequest': 'auf Anfrage',
    'booking.sum.inclBreakfast': 'inkl. Frühstück',
    'booking.sum.name': 'Name',
    'booking.sum.email': 'E-Mail',
    'booking.sum.phone': 'Telefon',
    'booking.sum.address': 'Adresse',
    'booking.sum.message': 'Nachricht',
  };

  const HB = window.HB || { t: (key, fallback) => fallback, lang: () => 'de' };
  const tt = (key) => HB.t(key, DE[key] != null ? DE[key] : key);
  const locale = () => (HB.lang() === 'en' ? 'en-GB' : 'de-DE');

  const $ = (id) => document.getElementById(id);
  const arrival = $('b-arrival');
  const departure = $('b-departure');
  const guests = $('b-guests');
  const quote = $('b-quote');
  const errorSummary = $('b-error-summary');
  const done = $('booking-done');
  const doneTitle = $('booking-done-title');
  const summary = $('booking-summary');

  /* ---------- Datum und Preis ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const parse = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const toValue = (ms) => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };
  const money = (amount) => new Intl.NumberFormat(locale(), {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
  const dateRange = (a, b) => {
    const f = new Intl.DateTimeFormat(locale(), {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
    return typeof f.formatRange === 'function' ? f.formatRange(a, b) : `${f.format(a)} – ${f.format(b)}`;
  };
  const unit = (n, key) => `${n} ${tt(`booking.unit.${key}.${n === 1 ? 'one' : 'other'}`)}`;

  function stay() {
    const a = parse(arrival.value);
    const b = parse(departure.value);
    const g = Number(guests.value) || 2;
    const nights = a !== null && b !== null ? Math.round((b - a) / DAY) : null;
    const rate = nights !== null && nights >= LONG_STAY ? RATE_LONG : RATE;
    const paying = Math.floor(g / 2) * 2;      // Personen in voll belegten Doppelzimmern
    const single = g % 2;                       // eine Person allein im Doppelzimmer: Preis auf Anfrage
    const total = nights !== null && nights >= MIN_NIGHTS && paying > 0 ? paying * nights * rate : null;
    return { a, b, g, nights, rate, paying, single, total, rooms: Math.ceil(g / 2) };
  }

  const para = (className, text) => {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = text;
    return p;
  };

  function renderQuote() {
    const s = stay();
    quote.classList.remove('is-ready');
    quote.replaceChildren();
    if (s.a === null || s.b === null) {
      quote.append(para('quote-empty', tt('booking.quote.empty')));
      return;
    }
    if (s.nights <= 0) { quote.append(para('quote-warn', tt('booking.err.order'))); return; }
    if (s.nights < MIN_NIGHTS) { quote.append(para('quote-warn', tt('booking.quote.minStay'))); return; }

    quote.classList.add('is-ready');
    quote.append(para('quote-dates', `${dateRange(s.a, s.b)} · ${unit(s.nights, 'night')}`));
    if (s.total !== null) {
      quote.append(para('quote-calc', `${unit(s.paying, 'guest')} × ${unit(s.nights, 'night')} × ${money(s.rate)}`));
      const total = document.createElement('p');
      total.className = 'quote-total';
      const amount = document.createElement('strong');
      amount.textContent = money(s.total);
      const label = document.createElement('span');
      label.textContent = `${tt('booking.quote.total')} · ${unit(s.rooms, 'room')}`;
      total.append(amount, label);
      quote.append(total);
      if (s.single) quote.append(para('quote-extra', tt('booking.quote.singleExtra')));
    } else {
      quote.append(para('quote-extra', tt('booking.quote.single')));
    }
    if (s.rate === RATE_LONG) quote.append(para('quote-badge', tt('booking.quote.longStay')));
    else if (s.nights >= 10) quote.append(para('quote-tip', tt('booking.quote.tip')));
    quote.append(para('quote-note', tt('booking.quote.note')));
  }

  /* ---------- Prüfen der Felder ---------- */
  const rules = {
    'b-arrival': () => {
      if (!arrival.value) return 'required';
      return arrival.value < TODAY ? 'past' : null;
    },
    'b-departure': () => {
      if (!departure.value) return 'required';
      const s = stay();
      if (s.nights === null) return null;
      if (s.nights <= 0) return 'order';
      return s.nights < MIN_NIGHTS ? 'minStay' : null;
    },
    'b-first': () => ($('b-first').value.trim() ? null : 'required'),
    'b-last': () => ($('b-last').value.trim() ? null : 'required'),
    'b-email': () => {
      const value = $('b-email').value.trim();
      if (!value) return 'required';
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? null : 'email';
    },
    'b-consent': () => ($('b-consent').checked ? null : 'consent'),
  };
  const errors = new Map();

  function setError(id, code) {
    const field = $(id);
    const message = $(`${id}-error`);
    if (code) {
      errors.set(id, code);
      field.setAttribute('aria-invalid', 'true');
      message.textContent = tt(`booking.err.${code}`);
      message.hidden = false;
    } else {
      errors.delete(id);
      field.removeAttribute('aria-invalid');
      message.textContent = '';
      message.hidden = true;
    }
  }
  const check = (id) => { setError(id, rules[id]()); return !errors.has(id); };
  const recheck = (id) => { if (errors.has(id)) check(id); };

  Object.keys(rules).forEach((id) => {
    const field = $(id);
    field.addEventListener(field.type === 'checkbox' ? 'change' : 'input', () => recheck(id));
    if (field.type !== 'checkbox') field.addEventListener('blur', () => { if (field.value) check(id); });
  });

  /* ---------- Reisedaten ---------- */
  const setMinDates = () => {
    arrival.min = TODAY;
    const a = parse(arrival.value);
    departure.min = toValue((a !== null ? a : parse(TODAY)) + MIN_NIGHTS * DAY);
  };
  arrival.addEventListener('change', () => {
    const a = parse(arrival.value);
    const b = parse(departure.value);
    if (a !== null && (b === null || b <= a)) departure.value = toValue(a + MIN_NIGHTS * DAY);
    setMinDates();
    renderQuote();
    recheck('b-arrival');
    recheck('b-departure');
  });
  arrival.addEventListener('input', renderQuote);
  departure.addEventListener('change', () => { renderQuote(); recheck('b-departure'); });
  departure.addEventListener('input', renderQuote);
  guests.addEventListener('change', renderQuote);

  /* ---------- Absenden (Prototyp: nichts wird verschickt) ---------- */
  let request = null;

  const collect = () => ({
    stay: stay(),
    rooms: Array.from(form.querySelectorAll('input[name="zimmer"]:checked'), (box) => box.value),
    salutation: $('b-salutation').value,
    first: $('b-first').value.trim(),
    last: $('b-last').value.trim(),
    email: $('b-email').value.trim(),
    phone: $('b-phone').value.trim(),
    street: $('b-street').value.trim(),
    zip: $('b-zip').value.trim(),
    city: $('b-city').value.trim(),
    message: $('b-message').value.trim(),
  });

  function renderDone() {
    if (!request) return;
    const r = request;
    const s = r.stay;
    doneTitle.textContent = tt('booking.done.title').replace('{name}', r.first);

    const salutation = r.salutation
      ? `${$('b-salutation').querySelector(`option[value="${r.salutation}"]`).textContent} ` : '';
    let price = tt('booking.sum.priceOnRequest');
    if (s.total !== null) {
      price = `${money(s.total)} ${tt('booking.sum.inclBreakfast')} (${s.paying} × ${s.nights} × ${money(s.rate)})`;
      if (s.single) price += `\n${tt('booking.quote.singleExtra')}`;
    }
    const address = [r.street, [r.zip, r.city].filter(Boolean).join(' ')].filter(Boolean).join('\n');

    const rows = [
      ['booking.sum.dates', `${dateRange(s.a, s.b)} (${unit(s.nights, 'night')})`],
      ['booking.sum.guests', `${unit(s.g, 'guest')} · ${unit(s.rooms, 'room')}`],
      ['booking.sum.rooms', r.rooms.length ? r.rooms.join(', ') : tt('booking.sum.noRoom')],
      ['booking.sum.price', price],
      ['booking.sum.name', `${salutation}${r.first} ${r.last}`],
      ['booking.sum.email', r.email],
    ];
    if (r.phone) rows.push(['booking.sum.phone', r.phone]);
    if (address) rows.push(['booking.sum.address', address]);
    if (r.message) rows.push(['booking.sum.message', r.message]);

    summary.replaceChildren(...rows.flatMap(([key, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = tt(key);
      const dd = document.createElement('dd');
      dd.textContent = value;
      return [dt, dd];
    }));
  }

  const showForm = () => {
    done.hidden = true;
    form.hidden = false;
    document.getElementById('anfrage').scrollIntoView({ block: 'start' });
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const invalid = Object.keys(rules).filter((id) => !check(id));
    if (invalid.length) {
      errorSummary.textContent = tt('booking.err.summary');
      errorSummary.hidden = false;
      $(invalid[0]).focus();
      return;
    }
    errorSummary.hidden = true;
    // Im echten Betrieb: Ist das versteckte Feld "website" ausgefüllt, war es ein Bot – still verwerfen.
    request = collect();
    renderDone();
    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ block: 'start' });
    done.focus({ preventScroll: true });
  });

  $('booking-edit').addEventListener('click', () => {
    showForm();
    arrival.focus({ preventScroll: true });
  });
  $('booking-new').addEventListener('click', () => {
    form.reset();
    Array.from(errors.keys()).forEach((id) => setError(id, null));
    errorSummary.hidden = true;
    request = null;
    setMinDates();
    renderQuote();
    showForm();
  });

  /* ---------- „Zimmer anfragen“ wählt das Zimmer gleich vor ---------- */
  document.querySelectorAll('a[data-room]').forEach((link) => {
    link.addEventListener('click', () => {
      const box = form.querySelector(`input[name="zimmer"][value="${link.dataset.room}"]`);
      if (box) box.checked = true;
      if (form.hidden) { done.hidden = true; form.hidden = false; }
    });
  });

  /* ---------- Sprache gewechselt: alles, was das Skript geschrieben hat, neu schreiben ---------- */
  document.addEventListener('hb:lang', () => {
    renderQuote();
    errors.forEach((code, id) => setError(id, code));
    if (!errorSummary.hidden) errorSummary.textContent = tt('booking.err.summary');
    if (!done.hidden) renderDone();
  });

  setMinDates();
  renderQuote();
})();
