import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../supabase/migrations/202608190006_cadastro_institucional.sql"),
  "utf8",
);

test("RLS das tabelas institucionais impede anon e limita escrita", () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.irmaos from public, anon, authenticated/);
  assert.match(sql, /grant select on table public\.irmaos to authenticated/);
  assert.equal(sql.includes("grant insert on table public.irmaos to authenticated"), false);
  assert.match(sql, /Membros ativos consultam irmaos institucionais/);
  assert.match(sql, /private\.membro_interno_ativo\(\)/);
  assert.match(sql, /autorizado_exibicao is true/);
  assert.match(sql, /Secretaria consulta familiares/);
  assert.equal(sql.includes("exibir_idade boolean not null default false"), true);
  assert.equal(sql.includes("autorizado_exibicao boolean not null default false"), true);
});

test("cadastro institucional não mistura autenticação e não inventa ano", () => {
  assert.match(sql, /auth_member_id uuid unique/);
  assert.match(sql, /idade_informada_na_importacao/);
  assert.match(sql, /Não é idade atual/);
  assert.equal(sql.includes("PHPSESSID"), false);
  assert.equal(sql.includes("password"), false);
});
