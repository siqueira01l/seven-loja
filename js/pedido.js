(function () {
  var A = window.SevenAPI, C = window.SevenCart, root = document.getElementById('ped');
  var q = new URLSearchParams(location.search), n = q.get('n') || '', enc = encodeURIComponent(n);
  var ST = { pendente: 'Aguardando pagamento', pago: 'Pago', enviado: 'Enviado', cancelado: 'Cancelado', reembolsado: 'Reembolsado' };
  var HD = { pendente: 'Pedido recebido', pago: 'Pagamento confirmado', enviado: 'Pedido enviado', cancelado: 'Pedido cancelado', reembolsado: 'Pedido reembolsado' };
  var TX = {
    pendente: 'Assim que o pagamento for confirmado, o status muda para Pago. Se você acabou de pagar, a confirmação pode levar alguns instantes.',
    pago: 'Pagamento confirmado. Obrigado pela compra!',
    enviado: 'Seu pedido foi enviado.',
    cancelado: 'Este pedido foi cancelado e os itens voltaram ao estoque.',
    reembolsado: 'O valor deste pedido foi devolvido.'
  };
  var cur = null, tries = 0;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function view(o) {
    var extra = '';
    if (o.status === 'pendente') {
      if (q.get('status') === 'failure') extra += '<p class="cmsg">O pagamento não foi concluído. Você pode tentar novamente.</p>';
      if (!o.pagamento_ativo) extra += '<p class="kn">O pagamento online ainda não está configurado nesta loja.</p>';
    }
    root.innerHTML = '<div class="cph"><h1>' + esc(HD[o.status] || 'Pedido') + '</h1></div><p class="onum">' + esc(o.numero) + '</p><span class="chip">' + esc(ST[o.status] || o.status) + '</span>' + extra +
      '<ul class="ol">' + o.itens.map(function (i) {
        return '<li><span class="cimg">' + (i.img ? '<img src="' + esc(i.img) + '" alt="">' : '') + '</span><span>' + esc(i.n) + '<small>Quantidade ' + i.qtd + '</small></span><span>' + C.money(i.preco * i.qtd) + '</span></li>';
      }).join('') + '</ul>' +
      (o.pagamento ? '<div class="ot"><span>Pagamento</span><span>' + esc(o.pagamento) + '</span></div>' : '') +
      '<div class="ot"><span>Total</span><strong>' + C.money(o.total) + '</strong></div>' +
      '<p class="dtx">' + esc(TX[o.status] || '') + '</p><p class="cmsg" id="pmsg" role="alert"></p>' +
      '<div class="pact">' + (o.pagar ? '<button class="btn" id="pay">Pagar agora</button>' : '') +
      (o.status === 'pendente' && o.pagamento_ativo ? '<button class="btn" id="rf">Atualizar status</button>' : '') +
      '<a class="btn" href="produtos.html">Continuar comprando</a></div>';
  }

  function load(sync) {
    return (sync ? A.call('POST', '/api/pedidos/' + enc + '/sincronizar') : Promise.resolve()).catch(function () {})
      .then(function () { return A.call('GET', '/api/pedidos/' + enc); })
      .then(function (o) { if (!cur || cur.status !== o.status) { cur = o; view(o); } return o; });
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'pay') {
      b.disabled = true;
      A.call('POST', '/api/pedidos/' + enc + '/pagar').then(function (r) { location.href = r.pagar_url; })
        .catch(function (err) { document.getElementById('pmsg').textContent = err.message; b.disabled = false; });
    } else if (b.id === 'rf') {
      b.disabled = true; load(true).then(function () { b.disabled = false; });
    }
  });

  load(true).then(function (o) {
    if (o.status !== 'pendente' || !o.pagamento_ativo) return;
    var t = setInterval(function () {
      if (++tries > 20) return clearInterval(t);
      load(true).then(function (x) { if (x.status !== 'pendente') clearInterval(t); });
    }, 8000);
  }).catch(function () {
    root.innerHTML = '<div class="cph"><h1>Pedido não encontrado</h1></div><a class="btn" href="produtos.html">Ver produtos</a>';
  });
})();
