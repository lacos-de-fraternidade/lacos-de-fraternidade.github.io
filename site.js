(function () {
  const upcomingSessions = [
    { date: "2026-08-12", time: "19:30" },
    { date: "2026-08-26", time: "19:30" },
  ];

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function nthWeekday(year, monthIndex, weekday, nth) {
    const first = new Date(year, monthIndex, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, monthIndex, 1 + offset + (nth - 1) * 7);
  }

  function parseSession(item) {
    const [hours, minutes] = String(item.time || "19:30").split(":");
    const date = new Date(item.date + "T00:00:00-03:00");
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(Number(hours) || 19, Number(minutes) || 30, 0, 0);
    return date;
  }

  function nextLodgeSessions(count) {
    const today = startOfToday();
    const listed = upcomingSessions.map(parseSession).filter(function (date) {
      return date && date >= today;
    });
    if (listed.length >= count) return listed.slice(0, count);

    const generated = listed.slice();
    let year = today.getFullYear();
    let month = today.getMonth();
    while (generated.length < count) {
      [2, 4].forEach(function (nth) {
        const date = nthWeekday(year, month, 3, nth);
        date.setHours(19, 30, 0, 0);
        if (date >= today && !generated.some(function (item) { return item.getTime() === date.getTime(); })) {
          generated.push(date);
        }
      });
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return generated.slice(0, count);
  }

  function formatSession(date) {
    const weekday = date.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
    const day = date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
    const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(":", "h");
    return {
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      label: day + " — " + time,
    };
  }

  const list = document.querySelector("#session-dates");
  if (list) {
    const sessions = nextLodgeSessions(2);
    const heading = document.querySelector("#sessoes-proximas-label");
    if (heading && sessions[0]) {
      const monthLabel = sessions[0].toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
      heading.textContent = "Próximas sessões — " + monthLabel;
    }
    list.innerHTML = sessions.map(function (date) {
      const item = formatSession(date);
      return "<li><span class=\"session-weekday\">" + item.weekday + "</span><strong>" + item.label + "</strong></li>";
    }).join("");
  }

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
  const freezeTargets = document.querySelectorAll(".skip-link, .header-inner, main, .site-footer");
  let scrollY = 0;

  function focusables() {
    return Array.prototype.slice.call(drawer.querySelectorAll(focusableSelector));
  }

  function isOpen() {
    return document.body.classList.contains("menu-open");
  }

  function setFrozen(frozen) {
    freezeTargets.forEach(function (node) {
      if ("inert" in node) node.inert = frozen;
      if (frozen) node.setAttribute("aria-hidden", "true");
      else node.removeAttribute("aria-hidden");
    });
  }

  function setOpen(open) {
    if (open === isOpen()) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    backdrop.setAttribute("aria-hidden", open ? "false" : "true");
    document.documentElement.classList.toggle("menu-open", open);
    document.body.classList.toggle("menu-open", open);
    setFrozen(open);

    if (open) {
      scrollY = window.scrollY;
      document.body.style.top = "-" + scrollY + "px";
      const items = focusables();
      if (items[0]) items[0].focus();
      return;
    }

    document.body.style.top = "";
    window.scrollTo(0, scrollY);
    toggle.focus();
  }

  toggle.addEventListener("click", function () {
    setOpen(!isOpen());
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
    if (!isOpen()) return;
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

  window.addEventListener("resize", function () {
    if (window.matchMedia("(min-width: 981px)").matches) setOpen(false);
  });
})();
