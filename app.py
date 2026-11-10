"""SEVEN — backend (Flask + SQLite).
Rodar:  pip install -r requirements.txt  &&  python app.py   ->  http://localhost:5000
Admin:  a conta é criada na 1ª execução (veja a senha no terminal) ou com:  python app.py criar-admin
"""
import hashlib, hmac, json, os, re, secrets, sqlite3, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from functools import wraps
from getpass import getpass
from flask import Flask, abort, g, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("SEVEN_DB", os.path.join(BASE, "seven.db"))
UPLOADS = os.path.join(BASE, "images", "produtos")
CATS = {"relogios", "bolsas", "oculos", "acessorios"}
STATUS = {"pendente", "pago", "enviado", "cancelado", "reembolsado"}
PAGAMENTOS = {"pix": "Pix", "cartao": "Cartão de crédito", "boleto": "Boleto bancário"}  # só para pedidos antigos
TIPOS = {"credit_card": "Cartão de crédito", "debit_card": "Cartão de débito", "ticket": "Boleto bancário",
         "bank_transfer": "Pix", "account_money": "Saldo Mercado Pago", "prepaid_card": "Cartão pré-pago"}
MP_TOKEN = os.environ.get("MP_ACCESS_TOKEN", "").strip()  # sem ele, o pedido fica pendente e o pagamento online fica desligado
RESERVA = "+60 minutes"  # quanto tempo o estoque fica reservado esperando o pagamento começar
UFS = set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split())
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
IMG = re.compile(r"^images/produtos/[A-Za-z0-9_-][A-Za-z0-9_.-]*$")

def _secret():
    if os.environ.get("SEVEN_SECRET"):
        return os.environ["SEVEN_SECRET"]
    f = os.path.join(BASE, ".secret_key")
    if not os.path.exists(f):
        with open(f, "w") as fh:
            fh.write(secrets.token_hex(32))
    return open(f).read().strip()

app = Flask(__name__, static_folder=None)
app.config.update(SECRET_KEY=_secret(), SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_HTTPONLY=True,
                  SESSION_COOKIE_SECURE=os.environ.get("SEVEN_HTTPS") == "1",  # use SEVEN_HTTPS=1 em produção (HTTPS)
                  PERMANENT_SESSION_LIFETIME=timedelta(days=14), MAX_CONTENT_LENGTH=8 * 1024 * 1024)
DUMMY = generate_password_hash("seven-dummy")  # gasta o mesmo tempo quando o e-mail não existe
FALHAS = {}  # (ip, e-mail) -> horários das falhas recentes (em memória, por processo)

SCHEMA = """
CREATE TABLE IF NOT EXISTS produtos(
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, nome TEXT NOT NULL, marca TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL, preco_centavos INTEGER NOT NULL, descricao TEXT NOT NULL DEFAULT '',
  specs TEXT NOT NULL DEFAULT '{}', garantia TEXT NOT NULL DEFAULT '', imagens TEXT NOT NULL DEFAULT '[]',
  estoque INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, email TEXT UNIQUE NOT NULL, senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'cliente', criado_em TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pedidos(
  id INTEGER PRIMARY KEY, user_id INTEGER, pagamento TEXT, expira_em TEXT, mp_payment TEXT, numero TEXT UNIQUE NOT NULL, nome TEXT, email TEXT, telefone TEXT, endereco TEXT,
  total_centavos INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pendente', criado_em TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pedido_itens(
  id INTEGER PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id), produto_id INTEGER,
  nome TEXT NOT NULL, preco_centavos INTEGER NOT NULL, qtd INTEGER NOT NULL);
"""
G = {"relogios": "2 anos contra defeitos de fabricação.", "bolsas": "1 ano contra defeitos de fabricação.",
     "oculos": "1 ano contra defeitos de fabricação.", "acessorios": "1 ano contra defeitos de fabricação."}
# (id, nome, marca, categoria, preço em reais, descrição, especificações, estoque) — textos de exemplo, edite à vontade
SEED = [
 (1, "Rolex Datejust 41", "Rolex", "relogios", 79900, "Elegância atemporal, precisão incomparável. O Datejust 41 é um ícone da alta relojoaria.", {"Caixa": "Aço, 41 mm", "Movimento": "Automático", "Vidro": "Safira"}, 3),
 (2, "Cartier Santos", "Cartier", "relogios", 62900, "Linhas quadradas e parafusos aparentes: o relógio de aviação que virou referência de design.", {"Caixa": "Aço, formato quadrado", "Movimento": "Automático", "Vidro": "Safira"}, 2),
 (3, "Louis Vuitton Keepall", "Louis Vuitton", "bolsas", 14900, "A bolsa de viagem em lona Monogram, leve e espaçosa, para qualquer destino.", {"Material": "Lona Monogram", "Alças": "Couro"}, 5),
 (4, "Ray-Ban Wayfarer", "Ray-Ban", "oculos", 1299, "O formato clássico, em acetato, com lentes que protegem contra raios UV.", {"Armação": "Acetato", "Lentes": "Proteção UV400"}, 12),
 (5, "Omega Seamaster", "Omega", "relogios", 38500, "Relógio de mergulho com herança náutica e acabamento refinado para o dia a dia.", {"Caixa": "Aço", "Movimento": "Automático", "Resistência à água": "300 m"}, 4),
 (6, "Chanel Classic Flap", "Chanel", "bolsas", 52800, "Matelassê, corrente entrelaçada e fecho CC: a bolsa mais reconhecível da maison.", {"Material": "Couro matelassê", "Alça": "Corrente com couro"}, 1),
 (7, "Gucci GG Aviador", "Gucci", "oculos", 3450, "Aviador com ponte dupla e detalhes GG nas hastes, em metal leve.", {"Armação": "Metal", "Lentes": "Proteção UV400"}, 8),
 (8, "Cinto Reversível H", "Hermès", "acessorios", 6200, "Cinto reversível em couro, com fivela H: preto de um lado, marrom do outro.", {"Material": "Couro", "Fivela": "Metal"}, 6),
 (9, "Carteira Monogram", "Louis Vuitton", "acessorios", 3900, "Carteira compacta em lona Monogram, com divisórias para cartões e notas.", {"Material": "Lona Monogram"}, 9),
 (10, "Prada Linea Rossa", "Prada", "oculos", 2150, "Esportivo e leve, com a faixa vermelha que marca a linha.", {"Armação": "Náilon", "Lentes": "Proteção UV400"}, 7),
 (11, "Tudor Black Bay", "Tudor", "relogios", 29800, "Mostrador preto e estética vintage, inspirado nos relógios de mergulho dos anos 50.", {"Caixa": "Aço", "Movimento": "Automático", "Vidro": "Safira"}, 3),
 (12, "Prada Re-Nylon Tote", "Prada", "bolsas", 12400, "Tote em Re-Nylon, náilon regenerado, com triângulo esmaltado e espaço para o dia todo.", {"Material": "Re-Nylon"}, 4),
 (13, "Relógio Aço Negro", "SEVEN", "relogios", 18900, "Caixa e pulseira em aço com acabamento negro fosco, discreto e imponente.", {"Caixa": "Aço negro", "Movimento": "Automático"}, 5),
 (14, "Bolsa Matelassê", "SEVEN", "bolsas", 9400, "Couro com costura matelassê e fecho magnético, para o dia e para a noite.", {"Material": "Couro matelassê", "Fecho": "Magnético"}, 4),
 (15, "Óculos Aviador Noir", "SEVEN", "oculos", 2350, "Aviador de metal em acabamento preto, com lentes escuras e proteção UV.", {"Armação": "Metal preto", "Lentes": "Proteção UV400"}, 10),
 (16, "Cronógrafo Prata", "SEVEN", "relogios", 24500, "Cronógrafo em aço escovado, com mostrador prata e subesferas de leitura clara.", {"Caixa": "Aço escovado", "Movimento": "Automático"}, 3),
]

def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def _close(_):
    c = g.pop("db", None)
    if c: c.close()

def init_db():
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA)
    cols = [r[1] for r in con.execute("PRAGMA table_info(pedidos)")]
    for col in ("user_id INTEGER", "pagamento TEXT", "expira_em TEXT", "mp_payment TEXT"):  # bancos criados antes dessas colunas
        if col.split()[0] not in cols:
            con.execute("ALTER TABLE pedidos ADD COLUMN " + col)
    if not con.execute("SELECT 1 FROM users WHERE papel='admin'").fetchone():
        email = os.environ.get("SEVEN_ADMIN_EMAIL", "admin@seven.com.br").strip().lower()
        senha = os.environ.get("SEVEN_ADMIN_PASSWORD") or secrets.token_urlsafe(9)
        _upsert_admin(con, email, senha)
        if not os.environ.get("SEVEN_ADMIN_PASSWORD"):
            print(f"\n  Conta admin criada: {email}\n  Senha: {senha}\n  (anote agora; para escolher a sua: python app.py criar-admin)\n")
    for i, n, m, c, p, d, s, e in SEED:  # só insere o que ainda não existe
            con.execute("INSERT OR IGNORE INTO produtos(id,slug,nome,marca,categoria,preco_centavos,descricao,specs,garantia,estoque) VALUES(?,?,?,?,?,?,?,?,?,?)",
                        (i, slugify(n), n, m, c, p * 100, d, json.dumps(s, ensure_ascii=False), G[c], e))
    con.commit(); con.close()

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def erro(msg, code=400):
    return jsonify(erro=msg), code

def produto_json(r):
    imgs = json.loads(r["imagens"])
    return {"id": r["id"], "slug": r["slug"], "n": r["nome"], "marca": r["marca"], "cat": r["categoria"],
            "preco": r["preco_centavos"] / 100, "img": imgs[0] if imgs else "", "imagens": imgs,
            "descricao": r["descricao"], "specs": json.loads(r["specs"]), "garantia": r["garantia"], "estoque": r["estoque"], "ativo": r["ativo"]}

# ---------- vitrine ----------
@app.get("/api/produtos")
def listar():
    liberar_expirados()
    sql, args = "SELECT * FROM produtos WHERE ativo=" + ("0" if request.args.get("vendidos") == "1" else "1"), []  # vendidos=1 -> só os vendidos
    for col, key in (("categoria", "cat"), ("marca", "marca")):
        if request.args.get(key):
            sql += f" AND {col}=?"; args.append(request.args[key])
    q = request.args.get("q", "").strip()
    if q:
        sql += " AND (nome LIKE ? OR marca LIKE ?)"; args += [f"%{q}%"] * 2
    return jsonify(produtos=[produto_json(r) for r in db().execute(sql + " ORDER BY id", args)])

@app.get("/api/produtos/<ref>")
def detalhe(ref):
    liberar_expirados()
    r = db().execute("SELECT * FROM produtos WHERE id=? OR slug=?", (ref, ref)).fetchone()
    return jsonify(produto_json(r)) if r else erro("Produto não encontrado.", 404)

def _endereco(e):
    g = lambda k, n=100: str(e.get(k, "")).strip()[:n]
    cep = re.sub(r"\D", "", str(e.get("cep", "")))
    rua, num, comp, bairro, cidade, uf = g("rua"), g("numero", 20), g("complemento"), g("bairro"), g("cidade"), g("uf", 2).upper()
    if len(cep) != 8 or not (rua and num and bairro and cidade) or uf not in UFS:
        raise ValueError("Confira o endereço de entrega: CEP, rua, número, bairro, cidade e UF.")
    return f"{rua}, {num}" + (f" - {comp}" if comp else "") + f", {bairro}, {cidade}/{uf}, CEP {cep[:5]}-{cep[5:]}"

# ---------- Mercado Pago (Checkout Pro) ----------
def _mp(metodo, caminho, corpo=None):
    req = urllib.request.Request("https://api.mercadopago.com" + caminho, method=metodo,
                                 data=json.dumps(corpo).encode() if corpo is not None else None,
                                 headers={"Authorization": "Bearer " + MP_TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Mercado Pago {e.code}: {e.read()[:300]!r}")
    except (urllib.error.URLError, TimeoutError) as e:
        raise RuntimeError(f"Mercado Pago indisponível: {e}")

def _cancelar(con, oid):
    """Cancela um pedido pendente e devolve os itens ao estoque (uma vez só)."""
    if con.execute("UPDATE pedidos SET status='cancelado' WHERE id=? AND status='pendente'", (oid,)).rowcount:
        for i in con.execute("SELECT produto_id,qtd FROM pedido_itens WHERE pedido_id=?", (oid,)).fetchall():
            con.execute("UPDATE produtos SET estoque=estoque+? WHERE id=?", (i["qtd"], i["produto_id"]))

def liberar_expirados():
    con = db()
    for r in con.execute("SELECT id FROM pedidos WHERE status='pendente' AND expira_em IS NOT NULL AND expira_em < datetime('now')").fetchall():
        _cancelar(con, r["id"])
    con.commit()

def _aplicar(pay):
    """Atualiza o pedido a partir de um pagamento já consultado direto no Mercado Pago."""
    con = db()
    p = con.execute("SELECT * FROM pedidos WHERE numero=?", (str(pay.get("external_reference", "")),)).fetchone()
    if not p:
        return None
    try:
        if round(float(pay.get("transaction_amount")) * 100) != p["total_centavos"]:
            return None  # valor diferente do pedido: ignora
    except (TypeError, ValueError):
        return None
    st, forma = pay.get("status"), TIPOS.get(pay.get("payment_type_id"), pay.get("payment_type_id") or "")
    if st == "approved":
        if p["status"] in ("pendente", "cancelado"):
            if p["status"] == "cancelado":  # a reserva já tinha sido liberada: baixa de novo, sem ficar negativo
                for i in con.execute("SELECT produto_id,qtd FROM pedido_itens WHERE pedido_id=?", (p["id"],)).fetchall():
                    con.execute("UPDATE produtos SET estoque=MAX(estoque-?,0) WHERE id=?", (i["qtd"], i["produto_id"]))
            con.execute("UPDATE pedidos SET status='pago', pagamento=?, mp_payment=?, expira_em=NULL WHERE id=?", (forma, str(pay.get("id")), p["id"]))
    elif st in ("pending", "in_process", "authorized"):
        if p["status"] == "pendente":  # Pix/boleto gerado: segura a reserva até o Mercado Pago dar o resultado
            con.execute("UPDATE pedidos SET pagamento=?, mp_payment=?, expira_em=NULL WHERE id=?", (forma, str(pay.get("id")), p["id"]))
    elif st == "cancelled":
        _cancelar(con, p["id"])
    elif st in ("refunded", "charged_back"):
        if p["status"] in ("pago", "enviado"):
            con.execute("UPDATE pedidos SET status='reembolsado' WHERE id=?", (p["id"],))
    con.commit()
    return p["numero"]

def _link_pagamento(oid):
    con = db()
    p = con.execute("SELECT * FROM pedidos WHERE id=?", (oid,)).fetchone()
    its = con.execute("SELECT produto_id,nome,preco_centavos,qtd FROM pedido_itens WHERE pedido_id=?", (oid,)).fetchall()
    base = os.environ.get("SEVEN_BASE_URL", "").rstrip("/") or request.host_url.rstrip("/")
    volta = f"{base}/pedido.html?n={p['numero']}"
    fim = (datetime.now(timezone.utc) + timedelta(minutes=60)).strftime("%Y-%m-%dT%H:%M:%S.000+00:00")
    corpo = {"items": [{"id": str(i["produto_id"]), "title": i["nome"], "quantity": i["qtd"],
                        "unit_price": i["preco_centavos"] / 100, "currency_id": "BRL"} for i in its],
             "payer": {"name": p["nome"], "email": p["email"]}, "external_reference": p["numero"],
             "back_urls": {"success": volta, "pending": volta, "failure": volta}, "statement_descriptor": "SEVEN",
             "expires": True, "expiration_date_to": fim}
    if base.startswith("https://"):  # o Mercado Pago só aceita isto com endereço público
        corpo["auto_return"] = "approved"
        corpo["notification_url"] = base + "/api/mp/webhook"
    r = _mp("POST", "/checkout/preferences", corpo)
    url = (r.get("sandbox_init_point") if MP_TOKEN.startswith("TEST-") else None) or r.get("init_point")
    if not url:
        raise RuntimeError("Mercado Pago não devolveu o link de pagamento.")
    return url

def _assinatura_ok():
    seg = os.environ.get("MP_WEBHOOK_SECRET", "")
    if not seg:
        return True
    partes = dict(x.strip().split("=", 1) for x in request.headers.get("x-signature", "").split(",") if "=" in x)
    did = request.args.get("data.id") or str((request.get_json(silent=True) or {}).get("data", {}).get("id", ""))
    manifesto = f"id:{did.lower()};request-id:{request.headers.get('x-request-id', '')};ts:{partes.get('ts', '')};"
    esperado = hmac.new(seg.encode(), manifesto.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, partes.get("v1", ""))

@app.post("/api/mp/webhook")
def mp_webhook():
    if not MP_TOKEN:
        return erro("Pagamento não configurado.", 503)
    if not _assinatura_ok():
        return erro("Assinatura inválida.", 401)
    j = request.get_json(silent=True) or {}
    tipo = j.get("type") or request.args.get("type") or request.args.get("topic")
    pid = str(request.args.get("data.id") or (j.get("data") or {}).get("id") or request.args.get("id") or "")
    if tipo != "payment" or not pid.isdigit():
        return jsonify(ok=True)  # outros eventos: ignora
    try:
        _aplicar(_mp("GET", "/v1/payments/" + pid))  # nunca confia no corpo da notificação: consulta o pagamento
    except RuntimeError as x:
        app.logger.error("%s", x)
        return erro("Falha ao consultar o Mercado Pago.", 502)  # o Mercado Pago tenta de novo
    return jsonify(ok=True)

def _pedido(numero):
    return db().execute("SELECT * FROM pedidos WHERE numero=?", (numero,)).fetchone()

@app.post("/api/pedidos/<numero>/pagar")
def pagar(numero):
    liberar_expirados()
    p = _pedido(numero)
    if not p:
        return erro("Pedido não encontrado.", 404)
    if not MP_TOKEN:
        return erro("O pagamento online ainda não está configurado.", 503)
    if p["status"] != "pendente":
        return erro("Este pedido não está aguardando pagamento.", 409)
    try:
        url = _link_pagamento(p["id"])
    except RuntimeError as x:
        app.logger.error("%s", x)
        return erro("Não foi possível abrir o pagamento agora. Tente novamente.", 502)
    db().execute("UPDATE pedidos SET expira_em=datetime('now','" + RESERVA + "') WHERE id=? AND status='pendente' AND expira_em IS NOT NULL", (p["id"],))
    db().commit()
    return jsonify(pagar_url=url)

@app.post("/api/pedidos/<numero>/sincronizar")
def sincronizar(numero):  # confere no Mercado Pago (útil ao voltar do pagamento ou se o webhook atrasar)
    liberar_expirados()
    p = _pedido(numero)
    if not p:
        return erro("Pedido não encontrado.", 404)
    if MP_TOKEN and p["status"] in ("pendente", "cancelado"):
        try:
            r = _mp("GET", "/v1/payments/search?sort=date_created&criteria=asc&external_reference=" + urllib.parse.quote(numero))
            for pay in r.get("results", []):
                _aplicar(pay)
        except RuntimeError as x:
            app.logger.error("%s", x)
    return jsonify(status=_pedido(numero)["status"])

# ---------- carrinho: dados atuais (preço, foto, estoque) dos itens, inclusive vendidos ----------
@app.get("/api/carrinho/itens")
def carrinho_itens():
    liberar_expirados()
    ids = [int(x) for x in request.args.get("ids", "").split(",") if x.strip().isdigit()][:50]
    if not ids:
        return jsonify(produtos=[])
    marcas = ",".join("?" * len(ids))
    return jsonify(produtos=[produto_json(r) for r in db().execute(f"SELECT * FROM produtos WHERE id IN ({marcas})", ids)])

# ---------- pedidos (o servidor recalcula preço e confere estoque; nunca confia no navegador) ----------
@app.post("/api/pedidos")
def criar_pedido():
    liberar_expirados()
    d = request.get_json(silent=True) or {}
    c, ent = d.get("cliente") or {}, d.get("entrega") or {}
    nome, email, tel = (str(c.get(k, "")).strip()[:300] for k in ("nome", "email", "telefone"))
    if not nome or not EMAIL.match(email):
        return erro("Informe seu nome e um e-mail válido.")
    try:
        end = _endereco(ent)
    except ValueError as x:
        return erro(str(x))
    itens = {}
    for it in d.get("itens") or []:
        try:
            pid, q = int(it["id"]), int(it["qtd"])
        except (KeyError, TypeError, ValueError):
            return erro("Item inválido.")
        if not 1 <= q <= 10:
            return erro("Quantidade inválida.")
        itens[pid] = itens.get(pid, 0) + q
    if not itens:
        return erro("A sacola está vazia.")
    con, total, linhas = db(), 0, []
    try:
        for pid, q in itens.items():
            p = con.execute("SELECT * FROM produtos WHERE id=? AND ativo=1", (pid,)).fetchone()
            if not p:
                raise ValueError("Um dos produtos não está mais disponível.")
            if con.execute("UPDATE produtos SET estoque=estoque-? WHERE id=? AND estoque>=?", (q, pid, q)).rowcount == 0:
                raise ValueError(f"Estoque insuficiente: {p['nome']}.")
            total += p["preco_centavos"] * q
            linhas.append((pid, p["nome"], p["preco_centavos"], q))
        numero = "SV-" + secrets.token_hex(4).upper()
        oid = con.execute("INSERT INTO pedidos(user_id,numero,nome,email,telefone,endereco,total_centavos,expira_em) VALUES(?,?,?,?,?,?,?,datetime('now','" + RESERVA + "'))",
                          (session.get("uid"), numero, nome, email, tel, end, total)).lastrowid
        con.executemany("INSERT INTO pedido_itens(pedido_id,produto_id,nome,preco_centavos,qtd) VALUES(?,?,?,?,?)",
                        [(oid, *l) for l in linhas])
        con.commit()
    except ValueError as e:
        con.rollback()
        return erro(str(e), 409)
    url = None
    if MP_TOKEN:
        try:
            url = _link_pagamento(oid)
        except RuntimeError as x:  # o pedido já existe; a pessoa pode tentar de novo em "Pagar agora"
            app.logger.error("%s", x)
    return jsonify(numero=numero, total=total / 100, status="pendente", pagar_url=url), 201

@app.get("/api/pedidos/<numero>")
def ver_pedido(numero):
    liberar_expirados()
    p = db().execute("SELECT * FROM pedidos WHERE numero=?", (numero,)).fetchone()
    if not p:
        return erro("Pedido não encontrado.", 404)
    its = db().execute("SELECT i.nome,i.preco_centavos,i.qtd,pr.imagens FROM pedido_itens i LEFT JOIN produtos pr ON pr.id=i.produto_id WHERE i.pedido_id=?", (p["id"],)).fetchall()
    return jsonify(numero=p["numero"], status=p["status"], total=p["total_centavos"] / 100, pagamento=PAGAMENTOS.get(p["pagamento"], p["pagamento"] or ""),
                   pagamento_ativo=bool(MP_TOKEN), pagar=bool(MP_TOKEN) and p["status"] == "pendente",
                   itens=[{"n": i["nome"], "preco": i["preco_centavos"] / 100, "qtd": i["qtd"],
                           "img": (json.loads(i["imagens"] or "[]") or [""])[0]} for i in its])

# ---------- contas e login ----------
@app.before_request
def _csrf():  # navegadores de outros sites não conseguem enviar este cabeçalho
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.path.startswith("/api/") \
            and request.path != "/api/mp/webhook" and request.headers.get("X-Requested-With") != "seven":  # o webhook vem do Mercado Pago
        return erro("Requisição não permitida.", 403)

@app.after_request
def _headers(r):
    r.headers["X-Content-Type-Options"] = "nosniff"
    if request.path.startswith("/api/"):
        r.headers["Cache-Control"] = "no-store"
    return r

@app.errorhandler(413)
def _grande(_):
    return erro("Arquivo grande demais (máximo 8 MB).", 413)

def usuario():
    uid = session.get("uid")
    r = db().execute("SELECT id,nome,email,papel FROM users WHERE id=?", (uid,)).fetchone() if uid else None
    return dict(r) if r else None

def _entrar(uid):
    session.clear()  # evita fixação de sessão
    session["uid"] = uid
    session.permanent = True

def _upsert_admin(con, email, senha, nome="Administrador"):
    h = generate_password_hash(senha)
    if con.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
        con.execute("UPDATE users SET senha_hash=?, papel='admin' WHERE email=?", (h, email))
    else:
        con.execute("INSERT INTO users(nome,email,senha_hash,papel) VALUES(?,?,?,'admin')", (nome, email, h))
    con.commit()

@app.get("/api/me")
def me():
    return jsonify(usuario=usuario())

@app.post("/api/auth/registrar")
def registrar():
    d = request.get_json(silent=True) or {}
    nome, email, senha = str(d.get("nome", "")).strip(), str(d.get("email", "")).strip().lower(), str(d.get("senha", ""))
    if not nome or len(nome) > 80:
        return erro("Informe seu nome.")
    if not EMAIL.match(email) or len(email) > 254:
        return erro("Informe um e-mail válido.")
    if not 8 <= len(senha) <= 200:
        return erro("A senha deve ter pelo menos 8 caracteres.")
    try:
        uid = db().execute("INSERT INTO users(nome,email,senha_hash) VALUES(?,?,?)", (nome, email, generate_password_hash(senha))).lastrowid
        db().commit()
    except sqlite3.IntegrityError:
        return erro("Este e-mail já está cadastrado.", 409)
    _entrar(uid)
    return jsonify(usuario=usuario()), 201

@app.post("/api/auth/entrar")
def entrar():
    d = request.get_json(silent=True) or {}
    email, senha = str(d.get("email", "")).strip().lower(), str(d.get("senha", ""))
    k, agora = (request.remote_addr, email), time.time()
    FALHAS[k] = [t for t in FALHAS.get(k, []) if agora - t < 600]
    if len(FALHAS[k]) >= 5:
        return erro("Muitas tentativas. Aguarde alguns minutos.", 429)
    r = db().execute("SELECT id,senha_hash FROM users WHERE email=?", (email,)).fetchone()
    if not check_password_hash(r["senha_hash"] if r else DUMMY, senha) or not r:
        FALHAS[k].append(agora)
        return erro("E-mail ou senha incorretos.", 401)
    FALHAS.pop(k, None)
    _entrar(r["id"])
    return jsonify(usuario=usuario())

@app.post("/api/auth/sair")
def sair():
    session.clear()
    return jsonify(ok=True)

# ---------- admin (exige conta com papel "admin") ----------
def admin(f):
    @wraps(f)
    def w(*a, **k):
        u = usuario()
        if not u:
            return erro("Faça login para continuar.", 401)
        if u["papel"] != "admin":
            return erro("Acesso restrito a administradores.", 403)
        return f(*a, **k)
    return w

@app.get("/api/admin/produtos")
@admin
def admin_listar():  # inclui os removidos, para poder restaurar
    return jsonify(produtos=[produto_json(r) for r in db().execute("SELECT * FROM produtos ORDER BY id")])

@app.post("/api/admin/upload")
@admin
def admin_upload():
    f = request.files.get("foto")
    if not f:
        return erro("Envie o arquivo no campo 'foto'.")
    head = f.stream.read(12); f.stream.seek(0)
    ext = ("jpg" if head[:3] == b"\xff\xd8\xff" else "png" if head[:8] == b"\x89PNG\r\n\x1a\n"
           else "webp" if head[:4] == b"RIFF" and head[8:12] == b"WEBP" else None)
    if not ext:  # confere o conteúdo real do arquivo, não só o nome
        return erro("Use imagens JPG, PNG ou WEBP.")
    os.makedirs(UPLOADS, exist_ok=True)
    nome = secrets.token_hex(8) + "." + ext
    f.save(os.path.join(UPLOADS, nome))
    return jsonify(caminho="images/produtos/" + nome), 201

def salvar(pid, d):
    con = db()
    row = con.execute("SELECT * FROM produtos WHERE id=?", (pid,)).fetchone() if pid else None
    v = ({"nome": row["nome"], "marca": row["marca"], "categoria": row["categoria"], "preco": row["preco_centavos"] / 100,
          "descricao": row["descricao"], "specs": json.loads(row["specs"]), "garantia": row["garantia"],
          "imagens": json.loads(row["imagens"]), "estoque": row["estoque"], "ativo": row["ativo"]} if row else
         {"nome": "", "marca": "", "categoria": "", "preco": 0, "descricao": "", "specs": {}, "garantia": "", "imagens": [], "estoque": 0, "ativo": 1})
    v.update({k: d[k] for k in v if k in d})
    if not str(v["nome"]).strip() or v["categoria"] not in CATS:
        raise ValueError("Nome e categoria válida (relogios, bolsas, oculos, acessorios) são obrigatórios.")
    if not isinstance(v["specs"], dict) or not isinstance(v["imagens"], list) or not all(isinstance(i, str) and IMG.match(i) for i in v["imagens"]):
        raise ValueError("Especificações ou fotos em formato inválido.")
    v["specs"] = {str(k)[:60]: str(x)[:200] for k, x in v["specs"].items()}
    v["nome"], v["marca"], v["descricao"], v["garantia"] = str(v["nome"])[:120], str(v["marca"])[:60], str(v["descricao"])[:2000], str(v["garantia"])[:200]
    try:
        cents, est = round(float(v["preco"]) * 100), int(v["estoque"])
    except (TypeError, ValueError):
        raise ValueError("Preço ou estoque inválido.")
    if cents < 0 or est < 0:
        raise ValueError("Preço e estoque não podem ser negativos.")
    vals = (v["nome"].strip(), v["marca"], v["categoria"], cents, v["descricao"],
            json.dumps(v["specs"], ensure_ascii=False), v["garantia"] or G[v["categoria"]], json.dumps(v["imagens"]), est, 1 if v["ativo"] else 0)
    if row:
        con.execute("UPDATE produtos SET nome=?,marca=?,categoria=?,preco_centavos=?,descricao=?,specs=?,garantia=?,imagens=?,estoque=?,ativo=? WHERE id=?", vals + (pid,))
    else:
        slug = slugify(v["nome"])
        if con.execute("SELECT 1 FROM produtos WHERE slug=?", (slug,)).fetchone():
            slug += "-" + secrets.token_hex(2)
        pid = con.execute("INSERT INTO produtos(nome,marca,categoria,preco_centavos,descricao,specs,garantia,imagens,estoque,ativo,slug) VALUES(?,?,?,?,?,?,?,?,?,?,?)", vals + (slug,)).lastrowid
    con.commit()
    return produto_json(con.execute("SELECT * FROM produtos WHERE id=?", (pid,)).fetchone())

@app.post("/api/admin/produtos")
@admin
def admin_criar():
    try:
        return jsonify(salvar(None, request.get_json(silent=True) or {})), 201
    except ValueError as e:
        return erro(str(e))

@app.put("/api/admin/produtos/<int:pid>")
@admin
def admin_editar(pid):
    if not db().execute("SELECT 1 FROM produtos WHERE id=?", (pid,)).fetchone():
        return erro("Produto não encontrado.", 404)
    try:
        return jsonify(salvar(pid, request.get_json(silent=True) or {}))
    except ValueError as e:
        return erro(str(e))

@app.delete("/api/admin/produtos/<int:pid>")
@admin
def admin_remover(pid):  # marca como vendido: sai da listagem geral e vai para o filtro "Vendidos"; pedidos antigos ficam intactos
    db().execute("UPDATE produtos SET ativo=0 WHERE id=?", (pid,)); db().commit()
    return "", 204

@app.get("/api/admin/pedidos")
@admin
def admin_pedidos():
    out = []
    for p in db().execute("SELECT * FROM pedidos ORDER BY id DESC"):
        its = db().execute("SELECT nome,qtd FROM pedido_itens WHERE pedido_id=?", (p["id"],)).fetchall()
        out.append({"numero": p["numero"], "status": p["status"], "total": p["total_centavos"] / 100, "criado_em": p["criado_em"], "pagamento": PAGAMENTOS.get(p["pagamento"], p["pagamento"] or ""),
                    "cliente": {"nome": p["nome"], "email": p["email"], "telefone": p["telefone"], "endereco": p["endereco"]},
                    "itens": [{"n": i["nome"], "qtd": i["qtd"]} for i in its]})
    return jsonify(pedidos=out)

@app.patch("/api/admin/pedidos/<numero>")
@admin
def admin_status(numero):
    s = (request.get_json(silent=True) or {}).get("status")
    if s not in STATUS:
        return erro("Status deve ser: " + ", ".join(sorted(STATUS)))
    if s == "cancelado":  # devolve a reserva ao estoque (só se o pedido ainda estava pendente)
        r = db().execute("SELECT id FROM pedidos WHERE numero=?", (numero,)).fetchone()
        if r:
            _cancelar(db(), r["id"])
    n = db().execute("UPDATE pedidos SET status=? WHERE numero=?", (s, numero)).rowcount; db().commit()
    return jsonify(numero=numero, status=s) if n else erro("Pedido não encontrado.", 404)

# ---------- site estático ----------
@app.get("/")
def home():
    return send_from_directory(BASE, "index.html")

@app.get("/<path:p>")
def arquivos(p):
    if p in ("index.html", "produtos.html", "produto.html", "sobre.html", "conta.html", "admin.html", "carrinho.html", "checkout.html", "pedido.html") or p.split("/")[0] in ("css", "js", "images", "videos"):
        return send_from_directory(BASE, p)
    abort(404)

init_db()
if __name__ == "__main__":
    if sys.argv[1:2] == ["criar-admin"]:
        email = input("E-mail do admin: ").strip().lower()
        senha = getpass("Senha (mínimo 8 caracteres): ")
        if not EMAIL.match(email) or len(senha) < 8:
            sys.exit("E-mail inválido ou senha curta demais.")
        con = sqlite3.connect(DB); _upsert_admin(con, email, senha); con.close()
        sys.exit("Pronto: " + email + " agora é administrador.")
    app.run(debug=True)
