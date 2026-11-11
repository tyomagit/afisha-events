"use strict";

/* «Вне дома» — клиентская логика. Бэкенда нет: все данные и заявки живут
   в браузере. Карты открываются в Яндекс Картах, заявки пишутся в localStorage. */

const eventById = new Map(events.map((event) => [event.id, event]));
const eventsByDate = [...events].sort((a, b) => a.date.localeCompare(b.date));
const urlParams = new URLSearchParams(window.location.search);
const selectedEvent = eventById.get(urlParams.get("event"));
const formatPrice = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function pluralEvents(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "событие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "события";
  return "событий";
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

/* ---------- Разметка карточки ---------- */

function cardMarkup(event) {
  const tag = event.tag
    ? `<span class="event-card__tag${event.price ? " event-card__tag--hit" : ""}">${escapeHtml(event.tag)}</span>`
    : "";
  return `
    <article class="event-card" data-event-card="${event.id}">
      <a class="event-card__cover" href="product.html?event=${event.id}" tabindex="-1" aria-hidden="true">
        <img src="images/${event.image}" alt="${escapeHtml(event.alt)}" width="800" height="500" loading="lazy" />
        ${tag}
      </a>
      <div class="event-card__body">
        <p class="event-card__meta">${escapeHtml(event.category)} <span>·</span> ${escapeHtml(event.displayDate)}, ${event.time}</p>
        <h3 class="event-card__title"><a href="product.html?event=${event.id}">${escapeHtml(event.title)}</a></h3>
        <p class="event-card__venue">${escapeHtml(event.venue)} <a class="event-card__map" href="${yandexMapUrl(event)}" target="_blank" rel="noopener noreferrer">на карте</a></p>
        <div class="event-card__actions">
          <span class="event-card__price">${event.displayPrice}</span>
          <a class="event-card__cta" href="product.html?event=${event.id}">Билеты
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M7 6h11v11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
        </div>
      </div>
    </article>`;
}

/* ---------- Отрисовка карточек ---------- */

function renderCards(container, list) {
  if (!container) return;
  container.innerHTML = list.map(cardMarkup).join("");
}

/* ---------- Главная страница ---------- */

function initHome() {
  const grid = document.getElementById("popular-grid");
  if (!grid) return;

  renderCards(grid, eventsByDate.slice(0, 3));

  for (const node of document.querySelectorAll("[data-stat-events]")) {
    node.textContent = String(events.length);
  }
  const venues = new Set(events.map((event) => event.venue));
  for (const node of document.querySelectorAll("[data-stat-venues]")) {
    node.textContent = String(venues.size);
  }
  for (const node of document.querySelectorAll("[data-stat-free]")) {
    node.textContent = String(events.filter((event) => event.price === 0).length);
  }
  for (const node of document.querySelectorAll("[data-genre-count]")) {
    node.textContent = String(
      events.filter((event) => event.category === node.dataset.genreCount).length,
    );
  }
}

/* ---------- Каталог ---------- */

function initCatalog() {
  const form = document.getElementById("filters");
  if (!form) return;

  renderCards(document.getElementById("catalog-grid"), eventsByDate);

  const cards = [...document.querySelectorAll("[data-event-card]")];
  const countLabel = document.getElementById("result-count");
  const emptyState = document.getElementById("empty-state");
  const sortSelect = document.getElementById("sort");
  const chips = [...document.querySelectorAll("[data-category-chip]")];
  const categorySlugs = {
    concert: "Концерты",
    theater: "Театр",
    exhibition: "Выставки",
    workshop: "Мастер-классы",
    cinema: "Кино",
    market: "Маркеты",
  };
  const categoryFromUrl =
    categorySlugs[urlParams.get("category")] || urlParams.get("category");

  if (events.some((event) => event.category === categoryFromUrl)) {
    form.elements.category.value = categoryFromUrl;
  }

  function currentFilters() {
    const data = new FormData(form);
    return {
      search: String(data.get("search") || "")
        .trim()
        .toLocaleLowerCase("ru-RU"),
      category: data.get("category") || "",
      date: data.get("date") || "",
      price: data.get("price") || "",
      sort: sortSelect ? sortSelect.value : "date",
    };
  }

  function applySort(sort) {
    const grid = document.querySelector(".catalog-results .card-grid");
    if (!grid) return;
    const sorted = [...grid.children]
      .filter((node) => node.dataset.eventCard)
      .sort((a, b) => {
        const first = eventById.get(a.dataset.eventCard);
        const second = eventById.get(b.dataset.eventCard);
        if (sort === "price-asc") return first.price - second.price;
        if (sort === "price-desc") return second.price - first.price;
        if (sort === "title") return first.title.localeCompare(second.title, "ru");
        return first.date.localeCompare(second.date);
      });
    grid.append(...sorted);
  }

  function applyFilters() {
    const { search, category, date, price, sort } = currentFilters();
    let count = 0;

    for (const card of cards) {
      const event = eventById.get(card.dataset.eventCard);
      const priceMatches =
        !price ||
        (price === "free" ? event.price === 0 : event.price <= Number(price));
      const visible =
        event.title.toLocaleLowerCase("ru-RU").includes(search) &&
        (!category || category === event.category) &&
        (!date || event.date >= date) &&
        priceMatches;
      (card.closest("[data-card-wrapper]") || card).hidden = !visible;
      if (visible) count += 1;
    }

    for (const chip of chips) {
      const active = chip.dataset.categoryChip === category;
      chip.setAttribute("aria-pressed", String(active));
    }

    countLabel.textContent = `${count} ${pluralEvents(count)}`;
    emptyState.hidden = count > 0;
    applySort(sort);
  }

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      form.elements.category.value = chip.dataset.categoryChip;
      applyFilters();
    });
  }

  form.addEventListener("input", applyFilters);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });
  form.addEventListener("reset", () =>
    window.requestAnimationFrame(applyFilters),
  );
  sortSelect?.addEventListener("change", applyFilters);
  applyFilters();
}

/* ---------- Страница события ---------- */

function initEventPage() {
  if (!document.getElementById("event-page")) return;

  const event = selectedEvent || events[0];
  const image = document.getElementById("event-image");
  image.src = `images/${event.image}`;
  image.alt = event.alt;

  const values = {
    "event-category": event.category,
    "event-title": event.title,
    "event-subtitle": `${event.displayDate} · ${event.time} · ${event.venue}`,
    "event-description": event.text,
    "event-start": `${event.displayDate}, ${event.time}`,
    "event-venue": event.venue,
    "event-address": event.address,
    "event-address-line": `${event.address} · м. ${event.metro}`,
    "event-metro": `м. ${event.metro}`,
    "event-duration": event.duration,
    "event-age": event.age,
    "event-price": event.displayPrice,
  };
  for (const [id, value] of Object.entries(values)) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  const highlightList = document.getElementById("event-highlights");
  highlightList.replaceChildren(
    ...event.highlights.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    }),
  );

  const meta = document.getElementById("event-tags");
  meta.replaceChildren();
  for (const label of [event.displayDate, event.duration, event.age]) {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = label;
    meta.append(span);
  }
  const categoryTag = document.createElement("a");
  categoryTag.className = "tag tag--accent";
  categoryTag.href = `catalog.html?category=${encodeURIComponent(event.category)}`;
  categoryTag.textContent = event.category;
  meta.prepend(categoryTag);

  document.title = `${event.title} — ${event.displayDate} · Вне дома`;
  const breadcrumb = document.querySelector(".breadcrumbs [aria-current]");
  if (breadcrumb) breadcrumb.textContent = event.title;
  document.getElementById("event-order").href = `order.html?event=${event.id}`;
  document.getElementById("event-quick").dataset.openOrder = event.id;

  const map = document.getElementById("event-map");
  map.src = yandexStaticMapUrl(event);
  map.alt = `${event.venue}: ${event.address}`;
  document.getElementById("event-map-link-wrap").href = yandexMapUrl(event);
  map.title = `Площадка «${event.venue}» на Яндекс Картах`;
  document.getElementById("event-map-link").href = yandexMapUrl(event);
  document.getElementById("event-route").href = yandexRouteUrl(event);

  const priceRow = document.querySelector("[data-summary-price]");
  if (priceRow) priceRow.dataset.price = String(event.price);

  const rows = event.price
    ? [
        ["Стандарт", "Вход на мероприятие", formatPrice.format(event.price)],
        [
          "Приоритет",
          "Место в первых рядах и отдельный вход",
          formatPrice.format(event.price + 600),
        ],
      ]
    : [["Свободный вход", "Регистрация не нужна", "Бесплатно"]];
  const body = document.getElementById("ticket-rows");
  body.replaceChildren();
  for (const [name, condition, price] of rows) {
    const row = body.insertRow();
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = name;
    row.append(heading);
    row.insertCell().textContent = condition;
    row.insertCell().textContent = price;
  }

  const related = events.filter((item) => item.id !== event.id).slice(0, 3);
  const relatedGrid = document.getElementById("related-grid");
  relatedGrid.innerHTML = related.map(cardMarkup).join("");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: `${event.date}T${event.time}:00+03:00`,
    description: event.text,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: event.venue,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.address,
        addressLocality: "Москва",
        addressCountry: "RU",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: event.coords[0],
        longitude: event.coords[1],
      },
    },
    offers: {
      "@type": "Offer",
      price: event.price,
      priceCurrency: "RUB",
      availability: "https://schema.org/InStock",
      url: window.location.href,
    },
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(jsonLd);
  document.head.append(script);
}

/* ---------- Площадки на карте ---------- */

function initVenues() {
  const list = document.getElementById("venues-list");
  const map = document.getElementById("venues-map");
  if (!list || !map) return;

  const mapLink = document.getElementById("venues-map-link");
  const routeLink = document.getElementById("venues-route-link");

  function select(event, button) {
    for (const tab of list.querySelectorAll(".venue-tab")) {
      tab.setAttribute("aria-selected", String(tab === button));
    }
    map.src = yandexStaticMapUrl(event);
    map.alt = `${event.venue}: ${event.address}`;
    map.closest("a").href = yandexMapUrl(event);
    map.title = `Площадка «${event.venue}» на Яндекс Картах`;
    mapLink.href = yandexMapUrl(event);
    routeLink.href = yandexRouteUrl(event);
  }

  const venues = events.filter(
    (event, index, list) =>
      list.findIndex((item) => item.venue === event.venue) === index,
  );

  const buttons = venues.map((event, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "venue-tab";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(index === 0));
    button.innerHTML = `
      <span class="venue-tab__top">
        <strong>${escapeHtml(event.venue)}</strong>
        <span class="venue-tab__cat">${escapeHtml(event.category)}</span>
      </span>
      <small>${escapeHtml(event.address)} · м. ${escapeHtml(event.metro)}</small>`;
    button.addEventListener("click", () => select(event, button));
    return button;
  });
  list.append(...buttons);
  select(venues[0], buttons[0]);
}

/* ---------- Заявки и подписка ---------- */

const STORAGE_KEY = "vne-doma:requests";

function saveRequest(payload) {
  const id = `VD-${String(Date.now()).slice(-6)}`;
  const entry = { id, createdAt: new Date().toISOString(), ...payload };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    stored.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.slice(-50)));
  } catch {
    /* приватный режим — просто показываем подтверждение */
  }
  return id;
}

function fillEvent(form, event) {
  if (!event) return;
  form.elements.event.value = event.id;
  form.elements.date.value = event.date;
  form.elements.date.setCustomValidity("");
}

function initEventSelects() {
  for (const select of document.querySelectorAll('select[name="event"]')) {
    const current = select.value;
    select.innerHTML =
      '<option value="">Выберите событие</option>' +
      eventsByDate
        .map(
          (event) =>
            `<option value="${event.id}">${escapeHtml(event.title)} — ${escapeHtml(event.displayDate)}</option>`,
        )
        .join("");
    if (current && eventById.has(current)) select.value = current;
  }
}

function initForms() {
  for (const form of document.querySelectorAll("[data-form]")) {
    const { elements } = form;
    const status = form.querySelector("[role=status]");
    const booking = Boolean(elements.event);
    if (form.dataset.form === "order") fillEvent(form, selectedEvent);

    function validate() {
      elements.name.setCustomValidity(
        elements.name.value && !elements.name.value.trim()
          ? "Укажите имя."
          : "",
      );
      const phoneField = elements.phone;
      if (phoneField) {
        const phone = phoneField.value.trim();
        const validPhone =
          /^[+\d ()-]+$/.test(phone) && phone.replace(/\D/g, "").length >= 7;
        phoneField.setCustomValidity(
          phone && !validPhone ? "Введите номер телефона с кодом." : "",
        );
      }
      if (!booking) {
        if (elements.comment) {
          elements.comment.setCustomValidity(
            elements.comment.value && !elements.comment.value.trim()
              ? "Введите сообщение."
              : "",
          );
        }
        return;
      }
      const event = eventById.get(elements.event.value);
      elements.date.setCustomValidity(
        event && elements.date.value && elements.date.value !== event.date
          ? "Укажите дату выбранного мероприятия."
          : "",
      );
    }

    elements.event?.addEventListener("change", () => {
      const event = eventById.get(elements.event.value);
      if (event) fillEvent(form, event);
      else elements.date.value = "";
      validate();
      updateOrderSummary();
    });
    form.addEventListener("input", () => {
      status.hidden = true;
      validate();
      updateOrderSummary();
    });
    form.addEventListener("reset", () => {
      status.hidden = true;
      for (const field of form.querySelectorAll("input, textarea"))
        field.setCustomValidity("");
    });

    form.addEventListener("submit", (submitEvent) => {
      submitEvent.preventDefault();
      validate();
      if (!form.reportValidity()) return;

      const values = Object.fromEntries(new FormData(form));
      const id = saveRequest({
        type: booking ? "booking" : "message",
        ...values,
        event: booking ? values.event : undefined,
      });
      const event = booking ? eventById.get(values.event) : null;
      form.reset();
      if (event) fillEvent(form, event);
      status.textContent = booking
        ? `Готово: заявка № ${id} сохранена в браузере. Сервера у сайта нет, поэтому данные никуда не отправляются.`
        : `Спасибо! Сообщение № ${id} сохранено в браузере. Сайт статический, поэтому данные остаются только у вас.`;
      status.hidden = false;
      status.focus();
      updateOrderSummary();
    });

    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = false;
  }
}

function updateOrderSummary() {
  const summary = document.getElementById("order-summary");
  if (!summary) return;
  const form = document.querySelector('[data-form="order"]');
  if (!form) return;

  const event = eventById.get(form.elements.event.value) || selectedEvent;
  const tickets = Math.max(1, Number(form.elements.tickets?.value || 1));
  const total = event ? event.price * tickets : 0;

  const eventNode = summary.querySelector("[data-summary-event]");
  const dateNode = summary.querySelector("[data-summary-date]");
  const venueNode = summary.querySelector("[data-summary-venue]");
  const ticketsNode = summary.querySelector("[data-summary-tickets]");
  const totalNode = summary.querySelector("[data-summary-total]");

  if (eventNode) eventNode.textContent = event ? event.title : "—";
  if (dateNode)
    dateNode.textContent = event
      ? `${event.displayDate}, ${event.time}`
      : "—";
  if (venueNode) venueNode.textContent = event ? event.venue : "—";
  if (ticketsNode) ticketsNode.textContent = `${tickets} шт.`;
  if (totalNode)
    totalNode.textContent = !event
      ? "—"
      : total
        ? formatPrice.format(total)
        : "Бесплатно";
}

function initSubscribe() {
  const form = document.getElementById("subscribe-form");
  if (!form) return;
  const status = form.parentElement.querySelector(".subscribe__status");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const email = new FormData(form).get("email");
    try {
      const stored = JSON.parse(
        localStorage.getItem("vne-doma:subscribers") || "[]",
      );
      stored.push(email);
      localStorage.setItem(
        "vne-doma:subscribers",
        JSON.stringify([...new Set(stored)]),
      );
    } catch {
      /* без localStorage письмо всё равно подтвердим */
    }
    status.textContent =
      "Готово — адрес сохранён в этом браузере. Рассылку подключим, когда появится сервер.";
    status.hidden = false;
    form.reset();
  });
}

/* ---------- Модальное окно заявки ---------- */

function initModal() {
  const modal = document.getElementById("order-modal");
  if (!modal) return;

  const form = modal.querySelector("form");
  const heading = document.getElementById("modal-title");
  let opener;
  const isNative = modal instanceof HTMLDialogElement;
  const bootstrapModal = isNative
    ? null
    : window.bootstrap?.Modal.getOrCreateInstance(modal);
  const focusName = () => form.elements.name.focus();

  function resetModal() {
    form.reset();
    opener?.focus();
  }

  if (isNative) {
    modal
      .querySelector("[data-close-order]")
      .addEventListener("click", () => modal.close());
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.close();
    });
    modal.addEventListener("close", resetModal);
  } else {
    modal.addEventListener("shown.bs.modal", focusName);
    modal.addEventListener("hidden.bs.modal", resetModal);
  }

  for (const button of document.querySelectorAll("[data-open-order]")) {
    button.addEventListener("click", () => {
      const event = eventById.get(button.dataset.openOrder);
      if (!event) return;
      opener = button;
      form.reset();
      fillEvent(form, event);
      heading.textContent = `Заявка на «${event.title}»`;

      if (isNative) {
        modal.showModal();
        focusName();
      } else if (bootstrapModal) {
        bootstrapModal.show(button);
      } else {
        window.location.href = `order.html?event=${event.id}`;
      }
    });
  }
}

/* ---------- Бегущая строка ---------- */

function initTicker() {
  const track = document.getElementById("ticker-track");
  if (!track) return;
  const items = events
    .map(
      (event) =>
        `<span class="ticker__item">${escapeHtml(event.displayDate)} — ${escapeHtml(event.title)} · ${escapeHtml(event.venue)}</span>`,
    )
    .join("");
  track.innerHTML = items + items;
}

/* ---------- Мелкие улучшения ---------- */

function initHeader() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initReveal() {
  const targets = document.querySelectorAll(
    ".section__head, .event-card, .step, .venues, .subscribe, .page-heading, .form-panel, .contact-card, .venue-card, .faq__item",
  );
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  for (const target of targets) {
    target.classList.add("reveal");
    observer.observe(target);
  }
}

function initBackTop() {
  const link = document.querySelector(".back-top");
  if (!link) return;
  const footer = document.querySelector(".site-footer");
  let atFooter = false;

  const toggle = () =>
    link.classList.toggle("is-visible", window.scrollY > 640 && !atFooter);

  if (footer && "IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        atFooter = entries[0].isIntersecting;
        toggle();
      },
      { rootMargin: "0px 0px -30px 0px" },
    ).observe(footer);
  }

  toggle();
  window.addEventListener("scroll", toggle, { passive: true });
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector(".brand")?.focus({ preventScroll: true });
  });
}

initTicker();
initHome();
initCatalog();
initEventPage();
initVenues();
initEventSelects();
initForms();
initSubscribe();
initModal();
initHeader();
initReveal();
initBackTop();
updateOrderSummary();
