const params = new URLSearchParams(location.search);
const esquemaId = params.get("id") ? Number(params.get("id")) : null;

const estadoEl = document.getElementById("estado");
const editorEl = document.getElementById("editor");
const campoEl = document.getElementById("campo");
const papeisEl = document.getElementById("papeis");
const tituloEl = document.getElementById("titulo-esquema");
const form = document.getElementById("form");
const dirtyEl = document.getElementById("dirty");
const mensagemEl = document.getElementById("mensagem");
const salvarBtn = document.getElementById("salvar");

// Esquema inicial de um quadro novo: 4-4-2, ataque para cima (y menor = mais perto do gol adversário).
const PADRAO_442 = [
  { numero: 1, papel: "GOL", x: 50, y: 94 },
  { numero: 2, papel: "LD", x: 85, y: 75 },
  { numero: 3, papel: "ZAG", x: 63, y: 78 },
  { numero: 4, papel: "ZAG", x: 37, y: 78 },
  { numero: 5, papel: "LE", x: 15, y: 75 },
  { numero: 8, papel: "MD", x: 80, y: 50 },
  { numero: 6, papel: "MC", x: 60, y: 55 },
  { numero: 7, papel: "MC", x: 40, y: 55 },
  { numero: 9, papel: "ME", x: 20, y: 50 },
  { numero: 10, papel: "ATA", x: 60, y: 25 },
  { numero: 11, papel: "ATA", x: 40, y: 25 },
];

// Estado do quadro: as 11 posições em % do campo. É a fonte do payload de salvar.
let posicoes = [];
let dirty = false;

function mostrarEstado(texto, classe) {
  estadoEl.textContent = texto;
  estadoEl.className = "estado " + (classe || "");
  estadoEl.hidden = false;
  editorEl.hidden = true;
}

function mostrarMensagem(texto, classe) {
  mensagemEl.textContent = texto;
  mensagemEl.className = "mensagem " + (classe || "");
}

function marcarDirty(valor) {
  dirty = valor;
  dirtyEl.textContent = dirty ? "Alterações não salvas" : "";
}

function posicionarFicha(ficha, pos) {
  ficha.style.left = pos.x + "%";
  ficha.style.top = pos.y + "%";
}

function clamp(v) {
  return Math.min(100, Math.max(0, v));
}

// Converte o ponteiro para % do campo. Sem compensar o raio da ficha: nos extremos
// metade dela fica para fora, e é isso que o quadro aceita.
function moverFichaParaPonteiro(ficha, pos, ev) {
  const r = campoEl.getBoundingClientRect();
  pos.x = clamp(((ev.clientX - r.left) / r.width) * 100);
  pos.y = clamp(((ev.clientY - r.top) / r.height) * 100);
  posicionarFicha(ficha, pos);
}

function habilitarDrag(ficha, pos) {
  let arrastando = false;
  ficha.addEventListener("pointerdown", (ev) => {
    arrastando = true;
    ficha.classList.add("arrastando");
    ficha.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  ficha.addEventListener("pointermove", (ev) => {
    if (!arrastando) return;
    moverFichaParaPonteiro(ficha, pos, ev);
    marcarDirty(true);
  });
  const soltar = (ev) => {
    if (!arrastando) return;
    arrastando = false;
    ficha.classList.remove("arrastando");
    moverFichaParaPonteiro(ficha, pos, ev);
    marcarDirty(true);
  };
  ficha.addEventListener("pointerup", soltar);
  ficha.addEventListener("pointercancel", soltar);
}

function renderizarFichas() {
  campoEl.querySelectorAll(".ficha").forEach((f) => f.remove());
  papeisEl.replaceChildren();
  for (const pos of posicoes) {
    const ficha = document.createElement("div");
    ficha.className = "ficha";
    ficha.dataset.numero = pos.numero;
    ficha.innerHTML = `${pos.numero}<span class="papel"></span>`;
    ficha.querySelector(".papel").textContent = pos.papel;
    posicionarFicha(ficha, pos);
    habilitarDrag(ficha, pos);
    campoEl.appendChild(ficha);

    const label = document.createElement("label");
    label.innerHTML = `<span class="num">${pos.numero}</span><input required>`;
    const input = label.querySelector("input");
    input.value = pos.papel;
    input.addEventListener("input", () => {
      pos.papel = input.value;
      ficha.querySelector(".papel").textContent = pos.papel;
      marcarDirty(true);
    });
    papeisEl.appendChild(label);
  }
}

function montarPayload() {
  return {
    nome: form.nome.value.trim(),
    formacao: form.formacao.value.trim(),
    tipo: form.tipo.value,
    anotacoes: form.anotacoes.value,
    posicoes: posicoes.map((p) => ({
      numero: p.numero,
      papel: p.papel.trim(),
      x: p.x,
      y: p.y,
    })),
  };
}

async function salvar(ev) {
  ev.preventDefault();
  salvarBtn.disabled = true;
  mostrarMensagem("Salvando...");
  try {
    const payload = montarPayload();
    if (esquemaId) {
      await api.atualizarEsquema(esquemaId, payload);
      mostrarMensagem("Esquema salvo.", "sucesso");
      await carregar();
    } else {
      // Esquema novo: após criar, a URL passa a ter o id e o editor recarrega da API.
      const criado = await api.criarEsquema(payload);
      location.replace("editor.html?id=" + criado.id);
    }
  } catch (e) {
    mostrarMensagem(e.message, "erro");
  } finally {
    salvarBtn.disabled = false;
  }
}

function preencherFormulario(esquema) {
  form.nome.value = esquema.nome;
  form.formacao.value = esquema.formacao;
  form.tipo.value = esquema.tipo;
  form.anotacoes.value = esquema.anotacoes;
  tituloEl.textContent = esquema.nome ? "/ " + esquema.nome : "/ Novo esquema";
}

async function carregar() {
  if (editorEl.hidden) mostrarEstado("Carregando...");
  try {
    let esquema;
    if (esquemaId) {
      esquema = await api.obterEsquema(esquemaId);
    } else {
      // DECISÃO: a spec fixa só as posições do esquema novo; formação "4-4-2" e tipo "ofensivo" são os defaults mais simples.
      esquema = { nome: "", formacao: "4-4-2", tipo: "ofensivo", anotacoes: "", posicoes: PADRAO_442 };
    }
    posicoes = esquema.posicoes.map((p) => ({ ...p })).sort((a, b) => a.numero - b.numero);
    preencherFormulario(esquema);
    renderizarFichas();
    marcarDirty(false);
    estadoEl.hidden = true;
    editorEl.hidden = false;
  } catch (e) {
    mostrarEstado(e.message, "erro");
  }
}

for (const campo of ["nome", "formacao", "tipo", "anotacoes"]) {
  form[campo].addEventListener("input", () => marcarDirty(true));
}
form.addEventListener("submit", salvar);
carregar();
