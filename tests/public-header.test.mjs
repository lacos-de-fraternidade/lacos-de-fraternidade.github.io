import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "sobre.html", "interesse.html", "confirmacao.html", "privacidade.html"];

function navLabels(html, ariaLabel) {
  const start = html.indexOf(`aria-label="${ariaLabel}"`);
  assert.notEqual(start, -1, `navegação ${ariaLabel} ausente`);
  const chunk = html.slice(start, html.indexOf("</nav>", start));
  return [...chunk.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
  );
}

test("o header público mostra Área dos Irmãos depois do cadastro e antes do Instagram", () => {
  const styles = readFileSync(join(root, "styles.css"), "utf8");
  assert.match(styles, /\.nav-cta-secondary/);
  pages.forEach((page) => {
    const html = readFileSync(join(root, page), "utf8");
    const desktop = navLabels(html, "Principal");
    const cadastro = desktop.indexOf("Cadastro do candidato");
    const area = desktop.indexOf("Área dos Irmãos");
    const instagram = desktop.indexOf("Instagram");
    assert.ok(cadastro >= 0 && area === cadastro + 1 && instagram === area + 1, page);
    assert.match(html, /href="area-restrita\/login\/"[^>]*aria-label="Acessar a Área dos Irmãos"/);
    assert.match(html, /<footer[\s\S]*href="area-restrita\/login\/">Área dos Irmãos<\/a>/);
  });
});

test("o menu móvel inclui Área dos Irmãos na mesma ordem e fecha pelos links existentes", () => {
  const site = readFileSync(join(root, "site.js"), "utf8");
  assert.match(site, /event\.target\.closest\("a"\)/);
  pages.forEach((page) => {
    const html = readFileSync(join(root, page), "utf8");
    const mobile = navLabels(html, "Menu móvel");
    const cadastro = mobile.indexOf("Cadastro do candidato");
    const area = mobile.indexOf("Área dos Irmãos");
    const instagram = mobile.indexOf("Instagram");
    assert.ok(cadastro >= 0 && area === cadastro + 1, page);
    assert.ok(instagram > area, page);
  });
});
