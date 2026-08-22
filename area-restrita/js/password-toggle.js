export const EYE_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12S6.2 6.5 12 6.5 21.2 12 21.2 12 17.8 17.5 12 17.5 2.8 12 2.8 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
export const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M10.4 7.1A8.6 8.6 0 0 1 12 6.5C17.8 6.5 21.2 12 21.2 12a14.8 14.8 0 0 1-3.3 3.8M7.2 7.9C4.6 9.4 2.8 12 2.8 12a14.7 14.7 0 0 0 7.6 5.2c.5.1 1 .2 1.6.2 1.3 0 2.5-.3 3.6-.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

export function bindPasswordToggle(input, button) {
  if (!input || !button) return;
  const sync = () => {
    const hidden = input.type === "password";
    button.innerHTML = hidden ? EYE_OPEN : EYE_OFF;
    button.setAttribute("aria-label", hidden ? "Mostrar senha" : "Ocultar senha");
    button.setAttribute("aria-pressed", hidden ? "false" : "true");
  };
  sync();
  button.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
    sync();
  });
}
