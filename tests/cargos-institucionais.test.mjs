import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CARGO_LABELS,
  INSTITUTIONAL_OFFICES,
  VENERAVEL_MESTRE,
  canAssignCargo,
  canManageInstitutionalOffices,
  canManageVeneravelMestre,
  cargoLabel,
  hasCapability,
  isInstitutionalOffice,
  isStaffProfile,
  isVeneravelMestreInstitucional,
  officeSelectOptions,
} from "../area-restrita/js/cargos.js";
import {
  MEMBER_PROFILES,
  authorizeGerenciarAcao,
  isAdminProfile,
} from "../area-restrita/js/perfis.js";
import { ficheActions } from "../area-restrita/js/gestao-irmaos.js";
import { navItems } from "../area-restrita/js/shell.js";
import { buildProfileView } from "../area-restrita/js/perfil-painel.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");
const sql = read("supabase/migrations/202608230001_cargos_institucionais.sql");
const cargosTs = read("supabase/functions/_shared/cargos.ts");
const staffTs = read("supabase/functions/_shared/staff-actions.ts");
const gerenciar = read("supabase/functions/gerenciar-irmao/index.ts");
const gestaoTs = read("supabase/functions/_shared/gestao.ts");
const cargosActions = read("supabase/functions/_shared/cargos-actions.ts");
const gestaoJs = read("area-restrita/gestao/gestao.js");
const guardJs = read("area-restrita/js/guard.js");
const perfisJs = read("area-restrita/js/perfis.js");

const CATALOG = [
  "veneravel_mestre",
  "primeiro_vigilante",
  "segundo_vigilante",
  "orador",
  "secretario",
  "tesoureiro",
  "chanceler",
  "hospitaleiro",
  "mestre_cerimonias",
  "primeiro_diacono",
  "segundo_diacono",
  "primeiro_experto",
  "segundo_experto",
  "cobridor_interno",
  "cobridor_externo",
  "mestre_harmonia",
  "mestre_banquetes",
];

function member(perfil, extras = {}) {
  return { ativo: true, conta_ativada: true, perfil, ...extras };
}

test("catálogo institucional v1 tem exatamente 17 cargos e labels oficiais", () => {
  assert.equal(INSTITUTIONAL_OFFICES.length, 17);
  assert.deepEqual([...INSTITUTIONAL_OFFICES], CATALOG);
  assert.equal(isInstitutionalOffice("porta_bandeira"), false);
  assert.equal(isInstitutionalOffice("veneravel"), false);
  assert.equal(cargoLabel("veneravel_mestre"), "Venerável Mestre");
  assert.equal(cargoLabel("mestre_cerimonias"), "Mestre de Cerimônias");
  assert.equal(cargoLabel(""), "Sem cargo institucional");
  assert.equal(cargoLabel(null), "Sem cargo institucional");
  for (const cargo of CATALOG) {
    assert.match(sql, new RegExp(`'${cargo}'`));
    assert.match(cargosTs, new RegExp(`"${cargo}"`));
    assert.equal(CARGO_LABELS[cargo].length > 0, true);
  }
});

test("migration impõe um cargo vigente por Irmão e um ocupante vigente por cargo", () => {
  assert.match(sql, /create unique index irmaos_cargos_irmao_vigente_key/);
  assert.match(sql, /on public\.irmaos_cargos \(irmao_id\)\s+where encerrado_em is null/);
  assert.match(sql, /create unique index irmaos_cargos_cargo_vigente_key/);
  assert.match(sql, /on public\.irmaos_cargos \(cargo\)\s+where encerrado_em is null/);
  assert.match(sql, /encerrado_em timestamptz/);
  assert.match(sql, /atribuido_por uuid references auth\.users/);
});

test("RLS de cargos não concede escrita autenticada e não enfraquece o modelo", () => {
  assert.match(sql, /alter table public\.irmaos_cargos enable row level security/);
  assert.match(sql, /revoke all on table public\.irmaos_cargos from public, anon, authenticated/);
  assert.match(sql, /grant select on table public\.irmaos_cargos to authenticated/);
  assert.equal(sql.includes("grant insert on table public.irmaos_cargos to authenticated"), false);
  assert.equal(sql.includes("grant update on table public.irmaos_cargos to authenticated"), false);
  assert.match(sql, /grant execute on function public\.atribuir_cargo_institucional\(uuid, text, uuid, text\) to service_role/);
  assert.match(sql, /revoke all on function public\.atribuir_cargo_institucional\(uuid, text, uuid, text\) from public, anon, authenticated/);
  assert.match(sql, /set search_path = public, pg_temp/);
  assert.match(sql, /security definer/);
});

test("perfis de acesso são irmao|secretario|veneravel_mestre|administrador e cargo não entra no CHECK de perfil", () => {
  assert.deepEqual([...MEMBER_PROFILES], ["irmao", "secretario", "veneravel_mestre", "administrador"]);
  assert.match(staffTs, /export const MEMBER_PROFILES = \["irmao", "secretario", "veneravel_mestre", "administrador"\]/);
  assert.match(sql, /check \(perfil in \('irmao', 'secretario', 'veneravel_mestre', 'administrador'\)\)/);
  assert.match(sql, /a\.perfil in \('secretario', 'veneravel_mestre', 'administrador'\)/);
  assert.doesNotMatch(sql, /or private\.is_veneravel_mestre_user\(p_auth_user_id\)/);
});

test("matriz de perfil: Irmão, Secretaria, Venerável e Admin", () => {
  const irmao = member("irmao");
  const secretary = member("secretario");
  const vm = member("veneravel_mestre");
  const admin = member("administrador");

  assert.equal(isStaffProfile(irmao.perfil), false);
  assert.equal(canManageInstitutionalOffices(irmao), false);
  assert.equal(canAssignCargo(irmao, "chanceler"), false);
  assert.equal(authorizeGerenciarAcao(irmao, "listar_gestao").status, 403);
  assert.equal(authorizeGerenciarAcao(irmao, "listar_eventos").status, 403);
  assert.equal(authorizeGerenciarAcao(irmao, "salvar_comunicado").status, 403);

  assert.equal(isStaffProfile(secretary.perfil), true);
  assert.equal(isAdminProfile(secretary.perfil), false);
  assert.equal(canAssignCargo(secretary, "chanceler"), true);
  assert.equal(canAssignCargo(secretary, VENERAVEL_MESTRE), false);
  assert.equal(canManageVeneravelMestre(secretary), false);
  assert.equal(authorizeGerenciarAcao(secretary, "listar_gestao").ok, true);
  assert.equal(authorizeGerenciarAcao(secretary, "listar_eventos").ok, true);
  assert.equal(authorizeGerenciarAcao(secretary, "alterar_perfil").ok, false);
  assert.equal(hasCapability(secretary, "decidir_ordem_do_dia"), false);

  assert.equal(isStaffProfile(vm.perfil), true);
  assert.equal(isAdminProfile(vm.perfil), false);
  assert.equal(canAssignCargo(vm, "tesoureiro"), true);
  assert.equal(canAssignCargo(vm, VENERAVEL_MESTRE), false);
  assert.equal(canManageVeneravelMestre(vm), false);
  assert.equal(authorizeGerenciarAcao(vm, "listar_gestao").ok, true);
  assert.equal(authorizeGerenciarAcao(vm, "listar_historico").ok, true);
  assert.equal(authorizeGerenciarAcao(vm, "listar_eventos").ok, true);
  assert.equal(authorizeGerenciarAcao(vm, "salvar_comunicado").ok, true);
  assert.equal(authorizeGerenciarAcao(vm, "enviar_convite").ok, true);
  assert.equal(authorizeGerenciarAcao(vm, "alterar_perfil").ok, false);
  assert.equal(authorizeGerenciarAcao(vm, "logs").ok, false);
  assert.equal(authorizeGerenciarAcao(vm, "excluir_irmao").ok, false);
  assert.equal(hasCapability(vm, "decidir_ordem_do_dia"), true);

  assert.equal(isStaffProfile(admin.perfil), true);
  assert.equal(isAdminProfile(admin.perfil), true);
  assert.equal(canAssignCargo(admin, "orador"), true);
  assert.equal(canAssignCargo(admin, VENERAVEL_MESTRE), true);
  assert.equal(authorizeGerenciarAcao(admin, "logs").ok, true);
  assert.equal(authorizeGerenciarAcao(admin, "excluir_irmao").ok, true);
  assert.equal(hasCapability(admin, "decidir_ordem_do_dia"), false);
});

test("perfil e cargo são entidades independentes", () => {
  const vmProfileVmCargo = member("veneravel_mestre");
  const vmProfileOtherCargo = member("veneravel_mestre");
  const secretaryWithVmCargo = member("secretario");
  const irmaoWithVmCargo = member("irmao");

  assert.equal(isStaffProfile(vmProfileVmCargo.perfil), true);
  assert.equal(isVeneravelMestreInstitucional({ cargoVigente: "veneravel_mestre", situacao: "ativo" }), true);
  assert.equal(isStaffProfile(vmProfileOtherCargo.perfil), true);
  assert.equal(isStaffProfile(secretaryWithVmCargo.perfil), true);
  assert.equal(canAssignCargo(secretaryWithVmCargo, VENERAVEL_MESTRE), false);
  assert.equal(isStaffProfile(irmaoWithVmCargo.perfil), false);
  assert.equal(canManageInstitutionalOffices(irmaoWithVmCargo), false);
  assert.equal(authorizeGerenciarAcao(irmaoWithVmCargo, "listar_gestao").status, 403);
  assert.equal(isVeneravelMestreInstitucional({ cargoVigente: "veneravel_mestre", situacao: null }), false);
  assert.equal(isVeneravelMestreInstitucional({ cargoVigente: "veneravel_mestre" }), false);
  assert.match(sql, /left join public\.irmaos_autorizados a on a\.irmao_id = i\.id/);
  assert.match(sql, /limit 1/);
});

test("Venerável de perfil herda Secretaria e não herda Admin", () => {
  const vm = { perfil: "veneravel_mestre", cargo_institucional: "orador", situacao: "ativo", ativo: true, conta_ativada: true };
  assert.equal(isStaffProfile(vm.perfil), true);
  assert.deepEqual(ficheActions({ irmao_id: "1", acesso_id: "a1" }, vm).map((item) => item.id), [
    "editar_cadastro",
    "configurar_acesso",
    "registrar_movimentacao",
  ]);
  const items = navItems(vm, "../").map((item) => item.label);
  assert.equal(items.includes("Gestão de Irmãos"), true);
  assert.equal(items.includes("Convites"), true);
  assert.equal(items.includes("Eventos"), true);
  assert.equal(items.includes("Comunicados"), true);
  assert.equal(items.includes("Logs"), false);
  assert.equal(items.includes("Configurações"), false);
  const irmao = navItems({ perfil: "irmao", cargo_institucional: "veneravel_mestre" }, "../").map((item) => item.label);
  assert.deepEqual(irmao, ["Início", "Aniversários", "Datas Maçônicas", "Calendário"]);
});

test("autorização usa perfil do membro autenticado, não cargo nem payload", () => {
  assert.doesNotMatch(gerenciar, /loadOfficeContext/);
  assert.doesNotMatch(guardJs, /options\.offices/);
  assert.match(gestaoJs, /staff: true/);
  assert.match(staffTs, /isStaffProfile\(member\.perfil\)/);
  assert.match(perfisJs, /decidir_ordem_do_dia/);
  assert.match(cargosActions, /p_actor_auth_user_id: actor\.userId/);
  assert.doesNotMatch(gerenciar, /payload\.sou_veneravel|payload\.cargo_institucional/);
});

test("identificação institucional do Venerável usa irmaos_cargos, não autorização", () => {
  assert.match(sql, /create or replace function private\.veneravel_mestre_vigente\(\)/);
  assert.match(sql, /c\.cargo = 'veneravel_mestre'/);
  assert.match(sql, /c\.encerrado_em is null/);
  assert.match(sql, /i\.situacao = 'ativo'/);
  assert.match(sql, /create or replace function public\.veneravel_mestre_vigente\(\)/);
  assert.match(sql, /v\.irmao_id,\s*v\.cargo,\s*v\.inicio_em,\s*v\.situacao/s);
  assert.doesNotMatch(sql, /create or replace function public\.veneravel_mestre_vigente\(\)[\s\S]{0,400}auth_user_id/);
  assert.doesNotMatch(sql, /a\.nome/);
  assert.doesNotMatch(sql, /user_metadata/);
});

test("ciclo de vida: saída de situacao ativo encerra cargo automaticamente", () => {
  assert.match(sql, /create trigger irmaos_encerrar_cargo_inativo/);
  assert.match(sql, /when \(new\.situacao is distinct from 'ativo'\)/);
  assert.match(sql, /Encerramento automático \(situacao=/);
  assert.match(sql, /'cargo_encerrado'/);
  assert.match(sql, /'cargo_atribuido'/);
  assert.match(sql, /create or replace function public\.atualizar_situacao_irmao/);
  assert.match(sql, /perform set_config\('app\.actor_id', coalesce\(actor::text, ''\), true\)/);
  assert.match(gestaoTs, /atualizar_situacao_irmao/);
  assert.doesNotMatch(gestaoTs, /note_request_actor/);
  assert.doesNotMatch(sql, /create or replace function public\.note_request_actor/);
  const situacoes = ["quiet_placet", "transferencia", "afastado", "inativo", "desligado", "falecido"];
  for (const situacao of situacoes) {
    assert.match(sql, new RegExp(`'${situacao}'`));
    assert.match(gestaoTs, new RegExp(situacao));
  }
  assert.doesNotMatch(sql, /sucessor|succession|proximo_veneravel/);
});

test("concorrência de cargos usa lock transacional único e trata unique_violation", () => {
  assert.match(sql, /pg_advisory_xact_lock\(86923001\)/);
  assert.match(sql, /private\.lock_cargos_institucionais\(\)/);
  assert.match(sql, /when unique_violation then/);
  assert.match(sql, /Este cargo já está ocupado/);
  assert.match(sql, /Este Irmão já exerce este cargo/);
});

test("auditoria de cargo fica em irmaos_historico e não amplia logs_autenticacao", () => {
  assert.match(sql, /insert into public\.irmaos_historico \(irmao_id, evento, detalhe, criado_por\)/);
  assert.doesNotMatch(sql, /logs_autenticacao_evento_check/);
  assert.doesNotMatch(cargosActions, /writeAuthLog/);
  assert.doesNotMatch(cargosActions, /cargo_atribuido/);
  assert.match(gestaoTs, /ator: names\.get/);
  assert.match(read("area-restrita/js/comunicados.js"), /cargo_atribuido: "Cargo atribuído"/);
  assert.match(read("area-restrita/js/comunicados.js"), /cargo_encerrado: "Cargo encerrado"/);
});

test("UI separa cargo institucional de perfil de acesso", () => {
  assert.match(gestaoJs, /Definir cargo institucional/);
  assert.match(gestaoJs, /acao: "atribuir_cargo"/);
  assert.match(gestaoJs, /Sem Venerável Mestre vigente/);
  const view = buildProfileView({
    profile: { nome: "Paulo", perfil: "veneravel_mestre", cargo_institucional: "veneravel_mestre", ativo: true, conta_ativada: true, email: "p@loja.org", cim: "12345678" },
    irmao: { nome: "Paulo", situacao: "ativo", cargo_institucional: "veneravel_mestre" },
  });
  assert.equal(view.account.find((item) => item.label === "Perfil").value, "Venerável Mestre");
  assert.equal(view.institutional.find((item) => item.label === "Cargo").value, "Venerável Mestre");
  const mixed = buildProfileView({
    profile: { nome: "João", perfil: "secretario", ativo: true, conta_ativada: true },
    irmao: { nome: "João", situacao: "ativo", cargo_institucional: "veneravel_mestre" },
  });
  assert.equal(mixed.account.find((item) => item.label === "Perfil").value, "Secretário");
  assert.equal(mixed.institutional.find((item) => item.label === "Cargo").value, "Venerável Mestre");
});

test("opções de cargo ocultam administração de Venerável para quem não é Admin", () => {
  const options = officeSelectOptions(member("secretario"), null);
  const vm = options.find((item) => item.id === VENERAVEL_MESTRE);
  assert.equal(vm.disabled, true);
  assert.equal(vm.allowed, false);
  const chanceler = options.find((item) => item.id === "chanceler");
  assert.equal(chanceler.disabled, false);
  assert.equal(chanceler.allowed, true);
  const vmProfile = officeSelectOptions(member("veneravel_mestre"), null);
  assert.equal(vmProfile.find((item) => item.id === VENERAVEL_MESTRE).allowed, false);
  const adminOptions = officeSelectOptions(member("administrador"), null);
  assert.equal(adminOptions.find((item) => item.id === VENERAVEL_MESTRE).allowed, true);
});
