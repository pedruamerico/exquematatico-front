// Único ponto de acesso à API. Ajuste a URL abaixo se a API rodar em outra porta/host.
const API_BASE_URL = "http://localhost:5001";

async function requisitar(caminho, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(API_BASE_URL + caminho, opcoes);
  } catch (e) {
    throw new Error("Não foi possível conectar à API em " + API_BASE_URL + ".");
  }
  if (resposta.status === 204) return null;
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro || "Erro " + resposta.status + " na API.");
  return corpo;
}

function comJson(metodo, dados) {
  return { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) };
}

const api = {
  listarEsquemas: (tipo) => requisitar("/esquemas" + (tipo ? "?tipo=" + encodeURIComponent(tipo) : "")),
  obterEsquema: (id) => requisitar("/esquemas/" + id),
  criarEsquema: (dados) => requisitar("/esquemas", comJson("POST", dados)),
  atualizarEsquema: (id, dados) => requisitar("/esquemas/" + id, comJson("PUT", dados)),
  excluirEsquema: (id) => requisitar("/esquemas/" + id, { method: "DELETE" }),
  duplicarEsquema: (id) => requisitar("/esquemas/" + id + "/duplicar", { method: "POST" }),
};
