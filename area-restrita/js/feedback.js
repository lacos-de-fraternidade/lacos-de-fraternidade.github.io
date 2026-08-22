const ICONS = {
  success: "✓",
  error: "!",
  warning: "!",
  info: "i",
};

export const TOAST_DEFAULT_DURATION = 4000;

export function createToastStore() {
  const items = [];
  let seq = 0;
  return {
    show(input) {
      const toast = {
        id: `toast-${seq += 1}`,
        type: input.type || "info",
        message: String(input.message || ""),
        duration: input.duration ?? TOAST_DEFAULT_DURATION,
        closed: false,
        createdAt: input.now || 0,
      };
      items.push(toast);
      return toast;
    },
    close(id) {
      const toast = items.find((item) => item.id === id);
      if (toast) toast.closed = true;
      return toast;
    },
    expire(now) {
      items.forEach((item) => {
        if (!item.closed && item.duration > 0 && now - item.createdAt >= item.duration) {
          item.closed = true;
        }
      });
      return this.visible();
    },
    visible() {
      return items.filter((item) => !item.closed);
    },
    clear() {
      items.forEach((item) => { item.closed = true; });
    },
  };
}

const store = createToastStore();
const timers = new Map();

function root() {
  let node = document.querySelector("#toast-root");
  if (!node) {
    node = document.createElement("div");
    node.id = "toast-root";
    node.className = "toast-root";
    node.setAttribute("aria-live", "polite");
    document.body.append(node);
  }
  return node;
}

function renderToast(toast) {
  const node = document.createElement("div");
  node.className = `toast toast-${toast.type}`;
  node.dataset.toastId = toast.id;
  node.setAttribute("role", toast.type === "error" ? "alert" : "status");
  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = ICONS[toast.type] || ICONS.info;
  const text = document.createElement("p");
  text.textContent = toast.message;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Fechar");
  close.textContent = "×";
  close.addEventListener("click", () => hideToast(toast.id));
  node.append(icon, text, close);
  return node;
}

function hideToast(id) {
  store.close(id);
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  document.querySelector(`[data-toast-id="${id}"]`)?.remove();
}

export function showToast({ type = "info", message, duration = TOAST_DEFAULT_DURATION } = {}) {
  if (typeof document === "undefined") {
    return store.show({ type, message, duration, now: Date.now() });
  }
  const toast = store.show({ type, message, duration, now: Date.now() });
  root().append(renderToast(toast));
  if (duration > 0) {
    timers.set(toast.id, setTimeout(() => hideToast(toast.id), duration));
  }
  return toast;
}

export function clearToasts() {
  store.visible().forEach((item) => hideToast(item.id));
  store.clear();
}

export function beginSubmit(button, label = "Salvando...") {
  if (!button || button.dataset.busy === "1") return false;
  button.dataset.busy = "1";
  button.disabled = true;
  button.classList?.add("is-busy");
  button.dataset.label = button.textContent;
  button.textContent = label;
  return true;
}

export function endSubmit(button) {
  if (!button) return;
  button.dataset.busy = "0";
  button.disabled = false;
  button.classList?.remove("is-busy");
  button.textContent = button.dataset.label || button.textContent;
}

export async function withBusy(button, task, label) {
  if (!beginSubmit(button, label)) return { skipped: true };
  try {
    return await task();
  } finally {
    endSubmit(button);
  }
}
