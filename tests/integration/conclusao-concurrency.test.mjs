import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createConnection } from "node:net";
import { spawn } from "node:child_process";

/**
 * Concorrência real do claim da conclusão (story 17tgmdxj77n).
 * Duas conexões Postgres locais simultâneas. Nunca aponta para produção.
 */
const LOCAL_HOST = "127.0.0.1";
const LOCAL_PORT = 54322;
const FORCE = process.env.INTEGRATION_DB === "1";

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

async function discoverDbContainer() {
  const listed = await run("docker", ["ps", "--filter", "publish=54322", "--format", "{{.Names}}"]);
  if (listed.code === 0 && listed.stdout.trim()) {
    return listed.stdout.trim().split(/\r?\n/)[0];
  }
  return "supabase_db_La_os_de_Fraternidade";
}

function sql(container, statement) {
  return run("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], statement);
}

let containerName = "";
let skipReason = "";

async function ensureLocal() {
  if (!(await probePort(LOCAL_HOST, LOCAL_PORT))) {
    skipReason = `Postgres local ${LOCAL_HOST}:${LOCAL_PORT} indisponível`;
    if (FORCE) throw new Error(`${skipReason}. INTEGRATION_DB=1 exige o stack local.`);
    return false;
  }
  containerName = await discoverDbContainer();
  const ping = await sql(containerName, "select 1;\n");
  if (ping.code !== 0) {
    skipReason = `psql local falhou: ${ping.stderr || ping.stdout}`;
    if (FORCE) throw new Error(skipReason);
    return false;
  }
  return true;
}

describe("conclusão — concorrência local", async () => {
  const ready = await ensureLocal();

  test("duas conexões simultâneas resultam em um único claim adquirido", async (t) => {
    if (!ready) {
      t.skip(skipReason);
      return;
    }

    const setup = await sql(containerName, `
      insert into public.irmaos (id, nome, cim, situacao, ativo, origem)
      values ('17190077-1111-4000-8000-000000000001', 'IRMAO CONC CLAIM', '17190078', 'ativo', true, 'teste')
      on conflict (id) do update set ativo = true, situacao = 'ativo';
      insert into public.interesse (id, nome, email, cpf, endereco, status, documentacao_completa, proponente_id)
      values ('17190077-1111-4000-8000-000000000010', 'Candidato Conc', 'conc@invalid.test', '11144477777', 'Rua Conc, 1', 'Em analise', false, '17190077-1111-4000-8000-000000000001')
      on conflict (id) do nothing;
      delete from public.interesse_upload_token where token_hash = 'hash-conc-claim';
      insert into public.interesse_upload_token (interesse_id, token_hash, expires_at)
      values ('17190077-1111-4000-8000-000000000010', 'hash-conc-claim', now() + interval '40 minutes');
    `);
    assert.equal(setup.code, 0, setup.stderr || setup.stdout);

    const [a, b] = await Promise.all([
      sql(containerName, "select resultado from public.claim_conclusao_candidatura('hash-conc-claim');\n"),
      sql(containerName, "select resultado from public.claim_conclusao_candidatura('hash-conc-claim');\n"),
    ]);
    assert.equal(a.code, 0, a.stderr);
    assert.equal(b.code, 0, b.stderr);
    const results = [a.stdout.trim(), b.stdout.trim()].sort();
    assert.deepEqual(results, ["adquirido", "em_processamento"]);

    await sql(containerName, `
      delete from public.interesse_upload_token where token_hash = 'hash-conc-claim';
      delete from public.interesse where id = '17190077-1111-4000-8000-000000000010';
      delete from public.irmaos where id = '17190077-1111-4000-8000-000000000001';
    `);
  });
});
