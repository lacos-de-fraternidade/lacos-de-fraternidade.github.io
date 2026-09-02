import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { consumeEmailAuthToken, establishAuthSession, inviteLinkError, pendingEmailAuthToken } from "../area-restrita/js/auth-session.js";
import { canReplacePendingAuthUser, inviteRedirectTo, isEmailRateLimitError, isExistingAuthUserError, localActivateUrlFromPublished } from "../area-restrita/js/invite-redirect.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

test("convite local aponta para a tela de senha e não para o site publicado vazio", () => {
  assert.equal(inviteRedirectTo("http://localhost:8080/area-restrita/gestao/"), "http://localhost:8080/area-restrita/ativar/");
  assert.equal(inviteRedirectTo("http://127.0.0.1:8080"), "http://127.0.0.1:8080/area-restrita/ativar/");
  assert.equal(inviteRedirectTo("https://evil.example"), "https://lacos-de-fraternidade.github.io/area-restrita/ativar/");
  assert.equal(
    localActivateUrlFromPublished("https://lacos-de-fraternidade.github.io/area-restrita/ativar/#access_token=abc"),
    "http://localhost:8080/area-restrita/ativar/#access_token=abc",
  );
  assert.match(read("supabase/functions/_shared/members.ts"), /inviteActivateUrl/);
  assert.match(read("supabase/functions/gerenciar-irmao/index.ts"), /site_origin/);
  assert.match(read("area-restrita/gestao/gestao.js"), /site_origin: location\.origin/);
  assert.match(read("area-restrita/ativar/ativar.js"), /establishAuthSession/);
  assert.match(read("area-restrita/ativar/ativar.js"), /consumeEmailAuthToken/);
  assert.match(read("area-restrita/ativar/index.html"), /ativar-continuar-btn/);
  assert.match(read("area-restrita/redefinir-senha/redefinir.js"), /consumeEmailAuthToken/);
});

test("reenviar convite reaproveita usuário pendente e não envia recuperação de senha", () => {
  assert.equal(isExistingAuthUserError("A user with this email address has already been registered"), true);
  assert.equal(canReplacePendingAuthUser({ id: "a1" }, null), true);
  assert.equal(canReplacePendingAuthUser({ id: "a1" }, { id: "a1", conta_ativada: false }), true);
  assert.equal(canReplacePendingAuthUser({ id: "a1" }, { id: "outro", conta_ativada: true }), false);
  assert.equal(isEmailRateLimitError("email rate limit exceeded"), true);
  const members = read("supabase/functions/_shared/members.ts");
  assert.match(members, /inviteUserByEmail/);
  assert.match(members, /deleteUser/);
  assert.match(members, /EMAIL_RATE_LIMIT_ERROR/);
  assert.doesNotMatch(members, /resetPasswordForEmail/);
  assert.doesNotMatch(members, /sendInviteEmail/);
  assert.match(read("area-restrita/convites/convites.js"), /enviar_convite/);
});

test("a tela de ativação lê o token do link e recusa erro de convite", async () => {
  assert.equal(inviteLinkError({ href: "http://localhost:8080/area-restrita/ativar/?error=access_denied", hash: "" }), "access_denied");
  let verified = 0;
  const supabase = {
    auth: {
      async verifyOtp({ token_hash, type }) {
        verified += 1;
        assert.equal(type, "invite");
        return { data: { session: token_hash === "ok" ? { access_token: "t" } : null }, error: token_hash === "ok" ? null : { message: "invalid" } };
      },
      async exchangeCodeForSession() {
        return { data: {}, error: { message: "nope" } };
      },
      async getSession() {
        return { data: { session: null } };
      },
    },
  };
  const missing = await establishAuthSession(supabase, { href: "http://localhost:8080/area-restrita/ativar/", hash: "" });
  assert.equal(missing.session, null);
  assert.equal(missing.pending, false);
  assert.match(missing.error, /localhost:8080/);
  const inviteHref = { href: "http://localhost:8080/area-restrita/ativar/?token_hash=ok&type=invite", hash: "" };
  assert.equal(pendingEmailAuthToken(inviteHref), true);
  const pending = await establishAuthSession(supabase, inviteHref);
  assert.equal(pending.pending, true);
  assert.equal(pending.session, null);
  assert.equal(verified, 0);
  const valid = await consumeEmailAuthToken(supabase, inviteHref);
  assert.equal(verified, 1);
  assert.equal(valid.session.access_token, "t");
  const consumed = await consumeEmailAuthToken(supabase, { href: "http://localhost:8080/area-restrita/ativar/?token_hash=bad&type=invite", hash: "" });
  assert.equal(consumed.session, null);
  assert.match(consumed.error, /expirou ou já foi usado/);
});

test("a redefinição só consome o token depois do clique e usa type recovery", async () => {
  let verified = 0;
  const supabase = {
    auth: {
      async verifyOtp({ type }) {
        verified += 1;
        assert.equal(type, "recovery");
        return { data: { session: { access_token: "r" } }, error: null };
      },
    },
  };
  const href = { href: "http://localhost:8080/area-restrita/redefinir-senha/?token_hash=ok&type=recovery", hash: "" };
  const pending = await establishAuthSession(supabase, href);
  assert.equal(pending.pending, true);
  assert.equal(verified, 0);
  const valid = await consumeEmailAuthToken(supabase, href);
  assert.equal(verified, 1);
  assert.equal(valid.session.access_token, "r");
});
