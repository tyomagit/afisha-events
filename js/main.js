"use strict";

/* «Вне дома» — клиентская логика. Бэкенда нет: все данные и заявки живут
   в браузере. Карты открываются в Яндекс Картах, заявки пишутся в localStorage. */

const eventById = new Map(events.map((event) => [event.id, event]));
const eventsByDate = [...events].sort((a, b) => a.date.localeCompare(b.date));
const urlParams = new URLSearchParams(window.location.search);
const selectedEvent = eventById.get(urlParams.get("event"));

/* ---------- Избранное и отзывы: данные в localStorage ---------- */

const FAVORITES_KEY = "vne-doma:favorites";
const REVIEWS_KEY = "vne-doma:reviews";

function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function getFavorites() {
  const list = readStored(FAVORITES_KEY, []);
  return Array.isArray(list)
    ? [...new Set(list.filter((id) => eventById.has(id)))]
    : [];
}

function isFavorite(id) {
  return getFavorites().includes(id);
}

function toggleFavorite(id) {
  const list = getFavorites();
  const next = list.includes(id)
    ? list.filter((item) => item !== id)
    : [...list, id];
  writeStored(FAVORITES_KEY, next);
  return next.includes(id);
}

function pluralReviews(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "отзыв";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "отзыва";
  return "отзывов";
}
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
      <button
        class="event-card__fav"
        type="button"
        data-fav="${event.id}"
        aria-pressed="${isFavorite(event.id)}"
        aria-label="${isFavorite(event.id) ? "Убрать" : "Добавить"} «${escapeHtml(event.title)}» ${isFavorite(event.id) ? "из избранного" : "в избранное"}"
        title="${isFavorite(event.id) ? "Убрать из избранного" : "В избранное"}"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.7 13a4.9 4.9 0 0 1 0-6.9 4.8 4.8 0 0 1 6.8 0l.5.5.5-.5a4.8 4.8 0 0 1 6.8 0 4.9 4.9 0 0 1 0 6.9Z" /></svg>
      </button>
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
      day: data.get("day") || "",
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

  /* Календарь: месяц берём из ближайшего события, день фильтрует афишу. */
  const calendarGrid = document.getElementById("calendar-grid");
  const calendarStatus = document.getElementById("calendar-status");
  const calendarReset = document.getElementById("calendar-reset");
  const calendarDefaultStatus =
    calendarStatus?.textContent || "Выберите день — афиша отфильтруется.";
  const calendarButtons = [];
  const eventsByDay = new Map();
  const dayLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  });
  const monthLabel = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  });
  const weekdayLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
  const weekdayShort = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });

  for (const item of events) {
    if (!eventsByDay.has(item.date)) eventsByDay.set(item.date, []);
    eventsByDay.get(item.date).push(item);
  }

  if (calendarGrid) {
    const start = new Date(`${eventsByDate[0].date}T00:00:00`);
    const year = start.getFullYear();
    const month = start.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthTitle = monthLabel.format(start).replace(" г.", "");
    const heading = document.getElementById("calendar-title");
    if (heading) heading.textContent = monthTitle;
    calendarGrid.setAttribute(
      "aria-label",
      `Календарь событий на ${monthTitle}`,
    );

    const fragment = document.createDocumentFragment();
    for (let number = 1; number <= daysInMonth; number += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(number).padStart(2, "0")}`;
      const date = new Date(`${iso}T00:00:00`);
      const count = (eventsByDay.get(iso) || []).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar__day";
      button.dataset.calendarDay = iso;
      button.setAttribute("aria-pressed", "false");
      if (date.getDay() === 0 || date.getDay() === 6) {
        button.classList.add("is-weekend");
      }
      button.innerHTML = `<span class="calendar__num">${number}</span><span class="calendar__weekday">${weekdayShort
        .format(date)
        .replace(".", "")}</span>`;
      button.setAttribute(
        "aria-label",
        `${dayLabel.format(date)}, ${weekdayLabel.format(date)}${count ? `, ${count} ${pluralEvents(count)}` : ""}`,
      );
      if (count) {
        button.classList.add("has-events");
        button.addEventListener("click", () => {
          const dayInput = form.elements.day;
          dayInput.value = dayInput.value === iso ? "" : iso;
          applyFilters();
        });
      } else {
        button.disabled = true;
      }
      calendarButtons.push(button);
      fragment.append(button);
    }
    calendarGrid.replaceChildren(fragment);

    const calendarPrev = document.getElementById("calendar-prev");
    const calendarNext = document.getElementById("calendar-next");
    const calendarScroller = calendarGrid.closest(".calendar__scroller");
    const updateCalendarArrows = () => {
      const maxScroll = calendarGrid.scrollWidth - calendarGrid.clientWidth;
      const isEnd = maxScroll <= 4 || calendarGrid.scrollLeft >= maxScroll - 4;
      if (calendarPrev) {
        calendarPrev.hidden = calendarGrid.scrollLeft <= 4;
      }
      if (calendarNext) {
        calendarNext.hidden = maxScroll <= 4;
        calendarNext.disabled = isEnd && maxScroll > 4;
      }
      calendarScroller?.classList.toggle(
        "is-scrolled",
        calendarGrid.scrollLeft > 4,
      );
      calendarScroller?.classList.toggle("is-end", isEnd);
      calendarScroller?.classList.toggle("is-static", maxScroll <= 4);
    };
    const scrollCalendar = (direction) => {
      const step = Math.max(220, Math.round(calendarGrid.clientWidth * 0.72));
      calendarGrid.scrollBy({ left: direction * step, behavior: "smooth" });
    };

    calendarPrev?.addEventListener("click", () => scrollCalendar(-1));
    calendarNext?.addEventListener("click", () => scrollCalendar(1));
    calendarGrid.addEventListener("scroll", updateCalendarArrows, {
      passive: true,
    });
    window.addEventListener("resize", updateCalendarArrows);
    window.requestAnimationFrame(() => {
      const firstEvent = calendarGrid.querySelector(".has-events");
      if (firstEvent) {
        const gridBounds = calendarGrid.getBoundingClientRect();
        const firstBounds = firstEvent.getBoundingClientRect();
        const firstIsVisible =
          firstBounds.left >= gridBounds.left + 4 &&
          firstBounds.right <= gridBounds.right - 4;
        if (!firstIsVisible) {
          const offset = firstBounds.left - gridBounds.left + calendarGrid.scrollLeft;
          const previousBehavior = calendarGrid.style.scrollBehavior;
          calendarGrid.style.scrollBehavior = "auto";
          calendarGrid.scrollLeft = Math.max(0, offset - 46);
          calendarGrid.style.scrollBehavior = previousBehavior;
        }
      }
      updateCalendarArrows();
    });
    document.fonts?.ready.then(updateCalendarArrows).catch(() => {});
  }

  function syncCalendar(day) {
    for (const button of calendarButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.calendarDay === day),
      );
    }
    if (calendarReset) calendarReset.hidden = !day;
    if (!calendarStatus) return;
    if (!day) {
      calendarStatus.textContent = calendarDefaultStatus;
      return;
    }
    const list = eventsByDay.get(day) || [];
    calendarStatus.textContent = `${dayLabel.format(new Date(`${day}T00:00:00`))} — ${list.length} ${pluralEvents(list.length)}. Нажмите на день ещё раз, чтобы снять фильтр.`;
  }

  calendarReset?.addEventListener("click", () => {
    if (form.elements.day) form.elements.day.value = "";
    applyFilters();
  });

  function applyFilters() {
    const { search, category, date, price, sort, day } = currentFilters();
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
        (!day || event.date === day) &&
        priceMatches;
      (card.closest("[data-card-wrapper]") || card).hidden = !visible;
      if (visible) count += 1;
    }

    for (const chip of chips) {
      const active = chip.dataset.categoryChip === category;
      chip.setAttribute("aria-pressed", String(active));
    }

    syncCalendar(day);
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
  form.addEventListener("reset", () => {
    /* Скрытый input не сбрасывается нативным reset — чистим вручную. */
    if (form.elements.day) form.elements.day.value = "";
    window.requestAnimationFrame(applyFilters);
  });
  sortSelect?.addEventListener("change", applyFilters);
  applyFilters();
}

/* ---------- Страница события ---------- */

function initEventPage() {
  if (!document.getElementById("event-page")) return;

  const event = selectedEvent || events[0];
  const favButton = document.getElementById("event-fav");
  if (favButton) favButton.dataset.fav = event.id;
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

/* ---------- Тема ---------- */

function syncThemeControls(theme) {
  const dark = theme === "dark";
  for (const button of document.querySelectorAll("[data-theme-toggle]")) {
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute(
      "aria-label",
      dark ? "Включить светлую тему" : "Включить тёмную тему",
    );
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0e0f14" : "#14151c");
}

let currentTheme =
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";
let themeTransition = null;

function applyTheme(theme, animate, origin) {
  const root = document.documentElement;
  currentTheme = theme;
  const change = () => {
    /* Если пользователь успел переключить тему ещё раз — не перебиваем. */
    if (currentTheme !== theme) return;
    root.dataset.theme = theme;
    syncThemeControls(theme);
    try {
      localStorage.setItem("vne-doma:theme", theme);
    } catch {
      /* приватный режим — тема просто не запомнится */
    }
  };

  if (themeTransition) {
    themeTransition.skipTransition();
    themeTransition = null;
  }

  if (!animate) {
    root.classList.remove("is-theme-changing");
    change();
    return;
  }

  if (origin) {
    root.style.setProperty("--theme-x", `${origin.x}px`);
    root.style.setProperty("--theme-y", `${origin.y}px`);
  }

  if (document.startViewTransition) {
    try {
      const transition = document.startViewTransition(change);
      themeTransition = transition;
      transition.ready.catch(() => {});
      transition.updateCallbackDone.catch(() => {});
      transition.finished
        .catch(() => {})
        .finally(() => {
          if (themeTransition === transition) themeTransition = null;
        });
      return;
    } catch {
      /* если браузер отказал — ниже сработает обычный переход */
    }
  }

  root.classList.add("is-theme-changing");
  void root.offsetWidth;
  change();
  window.setTimeout(() => root.classList.remove("is-theme-changing"), 480);
}

function initTheme() {
  const current =
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  syncThemeControls(current);
  for (const button of document.querySelectorAll("[data-theme-toggle]")) {
    button.addEventListener("click", () => {
      const next = currentTheme === "dark" ? "light" : "dark";
      const rect = button.getBoundingClientRect();
      applyTheme(next, true, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    });
  }
}

/* ---------- Избранное ---------- */

function syncFavoriteButtons() {
  const favorites = new Set(getFavorites());
  for (const node of document.querySelectorAll("[data-favorites-count]")) {
    node.textContent = String(favorites.size);
    node.hidden = favorites.size === 0;
  }
  for (const button of document.querySelectorAll("[data-fav]")) {
    const id = button.dataset.fav;
    const active = favorites.has(id);
    button.setAttribute("aria-pressed", String(active));
    const event = eventById.get(id);
    const title = event ? `«${event.title}»` : "событие";
    button.setAttribute(
      "aria-label",
      active ? `Убрать ${title} из избранного` : `Добавить ${title} в избранное`,
    );
    button.title = active ? "Убрать из избранного" : "В избранное";
    const label = button.querySelector(":scope > span");
    if (label) label.textContent = active ? "В избранном" : "В избранное";
  }
}

function renderFavoritesPage() {
  const grid = document.getElementById("favorites-grid");
  if (!grid) return;
  const list = getFavorites()
    .map((id) => eventById.get(id))
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
  renderCards(grid, list);
  const empty = document.getElementById("favorites-empty");
  const count = document.getElementById("favorites-count");
  if (empty) empty.hidden = list.length > 0;
  if (count) {
    count.textContent = `${list.length} ${pluralEvents(list.length)}`;
  }
}

function initFavorites() {
  syncFavoriteButtons();
  renderFavoritesPage();

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fav]");
    if (!button) return;
    event.preventDefault();
    const active = toggleFavorite(button.dataset.fav);
    syncFavoriteButtons();
    renderFavoritesPage();
    if (button.isConnected) {
      button.classList.add("is-popping");
      window.setTimeout(() => button.classList.remove("is-popping"), 400);
    }
    showToast(active ? "Добавлено в избранное" : "Убрано из избранного");
  });
}

/* ---------- Тост ---------- */

let toastTimer;

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  toast.textContent = message;
  void toast.offsetWidth;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => toast.classList.remove("is-visible"),
    2600,
  );
}

/* ---------- Поделиться ---------- */

async function shareEvent(event) {
  if (!event) return;
  const url = new URL(`product.html?event=${event.id}`, window.location.href);
  const data = {
    title: `${event.title} — Вне дома`,
    text: `${event.displayDate}, ${event.time} · ${event.venue}`,
    url: url.href,
  };

  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(url.href);
    showToast("Ссылка на событие скопирована");
  } catch {
    window.prompt("Скопируйте ссылку на событие:", url.href);
  }
}

function initShare() {
  for (const button of document.querySelectorAll("[data-share-event]")) {
    button.addEventListener("click", () => shareEvent(selectedEvent || events[0]));
  }
}

/* ---------- Отзывы и оценки ---------- */

const seededReviews = {
  "blue-hour": [
    {
      id: "seed-blue-1",
      name: "Марина",
      rating: 5,
      date: "2027-03-14",
      text: "Были в пятницу: звук плотный, свет мягкий, а финальный джем не отпускал ещё минут десять. Для камерного зала — идеально.",
    },
    {
      id: "seed-blue-2",
      name: "Илья",
      rating: 4,
      date: "2027-03-15",
      text: "Атмосфера отличная, но гардероб работал медленно. Музыка всё компенсировала.",
    },
  ],
  "quiet-jazz": [
    {
      id: "seed-jazz-1",
      name: "Софья",
      rating: 5,
      date: "2027-03-15",
      text: "Тихий джаз — ровно то, что нужно после рабочей недели. Слышно каждую ноту, никто не разговаривает.",
    },
  ],
  ophelia: [
    {
      id: "seed-ophelia-1",
      name: "Кирилл",
      rating: 4,
      date: "2027-03-18",
      text: "Визуально очень красиво, особенно сцена с зеркалами. Хотелось бы чуть больше музыки во второй половине.",
    },
  ],
  "between-lines": [
    {
      id: "seed-lines-1",
      name: "Ольга",
      rating: 5,
      date: "2027-03-20",
      text: "Спектакль держит внимание с первой минуты. Два актёра и одно письмо — а зал сидел не дыша.",
    },
  ],
  "new-optics": [
    {
      id: "seed-optics-1",
      name: "Артём",
      rating: 4,
      date: "2027-03-21",
      text: "Много света и воздуха, отличные крупные работы. В выходной лучше приходить к открытию — ближе к вечеру многолюдно.",
    },
  ],
  clay: [
    {
      id: "seed-clay-1",
      name: "Ника",
      rating: 5,
      date: "2027-03-22",
      text: "Первый раз работала с глиной, и сразу получилась ваза. Мастер всё показывает и помогает, материалы включены.",
    },
  ],
  "quiet-light": [
    {
      id: "seed-light-1",
      name: "Женя",
      rating: 5,
      date: "2027-03-23",
      text: "Выставка-медитация: ходишь между световыми комнатами и правда выдыхаешь. Взяла билет на вечер и не пожалела.",
    },
  ],
  texture: [
    {
      id: "seed-texture-1",
      name: "Алиса",
      rating: 4,
      date: "2027-03-25",
      text: "Много фактур и неожиданных сочетаний глазури. Хотелось больше времени на практику, но за два часа успели много.",
    },
  ],
  film: [
    {
      id: "seed-film-1",
      name: "Денис",
      rating: 4,
      date: "2027-03-27",
      text: "Уютный зал, хорошая подборка короткого метра. После показа было обсуждение с режиссёром — это лучшая часть вечера.",
    },
  ],
  "silent-film": [
    {
      id: "seed-silent-1",
      name: "Павел",
      rating: 5,
      date: "2027-03-28",
      text: "Оркестр вживую поверх немого кино — совсем другое ощущение. Звук и картинка совпали идеально.",
    },
  ],
  market: [
    {
      id: "seed-market-1",
      name: "Лена",
      rating: 5,
      date: "2027-03-29",
      text: "Пришла за сыром, ушла с сумкой всего. Очень приятные продавцы и живая музыка на площади.",
    },
  ],
  "vintage-market": [
    {
      id: "seed-vintage-1",
      name: "Рита",
      rating: 4,
      date: "2027-03-30",
      text: "Нашла пластинку, о которой давно мечтала. Хотелось бы больше точек с одеждой, но атмосфера отличная.",
    },
  ],
};

function getEventReviews(eventId) {
  const all = readStored(REVIEWS_KEY, {});
  const local = Array.isArray(all[eventId]) ? all[eventId] : [];
  return [...(seededReviews[eventId] || []), ...local];
}

function addEventReview(eventId, review) {
  const all = readStored(REVIEWS_KEY, {});
  all[eventId] = [...(Array.isArray(all[eventId]) ? all[eventId] : []), review];
  writeStored(REVIEWS_KEY, all);
}

function starIcon(empty) {
  return `<svg viewBox="0 0 24 24" class="${empty ? "star--empty" : ""}" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" /></svg>`;
}

function starsMarkup(rating) {
  return Array.from(
    { length: 5 },
    (_, index) => starIcon(index + 1 > Math.round(rating)),
  ).join("");
}

function formatReviewDate(iso) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${iso}T00:00:00`));
  } catch {
    return iso;
  }
}

function reviewCardMarkup(review) {
  const initial = String(review.name || "Г").trim().charAt(0).toUpperCase();
  return `
    <article class="review-card">
      <div class="review-card__top">
        <span class="review-card__avatar" aria-hidden="true">${escapeHtml(initial)}</span>
        <div class="review-card__who">
          <span class="review-card__name">${escapeHtml(review.name)}</span>
          <span class="review-card__date">${escapeHtml(formatReviewDate(review.date))}</span>
        </div>
        <div class="stars" role="img" aria-label="Оценка ${review.rating} из 5">${starsMarkup(review.rating)}</div>
      </div>
      <p>${escapeHtml(review.text)}</p>
    </article>`;
}

function renderReviews(event) {
  const list = getEventReviews(event.id);
  const average = list.length
    ? list.reduce((sum, review) => sum + Number(review.rating), 0) / list.length
    : 0;

  const averageNode = document.getElementById("reviews-average");
  const starsNode = document.getElementById("reviews-stars");
  const countNode = document.getElementById("reviews-count");
  const listNode = document.getElementById("reviews-list");
  if (!listNode) return;

  if (averageNode) {
    averageNode.textContent = list.length
      ? average.toFixed(1).replace(".", ",")
      : "—";
  }
  if (starsNode) starsNode.innerHTML = starsMarkup(average);
  if (countNode) {
    countNode.textContent = list.length
      ? `${list.length} ${pluralReviews(list.length)} · средняя оценка`
      : "Пока нет оценок — станьте первым";
  }
  listNode.innerHTML = list.length
    ? list.map(reviewCardMarkup).join("")
    : `<p class="reviews__empty">Отзывов пока нет. Расскажите, как прошло событие, — это займёт минуту.</p>`;
}

function initReviews() {
  const form = document.getElementById("review-form");
  if (!form) return;
  const event = selectedEvent || events[0];
  const status = form.querySelector("[role=status]");
  const hint = document.getElementById("rating-hint");
  const nameField = form.elements.name;
  const textField = form.elements.text;

  renderReviews(event);

  for (const input of form.querySelectorAll('input[name="rating"]')) {
    input.addEventListener("change", () => {
      if (hint) hint.textContent = `Оценка: ${input.value} из 5`;
    });
  }

  form.addEventListener("submit", (submitEvent) => {
    submitEvent.preventDefault();
    nameField.setCustomValidity(
      nameField.value.trim().length < 2 ? "Укажите имя — хотя бы 2 буквы." : "",
    );
    textField.setCustomValidity(
      textField.value.trim().length < 10
        ? "Расскажите чуть подробнее — минимум 10 символов."
        : "",
    );
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const review = {
      id: `local-${Date.now()}`,
      name: String(data.get("name")).trim().slice(0, 40),
      rating: Number(data.get("rating")),
      text: String(data.get("text")).trim().slice(0, 600),
      date: event.date,
    };
    addEventReview(event.id, review);
    renderReviews(event);

    form.reset();
    nameField.setCustomValidity("");
    textField.setCustomValidity("");
    if (hint) hint.textContent = "Нажмите на звезду";
    if (status) {
      status.textContent =
        "Спасибо! Отзыв сохранён в этом браузере — сайт работает без сервера.";
      status.hidden = false;
      status.focus();
    }
    showToast("Спасибо за отзыв!");
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
initTheme();
initReviews();
initFavorites();
initShare();
updateOrderSummary();
