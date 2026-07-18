/* ==========================================================================
   Територія Сили — interactive logic
   Ported from the original Claude Design DCLogic component to plain JS.
   Handles: lead-capture modals, per-form fields, validation, honeypot,
   success state, and the mobile navigation toggle.
   ========================================================================== */
(function () {
  'use strict';

  /* Modal config — title + the "product" label + comment placeholder per form */
  var FORMS = {
    buy:     { title: 'Обрати абонемент',        product: function (t) { return t || 'Абонемент'; },     comment: "Коментар (необов'язково)" },
    first:   { title: 'Перше тренування',         product: function () { return 'Перше тренування'; },   comment: "Коментар (необов'язково)" },
    vet:     { title: 'Пакет «Ветеранський»',     product: function () { return 'Ветеранський — 1500 грн'; }, comment: "Коментар (необов'язково)" },
    trainer: { title: 'Запис до тренера',         product: function () { return 'Індивідуальне тренування'; }, comment: 'Твоя ціль (маса, сила, схуднення…)' },
    diet:    { title: 'Консультація дієтолога',   product: function () { return 'Дієтологія'; },          comment: "Коротко про ціль (необов'язково)" },
    supp:    { title: 'Замовити спортпит',         product: function () { return 'Спортивне харчування'; }, comment: 'Що цікавить? (бренд, тип, бюджет)' },
    freeze:  { title: 'Заморозка абонемента',      product: function () { return 'Заморозка'; },           comment: 'Причина / коментар (необов\'язково)' },
    ask:     { title: 'Задати питання',            product: function () { return 'Питання'; },             comment: 'Твоє питання *' }
  };

  var TARIFFS = ['Разове — 150 грн', 'Місяць — 700 грн', '3 місяці — 1900 грн', 'Рік — 6500 грн'];
  var DEFAULT_TARIFF = 1; // Місяць

  var overlay = document.getElementById('overlay');
  var content = document.getElementById('modalContent');
  var opener = null;

  /* --- Type-specific fields ------------------------------------------------ */
  function fieldsFor(type, tariffIndex) {
    switch (type) {
      case 'buy':
        return '<select class="field" name="tariff">' +
                 TARIFFS.map(function (t, i) {
                   return '<option' + (i === tariffIndex ? ' selected' : '') + '>' + t + '</option>';
                 }).join('') +
               '</select>' +
               '<input class="field" name="date" placeholder="Бажана дата старту">';
      case 'first':
        return '<input class="field" name="date" placeholder="Коли зручно прийти? (дата / час)">';
      case 'vet':
        return '<label class="check-row check-row--vet"><input type="checkbox" name="vetFlag" checked>Я учасник програми «Ветеранський спорт» (маю Дія.Картку)</label>' +
               '<select class="field" name="pack">' +
                 '<option>Абонемент (місяць) + спортпит до 800 грн</option>' +
                 '<option>Абонемент (місяць) + консультація дієтолога</option>' +
                 '<option>Тільки абонементи на 2 місяці</option>' +
               '</select>';
      case 'trainer':
        return '<input class="field" name="trainer" placeholder="Бажаний тренер / зручний час">';
      case 'diet':
        return '<select class="field" name="consType">' +
                 '<option>Первинна консультація — 600 грн</option>' +
                 '<option>Супровід (місяць) — 1200 грн</option>' +
               '</select>';
      case 'freeze':
        return '<input class="field" name="member" placeholder="Номер абонемента або ім\'я, на кого оформлено">' +
               '<select class="field" name="days">' +
                 '<option>7 днів</option><option>14 днів</option><option>21 день</option><option>30 днів</option>' +
               '</select>';
      default:
        return '';
    }
  }

  /* --- Full form markup ---------------------------------------------------- */
  function formHTML(type, tariffIndex) {
    var f = FORMS[type];
    var product = f.product(TARIFFS[tariffIndex]);
    return '' +
      '<div class="modal__head">' +
        '<div>' +
          '<div class="modal__title" id="modalTitle">' + f.title + '</div>' +
          '<div class="modal__product">' + product + '</div>' +
        '</div>' +
        '<button type="button" class="modal__close" data-close aria-label="Закрити">✕</button>' +
      '</div>' +
      '<form class="modal__body" id="leadForm" novalidate>' +
        '<input class="field" name="name" placeholder="Ім\'я *" autocomplete="name">' +
        '<div class="field-error" data-err="name" hidden>Вкажи ім\'я</div>' +
        '<input class="field" name="phone" placeholder="Телефон, напр. 0671234567 *" inputmode="tel" autocomplete="tel">' +
        '<div class="field-error" data-err="phone" hidden>Вкажи коректний український номер</div>' +
        '<input class="field" name="contact" placeholder="E-mail або Telegram-нік (необов\'язково)">' +
        fieldsFor(type, tariffIndex) +
        '<textarea class="field" name="comment" rows="3" placeholder="' + f.comment + '"></textarea>' +
        '<input class="honeypot" name="company" tabindex="-1" autocomplete="off" placeholder="Не заповнюйте це поле" aria-hidden="true">' +
        '<label class="check-row"><input type="checkbox" name="consent"><span>Погоджуюся на обробку персональних даних згідно з <a href="terms.html" target="_blank" rel="noopener">політикою</a> *</span></label>' +
        '<div class="field-error" data-err="consent" hidden>Потрібна згода на обробку даних</div>' +
        '<button type="submit" class="btn btn--primary" style="padding:15px">Надіслати заявку</button>' +
        '<div class="modal-note">Заявка впаде нам на пошту і в Telegram. Скинемо тобі посилання на оплату — і все.</div>' +
      '</form>';
  }

  function successHTML() {
    return '' +
      '<div class="modal-success">' +
        '<div class="modal-success__icon">✓</div>' +
        '<div class="modal-success__title">Дякуємо!</div>' +
        '<p>Спіймали заявку. Скоро наберемо і скинемо посилання на оплату.</p>' +
        '<button type="button" class="btn btn--outline" style="padding:12px 28px" data-close>Закрити</button>' +
      '</div>';
  }

  /* --- Open / close -------------------------------------------------------- */
  function openForm(type, tariffIndex) {
    if (!FORMS[type]) return;
    var idx = (tariffIndex == null) ? DEFAULT_TARIFF : tariffIndex;
    content.innerHTML = formHTML(type, idx);
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    var form = document.getElementById('leadForm');
    form.addEventListener('submit', onSubmit);
    var first = form.querySelector('input[name="name"]');
    if (first) first.focus();
  }

  function closeForm() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    content.innerHTML = '';
    if (opener && typeof opener.focus === 'function') opener.focus();
    opener = null;
  }

  /* --- Submit / validation ------------------------------------------------- */
  function onSubmit(e) {
    e.preventDefault();
    var form = e.currentTarget;

    // honeypot — silently drop bots
    if (form.elements.company && form.elements.company.value) { closeForm(); return; }

    var name = (form.elements.name.value || '').trim();
    var digits = (form.elements.phone.value || '').replace(/[\s\-()+]/g, '');
    var consent = form.elements.consent && form.elements.consent.checked;

    var errs = {
      name: !name,
      phone: !/^(380\d{9}|0\d{9})$/.test(digits),
      consent: !consent
    };

    ['name', 'phone', 'consent'].forEach(function (k) {
      var el = form.querySelector('[data-err="' + k + '"]');
      if (el) el.hidden = !errs[k];
    });

    if (errs.name || errs.phone || errs.consent) {
      var firstBad = errs.name ? 'name' : (errs.phone ? 'phone' : null);
      if (firstBad && form.elements[firstBad]) form.elements[firstBad].focus();
      return;
    }

    // Collect the lead. In production: POST to a Worker/endpoint that
    // e-mails the gym, pings the Telegram bot, and returns a WayForPay link.
    var payload = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === 'company') return;
      payload[el.name] = (el.type === 'checkbox') ? el.checked : el.value;
    });
    payload.title = form.querySelector('.modal__title').textContent;
    console.log('[Територія Сили] Нова заявка:', payload);

    content.innerHTML = successHTML();
  }

  /* --- Global event wiring ------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var openBtn = e.target.closest('[data-open]');
    if (openBtn) {
      opener = openBtn;
      var t = openBtn.getAttribute('data-tariff');
      openForm(openBtn.getAttribute('data-open'), t == null ? null : parseInt(t, 10));
      return;
    }
    if (e.target.closest('[data-close]')) { closeForm(); }
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeForm();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !overlay.hidden) closeForm();
  });

  /* --- Mobile navigation --------------------------------------------------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('main-nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();
