export function initializeClosedDialog(dialog) {
  if (!dialog) return dialog;
  if (dialog.open) dialog.close();
  dialog.removeAttribute?.("open");
  return dialog;
}

export function bindDialog(dialog, { opener, onClose } = {}) {
  if (!dialog) return { open() {}, close() {}, isOpen: () => false };
  initializeClosedDialog(dialog);
  let previous = null;
  dialog.querySelectorAll("[data-close]").forEach((node) => {
    node.addEventListener("click", () => dialog.close());
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter((node) => !node.disabled && node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("close", () => {
    onClose?.();
    syncOverlayLock();
    previous?.focus?.();
    previous = null;
  });
  opener?.addEventListener("click", () => open(opener));
  function open(from) {
    if (!dialog.open) previous = from || document.activeElement;
    applyDialogLayout(dialog);
    if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    syncOverlayLock();
    const focusFirst = () => (
      dialog.querySelector("[data-initial-focus]")
      || dialog.querySelector("input, textarea, select, button:not([data-close])")
      || dialog.querySelector("button")
    )?.focus();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(focusFirst);
    else focusFirst();
  }
  return { open, close: () => dialog.close(), isOpen: () => Boolean(dialog.open) };
}

export function applyDialogLayout(dialog, media = globalThis.matchMedia) {
  if (!dialog?.classList?.toggle) return dialog;
  const mobile = typeof media === "function" && Boolean(media("(max-width: 768px)")?.matches);
  dialog.classList.toggle("is-fullscreen", mobile);
  return dialog;
}

export function syncOverlayLock() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("dialog[open]").forEach((dialog) => applyDialogLayout(dialog));
  const locked = Boolean(document.querySelector("dialog[open], .drawer-backdrop"));
  document.body?.classList.toggle("overlay-open", locked);
  document.body?.classList.toggle("modal-open", locked);
}
