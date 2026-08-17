(function () {
  const form = document.querySelector("#interest-form");
  if (!form) return;

  const config = window.APP_CONFIG || {};
  const idadeMinima = Number(config.idadeMinima || 21);
  const motivacaoMin = Number(config.motivacaoMin || 100);
  const motivacaoMax = Number(config.motivacaoMax || 2000);
  const statusMessage = document.querySelector("#form-status");
  const submitButton = document.querySelector("#submit-button");
  const defaultSubmitLabel = (submitButton && submitButton.textContent) || "Enviar manifestação";
  const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

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

  function syncConditional() {
    const value = estadoCivil();
    const conjuge = value === "casado" || value === "uniao_estavel";
    const mae = value === "solteiro" || value === "divorciado";
    const outro = value === "viuvo" || value === "outro";
    el("bloco-conjuge").hidden = !conjuge;
    el("bloco-mae").hidden = !mae;
    el("bloco-outro").hidden = !outro;
  }

  function fillUfs() {
    const select = el("estado");
    ufs.forEach(function (uf) {
      const option = document.createElement("option");
      option.value = uf;
      option.textContent = uf;
      select.appendChild(option);
    });
  }

  function setStatus(message, type) {
    statusMessage.className = "form-status" + (type ? " " + type : "");
    statusMessage.textContent = message || "";
  }

  function validate() {
    clearAllErrors();
    let ok = true;
    const mark = function (id, message) {
      setError(id, message);
      ok = false;
    };

    if (!isValidNome(el("nome").value)) mark("nome", "Informe seu nome completo.");
    const birth = el("dataNascimento").value;
    if (!birth) mark("dataNascimento", "Informe sua data de nascimento.");
    else if (new Date(birth + "T00:00:00") > new Date()) mark("dataNascimento", "Informe uma data de nascimento válida.");
    else if (idadeEmAnos(birth) < idadeMinima) mark("dataNascimento", "A idade mínima para manifestar interesse é " + idadeMinima + " anos.");
    if (!isValidCpf(el("cpf").value)) mark("cpf", "Informe um CPF válido.");
    if (!estadoCivil()) mark("estadoCivil", "Selecione o estado civil.");

    if (estadoCivil() === "casado" || estadoCivil() === "uniao_estavel") {
      if (!isValidNome(el("esposaNome").value)) mark("esposaNome", "Informe o nome completo da esposa ou companheira.");
      if (!isValidWhatsapp(el("esposaWhatsapp").value)) mark("esposaWhatsapp", "Informe o WhatsApp da esposa ou companheira.");
      if (!el("consentimentoEsposa").checked) mark("consentimentoEsposa", "Confirme a ciência sobre o consentimento da esposa ou companheira.");
    } else if (estadoCivil() === "solteiro" || estadoCivil() === "divorciado") {
      if (!isValidNome(el("maeNome").value)) mark("maeNome", "Informe o nome completo da mãe.");
      if (!isValidWhatsapp(el("maeWhatsapp").value)) mark("maeWhatsapp", "Informe um WhatsApp da mãe.");
      if (!el("consentimentoMae").checked) mark("consentimentoMae", "Confirme a ciência sobre o consentimento da mãe.");
    } else if (estadoCivil() === "viuvo" || estadoCivil() === "outro") {
      if (collapseSpaces(el("situacaoFamiliar").value).length < 8) mark("situacaoFamiliar", "Descreva brevemente sua situação familiar.");
    }

    if (!isValidWhatsapp(el("whatsapp").value)) mark("whatsapp", "Informe um WhatsApp com DDD.");
    const email = collapseSpaces(el("email").value).toLowerCase();
    const email2 = collapseSpaces(el("emailConfirmacao").value).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) mark("email", "Informe um endereço de e-mail válido.");
    if (email !== email2) mark("emailConfirmacao", "A confirmação de e-mail não confere.");
    if (onlyDigits(el("cep").value).length !== 8) mark("cep", "Informe um CEP válido.");
    if (collapseSpaces(el("logradouro").value).length < 3) mark("logradouro", "Informe o logradouro.");
    if (!collapseSpaces(el("numero").value)) mark("numero", "Informe o número ou S/N.");
    if (collapseSpaces(el("bairro").value).length < 2) mark("bairro", "Informe o bairro.");
    if (collapseSpaces(el("cidade").value).length < 2) mark("cidade", "Informe a cidade.");
    if (!el("estado").value) mark("estado", "Selecione o estado.");
    const motivacao = el("motivacao").value.trim();
    if (motivacao.replace(/\s+/g, " ").length < motivacaoMin) mark("motivacao", "Sua resposta deve possuir pelo menos " + motivacaoMin + " caracteres.");
    if (motivacao.length > motivacaoMax) mark("motivacao", "Sua resposta deve ter no máximo " + motivacaoMax + " caracteres.");
    if (!el("lgpdAceite").checked) mark("lgpdAceite", "É necessário autorizar o tratamento dos dados para continuar.");
    return ok;
  }

  function payload() {
    const civil = estadoCivil();
    const conjuge = civil === "casado" || civil === "uniao_estavel";
    const mae = civil === "solteiro" || civil === "divorciado";
    return {
      website: el("website").value,
      nome: el("nome").value,
      dataNascimento: el("dataNascimento").value,
      cpf: el("cpf").value,
      estadoCivil: civil,
      familiarNome: conjuge ? el("esposaNome").value : mae ? el("maeNome").value : "",
      familiarWhatsapp: conjuge ? el("esposaWhatsapp").value : mae ? el("maeWhatsapp").value : "",
      consentimentoFamiliar: conjuge ? el("consentimentoEsposa").checked : mae ? el("consentimentoMae").checked : false,
      situacaoFamiliar: !conjuge && !mae ? el("situacaoFamiliar").value : "",
      whatsapp: el("whatsapp").value,
      email: el("email").value,
      emailConfirmacao: el("emailConfirmacao").value,
      cep: el("cep").value,
      logradouro: el("logradouro").value,
      numero: el("numero").value,
      complemento: el("complemento").value,
      bairro: el("bairro").value,
      cidade: el("cidade").value,
      estado: el("estado").value,
      motivacao: el("motivacao").value,
      lgpdAceite: el("lgpdAceite").checked,
      lgpdVersao: config.lgpdVersao || "2026-08-17",
    };
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
    el("motivacao-count").textContent = (field.value || "").length + " / " + motivacaoMax;
  }

  let submitting = false;

  fillUfs();
  el("dataNascimento").max = new Date().toISOString().slice(0, 10);
  el("motivacao").maxLength = motivacaoMax;
  el("dataNascimento-hint").textContent = "Idade mínima de " + idadeMinima + " anos.";
  syncConditional();
  updateCount();

  el("estadoCivil").addEventListener("change", syncConditional);
  el("cpf").addEventListener("input", function () {
    el("cpf").value = formatCpf(el("cpf").value);
  });
  ["whatsapp", "esposaWhatsapp", "maeWhatsapp"].forEach(function (id) {
    el(id).addEventListener("input", function () {
      el(id).value = formatWhatsapp(el(id).value);
    });
  });
  el("cep").addEventListener("input", function () {
    el("cep").value = formatCep(el("cep").value);
  });
  el("cep").addEventListener("blur", consultarCep);
  el("email").addEventListener("blur", function () {
    el("email").value = collapseSpaces(el("email").value).toLowerCase();
  });
  el("emailConfirmacao").addEventListener("blur", function () {
    el("emailConfirmacao").value = collapseSpaces(el("emailConfirmacao").value).toLowerCase();
  });
  el("motivacao").addEventListener("input", updateCount);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (submitting) return;
    setStatus("");
    if (!validate()) {
      setStatus("Revise os campos destacados.", "error");
      const invalid = form.querySelector(".is-invalid");
      if (invalid) invalid.focus();
      return;
    }
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      setStatus("O envio ainda não está configurado.", "error");
      return;
    }

    submitting = true;
    form.setAttribute("aria-busy", "true");
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    try {
      const response = await fetch(String(config.supabaseUrl).replace(/\/$/, "") + "/functions/v1/registrar-interesse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.supabaseAnonKey,
        },
        body: JSON.stringify(payload()),
      });
      const result = await response.json().catch(function () {
        return {};
      });
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Não foi possível registrar o interesse.");
      }
      sessionStorage.setItem(
        "lacosManifestacao",
        JSON.stringify({
          ok: true,
          nome: collapseSpaces(el("nome").value),
          at: Date.now(),
        })
      );
      window.location.href = "confirmacao.html";
    } catch (error) {
      setStatus(error.message || "Não foi possível registrar o interesse.", "error");
      submitting = false;
      form.removeAttribute("aria-busy");
      submitButton.disabled = false;
      submitButton.textContent = defaultSubmitLabel;
    }
  });
})();
