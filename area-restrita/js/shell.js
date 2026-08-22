export function memberNavItems(prefix = "") {
  const home = prefix || "./";
  return [
    { href: home, label: "Início" },
    { href: `${prefix}aniversarios/`, label: "Aniversários" },
    { href: `${prefix}iniciacoes/`, label: "Datas Maçônicas" },
    { href: `${prefix}calendario/`, label: "Calendário" },
  ];
}

export function adminNavItems(profile, prefix = "") {
  if (profile?.perfil !== "secretario" && profile?.perfil !== "administrador") return [];
  const items = [
    { href: `${prefix}gestao/`, label: "Gestão de Irmãos" },
    { href: `${prefix}gestao/?aba=eventos`, label: "Eventos" },
    { href: `${prefix}gestao/?aba=comunicados`, label: "Comunicados" },
    { href: `${prefix}convites/`, label: "Convites" },
  ];
  if (profile.perfil === "administrador") {
    items.push({ href: `${prefix}logs/`, label: "Logs" });
    items.push({ href: `${prefix}configuracoes/`, label: "Configurações" });
  }
  return items;
}

export function navItems(profile, prefix = "") {
  return [...memberNavItems(prefix), ...adminNavItems(profile, prefix)];
}

function navLinks(items, current) {
  return items.map((item) => {
    const currentAttr = current === item.label ? " aria-current=\"page\"" : "";
    return `<a href="${item.href}"${currentAttr}>${item.label}</a>`;
  }).join("");
}

function firstName(nome) {
  return String(nome || "Irmão").trim().split(/\s+/)[0];
}

export function renderShell(profile, current, fromRoot = false) {
  const prefix = fromRoot ? "" : "../";
  const asset = fromRoot ? "../assets/logo-classica.jpg" : "../../assets/logo-classica.jpg";
  const main = memberNavItems(prefix);
  const admin = adminNavItems(profile, prefix);
  const given = firstName(profile?.nome);
  const adminMenu = admin.length ? `
    <div class="nav-dropdown" data-dropdown>
      <button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true">Administração</button>
      <div class="nav-dropdown-menu" hidden>${navLinks(admin, current)}</div>
    </div>` : "";
  return `
    <header class="area-header">
      <div class="area-wrap header-inner">
        <a class="area-brand" href="${prefix || "./"}">
          <img src="${asset}" alt="" width="58" height="58" />
          <span>
            <strong>Área dos Irmãos</strong>
            <small>Laços de Fraternidade 357 nº 251</small>
          </span>
        </a>
        <nav class="area-nav-main" aria-label="Seções da Área dos Irmãos">${navLinks(main, current)}</nav>
        <div class="header-actions">
          <div class="nav-dropdown" data-dropdown>
            <button type="button" class="nav-dropdown-toggle user-toggle" aria-expanded="false" aria-haspopup="true">${given}</button>
            <div class="nav-dropdown-menu" hidden>
              <a href="${prefix}perfil/"${current === "Meu perfil" ? " aria-current=\"page\"" : ""}>Meu perfil</a>
              <button type="button" id="sair">Sair</button>
            </div>
          </div>
          ${adminMenu}
          <button class="area-nav-toggle" id="menu-toggle" type="button" aria-expanded="false" aria-controls="area-nav">Menu</button>
        </div>
        <nav class="area-nav" id="area-nav">${navLinks(main, current)}${navLinks(admin, current)}<a href="${prefix}perfil/"${current === "Meu perfil" ? " aria-current=\"page\"" : ""}>Meu perfil</a><button type="button" id="sair-mobile">Sair</button></nav>
      </div>
    </header>
  `;
}

export function renderFooter(fromRoot = false) {
  const prefix = fromRoot ? "" : "../";
  const publicPrefix = fromRoot ? "../" : "../../";
  const asset = fromRoot ? "../assets/logo-classica.jpg" : "../../assets/logo-classica.jpg";
  const year = new Date().getFullYear();
  return `
    <footer class="area-footer">
      <div class="area-wrap area-footer-grid">
        <div class="area-footer-brand">
          <img src="${asset}" alt="" width="64" height="64" />
          <div>
            <strong>Laços de Fraternidade 357 nº 251</strong>
            <span>Área dos Irmãos</span>
          </div>
        </div>
        <div class="area-footer-col">
          <h2>Navegação</h2>
          <ul>
            <li><a href="${prefix || "./"}">Início</a></li>
            <li><a href="${prefix}aniversarios/">Aniversários</a></li>
            <li><a href="${prefix}iniciacoes/">Datas Maçônicas</a></li>
            <li><a href="${prefix}calendario/">Calendário</a></li>
          </ul>
        </div>
        <div class="area-footer-col">
          <h2>Suporte</h2>
          <ul>
            <li><a href="${prefix}perfil/">Meu perfil</a></li>
            <li><a href="${publicPrefix}privacidade.html">Política de privacidade</a></li>
            <li><a href="${publicPrefix}index.html">Voltar ao site institucional</a></li>
          </ul>
        </div>
      </div>
      <div class="area-wrap area-footer-bottom">
        <p>© 2018–${year} ARLS Laços de Fraternidade 357 nº 251</p>
      </div>
    </footer>
  `;
}
