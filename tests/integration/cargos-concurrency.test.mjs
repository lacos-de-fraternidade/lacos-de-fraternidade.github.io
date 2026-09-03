import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";

/**
 * Concorrência real de cargos institucionais (story 86akaedej).
 * Usa duas conexões Postgres simultâneas no stack local:
 *   127.0.0.1:54322  user/password postgres  database postgres
 * Nunca aponta para Supabase remoto.
 *
 * Detecção: tenta a porta local. Se o stack estiver fora, o teste é skipped.
 * Para falhar em vez de pular quando o local estiver down: INTEGRATION_DB=1
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
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
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

let containerName;
let localReady = false;
let skipReason = "";

async function ensureLocal() {
  const portOpen = await probePort(LOCAL_HOST, LOCAL_PORT);
  if (!portOpen) {
    skipReason = `Postgres local ${LOCAL_HOST}:${LOCAL_PORT} indisponível`;
    if (FORCE) {
      throw new Error(`${skipReason}. INTEGRATION_DB=1 exige o stack local.`);
    }
    return false;
  }
  containerName = await discoverDbContainer();
  const ping = await run("docker", [
    "exec",
    "-i",
    containerName,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-t",
    "-A",
    "-q",
    "-c",
    "select current_database();",
  ]);
  if (ping.code !== 0 || !ping.stdout.includes("postgres")) {
    skipReason = `psql local falhou no container ${containerName}: ${ping.stderr || ping.stdout}`;
    if (FORCE) throw new Error(skipReason);
    return false;
  }
  const leftover = await run("docker", [
    "exec",
    "-i",
    containerName,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
  ], `
delete from public.irmaos_autorizados where email like '86akconc%@test.local';
delete from public.irmaos where nome like '86akconc%';
delete from auth.users where email like '86akconc%@test.local';
`);
  if (leftover.code !== 0) {
    skipReason = `limpeza inicial falhou: ${leftover.stderr || leftover.stdout}`;
    if (FORCE) throw new Error(skipReason);
    return false;
  }
  localReady = true;
  return true;
}

const setupDone = ensureLocal();

function psql(sql) {
  return run("docker", [
    "exec",
    "-i",
    containerName,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-t",
    "-A",
    "-q",
  ], sql);
}

function parseJsonb(stdout) {
  const line = String(stdout || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith("{") || item.startsWith("["));
  if (!line) return null;
  return JSON.parse(line);
}

function assertNoDeadlock(result, label) {
  const text = `${result.stdout}\n${result.stderr}`;
  assert.equal(
    /deadlock detected/i.test(text),
    false,
    `${label} terminou com deadlock: ${text}`
  );
  assert.equal(result.code, 0, `${label} falhou (code ${result.code}): ${text}`);
}

function cimFromUuid(id) {
  const n = Number.parseInt(id.replace(/-/g, "").slice(0, 8), 16) % 90_000_000;
  return String(10_000_000 + n);
}

function ids(prefix) {
  const adminAuth = randomUUID();
  const aIrmao = randomUUID();
  const bIrmao = randomUUID();
  return {
    adminAuth,
    adminIrmao: randomUUID(),
    adminAcesso: randomUUID(),
    aIrmao,
    bIrmao,
    prefix,
    cimAdmin: cimFromUuid(adminAuth),
    cimA: cimFromUuid(aIrmao),
    cimB: cimFromUuid(bIrmao),
  };
}

function seedSql(s, extraCargos = "") {
  return `
begin;
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '${s.adminAuth}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '${s.prefix}-admin@test.local',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);
insert into public.irmaos (id, nome, cim, situacao, origem) values
  ('${s.adminIrmao}', '${s.prefix} Admin', '${s.cimAdmin}', 'ativo', 'teste'),
  ('${s.aIrmao}', '${s.prefix} Irmao A', '${s.cimA}', 'ativo', 'teste'),
  ('${s.bIrmao}', '${s.prefix} Irmao B', '${s.cimB}', 'ativo', 'teste');
insert into public.irmaos_autorizados (id, cim, nome, email, perfil, ativo, conta_ativada, auth_user_id, irmao_id)
values (
  '${s.adminAcesso}',
  '${s.cimAdmin}',
  '${s.prefix} Admin',
  '${s.prefix}-admin@test.local',
  'administrador',
  true,
  true,
  '${s.adminAuth}',
  '${s.adminIrmao}'
);
${extraCargos}
commit;
`;
}

function cleanupSql(s) {
  return `
delete from public.irmaos_autorizados where id = '${s.adminAcesso}';
delete from public.irmaos where id in ('${s.adminIrmao}', '${s.aIrmao}', '${s.bIrmao}');
delete from auth.users where id = '${s.adminAuth}';
`;
}

async function invariants(s) {
  const result = await psql(`
select jsonb_build_object(
  'vigentes_por_irmao', (
    select coalesce(jsonb_agg(jsonb_build_object('irmao_id', irmao_id, 'n', n)), '[]'::jsonb)
    from (
      select irmao_id, count(*)::int as n
      from public.irmaos_cargos
      where irmao_id in ('${s.aIrmao}', '${s.bIrmao}')
        and encerrado_em is null
      group by irmao_id
    ) x
  ),
  'vigentes_por_cargo', (
    select coalesce(jsonb_agg(jsonb_build_object('cargo', cargo, 'n', n)), '[]'::jsonb)
    from (
      select cargo, count(*)::int as n
      from public.irmaos_cargos
      where irmao_id in ('${s.aIrmao}', '${s.bIrmao}')
        and encerrado_em is null
      group by cargo
    ) y
  ),
  'chanceler_vigente', (
    select count(*)::int from public.irmaos_cargos
    where cargo = 'chanceler' and encerrado_em is null
      and irmao_id in ('${s.aIrmao}', '${s.bIrmao}')
  ),
  'tesoureiro_vigente', (
    select count(*)::int from public.irmaos_cargos
    where cargo = 'tesoureiro' and encerrado_em is null
      and irmao_id in ('${s.aIrmao}', '${s.bIrmao}')
  )
);
`);
  assert.equal(result.code, 0, `falha ao ler invariantes: ${result.stderr || result.stdout}`);
  return parseJsonb(result.stdout);
}

describe("cargos institucionais — concorrência local", { concurrency: 1 }, () => {
test("CONC01 disputa pelo mesmo cargo deixa no máximo um chanceler vigente", async (t) => {
  await setupDone;
  if (!localReady) {
    t.skip(skipReason);
    return;
  }
  const s = ids("86akconc1");
  try {
    const seeded = await psql(seedSql(s));
    assert.equal(seeded.code, 0, seeded.stderr || seeded.stdout);

    const [first, second] = await Promise.all([
      psql(`select public.atribuir_cargo_institucional('${s.aIrmao}', 'chanceler', '${s.adminAuth}', 'CONC01A');`),
      psql(`select public.atribuir_cargo_institucional('${s.bIrmao}', 'chanceler', '${s.adminAuth}', 'CONC01B');`),
    ]);
    assertNoDeadlock(first, "CONC01 conexão A");
    assertNoDeadlock(second, "CONC01 conexão B");

    const left = parseJsonb(first.stdout);
    const right = parseJsonb(second.stdout);
    assert.ok(left && typeof left.ok === "boolean", `CONC01 A sem jsonb: ${first.stdout}`);
    assert.ok(right && typeof right.ok === "boolean", `CONC01 B sem jsonb: ${second.stdout}`);

    const state = await invariants(s);
    assert.equal(state.chanceler_vigente, 1, `CONC01 precisa de exatamente 1 chanceler vigente: ${JSON.stringify(state)}`);
    for (const row of state.vigentes_por_irmao) {
      assert.ok(row.n <= 1, `CONC01 irmão ${row.irmao_id} ficou com ${row.n} cargos vigentes`);
    }
    for (const row of state.vigentes_por_cargo) {
      assert.ok(row.n <= 1, `CONC01 cargo ${row.cargo} ficou com ${row.n} ocupantes vigentes`);
    }
  } finally {
    if (localReady) await psql(cleanupSql(s));
  }
});

test("CONC02 cross-swap tesoureiro/chanceler não deadlock e permanece consistente", async (t) => {
  await setupDone;
  if (!localReady) {
    t.skip(skipReason);
    return;
  }
  const s = ids("86akconc2");
  try {
    const seeded = await psql(seedSql(s, `
      select public.atribuir_cargo_institucional('${s.aIrmao}', 'tesoureiro', '${s.adminAuth}', 'CONC02-seed-A');
      select public.atribuir_cargo_institucional('${s.bIrmao}', 'chanceler', '${s.adminAuth}', 'CONC02-seed-B');
    `));
    assert.equal(seeded.code, 0, seeded.stderr || seeded.stdout);

    const [first, second] = await Promise.all([
      psql(`select public.atribuir_cargo_institucional('${s.aIrmao}', 'chanceler', '${s.adminAuth}', 'CONC02A');`),
      psql(`select public.atribuir_cargo_institucional('${s.bIrmao}', 'tesoureiro', '${s.adminAuth}', 'CONC02B');`),
    ]);
    assertNoDeadlock(first, "CONC02 conexão A");
    assertNoDeadlock(second, "CONC02 conexão B");

    const state = await invariants(s);
    assert.equal(state.chanceler_vigente, 1, `CONC02 precisa de exatamente 1 chanceler vigente: ${JSON.stringify(state)}`);
    assert.equal(state.tesoureiro_vigente, 1, `CONC02 precisa de exatamente 1 tesoureiro vigente: ${JSON.stringify(state)}`);
    for (const row of state.vigentes_por_irmao) {
      assert.ok(row.n <= 1, `CONC02 irmão ${row.irmao_id} ficou com ${row.n} cargos vigentes`);
    }
    for (const row of state.vigentes_por_cargo) {
      assert.ok(row.n <= 1, `CONC02 cargo ${row.cargo} ficou com ${row.n} ocupantes vigentes`);
    }
    const currentCount = state.vigentes_por_irmao.reduce((sum, row) => sum + row.n, 0);
    assert.equal(currentCount, 2, `CONC02 deveria deixar 2 mandatos vigentes no total: ${JSON.stringify(state)}`);
  } finally {
    if (localReady) await psql(cleanupSql(s));
  }
});
});
