(function () {
  var ui = window.SevenUI || {}, root = document.getElementById('pd');
  var id = new URLSearchParams(location.search).get('id') || '';
  var CAT = { relogios: 'Relógios', bolsas: 'Bolsas', oculos: 'Óculos', acessorios: 'Acessórios' };
  // o navegador resolve url() de variáveis CSS a partir da pasta css/; por isso o caminho vai absoluto
  function url(u) { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } }
  function fmt(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function bg(u) { return u ? ' style="--i:url(\'' + esc(url(u)) + '\')"' : ''; }
  function acc(t, body) { return '<div class="acc"><button aria-expanded="false">' + t + ' <span class="pm"></span></button><div class="acc-b"><div><div class="acc-in">' + body + '</div></div></div></div>'; }

  function find() {
    return fetch('/api/produtos/' + encodeURIComponent(id))
      .then(function (r) { if (r.status === 404) return null; if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return (window.PRODUTOS || []).filter(function (p) { return String(p.id) === id; })[0] || null; });
  }

  function view(p) {
    document.title = p.n + ' — SEVEN';
    var imgs = p.imagens && p.imagens.length ? p.imagens : (p.img ? [p.img] : []);
    var th = '', n = Math.max(3, imgs.length), i;
    for (i = 0; i < n; i++) th += '<button class="th' + (i ? '' : ' on') + '" data-i="' + i + '" aria-label="Foto ' + (i + 1) + '"><div class="slot"' + bg(imgs[i]) + '><span class="ph"></span></div></button>';
    var sold = p.ativo === 0, out = sold || p.estoque === 0, low = p.estoque > 0 && p.estoque <= 3;
    var specs = { Marca: p.marca }, k;
    for (k in (p.specs || {})) specs[k] = p.specs[k];
    var dl = '<dl class="spec">' + Object.keys(specs).map(function (k) { return '<dt>' + esc(k) + '</dt><dd>' + esc(specs[k]) + '</dd>'; }).join('') + '</dl>';
    root.innerHTML =
      '<div class="thumbs">' + th + '</div>' +
      '<div class="pmain"><div class="slot" id="mimg"' + bg(imgs[0]) + '><span class="ph">Foto do produto</span></div></div>' +
      '<div class="pi"><p class="pcat">' + esc(CAT[p.cat] || '') + '</p><h1>' + esc(p.n) + '</h1><p class="pprice">' + fmt(p.preco) + '</p>' +
      (p.descricao ? '<p class="pdesc">' + esc(p.descricao) + '</p>' : '') + '<span class="prule"></span>' +
      (out ? '<p class="stock">' + (sold ? 'Vendido' : 'Produto esgotado') + '</p>' : low ? '<p class="stock">Últimas ' + p.estoque + (p.estoque === 1 ? ' unidade' : ' unidades') + '</p>' : '') +
      '<div class="buy"><button class="btn" id="add"' + (out ? ' disabled' : '') + '>Adicionar ao carrinho</button><button class="btn" id="now"' + (out ? ' disabled' : '') + '>Comprar agora</button></div>' +
      '<div class="accs">' + acc('Descrição', '<p>Peça autêntica, enviada com nota fiscal e certificado de autenticidade, em embalagem protegida.</p>') +
      acc('Especificações', dl) + acc('Garantia', '<p>' + esc(p.garantia || 'Garantia de autenticidade SEVEN.') + '</p>') + '</div></div>';
    if (ui.hidePh) ui.hidePh(root);

    root.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('th')) {
        var u = imgs[+b.dataset.i];
        [].forEach.call(root.querySelectorAll('.th'), function (t) { t.classList.toggle('on', t === b); });
        if (u) document.getElementById('mimg').style.setProperty('--i', "url('" + url(u) + "')");
      } else if (b.id === 'add' || b.id === 'now') {
        if (window.SevenCart) window.SevenCart.add(p.n, p.preco, p.id, imgs[0]);
        if (b.id === 'now' && ui.openBag) ui.openBag();
      } else if (b.parentNode.classList.contains('acc')) {
        var a = b.parentNode, o = !a.classList.contains('open');
        a.classList.toggle('open', o); b.setAttribute('aria-expanded', o);
      }
    };
  }

  find().then(function (p) {
    if (p) return view(p);
    document.title = 'Produto não encontrado — SEVEN';
    root.innerHTML = '<div class="nf">Produto não encontrado<a class="btn" href="produtos.html">Ver produtos</a></div>';
  });
})();
