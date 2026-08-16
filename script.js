const form = document.querySelector("#interest-form");
const cpfInput = document.querySelector("#cpf");
const statusMessage = document.querySelector("#form-status");
const submitButton = document.querySelector("#submit-button");
const cartilhaSection = document.querySelector("#cartilha");
const cartilhaStatus = document.querySelector("#cartilha-status");
const cartilhaLer = document.querySelector("#cartilha-ler");
const cartilhaBaixar = document.querySelector("#cartilha-baixar");

const fields = {
  nome: document.querySelector("#nome"),
  cpf: cpfInput,
  email: document.querySelector("#email"),
  endereco: document.querySelector("#endereco"),
};

const config = window.APP_CONFIG ?? {};
const defaultSubmitLabel = submitButton.textContent.trim();

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
  const error = document.querySelector(`#${fieldName}-error`);
  if (!field) return;
  field.classList.add("is-invalid");
  field.setAttribute("aria-invalid", "true");
  if (error) error.textContent = message;
}

function clearError(fieldName) {
  const field = fields[fieldName];
  const error = document.querySelector(`#${fieldName}-error`);
  if (!field) return;
  field.classList.remove("is-invalid");
  field.removeAttribute("aria-invalid");
  if (error) error.textContent = "";
}

function setStatus(message, type = "") {
  statusMessage.className = `form-status${type ? ` ${type}` : ""}`;
  statusMessage.textContent = message;
}

function validateForm() {
  let isValid = true;
  Object.keys(fields).forEach(clearError);

  if (fields.nome.value.trim().split(/\s+/).length < 2 || fields.nome.value.trim().length < 5) {
    showError("nome", "Informe seu nome completo.");
    isValid = false;
  }

  if (!isValidCpf(fields.cpf.value)) {
    showError("cpf", "Informe um CPF válido.");
    isValid = false;
  }

  if (!fields.email.validity.valid) {
    showError("email", "Informe um endereço de e-mail válido.");
    isValid = false;
  }

  if (fields.endereco.value.trim().length < 8) {
    showError("endereco", "Informe um endereço mais completo.");
    isValid = false;
  }

  return isValid;
}

function backendConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

function functionUrl(name) {
  return `${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/${name}`;
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

  const payload = await response.json().catch(() => ({}));
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
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Não foi possível liberar a cartilha.");
        }

        const blob = await response.blob();
        cartilhaBlobUrl = URL.createObjectURL(blob);
        cartilhaToken = null;
        return cartilhaBlobUrl;
      })
      .finally(() => {
        cartilhaRequest = null;
      });
  }

  return cartilhaRequest;
}

function revelarCartilha() {
  form.hidden = true;
  cartilhaSection.hidden = false;
  cartilhaLer.disabled = false;
  cartilhaBaixar.disabled = false;
  cartilhaStatus.textContent = "";
  cartilhaSection.scrollIntoView({ behavior: "smooth", block: "center" });
  document.querySelector("#cartilha-titulo")?.focus({ preventScroll: true });
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Registrando..." : defaultSubmitLabel;
}

cpfInput.addEventListener("input", () => {
  cpfInput.value = formatCpf(cpfInput.value);
  clearError("cpf");
});

Object.entries(fields).forEach(([name, field]) => {
  if (!field) return;
  field.addEventListener("input", () => clearError(name));
  field.addEventListener("change", () => clearError(name));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  if (!validateForm()) {
    setStatus("Revise os campos destacados.", "error");
    form.querySelector(".is-invalid, [aria-invalid='true']")?.focus();
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
    setStatus(error.message, "error");
  } finally {
    setSubmitting(false);
  }
});

async function usarCartilha(acao) {
  cartilhaStatus.textContent = "Preparando o acesso à cartilha...";

  try {
    const url = await obterCartilha();
    cartilhaStatus.textContent = "";

    if (acao === "baixar") {
      const link = document.createElement("a");
      link.href = url;
      link.download = "Cartilha-do-Candidato.pdf";
      link.click();
      return;
    }

    window.open(url, "_blank", "noopener");
  } catch (error) {
    cartilhaStatus.textContent = error.message;
  }
}

cartilhaLer.addEventListener("click", () => usarCartilha("ler"));
cartilhaBaixar.addEventListener("click", () => usarCartilha("baixar"));
