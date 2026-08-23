import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { establishAuthSession, inviteLinkError } from "../area-restrita/js/auth-session.js";
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
  const supabase = {
    auth: {
      async verifyOtp({ token_hash }) {
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
  assert.match(missing.error, /localhost:8080/);
  const valid = await establishAuthSession(supabase, { href: "http://localhost:8080/area-restrita/ativar/?token_hash=ok&type=invite", hash: "" });
  assert.equal(valid.session.access_token, "t");
});
