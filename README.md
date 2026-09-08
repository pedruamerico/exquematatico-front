# ExquemaTatico Front

Frontend do ExquemaTatico, um quadro tático de futebol digital. O quadro é a tela: os
esquemas ficam numa lista à esquerda e, ao selecionar um, ele expande nas suas variações.
Clicar numa variação reposiciona os 22 jogadores no campo.

A API fica em outro repositório: `exquematatico-api`.

![Editor do ExquemaTatico](docs/editor.png)

## Arquitetura

HTML, CSS e JavaScript puros, servidos como arquivos estáticos. Sem frameworks, sem
bibliotecas, sem build.

- `index.html`: a tela inteira. Lista de planos à esquerda, instrumento tático e campo ao
  centro, inspector à direita.
- `js/app.js`: estado, render, histórico por variação, ferramentas e atalhos.
- `js/campo.js`: geometria do campo e desenho da camada tática em SVG.
- `js/api.js`: todas as chamadas `fetch` à API, com a base URL numa constante.
- `styles.css`: tokens e componentes. Grafite esverdeado, giz e âmbar como única cor de
  acento; casa em disco âmbar, adversário em hexágono ciano.
- `spike/spike.html`: prova de conceito inicial do campo responsivo com uma ficha, usada para
  validar a conversão de coordenadas antes do quadro.

### Variações

Todo esquema tem Padrão, Ofensivo e Defensivo, criadas pela API a partir da formação, mais as
personalizadas que o usuário adicionar em "+ Variação". Trocar de variação não recarrega nada
da API: a lista já vem completa no `GET /esquemas`.

As três fixas não podem ser excluídas. As personalizadas têm um × ao lado do nome.

### Quadro

Campo horizontal na proporção 111 x 72 desenhado em CSS, com a casa defendendo à esquerda. O
tamanho é resolvido só em CSS — `inset` mais `margin: auto` e `aspect-ratio` — então o campo
encolhe e se recentra sozinho, sem medição em JavaScript.

As fichas são arrastáveis via Pointer Events. Cada uma é posicionada com
`left: X%; top: Y%; transform: translate(-50%, -50%)`, onde X e Y são a posição percentual do
centro em relação ao campo. Ao arrastar, o ponteiro é convertido com
`(pointerX - campo.left) / campo.width * 100` (idem para Y) e limitado ao gramado. Como tudo é
percentual, o esquema mantém as posições proporcionais em qualquer tamanho de tela.

A casa é um disco âmbar e o adversário um hexágono ciano: a forma carrega o time, e a cor só
reforça. Quem não distingue as duas cores continua lendo o quadro.

### Instrumento tático

A coluna à esquerda do campo tem seis ferramentas, cada uma com atalho de teclado:

| Ferramenta          | Tecla | O que faz                                          |
| ------------------- | ----- | -------------------------------------------------- |
| Selecionar          | `V`   | Move jogadores, bola e marcações                   |
| Posicionar a bola   | `B`   | Um clique coloca a bola onde o ponteiro está       |
| Movimentação        | `M`   | Seta sólida, arrastando da origem ao destino       |
| Linha de passe      | `P`   | Seta tracejada, mesmo gesto                        |
| Zona tática         | `Z`   | Retângulo; o inspector atribui o time              |
| Nota tática         | `T`   | Texto curto ancorado no campo                      |

Criar uma marcação devolve a ferramenta para Selecionar e já seleciona o que foi criado. Traço
curto demais é descartado, para um clique não virar seta acidental.

A ponta de uma seta a menos de 0,8 ficha de um jogador ou da bola encosta nele — o alvo acende
o anel de giz durante o desenho. É assistência, não restrição: soltar longe deixa a seta livre.

`Esc` cancela o desenho em curso e volta para Selecionar. `Delete` remove a marcação
selecionada, nunca um jogador. As setas do teclado movem a ficha em foco em 1 unidade, ou 4
com `Shift`.

### Histórico

Uma pilha de desfazer por variação, com teto de 80 entradas: trocar de variação troca de
histórico. Um arrasto inteiro grava uma entrada só — a foto é tirada no `pointerdown` e
empilhada no `pointerup`, não a cada movimento.

`Ctrl+Z` desfaz, `Ctrl+Shift+Z` e `Ctrl+Y` refazem. Nenhum atalho dispara com o foco num
campo de texto.

### Inspector

O painel da direita é contextual: sem nada selecionado ele fica recolhido numa calha de 34px,
e o campo ocupa a largura toda. Selecionar um jogador, a bola ou uma marcação abre o painel já
no contexto certo. O banco dos dois times é uma aba, não um painel permanente.

O inspector é sobreposição ancorada à direita, não coluna do grid: abrir ou fechar não muda um
pixel da geometria do campo.

### Elenco

Clicar numa ficha a seleciona e abre os campos de número e papel no painel. Dali o jogador
pode ir ao banco ou ser excluído de vez. O banco de cada time fica no painel; a seta coloca
o jogador de volta em campo, e "Adicionar jogador" cria um novo com o primeiro número livre.

O limite é de 11 em campo por time. É possível salvar com menos, para montar aos poucos.

O contador de alterações aparece no cabeçalho ao mexer em qualquer coisa, junto de um filete
laranja na borda do campo, e some ao salvar. Trocar de variação ou de esquema com alterações pendentes pede confirmação, e o mesmo
vale para o filtro de tipo, para criar variação e para excluir outra variação. Cancelar
qualquer um desses devolve a tela ao estado anterior, com as alterações intactas.

Trocar a formação no "Editar dados" avisa antes: a API regenera as variações a partir da
formação nova, então o posicionamento atual é substituído.

Enquanto uma ação fala com a API os botões ficam bloqueados, para um clique repetido não
disparar a mesma requisição duas vezes.

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
