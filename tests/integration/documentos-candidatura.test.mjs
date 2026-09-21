import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import { spawn } from "node:child_process";

/**
 * Upload real contra o stack local (enviar-documento-candidatura).
 * Nunca aponta para o projeto remoto.
 */
const LOCAL_HOST = "127.0.0.1";
const LOCAL_PORT = 54322;
const FUNCTIONS_URL = "http://127.0.0.1:54321/functions/v1/enviar-documento-candidatura";
const STORAGE_URL = "http://127.0.0.1:54321/storage/v1";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const FORCE = process.env.INTEGRATION_DB === "1";
const MIN_PDF = Buffer.from("%PDF-1.1\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const MIN_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function probePort(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.on("error", () => {});
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(800, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    if (input != null) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

async function psql(sql) {
  const listed = await run("docker", ["ps", "--filter", "publish=54322", "--format", "{{.Names}}"]);
  const container = (listed.stdout.trim().split(/\r?\n/)[0]) || "supabase_db_La_os_de_Fraternidade";
  return run("docker", [
    "exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-t", "-A", "-q",
  ], sql);
}

async function upload(token, tipo, buffer, filename, mime) {
  const body = new FormData();
  body.append("token", token);
  body.append("tipo", tipo);
  body.append("arquivo", new Blob([buffer], { type: mime }), filename);
  const response = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: { apikey: ANON_KEY },
    body,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function listBucket(interesseId) {
  const response = await fetch(`${STORAGE_URL}/object/list/candidaturas-documentos`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix: interesseId + "/", limit: 100 }),
  });
  const json = await response.json().catch(() => []);
  return Array.isArray(json) ? json.map((item) => item.name) : [];
}

test("upload local: tipos obrigatórios, comprovante_residencia, alterar e sem órfãos", async (t) => {
  const portOpen = await probePort(LOCAL_HOST, LOCAL_PORT);
  if (!portOpen) {
    if (FORCE) throw new Error("Postgres local indisponível");
    t.skip("stack local indisponível");
    return;
  }

  const check = await psql("select pg_get_constraintdef(oid) from pg_constraint where conname = 'interesse_documentos_tipo_check';");
  assert.equal(check.code, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /comprovante_residencia/);

  const interesseId = randomUUID();
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const suffix = Date.now().toString(16);
  const cpf = String(Date.now()).padStart(11, "9").slice(-11);
  const insert = await psql(`
insert into public.interesse (id, nome, cpf, email, endereco, estado_civil)
values (
  '${interesseId}',
  'Candidato Teste Residencia',
  '${cpf}',
  'doc-residencia-${suffix}@test.local',
  'Rua Teste, 1',
  'solteiro'
);
insert into public.interesse_upload_token (interesse_id, token_hash, expires_at)
values ('${interesseId}', '${tokenHash}', now() + interval '30 minutes');
`);
  if (insert.code !== 0) {
    assert.fail(insert.stderr || insert.stdout);
  }

  try {
    const tipos = [
      "certidao_nascimento",
      "certidao_casamento",
      "identidade",
      "cpf",
      "titulo_eleitoral",
      "comprovante_rendimentos",
      "comprovante_residencia",
    ];
    for (const tipo of tipos) {
      const result = await upload(token, tipo, MIN_PDF, `${tipo}.pdf`, "application/pdf");
      assert.equal(result.status, 200, JSON.stringify(result.json));
      assert.equal(result.json.ok, true);
      assert.equal(result.json.tipo, tipo);
    }

    const meta = await psql(`select tipo from public.interesse_documentos where interesse_id = '${interesseId}' order by tipo;`);
    assert.equal(meta.code, 0, meta.stderr || meta.stdout);
    const savedTipos = meta.stdout.trim().split(/\r?\n/).filter(Boolean);
    assert.deepEqual(savedTipos, [...tipos].sort());

    const replaced = await upload(token, "identidade", MIN_PNG, "identidade.png", "image/png");
    assert.equal(replaced.status, 200, JSON.stringify(replaced.json));
    assert.equal(replaced.json.substituido, true);

    const objects = await listBucket(interesseId);
    const metaPaths = await psql(`select storage_path from public.interesse_documentos where interesse_id = '${interesseId}';`);
    const paths = metaPaths.stdout.trim().split(/\r?\n/).filter(Boolean).map((path) => path.split("/").pop());
    assert.equal(objects.length, paths.length);
    for (const name of objects) {
      assert.equal(paths.includes(name), true, "objeto de storage sem metadata: " + name);
    }

    const identidadePath = await psql(`select storage_path from public.interesse_documentos where interesse_id = '${interesseId}' and tipo = 'identidade';`);
    assert.match(identidadePath.stdout.trim(), /\.png$/);
  } finally {
    await psql(`delete from public.interesse where id = '${interesseId}';`);
    const leftover = await listBucket(interesseId);
    for (const name of leftover) {
      await fetch(`${STORAGE_URL}/object/candidaturas-documentos/${interesseId}/${name}`, {
        method: "DELETE",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }).catch(() => {});
    }
  }
});
