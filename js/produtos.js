(function () {
  var P = [], ui = window.SevenUI || {};
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var CATS = ['relogios', 'bolsas', 'oculos', 'acessorios'];
  var FX = { all: [0, 1e12], low: [0, 5000], mid: [5000, 30000], high: [30000, 1e12] };
  var st = { cat: '', marcas: [], faixa: 'all', status: 'disp' }, fav = [];
  try { fav = JSON.parse(localStorage.getItem('seven-fav') || '[]'); } catch (e) {}

  // o navegador resolve url() de variáveis CSS a partir da pasta css/; por isso o caminho vai absoluto
  function url(u) { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } }
  function fmt(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function byId(id) { return P.filter(function (p) { return p.id === id; })[0]; }

  function start(list, sold) {
  var ativos = list, vendidos = sold || [];
  P = ativos;
  // marcas geradas a partir dos produtos da lista atual (disponíveis ou vendidos)
  function brands() {
    var marcas = [];
    P.forEach(function (p) { if (marcas.indexOf(p.marca) < 0) marcas.push(p.marca); });
    marcas.sort();
    $('#brands').innerHTML = marcas.map(function (m) {
      return '<label class="opt"><input type="checkbox" value="' + esc(m) + '"><span>' + esc(m) + '</span></label>';
    }).join('');
  }
  brands();

  // categoria vinda da home (produtos.html?cat=relogios)
  var q = new URLSearchParams(location.search).get('cat');
  if (CATS.indexOf(q) > -1) st.cat = q;

  function card(p, i) {
    return '<article class="pc rv' + (p.ativo === 0 ? ' sold' : '') + '" data-id="' + p.id + '" style="--d:' + (i % 6 * 0.06).toFixed(2) + 's">' +
      '<div class="pc-img"><div class="slot"' + (p.img ? ' style="--i:url(\'' + esc(url(p.img)) + '\')"' : '') + '><span class="ph">Foto do produto</span></div>' +
      '<button class="fav' + (fav.indexOf(p.id) > -1 ? ' on' : '') + '" aria-label="Favoritar ' + esc(p.n) + '"><svg class="ico"><use href="#i-bookmark"/></svg></button>' +
      (p.ativo === 0 ? '<em>Vendido</em>' : '<button class="addq">Adicionar ao carrinho</button>') + '</div>' +
      '<h3><a href="produto.html?id=' + p.id + '">' + esc(p.n) + '</a></h3><p class="pp">' + fmt(p.preco) + '</p></article>';
  }

  function render() {
    var f = FX[st.faixa];
    var list = P.filter(function (p) {
      return (!st.cat || p.cat === st.cat) &&
             (!st.marcas.length || st.marcas.indexOf(p.marca) > -1) &&
             p.preco >= f[0] && p.preco <= f[1];
    });
    var sv = st.status === 'vend';
    $('#count').textContent = list.length + (sv ? (list.length === 1 ? ' vendido' : ' vendidos') : (list.length === 1 ? ' produto' : ' produtos'));
    $('#clr').classList.toggle('on', !!(st.cat || st.marcas.length || st.faixa !== 'all' || sv));
    var g = $('#pg');
    g.innerHTML = list.length ? list.map(card).join('') :
      '<div class="none">' + (sv ? 'Nenhum produto vendido ainda' : 'Nenhum produto encontrado') + '<button class="btn" id="none-clr">Limpar filtros</button></div>';
    if (ui.hidePh) ui.hidePh(g);
    var cs = $$('#pg .rv');
    requestAnimationFrame(function () { requestAnimationFrame(function () { cs.forEach(function (c) { c.classList.add('in'); }); }); });
  }

  function sync() {
    $$('#cats button').forEach(function (b) {
      var on = b.dataset.cat === st.cat;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    render();
  }

  function reset() {
    st = { cat: '', marcas: [], faixa: 'all', status: 'disp' };
    P = ativos; brands();
    $('#prices input[value="all"]').checked = true;
    $('#status input[value="disp"]').checked = true;
    sync();
  }

  $('#cats').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    st.cat = st.cat === b.dataset.cat ? '' : b.dataset.cat;
    sync();
  });
  $('#brands').addEventListener('change', function () {
    st.marcas = $$('#brands input:checked').map(function (i) { return i.value; });
    render();
  });
  $('#status').addEventListener('change', function (e) {
    st.status = e.target.value; st.marcas = [];
    P = st.status === 'vend' ? vendidos : ativos;
    brands(); render();
  });
  $('#prices').addEventListener('change', function (e) { st.faixa = e.target.value; render(); });
  $('#clr').onclick = reset;
  $$('.acc > button').forEach(function (b) {
    b.onclick = function () {
      var a = b.parentNode, o = !a.classList.contains('open');
      a.classList.toggle('open', o);
      b.setAttribute('aria-expanded', o);
    };
  });

  $('#pg').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) { var c = e.target.closest('.pc'); if (c && !e.target.closest('a')) location.href = 'produto.html?id=' + c.dataset.id; return; }
    if (b.id === 'none-clr') { reset(); return; }
    var el = b.closest('.pc'); if (!el) return;
    var p = byId(+el.dataset.id); if (!p) return;
    if (b.classList.contains('fav')) {
      var i = fav.indexOf(p.id);
      if (i > -1) fav.splice(i, 1); else fav.push(p.id);
      b.classList.toggle('on', i < 0);
      try { localStorage.setItem('seven-fav', JSON.stringify(fav)); } catch (err) {}
      if (ui.say) ui.say(i < 0 ? 'Salvo nos favoritos' : 'Removido dos favoritos');
    } else if (b.classList.contains('addq') && window.SevenCart) {
      window.SevenCart.add(p.n, p.preco, p.id, p.img);
    }
  });

  sync();
  }

  Promise.all([fetch('/api/produtos'), fetch('/api/produtos?vendidos=1')])
    .then(function (rs) { if (!rs[0].ok || !rs[1].ok) throw 0; return Promise.all(rs.map(function (r) { return r.json(); })); })
    .then(function (d) { start(d[0].produtos, d[1].produtos); })
    .catch(function () { start(window.PRODUTOS || [], []); });
})();
