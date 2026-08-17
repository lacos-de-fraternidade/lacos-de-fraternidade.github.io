(function () {
  const weekdays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

  document.querySelectorAll("[data-session-date]").forEach(function (item) {
    const iso = item.getAttribute("data-session-date");
    const weekday = item.querySelector(".session-weekday");
    if (!iso || !weekday) return;
    const date = new Date(iso + "T19:30:00-03:00");
    if (Number.isNaN(date.getTime())) return;
    const label = weekdays[date.getDay()];
    weekday.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  });

  const yearTargets = document.querySelectorAll("[data-current-year]");
  const year = String(new Date().getFullYear());
  yearTargets.forEach(function (node) {
    node.textContent = year;
  });
})();

(function () {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const drawer = document.querySelector("#menu-movel");
  const backdrop = document.querySelector(".nav-backdrop");
  const closeButton = document.querySelector(".nav-close");
  if (!header || !toggle || !drawer || !backdrop) return;

  const focusableSelector = "a[href], button:not([disabled])";
  let lastFocus = null;

  function focusables() {
    return Array.prototype.slice.call(drawer.querySelectorAll(focusableSelector));
  }

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    drawer.hidden = !open;
    backdrop.hidden = !open;
    document.body.classList.toggle("nav-open", open);
    if (open) {
      lastFocus = document.activeElement;
      const items = focusables();
      if (items[0]) items[0].focus();
      return;
    }
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  toggle.addEventListener("click", function () {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  if (closeButton) {
    closeButton.addEventListener("click", function () {
      setOpen(false);
    });
  }

  backdrop.addEventListener("click", function () {
    setOpen(false);
  });

  drawer.addEventListener("click", function (event) {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", function (event) {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
