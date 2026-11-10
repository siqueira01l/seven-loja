(function () {
  // "Últimos lançamentos": foto, nome e preço vêm do backend (o que você edita no painel)
  var cards = [].slice.call(document.querySelectorAll('.prod'));
  if (!cards.length) return;
  var CAT = { relogios: 'Relógios', bolsas: 'Bolsas', oculos: 'Óculos', acessorios: 'Acessórios' };
  function fmt(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function url(u) { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } }
  fetch('/api/produtos').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
    var by = {}; d.produtos.forEach(function (p) { by[p.id] = p; });
    cards.forEach(function (c) {
      var a = c.querySelector('.plink'); if (!a) return;
      var p = by[+new URL(a.href).searchParams.get('id')];
      if (!p) { c.style.display = 'none'; return; }  // produto removido no painel
      var slot = c.querySelector('.slot'), ph = slot.querySelector('.ph'), add = c.querySelector('.add');
      if (p.img) { slot.style.setProperty('--i', "url('" + url(p.img) + "')"); if (ph) ph.remove(); }
      c.querySelector('.pinfo b').textContent = p.n;
      c.querySelector('.pinfo small').textContent = CAT[p.cat] || '';
      c.querySelector('.pr').textContent = fmt(p.preco);
      add.dataset.n = p.n; add.dataset.img = p.img || ''; add.dataset.p = fmt(p.preco);
    });
  }).catch(function () {});
})();
