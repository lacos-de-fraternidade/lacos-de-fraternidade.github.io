import test from "node:test";
import assert from "node:assert/strict";

const enabled = process.env.AUTH_INTEGRATION === "1";
const base = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

test("bateria de integração exige AUTH_INTEGRATION=1 e não usa dados reais", { skip: !enabled }, async () => {
  assert.ok(base && anon, "Defina SUPABASE_URL e SUPABASE_ANON_KEY de um projeto de teste.");
  const unauth = await fetch(`${base}/functions/v1/gerenciar-irmao`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "listar", perfil: "administrador" }),
  });
  assert.notEqual(unauth.status, 200);

  const expired = await fetch(`${base}/functions/v1/gerenciar-irmao`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxfQ.invalid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ acao: "listar" }),
  });
  assert.notEqual(expired.status, 200);
});
