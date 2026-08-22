import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_FILES,
  buildImportPlan,
  parseCsv,
  planToSql,
} from "./lib/glmerj-import.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map();
for (const arg of process.argv.slice(2)) {
  const [key, value] = arg.replace(/^--/, "").split("=");
  args.set(key, value ?? true);
}

const dataDir = args.get("dir")
  || process.env.GLMERJ_DATA_DIR
  || join(root, "data", "glmerj");

function loadCsv(name) {
  const path = join(dataDir, name);
  if (!existsSync(path)) {
    throw new Error(`Arquivo ausente: ${path}`);
  }
  return parseCsv(readFileSync(path, "utf8"));
}

const missing = REQUIRED_FILES.filter((name) => !existsSync(join(dataDir, name)));
if (missing.length) {
  console.error("Defina GLMERJ_DATA_DIR ou --dir apontando para os CSVs extraídos.");
  console.error("Arquivos ausentes:", missing.join(", "));
  process.exit(1);
}

const files = {
  irmaosAniversarios: loadCsv("irmaos_aniversarios.csv"),
  cunhadas: loadCsv("cunhadas_aniversarios.csv"),
  familiares: loadCsv("familiares_aniversarios.csv"),
  casamentos: loadCsv("casamentos.csv"),
  iniciacoes: loadCsv("iniciacoes.csv"),
  fundacao: loadCsv("fundacao_loja.csv"),
};

const plan = buildImportPlan(files);
const report = {
  fonte: dataDir,
  gerado_em: new Date().toISOString(),
  irmaos_importados: plan.report.irmaosImportados,
  familiares_importados: plan.report.familiaresImportados,
  casamentos_importados: plan.report.casamentosImportados,
  iniciacoes_importadas: plan.report.iniciacoesImportadas,
  fundacao_importada: plan.report.fundacaoImportada,
  registros_atualizados: plan.report.atualizados,
  registros_ignorados: plan.report.ignorados,
  pendencias: plan.report.pendencias,
  erros: plan.report.erros,
  revisao: plan.report.revisao,
  relacionados: plan.report.relacionados,
  totais_plan: {
    irmaos: plan.irmaos.length,
    familiares: plan.familiares.length,
    casamentos: plan.casamentos.length,
    fundacao: plan.fundacao ? 1 : 0,
  },
};

console.log(JSON.stringify(report, null, 2));

const outDir = args.get("out") || join(dataDir, "_generated");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "relatorio-importacao.json"), JSON.stringify(report, null, 2));
writeFileSync(join(outDir, "import-glmerj.sql"), planToSql(plan));
console.error(`SQL gerado em ${join(outDir, "import-glmerj.sql")}`);
console.error("O SQL contém dados pessoais e não deve ser versionado.");
