(function () {
  var A = window.SevenAPI, ui = window.SevenUI || {}, root = document.getElementById('adm');
  var CAT = { relogios: 'Relógios', bolsas: 'Bolsas', oculos: 'Óculos', acessorios: 'Acessórios' };
  var list = [], ed = null;
  function fmt(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(t) { if (ui.say) ui.say(t); }
  function $(s) { return document.querySelector(s); }
  function gate(msg, link) { root.innerHTML = '<div class="nf">' + msg + (link ? '<a class="btn" href="conta.html">Entrar</a>' : '') + '</div>'; }

  function frame() {
    var opts = Object.keys(CAT).map(function (k) { return '<option value="' + k + '">' + CAT[k] + '</option>'; }).join('');
    root.innerHTML =
      '<div class="ah"><h1>Produtos</h1><button class="btn" id="novo">Novo produto</button></div>' +
      '<div class="ag" id="ag"><div class="tw"><table class="tb"><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>' +
      '<form class="ef" id="ef" hidden><h2 id="et"></h2>' +
        '<label>Nome<input name="nome" maxlength="120" required></label>' +
        '<label>Marca<input name="marca" maxlength="60"></label>' +
        '<label>Categoria<select name="categoria" required>' + opts + '</select></label>' +
        '<div class="two"><label>Preço (R$)<input name="preco" type="number" min="0" step="0.01" required></label>' +
        '<label>Estoque<input name="estoque" type="number" min="0" step="1" required></label></div>' +
        '<label>Descrição<textarea name="descricao" rows="4" maxlength="2000"></textarea></label>' +
        '<label>Especificações<textarea name="specs" rows="4" placeholder="Uma por linha, assim:&#10;Caixa: Aço, 41 mm&#10;Movimento: Automático"></textarea></label>' +
        '<label>Garantia<input name="garantia" maxlength="200" placeholder="Em branco usa o padrão da categoria"></label>' +
        '<div class="fl"><span>Fotos</span><div class="fg" id="fotos"></div>' +
        '<button type="button" class="btn" data-a="pick">Adicionar fotos</button><input type="file" id="up" accept="image/jpeg,image/png,image/webp" multiple hidden></div>' +
        '<p class="msg" id="emsg" role="alert"></p>' +
        '<div class="eb"><button class="btn" type="submit">Salvar</button><button class="btn" type="button" data-a="cancel">Cancelar</button></div></form></div>';
  }

  function rows() {
    $('#rows').innerHTML = list.map(function (p) {
      var im = p.img ? '<img src="' + esc(p.img) + '" alt="">' : '';
      return '<tr class="' + (p.ativo ? '' : 'off') + '"><td><div class="pn"><span class="pt">' + im + '</span><span><b>' + esc(p.n) + '</b><small>' + esc(p.marca) + '</small></span>' + (p.ativo ? '' : '<em>Vendido</em>') + '</div></td>' +
        '<td>' + esc(CAT[p.cat] || '') + '</td><td>' + fmt(p.preco) + '</td><td>' + p.estoque + '</td>' +
        '<td class="ac"><button data-a="edit" data-id="' + p.id + '">Editar</button><button data-a="' + (p.ativo ? 'del' : 'back') + '" data-id="' + p.id + '">' + (p.ativo ? 'Remover' : 'Voltar à vitrine') + '</button></td></tr>';
    }).join('') || '<tr><td colspan="5" class="em">Nenhum produto cadastrado.</td></tr>';
  }

  function load() { return A.call('GET', '/api/admin/produtos').then(function (d) { list = d.produtos; rows(); }); }

  function fotos() {
    $('#fotos').innerHTML = ed.imagens.map(function (u, i) {
      return '<figure class="ft"><img src="' + esc(u) + '" alt="Foto ' + (i + 1) + '"><figcaption>' +
        (i ? '<button type="button" data-a="main" data-i="' + i + '">Principal</button>' : '<span>Principal</span>') +
        '<button type="button" data-a="rm" data-i="' + i + '">Tirar</button></figcaption></figure>';
    }).join('') || '<p class="hint">Nenhuma foto ainda.</p>';
  }

  function open(p) {
    ed = { id: p ? p.id : null, imagens: p ? p.imagens.slice() : [] };
    var f = $('#ef').elements, s = p ? p.specs || {} : {};
    $('#et').textContent = p ? 'Editar produto' : 'Novo produto';
    f.nome.value = p ? p.n : ''; f.marca.value = p ? p.marca : ''; f.categoria.value = p ? p.cat : 'relogios';
    f.preco.value = p ? p.preco : ''; f.estoque.value = p ? p.estoque : 1; f.descricao.value = p ? p.descricao : '';
    f.specs.value = Object.keys(s).map(function (k) { return k + ': ' + s[k]; }).join('\n'); f.garantia.value = p ? p.garantia : '';
    $('#emsg').textContent = ''; fotos();
    $('#ef').hidden = false; $('#ag').classList.add('open');
    $('#ef').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function close() { ed = null; $('#ef').hidden = true; $('#ag').classList.remove('open'); }

  function save(e) {
    e.preventDefault();
    var f = e.target.elements, btn = e.target.querySelector('[type=submit]'), specs = {};
    f.specs.value.split('\n').forEach(function (l) {
      var i = l.indexOf(':'); if (i > 0 && l.slice(i + 1).trim()) specs[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    });
    var body = { nome: f.nome.value, marca: f.marca.value, categoria: f.categoria.value, preco: parseFloat(f.preco.value),
      estoque: parseInt(f.estoque.value, 10), descricao: f.descricao.value, specs: specs, garantia: f.garantia.value, imagens: ed.imagens };
    btn.disabled = true; $('#emsg').textContent = '';
    A.call(ed.id ? 'PUT' : 'POST', '/api/admin/produtos' + (ed.id ? '/' + ed.id : ''), body)
      .then(function () { close(); return load(); }).then(function () { say('Produto salvo'); })
      .catch(function (err) { $('#emsg').textContent = err.message; btn.disabled = false; });
  }

  function upload(files) {
    var msg = $('#emsg'), chain = Promise.resolve();
    msg.textContent = 'Enviando fotos…';
    [].forEach.call(files, function (file) {
      chain = chain.then(function () {
        if (file.size > 8 * 1024 * 1024) throw new Error(file.name + ' passa de 8 MB.');
        var fd = new FormData(); fd.append('foto', file);
        return A.call('POST', '/api/admin/upload', fd).then(function (d) { ed.imagens.push(d.caminho); fotos(); });
      });
    });
    chain.then(function () { msg.textContent = ''; }).catch(function (err) { msg.textContent = err.message; });
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var a = b.dataset.a, id = +b.dataset.id, p = list.filter(function (x) { return x.id === id; })[0];
    if (b.id === 'novo') open(null);
    else if (a === 'edit') open(p);
    else if (a === 'cancel') close();
    else if (a === 'pick') $('#up').click();
    else if (a === 'rm') { ed.imagens.splice(+b.dataset.i, 1); fotos(); }
    else if (a === 'main') { ed.imagens.unshift(ed.imagens.splice(+b.dataset.i, 1)[0]); fotos(); }
    else if (a === 'del') {
      if (confirm('Remover "' + p.n + '" da vitrine? Ele passa para o filtro "Vendidos" (só aparece para quem escolher esse filtro) e você pode devolvê-lo depois.'))
        A.call('DELETE', '/api/admin/produtos/' + id).then(load).then(function () { say('Movido para Vendidos'); }).catch(function (err) { say(err.message); });
    } else if (a === 'back') A.call('PUT', '/api/admin/produtos/' + id, { ativo: 1 }).then(load).then(function () { say('Produto de volta à vitrine'); });
  });
  root.addEventListener('submit', save);
  root.addEventListener('change', function (e) { if (e.target.id === 'up') { upload(e.target.files); e.target.value = ''; } });

  A.me().then(function (u) {
    if (!u) return gate('Entre para continuar', true);
    if (u.papel !== 'admin') return gate('Acesso restrito a administradores');
    frame(); load();
  });
})();
