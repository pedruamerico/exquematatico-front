const el = (id) => document.getElementById(id);
const listaEl = el("lista");
const estadoListaEl = el("estado-lista");
const estadoBoardEl = el("estado-board");
const boardEl = el("board");
const campoEl = el("campo");
const camadaEl = el("camada");
const alcasEl = el("alcas");
const inspectorEl = el("inspector");
const inspectorCorpoEl = el("inspector-corpo");
const dirtyEl = el("dirty");
const toastEl = el("toast");
const leituraEl = el("leitura");
const railEl = el("rail");
const menuEl = el("menu");

const ROTULO_TIPO = { ofensivo: "Ofensivo", defensivo: "Defensivo", bola_parada: "Bola parada" };
const GLIFO_TIPO = { ofensivo: "▲", defensivo: "▼", bola_parada: "◆" };
const TIMES = ["casa", "visitante"];
const MAX_EM_CAMPO = 11;
const MAX_HISTORICO = 80;
const ZONA_MIN = { largura: 2, altura: 2.5 };

const FERRAMENTAS = [
  { id: "select", nome: "Selecionar", tecla: "V", grupo: 0 },
  { id: "bola", nome: "Posicionar a bola", tecla: "B", grupo: 1 },
  { id: "mov", nome: "Movimentação", tecla: "M", grupo: 2 },
  { id: "passe", nome: "Linha de passe", tecla: "P", grupo: 2 },
  { id: "zona", nome: "Zona tática", tecla: "Z", grupo: 3 },
  { id: "texto", nome: "Nota tática", tecla: "T", grupo: 3 },
];

const estado = {
  esquemas: [],
  esquemaId: null,
  variacaoId: null,
  variacao: null,
  selecao: null,
  arrasto: null,
  desenho: null,
  ancora: null,
  ferramenta: "select",
  filtro: "",
  sujo: false,
  persistido: null,
  alteracoes: 0,
  historico: {},
  inspectorAberto: false,
  inspectorFixado: false,
  aba: "contexto",
  gaveta: false,
};

let ocupado = false;
let editandoId = null;
let tipoRascunho = "ofensivo";
let timerToast = null;

/* ---------- utilidades ---------- */

function mostrarToast(texto) {
  toastEl.textContent = texto;
  toastEl.classList.add("toast-visivel");
  clearTimeout(timerToast);
  timerToast = setTimeout(() => toastEl.classList.remove("toast-visivel"), 2000);
}

function marcarSujo(valor) {
  estado.sujo = valor;
  if (!valor) {
    estado.alteracoes = 0;
    estado.persistido = estado.variacao ? JSON.stringify(estado.variacao) : null;
  }
  dirtyEl.textContent = estado.alteracoes
    ? estado.alteracoes + (estado.alteracoes === 1 ? " alteração" : " alterações")
    : "";
  dirtyEl.classList.toggle("dirty-visivel", valor);
  campoEl.classList.toggle("sujo", valor);
  const salvar = el("salvar");
  salvar.disabled = !valor;
  salvar.textContent = valor ? "Salvar" : "Salvo";
}

function esquemaAtual() {
  return estado.esquemas.find((e) => e.id === estado.esquemaId) || null;
}

function clonarVariacao(v) {
  return {
    id: v.id,
    chave: v.chave,
    nome: v.nome,
    bola: { ...v.bola },
    casa: v.casa.map((j) => ({ ...j })),
    visitante: v.visitante.map((j) => ({ ...j })),
    desenhos: (v.desenhos || []).map((d) => ({ ...d })),
    zonas: (v.zonas || []).map((z) => ({ ...z })),
    anotacoes: (v.anotacoes || []).map((a) => ({ ...a })),
  };
}

function confirmarDescarte() {
  if (!estado.sujo) return true;
  return confirm("Há alterações não salvas nesta variação. Descartar?");
}

/* ---------- histórico ---------- */

function chaveHistorico() {
  return estado.esquemaId + "::" + estado.variacaoId;
}

function empilhar(fotoAnterior) {
  const chave = chaveHistorico();
  const h = estado.historico[chave] || { passado: [], futuro: [] };
  h.passado = h.passado.concat([fotoAnterior]).slice(-MAX_HISTORICO);
  h.futuro = [];
  estado.historico[chave] = h;
  estado.alteracoes += 1;
  marcarSujo(true);
}

function fotografar() {
  return JSON.parse(JSON.stringify(estado.variacao));
}

function alterar(mutacao) {
  const antes = fotografar();
  mutacao();
  empilhar(antes);
  renderizarBoard();
}

function desfazer(direcao) {
  const chave = chaveHistorico();
  const h = estado.historico[chave];
  if (!h) return;
  const origem = direcao === "desfazer" ? h.passado : h.futuro;
  if (!origem.length) return;
  const destino = direcao === "desfazer" ? h.futuro : h.passado;

  destino.push(fotografar());
  estado.variacao = origem.pop();
  estado.selecao = null;
  estado.alteracoes = Math.max(0, estado.alteracoes + (direcao === "desfazer" ? -1 : 1));
  marcarSujo(JSON.stringify(estado.variacao) !== estado.persistido);
  renderizarBoard();
}

/* ---------- seleção ---------- */

function selecionar(camada, indice, extra) {
  estado.selecao = { camada, indice, ...(extra || {}) };
  estado.inspectorAberto = true;
  estado.aba = "contexto";
  fecharMenu();
  renderizarBoard();
}

function limparSelecao() {
  estado.selecao = null;
  if (!estado.inspectorFixado) estado.inspectorAberto = false;
  renderizarBoard();
}

function jogadorSelecionado() {
  const s = estado.selecao;
  if (!s || (s.camada !== "casa" && s.camada !== "visitante")) return null;
  return estado.variacao[s.camada][s.indice] || null;
}

/* ---------- geometria de apoio ---------- */

function tamanhoFicha() {
  const largura = campoEl.getBoundingClientRect().width || 800;
  return Math.round(Math.min(38, Math.max(26, largura * 0.036)));
}

function alvoDeAncoragem(x, y) {
  const caixa = campoEl.getBoundingClientRect();
  const raio = (tamanhoFicha() * 0.8) / caixa.width * 100;
  let melhor = null;
  let menor = raio;

  TIMES.forEach((time) => {
    estado.variacao[time].forEach((j) => {
      if (!j.em_campo) return;
      const distancia = Math.hypot(x - j.x, (y - j.y) * (caixa.height / caixa.width));
      if (distancia < menor) {
        menor = distancia;
        melhor = { x: j.x, y: j.y, id: time + ":" + j.numero };
      }
    });
  });

  const bola = estado.variacao.bola;
  const distanciaBola = Math.hypot(x - bola.x, (y - bola.y) * (caixa.height / caixa.width));
  if (distanciaBola < menor) melhor = { x: bola.x, y: bola.y, id: "bola" };
  return melhor;
}

/* ---------- render: lista ---------- */

function renderizarFiltros() {
  const opcoes = [["", "Todos"], ["ofensivo", "Ofensivo"], ["defensivo", "Defensivo"], ["bola_parada", "Bola parada"]];
  el("filtros").replaceChildren(...opcoes.map(([valor, rotulo]) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "filtro" + (estado.filtro === valor ? " filtro-ativo" : "");
    botao.textContent = rotulo;
    botao.addEventListener("click", () => {
      if (estado.filtro === valor || !confirmarDescarte()) return;
      estado.filtro = valor;
      carregar();
    });
    return botao;
  }));
}

function criarItemLista(esquema) {
  const item = document.createElement("div");
  const aberto = esquema.id === estado.esquemaId;
  item.className = "item" + (aberto ? " item-atual" : "");

  const cabecalho = document.createElement("button");
  cabecalho.type = "button";
  cabecalho.className = "item-cabecalho";
  cabecalho.innerHTML = `
    <span class="item-nome"></span>
    <span class="item-meta">
      <span class="item-formacao"></span>
      <span class="item-sep"></span>
      <span class="item-tipo"></span>
    </span>`;
  cabecalho.querySelector(".item-nome").textContent = esquema.nome;
  cabecalho.querySelector(".item-formacao").textContent = esquema.formacao;
  cabecalho.querySelector(".item-tipo").textContent =
    (GLIFO_TIPO[esquema.tipo] || "") + " " + (ROTULO_TIPO[esquema.tipo] || esquema.tipo);
  cabecalho.addEventListener("click", () => selecionarEsquema(esquema.id));
  item.appendChild(cabecalho);

  if (aberto) {
    const variacoes = document.createElement("div");
    variacoes.className = "variacoes";
    esquema.variacoes.forEach((v) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "variacao" + (v.id === estado.variacaoId ? " variacao-ativa" : "");

      const nome = document.createElement("span");
      nome.className = "variacao-nome";
      nome.textContent = v.nome;
      botao.appendChild(nome);

      if (v.chave === "custom") {
        const excluir = document.createElement("span");
        excluir.className = "variacao-excluir";
        excluir.textContent = "×";
        excluir.title = "Excluir variação";
        excluir.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          const ehAtual = v.id === estado.variacaoId;
          if (ehAtual && !confirmarDescarte()) return;
          if (!confirm(`Excluir a variação "${v.nome}"?`)) return;
          await executar(() => api.excluirVariacao(esquema.id, v.id), null, !ehAtual);
        });
        botao.appendChild(excluir);
      } else if (v.id === estado.variacaoId && estado.sujo) {
        const ponto = document.createElement("span");
        ponto.className = "variacao-suja";
        botao.appendChild(ponto);
      }

      botao.addEventListener("click", () => selecionarVariacao(v.id));
      variacoes.appendChild(botao);
    });

    const nova = document.createElement("button");
    nova.type = "button";
    nova.className = "variacao";
    nova.textContent = "Nova variação";
    nova.addEventListener("click", abrirDialogoVariacao);
    variacoes.appendChild(nova);
    item.appendChild(variacoes);
  }
  return item;
}

function renderizarLista() {
  renderizarFiltros();
  el("contagem").textContent = estado.esquemas.length;
  if (estado.esquemas.length === 0) {
    estadoListaEl.textContent = estado.filtro
      ? "Nenhum plano com este filtro."
      : "Nenhum plano ainda. Crie o primeiro.";
    estadoListaEl.hidden = false;
    listaEl.hidden = true;
    return;
  }
  listaEl.replaceChildren(...estado.esquemas.map(criarItemLista));
  estadoListaEl.hidden = true;
  listaEl.hidden = false;
}

/* ---------- render: ferramentas ---------- */

function iconeFerramenta(id) {
  const icones = {
    select: '<path d="M5 3l14 8-6.2 1.6L10.5 19z"/>',
    bola: '<circle cx="12" cy="12" r="8.4"/><polygon points="12,7.6 16.2,10.6 14.6,15.6 9.4,15.6 7.8,10.6" fill="currentColor" stroke="none"/><path d="M12 7.6V3.6M16.2 10.6l3.8-1.2M14.6 15.6l2.4 3.2M9.4 15.6L7 18.8M7.8 10.6L4 9.4"/>',
    mov: '<path d="M3 12h11" stroke-width="2"/><polygon points="20,12 13.6,8.3 13.6,15.7" fill="currentColor" stroke="none"/>',
    passe: '<path d="M2.6 12h2.8M8 12h2.8M13.4 12h1.2" stroke-width="2.2"/><polygon points="20,12 14.4,8.6 14.4,15.4" fill="currentColor" stroke="none"/>',
    zona: '<rect x="3.5" y="5.5" width="17" height="13" stroke-dasharray="3.6 3"/>',
    texto: '<path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/>',
  };
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icones[id]}</svg>`;
}

function renderizarFerramentas() {
  railEl.replaceChildren(...FERRAMENTAS.map((f, i) => {
    const anterior = FERRAMENTAS[i - 1];
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "ferramenta"
      + (estado.ferramenta === f.id ? " ferramenta-ativa" : "")
      + (anterior && anterior.grupo !== f.grupo ? " rail-grupo" : "");
    botao.setAttribute("aria-label", f.nome);
    botao.innerHTML = iconeFerramenta(f.id)
      + `<span class="dica"><span>${f.nome}</span><kbd>${f.tecla}</kbd></span>`;
    botao.addEventListener("click", () => trocarFerramenta(f.id));
    return botao;
  }));
}

function trocarFerramenta(id) {
  estado.ferramenta = id;
  if (id !== "select") estado.selecao = null;
  campoEl.classList.toggle("campo-desenhando", id !== "select" && id !== "texto");
  campoEl.classList.toggle("campo-texto", id === "texto");
  renderizarFerramentas();
  renderizarBoard();
}

/* ---------- render: campo ---------- */

function criarFicha(jogador, time, indice) {
  const selecionada = estado.selecao
    && estado.selecao.camada === time && estado.selecao.indice === indice;
  const arrastando = estado.arrasto
    && estado.arrasto.camada === time && estado.arrasto.indice === indice;
  const ancorada = estado.ancora === time + ":" + jogador.numero;

  const wrap = document.createElement("div");
  wrap.className = "ficha-wrap" + (arrastando ? " arrastando" : "");
  wrap.style.left = jogador.x + "%";
  wrap.style.top = jogador.y + "%";
  if (arrastando) wrap.style.zIndex = 60;
  else if (selecionada) wrap.style.zIndex = 40;

  const ficha = document.createElement("div");
  ficha.className = `ficha ficha-${time}`
    + (selecionada ? " ficha-selecionada" : "")
    + (ancorada ? " ficha-ancora" : "");
  ficha.tabIndex = 0;
  ficha.setAttribute("role", "button");
  ficha.setAttribute("aria-label",
    `${time === "casa" ? "Casa" : "Adversário"} número ${jogador.numero}, ${jogador.papel}`);

  const anel = document.createElement("span");
  anel.className = "ficha-anel";
  const miolo = document.createElement("span");
  miolo.className = "ficha-miolo";
  miolo.textContent = jogador.numero;
  anel.appendChild(miolo);
  ficha.appendChild(anel);

  const marca = document.createElement("span");
  marca.className = "marca-inf";
  ficha.appendChild(marca);

  ficha.addEventListener("pointerdown", (ev) => iniciarArrastoFicha(ev, time, indice));
  ficha.addEventListener("keydown", (ev) => moverPorTeclado(ev, time, indice));
  wrap.appendChild(ficha);

  const papel = document.createElement("span");
  papel.className = "ficha-papel";
  papel.textContent = jogador.papel;
  wrap.appendChild(papel);
  return wrap;
}

function criarBola() {
  const bola = estado.variacao.bola;
  const arrastando = estado.arrasto && estado.arrasto.camada === "bola";
  const selecionada = estado.selecao && estado.selecao.camada === "bola";

  const wrap = document.createElement("div");
  wrap.className = "bola-wrap" + (arrastando ? " arrastando" : "")
    + (selecionada ? " bola-selecionada" : "");
  wrap.style.left = bola.x + "%";
  wrap.style.top = bola.y + "%";

  const alvo = document.createElement("div");
  alvo.className = "bola";
  alvo.tabIndex = 0;
  alvo.setAttribute("role", "button");
  alvo.setAttribute("aria-label", "Bola");
  alvo.innerHTML = `<svg viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="14.6" fill="#F6F7F1"/>
    <polygon points="16,8.2 22.1,12.6 19.8,19.8 12.2,19.8 9.9,12.6" fill="#12160F"/>
    <path d="M16 8.2V2.2M22.1 12.6l5.7-1.9M19.8 19.8l3.6 4.8M12.2 19.8l-3.6 4.8M9.9 12.6L4.2 10.7"
      stroke="#12160F" stroke-width="2" stroke-linecap="round"/>
    <circle cx="16" cy="16" r="14.6" fill="none" stroke="rgba(9,12,10,.7)" stroke-width="2.2"/>
  </svg>`;
  alvo.addEventListener("pointerdown", (ev) => iniciarArrastoBola(ev));
  alvo.addEventListener("keydown", (ev) => moverBolaPorTeclado(ev));
  wrap.appendChild(alvo);

  const marca = document.createElement("span");
  marca.className = "marca-inf";
  wrap.appendChild(marca);
  return wrap;
}

function criarNota(anotacao, indice) {
  const selecionada = estado.selecao
    && estado.selecao.camada === "anotacoes" && estado.selecao.indice === indice;
  const nota = document.createElement("div");
  nota.className = "nota" + (selecionada ? " nota-ativa" : "");
  nota.tabIndex = 0;
  nota.setAttribute("role", "button");
  nota.setAttribute("aria-label", "Nota: " + anotacao.texto);
  nota.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      selecionar("anotacoes", indice);
    }
  });
  nota.style.left = anotacao.x + "%";
  nota.style.top = anotacao.y + "%";
  nota.textContent = anotacao.texto;
  nota.addEventListener("pointerdown", (ev) => iniciarArrastoNota(ev, indice));
  return nota;
}

function renderizarCamadaTatica() {
  camadaEl.replaceChildren();
  const v = estado.variacao;
  const sel = estado.selecao;
  const marcado = (camada, indice) => sel && sel.camada === camada && sel.indice === indice;

  v.zonas.forEach((z, i) => desenharZona(camadaEl, z, i, marcado("zonas", i), iniciarArrastoMarcacao));
  v.desenhos.forEach((d, i) => desenharSeta(camadaEl, d, i, marcado("desenhos", i), iniciarArrastoMarcacao));
  desenharPrevia(camadaEl, estado.desenho);
  desenharAlcas(alcasEl, sel, v, iniciarArrastoAlca);
}

function atualizarLeitura() {
  const escala = "105 × 68 m";
  const jogador = jogadorSelecionado();
  const arrastoFicha = estado.arrasto
    && (estado.arrasto.camada === "casa" || estado.arrasto.camada === "visitante");

  if (arrastoFicha) {
    const j = estado.variacao[estado.arrasto.camada][estado.arrasto.indice];
    leituraEl.textContent = `X ${j.x.toFixed(1)}   Y ${j.y.toFixed(1)}   ·   ${escala}`;
  } else if (jogador && jogador.em_campo) {
    leituraEl.textContent = `X ${jogador.x.toFixed(1)}   Y ${jogador.y.toFixed(1)}   ·   ${escala}`;
  } else if (estado.selecao && estado.selecao.camada === "bola") {
    const b = estado.variacao.bola;
    leituraEl.textContent = `BOLA  X ${b.x.toFixed(1)}   Y ${b.y.toFixed(1)}   ·   ${escala}`;
  } else {
    leituraEl.textContent = escala;
  }
}

function renderizarBoard() {
  const esquema = esquemaAtual();
  if (!esquema || !estado.variacao) {
    boardEl.hidden = true;
    estadoBoardEl.hidden = false;
    estadoBoardEl.textContent = esquema
      ? "Este plano não tem variações."
      : "Selecione um plano à esquerda.";
    renderizarLista();
    return;
  }
  estadoBoardEl.hidden = true;
  boardEl.hidden = false;

  el("board-titulo").textContent = esquema.nome;
  el("board-formacao").textContent = esquema.formacao;
  el("board-tipo").textContent = ROTULO_TIPO[esquema.tipo] || esquema.tipo;
  el("board-variacao").textContent = estado.variacao.nome;

  campoEl.style.setProperty("--ficha", tamanhoFicha() + "px");
  campoEl.querySelectorAll(".ficha-wrap, .bola-wrap, .nota").forEach((n) => n.remove());

  TIMES.forEach((time) => {
    estado.variacao[time].forEach((j, i) => {
      if (j.em_campo) campoEl.appendChild(criarFicha(j, time, i));
    });
  });
  campoEl.appendChild(criarBola());
  estado.variacao.anotacoes.forEach((a, i) => campoEl.appendChild(criarNota(a, i)));

  renderizarCamadaTatica();
  atualizarLeitura();
  renderizarInspector();
  renderizarLista();
}

/* ---------- inspector ---------- */

function rotuloContexto() {
  const s = estado.selecao;
  if (!s) return { texto: "Contexto", cor: "var(--line-3)" };
  if (s.camada === "casa") return { texto: "Jogador · casa", cor: "var(--casa)" };
  if (s.camada === "visitante") return { texto: "Jogador · adversário", cor: "var(--adversario)" };
  if (s.camada === "bola") return { texto: "Bola", cor: "var(--chalk)" };
  if (s.camada === "desenhos") {
    const d = estado.variacao.desenhos[s.indice];
    return { texto: d && d.tipo === "passe" ? "Passe" : "Movimentação", cor: "var(--chalk)" };
  }
  if (s.camada === "zonas") {
    const z = estado.variacao.zonas[s.indice];
    return { texto: "Zona", cor: corDoTime(z ? z.time : "neutra") };
  }
  if (s.camada === "anotacoes") return { texto: "Nota", cor: "var(--chalk)" };
  return { texto: "Contexto", cor: "var(--line-3)" };
}

function painelJogador(time, indice) {
  const jogador = estado.variacao[time][indice];
  const painel = document.createElement("div");
  painel.className = "painel";
  painel.innerHTML = `
    <div class="sel-cabecalho">
      <span class="sel-ficha ficha-${time}">
        <span class="ficha-anel"><span class="ficha-miolo">${jogador.numero}</span></span>
      </span>
      <div>
        <div class="sel-papel-titulo"></div>
        <div class="sel-coord"></div>
      </div>
    </div>
    <div class="campos">
      <label class="campo-numero">
        <span class="rotulo">Número</span>
        <input id="sel-numero" type="number" min="1" max="99" value="${jogador.numero}">
      </label>
      <label class="campo-papel">
        <span class="rotulo">Papel</span>
        <input id="sel-papel" type="text" maxlength="12" value="">
      </label>
    </div>
    <div class="acoes-linha">
      <button id="sel-banco" class="btn btn-mini" type="button"></button>
      <button id="sel-remover" class="btn btn-mini btn-icone btn-perigo" type="button" aria-label="Excluir jogador">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
      </button>
    </div>`;

  painel.querySelector(".sel-papel-titulo").textContent = jogador.papel;
  painel.querySelector(".sel-coord").textContent = jogador.em_campo
    ? `x ${jogador.x.toFixed(1)}   y ${jogador.y.toFixed(1)}`
    : "no banco";
  painel.querySelector("#sel-papel").value = jogador.papel;
  painel.querySelector("#sel-banco").textContent = jogador.em_campo ? "Ao banco" : "Escalar";

  painel.querySelector("#sel-numero").addEventListener("change", (ev) => {
    const novo = Number(ev.target.value);
    if (!Number.isInteger(novo) || novo < 1 || novo > 99) {
      mostrarToast("O número deve ser um inteiro entre 1 e 99.");
      renderizarBoard();
      return;
    }
    if (estado.variacao[time].some((j, i) => i !== indice && j.numero === novo)) {
      mostrarToast("Já existe um jogador com esse número neste time.");
      renderizarBoard();
      return;
    }
    alterar(() => { estado.variacao[time][indice].numero = novo; });
  });

  painel.querySelector("#sel-papel").addEventListener("change", (ev) => {
    const texto = ev.target.value.trim().toUpperCase();
    if (!texto) { renderizarBoard(); return; }
    alterar(() => { estado.variacao[time][indice].papel = texto; });
  });

  painel.querySelector("#sel-banco").addEventListener("click", () => {
    if (jogador.em_campo) mandarAoBanco(time, indice);
    else colocarEmCampo(time, indice);
  });

  painel.querySelector("#sel-remover").addEventListener("click", () => {
    if (!confirm(`Excluir o jogador ${jogador.numero} do time?`)) return;
    alterar(() => {
      estado.variacao[time].splice(indice, 1);
      estado.selecao = null;
    });
  });
  return painel;
}

function painelMarcacao() {
  const s = estado.selecao;
  const painel = document.createElement("div");
  painel.className = "painel";

  const meta = document.createElement("div");
  meta.className = "meta-mono";
  painel.appendChild(meta);

  if (s.camada === "desenhos") {
    const d = estado.variacao.desenhos[s.indice];
    meta.textContent = `de   x ${d.x1.toFixed(1)}   y ${d.y1.toFixed(1)}\n`
      + `até  x ${d.x2.toFixed(1)}   y ${d.y2.toFixed(1)}`;
  }

  if (s.camada === "zonas") {
    const z = estado.variacao.zonas[s.indice];
    meta.textContent = `x ${z.x.toFixed(1)}   y ${z.y.toFixed(1)}\n`
      + `l ${z.largura.toFixed(1)}   a ${z.altura.toFixed(1)}`;

    const grupo = document.createElement("div");
    grupo.style.marginTop = "13px";
    grupo.innerHTML = '<span class="rotulo">Atribuição</span>';
    const segmento = document.createElement("div");
    segmento.className = "segmento";
    [["casa", "Casa"], ["visitante", "Adversário"], ["neutra", "Neutra"]].forEach(([valor, rotulo]) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = z.time === valor ? "ativo" : "";
      botao.textContent = rotulo;
      botao.addEventListener("click", () => alterar(() => { estado.variacao.zonas[s.indice].time = valor; }));
      segmento.appendChild(botao);
    });
    grupo.appendChild(segmento);
    painel.appendChild(grupo);
  }

  if (s.camada === "anotacoes") {
    const a = estado.variacao.anotacoes[s.indice];
    meta.textContent = `x ${a.x.toFixed(1)}   y ${a.y.toFixed(1)}`;

    const rotulo = document.createElement("label");
    rotulo.style.display = "block";
    rotulo.style.marginTop = "13px";
    rotulo.innerHTML = '<span class="rotulo">Texto</span>';
    const entrada = document.createElement("input");
    entrada.type = "text";
    entrada.maxLength = 40;
    entrada.value = a.texto;
    entrada.addEventListener("change", (ev) => {
      const texto = ev.target.value.trim();
      if (!texto) { renderizarBoard(); return; }
      alterar(() => { estado.variacao.anotacoes[s.indice].texto = texto; });
    });
    rotulo.appendChild(entrada);
    painel.appendChild(rotulo);
  }

  const excluir = document.createElement("button");
  excluir.type = "button";
  excluir.className = "btn btn-mini";
  excluir.style.cssText = "width:100%;margin-top:13px";
  excluir.textContent = "Excluir marcação";
  excluir.addEventListener("click", removerMarcacao);
  painel.appendChild(excluir);
  return painel;
}

function painelBola() {
  const painel = document.createElement("div");
  painel.className = "painel";
  const bola = estado.variacao.bola;
  const meta = document.createElement("div");
  meta.className = "meta-mono";
  meta.textContent = `x ${bola.x.toFixed(1)}   y ${bola.y.toFixed(1)}`;
  painel.appendChild(meta);

  const centro = document.createElement("button");
  centro.type = "button";
  centro.className = "btn btn-mini";
  centro.style.cssText = "width:100%;margin-top:13px";
  centro.textContent = "Recolocar no centro";
  centro.addEventListener("click", () => alterar(() => { estado.variacao.bola = { x: 50, y: 50 }; }));
  painel.appendChild(centro);
  return painel;
}

function painelBanco() {
  const wrap = document.createElement("div");
  TIMES.forEach((time) => {
    const reservas = estado.variacao[time]
      .map((j, i) => ({ jogador: j, indice: i }))
      .filter((r) => !r.jogador.em_campo);

    const bloco = document.createElement("div");
    bloco.className = "banco-time";
    bloco.innerHTML = `
      <div class="banco-cabecalho">
        <span class="banco-marca banco-marca-${time}"></span>
        <span class="banco-titulo">${time === "casa" ? "Casa" : "Adversário"}</span>
        <span class="contagem">${reservas.length}</span>
      </div>
      <div class="banco-lista"></div>`;

    const lista = bloco.querySelector(".banco-lista");
    if (reservas.length === 0) {
      const vazio = document.createElement("div");
      vazio.className = "banco-vazio";
      vazio.textContent = "Banco vazio.";
      lista.appendChild(vazio);
    }

    reservas.forEach(({ jogador, indice }) => {
      const ativo = estado.selecao && estado.selecao.camada === time && estado.selecao.indice === indice;
      const item = document.createElement("button");
      item.type = "button";
      item.className = "banco-item" + (ativo ? " banco-item-ativo" : "");
      item.innerHTML = `<span class="banco-disco banco-disco-${time}">${jogador.numero}</span>
        <span class="banco-papel"></span>`;
      item.querySelector(".banco-papel").textContent = jogador.papel;
      item.addEventListener("click", () => selecionar(time, indice));
      lista.appendChild(item);
    });

    const adicionar = document.createElement("button");
    adicionar.type = "button";
    adicionar.className = "link-acao";
    adicionar.textContent = "Adicionar jogador";
    adicionar.addEventListener("click", () => adicionarJogador(time));
    lista.appendChild(adicionar);
    wrap.appendChild(bloco);
  });
  return wrap;
}

function renderizarInspector() {
  const aberto = estado.inspectorAberto && (estado.selecao || estado.inspectorFixado);
  inspectorEl.classList.toggle("inspector-aberto", !!aberto);

  const rotulo = rotuloContexto();
  el("aba-rotulo").textContent = rotulo.texto;
  el("aba-ponto").style.background = rotulo.cor;
  el("aba-contexto").classList.toggle("aba-ativa", estado.aba === "contexto");
  el("aba-banco").classList.toggle("aba-ativa", estado.aba === "banco");

  if (!aberto) return;

  if (estado.aba === "banco") {
    inspectorCorpoEl.replaceChildren(painelBanco());
    return;
  }

  const s = estado.selecao;
  if (!s) {
    const vazio = document.createElement("p");
    vazio.className = "estado";
    vazio.textContent = "Nada selecionado. Toque num jogador, na bola ou numa marcação do campo.";
    inspectorCorpoEl.replaceChildren(vazio);
    return;
  }
  if (s.camada === "casa" || s.camada === "visitante") {
    inspectorCorpoEl.replaceChildren(painelJogador(s.camada, s.indice));
  } else if (s.camada === "bola") {
    inspectorCorpoEl.replaceChildren(painelBola());
  } else {
    inspectorCorpoEl.replaceChildren(painelMarcacao());
  }
}

/* ---------- arrasto ---------- */

// Sem setPointerCapture: o nó capturado é recriado a cada render.
function capturar(ev) {
  ev.preventDefault();
}

function iniciarArrastoFicha(ev, time, indice) {
  ev.stopPropagation();
  if (estado.ferramenta !== "select") return;
  capturar(ev);
  estado.fotoAnterior = fotografar();
  estado.arrasto = { camada: time, indice };
  selecionar(time, indice);
}

function iniciarArrastoBola(ev) {
  ev.stopPropagation();
  if (estado.ferramenta !== "select") return;
  capturar(ev);
  estado.fotoAnterior = fotografar();
  estado.arrasto = { camada: "bola" };
  selecionar("bola", 0);
}

function iniciarArrastoNota(ev, indice) {
  ev.stopPropagation();
  if (estado.ferramenta !== "select") return;
  capturar(ev);
  const a = estado.variacao.anotacoes[indice];
  const p = campo.percentualDoPonteiro(campoEl, ev);
  estado.fotoAnterior = fotografar();
  estado.arrasto = { camada: "anotacoes", indice, dx: p.x - a.x, dy: p.y - a.y };
  selecionar("anotacoes", indice);
}

function iniciarArrastoMarcacao(ev, camada, indice) {
  ev.stopPropagation();
  if (estado.ferramenta !== "select") return;
  capturar(ev);
  const p = campo.percentualDoPonteiro(campoEl, ev);
  const alvo = estado.variacao[camada][indice];
  const base = camada === "desenhos" ? { x: alvo.x1, y: alvo.y1 } : { x: alvo.x, y: alvo.y };
  estado.fotoAnterior = fotografar();
  estado.arrasto = { camada, indice, sub: "mover", dx: p.x - base.x, dy: p.y - base.y };
  selecionar(camada, indice);
}

function iniciarArrastoAlca(ev, sub) {
  ev.stopPropagation();
  capturar(ev);
  estado.fotoAnterior = fotografar();
  estado.arrasto = { ...estado.selecao, sub };
}

function moverArrasto(p) {
  const g = estado.arrasto;
  const v = estado.variacao;

  if (g.camada === "casa" || g.camada === "visitante") {
    const limitado = campo.dentroDoGramado(p.x, p.y);
    v[g.camada][g.indice].x = Number(limitado.x.toFixed(2));
    v[g.camada][g.indice].y = Number(limitado.y.toFixed(2));
    return;
  }
  if (g.camada === "bola") {
    const limitado = campo.dentroDoGramado(p.x, p.y);
    v.bola = { x: Number(limitado.x.toFixed(2)), y: Number(limitado.y.toFixed(2)) };
    return;
  }
  if (g.camada === "anotacoes") {
    const limitado = campo.dentroDoGramado(p.x - g.dx, p.y - g.dy);
    v.anotacoes[g.indice].x = Number(limitado.x.toFixed(2));
    v.anotacoes[g.indice].y = Number(limitado.y.toFixed(2));
    return;
  }
  if (g.camada === "desenhos") {
    const d = v.desenhos[g.indice];
    if (g.sub === "mover") {
      let dx = (p.x - g.dx) - d.x1;
      let dy = (p.y - g.dy) - d.y1;
      dx = Math.max(2.7 - Math.min(d.x1, d.x2), Math.min(97.3 - Math.max(d.x1, d.x2), dx));
      dy = Math.max(2.8 - Math.min(d.y1, d.y2), Math.min(97.2 - Math.max(d.y1, d.y2), dy));
      d.x1 = Number((d.x1 + dx).toFixed(2));
      d.y1 = Number((d.y1 + dy).toFixed(2));
      d.x2 = Number((d.x2 + dx).toFixed(2));
      d.y2 = Number((d.y2 + dy).toFixed(2));
      return;
    }
    const limitado = campo.dentroDoGramado(p.x, p.y);
    const ancora = alvoDeAncoragem(limitado.x, limitado.y);
    const ponto = ancora || limitado;
    estado.ancora = ancora ? ancora.id : null;
    if (g.sub === "a") { d.x1 = Number(ponto.x.toFixed(2)); d.y1 = Number(ponto.y.toFixed(2)); }
    else { d.x2 = Number(ponto.x.toFixed(2)); d.y2 = Number(ponto.y.toFixed(2)); }
    return;
  }
  if (g.camada === "zonas") {
    const z = v.zonas[g.indice];
    if (g.sub === "mover") {
      z.x = Number(Math.min(97.3 - z.largura, Math.max(2.7, p.x - g.dx)).toFixed(2));
      z.y = Number(Math.min(97.2 - z.altura, Math.max(2.8, p.y - g.dy)).toFixed(2));
      return;
    }
    const fixoX = g.sub.includes("o") ? z.x + z.largura : z.x;
    const fixoY = g.sub.includes("n") ? z.y + z.altura : z.y;
    const limitado = campo.dentroDoGramado(p.x, p.y);
    const x1 = Math.min(fixoX, limitado.x);
    const x2 = Math.max(fixoX, limitado.x);
    const y1 = Math.min(fixoY, limitado.y);
    const y2 = Math.max(fixoY, limitado.y);
    z.x = Number(x1.toFixed(2));
    z.y = Number(y1.toFixed(2));
    z.largura = Number(Math.max(ZONA_MIN.largura, x2 - x1).toFixed(2));
    z.altura = Number(Math.max(ZONA_MIN.altura, y2 - y1).toFixed(2));
  }
}

// Na window, não no campo: soltar fora do campo precisa encerrar o gesto.
window.addEventListener("pointermove", (ev) => {
  if (estado.arrasto) {
    moverArrasto(campo.percentualDoPonteiro(campoEl, ev));
    renderizarBoard();
    return;
  }
  if (estado.desenho) {
    const p = campo.percentualDoPonteiro(campoEl, ev);
    const seta = estado.desenho.tipo === "mov" || estado.desenho.tipo === "passe";
    const ancora = seta ? alvoDeAncoragem(p.x, p.y) : null;
    estado.ancora = ancora ? ancora.id : null;
    estado.desenho.x2 = ancora ? ancora.x : p.x;
    estado.desenho.y2 = ancora ? ancora.y : p.y;
    renderizarBoard();
  }
});

function encerrarGesto() {
  if (estado.arrasto) {
    estado.arrasto = null;
    estado.ancora = null;
    if (estado.fotoAnterior) {
      empilhar(estado.fotoAnterior);
      estado.fotoAnterior = null;
    }
    renderizarBoard();
    return;
  }
  if (estado.desenho) confirmarDesenho();
}

window.addEventListener("pointerup", encerrarGesto);
window.addEventListener("pointercancel", encerrarGesto);
window.addEventListener("blur", encerrarGesto);

/* ---------- criação de marcações ---------- */

campoEl.addEventListener("pointerdown", (ev) => {
  fecharMenu();
  const ferramenta = estado.ferramenta;
  if (ferramenta === "select") { limparSelecao(); return; }

  const p = campo.percentualDoPonteiro(campoEl, ev);

  if (ferramenta === "bola") {
    const limitado = campo.dentroDoGramado(p.x, p.y);
    alterar(() => {
      estado.variacao.bola = { x: Number(limitado.x.toFixed(2)), y: Number(limitado.y.toFixed(2)) };
    });
    trocarFerramenta("select");
    selecionar("bola", 0);
    return;
  }

  if (ferramenta === "texto") {
    const texto = prompt("Texto da nota:", "Nota");
    if (!texto || !texto.trim()) return;
    const limitado = campo.dentroDoGramado(p.x, p.y);
    alterar(() => {
      estado.variacao.anotacoes.push({
        texto: texto.trim().slice(0, 40),
        x: Number(limitado.x.toFixed(2)),
        y: Number(limitado.y.toFixed(2)),
      });
    });
    trocarFerramenta("select");
    selecionar("anotacoes", estado.variacao.anotacoes.length - 1);
    return;
  }

  capturar(ev);
  const ancora = ferramenta === "zona" ? null : alvoDeAncoragem(p.x, p.y);
  const inicio = ancora || p;
  estado.ancora = ancora ? ancora.id : null;
  estado.desenho = { tipo: ferramenta, x1: inicio.x, y1: inicio.y, x2: inicio.x, y2: inicio.y };
});

function confirmarDesenho() {
  const d = estado.desenho;
  estado.desenho = null;
  estado.ancora = null;
  const longo = Math.abs(d.x2 - d.x1) > 1.2 || Math.abs(d.y2 - d.y1) > 1.8;
  if (!longo) { renderizarBoard(); return; }

  if (d.tipo === "zona") {
    alterar(() => {
      estado.variacao.zonas.push({
        time: "neutra",
        x: Number(Math.min(d.x1, d.x2).toFixed(2)),
        y: Number(Math.min(d.y1, d.y2).toFixed(2)),
        largura: Number(Math.max(ZONA_MIN.largura, Math.abs(d.x2 - d.x1)).toFixed(2)),
        altura: Number(Math.max(ZONA_MIN.altura, Math.abs(d.y2 - d.y1)).toFixed(2)),
      });
    });
    trocarFerramenta("select");
    selecionar("zonas", estado.variacao.zonas.length - 1);
    return;
  }

  alterar(() => {
    estado.variacao.desenhos.push({
      tipo: d.tipo,
      x1: Number(d.x1.toFixed(2)), y1: Number(d.y1.toFixed(2)),
      x2: Number(d.x2.toFixed(2)), y2: Number(d.y2.toFixed(2)),
    });
  });
  trocarFerramenta("select");
  selecionar("desenhos", estado.variacao.desenhos.length - 1);
}

function removerMarcacao() {
  const s = estado.selecao;
  if (!s || !["desenhos", "zonas", "anotacoes"].includes(s.camada)) return;
  alterar(() => {
    estado.variacao[s.camada].splice(s.indice, 1);
    estado.selecao = null;
  });
}

/* ---------- elenco ---------- */

function colocarEmCampo(time, indice) {
  const emCampo = estado.variacao[time].filter((j) => j.em_campo).length;
  if (emCampo >= MAX_EM_CAMPO) {
    mostrarToast(`O time já tem ${MAX_EM_CAMPO} em campo.`);
    return;
  }
  alterar(() => {
    const j = estado.variacao[time][indice];
    j.em_campo = true;
    j.x = time === "casa" ? 30 : 70;
    j.y = 50;
  });
}

function mandarAoBanco(time, indice) {
  alterar(() => {
    const j = estado.variacao[time][indice];
    j.em_campo = false;
    j.x = null;
    j.y = null;
  });
}

function adicionarJogador(time) {
  const usados = new Set(estado.variacao[time].map((j) => j.numero));
  let numero = 1;
  while (usados.has(numero) && numero < 99) numero += 1;
  if (usados.has(numero)) {
    mostrarToast("Não há número livre entre 1 e 99 neste time.");
    return;
  }
  alterar(() => {
    estado.variacao[time].push({ numero, papel: "RES", em_campo: false, x: null, y: null });
  });
  mostrarToast("Jogador no banco");
}

/* ---------- teclado ---------- */

function moverPorTeclado(ev, time, indice) {
  const passo = ev.shiftKey ? 4 : 1;
  const dx = ev.key === "ArrowLeft" ? -passo : ev.key === "ArrowRight" ? passo : 0;
  const dy = ev.key === "ArrowUp" ? -passo : ev.key === "ArrowDown" ? passo : 0;
  if (dx || dy) {
    ev.preventDefault();
    const j = estado.variacao[time][indice];
    const limitado = campo.dentroDoGramado(j.x + dx, j.y + dy);
    alterar(() => {
      estado.variacao[time][indice].x = Number(limitado.x.toFixed(2));
      estado.variacao[time][indice].y = Number(limitado.y.toFixed(2));
      estado.selecao = { camada: time, indice };
    });
    return;
  }
  if (ev.key === "Enter" || ev.key === " ") {
    ev.preventDefault();
    selecionar(time, indice);
  }
}

function moverBolaPorTeclado(ev) {
  const passo = ev.shiftKey ? 4 : 1;
  const dx = ev.key === "ArrowLeft" ? -passo : ev.key === "ArrowRight" ? passo : 0;
  const dy = ev.key === "ArrowUp" ? -passo : ev.key === "ArrowDown" ? passo : 0;
  if (!dx && !dy) return;
  ev.preventDefault();
  const b = estado.variacao.bola;
  const limitado = campo.dentroDoGramado(b.x + dx, b.y + dy);
  alterar(() => {
    estado.variacao.bola = { x: Number(limitado.x.toFixed(2)), y: Number(limitado.y.toFixed(2)) };
  });
}

function moverMarcacaoPorTeclado(ev) {
  const passo = ev.shiftKey ? 4 : 1;
  const dx = ev.key === "ArrowLeft" ? -passo : ev.key === "ArrowRight" ? passo : 0;
  const dy = ev.key === "ArrowUp" ? -passo : ev.key === "ArrowDown" ? passo : 0;
  if (!dx && !dy) return;

  const { camada, indice } = estado.selecao;
  const alvo = estado.variacao[camada][indice];
  if (!alvo) return;

  alterar(() => {
    if (camada === "desenhos") {
      const limite = (v, d) => campo.limitar(v + d, 0, 100);
      const cabe = limite(alvo.x1, dx) - alvo.x1 === dx && limite(alvo.x2, dx) - alvo.x2 === dx
        && limite(alvo.y1, dy) - alvo.y1 === dy && limite(alvo.y2, dy) - alvo.y2 === dy;
      if (!cabe) return;
      alvo.x1 = Number((alvo.x1 + dx).toFixed(2));
      alvo.y1 = Number((alvo.y1 + dy).toFixed(2));
      alvo.x2 = Number((alvo.x2 + dx).toFixed(2));
      alvo.y2 = Number((alvo.y2 + dy).toFixed(2));
    } else if (camada === "zonas") {
      alvo.x = Number(campo.limitar(alvo.x + dx, 0, 100 - alvo.largura).toFixed(2));
      alvo.y = Number(campo.limitar(alvo.y + dy, 0, 100 - alvo.altura).toFixed(2));
    } else {
      const p = campo.dentroDoGramado(alvo.x + dx, alvo.y + dy);
      alvo.x = Number(p.x.toFixed(2));
      alvo.y = Number(p.y.toFixed(2));
    }
    estado.selecao = { camada, indice };
  });
}

window.addEventListener("keydown", (ev) => {
  const tag = (ev.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return;

  const meta = ev.metaKey || ev.ctrlKey;
  if (meta && (ev.key === "z" || ev.key === "Z")) {
    ev.preventDefault();
    desfazer(ev.shiftKey ? "refazer" : "desfazer");
    return;
  }
  if (meta && (ev.key === "y" || ev.key === "Y")) {
    ev.preventDefault();
    desfazer("refazer");
    return;
  }
  if (meta) return;

  if (ev.key === "Escape") {
    estado.desenho = null;
    estado.selecao = null;
    fecharMenu();
    trocarFerramenta("select");
    return;
  }
  if ((ev.key === "Delete" || ev.key === "Backspace") && estado.selecao) {
    if (["desenhos", "zonas", "anotacoes"].includes(estado.selecao.camada)) {
      ev.preventDefault();
      removerMarcacao();
    }
    return;
  }
  if (ev.key.startsWith("Arrow") && estado.selecao
      && ["desenhos", "zonas", "anotacoes"].includes(estado.selecao.camada)) {
    ev.preventDefault();
    moverMarcacaoPorTeclado(ev);
    return;
  }
  const atalhos = { v: "select", b: "bola", m: "mov", p: "passe", z: "zona", t: "texto" };
  const alvo = atalhos[ev.key.toLowerCase()];
  if (alvo && estado.variacao) trocarFerramenta(alvo);
});

/* ---------- carga e persistência ---------- */

async function executar(acao, aoTerminar, preservarSujo = false) {
  if (ocupado) return;
  ocupado = true;
  document.body.classList.add("ocupado");
  try {
    await acao();
    await carregar(preservarSujo);
    if (aoTerminar) aoTerminar();
  } catch (e) {
    mostrarToast(e.message);
  } finally {
    ocupado = false;
    document.body.classList.remove("ocupado");
  }
}

// Só a carga mais recente escreve no estado: respostas fora de ordem são descartadas.
let cargaAtual = 0;

async function carregar(preservarSujo = false) {
  const carga = ++cargaAtual;
  let recebidos;
  try {
    recebidos = await api.listarEsquemas(estado.filtro);
  } catch (e) {
    if (carga !== cargaAtual) return;
    estadoListaEl.textContent = e.message;
    estadoListaEl.className = "estado erro";
    estadoListaEl.hidden = false;
    listaEl.hidden = true;
    boardEl.hidden = true;
    return;
  }
  if (carga !== cargaAtual) return;
  estado.esquemas = recebidos;
  estadoListaEl.className = "estado";

  const esquema = estado.esquemas.find((e) => e.id === estado.esquemaId) || estado.esquemas[0] || null;
  estado.esquemaId = esquema ? esquema.id : null;
  const variacao = esquema
    ? esquema.variacoes.find((v) => v.id === estado.variacaoId) || esquema.variacoes[0]
    : null;
  const mesmaVariacao = variacao && variacao.id === estado.variacaoId;

  estado.variacaoId = variacao ? variacao.id : null;
  if (!(preservarSujo && mesmaVariacao && estado.sujo)) {
    estado.variacao = variacao ? clonarVariacao(variacao) : null;
    estado.selecao = null;
    marcarSujo(false);
  }
  renderizarBoard();
}

function selecionarEsquema(id) {
  if (id === estado.esquemaId) {
    estado.gaveta = false;
    aplicarGaveta();
    return;
  }
  if (!confirmarDescarte()) return;
  const esquema = estado.esquemas.find((e) => e.id === id);
  if (!esquema) return;
  estado.esquemaId = id;
  const primeira = esquema.variacoes[0];
  estado.variacaoId = primeira ? primeira.id : null;
  estado.variacao = primeira ? clonarVariacao(primeira) : null;
  estado.selecao = null;
  estado.gaveta = false;
  marcarSujo(false);
  aplicarGaveta();
  renderizarBoard();
}

function selecionarVariacao(id) {
  if (id === estado.variacaoId) return;
  if (!confirmarDescarte()) return;
  const esquema = esquemaAtual();
  const v = esquema && esquema.variacoes.find((x) => x.id === id);
  if (!v) return;
  estado.variacaoId = id;
  estado.variacao = clonarVariacao(v);
  estado.selecao = null;
  marcarSujo(false);
  renderizarBoard();
}

async function salvarVariacao() {
  if (!estado.variacao || !estado.sujo) return;
  const v = estado.variacao;
  await executar(
    () => api.atualizarVariacao(estado.esquemaId, estado.variacaoId, {
      chave: v.chave,
      nome: v.nome,
      casa: v.casa,
      visitante: v.visitante,
      bola: v.bola,
      desenhos: v.desenhos,
      zonas: v.zonas,
      anotacoes: v.anotacoes,
    }),
    () => mostrarToast("Plano salvo"),
  );
}

async function recarregarEsquema() {
  if (!estado.esquemaId || ocupado) return;
  if (estado.sujo && !confirm("Há alterações não salvas. Descartar e buscar do servidor?")) return;
  ocupado = true;
  try {
    const atual = await api.obterEsquema(estado.esquemaId);
    const indice = estado.esquemas.findIndex((e) => e.id === atual.id);
    if (indice >= 0) estado.esquemas[indice] = atual;
    const variacao = atual.variacoes.find((v) => v.id === estado.variacaoId) || atual.variacoes[0];
    estado.variacaoId = variacao ? variacao.id : null;
    estado.variacao = variacao ? clonarVariacao(variacao) : null;
    estado.selecao = null;
    estado.historico = {};
    marcarSujo(false);
    renderizarBoard();
    mostrarToast("Estado recarregado");
  } catch (e) {
    mostrarToast(e.message);
  } finally {
    ocupado = false;
  }
}

/* ---------- modais ---------- */

const dialogo = el("dialogo");
const dialogoVariacao = el("dialogo-variacao");

function marcarTipo(tipo) {
  tipoRascunho = tipo;
  el("dlg-tipo").querySelectorAll("button").forEach((b) => {
    b.classList.toggle("ativo", b.dataset.tipo === tipo);
  });
}

function abrirDialogoEsquema(esquema) {
  editandoId = esquema ? esquema.id : null;
  el("dialogo-titulo").textContent = esquema ? "Dados do plano" : "Novo plano tático";
  el("dlg-salvar").textContent = esquema ? "Salvar dados" : "Criar";
  el("dlg-nome").value = esquema ? esquema.nome : "";
  el("dlg-formacao").value = esquema ? esquema.formacao : "4-3-3";
  el("dlg-anotacoes").value = esquema ? esquema.anotacoes : "";
  el("dlg-erro").textContent = "";
  marcarTipo(esquema ? esquema.tipo : "ofensivo");
  fecharMenu();
  dialogo.showModal();
}

function abrirDialogoVariacao() {
  if (!confirmarDescarte()) return;
  el("var-nome").value = "";
  el("var-erro").textContent = "";
  dialogoVariacao.showModal();
}

el("dlg-tipo").addEventListener("click", (ev) => {
  const botao = ev.target.closest("button[data-tipo]");
  if (botao) marcarTipo(botao.dataset.tipo);
});

el("form-esquema").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const dados = {
    nome: el("dlg-nome").value.trim(),
    formacao: el("dlg-formacao").value.trim(),
    tipo: tipoRascunho,
    anotacoes: el("dlg-anotacoes").value,
  };

  const original = editandoId ? esquemaAtual() : null;
  if (original && dados.formacao !== original.formacao) {
    const aviso = `Trocar a formação de ${original.formacao} para ${dados.formacao} reposiciona `
      + "os dois times em todas as variações. Continuar?";
    if (!confirm(aviso)) return;
  }

  if (ocupado) return;
  ocupado = true;
  try {
    const salvo = editandoId
      ? await api.atualizarEsquema(editandoId, dados)
      : await api.criarEsquema(dados);
    dialogo.close();
    estado.esquemaId = salvo.id;
    estado.variacaoId = salvo.variacoes[0] ? salvo.variacoes[0].id : null;
    estado.historico = {};
    marcarSujo(false);
    await carregar();
    mostrarToast(editandoId ? "Dados atualizados" : "Plano criado");
  } catch (e) {
    el("dlg-erro").textContent = e.message;
  } finally {
    ocupado = false;
  }
});

el("form-variacao").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (ocupado) return;
  ocupado = true;
  try {
    const salvo = await api.criarVariacao(estado.esquemaId, { nome: el("var-nome").value.trim() });
    dialogoVariacao.close();
    const nova = salvo.variacoes[salvo.variacoes.length - 1];
    estado.variacaoId = nova.id;
    estado.historico = {};
    marcarSujo(false);
    await carregar();
    mostrarToast("Variação criada");
  } catch (e) {
    el("var-erro").textContent = e.message;
  } finally {
    ocupado = false;
  }
});

document.querySelectorAll("[data-fechar]").forEach((b) =>
  b.addEventListener("click", () => b.closest("dialog").close()));

/* ---------- menu e inspector ---------- */

function fecharMenu() { menuEl.hidden = true; }

el("menu-btn").addEventListener("click", (ev) => {
  ev.stopPropagation();
  menuEl.hidden = !menuEl.hidden;
});

document.addEventListener("click", (ev) => {
  if (!menuEl.hidden && !ev.target.closest(".menu-wrap")) fecharMenu();
});

menuEl.addEventListener("click", (ev) => {
  const botao = ev.target.closest("button[data-acao]");
  if (!botao) return;
  fecharMenu();
  const acao = botao.dataset.acao;

  if (acao === "recarregar") { recarregarEsquema(); return; }
  if (!confirmarDescarte()) return;

  if (acao === "editar") { abrirDialogoEsquema(esquemaAtual()); return; }
  if (acao === "duplicar") {
    executar(async () => {
      const copia = await api.duplicarEsquema(estado.esquemaId);
      estado.esquemaId = copia.id;
      estado.variacaoId = copia.variacoes[0] ? copia.variacoes[0].id : null;
    }, () => mostrarToast("Plano duplicado"));
    return;
  }
  if (acao === "excluir") {
    const esquema = esquemaAtual();
    if (!esquema || !confirm(`Excluir o plano "${esquema.nome}" e suas variações?`)) return;
    executar(async () => {
      await api.excluirEsquema(esquema.id);
      estado.esquemaId = null;
      estado.variacaoId = null;
    }, () => mostrarToast("Plano excluído"));
  }
});

el("salvar").addEventListener("click", salvarVariacao);
el("novo").addEventListener("click", () => {
  if (confirmarDescarte()) abrirDialogoEsquema(null);
});

el("aba-contexto").addEventListener("click", () => { estado.aba = "contexto"; renderizarInspector(); });
el("aba-banco").addEventListener("click", () => {
  estado.aba = "banco";
  estado.inspectorAberto = true;
  estado.inspectorFixado = true;
  renderizarBoard();
});
el("abrir-contexto").addEventListener("click", () => {
  estado.aba = "contexto";
  estado.inspectorAberto = true;
  estado.inspectorFixado = true;
  renderizarBoard();
});
el("abrir-banco").addEventListener("click", () => {
  estado.aba = "banco";
  estado.inspectorAberto = true;
  estado.inspectorFixado = true;
  renderizarBoard();
});
el("fechar-inspector").addEventListener("click", () => {
  estado.inspectorAberto = false;
  estado.inspectorFixado = false;
  renderizarBoard();
});

/* ---------- gaveta ---------- */

function aplicarGaveta() {
  el("lateral").classList.toggle("lateral-aberta", estado.gaveta);
  const existente = document.querySelector(".gaveta-fundo");
  if (estado.gaveta && !existente) {
    const fundo = document.createElement("div");
    fundo.className = "gaveta-fundo";
    fundo.addEventListener("click", () => { estado.gaveta = false; aplicarGaveta(); });
    document.querySelector(".app").appendChild(fundo);
  } else if (!estado.gaveta && existente) {
    existente.remove();
  }
}

el("gaveta").addEventListener("click", () => { estado.gaveta = !estado.gaveta; aplicarGaveta(); });

window.addEventListener("beforeunload", (ev) => {
  if (estado.sujo) ev.preventDefault();
});

window.addEventListener("resize", () => {
  if (estado.variacao) renderizarBoard();
});

renderizarFerramentas();
carregar();
