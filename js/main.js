(function(){
  var $=function(s){return document.querySelector(s)}, $$=function(s){return [].slice.call(document.querySelectorAll(s))};
  var hd=$('#top'), mob=$('#mob'), bMenu=$('#bMenu'), srch=$('#srch'), drawer=$('#drawer'), veil=$('#veil'), toast=$('#toast'), tt;

  // esconde o rótulo quando a imagem for definida
  function hidePh(root){[].slice.call((root||document).querySelectorAll('.slot')).forEach(function(s){var v=getComputedStyle(s).getPropertyValue('--i').trim();if(v&&v!=='none'){var p=s.querySelector('.ph');if(p)p.remove()}})}
  hidePh(document);

  function onScroll(){hd.classList.toggle('sc',window.scrollY>30)}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();

  function menu(o){mob.classList.toggle('open',o);bMenu.setAttribute('aria-expanded',o);bMenu.querySelector('use').setAttribute('href',o?'#i-x':'#i-menu');document.body.style.overflow=o?'hidden':''}
  bMenu.onclick=function(){menu(!mob.classList.contains('open'))};
  $$('.mob a').forEach(function(a){a.onclick=function(){menu(false)}});

  function openS(o){srch.classList.toggle('open',o);if(o)setTimeout(function(){$('#q').focus()},300);else $('#q').blur()}
  $('#bSearch').onclick=function(){openS(true)};$('#xSearch').onclick=function(){openS(false)};
  $('#q').addEventListener('keydown',function(e){if(e.key==='Enter'&&this.value.trim()){openS(false);say('Busca por “'+this.value.trim()+'” em breve')}});

  function bag(o){drawer.classList.toggle('open',o);veil.classList.toggle('open',o)}
  $('#bBag').onclick=function(){bag(true)};$('#xBag').onclick=function(){bag(false)};veil.onclick=function(){bag(false)};$('#goShop').onclick=function(){bag(false)};
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){openS(false);bag(false);menu(false)}});

  function say(t){toast.textContent=t;toast.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){toast.classList.remove('on')},2400)}
  // links ainda sem página: troque o href="#" pelo endereço real
  $$('a[href="#"]').forEach(function(a){a.onclick=function(e){e.preventDefault();say((a.dataset.n||'Página')+' — em breve')}});

  // banner rotativo (só existe na home)
  if($('#hs')){
  var sl=$$('#hs .sl'), dt=$$('#dots button'), cur=0, tm, hs=$('#hs'), x0=null;
  function go(i){cur=(i+sl.length)%sl.length;sl.forEach(function(s,k){s.classList.toggle('on',k===cur)});dt.forEach(function(d,k){d.classList.remove('on');if(k===cur){void d.offsetWidth;d.classList.add('on')}});clearTimeout(tm);tm=setTimeout(function(){go(cur+1)},5500)}
  dt.forEach(function(d,k){d.onclick=function(){go(k)}});
  hs.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
  hs.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40)go(cur+(dx<0?1:-1));x0=null});
  go(0);
  }

  // carrinho: guardado no navegador; o servidor confere preço e estoque ao criar o pedido
  var CAT={relogios:'Relógios',bolsas:'Bolsas',oculos:'Óculos',acessorios:'Acessórios'},subs=[],cart=[];
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function money(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function brl(s){return parseFloat(String(s).replace(/[^\d,]/g,'').replace(',','.'))||0}
  try{cart=JSON.parse(localStorage.getItem('seven-cart')||'[]')}catch(e){}
  cart=cart.filter(function(it){return it&&it.n}).map(function(it){return{id:it.id||null,n:it.n,cat:it.cat||'',preco:typeof it.preco==='number'?it.preco:brl(it.p),img:it.img||'',q:Math.min(10,Math.max(1,it.q|0)),max:it.max||10,off:!it.id||!!it.off}});
  function save(){try{localStorage.setItem('seven-cart',JSON.stringify(cart))}catch(e){}}
  function count(){return cart.reduce(function(a,it){return a+it.q},0)}
  function total(){return cart.reduce(function(a,it){return a+(it.off?0:it.preco*it.q)},0)}
  function row(it,i){
    var h=it.id?'produto.html?id='+it.id:'',pic=it.img?'<img src="'+esc(it.img)+'" alt="">':'',
        im=h?'<a class="cimg" href="'+h+'" tabindex="-1" aria-hidden="true">'+pic+'</a>':'<span class="cimg">'+pic+'</span>',
        nm=h?'<a class="cn" href="'+h+'">'+esc(it.n)+'</a>':'<span class="cn">'+esc(it.n)+'</span>';
    return '<li class="ci'+(it.off?' off':'')+'" data-i="'+i+'">'+im+'<div class="cinfo">'+(it.cat?'<span class="cc">'+esc(CAT[it.cat]||'')+'</span>':'')+nm+'<span class="cp">'+money(it.preco)+'</span>'+
      (it.off?'<em class="coff">Indisponível</em>':'<div class="cqty"><button data-q="-1" aria-label="Diminuir quantidade"'+(it.q<=1?' disabled':'')+'>−</button><span>'+it.q+'</span><button data-q="1" aria-label="Aumentar quantidade"'+(it.q>=it.max?' disabled':'')+'>+</button></div>')+'</div>'+
      '<div class="cr"><strong>'+(it.off?'':money(it.preco*it.q))+'</strong><button class="crm" data-rm>Remover</button></div></li>';
  }
  function paint(){
    var ul=$('#items'),e=$('#emp'),f=$('#dfoot'),n=count(),c=$('#cnt');
    if(ul)ul.innerHTML=cart.map(row).join('');
    if(e)e.style.display=cart.length?'none':'';
    if(f){f.hidden=!cart.length;$('#dtot').textContent=money(total())}
    c.textContent=n;c.classList.toggle('on',n>0);
  }
  function changed(){save();paint();subs.forEach(function(f){f()})}
  function setQty(i,q){var it=cart[i];if(!it)return;it.q=Math.min(it.max,Math.max(1,q));changed()}
  function remove(i){cart.splice(i,1);changed()}
  function clear(){cart=[];changed()}
  function addItem(n,p,id,img){var f=id&&cart.filter(function(it){return it.id===id})[0];if(f)f.q=Math.min(f.max,f.q+1);else cart.push({id:id||null,n:n,cat:'',preco:typeof p==='number'?p:brl(p),img:img||'',q:1,max:10,off:!id});changed();bag(true);refresh()}
  function bind(el){el.addEventListener('click',function(e){var b=e.target.closest('button'),li=e.target.closest('.ci');if(!b||!li)return;var i=+li.dataset.i;if(b.dataset.q)setQty(i,cart[i].q+ +b.dataset.q);else if(b.hasAttribute('data-rm'))remove(i)})}
  function refresh(){ // traz preço, foto e estoque atuais do servidor
    var ids=cart.filter(function(it){return it.id}).map(function(it){return it.id});
    if(!ids.length||!window.fetch)return;
    fetch('/api/carrinho/itens?ids='+ids.join(',')).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
      var by={};d.produtos.forEach(function(p){by[p.id]=p});
      cart.forEach(function(it){var p=by[it.id];if(!p)return;it.n=p.n;it.cat=p.cat;it.preco=p.preco;it.img=p.img;it.off=p.ativo===0||p.estoque===0;it.max=Math.min(10,Math.max(1,p.estoque));it.q=Math.min(it.q,it.max)});
      changed();
    }).catch(function(){});
  }
  $$('.add').forEach(function(b){b.onclick=function(){addItem(b.dataset.n,b.dataset.p,+b.dataset.id||undefined,b.dataset.img)}});
  bind($('#items'));
  window.SevenCart={add:addItem,items:function(){return cart},total:total,count:count,row:row,bind:bind,clear:clear,refresh:refresh,money:money,on:function(f){subs.push(f)}};
  window.SevenUI={say:say,hidePh:hidePh,openBag:function(){bag(true)}};
  paint();refresh();

  // marcas: duplica a faixa para o loop contínuo
  $$('.track').forEach(function(t){t.innerHTML+=t.innerHTML});

  var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.15,rootMargin:'0px 0px -6% 0px'}):null;
  $$('.rv').forEach(function(el){io?io.observe(el):el.classList.add('in')});
})();
