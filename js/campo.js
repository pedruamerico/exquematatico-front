// Geometria do campo e desenho da camada tática.
// O viewBox é fixo em unidades do campo real, então o traço não escala com a tela.
const SVG_NS = "http://www.w3.org/2000/svg";
const VB_LARGURA = 1110;
const VB_ALTURA = 720;

const JOGO = { x0: 2.7, x1: 97.3, y0: 2.8, y1: 97.2 };

const campo = {
  paraUnidades(x, y) {
    return { px: (x / 100) * VB_LARGURA, py: (y / 100) * VB_ALTURA };
  },

  limitar(valor, minimo, maximo) {
    return Math.min(maximo, Math.max(minimo, valor));
  },

  dentroDoGramado(x, y) {
    return {
      x: campo.limitar(x, JOGO.x0, JOGO.x1),
      y: campo.limitar(y, JOGO.y0, JOGO.y1),
    };
  },

  percentualDoPonteiro(elemento, evento) {
    const caixa = elemento.getBoundingClientRect();
    return {
      x: campo.limitar(((evento.clientX - caixa.left) / caixa.width) * 100, 0, 100),
      y: campo.limitar(((evento.clientY - caixa.top) / caixa.height) * 100, 0, 100),
    };
  },

  criar(tag, atributos) {
    const no = document.createElementNS(SVG_NS, tag);
    Object.entries(atributos).forEach(([chave, valor]) => no.setAttribute(chave, valor));
    return no;
  },
};

function geometriaDaSeta(marcacao) {
  const p1 = campo.paraUnidades(marcacao.x1, marcacao.y1);
  const p2 = campo.paraUnidades(marcacao.x2, marcacao.y2);
  const angulo = Math.atan2(p2.py - p1.py, p2.px - p1.px);
  const COMPRIMENTO_PONTA = 17;
  const LARGURA_PONTA = 7;
  const RECUO = 13;

  const fimX = p2.px - Math.cos(angulo) * RECUO;
  const fimY = p2.py - Math.sin(angulo) * RECUO;
  const baseX = p2.px - Math.cos(angulo) * COMPRIMENTO_PONTA;
  const baseY = p2.py - Math.sin(angulo) * COMPRIMENTO_PONTA;
  const normalX = -Math.sin(angulo) * LARGURA_PONTA;
  const normalY = Math.cos(angulo) * LARGURA_PONTA;

  return {
    corpo: `M${p1.px.toFixed(1)} ${p1.py.toFixed(1)} L${fimX.toFixed(1)} ${fimY.toFixed(1)}`,
    ponta: [
      `${p2.px.toFixed(1)},${p2.py.toFixed(1)}`,
      `${(baseX + normalX).toFixed(1)},${(baseY + normalY).toFixed(1)}`,
      `${(baseX - normalX).toFixed(1)},${(baseY - normalY).toFixed(1)}`,
    ].join(" "),
    origem: p1,
  };
}

function corDoTime(time) {
  if (time === "casa") return "var(--casa)";
  if (time === "visitante") return "var(--adversario)";
  return "var(--chalk)";
}

function desenharSeta(alvo, marcacao, indice, selecionada, aoSelecionar) {
  const g = geometriaDaSeta(marcacao);
  const passe = marcacao.tipo === "passe";
  const espessura = passe ? 2.4 : 2.75;
  const cor = selecionada ? "var(--casa)" : "var(--chalk)";
  const grupo = campo.criar("g", {});

  grupo.appendChild(campo.criar("path", {
    d: g.corpo, stroke: "var(--contorno)", "stroke-width": espessura + 3,
    "stroke-linecap": "round", "vector-effect": "non-scaling-stroke", fill: "none",
  }));
  grupo.appendChild(campo.criar("polygon", {
    points: g.ponta, fill: "var(--contorno)", stroke: "var(--contorno)",
    "stroke-width": 3, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke",
  }));
  grupo.appendChild(campo.criar("path", {
    d: g.corpo, stroke: cor, "stroke-width": espessura,
    "stroke-dasharray": passe ? "7 6" : "none",
    "stroke-linecap": "round", "vector-effect": "non-scaling-stroke", fill: "none",
  }));
  grupo.appendChild(campo.criar("polygon", { points: g.ponta, fill: cor }));

  if (selecionada) {
    grupo.appendChild(campo.criar("circle", {
      cx: g.origem.px.toFixed(1), cy: g.origem.py.toFixed(1), r: 4.5,
      fill: cor, stroke: "rgba(9,12,10,.55)", "stroke-width": 1.4,
      "vector-effect": "non-scaling-stroke",
    }));
  }

  const alvoClique = campo.criar("path", {
    d: g.corpo, stroke: "transparent", "stroke-width": 16,
    "vector-effect": "non-scaling-stroke", fill: "none", class: "marcacao-alvo",
  });
  alvoClique.addEventListener("pointerdown", (ev) => aoSelecionar(ev, "desenhos", indice));
  grupo.appendChild(alvoClique);
  alvo.appendChild(grupo);
}

function desenharZona(alvo, zona, indice, selecionada, aoSelecionar) {
  const a = campo.paraUnidades(zona.x, zona.y);
  const b = campo.paraUnidades(zona.x + zona.largura, zona.y + zona.altura);
  const cor = corDoTime(zona.time);
  const grupo = campo.criar("g", {});

  const retangulo = campo.criar("rect", {
    x: a.px.toFixed(1), y: a.py.toFixed(1),
    width: (b.px - a.px).toFixed(1), height: (b.py - a.py).toFixed(1),
    fill: cor, "fill-opacity": selecionada ? 0.2 : 0.13,
    stroke: cor, "stroke-width": selecionada ? 2 : 1.5,
    "stroke-dasharray": "7 6", "vector-effect": "non-scaling-stroke",
    class: "marcacao-alvo",
  });
  retangulo.addEventListener("pointerdown", (ev) => aoSelecionar(ev, "zonas", indice));
  grupo.appendChild(retangulo);

  if (selecionada) {
    [[a.px, a.py], [b.px, a.py], [a.px, b.py], [b.px, b.py]].forEach(([x, y]) => {
      grupo.appendChild(campo.criar("rect", {
        x: (x - 2.5).toFixed(1), y: (y - 2.5).toFixed(1), width: 5, height: 5, fill: cor,
      }));
    });
  }
  alvo.appendChild(grupo);
}

function desenharPrevia(alvo, previa) {
  if (!previa) return;
  if (previa.tipo === "zona") {
    const a = campo.paraUnidades(Math.min(previa.x1, previa.x2), Math.min(previa.y1, previa.y2));
    const b = campo.paraUnidades(Math.max(previa.x1, previa.x2), Math.max(previa.y1, previa.y2));
    alvo.appendChild(campo.criar("rect", {
      x: a.px.toFixed(1), y: a.py.toFixed(1),
      width: (b.px - a.px).toFixed(1), height: (b.py - a.py).toFixed(1),
      fill: "rgba(237,239,231,.10)", stroke: "var(--chalk)", "stroke-width": 1.5,
      "stroke-dasharray": "7 6", "vector-effect": "non-scaling-stroke", opacity: 0.8,
    }));
    return;
  }
  const g = geometriaDaSeta(previa);
  alvo.appendChild(campo.criar("path", {
    d: g.corpo, stroke: "var(--chalk)", "stroke-width": previa.tipo === "passe" ? 2.4 : 2.75,
    "stroke-dasharray": previa.tipo === "passe" ? "7 6" : "none",
    "stroke-linecap": "round", "vector-effect": "non-scaling-stroke", fill: "none", opacity: 0.8,
  }));
  alvo.appendChild(campo.criar("polygon", { points: g.ponta, fill: "var(--chalk)", opacity: 0.8 }));
}

function desenharAlcas(alvo, selecao, variacao, aoArrastar) {
  alvo.replaceChildren();
  if (!selecao) return;

  const criarAlca = (px, py, cursor, sub) => {
    const alca = campo.criar("rect", {
      x: (px - 5.5).toFixed(1), y: (py - 5.5).toFixed(1), width: 11, height: 11,
      fill: "var(--chalk)", stroke: "rgba(9,12,10,.75)", "stroke-width": 1.5,
      "vector-effect": "non-scaling-stroke", class: "alca", style: `cursor:${cursor}`,
    });
    alca.addEventListener("pointerdown", (ev) => aoArrastar(ev, sub));
    alvo.appendChild(alca);
  };

  if (selecao.camada === "desenhos") {
    const d = variacao.desenhos[selecao.indice];
    if (!d) return;
    const a = campo.paraUnidades(d.x1, d.y1);
    const b = campo.paraUnidades(d.x2, d.y2);
    criarAlca(a.px, a.py, "grab", "a");
    criarAlca(b.px, b.py, "grab", "b");
  }

  if (selecao.camada === "zonas") {
    const z = variacao.zonas[selecao.indice];
    if (!z) return;
    const a = campo.paraUnidades(z.x, z.y);
    const b = campo.paraUnidades(z.x + z.largura, z.y + z.altura);
    criarAlca(a.px, a.py, "nwse-resize", "no");
    criarAlca(b.px, a.py, "nesw-resize", "ne");
    criarAlca(a.px, b.py, "nesw-resize", "so");
    criarAlca(b.px, b.py, "nwse-resize", "se");
  }
}
