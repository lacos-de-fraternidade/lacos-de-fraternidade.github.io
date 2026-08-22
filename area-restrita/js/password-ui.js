import { inspectPassword, passwordRequirements, strengthLabel } from "./password.js";

export function bindPasswordRequirements(input, list, meterBar, meterLabel, extrasFn) {
  const render = () => {
    const extras = typeof extrasFn === "function" ? extrasFn() : {};
    const check = inspectPassword(input.value, extras);
    const requirements = passwordRequirements(input.value);
    list.replaceChildren();
    requirements.forEach((item) => {
      const li = document.createElement("li");
      li.className = item.ok ? "req-item is-ok" : "req-item";
      li.setAttribute("aria-label", `${item.label}: ${item.ok ? "atendido" : "pendente"}`);
      const mark = document.createElement("span");
      mark.className = "req-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = item.ok ? "✓" : "○";
      const text = document.createElement("span");
      text.textContent = item.label;
      li.append(mark, text);
      list.append(li);
    });
    if (meterBar) {
      meterBar.style.removeProperty("width");
      meterBar.className = `meter-bar is-score-${check.score}`;
      meterBar.parentElement?.setAttribute("data-score", String(check.score));
    }
    if (meterLabel) meterLabel.textContent = `Força da senha: ${strengthLabel(check.score)}`;
    return check;
  };
  input.addEventListener("input", render);
  render();
  return render;
}
