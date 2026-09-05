const params = new URLSearchParams(location.search);
const esquemaId = params.get("id") ? Number(params.get("id")) : null;

const estadoEl = document.getElementById("estado");
const editorEl = document.getElementById("editor");
const campoEl = document.getElementById("campo");
const papeisEl = document.getElementById("papeis");
const tituloEl = document.getElementById("titulo-esquema");
const form = document.getElementById("form");

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

function mostrarEstado(texto, classe) {
  estadoEl.textContent = texto;
  estadoEl.className = "estado " + (classe || "");
  estadoEl.hidden = false;
  editorEl.hidden = true;
}

function posicionarFicha(ficha, pos) {
  ficha.style.left = pos.x + "%";
  ficha.style.top = pos.y + "%";
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
    campoEl.appendChild(ficha);

    const label = document.createElement("label");
    label.innerHTML = `<span class="num">${pos.numero}</span><input maxlength="12" required>`;
    const input = label.querySelector("input");
    input.value = pos.papel;
    input.addEventListener("input", () => {
      pos.papel = input.value;
      ficha.querySelector(".papel").textContent = pos.papel;
    });
    papeisEl.appendChild(label);
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
  mostrarEstado("Carregando...");
  try {
    let esquema;
    if (esquemaId) {
      esquema = await api.obterEsquema(esquemaId);
    } else {
      esquema = { nome: "", formacao: "4-4-2", tipo: "ofensivo", anotacoes: "", posicoes: PADRAO_442 };
    }
    posicoes = esquema.posicoes.map((p) => ({ ...p })).sort((a, b) => a.numero - b.numero);
    preencherFormulario(esquema);
    renderizarFichas();
    estadoEl.hidden = true;
    editorEl.hidden = false;
  } catch (e) {
    mostrarEstado(e.message, "erro");
  }
}

carregar();
