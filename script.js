(function () {
  const form = document.querySelector("#interest-form");
  const cpfInput = document.querySelector("#cpf");
  const statusMessage = document.querySelector("#form-status");
  const submitButton = document.querySelector("#submit-button");
  const cartilhaSection = document.querySelector("#cartilha");
  const cartilhaStatus = document.querySelector("#cartilha-status");
  const cartilhaLer = document.querySelector("#cartilha-ler");
  const cartilhaBaixar = document.querySelector("#cartilha-baixar");

  if (!form || !cpfInput || !statusMessage || !submitButton) {
    return;
  }

  const fields = {
    nome: document.querySelector("#nome"),
    cpf: cpfInput,
    email: document.querySelector("#email"),
    endereco: document.querySelector("#endereco"),
  };

  const config = window.APP_CONFIG || {};
  const defaultSubmitLabel = (submitButton.textContent || "").trim();

  let cartilhaToken = null;
  let cartilhaBlobUrl = null;
  let cartilhaRequest = null;

  function formatCpf(value) {
    return value
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function isValidCpf(value) {
    const cpf = value.replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    const calculateDigit = (length) => {
      let sum = 0;
      for (let index = 0; index < length; index += 1) {
        sum += Number(cpf[index]) * (length + 1 - index);
      }
      const remainder = (sum * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };

    return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
  }

  function showError(fieldName, message) {
    const field = fields[fieldName];
    const error = document.querySelector("#" + fieldName + "-error");
    if (!field) return;
    field.classList.add("is-invalid");
    field.setAttribute("aria-invalid", "true");
    if (error) error.textContent = message;
  }

  function clearError(fieldName) {
    const field = fields[fieldName];
    const error = document.querySelector("#" + fieldName + "-error");
    if (!field) return;
    field.classList.remove("is-invalid");
    field.removeAttribute("aria-invalid");
    if (error) error.textContent = "";
  }

  function setStatus(message, type) {
    statusMessage.className = "form-status" + (type ? " " + type : "");
    statusMessage.textContent = message;
  }

  function validateForm() {
    let isValid = true;
    Object.keys(fields).forEach(clearError);

    if (!fields.nome || fields.nome.value.trim().split(/\s+/).length < 2 || fields.nome.value.trim().length < 5) {
      showError("nome", "Informe seu nome completo.");
      isValid = false;
    }

    if (!isValidCpf(fields.cpf.value)) {
      showError("cpf", "Informe um CPF válido.");
      isValid = false;
    }

    if (!fields.email || !fields.email.validity.valid) {
      showError("email", "Informe um endereço de e-mail válido.");
      isValid = false;
    }

    if (!fields.endereco || fields.endereco.value.trim().length < 8) {
      showError("endereco", "Informe um endereço mais completo.");
      isValid = false;
    }

    return isValid;
  }

  function backendConfigured() {
    return Boolean(config.supabaseUrl && config.supabaseAnonKey);
  }

  function functionUrl(name) {
    return String(config.supabaseUrl).replace(/\/$/, "") + "/functions/v1/" + name;
  }

  function backendHeaders() {
    return {
      "Content-Type": "application/json",
      apikey: config.supabaseAnonKey,
    };
  }

  async function registrarInteresse() {
    const response = await fetch(functionUrl("registrar-interesse"), {
      method: "POST",
      headers: backendHeaders(),
      body: JSON.stringify({
        nome: fields.nome.value,
        cpf: fields.cpf.value,
        email: fields.email.value,
        endereco: fields.endereco.value,
        consentimento: true,
      }),
    });

    const payload = await response.json().catch(function () {
      return {};
    });
    if (!response.ok || !payload.ok || !payload.token) {
      throw new Error(payload.error || "Não foi possível registrar o interesse.");
    }

    return payload;
  }

  async function obterCartilha() {
    if (cartilhaBlobUrl) return cartilhaBlobUrl;
    if (!cartilhaToken) {
      throw new Error("O acesso à cartilha não está mais disponível.");
    }

    if (!cartilhaRequest) {
      cartilhaRequest = fetch(functionUrl("abrir-cartilha"), {
        method: "POST",
        headers: backendHeaders(),
        body: JSON.stringify({ token: cartilhaToken }),
      })
        .then(async function (response) {
          if (!response.ok) {
            const payload = await response.json().catch(function () {
              return {};
            });
            throw new Error(payload.error || "Não foi possível liberar a cartilha.");
          }

          const blob = await response.blob();
          cartilhaBlobUrl = URL.createObjectURL(blob);
          cartilhaToken = null;
          return cartilhaBlobUrl;
        })
        .finally(function () {
          cartilhaRequest = null;
        });
    }

    return cartilhaRequest;
  }

  function revelarCartilha() {
    form.hidden = true;
    if (cartilhaSection) cartilhaSection.hidden = false;
    if (cartilhaLer) cartilhaLer.disabled = false;
    if (cartilhaBaixar) cartilhaBaixar.disabled = false;
    if (cartilhaStatus) cartilhaStatus.textContent = "";
    if (cartilhaSection && cartilhaSection.scrollIntoView) {
      cartilhaSection.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function setSubmitting(isSubmitting) {
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "Registrando..." : defaultSubmitLabel;
  }

  cpfInput.addEventListener("input", function () {
    cpfInput.value = formatCpf(cpfInput.value);
    clearError("cpf");
  });

  Object.keys(fields).forEach(function (name) {
    const field = fields[name];
    if (!field) return;
    field.addEventListener("input", function () {
      clearError(name);
    });
    field.addEventListener("change", function () {
      clearError(name);
    });
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();
    setStatus("");

    if (!validateForm()) {
      setStatus("Revise os campos destacados.", "error");
      const invalid = form.querySelector(".is-invalid");
      if (invalid) invalid.focus();
      return;
    }

    if (!backendConfigured()) {
      setStatus("Os dados foram validados, mas o registro ainda não está configurado. A cartilha não foi liberada.", "error");
      return;
    }

    setSubmitting(true);

    try {
      const resultado = await registrarInteresse();
      cartilhaToken = resultado.token;
      cartilhaBlobUrl = null;
      form.reset();
      setStatus("Interesse registrado. A cartilha foi liberada com acesso temporário e exclusivo.", "success");
      revelarCartilha();
    } catch (error) {
      setStatus(error.message || "Não foi possível registrar o interesse.", "error");
    } finally {
      setSubmitting(false);
    }
  });

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

  async function usarCartilha(acao) {
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
        return;
      }

      window.open(url, "_blank", "noopener");
    } catch (error) {
      if (cartilhaStatus) cartilhaStatus.textContent = error.message;
    }
  }
})();
