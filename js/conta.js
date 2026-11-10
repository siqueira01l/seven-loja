(function () {
  var A = window.SevenAPI, root = document.getElementById('conta');
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function guest() {
    root.innerHTML =
      '<div class="ctabs" role="tablist"><button role="tab" data-t="entrar" aria-selected="true">Entrar</button><button role="tab" data-t="criar" aria-selected="false">Criar conta</button></div>' +
      '<form class="cf" id="f-entrar" data-u="/api/auth/entrar">' +
        '<label>E-mail<input name="email" type="email" autocomplete="email" required></label>' +
        '<label>Senha<input name="senha" type="password" autocomplete="current-password" required></label>' +
        '<p class="msg" role="alert"></p><button class="btn" type="submit">Entrar</button></form>' +
      '<form class="cf" id="f-criar" data-u="/api/auth/registrar" hidden>' +
        '<label>Nome<input name="nome" autocomplete="name" maxlength="80" required></label>' +
        '<label>E-mail<input name="email" type="email" autocomplete="email" required></label>' +
        '<label>Senha<input name="senha" type="password" autocomplete="new-password" minlength="8" required></label>' +
        '<p class="hint">Mínimo de 8 caracteres.</p>' +
        '<p class="msg" role="alert"></p><button class="btn" type="submit">Criar conta</button></form>';
  }

  function user(u) {
    root.innerHTML = '<h1>Olá, ' + esc(u.nome.split(' ')[0]) + '</h1><p class="ce">' + esc(u.email) + '</p>' +
      '<div class="cact">' + (u.papel === 'admin' ? '<a class="btn" href="admin.html">Painel administrativo</a>' : '') +
      '<a class="btn" href="produtos.html">Ver produtos</a><button class="btn" id="sair">Sair</button></div>';
  }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-t]');
    if (t) {
      [].forEach.call(root.querySelectorAll('[data-t]'), function (b) { b.setAttribute('aria-selected', b === t); });
      document.getElementById('f-entrar').hidden = t.dataset.t !== 'entrar';
      document.getElementById('f-criar').hidden = t.dataset.t !== 'criar';
    } else if (e.target.id === 'sair') {
      A.call('POST', '/api/auth/sair').then(function () { A.setMe(null); guest(); });
    }
  });

  root.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector('.btn'), msg = f.querySelector('.msg'), body = {};
    [].forEach.call(f.elements, function (el) { if (el.name) body[el.name] = el.value; });
    btn.disabled = true; msg.textContent = '';
    A.call('POST', f.dataset.u, body).then(function (d) {
      A.setMe(d.usuario);
      var nx = new URLSearchParams(location.search).get('next');
      if (nx === 'checkout.html' || nx === 'carrinho.html') location.href = nx;
      else if (d.usuario.papel === 'admin') location.href = 'admin.html'; else user(d.usuario);
    }).catch(function (err) { msg.textContent = err.message; btn.disabled = false; });
  });

  A.me().then(function (u) { if (u) user(u); else guest(); });
})();
