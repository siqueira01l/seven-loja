(function () {
  function call(method, url, body) {
    var o = { method: method, credentials: 'same-origin', headers: { 'X-Requested-With': 'seven' } };
    if (body instanceof FormData) o.body = body;
    else if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(url, o).then(function (r) {
      return r.text().then(function (t) {
        var j = {}; try { j = JSON.parse(t); } catch (e) {}
        if (!r.ok) { var err = new Error(j.erro || 'Algo deu errado. Tente novamente.'); err.status = r.status; throw err; }
        return j;
      });
    });
  }
  function paint(u) {
    var b = document.getElementById('bUser'); if (!b) return;
    b.classList.toggle('on', !!u);
    b.setAttribute('aria-label', u ? 'Minha conta (' + u.nome + ')' : 'Entrar');
  }
  var ready = call('GET', '/api/me').then(function (d) { return d.usuario; }).catch(function () { return null; });
  ready.then(paint);
  window.SevenAPI = {
    call: call,
    me: function () { return ready; },
    setMe: function (u) { ready = Promise.resolve(u); paint(u); }
  };
})();
