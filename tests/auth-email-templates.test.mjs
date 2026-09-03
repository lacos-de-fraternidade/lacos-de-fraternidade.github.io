import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const invite = read("supabase/templates/invite.html");
const recovery = read("supabase/templates/recovery.html");
const config = read("supabase/config.toml");
const interesse = read("supabase/functions/_shared/email.ts");

test("o convite e a recuperação usam a identidade do e-mail institucional", () => {
  for (const html of [invite, recovery]) {
    assert.match(html, /#f4f7fb/);
    assert.match(html, /#071a3a/);
    assert.match(html, /#123a74/);
    assert.match(html, /#06142d/);
    assert.match(html, /https:\/\/lacos-de-fraternidade\.github\.io\/assets\/logo-classica\.jpg/);
    assert.match(html, /\{\{ \.RedirectTo \}\}\?token_hash=\{\{ \.TokenHash \}\}/);
    assert.doesNotMatch(html, /\{\{ \.ConfirmationURL \}\}/);
    assert.doesNotMatch(html, /You've been invited|Accept invitation|Supabase|localhost/);
    assert.doesNotMatch(html, /token bruto|CIM completa/i);
  }
  assert.match(interesse, /logo-classica\.jpg/);
  assert.match(interesse, /#071a3a/);
});

test("os assuntos e o conteúdo do convite estão em português", () => {
  assert.match(config, /Convite para a Área dos Irmãos — Laços de Fraternidade 357 nº 251/);
  assert.match(config, /Redefinição de senha — Área dos Irmãos/);
  assert.match(invite, /Ative seu acesso à Área dos Irmãos/);
  assert.match(invite, /Ativar meu acesso/);
  assert.match(invite, /Você foi cadastrado pela Secretaria/);
  assert.match(invite, /preheader|convidado pela Secretaria/i);
  assert.match(invite, /Se o botão não funcionar/);
  assert.match(invite, /type=invite/);
  assert.match(invite, /Na próxima tela, clique em continuar/);
  assert.match(recovery, /Redefina sua senha/);
  assert.match(recovery, /Redefinir minha senha/);
  assert.match(recovery, /type=recovery/);
});
