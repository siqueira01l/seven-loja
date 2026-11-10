# SEVEN — Loja online

```
seven-loja/
├── app.py            backend Flask + SQLite (API, pedidos, admin)
├── requirements.txt
├── index.html        estrutura da página
├── produtos.html     listagem com filtros
├── produto.html      página de produto (?id=1)
├── sobre.html        página Sobre
├── conta.html        entrar / criar conta
├── admin.html        painel do administrador
├── carrinho.html     carrinho
├── checkout.html     dados de entrega, pagamento e confirmação
├── pedido.html       pedido recebido (?n=SV-XXXXXXXX)
├── css/              style.css · produtos.css · produto.css · sobre.css · conta.css · admin.css · carrinho.css · checkout.css
├── js/               main.js · auth.js · conta.js · admin.js · home.js · carrinho.js · checkout.js · pedido.js · produtos.js · produto.js · produtos-data.js (reserva sem servidor)
├── images/           fotos e logos (logo-seven.svg já incluída)
└── videos/           vídeos (vazia)
```

## Como colocar as imagens
Abra `css/style.css` e, no topo, troque `none` pelo caminho da foto, por exemplo:

    --img-hero1:url('../images/hero-1.jpg');

Variáveis: `--img-veludo`, `--img-hero1..3`, `--img-relogios`, `--img-bolsas`, `--img-oculos`, `--img-p1..4`, `--img-cta`.

## Marcas
Em `index.html`, na seção `#marcas`, troque cada `<span>MARCA 01</span>` por `<span><img src="images/marca-01.svg" alt="Marca" height="28"></span>`.

## Rodar com o backend
```
pip install -r requirements.txt
python app.py          # http://localhost:5000  (cria seven.db com os 12 produtos na 1ª vez)
```
Sem o servidor, as páginas ainda funcionam com os dados de `js/produtos-data.js`.

## API
| Rota | O que faz |
|---|---|
| `GET /api/produtos?cat=&marca=&q=` | lista produtos disponíveis (`&vendidos=1` lista só os vendidos) |
| `GET /api/produtos/<id ou slug>` | detalhe do produto |
| `GET /api/carrinho/itens?ids=1,2` | preço, foto e estoque atuais dos itens do carrinho |
| `POST /api/pedidos` | cria pedido: `{"cliente":{nome,email,telefone},"entrega":{cep,rua,numero,complemento,bairro,cidade,uf},"itens":[{"id":1,"qtd":1}]}` — recalcula preço e baixa o estoque |
| `POST /api/pedidos/<numero>/pagar` | gera um novo link de pagamento (pedido pendente) |
| `POST /api/pedidos/<numero>/sincronizar` | confere o pagamento no Mercado Pago |
| `POST /api/mp/webhook` | notificações do Mercado Pago (não usa o cabeçalho X-Requested-With) |
| `GET /api/pedidos/<numero>` | consulta o pedido (itens, total, status e forma de pagamento) |
| `POST /api/auth/registrar` · `/entrar` · `/sair` · `GET /api/me` | cadastro, login, logout e usuário atual |
| `GET/POST/PUT/DELETE /api/admin/produtos` | lista (inclusive removidos), cadastra, edita e remove produtos |
| `POST /api/admin/upload` | envia uma foto (JPG, PNG ou WEBP, até 8 MB) e devolve o caminho |
| `GET /api/admin/pedidos` · `PATCH /api/admin/pedidos/<numero>` | lista pedidos e muda o status |

## Login e administrador
- Clientes se cadastram e entram em `conta.html`.
- Na primeira execução o servidor cria a conta admin (`admin@seven.com.br`) e **mostra a senha no terminal**. Para escolher a sua: `python app.py criar-admin`. Também dá para definir `SEVEN_ADMIN_EMAIL` e `SEVEN_ADMIN_PASSWORD` antes de iniciar.
- O painel fica em `admin.html` (só abre para admin; o servidor confere a cada requisição). "Remover" marca o produto como vendido: ele sai da listagem geral e passa para o filtro "Vendidos" (nada é apagado; dá para devolver à vitrine).
- Toda requisição `POST/PUT/PATCH/DELETE` em `/api/` precisa do cabeçalho `X-Requested-With: seven` (o site já envia).
- Em produção: use HTTPS e defina `SEVEN_HTTPS=1` e `SEVEN_SECRET`. O limite de tentativas de login fica na memória do processo.
Fotos dos produtos: envie pelo painel admin (ficam em `images/produtos/`).

## Pagamento (Mercado Pago · Checkout Pro)
O cliente confirma o pedido, é levado à página segura do Mercado Pago (Pix, cartão ou boleto) e volta para `pedido.html`. O servidor sempre consulta o pagamento direto na API do Mercado Pago antes de marcar o pedido como pago.

1. Em mercadopago.com.br/developers crie uma aplicação e copie o **Access Token** (para testes, o de teste, que começa com `TEST-`).
2. Defina a variável antes de iniciar o servidor:
   - Windows (PowerShell): `$env:MP_ACCESS_TOKEN="TEST-..."`
   - Mac/Linux: `export MP_ACCESS_TOKEN="TEST-..."`
3. Rode `python app.py`. Sem a variável o site funciona, mas o pedido fica "pendente" e não há pagamento online.
4. **Webhook (recomendado):** o Mercado Pago só avisa endereços públicos com HTTPS. Em testes locais use `ngrok http 5000`, defina `SEVEN_BASE_URL=https://seu-endereco.ngrok-free.app` e, no painel do Mercado Pago (Webhooks), cadastre `https://seu-endereco.ngrok-free.app/api/mp/webhook` com o evento *Pagamentos*. Copie a chave secreta para `MP_WEBHOOK_SECRET` (o servidor passa a validar a assinatura).
5. Sem webhook, o pedido ainda é atualizado: a página `pedido.html` confere o pagamento ao abrir e a cada 8 segundos enquanto estiver pendente.
6. Para testar, use os cartões de teste da documentação do Mercado Pago (titular `APRO` aprova o pagamento).

Regras do estoque: ao criar o pedido o estoque fica reservado por 60 minutos. Se o pagamento nem começar nesse prazo, o pedido é cancelado e os itens voltam ao estoque. Pix e boleto gerados mantêm a reserva até o Mercado Pago informar o resultado.
