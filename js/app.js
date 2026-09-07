const el = (id) => document.getElementById(id);
const estadoListaEl = el("estado-lista");
const listaEl = el("lista");
const estadoBoardEl = el("estado-board");
const boardEl = el("board");
const campoEl = el("campo");
const filtroEl = el("filtro-tipo");
const mensagemEl = el("mensagem");
const dirtyEl = el("dirty");
const selecaoEl = el("selecao");

const ROTULO_TIPO = { ofensivo: "Ofensivo", defensivo: "Defensivo", bola_parada: "Bola parada" };
const TIMES = ["casa", "visitante"];
const MAX_EM_CAMPO = 11;

// `variacao` é cópia de trabalho: o arrasto altera ela, e só o Salvar manda para a API.
const estado = {
  esquemas: [],
  esquemaId: null,
  variacaoId: null,
  variacao: null,
  selecionado: null,
  sujo: false,
};

function mostrarMensagem(texto, classe) {
  mensagemEl.textContent = texto || "";
  mensagemEl.className = "mensagem " + (classe || "");
}

function marcarSujo(valor) {
  estado.sujo = valor;
  dirtyEl.textContent = valor ? "Alterações não salvas" : "";
}

function esquemaAtual() {
  return estado.esquemas.find((e) => e.id === estado.esquemaId) || null;
}

function criarItemLista(esquema) {
  const item = document.createElement("div");
  const aberto = esquema.id === estado.esquemaId;
  item.className = "item" + (aberto ? " item-aberto" : "");

  const cabecalho = document.createElement("button");
  cabecalho.type = "button";
  cabecalho.className = "item-cabecalho";
  cabecalho.innerHTML = `
    <span class="item-nome"></span>
    <span class="badge badge-${esquema.tipo}">${ROTULO_TIPO[esquema.tipo] || esquema.tipo}</span>`;
  cabecalho.querySelector(".item-nome").textContent = esquema.nome;
  cabecalho.addEventListener("click", () => selecionarEsquema(esquema.id));
  item.appendChild(cabecalho);

  const meta = document.createElement("p");
  meta.className = "item-meta";
  meta.textContent = "Formação " + esquema.formacao;
  item.appendChild(meta);

  if (aberto) {
    const variacoes = document.createElement("div");
    variacoes.className = "variacoes";
    esquema.variacoes.forEach((v) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "variacao" + (v.id === estado.variacaoId ? " variacao-ativa" : "");
      botao.textContent = v.nome;
      botao.addEventListener("click", () => selecionarVariacao(v.id));
      if (v.chave === "custom") {
        const excluir = document.createElement("span");
        excluir.className = "variacao-excluir";
        excluir.textContent = "×";
        excluir.title = "Excluir variação";
        excluir.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          if (!confirm(`Excluir a variação "${v.nome}"?`)) return;
          await executar(() => api.excluirVariacao(esquema.id, v.id));
        });
        botao.appendChild(excluir);
      }
      variacoes.appendChild(botao);
    });

    const nova = document.createElement("button");
    nova.type = "button";
    nova.className = "variacao variacao-nova";
    nova.textContent = "+ Variação";
    nova.addEventListener("click", abrirDialogoVariacao);
    variacoes.appendChild(nova);
    item.appendChild(variacoes);
  }
  return item;
}

function renderizarLista() {
  if (estado.esquemas.length === 0) {
    estadoListaEl.textContent = filtroEl.value
      ? "Nenhum esquema deste tipo."
      : "Nenhum esquema ainda. Crie o primeiro.";
    estadoListaEl.hidden = false;
    listaEl.hidden = true;
    return;
  }
  listaEl.replaceChildren(...estado.esquemas.map(criarItemLista));
  estadoListaEl.hidden = true;
  listaEl.hidden = false;
}

function clonarVariacao(v) {
  return {
    id: v.id,
    chave: v.chave,
    nome: v.nome,
    casa: v.casa.map((j) => ({ ...j })),
    visitante: v.visitante.map((j) => ({ ...j })),
  };
}

function selecionarEsquema(id) {
  if (!confirmarDescarte()) return;
  const esquema = estado.esquemas.find((e) => e.id === id);
  if (!esquema) return;
  estado.esquemaId = id;
  const primeira = esquema.variacoes[0];
  estado.variacaoId = primeira ? primeira.id : null;
  estado.variacao = primeira ? clonarVariacao(primeira) : null;
  estado.selecionado = null;
  marcarSujo(false);
  mostrarMensagem("");
  renderizarLista();
  renderizarBoard();
}

function selecionarVariacao(id) {
  if (!confirmarDescarte()) return;
  const esquema = esquemaAtual();
  const v = esquema && esquema.variacoes.find((x) => x.id === id);
  if (!v) return;
  estado.variacaoId = id;
  estado.variacao = clonarVariacao(v);
  estado.selecionado = null;
  marcarSujo(false);
  mostrarMensagem("");
  renderizarLista();
  renderizarBoard();
}

function confirmarDescarte() {
  if (!estado.sujo) return true;
  return confirm("Há alterações não salvas nesta variação. Descartar?");
}

function criarFicha(jogador, time) {
  const ficha = document.createElement("div");
  const selecionado =
    estado.selecionado && estado.selecionado.time === time && estado.selecionado.numero === jogador.numero;
  ficha.className = `ficha ficha-${time}` + (selecionado ? " ficha-selecionada" : "");
  ficha.style.left = jogador.x + "%";
  ficha.style.top = jogador.y + "%";
  ficha.dataset.time = time;
  ficha.dataset.numero = String(jogador.numero);

  const numero = document.createElement("span");
  numero.textContent = jogador.numero;
  ficha.appendChild(numero);

  const papel = document.createElement("span");
  papel.className = "papel";
  papel.textContent = jogador.papel;
  ficha.appendChild(papel);

  ficha.addEventListener("pointerdown", (ev) => iniciarArrasto(ev, ficha, jogador, time));
  return ficha;
}

function renderizarBanco(time) {
  const alvo = el("banco-" + time);
  const reservas = estado.variacao[time].filter((j) => !j.em_campo);
  if (reservas.length === 0) {
    alvo.innerHTML = '<span class="banco-vazio">Ninguém no banco.</span>';
    return;
  }
  alvo.replaceChildren(
    ...reservas.map((j) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `chip chip-${time}`;
      chip.textContent = `${j.numero} ${j.papel}`;
      chip.title = "Selecionar";
      chip.addEventListener("click", () => {
        estado.selecionado = { time, numero: j.numero };
        renderizarBoard();
      });
      const entrar = document.createElement("span");
      entrar.className = "chip-acao";
      entrar.textContent = "↑";
      entrar.title = "Colocar em campo";
      entrar.addEventListener("click", (ev) => {
        ev.stopPropagation();
        colocarEmCampo(time, j.numero);
      });
      chip.appendChild(entrar);
      return chip;
    })
  );
}

function renderizarSelecao() {
  const sel = estado.selecionado;
  if (!sel) {
    selecaoEl.hidden = true;
    return;
  }
  const jogador = estado.variacao[sel.time].find((j) => j.numero === sel.numero);
  if (!jogador) {
    estado.selecionado = null;
    selecaoEl.hidden = true;
    return;
  }
  selecaoEl.hidden = false;
  el("sel-numero").value = jogador.numero;
  el("sel-papel").value = jogador.papel;
  el("sel-banco").textContent = jogador.em_campo ? "Mandar ao banco" : "Colocar em campo";
}

function renderizarBoard() {
  const esquema = esquemaAtual();
  if (!esquema || !estado.variacao) {
    boardEl.hidden = true;
    estadoBoardEl.hidden = false;
    estadoBoardEl.textContent = esquema
      ? "Este esquema não tem variações."
      : "Selecione um esquema à esquerda.";
    return;
  }
  estadoBoardEl.hidden = true;
  boardEl.hidden = false;

  el("board-titulo").textContent = `${esquema.nome} — ${estado.variacao.nome}`;
  const emCampo = TIMES.map((t) => estado.variacao[t].filter((j) => j.em_campo).length);
  el("board-subtitulo").textContent =
    `Formação ${esquema.formacao} · ${ROTULO_TIPO[esquema.tipo] || esquema.tipo} · ` +
    `${emCampo[0]} x ${emCampo[1]} em campo`;

  campoEl.querySelectorAll(".ficha").forEach((f) => f.remove());
  TIMES.forEach((time) => {
    estado.variacao[time]
      .filter((j) => j.em_campo)
      .forEach((j) => campoEl.appendChild(criarFicha(j, time)));
    renderizarBanco(time);
  });
  renderizarSelecao();
}

function iniciarArrasto(ev, ficha, jogador, time) {
  ev.preventDefault();
  estado.selecionado = { time, numero: jogador.numero };
  renderizarSelecao();
  campoEl.querySelectorAll(".ficha-selecionada").forEach((f) => f.classList.remove("ficha-selecionada"));
  ficha.classList.add("ficha-selecionada", "arrastando");
  ficha.setPointerCapture(ev.pointerId);

  const mover = (e) => {
    const caixa = campoEl.getBoundingClientRect();
    // Percentual do ponteiro dentro do campo, limitado a 0-100 para a ficha não sair.
    const x = Math.min(100, Math.max(0, ((e.clientX - caixa.left) / caixa.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - caixa.top) / caixa.height) * 100));
    jogador.x = Math.round(x * 10) / 10;
    jogador.y = Math.round(y * 10) / 10;
    ficha.style.left = jogador.x + "%";
    ficha.style.top = jogador.y + "%";
    marcarSujo(true);
  };

  const soltar = () => {
    ficha.classList.remove("arrastando");
    ficha.releasePointerCapture(ev.pointerId);
    ficha.removeEventListener("pointermove", mover);
    ficha.removeEventListener("pointerup", soltar);
    ficha.removeEventListener("pointercancel", soltar);
  };

  ficha.addEventListener("pointermove", mover);
  ficha.addEventListener("pointerup", soltar);
  ficha.addEventListener("pointercancel", soltar);
}

function colocarEmCampo(time, numero) {
  const lista = estado.variacao[time];
  if (lista.filter((j) => j.em_campo).length >= MAX_EM_CAMPO) {
    mostrarMensagem(`O time já tem ${MAX_EM_CAMPO} em campo. Mande alguém ao banco antes.`, "erro");
    return;
  }
  const jogador = lista.find((j) => j.numero === numero);
  jogador.em_campo = true;
  jogador.x = 50;
  jogador.y = time === "casa" ? 70 : 30;
  marcarSujo(true);
  mostrarMensagem("");
  renderizarBoard();
}

function mandarAoBanco(time, numero) {
  const jogador = estado.variacao[time].find((j) => j.numero === numero);
  jogador.em_campo = false;
  jogador.x = null;
  jogador.y = null;
  marcarSujo(true);
  renderizarBoard();
}

function proximoNumero(time) {
  const usados = new Set(estado.variacao[time].map((j) => j.numero));
  for (let n = 1; n <= 99; n += 1) if (!usados.has(n)) return n;
  return null;
}

function adicionarJogador(time) {
  const numero = proximoNumero(time);
  if (numero === null) {
    mostrarMensagem("Não há número livre entre 1 e 99 neste time.", "erro");
    return;
  }
  estado.variacao[time].push({ numero, papel: "RES", em_campo: false, x: null, y: null });
  estado.selecionado = { time, numero };
  marcarSujo(true);
  mostrarMensagem("");
  renderizarBoard();
}

function removerJogador(time, numero) {
  estado.variacao[time] = estado.variacao[time].filter((j) => j.numero !== numero);
  estado.selecionado = null;
  marcarSujo(true);
  renderizarBoard();
}

async function executar(acao, aoTerminar) {
  try {
    mostrarMensagem("");
    await acao();
    await carregar();
    if (aoTerminar) aoTerminar();
  } catch (e) {
    mostrarMensagem(e.message, "erro");
  }
}

async function carregar() {
  try {
    estado.esquemas = await api.listarEsquemas(filtroEl.value);
  } catch (e) {
    estadoListaEl.textContent = e.message;
    estadoListaEl.className = "estado erro";
    estadoListaEl.hidden = false;
    listaEl.hidden = true;
    boardEl.hidden = true;
    return;
  }
  estadoListaEl.className = "estado";

  // Mantém a seleção se ela sobreviveu ao recarregamento; senão cai no primeiro.
  const esquema = estado.esquemas.find((e) => e.id === estado.esquemaId) || estado.esquemas[0] || null;
  estado.esquemaId = esquema ? esquema.id : null;
  const variacao = esquema
    ? esquema.variacoes.find((v) => v.id === estado.variacaoId) || esquema.variacoes[0]
    : null;
  estado.variacaoId = variacao ? variacao.id : null;
  estado.variacao = variacao ? clonarVariacao(variacao) : null;
  marcarSujo(false);
  renderizarLista();
  renderizarBoard();
}

async function salvarVariacao() {
  if (!estado.variacao) return;
  await executar(
    () =>
      api.atualizarVariacao(estado.esquemaId, estado.variacaoId, {
        chave: estado.variacao.chave,
        nome: estado.variacao.nome,
        casa: estado.variacao.casa,
        visitante: estado.variacao.visitante,
      }),
    () => mostrarMensagem("Variação salva.", "sucesso")
  );
}

const dialogo = el("dialogo");
const dialogoVariacao = el("dialogo-variacao");
let editandoId = null;

function abrirDialogoEsquema(esquema) {
  editandoId = esquema ? esquema.id : null;
  el("dialogo-titulo").textContent = esquema ? "Editar esquema" : "Novo esquema";
  el("dlg-nome").value = esquema ? esquema.nome : "";
  el("dlg-formacao").value = esquema ? esquema.formacao : "4-3-3";
  el("dlg-tipo").value = esquema ? esquema.tipo : "ofensivo";
  el("dlg-anotacoes").value = esquema ? esquema.anotacoes : "";
  el("dlg-erro").textContent = "";
  dialogo.showModal();
}

function abrirDialogoVariacao() {
  el("var-nome").value = "";
  el("var-erro").textContent = "";
  dialogoVariacao.showModal();
}

el("form-esquema").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const dados = {
    nome: el("dlg-nome").value.trim(),
    formacao: el("dlg-formacao").value.trim(),
    tipo: el("dlg-tipo").value,
    anotacoes: el("dlg-anotacoes").value,
  };
  try {
    const salvo = editandoId
      ? await api.atualizarEsquema(editandoId, dados)
      : await api.criarEsquema(dados);
    dialogo.close();
    estado.esquemaId = salvo.id;
    estado.variacaoId = salvo.variacoes[0] ? salvo.variacoes[0].id : null;
    marcarSujo(false);
    await carregar();
  } catch (e) {
    el("dlg-erro").textContent = e.message;
  }
});

el("form-variacao").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    const salvo = await api.criarVariacao(estado.esquemaId, { nome: el("var-nome").value.trim() });
    dialogoVariacao.close();
    const nova = salvo.variacoes[salvo.variacoes.length - 1];
    estado.variacaoId = nova.id;
    marcarSujo(false);
    await carregar();
  } catch (e) {
    el("var-erro").textContent = e.message;
  }
});

document.querySelectorAll("[data-fechar]").forEach((b) =>
  b.addEventListener("click", () => b.closest("dialog").close())
);

el("novo").addEventListener("click", () => abrirDialogoEsquema(null));
el("editar-dados").addEventListener("click", () => abrirDialogoEsquema(esquemaAtual()));
el("salvar").addEventListener("click", salvarVariacao);

el("duplicar").addEventListener("click", () =>
  executar(async () => {
    const copia = await api.duplicarEsquema(estado.esquemaId);
    estado.esquemaId = copia.id;
    estado.variacaoId = copia.variacoes[0] ? copia.variacoes[0].id : null;
  })
);

el("excluir").addEventListener("click", () => {
  const esquema = esquemaAtual();
  if (!esquema || !confirm(`Excluir o esquema "${esquema.nome}"?`)) return;
  executar(async () => {
    await api.excluirEsquema(esquema.id);
    estado.esquemaId = null;
    estado.variacaoId = null;
  });
});

document.querySelectorAll("[data-adicionar]").forEach((b) =>
  b.addEventListener("click", () => adicionarJogador(b.dataset.adicionar))
);

el("sel-banco").addEventListener("click", () => {
  const sel = estado.selecionado;
  if (!sel) return;
  const jogador = estado.variacao[sel.time].find((j) => j.numero === sel.numero);
  if (jogador.em_campo) mandarAoBanco(sel.time, sel.numero);
  else colocarEmCampo(sel.time, sel.numero);
});

el("sel-remover").addEventListener("click", () => {
  const sel = estado.selecionado;
  if (!sel) return;
  if (!confirm(`Excluir o jogador ${sel.numero} do time?`)) return;
  removerJogador(sel.time, sel.numero);
});

el("sel-numero").addEventListener("change", (ev) => {
  const sel = estado.selecionado;
  if (!sel) return;
  const novo = Number(ev.target.value);
  if (!Number.isInteger(novo) || novo < 1 || novo > 99) {
    mostrarMensagem("O número deve ser um inteiro entre 1 e 99.", "erro");
    renderizarSelecao();
    return;
  }
  if (estado.variacao[sel.time].some((j) => j.numero === novo && j.numero !== sel.numero)) {
    mostrarMensagem("Já existe um jogador com esse número neste time.", "erro");
    renderizarSelecao();
    return;
  }
  const jogador = estado.variacao[sel.time].find((j) => j.numero === sel.numero);
  jogador.numero = novo;
  estado.selecionado = { time: sel.time, numero: novo };
  mostrarMensagem("");
  marcarSujo(true);
  renderizarBoard();
});

el("sel-papel").addEventListener("input", (ev) => {
  const sel = estado.selecionado;
  if (!sel) return;
  const jogador = estado.variacao[sel.time].find((j) => j.numero === sel.numero);
  jogador.papel = ev.target.value;
  marcarSujo(true);
  const ficha = campoEl.querySelector(`.ficha[data-time="${sel.time}"][data-numero="${sel.numero}"] .papel`);
  if (ficha) ficha.textContent = ev.target.value;
});

filtroEl.addEventListener("change", () => {
  if (!confirmarDescarte()) return;
  carregar();
});

window.addEventListener("beforeunload", (ev) => {
  if (estado.sujo) ev.preventDefault();
});

carregar();
