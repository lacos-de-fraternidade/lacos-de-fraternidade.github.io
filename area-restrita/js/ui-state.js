export function showSkeleton(node, lines = 3) {
  node.replaceChildren();
  const wrap = document.createElement("div");
  wrap.className = "skeleton-stack";
  wrap.setAttribute("aria-busy", "true");
  for (let i = 0; i < lines; i += 1) {
    const bar = document.createElement("div");
    bar.className = "skeleton";
    wrap.append(bar);
  }
  node.append(wrap);
}

export function showEmpty(node, message, options = {}) {
  node.replaceChildren();
  const wrap = document.createElement("div");
  wrap.className = options.compact ? "empty-elegant empty-state-compact" : "empty-elegant";
  if (options.icon) {
    const img = document.createElement("img");
    img.src = options.icon;
    img.alt = "";
    img.width = 22;
    img.height = 22;
    wrap.append(img);
  }
  const p = document.createElement("p");
  p.className = "empty-state";
  p.textContent = message;
  wrap.append(p);
  if (options.action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-secondary";
    button.textContent = options.action.label;
    button.addEventListener("click", options.action.onClick);
    wrap.append(button);
  }
  node.append(wrap);
}

export function showError(node, onRetry) {
  node.replaceChildren();
  const wrap = document.createElement("div");
  wrap.className = "error-state";
  const p = document.createElement("p");
  p.textContent = "Não foi possível carregar os dados neste momento. Tente novamente.";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-secondary";
  button.textContent = "Tentar novamente";
  button.addEventListener("click", onRetry);
  wrap.append(p, button);
  node.append(wrap);
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
