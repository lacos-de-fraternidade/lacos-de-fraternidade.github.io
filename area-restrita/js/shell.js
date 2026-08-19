export function renderShell(profile, current, fromRoot = false) {
  const prefix = fromRoot ? "" : "../";
  const asset = fromRoot ? "../assets/logo-classica.jpg" : "../../assets/logo-classica.jpg";
  const staff = profile.perfil === "secretario" || profile.perfil === "administrador";
  const admin = profile.perfil === "administrador";
  const items = [
    [prefix || "./", "Início"],
    [`${prefix}aniversarios/`, "Aniversários"],
    [`${prefix}iniciacoes/`, "Iniciações"],
    [`${prefix}calendario/`, "Calendário"],
    [`${prefix}perfil/`, "Meu perfil"],
  ];
  if (staff) {
    items.push([`${prefix}administracao/`, "Gerenciar membros"]);
    items.push([`${prefix}convites/`, "Convites"]);
    items.push([`${prefix}celebracoes/`, "Importar celebrações"]);
  }
  if (admin) {
    items.push([`${prefix}logs/`, "Logs"]);
    items.push([`${prefix}configuracoes/`, "Configurações"]);
  }
  const nav = items.map(([href, label]) => {
    const currentAttr = current === label ? " aria-current=\"page\"" : "";
    return `<a href="${href}"${currentAttr}>${label}</a>`;
  }).join("");
  return `
    <header class="area-header">
      <div class="area-wrap">
        <a class="area-brand" href="${prefix || "./"}">
          <img src="${asset}" alt="" width="48" height="48" />
          <span><strong>Área dos Irmãos</strong><small>357 nº 251</small></span>
        </a>
        <nav class="area-nav">${nav}<button type="button" id="sair">Sair</button></nav>
      </div>
    </header>
  `;
}
