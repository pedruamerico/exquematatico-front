# ExquemaTatico Front

Frontend do ExquemaTatico, um quadro tático de futebol digital. O quadro é a tela: os
esquemas ficam numa lista à esquerda e, ao selecionar um, ele expande nas suas variações.
Clicar numa variação reposiciona os 22 jogadores no campo.

A API fica em outro repositório: `exquematatico-api`.

![Editor do ExquemaTatico](docs/editor.png)

## Arquitetura

HTML, CSS e JavaScript puros, servidos como arquivos estáticos. Sem frameworks, sem
bibliotecas, sem build.

- `index.html` + `js/app.js`: a tela inteira. Lista de esquemas à esquerda, quadro ao centro,
  banco e edição do jogador selecionado à direita.
- `js/api.js`: todas as chamadas `fetch` à API, com a base URL numa constante.
- `styles.css`: tema escuro, campo verde, time da casa em vermelho e adversário em azul.
- `spike/spike.html`: prova de conceito inicial do campo responsivo com uma ficha, usada para
  validar a conversão de coordenadas antes do quadro.

### Variações

Todo esquema tem Padrão, Ofensivo e Defensivo, criadas pela API a partir da formação, mais as
personalizadas que o usuário adicionar em "+ Variação". Trocar de variação não recarrega nada
da API: a lista já vem completa no `GET /esquemas`.

As três fixas não podem ser excluídas. As personalizadas têm um × ao lado do nome.

### Quadro

Campo vertical na proporção 68 x 105 desenhado em CSS. As fichas são arrastáveis via Pointer
Events. Cada ficha é posicionada com `left: X%; top: Y%; transform: translate(-50%, -50%)`,
onde X e Y são a posição percentual do centro da ficha em relação ao campo. Ao arrastar, o
ponteiro é convertido com `(pointerX - campo.left) / campo.width * 100` (idem para Y) e
limitado a 0-100. Como tudo é percentual, o esquema mantém as posições proporcionais em
qualquer tamanho de tela.

### Elenco

Clicar numa ficha a seleciona e abre os campos de número e papel no painel. Dali o jogador
pode ir ao banco ou ser excluído de vez. O banco de cada time fica no painel; a seta coloca
o jogador de volta em campo, e "Adicionar jogador" cria um novo com o primeiro número livre.

O limite é de 11 em campo por time. É possível salvar com menos, para montar aos poucos.

O texto "Alterações não salvas" aparece ao arrastar uma ficha ou mexer no elenco, e some ao
salvar. Trocar de variação ou de esquema com alterações pendentes pede confirmação, e o mesmo
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
