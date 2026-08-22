import { displayPersonName } from "./vinculo.js";
import { el } from "./ui-state.js";

export function createSearchSelect({
  input,
  list,
  status,
  placeholder = "Buscar…",
  emptyText = "Nenhum registro encontrado.",
} = {}) {
  let options = [];
  let filtered = [];
  let selected = null;
  let activeIndex = -1;

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("autocomplete", "off");
  input.placeholder = placeholder;
  list.setAttribute("role", "listbox");
  list.hidden = true;

  function labelOf(option) {
    return option?.label || displayPersonName(option?.nome || "");
  }

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  function render() {
    list.replaceChildren();
    filtered.forEach((option, index) => {
      const item = el("div", index === activeIndex ? "combo-option is-active" : "combo-option", labelOf(option));
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(selected?.value === option.value));
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        choose(option);
      });
      list.append(item);
    });
    if (!filtered.length) list.append(el("div", "combo-empty", emptyText));
  }

  function open() {
    filtered = filterOptions(input.value);
    render();
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function filterOptions(query) {
    const needle = String(query || "").trim().toLocaleLowerCase("pt-BR");
    const pool = options.slice(0, needle ? options.length : Math.min(8, options.length));
    if (!needle) return pool;
    return options.filter((option) => labelOf(option).toLocaleLowerCase("pt-BR").includes(needle)).slice(0, 12);
  }

  function choose(option) {
    selected = option;
    input.value = labelOf(option);
    close();
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  input.addEventListener("focus", open);
  input.addEventListener("input", () => {
    selected = null;
    open();
  });
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (list.hidden) open();
      activeIndex = Math.min(filtered.length - 1, activeIndex + 1);
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
      render();
    } else if (event.key === "Enter") {
      if (!list.hidden && filtered[activeIndex]) {
        event.preventDefault();
        choose(filtered[activeIndex]);
      }
    } else if (event.key === "Escape") {
      close();
    }
  });

  return {
    setOptions(next) {
      options = next || [];
      if (selected && !options.some((option) => option.value === selected.value)) {
        selected = null;
        input.value = "";
      }
    },
    value() {
      return selected?.value || "";
    },
    setValue(value) {
      selected = options.find((option) => option.value === value) || null;
      input.value = selected ? labelOf(selected) : "";
    },
    clear() {
      selected = null;
      input.value = "";
      if (status) status.textContent = "";
    },
    selected() {
      return selected;
    },
  };
}
