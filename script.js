// Calculadora sem eval(): a conta é feita passo a passo, respeitando a ordem de digitação
// (como uma calculadora de mesa), com correção de ponto flutuante.
const $ = (id) => document.getElementById(id);
const resultEl = $("result");
const exprEl = $("expr");

const state = { atual: "0", anterior: null, op: null, novoNumero: false, erro: false };
const simbolos = { "+": "+", "-": "−", "*": "×", "/": "÷" };
const MAX_DIGITOS = 16;

const arredondar = (n) => Math.round((n + Number.EPSILON) * 1e10) / 1e10;

function formatar(str) {
  if (state.erro) return str;
  const [int, dec] = str.split(".");
  const negativo = int.startsWith("-");
  const digitos = negativo ? int.slice(1) : int;
  const comMilhar = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (negativo ? "-" : "") + comMilhar + (dec !== undefined ? "," + dec : "");
}

function numeroParaTexto(n) {
  if (!isFinite(n)) return null;
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e16 || abs < 1e-9)) return n.toExponential(6);
  return String(arredondar(n));
}

function calcular(a, b, op) {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b === 0 ? NaN : a / b;
  }
}

function render() {
  const texto = state.erro ? state.atual : formatar(state.atual);
  resultEl.textContent = texto;
  resultEl.classList.toggle("is-small", texto.length > 11);
  resultEl.classList.toggle("is-error", state.erro);
  exprEl.textContent = state.op ? `${formatar(state.anterior)} ${simbolos[state.op]}` : " ";
  document.querySelectorAll("[data-op]").forEach((b) => b.classList.toggle("is-active", b.dataset.op === state.op && state.novoNumero));
}

function limpar() { Object.assign(state, { atual: "0", anterior: null, op: null, novoNumero: false, erro: false }); }

function digito(d) {
  if (state.erro) limpar();
  if (state.novoNumero) { state.atual = "0"; state.novoNumero = false; }
  if (state.atual.replace(/[-.]/g, "").length >= MAX_DIGITOS) return;
  state.atual = state.atual === "0" ? d : state.atual === "-0" ? "-" + d : state.atual + d;
}

function ponto() {
  if (state.erro) limpar();
  if (state.novoNumero) { state.atual = "0"; state.novoNumero = false; }
  if (!state.atual.includes(".")) state.atual += ".";
}

function operador(op) {
  if (state.erro) return;
  if (state.op && !state.novoNumero) {
    if (!igual(false)) return;
  }
  state.anterior = state.atual;
  state.op = op;
  state.novoNumero = true;
}

function igual(registrar = true) {
  if (state.op === null || state.erro) return true;
  const a = parseFloat(state.anterior), b = parseFloat(state.atual);
  const texto = numeroParaTexto(calcular(a, b, state.op));
  const conta = `${formatar(state.anterior)} ${simbolos[state.op]} ${formatar(state.atual)}`;
  if (texto === null) {
    Object.assign(state, { atual: "Não é possível dividir por zero", op: null, anterior: null, erro: true, novoNumero: true });
    return false;
  }
  if (registrar) addHistorico(conta, texto);
  Object.assign(state, { atual: texto, op: null, anterior: null, novoNumero: true });
  return true;
}

function apagar() {
  if (state.erro || state.novoNumero) return limpar();
  state.atual = state.atual.length > 1 && state.atual !== "-0" ? state.atual.slice(0, -1) : "0";
  if (state.atual === "-") state.atual = "0";
}

function sinal() {
  if (state.erro) return;
  state.atual = state.atual.startsWith("-") ? state.atual.slice(1) : "-" + state.atual;
  state.novoNumero = false;
}

function porcentagem() {
  if (state.erro) return;
  const b = parseFloat(state.atual);
  // 200 + 10% = 220 (10% de 200); sozinho: 10% = 0,1
  const v = state.op && (state.op === "+" || state.op === "-") ? parseFloat(state.anterior) * b / 100 : b / 100;
  state.atual = numeroParaTexto(v) ?? "0";
  state.novoNumero = false;
}

/* ---------- histórico ---------- */
const HKEY = "calc:historico";
let historico = [];
try { historico = JSON.parse(localStorage.getItem(HKEY)) || []; } catch {}

function addHistorico(conta, resultado) {
  historico.unshift({ conta, resultado });
  historico = historico.slice(0, 30);
  try { localStorage.setItem(HKEY, JSON.stringify(historico)); } catch {}
  renderHistorico();
}
function renderHistorico() {
  const lista = $("hist-lista");
  lista.replaceChildren();
  if (!historico.length) { lista.innerHTML = '<li class="empty">Nenhum cálculo ainda.</li>'; return; }
  historico.forEach(({ conta, resultado }) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = `<small></small><strong></strong>`;
    b.querySelector("small").textContent = conta + " =";
    b.querySelector("strong").textContent = formatar(resultado);
    b.addEventListener("click", () => { limpar(); state.atual = resultado; state.novoNumero = true; fecharHistorico(); render(); });
    li.append(b);
    lista.append(li);
  });
}
const histBtn = $("hist-btn"), histPainel = $("historico");
function fecharHistorico() { histPainel.hidden = true; histBtn.setAttribute("aria-expanded", "false"); }
histBtn.addEventListener("click", () => {
  const abrir = histPainel.hidden;
  histPainel.hidden = !abrir;
  histBtn.setAttribute("aria-expanded", abrir);
});
$("limpar-hist").addEventListener("click", () => { historico = []; try { localStorage.removeItem(HKEY); } catch {} renderHistorico(); });
renderHistorico();

/* ---------- entrada ---------- */
const acoes = { clear: limpar, back: apagar, percent: porcentagem, sign: sinal, dot: ponto, equals: () => igual() };

$("keys").addEventListener("click", (e) => {
  const k = e.target.closest(".k");
  if (!k) return;
  if (k.dataset.n) digito(k.dataset.n);
  else if (k.dataset.op) operador(k.dataset.op);
  else acoes[k.dataset.a]();
  render();
});

const mapaTeclas = { Enter: "equals", "=": "equals", Backspace: "back", Escape: "clear", Delete: "clear", ",": "dot", ".": "dot", "%": "percent" };
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  let botao;
  if (/^\d$/.test(e.key)) { digito(e.key); botao = `[data-n="${e.key}"]`; }
  else if (simbolos[e.key]) { operador(e.key); botao = `[data-op="${e.key}"]`; }
  else if (mapaTeclas[e.key]) { acoes[mapaTeclas[e.key]](); botao = `[data-a="${mapaTeclas[e.key]}"]`; }
  else return;
  e.preventDefault();
  if (e.key === "Escape" && !histPainel.hidden) fecharHistorico();
  const el = document.querySelector(botao);
  if (el) { el.classList.add("is-pressed"); setTimeout(() => el.classList.remove("is-pressed"), 120); }
  render();
});

render();
