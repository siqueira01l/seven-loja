(function () {
  var C = window.SevenCart, A = window.SevenAPI, root = document.getElementById('cko'), done = false;
  var UF = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  var OFFMSG = 'Há itens indisponíveis. Volte ao carrinho para removê-los.';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  root.innerHTML =
    '<div class="cph"><h1>Checkout</h1></div>' +
    '<div class="cpg" id="kg"><form class="kf" id="kf">' +
      '<section class="cs"><h2><span>01</span>Contato</h2>' +
        '<p class="kl" id="klogin">Já tem conta? <a href="conta.html?next=checkout.html">Entrar</a></p>' +
        '<label>Nome completo<input name="nome" autocomplete="name" maxlength="80" required></label>' +
        '<div class="row2"><label>E-mail<input name="email" type="email" autocomplete="email" required></label>' +
        '<label>Telefone<input name="telefone" type="tel" autocomplete="tel" inputmode="tel" maxlength="20"></label></div></section>' +
      '<section class="cs"><h2><span>02</span>Entrega</h2>' +
        '<div class="row3"><label>CEP<input name="cep" autocomplete="postal-code" inputmode="numeric" minlength="9" maxlength="9" placeholder="00000-000" required></label>' +
        '<label class="w2">Rua<input name="rua" autocomplete="address-line1" maxlength="100" required></label></div>' +
        '<div class="row3"><label>Número<input name="numero" maxlength="20" required></label>' +
        '<label class="w2">Complemento<input name="complemento" autocomplete="address-line2" maxlength="100" placeholder="Opcional"></label></div>' +
        '<label>Bairro<input name="bairro" maxlength="100" required></label>' +
        '<div class="row3"><label class="w2">Cidade<input name="cidade" autocomplete="address-level2" maxlength="100" required></label>' +
        '<label>UF<select name="uf" autocomplete="address-level1" required><option value="">UF</option>' + UF.map(function (u) { return '<option>' + u + '</option>'; }).join('') + '</select></label></div></section>' +
      '<section class="cs"><h2><span>03</span>Pagamento</h2>' +
        '<div class="mpb"><strong>Pagamento seguro pelo Mercado Pago</strong><span>Pix, cartão de crédito ou boleto. Você escolhe na próxima etapa.</span></div>' +
        '<p class="kn">Os dados do cartão são digitados no ambiente do Mercado Pago. A SEVEN não os recebe nem guarda.</p></section>' +
    '</form><aside class="cps"><h2>Seu pedido</h2><ul class="mini" id="kl"></ul><dl class="sum" id="kt"></dl>' +
      '<p class="cmsg" id="kmsg" role="alert"></p><button class="btn" type="submit" form="kf" id="kbtn">Confirmar e pagar</button>' +
      '<a class="lnk" href="carrinho.html">Voltar ao carrinho</a></aside></div>' +
    '<div class="cpe" id="ke" hidden><p>Seu carrinho está vazio</p><a class="btn" href="produtos.html">Explorar coleção</a></div>';

  function render() {
    if (done) return;
    var items = C.items(), off = items.some(function (i) { return i.off; }), t = C.money(C.total()), m = $('kmsg');
    $('kg').hidden = !items.length; $('ke').hidden = !!items.length;
    $('kl').innerHTML = items.map(function (it) {
      return '<li class="' + (it.off ? 'off' : '') + '"><span class="cimg">' + (it.img ? '<img src="' + esc(it.img) + '" alt="">' : '') + '<b class="qb">' + it.q + '</b></span>' +
        '<span class="mn">' + esc(it.n) + (it.off ? '<em class="coff">Indisponível</em>' : '') + '</span><span class="mp">' + (it.off ? '' : C.money(it.preco * it.q)) + '</span></li>';
    }).join('');
    $('kt').innerHTML = '<div><dt>Subtotal</dt><dd>' + t + '</dd></div><div><dt>Frete</dt><dd>A calcular</dd></div><div class="tt"><dt>Total</dt><dd>' + t + '</dd></div>';
    $('kbtn').disabled = off || !C.total();
    if (off) m.textContent = OFFMSG; else if (m.textContent === OFFMSG) m.textContent = '';
  }
  C.on(render); render();

  var f = $('kf').elements;
  f.cep.addEventListener('input', function () {
    var d = this.value.replace(/\D/g, '').slice(0, 8);
    this.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  });

  A.me().then(function (u) {
    if (!u) return;
    if (!f.nome.value) f.nome.value = u.nome;
    if (!f.email.value) f.email.value = u.email;
    $('klogin').hidden = true;
  });

  $('kf').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('kbtn'), msg = $('kmsg');
    var itens = C.items().filter(function (i) { return !i.off; }).map(function (i) { return { id: i.id, qtd: i.q }; });
    btn.disabled = true; msg.textContent = '';
    A.call('POST', '/api/pedidos', {
      cliente: { nome: f.nome.value, email: f.email.value, telefone: f.telefone.value },
      entrega: { cep: f.cep.value, rua: f.rua.value, numero: f.numero.value, complemento: f.complemento.value, bairro: f.bairro.value, cidade: f.cidade.value, uf: f.uf.value },
      itens: itens
    }).then(function (r) {
      done = true; C.clear(); location.href = r.pagar_url || 'pedido.html?n=' + encodeURIComponent(r.numero);
    }).catch(function (err) { msg.textContent = err.message; btn.disabled = false; if (err.status === 409) C.refresh(); });
  });
})();
