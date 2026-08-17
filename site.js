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
})();
