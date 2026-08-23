export const MOBILE_LAYOUT_QUERY = "(max-width: 768px)";
export const NARROW_LAYOUT_QUERY = "(max-width: 480px)";

export function isMobileLayout(media = globalThis.matchMedia) {
  if (typeof media !== "function") return false;
  return Boolean(media(MOBILE_LAYOUT_QUERY).matches);
}

export function isNarrowLayout(media = globalThis.matchMedia) {
  if (typeof media !== "function") return false;
  return Boolean(media(NARROW_LAYOUT_QUERY).matches);
}

export function adminNavState({ mobile, open = false } = {}) {
  return {
    showTrigger: Boolean(mobile),
    tabBarHidden: Boolean(mobile && !open),
    showTabBar: !mobile || Boolean(open),
  };
}

export function applyDocumentLayout(root = globalThis.document?.documentElement, media = globalThis.matchMedia) {
  if (!root) return adminNavState({ mobile: false });
  const mobile = isMobileLayout(media);
  root.classList.toggle("layout-mobile", mobile);
  root.classList.toggle("layout-desktop", !mobile);
  root.classList.toggle("layout-narrow", isNarrowLayout(media));
  return adminNavState({ mobile, open: false });
}

export function bindLayoutMode(onChange, media = globalThis.matchMedia) {
  if (typeof media !== "function") return () => {};
  const mq = media(MOBILE_LAYOUT_QUERY);
  const apply = () => {
    applyDocumentLayout(globalThis.document?.documentElement, media);
    onChange?.(mq.matches);
  };
  if (typeof mq.addEventListener === "function") mq.addEventListener("change", apply);
  else mq.addListener?.(apply);
  apply();
  return apply;
}
