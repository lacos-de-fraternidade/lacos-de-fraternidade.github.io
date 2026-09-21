(function () {
  const form = document.querySelector("#interest-form");
  if (!form) return;

  const config = window.APP_CONFIG || {};
  const idadeMinima = Number(config.idadeMinima || 21);
  const motivacaoMin = Number(config.motivacaoMin || 100);
  const motivacaoMax = Number(config.motivacaoMax || 2000);
  const statusMessage = document.querySelector("#form-status");
  const submitButton = document.querySelector("#submit-button");
  const nextButton = document.querySelector("#wizard-next");
  const backButton = document.querySelector("#wizard-back");
  const defaultSubmitLabel = (submitButton && submitButton.textContent) || "Enviar cadastro";
  const defaultNextLabel = (nextButton && nextButton.textContent) || "Continuar";
  const defaultBackLabel = (backButton && backButton.textContent) || "Voltar";
  const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
  const DRAFT_KEY = "lacosCandidaturaDraft";
  const maxDocMb = Number(config.maxDocMb || 5);
  const MAX_DOC_BYTES = maxDocMb * 1024 * 1024;
  const DOC_LABELS = {
    certidao_nascimento: "Certidão de nascimento",
    certidao_casamento: "Certidão de casamento",
    identidade: "Identidade",
    cpf: "CPF",
    titulo_eleitoral: "Título eleitoral",
    comprovante_rendimentos: "Comprovante de rendimentos",
    comprovante_residencia: "Comprovante de residência",
  };
  const STEP_TITLES = ["", "Dados pessoais", "Endereço", "Família", "Formação e profissão", "Referências", "Documentos", "Revisão"];
  const PLANO_SAUDE_AUSENTE = "nao_possui";

  const el = function (id) {
    return document.getElementById(id);
  };

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function collapseSpaces(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function formatCpf(value) {
    return onlyDigits(value)
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatWhatsapp(value) {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  }

  function formatCep(value) {
    return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
  }

  function isValidCpf(value) {
    const cpf = onlyDigits(value);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const digit = function (length) {
      let sum = 0;
      for (let index = 0; index < length; index += 1) {
        sum += Number(cpf[index]) * (length + 1 - index);
      }
      const remainder = (sum * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };
    return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
  }

  function isValidNome(value) {
    const nome = collapseSpaces(value);
    if (nome.length < 5 || nome.split(" ").length < 2) return false;
    if (/\d/.test(nome)) return false;
    return /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]*[A-Za-zÀ-ÿ]$/.test(nome);
  }

  function isValidWhatsapp(value) {
    const digits = onlyDigits(value);
    if (digits.length !== 10 && digits.length !== 11) return false;
    const ddd = Number(digits.slice(0, 2));
    if (ddd < 11 || ddd > 99) return false;
    if (digits.length === 11 && digits[2] !== "9") return false;
    return true;
  }

  function formatDateBr(value) {
    return onlyDigits(value)
      .slice(0, 8)
      .replace(/(\d{2})(\d)/, "$1/$2")
      .replace(/(\d{2})(\d)/, "$1/$2");
  }

  function parseDateBr(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || "").trim());
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function toIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function isoFromField(id) {
    const parsed = parseDateBr(el(id) && el(id).value);
    return parsed ? toIsoDate(parsed) : "";
  }

  function getDatePicker() {
    const field = el("dataNascimento");
    if (!field) return null;
    return field._flatpickr || (field.closest(".date-field") && field.closest(".date-field")._flatpickr) || null;
  }

  function getBirthIso() {
    const picker = getDatePicker();
    if (picker && picker.selectedDates[0]) return toIsoDate(picker.selectedDates[0]);
    const field = el("dataNascimento");
    const visible = picker && picker.altInput;
    const parsed = parseDateBr((visible && visible.value) || (field && field.value));
    return parsed ? toIsoDate(parsed) : "";
  }

  function idadeEmAnos(isoDate) {
    const birth = new Date(isoDate + "T00:00:00");
    if (isNaN(birth.getTime())) return -1;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age;
  }

  function setError(id, message) {
    const field = el(id);
    const box = el(id + "-error");
    if (field) {
      field.classList.toggle("is-invalid", Boolean(message));
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    }
    const picker = getDatePicker();
    const birthWrap = field && field.closest(".date-field");
    const birthVisible = picker && picker.altInput;
    if (birthWrap) birthWrap.classList.toggle("is-invalid", id === "dataNascimento" && Boolean(message));
    if (birthVisible && id === "dataNascimento") {
      birthVisible.classList.toggle("is-invalid", Boolean(message));
      if (message) birthVisible.setAttribute("aria-invalid", "true");
      else birthVisible.removeAttribute("aria-invalid");
    }
    if (box) box.textContent = message || "";
  }

  function clearAllErrors() {
    form.querySelectorAll(".field-error").forEach(function (node) {
      node.textContent = "";
    });
    form.querySelectorAll(".is-invalid").forEach(function (node) {
      node.classList.remove("is-invalid");
      node.removeAttribute("aria-invalid");
    });
  }

  function estadoCivil() {
    return (el("estadoCivil") && el("estadoCivil").value) || "";
  }

  function radioTrue(name) {
    const checked = form.querySelector("input[name='" + name + "']:checked");
    return Boolean(checked && checked.value === "true");
  }

  function requiredCertidaoTipo() {
    const civil = estadoCivil();
    return civil === "casado" || civil === "uniao_estavel" ? "certidao_casamento" : "certidao_nascimento";
  }

  function requiredDocumentTypes() {
    return [requiredCertidaoTipo(), "identidade", "cpf", "titulo_eleitoral", "comprovante_rendimentos", "comprovante_residencia"];
  }

  function docHint() {
    return "PDF, JPG ou PNG · máximo " + maxDocMb + " MB";
  }

  function docHintDocuments() {
    return "PDF, JPG ou PNG · máximo " + maxDocMb + " MB por arquivo.";
  }

  function validateDocumentFile(file) {
    if (!file) return "Envie o arquivo.";
    const mime = file.type || "";
    const name = String(file.name || "").toLowerCase();
    const okMime = ["application/pdf", "image/jpeg", "image/png"].indexOf(mime) >= 0;
    const okExt = /\.(pdf|jpe?g|png)$/.test(name);
    if (!okMime || !okExt) return "Envie o documento em PDF, JPG ou PNG.";
    if (file.size <= 0 || file.size > MAX_DOC_BYTES) return "Cada documento deve ter no máximo " + maxDocMb + " MB.";
    return "";
  }

  const files = {};
  const replacingDocs = {};
  let currentStep = 1;
  let editingFromReview = false;
  let editSnapshot = null;
  let uploadToken = "";
  let submitting = false;
  let searchTimer = 0;
  let searchAbort = null;

  function syncConditional() {
    const value = estadoCivil();
    const conjuge = value === "casado" || value === "uniao_estavel";
    const mae = value === "solteiro" || value === "divorciado";
    const outro = value === "viuvo" || value === "outro";
    if (el("bloco-conjuge")) el("bloco-conjuge").hidden = !conjuge;
    if (el("bloco-mae")) el("bloco-mae").hidden = !mae;
    if (el("bloco-outro")) el("bloco-outro").hidden = !outro;
    if (!conjuge) {
      delete files.certidao_casamento;
      if (el("doc-certidao_casamento")) el("doc-certidao_casamento").value = "";
      ["esposaNome", "esposaWhatsapp", "dataCasamento", "esposaNascimento"].forEach(function (id) {
        if (el(id)) el(id).value = "";
      });
      if (el("consentimentoEsposa")) el("consentimentoEsposa").checked = false;
    } else {
      delete files.certidao_nascimento;
      if (el("doc-certidao_nascimento")) el("doc-certidao_nascimento").value = "";
    }
    if (!mae) {
      ["maeNome", "maeWhatsapp"].forEach(function (id) {
        if (el(id)) el(id).value = "";
      });
      if (el("consentimentoMae")) el("consentimentoMae").checked = false;
    }
    if (!outro && el("situacaoFamiliar")) el("situacaoFamiliar").value = "";
    if (el("bloco-filhos")) el("bloco-filhos").hidden = !radioTrue("possuiFilhos");
    if (el("bloco-militar")) el("bloco-militar").hidden = !radioTrue("foiMilitar");
    if (el("bloco-processo")) el("bloco-processo").hidden = !radioTrue("processoCriminal");
    if (el("bloco-partido")) el("bloco-partido").hidden = !radioTrue("filiacaoPartidaria");
    if (!radioTrue("possuiFilhos") && el("filhos-lista")) el("filhos-lista").innerHTML = "";
    if (!radioTrue("foiMilitar")) {
      if (el("patenteMilitar")) el("patenteMilitar").value = "";
      if (el("localMilitar")) el("localMilitar").value = "";
    }
    if (!radioTrue("processoCriminal") && el("processoCriminalDetalhe")) el("processoCriminalDetalhe").value = "";
    if (!radioTrue("filiacaoPartidaria") && el("partido")) el("partido").value = "";
    if (mae && !collapseSpaces(el("maeNome") && el("maeNome").value) && el("nomeMae")) {
      el("maeNome").value = el("nomeMae").value;
    }
    if (el("add-filho")) {
      el("add-filho").textContent = (el("filhos-lista") && el("filhos-lista").children.length)
        ? "＋ Adicionar outro filho"
        : "＋ Adicionar filho";
    }
    renderFamilyUpload();
  }

  function fillUfs() {
    form.querySelectorAll(".uf-select").forEach(function (select) {
      const current = select.value;
      const keep = select.querySelector("option[value='']");
      select.innerHTML = "";
      if (keep) select.appendChild(keep);
      else {
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "UF";
        select.appendChild(empty);
      }
      ufs.forEach(function (uf) {
        const option = document.createElement("option");
        option.value = uf;
        option.textContent = uf;
        select.appendChild(option);
      });
      if (current) select.value = current;
    });
  }

  function setStatus(message, type) {
    statusMessage.className = "form-status" + (type ? " " + type : "");
    statusMessage.textContent = message || "";
  }

  function captureEditSnapshot() {
    const fields = {};
    form.querySelectorAll("input, select, textarea").forEach(function (node) {
      if (!node.id || node.type === "file") return;
      fields[node.id] = (node.type === "checkbox" || node.type === "radio") ? node.checked : node.value;
    });
    const filhos = Array.prototype.map.call(form.querySelectorAll("#filhos-lista .collection-item"), function (item) {
      return {
        nome: item.querySelector(".filho-nome").value,
        sexo: item.querySelector(".filho-sexo").value,
        dataNascimento: (item.querySelector(".filho-nascimento") && item.querySelector(".filho-nascimento").value) || "",
      };
    });
    return {
      fields: fields,
      files: Object.assign({}, files),
      replacingDocs: Object.assign({}, replacingDocs),
      filhos: filhos,
    };
  }

  function restoreEditSnapshot(snap) {
    if (!snap) return;
    Object.keys(snap.fields).forEach(function (id) {
      const node = el(id);
      if (!node) return;
      if (node.type === "checkbox" || node.type === "radio") node.checked = snap.fields[id];
      else node.value = snap.fields[id];
    });
    Object.keys(files).forEach(function (key) { delete files[key]; });
    Object.keys(replacingDocs).forEach(function (key) { delete replacingDocs[key]; });
    if (el("filhos-lista")) el("filhos-lista").innerHTML = "";
    syncConditional();
    Object.keys(snap.files).forEach(function (key) { files[key] = snap.files[key]; });
    Object.keys(snap.replacingDocs).forEach(function (key) { replacingDocs[key] = snap.replacingDocs[key]; });
    if (radioTrue("possuiFilhos") && snap.filhos && snap.filhos.length) {
      snap.filhos.forEach(function (filho) { addFilho(filho); });
    }
    if (typeof syncPlanoSaude === "function") syncPlanoSaude();
  }

  function showStep(step) {
    currentStep = step;
    if (step === 7) editingFromReview = false;
    form.querySelectorAll(".form-step").forEach(function (node) {
      node.hidden = Number(node.getAttribute("data-step")) !== step;
    });
    document.querySelectorAll("#form-progress .form-progress-dots li").forEach(function (node) {
      const value = Number(node.getAttribute("data-progress"));
      node.classList.toggle("is-current", value === step);
      node.classList.toggle("is-done", value < step);
    });
    if (el("form-progress-label")) el("form-progress-label").textContent = "Etapa " + step + " de 7";
    if (el("form-progress-name")) el("form-progress-name").textContent = STEP_TITLES[step] || "";
    const progress = el("form-progress");
    if (progress) {
      progress.setAttribute("aria-label", "Etapa " + step + " de 7: " + (STEP_TITLES[step] || ""));
    }
    const fromReview = editingFromReview && step !== 7;
    backButton.hidden = fromReview ? false : step === 1;
    nextButton.hidden = fromReview ? false : step === 7;
    submitButton.hidden = fromReview ? true : step !== 7;
    nextButton.textContent = fromReview ? "Salvar alterações" : defaultNextLabel;
    backButton.textContent = fromReview ? "Cancelar e voltar à revisão" : defaultBackLabel;
    if (form.querySelector(".form-wizard-nav")) {
      form.querySelector(".form-wizard-nav").classList.toggle("is-edit-mode", fromReview);
    }
    if (step === 3) renderFamilyUpload();
    if (step === 6) renderDocuments();
    if (step === 7) renderReview();
    const heading = form.querySelector('[data-step="' + step + '"] legend');
    if (heading && heading.focus) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
    saveDraft();
  }

  function renumberFilhos() {
    Array.prototype.forEach.call(form.querySelectorAll("#filhos-lista .collection-item"), function (item, index) {
      const title = item.querySelector(".filho-head strong");
      if (title) title.textContent = "Filho " + (index + 1);
    });
    if (el("add-filho")) {
      el("add-filho").textContent = (el("filhos-lista") && el("filhos-lista").children.length)
        ? "＋ Adicionar outro filho"
        : "＋ Adicionar filho";
    }
  }

  function addFilho(data) {
    const wrap = el("filhos-lista");
    if (!wrap) return;
    const item = document.createElement("div");
    item.className = "collection-item";
    item.innerHTML =
      "<div class='filho-head'><strong>Filho</strong><button class='link-action link-action-danger' type='button' data-remove-filho>Remover</button></div>" +
      "<div class='field'><label>Nome *</label><input class='filho-nome' type='text' maxlength='120' /></div>" +
      "<div class='field-row'><div class='field'><label>Sexo *</label><select class='filho-sexo'><option value=''>Selecione</option><option value='masculino'>Masculino</option><option value='feminino'>Feminino</option></select></div>" +
      "<div class='field'><label>Data de nascimento *</label><input class='filho-nascimento date-mask' type='text' inputmode='numeric' maxlength='10' placeholder='dd/mm/aaaa' /></div></div>";
    wrap.appendChild(item);
    if (data) {
      item.querySelector(".filho-nome").value = data.nome || "";
      item.querySelector(".filho-sexo").value = data.sexo || "";
      item.querySelector(".filho-nascimento").value = data.dataNascimento || "";
    }
    bindDateMasks(item);
    renumberFilhos();
  }

  function readFilhos() {
    return Array.prototype.map.call(form.querySelectorAll("#filhos-lista .collection-item"), function (item) {
      return {
        nome: item.querySelector(".filho-nome").value,
        sexo: item.querySelector(".filho-sexo").value,
        dataNascimento: isoFromNode(item.querySelector(".filho-nascimento")),
      };
    });
  }

  function isoFromNode(node) {
    const parsed = parseDateBr(node && node.value);
    return parsed ? toIsoDate(parsed) : "";
  }

  function renderReferencias() {
    const wrap = el("referencias-lista");
    if (!wrap || wrap.children.length) return;
    for (let index = 1; index <= 3; index += 1) {
      const item = document.createElement("div");
      item.className = "collection-item";
      item.innerHTML =
        "<p><strong>Referência pessoal " + index + "</strong></p>" +
        "<div class='field'><label for='ref" + index + "Nome'>Nome *</label><input id='ref" + index + "Nome' type='text' maxlength='120' /></div>" +
        "<div class='field'><label for='ref" + index + "Telefone'>Telefone *</label><input id='ref" + index + "Telefone' class='phone-mask' type='tel' inputmode='numeric' maxlength='16' /></div>" +
        "<div class='field'><label for='ref" + index + "Logradouro'>Endereço</label><input id='ref" + index + "Logradouro' type='text' maxlength='120' /></div>" +
        "<div class='field-row'><div class='field'><label for='ref" + index + "Bairro'>Bairro</label><input id='ref" + index + "Bairro' type='text' /></div>" +
        "<div class='field'><label for='ref" + index + "Cidade'>Cidade</label><input id='ref" + index + "Cidade' type='text' /></div></div>" +
        "<div class='field-row'><div class='field'><label for='ref" + index + "Estado'>Estado</label><select id='ref" + index + "Estado' class='uf-select'><option value=''>UF</option></select></div>" +
        "<div class='field'><label for='ref" + index + "Cep'>CEP</label><input id='ref" + index + "Cep' class='cep-mask' type='text' inputmode='numeric' maxlength='9' /></div></div>" +
        "<small class='field-error' id='ref" + index + "Nome-error'></small>";
      wrap.appendChild(item);
    }
    fillUfs();
  }

  function readReferencias() {
    const list = [];
    for (let index = 1; index <= 3; index += 1) {
      list.push({
        nome: (el("ref" + index + "Nome") && el("ref" + index + "Nome").value) || "",
        telefone: (el("ref" + index + "Telefone") && el("ref" + index + "Telefone").value) || "",
        logradouro: (el("ref" + index + "Logradouro") && el("ref" + index + "Logradouro").value) || "",
        bairro: (el("ref" + index + "Bairro") && el("ref" + index + "Bairro").value) || "",
        cidade: (el("ref" + index + "Cidade") && el("ref" + index + "Cidade").value) || "",
        estado: (el("ref" + index + "Estado") && el("ref" + index + "Estado").value) || "",
        cep: (el("ref" + index + "Cep") && el("ref" + index + "Cep").value) || "",
      });
    }
    return list;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderUploadCard(tipo, options) {
    options = options || {};
    const file = files[tipo];
    const replacing = Boolean(replacingDocs[tipo]);
    const inputId = "doc-" + tipo;
    const input = "<input class='visually-hidden' id='" + inputId + "' type='file' accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png' data-doc-type='" + tipo + "' />";
    const error = "<small class='field-error' id='" + inputId + "-error'></small>";
    const title = DOC_LABELS[tipo];
    const showHint = options.hint !== false;
    const icon = "<svg class='upload-icon' viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' aria-hidden='true'><path d='M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5l9.5-9.5a4 4 0 0 1 5.7 5.7l-9.5 9.4a2 2 0 1 1-2.8-2.8l8.1-8.1'/></svg>";
    if (file && !replacing) {
      return "<div class='upload-card is-sent'>" +
        "<div class='upload-card-head'><p class='upload-title'>" + title + "</p><span class='doc-status is-ok'>✓ Enviado</span></div>" +
        "<p class='upload-meta'><button type='button' class='link-action' data-replace-doc='" + tipo + "'>Alterar documento</button></p>" +
        input + error +
        "</div>";
    }
    return "<div class='upload-card'>" +
      "<p class='upload-title'>" + title + " *</p>" +
      "<label class='upload-trigger' for='" + inputId + "'>" + icon + " Anexar documento</label>" +
      (showHint ? "<p class='field-hint'>" + docHint() + "</p>" : "") +
      input + error +
      "</div>";
  }

  function renderFamilyUpload() {
    const slot = el("upload-certidao-civil");
    if (!slot) return;
    slot.innerHTML = renderUploadCard(requiredCertidaoTipo());
  }

  function renderDocuments() {
    const wrap = el("documentos-lista");
    if (!wrap) return;
    if (el("documentos-hint")) el("documentos-hint").textContent = docHintDocuments();
    wrap.innerHTML = requiredDocumentTypes().map(function (tipo) {
      return renderUploadCard(tipo, { hint: false });
    }).join("");
  }

  function onDocumentChange(event) {
    const input = event.target;
    const tipo = input.getAttribute("data-doc-type");
    const file = input.files && input.files[0];
    if (!file) return;
    const invalid = validateDocumentFile(file);
    if (invalid) {
      input.value = "";
      setError(input.id, invalid);
      return;
    }
    files[tipo] = file;
    replacingDocs[tipo] = false;
    setError(input.id, "");
    if (currentStep === 3) renderFamilyUpload();
    if (currentStep === 6) renderDocuments();
  }

  function renderReview() {
    const wrap = el("revisao-conteudo");
    if (!wrap) return;
    const data = payload();
    const group = function (step, title, lines, extraClass) {
      return "<div class='review-group'><div class='review-head'><h3>" + title + "</h3>" +
        "<button type='button' class='review-edit' data-edit-step='" + step + "'>Editar</button></div>" +
        lines.map(function (line) {
          return "<p" + (extraClass ? " class='" + extraClass + "'" : "") + ">" + line + "</p>";
        }).join("") +
        "</div>";
    };
    wrap.innerHTML = [
      group(1, "Dados pessoais", [
        data.nome,
        "CPF " + data.cpf,
        "Proponente: " + (data.proponenteNome || "não selecionado"),
      ]),
      group(2, "Endereço", [data.logradouro + ", " + data.numero + " — " + data.cidade + "/" + data.estado]),
      group(3, "Família", [
        "Estado civil: " + estadoCivil(),
        radioTrue("possuiFilhos") ? (data.filhos.length + " filho(s)") : "Sem filhos",
      ]),
      group(4, "Formação e profissão", [data.formacao, data.profissao + " · " + data.empresa]),
      group(5, "Informações complementares", ["3 referências pessoais", data.referenciaComercial.nome]),
      group(6, "Documentos", requiredDocumentTypes().map(function (tipo) {
        return (files[tipo] ? "✓ " : "○ ") + DOC_LABELS[tipo];
      }), "review-doc"),
    ].join("");
  }

  let lastInvalidCount = 0;

  function focusFirstInvalid() {
    const field = form.querySelector(".is-invalid, [aria-invalid='true']");
    const error = form.querySelector(".field-error:not(:empty)");
    const targetWrap = (field && field.closest(".field, .upload-card, .consent-field, .collection-item")) || error;
    if (targetWrap && targetWrap.scrollIntoView) {
      targetWrap.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (!field) return;
    const picker = field.id === "dataNascimento" ? getDatePicker() : null;
    const target = (picker && picker.altInput) || field;
    if (target && target.focus) {
      try { target.focus({ preventScroll: true }); } catch (error) { target.focus(); }
    }
  }

  function reviewStatusMessage() {
    const n = lastInvalidCount;
    if (n <= 0) return "Revise os campos destacados.";
    if (n === 1) return "Revise 1 campo obrigatório.";
    return "Revise " + n + " campos obrigatórios.";
  }

  function validate(step) {
    clearAllErrors();
    let ok = true;
    lastInvalidCount = 0;
    const mark = function (id, message) {
      setError(id, message);
      ok = false;
      lastInvalidCount += 1;
    };
    const check = !step || step === 1;
    if (check || step === 1) {
      if (!isValidNome(el("nome").value)) mark("nome", "Informe seu nome completo.");
      const birth = getBirthIso();
      if (!birth) mark("dataNascimento", "Informe sua data de nascimento.");
      else if (new Date(birth + "T00:00:00") > new Date()) mark("dataNascimento", "Informe uma data de nascimento válida.");
      else if (idadeEmAnos(birth) < idadeMinima) {
        mark("dataNascimento", "Para o Cadastro do candidato é necessário possuir, no mínimo, " + idadeMinima + " anos de idade.");
      }
      if (!isValidCpf(el("cpf").value)) mark("cpf", "Informe um CPF válido.");
      if (collapseSpaces(el("rg").value).length < 4) mark("rg", "Informe o RG.");
      if (collapseSpaces(el("rgOrgao").value).length < 2) mark("rgOrgao", "Informe o órgão expedidor do RG.");
      if (!isoFromField("rgExpedicao")) mark("rgExpedicao", "Informe a data de expedição do RG.");
      if (!isValidNome(el("nomeMae").value)) mark("nomeMae", "Informe o nome completo da mãe.");
      if (collapseSpaces(el("nomePai").value) && !isValidNome(el("nomePai").value)) mark("nomePai", "Informe um nome válido para o pai.");
      if (collapseSpaces(el("naturalidade").value).length < 2) mark("naturalidade", "Informe a naturalidade.");
      if (collapseSpaces(el("nacionalidade").value).length < 3) mark("nacionalidade", "Informe a nacionalidade.");
      if (!el("ufNascimento").value) mark("ufNascimento", "Informe a UF de nascimento.");
      if (!estadoCivil()) mark("estadoCivil", "Selecione o estado civil.");
      if (!isValidWhatsapp(el("whatsapp").value)) mark("whatsapp", "Informe um WhatsApp com DDD.");
      const email = collapseSpaces(el("email").value).toLowerCase();
      const email2 = collapseSpaces(el("emailConfirmacao").value).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) mark("email", "Informe um endereço de e-mail válido.");
      if (email !== email2) mark("emailConfirmacao", "A confirmação de e-mail não confere.");
      if (!isValidWhatsapp(el("telefoneEmergencia").value)) mark("telefoneEmergencia", "Informe o telefone de emergência.");
      if (el("naoPossuiPlanoSaude") && el("naoPossuiPlanoSaude").checked) {
        setError("planoSaude", "");
      } else if (collapseSpaces(el("planoSaude") && el("planoSaude").value).length < 2) {
        mark("planoSaude", "Informe o plano de saúde.");
      }
      if (!el("proponenteId").value) mark("proponenteBusca", "Selecione o irmão que o convidou.");
    }
    if (!step || step === 2) {
      if (onlyDigits(el("cep").value).length !== 8) mark("cep", "Informe um CEP válido.");
      if (collapseSpaces(el("logradouro").value).length < 3) mark("logradouro", "Informe o logradouro.");
      if (!collapseSpaces(el("numero").value)) mark("numero", "Informe o número ou S/N.");
      if (collapseSpaces(el("bairro").value).length < 2) mark("bairro", "Informe o bairro.");
      if (collapseSpaces(el("cidade").value).length < 2) mark("cidade", "Informe a cidade.");
      if (!el("estado").value) mark("estado", "Selecione o estado.");
      if (collapseSpaces(el("tempoResidencia").value).length < 2) mark("tempoResidencia", "Informe o tempo de residência no endereço.");
    }
    if (!step || step === 3) {
      if (estadoCivil() === "casado" || estadoCivil() === "uniao_estavel") {
        if (!isValidNome(el("esposaNome").value)) mark("esposaNome", "Informe o nome completo da esposa ou companheira.");
        if (!isoFromField("dataCasamento")) mark("dataCasamento", "Informe a data de casamento.");
        if (!isoFromField("esposaNascimento")) mark("esposaNascimento", "Informe a data de nascimento da esposa ou companheira.");
        if (!isValidWhatsapp(el("esposaWhatsapp").value)) mark("esposaWhatsapp", "Informe o WhatsApp da esposa ou companheira.");
        if (!el("consentimentoEsposa").checked) mark("consentimentoEsposa", "Confirme a ciência sobre o consentimento da esposa ou companheira.");
      } else if (estadoCivil() === "solteiro" || estadoCivil() === "divorciado") {
        if (!isValidNome(el("maeNome").value)) mark("maeNome", "Informe o nome completo da mãe.");
        if (!isValidWhatsapp(el("maeWhatsapp").value)) mark("maeWhatsapp", "Informe um WhatsApp da mãe.");
        if (!el("consentimentoMae").checked) mark("consentimentoMae", "Confirme a ciência sobre o consentimento da mãe.");
      } else if (estadoCivil() === "viuvo" || estadoCivil() === "outro") {
        if (collapseSpaces(el("situacaoFamiliar").value).length < 8) mark("situacaoFamiliar", "Descreva brevemente sua situação familiar.");
      }
      const certTipo = requiredCertidaoTipo();
      if (!files[certTipo]) mark("doc-" + certTipo, "Envie " + DOC_LABELS[certTipo].toLowerCase() + ".");
      if (radioTrue("possuiFilhos")) {
        const filhos = readFilhos();
        if (!filhos.length) mark("filhos", "Informe os dados de pelo menos um filho.");
        filhos.forEach(function (filho) {
          if (!isValidNome(filho.nome) || !filho.sexo || !filho.dataNascimento) mark("filhos", "Complete os dados de cada filho.");
        });
      }
    }
    if (!step || step === 4) {
      if (!el("grauInstrucao").value) mark("grauInstrucao", "Selecione o grau de instrução.");
      if (collapseSpaces(el("formacao").value).length < 2) mark("formacao", "Informe a formação.");
      if (collapseSpaces(el("profissao").value).length < 2) mark("profissao", "Informe a profissão.");
      if (!collapseSpaces(el("rendaMensal").value)) mark("rendaMensal", "Informe a renda mensal.");
      if (!collapseSpaces(el("rendaFamiliar").value)) mark("rendaFamiliar", "Informe a renda familiar.");
      if (collapseSpaces(el("empresa").value).length < 2) mark("empresa", "Informe a empresa.");
      if (collapseSpaces(el("cargoEmpresa").value).length < 2) mark("cargoEmpresa", "Informe o cargo na empresa.");
      const empresaCep = onlyDigits(el("empresaCep").value);
      if (empresaCep && empresaCep.length !== 8) mark("empresaCep", "Informe um CEP profissional válido.");
      if (radioTrue("foiMilitar")) {
        if (collapseSpaces(el("patenteMilitar").value).length < 2) mark("patenteMilitar", "Informe a patente ou graduação militar.");
        if (collapseSpaces(el("localMilitar").value).length < 2) mark("localMilitar", "Informe o local ou organização militar.");
      }
    }
    if (!step || step === 5) {
      readReferencias().forEach(function (item, index) {
        if (!isValidNome(item.nome) || onlyDigits(item.telefone).length < 10) {
          mark("ref" + (index + 1) + "Nome", "Informe nome e telefone da referência " + (index + 1) + ".");
        }
      });
      if (collapseSpaces(el("refComercialNome").value).length < 3) mark("refComercialNome", "Informe a referência comercial ou bancária.");
      if (radioTrue("processoCriminal") && collapseSpaces(el("processoCriminalDetalhe").value).length < 8) {
        mark("processoCriminalDetalhe", "Descreva o processo criminal informado.");
      }
      if (radioTrue("filiacaoPartidaria") && collapseSpaces(el("partido").value).length < 2) {
        mark("partido", "Informe o partido político.");
      }
      const motivacao = el("motivacao").value.trim();
      if (motivacao.replace(/\s+/g, " ").length < motivacaoMin) mark("motivacao", "Sua resposta deve possuir pelo menos " + motivacaoMin + " caracteres.");
      if (motivacao.length > motivacaoMax) mark("motivacao", "Sua resposta deve ter no máximo " + motivacaoMax + " caracteres.");
    }
    if (!step || step === 6) {
      requiredDocumentTypes().forEach(function (tipo) {
        if (!files[tipo]) mark("doc-" + tipo, "Envie " + DOC_LABELS[tipo].toLowerCase() + ".");
      });
    }
    if (!step || step === 7) {
      if (!el("lgpdAceite").checked) mark("lgpdAceite", "É necessário autorizar o tratamento dos dados para continuar.");
    }
    return ok;
  }

  function payload() {
    const civil = estadoCivil();
    const conjuge = civil === "casado" || civil === "uniao_estavel";
    const mae = civil === "solteiro" || civil === "divorciado";
    return {
      website: el("website").value,
      nome: el("nome").value,
      dataNascimento: getBirthIso(),
      cpf: el("cpf").value,
      rg: el("rg").value,
      rgOrgao: el("rgOrgao").value,
      rgExpedicao: isoFromField("rgExpedicao"),
      nomeMae: el("nomeMae").value,
      nomePai: el("nomePai").value,
      naturalidade: el("naturalidade").value,
      nacionalidade: el("nacionalidade").value,
      ufNascimento: el("ufNascimento").value,
      estadoCivil: civil,
      dataCasamento: conjuge ? isoFromField("dataCasamento") : "",
      esposaNascimento: conjuge ? isoFromField("esposaNascimento") : "",
      familiarNome: conjuge ? el("esposaNome").value : mae ? el("maeNome").value : "",
      familiarWhatsapp: conjuge ? el("esposaWhatsapp").value : mae ? el("maeWhatsapp").value : "",
      consentimentoFamiliar: conjuge ? el("consentimentoEsposa").checked : mae ? el("consentimentoMae").checked : false,
      situacaoFamiliar: !conjuge && !mae ? el("situacaoFamiliar").value : "",
      whatsapp: el("whatsapp").value,
      email: el("email").value,
      emailConfirmacao: el("emailConfirmacao").value,
      telefoneEmergencia: el("telefoneEmergencia").value,
      naoPossuiPlanoSaude: Boolean(el("naoPossuiPlanoSaude") && el("naoPossuiPlanoSaude").checked),
      planoSaude: (el("naoPossuiPlanoSaude") && el("naoPossuiPlanoSaude").checked)
        ? PLANO_SAUDE_AUSENTE
        : ((el("planoSaude") && el("planoSaude").value) || ""),
      tipoSanguineo: el("tipoSanguineo").value,
      tratamentoSaude: el("tratamentoSaude").value,
      proponenteId: el("proponenteId").value,
      proponenteNome: el("proponenteNome").value,
      cep: el("cep").value,
      logradouro: el("logradouro").value,
      numero: el("numero").value,
      complemento: el("complemento").value,
      bairro: el("bairro").value,
      cidade: el("cidade").value,
      estado: el("estado").value,
      pais: el("pais").value,
      tempoResidencia: el("tempoResidencia").value,
      possuiFilhos: radioTrue("possuiFilhos"),
      filhos: radioTrue("possuiFilhos") ? readFilhos() : [],
      grauInstrucao: el("grauInstrucao").value,
      formacao: el("formacao").value,
      especializacao: el("especializacao").value,
      profissao: el("profissao").value,
      ocupacao: collapseSpaces(el("profissao") && el("profissao").value),
      especialidadeProfissional: el("especialidadeProfissional").value,
      rendaMensal: el("rendaMensal").value,
      rendaFamiliar: el("rendaFamiliar").value,
      empresa: el("empresa").value,
      cargoEmpresa: el("cargoEmpresa").value,
      dataAdmissaoEmpresa: isoFromField("dataAdmissaoEmpresa"),
      empresaLogradouro: el("empresaLogradouro").value,
      empresaNumero: el("empresaNumero").value,
      empresaBairro: el("empresaBairro").value,
      empresaCep: el("empresaCep").value,
      empresaCidade: el("empresaCidade").value,
      empresaEstado: el("empresaEstado").value,
      empresaPais: el("empresaPais").value,
      empresaTelefone: el("empresaTelefone").value,
      empresaRamal: el("empresaRamal").value,
      foiMilitar: radioTrue("foiMilitar"),
      patenteMilitar: radioTrue("foiMilitar") ? el("patenteMilitar").value : "",
      localMilitar: radioTrue("foiMilitar") ? el("localMilitar").value : "",
      referencias: readReferencias(),
      referenciaComercial: {
        nome: el("refComercialNome").value,
        telefone: el("refComercialTelefone").value,
        logradouro: el("refComercialLogradouro").value,
        bairro: el("refComercialBairro").value,
        cidade: el("refComercialCidade").value,
        estado: el("refComercialEstado").value,
        cep: el("refComercialCep").value,
      },
      entidades: el("entidades").value,
      processoCriminal: radioTrue("processoCriminal"),
      processoCriminalDetalhe: radioTrue("processoCriminal") ? el("processoCriminalDetalhe").value : "",
      filiacaoPartidaria: radioTrue("filiacaoPartidaria"),
      partido: radioTrue("filiacaoPartidaria") ? el("partido").value : "",
      outrasInformacoes: el("outrasInformacoes").value,
      motivacao: el("motivacao").value,
      lgpdAceite: el("lgpdAceite").checked,
      lgpdVersao: config.lgpdVersao || "2026-08-17",
    };
  }

  function saveDraft() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        step: currentStep,
        uploadToken: uploadToken,
        values: payload(),
        possuiFilhos: radioTrue("possuiFilhos"),
        foiMilitar: radioTrue("foiMilitar"),
        processoCriminal: radioTrue("processoCriminal"),
        filiacaoPartidaria: radioTrue("filiacaoPartidaria"),
      }));
    } catch (error) {
      // sessionStorage cheio ou indisponível não bloqueia o preenchimento.
    }
  }

  function restoreDraft() {
    let draft = null;
    try {
      draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "");
    } catch (error) {
      draft = null;
    }
    if (!draft || !draft.values) return;
    uploadToken = draft.uploadToken || "";
    const values = draft.values;
    Object.keys(values).forEach(function (key) {
      if (["filhos", "referencias", "referenciaComercial", "possuiFilhos", "foiMilitar", "processoCriminal", "filiacaoPartidaria", "lgpdAceite", "consentimentoFamiliar", "naoPossuiPlanoSaude", "ocupacao"].indexOf(key) >= 0) return;
      if (el(key) && typeof values[key] === "string") {
        if (key === "dataNascimento") return;
        if (key === "planoSaude" && (values.naoPossuiPlanoSaude || values.planoSaude === PLANO_SAUDE_AUSENTE)) return;
        el(key).value = values[key];
      }
    });
    if (values.dataNascimento) {
      const parts = String(values.dataNascimento).split("-");
      if (parts.length === 3 && el("dataNascimento")) {
        el("dataNascimento").value = parts[2] + "/" + parts[1] + "/" + parts[0];
      }
    }
    ["rgExpedicao", "dataCasamento", "esposaNascimento", "dataAdmissaoEmpresa"].forEach(function (id) {
      const iso = values[id];
      if (iso && el(id) && iso.indexOf("-") === 4) {
        const parts = iso.split("-");
        el(id).value = parts[2] + "/" + parts[1] + "/" + parts[0];
      }
    });
    if (el("consentimentoEsposa")) el("consentimentoEsposa").checked = Boolean(values.consentimentoFamiliar && (values.estadoCivil === "casado" || values.estadoCivil === "uniao_estavel"));
    if (el("consentimentoMae")) el("consentimentoMae").checked = Boolean(values.consentimentoFamiliar && (values.estadoCivil === "solteiro" || values.estadoCivil === "divorciado"));
    if (el("lgpdAceite")) el("lgpdAceite").checked = Boolean(values.lgpdAceite);
    if (el("naoPossuiPlanoSaude")) {
      el("naoPossuiPlanoSaude").checked = Boolean(values.naoPossuiPlanoSaude || values.planoSaude === PLANO_SAUDE_AUSENTE);
    }
    syncPlanoSaude();
    setRadio("possuiFilhos", draft.possuiFilhos);
    setRadio("foiMilitar", draft.foiMilitar);
    setRadio("processoCriminal", draft.processoCriminal);
    setRadio("filiacaoPartidaria", draft.filiacaoPartidaria);
    if (Array.isArray(values.filhos)) {
      values.filhos.forEach(function (filho) {
        const iso = filho.dataNascimento || "";
        const parts = iso.split("-");
        addFilho({
          nome: filho.nome,
          sexo: filho.sexo,
          dataNascimento: parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : "",
        });
      });
    }
    renderReferencias();
    if (Array.isArray(values.referencias)) {
      values.referencias.forEach(function (item, index) {
        const n = index + 1;
        if (el("ref" + n + "Nome")) el("ref" + n + "Nome").value = item.nome || "";
        if (el("ref" + n + "Telefone")) el("ref" + n + "Telefone").value = item.telefone || "";
        if (el("ref" + n + "Logradouro")) el("ref" + n + "Logradouro").value = item.logradouro || "";
        if (el("ref" + n + "Bairro")) el("ref" + n + "Bairro").value = item.bairro || "";
        if (el("ref" + n + "Cidade")) el("ref" + n + "Cidade").value = item.cidade || "";
        if (el("ref" + n + "Estado")) el("ref" + n + "Estado").value = item.estado || "";
        if (el("ref" + n + "Cep")) el("ref" + n + "Cep").value = item.cep || "";
      });
    }
    const comercial = values.referenciaComercial || {};
    if (el("refComercialNome")) el("refComercialNome").value = comercial.nome || "";
    if (el("refComercialTelefone")) el("refComercialTelefone").value = comercial.telefone || "";
    if (el("refComercialLogradouro")) el("refComercialLogradouro").value = comercial.logradouro || "";
    if (el("refComercialBairro")) el("refComercialBairro").value = comercial.bairro || "";
    if (el("refComercialCidade")) el("refComercialCidade").value = comercial.cidade || "";
    if (el("refComercialEstado")) el("refComercialEstado").value = comercial.estado || "";
    if (el("refComercialCep")) el("refComercialCep").value = comercial.cep || "";
    if (values.proponenteId) {
      el("proponenteId").value = values.proponenteId;
      el("proponenteNome").value = values.proponenteNome || "";
      el("proponenteBusca").value = values.proponenteNome || "";
      el("proponenteSelecionado").hidden = false;
      el("proponenteSelecionado").textContent = "✓ " + (values.proponenteNome || "");
    }
    syncConditional();
    if (draft.step) showStep(Number(draft.step) || 1);
  }

  function setRadio(name, on) {
    const yes = form.querySelector("input[name='" + name + "'][value='true']");
    const no = form.querySelector("input[name='" + name + "'][value='false']");
    if (on && yes) yes.checked = true;
    else if (no) no.checked = true;
  }

  async function consultarCep() {
    const cep = onlyDigits(el("cep").value);
    if (cep.length !== 8) return;
    setError("cep", "");
    el("cep-hint").textContent = "Consultando o CEP...";
    try {
      const response = await fetch("https://viacep.com.br/ws/" + cep + "/json/");
      const data = await response.json();
      if (data.erro) {
        setError("cep", "Não encontramos o CEP informado.");
        el("cep-hint").textContent = "Você pode preencher o endereço manualmente.";
        return;
      }
      if (data.logradouro) el("logradouro").value = data.logradouro;
      if (data.bairro) el("bairro").value = data.bairro;
      if (data.localidade) el("cidade").value = data.localidade;
      if (data.uf) el("estado").value = data.uf;
      el("cep-hint").textContent = "Endereço preenchido. Revise e complete o número.";
      el("numero").focus();
    } catch (error) {
      el("cep-hint").textContent = "Não foi possível consultar o CEP. Preencha o endereço manualmente.";
    }
  }

  function updateCount() {
    const field = el("motivacao");
    if (el("motivacao-count") && field) {
      el("motivacao-count").textContent = (field.value || "").length + " / " + motivacaoMax;
    }
  }

  function functionUrl(name) {
    return String(config.supabaseUrl || "").replace(/\/$/, "") + "/functions/v1/" + name;
  }

  function clearProponente() {
    el("proponenteId").value = "";
    el("proponenteNome").value = "";
    el("proponenteSelecionado").hidden = true;
    el("proponenteSelecionado").textContent = "";
  }

  async function buscarProponente() {
    const q = collapseSpaces(el("proponenteBusca").value);
    const box = el("proponenteSugestoes");
    if (q.length < 4) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    if (!config.supabaseUrl || !config.supabaseAnonKey) return;
    if (searchAbort) searchAbort.abort();
    searchAbort = new AbortController();
    try {
      const response = await fetch(functionUrl("buscar-proponente"), {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
        body: JSON.stringify({ q: q }),
        signal: searchAbort.signal,
      });
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok || !result.ok) {
        setError("proponenteBusca", result.error || "Não foi possível buscar.");
        return;
      }
      const list = result.resultados || [];
      box.innerHTML = "";
      setError("proponenteBusca", "");
      if (!list.length) {
        box.hidden = false;
        box.innerHTML = "<li class='proponente-empty'>Nenhum irmão encontrado.<br />Tente outro nome.</li>";
        return;
      }
      list.forEach(function (item) {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.nome;
        button.addEventListener("click", function () {
          el("proponenteId").value = item.id;
          el("proponenteNome").value = item.nome;
          el("proponenteBusca").value = item.nome;
          el("proponenteSelecionado").hidden = false;
          el("proponenteSelecionado").textContent = "✓ " + item.nome;
          box.hidden = true;
          setError("proponenteBusca", "");
          saveDraft();
        });
        li.appendChild(button);
        box.appendChild(li);
      });
      box.hidden = false;
    } catch (error) {
      if (error && error.name === "AbortError") return;
      setError("proponenteBusca", "Não foi possível buscar.");
    }
  }

  function bindDateMasks(root) {
    (root || form).querySelectorAll(".date-mask").forEach(function (input) {
      if (input.dataset.maskBound) return;
      input.dataset.maskBound = "1";
      input.addEventListener("input", function () {
        input.value = formatDateBr(input.value);
      });
    });
  }

  function syncPlanoSaude() {
    const sem = Boolean(el("naoPossuiPlanoSaude") && el("naoPossuiPlanoSaude").checked);
    if (!el("planoSaude")) return;
    el("planoSaude").disabled = sem;
    if (sem) {
      el("planoSaude").value = "";
      setError("planoSaude", "");
    }
  }

  fillUfs();
  renderReferencias();
  if (el("motivacao")) el("motivacao").maxLength = motivacaoMax;
  const hintText = el("dataNascimento-hint-text") || el("dataNascimento-hint");
  if (hintText) {
    hintText.textContent = "Para o Cadastro do candidato, a idade mínima é de " + idadeMinima + " anos.";
  }
  bindDateMasks(form);
  syncConditional();
  syncPlanoSaude();
  updateCount();

  (function setupDatePicker() {
    const field = el("dataNascimento");
    const wrap = field && field.closest(".date-field");
    if (!field) return;

    const today = new Date();
    const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
    const applyMask = function (input) {
      input.addEventListener("input", function () {
        input.value = formatDateBr(input.value);
      });
      input.addEventListener("blur", function () {
        const parsed = parseDateBr(input.value);
        if (!parsed) return;
        if (parsed > today) {
          if (getDatePicker()) getDatePicker().clear();
          else input.value = "";
          return;
        }
        if (getDatePicker()) getDatePicker().setDate(parsed, false);
      });
    };

    if (window.flatpickr && wrap) {
      const locale = (window.flatpickr.l10ns && window.flatpickr.l10ns.pt) || "pt";
      window.flatpickr(wrap, {
        wrap: true,
        appendTo: document.body,
        locale: locale,
        dateFormat: "d/m/Y",
        allowInput: true,
        disableMobile: true,
        monthSelectorType: "dropdown",
        minDate: minDate,
        maxDate: today,
        onOpen: function (selectedDates, _dateStr, instance) {
          if (!selectedDates.length) instance.jumpToDate(new Date(today.getFullYear() - 30, 0, 1), false);
        },
        onChange: function (selectedDates, _dateStr, instance) {
          if (selectedDates.length && instance.isOpen) {
            instance.close();
            const next = el("cpf");
            if (next) next.focus();
          }
        },
        onReady: function (_dates, _str, instance) {
          const input = instance.input;
          input.setAttribute("placeholder", "dd/mm/aaaa");
          input.setAttribute("inputmode", "numeric");
          input.setAttribute("maxlength", "10");
          applyMask(input);
        },
      });
    } else {
      applyMask(field);
    }
  })();

  el("estadoCivil").addEventListener("change", function () {
    syncConditional();
    if (currentStep === 6) renderDocuments();
  });
  if (el("naoPossuiPlanoSaude")) {
    el("naoPossuiPlanoSaude").addEventListener("change", syncPlanoSaude);
  }
  ["possuiFilhos", "foiMilitar", "processoCriminal", "filiacaoPartidaria"].forEach(function (name) {
    form.querySelectorAll("input[name='" + name + "']").forEach(function (input) {
      input.addEventListener("change", syncConditional);
    });
  });
  el("cpf").addEventListener("input", function () {
    el("cpf").value = formatCpf(el("cpf").value);
  });
  ["whatsapp", "esposaWhatsapp", "maeWhatsapp", "telefoneEmergencia", "empresaTelefone", "refComercialTelefone"].forEach(function (id) {
    if (!el(id)) return;
    el(id).addEventListener("input", function () {
      el(id).value = formatWhatsapp(el(id).value);
    });
  });
  el("cep").addEventListener("input", function () {
    el("cep").value = formatCep(el("cep").value);
  });
  el("cep").addEventListener("blur", consultarCep);
  ["empresaCep", "refComercialCep"].forEach(function (id) {
    if (!el(id)) return;
    el(id).addEventListener("input", function () {
      el(id).value = formatCep(el(id).value);
    });
  });
  el("email").addEventListener("blur", function () {
    el("email").value = collapseSpaces(el("email").value).toLowerCase();
  });
  el("emailConfirmacao").addEventListener("blur", function () {
    el("emailConfirmacao").value = collapseSpaces(el("emailConfirmacao").value).toLowerCase();
  });
  el("motivacao").addEventListener("input", updateCount);
  if (el("add-filho")) {
    el("add-filho").addEventListener("click", function () {
      addFilho();
    });
  }
  form.addEventListener("click", function (event) {
    const target = event.target && event.target.closest
      ? event.target.closest("[data-remove-filho], [data-replace-doc], [data-remove-doc], [data-edit-step]")
      : event.target;
    if (!target) return;
    if (target.getAttribute("data-remove-filho") !== null) {
      const item = target.closest(".collection-item");
      if (item) item.remove();
      renumberFilhos();
      return;
    }
    const replaceTipo = target.getAttribute("data-replace-doc");
    if (replaceTipo) {
      replacingDocs[replaceTipo] = true;
      if (currentStep === 3) renderFamilyUpload();
      else renderDocuments();
      const input = el("doc-" + replaceTipo);
      if (input && input.click) input.click();
      return;
    }
    const removeTipo = target.getAttribute("data-remove-doc");
    if (removeTipo) {
      delete files[removeTipo];
      replacingDocs[removeTipo] = false;
      if (el("doc-" + removeTipo)) el("doc-" + removeTipo).value = "";
      if (currentStep === 3) renderFamilyUpload();
      else if (currentStep === 6) renderDocuments();
      return;
    }
    const edit = target.getAttribute("data-edit-step");
    if (edit) {
      editingFromReview = true;
      editSnapshot = captureEditSnapshot();
      showStep(Number(edit));
    }
  });
  form.addEventListener("change", function (event) {
    if (event.target && event.target.getAttribute("data-doc-type")) onDocumentChange(event);
  });
  form.addEventListener("input", function (event) {
    if (event.target && event.target.classList.contains("phone-mask")) {
      event.target.value = formatWhatsapp(event.target.value);
    }
    if (event.target && event.target.classList.contains("cep-mask")) {
      event.target.value = formatCep(event.target.value);
    }
  });
  el("proponenteBusca").addEventListener("input", function () {
    clearProponente();
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(buscarProponente, 300);
  });
  nextButton.addEventListener("click", function () {
    setStatus("");
    if (!validate(currentStep)) {
      setStatus(reviewStatusMessage(), "error");
      focusFirstInvalid();
      return;
    }
    if (editingFromReview) {
      editingFromReview = false;
      editSnapshot = null;
      showStep(7);
      return;
    }
    showStep(Math.min(7, currentStep + 1));
  });
  backButton.addEventListener("click", function () {
    setStatus("");
    if (editingFromReview) {
      restoreEditSnapshot(editSnapshot);
      editSnapshot = null;
      editingFromReview = false;
      showStep(7);
      return;
    }
    showStep(Math.max(1, currentStep - 1));
  });

  restoreDraft();
  showStep(currentStep);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (submitting) return;
    submitting = true;
    setStatus("");
    if (!validate()) {
      submitting = false;
      setStatus(reviewStatusMessage(), "error");
      focusFirstInvalid();
      return;
    }
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      submitting = false;
      setStatus("O envio ainda não está configurado.", "error");
      return;
    }

    form.setAttribute("aria-busy", "true");
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    try {
      if (!uploadToken) {
        const response = await fetch(functionUrl("registrar-interesse"), {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
          body: JSON.stringify(payload()),
        });
        const result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Não foi possível enviar o cadastro.");
        }
        uploadToken = result.uploadToken || "";
        saveDraft();
      }
      if (!uploadToken) throw new Error("Não foi possível iniciar o envio de documentos.");

      const tipos = requiredDocumentTypes();
      for (let index = 0; index < tipos.length; index += 1) {
        const tipo = tipos[index];
        const file = files[tipo];
        if (!file) throw new Error("Há documentos obrigatórios pendentes.");
        const body = new FormData();
        body.append("token", uploadToken);
        body.append("tipo", tipo);
        body.append("arquivo", file, file.name);
        submitButton.textContent = "Enviando documentos...";
        const uploaded = await fetch(functionUrl("enviar-documento-candidatura"), {
          method: "POST",
          headers: { apikey: config.supabaseAnonKey },
          body: body,
        });
        const uploadedResult = await uploaded.json().catch(function () { return {}; });
        if (!uploaded.ok || !uploadedResult.ok) {
          throw new Error(uploadedResult.error || "Não foi possível enviar os documentos.");
        }
      }

      submitButton.textContent = "Concluindo...";
      const done = await fetch(functionUrl("registrar-interesse"), {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
        body: JSON.stringify({ acao: "concluir", token: uploadToken }),
      });
      const finished = await done.json().catch(function () { return {}; });
      if (!done.ok || !finished.ok) {
        throw new Error(finished.error || "Não foi possível concluir o cadastro.");
      }
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.setItem(
        "lacosManifestacao",
        JSON.stringify({
          ok: true,
          registrationSuccess: true,
          nome: collapseSpaces(el("nome").value),
          token: finished.token || "",
          at: Date.now(),
        })
      );
      window.location.href = "confirmacao.html";
    } catch (error) {
      setStatus(error.message || "Não foi possível enviar o cadastro.", "error");
      submitting = false;
      form.removeAttribute("aria-busy");
      submitButton.disabled = false;
      submitButton.textContent = defaultSubmitLabel;
    }
  });
})();

(function () {
  const cartilhaSection = document.querySelector("#cartilha");
  if (!cartilhaSection) return;

  const config = window.APP_CONFIG || {};
  const title = document.querySelector("#confirm-title");
  const cartilhaStatus = document.querySelector("#cartilha-status");
  const cartilhaAcesso = document.querySelector("#cartilha-acesso");
  const cartilhaActions = document.querySelector("#cartilha-actions");
  const cartilhaLer = document.querySelector("#cartilha-ler");
  const cartilhaBaixar = document.querySelector("#cartilha-baixar");
  const cartilhaStateTitle = document.querySelector("#cartilha-state-title");
  const cartilhaTitulo = document.querySelector("#cartilha-titulo");
  const cartilhaStateCopy = document.querySelector("#cartilha-state-copy");
  const cartilhaBadge = document.querySelector("#cartilha-badge");
  const cartilhaBadgeMobile = document.querySelector("#cartilha-badge-mobile");
  const cartilhaDocLead = document.querySelector("#cartilha-doc-lead");

  let data = null;
  try {
    data = JSON.parse(sessionStorage.getItem("lacosManifestacao") || "");
  } catch (error) {
    data = null;
  }

  if (!data || !data.ok || !data.nome) {
    window.location.replace("interesse.html");
    return;
  }

  if (title) {
    title.textContent = "Obrigado, " + String(data.nome).split(" ")[0] + ".";
  }

  let cartilhaToken = data.token || "";
  let cartilhaBlobUrl = null;
  let cartilhaRequest = null;

  function persistCartilha(extra) {
    if (!data) return;
    Object.keys(extra).forEach(function (key) {
      data[key] = extra[key];
    });
    sessionStorage.setItem("lacosManifestacao", JSON.stringify(data));
  }

  function setCartilhaState(state) {
    cartilhaSection.hidden = false;
    cartilhaSection.setAttribute("data-state", state);
    const inactive = state === "expired" || state === "consumed";
    if (state === "expired") {
      if (cartilhaStateTitle) cartilhaStateTitle.textContent = "O acesso à cartilha expirou";
      if (cartilhaTitulo) cartilhaTitulo.textContent = "O acesso à cartilha expirou";
      if (cartilhaStateCopy) {
        cartilhaStateCopy.textContent = "Por segurança, este acesso temporário não está mais disponível. Caso precise acessar novamente o material, entre em contato com a Secretaria.";
      }
      if (cartilhaAcesso) cartilhaAcesso.textContent = "O acesso à cartilha expirou.";
      if (cartilhaDocLead) cartilhaDocLead.textContent = "Por segurança, este acesso temporário não está mais disponível.";
    } else if (state === "consumed") {
      if (cartilhaStateTitle) cartilhaStateTitle.textContent = "Cartilha acessada";
      if (cartilhaTitulo) cartilhaTitulo.textContent = "Cartilha acessada";
      if (cartilhaStateCopy) cartilhaStateCopy.textContent = "Este acesso temporário já foi utilizado.";
      if (cartilhaAcesso) cartilhaAcesso.textContent = "Este acesso temporário já foi utilizado.";
      if (cartilhaDocLead) cartilhaDocLead.textContent = "Este acesso temporário já foi utilizado.";
    } else {
      if (cartilhaStateTitle) cartilhaStateTitle.textContent = "Cartilha de orientação ao candidato";
      if (cartilhaTitulo) cartilhaTitulo.textContent = "Cartilha de orientação ao candidato";
      if (cartilhaStateCopy) {
        cartilhaStateCopy.textContent = "Este material ajuda a compreender os princípios da Maçonaria e o processo de ingresso, com clareza e discrição, antes das próximas etapas.";
      }
      if (cartilhaAcesso) cartilhaAcesso.textContent = "O acesso se encerra após o primeiro uso.";
      if (cartilhaDocLead) cartilhaDocLead.textContent = "Material preparado para orientar seus próximos passos.";
    }
    if (cartilhaBadge) cartilhaBadge.hidden = inactive;
    if (cartilhaBadgeMobile) cartilhaBadgeMobile.hidden = inactive;
    if (cartilhaActions) cartilhaActions.hidden = inactive;
    if (cartilhaLer) {
      cartilhaLer.hidden = inactive;
      cartilhaLer.disabled = inactive;
    }
    if (cartilhaBaixar) {
      cartilhaBaixar.hidden = inactive;
      cartilhaBaixar.disabled = inactive;
    }
    if (inactive && cartilhaStatus) cartilhaStatus.textContent = "";
  }

  function functionUrl(name) {
    return String(config.supabaseUrl || "").replace(/\/$/, "") + "/functions/v1/" + name;
  }

  async function obterCartilha() {
    if (cartilhaBlobUrl) return cartilhaBlobUrl;
    if (!cartilhaToken) {
      setCartilhaState(data && data.cartilhaState === "consumed" ? "consumed" : "expired");
      throw new Error(data && data.cartilhaState === "consumed"
        ? "Este acesso temporário já foi utilizado."
        : "O acesso à cartilha expirou.");
    }
    if (!cartilhaRequest) {
      cartilhaRequest = fetch(functionUrl("abrir-cartilha"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.supabaseAnonKey,
        },
        body: JSON.stringify({ token: cartilhaToken }),
      })
        .then(async function (response) {
          if (response.status === 410 || response.status === 404) {
            persistCartilha({ token: "", cartilhaState: "expired" });
            setCartilhaState("expired");
            const payload = await response.json().catch(function () { return {}; });
            throw new Error(payload.error || "O acesso à cartilha expirou.");
          }
          if (!response.ok) {
            const payload = await response.json().catch(function () {
              return {};
            });
            throw new Error(payload.error || "Não foi possível liberar a cartilha.");
          }
          const blob = await response.blob();
          cartilhaBlobUrl = URL.createObjectURL(blob);
          cartilhaToken = "";
          persistCartilha({ token: "", cartilhaState: "consumed" });
          return cartilhaBlobUrl;
        })
        .finally(function () {
          cartilhaRequest = null;
        });
    }
    return cartilhaRequest;
  }

  async function usarCartilha(acao) {
    const current = cartilhaSection.getAttribute("data-state");
    if (current === "expired" || current === "consumed") return;
    if (cartilhaStatus) cartilhaStatus.textContent = "Preparando o acesso à cartilha...";
    try {
      const url = await obterCartilha();
      if (cartilhaStatus) cartilhaStatus.textContent = "";
      if (acao === "baixar") {
        const link = document.createElement("a");
        link.href = url;
        link.download = "Cartilha-do-Candidato.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        window.open(url, "_blank", "noopener");
      }
      setCartilhaState("consumed");
    } catch (error) {
      const after = cartilhaSection.getAttribute("data-state");
      if (after === "expired" || after === "consumed") return;
      if (cartilhaStatus) cartilhaStatus.textContent = error.message;
    }
  }

  if (data.cartilhaState === "consumed") {
    setCartilhaState("consumed");
  } else if (data.cartilhaState === "expired") {
    setCartilhaState("expired");
  } else if (cartilhaToken && config.supabaseUrl && config.supabaseAnonKey) {
    setCartilhaState("active");
  } else {
    setCartilhaState("expired");
  }

  if (cartilhaLer) {
    cartilhaLer.addEventListener("click", function () {
      usarCartilha("ler");
    });
  }
  if (cartilhaBaixar) {
    cartilhaBaixar.addEventListener("click", function () {
      usarCartilha("baixar");
    });
  }
})();

