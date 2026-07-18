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

  /* --- Lead delivery (Web3Forms) ------------------------------------------
     Заявки надсилаються на e-mail через web3forms.com (безкоштовно, без сервера).
     Отримай Access Key для prosanit.exp@gmail.com на https://web3forms.com
     (введи пошту — ключ прийде листом) і встав його замість плейсхолдера нижче. */
  var WEB3FORMS_KEY = '12c87d37-d969-44f8-84e9-7174961d1d7c';

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
        '<input class="honeypot" name="_hp" tabindex="-1" autocomplete="off" placeholder="Не заповнюйте це поле" aria-hidden="true">' +
        '<label class="check-row"><input type="checkbox" name="consent"><span>Погоджуюся на обробку персональних даних згідно з <a href="terms.html" target="_blank" rel="noopener">політикою</a> *</span></label>' +
        '<div class="field-error" data-err="consent" hidden>Потрібна згода на обробку даних</div>' +
        '<button type="submit" class="btn btn--primary" style="padding:15px">Надіслати заявку</button>' +
        '<div class="field-error" data-send-error hidden style="margin-top:4px;text-align:center">Не вдалося надіслати. Перевір інтернет і спробуй ще раз.</div>' +
        '<div class="modal-note">Заявка надійде нам на пошту — передзвонимо і надішлемо посилання на оплату.</div>' +
      '</form>';
  }

  function successHTML() {
    return '' +
      '<div class="modal-success">' +
        '<div class="modal-success__icon">✓</div>' +
        '<div class="modal-success__title">Дякуємо!</div>' +
        '<p>Заявку надіслано. Найближчим часом з вами звʼяжеться менеджер для оплати абонемента.</p>' +
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

    // honeypot — silently drop bots (neutral name so browser autofill never fills it)
    if (form.elements['_hp'] && form.elements['_hp'].value) { closeForm(); return; }

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

    // Build a human-readable lead and send it to e-mail via Web3Forms.
    var LABELS = {
      name: "Ім'я", phone: 'Телефон', contact: 'E-mail / Telegram',
      tariff: 'Тариф', date: 'Бажана дата / час', trainer: 'Тренер / зручний час',
      consType: 'Тип консультації', days: 'Днів заморозки', member: 'Абонемент / на кого',
      pack: 'Пакет', vetFlag: 'Учасник «Ветеранський спорт»', comment: 'Коментар'
    };
    var title = content.querySelector('.modal__title').textContent;
    var data = {
      access_key: WEB3FORMS_KEY,
      subject: 'Нова заявка: ' + title + (name ? ' — ' + name : ''),
      from_name: 'Сайт «Територія Сили»',
      'Заявка': title
    };
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || !LABELS[el.name]) return;
      var v = (el.type === 'checkbox') ? (el.checked ? 'так' : 'ні') : el.value;
      if (v !== '' && v != null) data[LABELS[el.name]] = v;
    });
    data['Згода на обробку даних'] = 'так';
    var contact = form.elements.contact ? form.elements.contact.value : '';
    if (contact && contact.indexOf('@') > -1) data.replyto = contact;

    var submitBtn = form.querySelector('button[type="submit"]');
    var sendErr = form.querySelector('[data-send-error]');
    if (sendErr) sendErr.hidden = true;

    // Key not set yet — thank the user instead of showing a scary error.
    if (WEB3FORMS_KEY === 'REPLACE_WITH_WEB3FORMS_ACCESS_KEY') {
      console.warn('[Територія Сили] Web3Forms KEY не налаштований — лист НЕ надіслано.', data);
      content.innerHTML = successHTML();
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Надсилаємо…'; submitBtn.style.opacity = '.7'; }

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.success) { content.innerHTML = successHTML(); }
        else { throw new Error((res && res.message) || 'send failed'); }
      })
      .catch(function () {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Надіслати заявку'; submitBtn.style.opacity = ''; }
        if (sendErr) sendErr.hidden = false;
      });
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
