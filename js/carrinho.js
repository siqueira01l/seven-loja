(function () {
  var C = window.SevenCart, root = document.getElementById('cpage');
  function $(id) { return document.getElementById(id); }
  root.innerHTML =
    '<div class="cph"><h1>Carrinho</h1><p id="cn"></p></div>' +
    '<div class="cpg" id="cpg"><div class="cpl"><ul class="items" id="cpi"></ul></div><aside class="cps" id="cps"></aside></div>' +
    '<div class="cpe" id="cpe" hidden><p>Seu carrinho está vazio</p><a class="btn" href="produtos.html">Explorar coleção</a></div>';

  function render() {
    var items = C.items(), n = C.count(), off = items.some(function (i) { return i.off; }), t = C.money(C.total());
    $('cpg').hidden = !items.length; $('cpe').hidden = !!items.length;
    $('cn').textContent = items.length ? n + (n === 1 ? ' item' : ' itens') : '';
    $('cpi').innerHTML = items.map(C.row).join('');
    $('cps').innerHTML = '<h2>Resumo</h2><dl class="sum"><div><dt>Subtotal</dt><dd>' + t + '</dd></div>' +
      '<div class="tt"><dt>Total</dt><dd>' + t + '</dd></div></dl>' +
      (off ? '<p class="cmsg">Remova os itens indisponíveis para continuar.</p>' : '') +
      (off || !C.total() ? '<button class="btn" disabled>Finalizar compra</button>' : '<a class="btn" href="checkout.html">Finalizar compra</a>') +
      '<a class="lnk" href="produtos.html">Continuar comprando</a>';
  }
  C.bind($('cpi')); C.on(render); render();
})();
