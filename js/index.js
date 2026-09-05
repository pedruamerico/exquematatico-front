const estadoEl = document.getElementById("estado");
const listaEl = document.getElementById("lista");
const filtroEl = document.getElementById("filtro-tipo");

const ROTULO_TIPO = { ofensivo: "Ofensivo", defensivo: "Defensivo", bola_parada: "Bola parada" };

function mostrarEstado(texto, classe) {
  estadoEl.textContent = texto;
  estadoEl.className = "estado " + (classe || "");
  estadoEl.hidden = false;
  listaEl.hidden = true;
}

function formatarData(iso) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function criarCard(esquema) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <div class="card-cabecalho">
      <h2></h2>
      <span class="badge badge-${esquema.tipo}">${ROTULO_TIPO[esquema.tipo] || esquema.tipo}</span>
    </div>
    <p class="card-formacao"></p>
    <p class="card-data">Criado em ${formatarData(esquema.criado_em)}</p>
    <div class="card-acoes">
      <a class="btn btn-primario" href="editor.html?id=${esquema.id}">Abrir</a>
      <button class="btn" data-acao="duplicar">Duplicar</button>
      <button class="btn btn-perigo" data-acao="excluir">Excluir</button>
    </div>`;
  card.querySelector("h2").textContent = esquema.nome;
  card.querySelector(".card-formacao").textContent = "Formação " + esquema.formacao;

  card.querySelector('[data-acao="duplicar"]').addEventListener("click", async () => {
    try {
      await api.duplicarEsquema(esquema.id);
      await carregar();
    } catch (e) {
      mostrarEstado(e.message, "erro");
    }
  });
  card.querySelector('[data-acao="excluir"]').addEventListener("click", async () => {
    if (!confirm(`Excluir o esquema "${esquema.nome}"?`)) return;
    try {
      await api.excluirEsquema(esquema.id);
      await carregar();
    } catch (e) {
      mostrarEstado(e.message, "erro");
    }
  });
  return card;
}

async function carregar() {
  mostrarEstado("Carregando...");
  try {
    const esquemas = await api.listarEsquemas(filtroEl.value);
    if (esquemas.length === 0) {
      mostrarEstado(filtroEl.value ? "Nenhum esquema deste tipo." : "Nenhum esquema salvo ainda. Crie o primeiro!", "vazio");
      return;
    }
    listaEl.replaceChildren(...esquemas.map(criarCard));
    estadoEl.hidden = true;
    listaEl.hidden = false;
  } catch (e) {
    mostrarEstado(e.message, "erro");
  }
}

filtroEl.addEventListener("change", carregar);
carregar();
