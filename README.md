# ExquemaTatico Front

Frontend do ExquemaTatico, um quadro tático de futebol digital. O usuário monta esquemas
(formação, jogada, bola parada), posiciona 11 jogadores num campo arrastando as fichas,
anota e salva numa biblioteca pessoal.

A API fica em outro repositório: `exquematatico-api`.

![Editor do ExquemaTatico](docs/editor.png)

## Arquitetura

HTML, CSS e JavaScript puros, servidos como arquivos estáticos. Sem frameworks, sem
bibliotecas, sem build.

- `index.html` + `js/index.js`: biblioteca. Lista os esquemas em cards (nome, formação, tipo,
  data), filtra por tipo e oferece Abrir, Duplicar e Excluir (com confirmação).
- `editor.html` + `js/editor.js`: o quadro. Campo vertical na proporção 68 x 105 desenhado
  em CSS, 11 fichas arrastáveis via Pointer Events e formulário lateral (nome, formação,
  tipo, anotações e papel de cada ficha). Sem `?id=` na URL abre um esquema novo em 4-4-2;
  com `?id=` carrega o esquema da API. Salvar faz POST (novo) ou PUT (existente). O texto
  "Alterações não salvas" aparece ao arrastar uma ficha ou alterar qualquer campo e some ao
  carregar ou salvar.
- `js/api.js`: todas as chamadas `fetch` à API, com a base URL numa constante.
- `styles.css`: tema escuro, campo verde.
- `spike/spike.html`: prova de conceito inicial do campo responsivo com uma ficha, usada para
  validar a conversão de coordenadas antes do editor.

### Coordenadas

Cada ficha é posicionada com `left: X%; top: Y%; transform: translate(-50%, -50%)`, onde X e Y
são a posição percentual do centro da ficha em relação ao campo. Ao arrastar, o ponteiro é
convertido com `(pointerX - campo.left) / campo.width * 100` (idem para Y) e limitado a 0-100.
Como tudo é percentual, o esquema mantém as posições proporcionais em qualquer tamanho de
tela.

Após cada POST, PUT ou DELETE a página recarrega os dados da API; não há estado local além
das posições do quadro aberto.

## Execução

Suba a API primeiro (ver README do `exquematatico-api`; ela roda em `http://localhost:5001`).
Depois, nesta pasta:

```powershell
python -m http.server 8000      # Linux/macOS: python3 -m http.server 8000
```

Abra `http://localhost:8000`. Qualquer servidor de arquivos estáticos serve; `python -m
http.server` é só o mais à mão. Não há build nem dependência para instalar.

Abrir `index.html` direto do disco (duplo clique) também funciona no Chrome e no Firefox,
porque a API libera CORS para qualquer origem. Se o navegador bloquear, use o servidor acima.

## Configuração da API

A base URL está no topo de `js/api.js`:

```js
const API_BASE_URL = "http://localhost:5001";
```

Altere se a API rodar em outra porta ou host. A documentação Swagger da API fica em
`http://localhost:5001/openapi`.
