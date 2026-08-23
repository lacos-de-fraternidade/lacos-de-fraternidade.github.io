export const GESTAO_SECTIONS = [
  { id: "irmaos", label: "Irmãos" },
  { id: "familiares", label: "Familiares" },
  { id: "casamentos", label: "Casamentos" },
  { id: "eventos", label: "Eventos", futurePage: true },
  { id: "comunicados", label: "Comunicados", futurePage: true },
  { id: "ferramentas", label: "Ferramentas de migração", extra: true },
];

export function visibleGestaoSections({ includeTools = false } = {}) {
  return GESTAO_SECTIONS.filter((section) => includeTools || !section.extra);
}

export function sectionLabel(id) {
  return GESTAO_SECTIONS.find((section) => section.id === id)?.label || id;
}

export function sectionSwitcherModel(sections, currentId, { open = false } = {}) {
  const list = sections?.length ? sections : visibleGestaoSections();
  const current = list.find((section) => section.id === currentId) || list[0];
  return {
    currentId: current?.id || "",
    currentLabel: current?.label || "",
    kicker: "Seção administrativa",
    open: Boolean(open),
    options: list.map((section) => ({
      id: section.id,
      label: section.label,
      selected: section.id === current?.id,
      futurePage: Boolean(section.futurePage),
    })),
  };
}

export function shouldHideDesktopTabs(mobile, menuOpen = false) {
  return Boolean(mobile) && !menuOpen;
}

export function nextSectionId(sections, currentId, delta) {
  const list = sections || [];
  if (!list.length) return currentId;
  const index = Math.max(0, list.findIndex((section) => section.id === currentId));
  const next = (index + delta + list.length) % list.length;
  return list[next].id;
}
