const form = document.querySelector("#interest-form");
const cpfInput = document.querySelector("#cpf");
const statusMessage = document.querySelector("#form-status");

const fields = {
  nome: document.querySelector("#nome"),
  cpf: cpfInput,
  email: document.querySelector("#email"),
  endereco: document.querySelector("#endereco"),
};

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
  field.classList.add("is-invalid");
  field.setAttribute("aria-invalid", "true");
  error.textContent = message;
}

function clearError(fieldName) {
  const field = fields[fieldName];
  const error = document.querySelector(`#${fieldName}-error`);
  field.classList.remove("is-invalid");
  field.removeAttribute("aria-invalid");
  error.textContent = "";
}

function validateForm() {
  let isValid = true;
  Object.keys(fields).forEach(clearError);

  if (fields.nome.value.trim().split(/\s+/).length < 2 || fields.nome.value.trim().length < 5) {
    showError("nome", "Informe seu nome completo.");
    isValid = false;
  }

  if (!isValidCpf(fields.cpf.value)) {
    showError("cpf", "Informe um CPF válido para testar a validação local.");
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

cpfInput.addEventListener("input", () => {
  cpfInput.value = formatCpf(cpfInput.value);
  clearError("cpf");
});

Object.entries(fields).forEach(([name, field]) => {
  field.addEventListener("input", () => clearError(name));
  field.addEventListener("change", () => clearError(name));
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  statusMessage.className = "form-status";

  if (!validateForm()) {
    statusMessage.textContent = "Revise os campos destacados.";
    statusMessage.classList.add("error");
    form.querySelector(".is-invalid")?.focus();
    return;
  }

  form.reset();
  statusMessage.textContent = "Informações validadas com sucesso.";
  statusMessage.classList.add("success");
});
