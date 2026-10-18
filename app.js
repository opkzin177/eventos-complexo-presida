(function () {
  'use strict';
  var NUVEM = 'https://copa-presida-default-rtdb.firebaseio.com/desafio_junin.json';
  var API = 'https://eventoscomplexopresida.netlify.app/.netlify/functions';
  var VALOR_PIX = 200;
  var VALOR_CARTAO = 235;
  function valorAtual() { return modoAtual === 'cartao' ? VALOR_CARTAO : VALOR_PIX; }
  var ADMIN_USER = 'junim07';
  var catAtual = 'A com B';
  var modoAtual = 'pix';
  var enviando = false;
  var userAtual = null;
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }
  function setMsg(t, cls) {
    var m = $('formMsg');
    if (!m) return;
    m.className = 'msg' + (cls ? ' ' + cls : '');
    m.textContent = t || '';
  }
  function loadUser() {
    userAtual = null;
    try {
      var raw = localStorage.getItem('junin_session') || sessionStorage.getItem('junin_session');
      if (raw) {
        var u = JSON.parse(raw);
        if (u && u.username) {
          userAtual = u;
          localStorage.setItem('junin_session', JSON.stringify(u));
        }
      }
    } catch (e) { userAtual = null; }
  }
  function saveUser(u) {
    userAtual = u || null;
    try {
      if (u && u.username) {
        localStorage.setItem('junin_session', JSON.stringify({ username: u.username, token: u.token || '' }));
      } else localStorage.removeItem('junin_session');
    } catch (e) {}
  }
  function mostrarModoAuth(modo) {
    var login = $('modoLogin'), reg = $('modoRegistro'), tL = $('tabLogin'), tR = $('tabReg');
    var isLogin = modo !== 'registro';
    if (login) login.style.display = isLogin ? 'block' : 'none';
    if (reg) reg.style.display = isLogin ? 'none' : 'block';
    if (tL) { tL.classList.toggle('on', isLogin); }
    if (tR) { tR.classList.toggle('on', !isLogin); }
    var err = $('authErr'); if (err) err.textContent = '';
  }
  function liberarFicha(logado) {
    var ficha = $('fichaInscricao'), lock = $('lockInscricao');
    if (ficha) ficha.style.display = logado ? 'block' : 'none';
    if (lock) lock.style.display = logado ? 'none' : 'block';
  }
  function atualizarUIAuth() {
    var box = $('authBox'), perfil = $('perfilBox'), forms = $('authForms');
    if (!box) return;
    if (userAtual && userAtual.username) {
      if (forms) forms.style.display = 'none';
      box.innerHTML = '<div class="auth-user"><div><strong>@' + esc(userAtual.username) + '</strong><div class="note">Logado neste aparelho</div></div><button type="button" class="btn" id="btnSairLocal">Sair</button></div>';
      var b = $('btnSairLocal'); if (b) b.onclick = function () { saveUser(null); atualizarUIAuth(); };
      if (perfil) perfil.style.display = 'block';
      liberarFicha(true);
      carregarMeusIngressos();
    } else {
      box.innerHTML = '';
      if (forms) forms.style.display = 'block';
      if (perfil) perfil.style.display = 'none';
      liberarFicha(false);
      mostrarModoAuth('login');
    }
  }
  async function registrar() {
    var username = ($('regUser') || {}).value, password = ($('regPass') || {}).value, password2 = ($('regPass2') || {}).value;
    var err = $('authErr'); if (err) err.textContent = '';
    if (String(password || '') !== String(password2 || '')) { if (err) err.textContent = 'As senhas não são iguais.'; return; }
    try {
      var userNorm = String(username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (userNorm.length < 3) { if (err) err.textContent = 'Usuário mínimo 3 caracteres.'; return; }
      if (String(password || '').length < 6) { if (err) err.textContent = 'Senha mínimo 6 caracteres.'; return; }
      var r = await fetch(API + '/auth-register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: userNorm, password: password }) });
      var data = await r.json().catch(function () { return {}; });
      if (!data.ok) { if (err) err.textContent = data.error || 'Não foi possível cadastrar.'; return; }
      saveUser({ username: data.user.username, token: data.token });
      atualizarUIAuth();
    } catch (e) { if (err) err.textContent = 'Erro de rede. Tente de novo.'; }
  }
  async function loginLocal() {
    var username = ($('logUser') || {}).value, password = ($('logPass') || {}).value;
    var err = $('authErr'); if (err) err.textContent = '';
    try {
      var userNorm = String(username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      var r = await fetch(API + '/auth-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: userNorm, password: password }) });
      var data = await r.json().catch(function () { return {}; });
      if (!data.ok) { if (err) err.textContent = data.error || 'Login inválido.'; return; }
      saveUser({ username: data.user.username, token: data.token });
      atualizarUIAuth();
    } catch (e) { if (err) err.textContent = 'Erro de rede. Tente de novo.'; }
  }
  async function carregarMeusIngressos() {
    var box = $('meusIngressos'); if (!box || !userAtual) return;
    box.innerHTML = '<p class="note">Carregando…</p>';
    try {
      var r = await fetch(NUVEM, { cache: 'no-store' });
      var db = r.ok ? (await r.json() || {}) : {};
      var map = db.inscricoes && typeof db.inscricoes === 'object' ? db.inscricoes : {};
      var list = Object.keys(map).map(function (k) { return map[k]; }).filter(function (x) {
        return x && String(x.username || '').toLowerCase() === String(userAtual.username).toLowerCase();
      });
      if (!list.length) { box.innerHTML = '<p class="note">Nenhum ingresso ainda.</p>'; return; }
      box.innerHTML = list.map(function (it) {
        return '<div class="card" style="margin:8px 0"><strong>' + esc(it.ingresso || it.id) + '</strong><div class="note">' + esc(it.categoria) + ' · ' + esc(it.status) + ' · R$ ' + esc(it.valor != null ? it.valor : VALOR_PIX) + '</div></div>';
      }).join('');
    } catch (e) { box.innerHTML = '<p class="msg err">Erro ao carregar.</p>'; }
  }
  function setCat(cat, scroll) {
    catAtual = cat || 'A com B';
    document.querySelectorAll('.card-cat').forEach(function (c) { c.classList.toggle('active', c.getAttribute('data-cat') === catAtual); });
    document.querySelectorAll('.cat-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-cat') === catAtual); });
    var pc = $('payCat'); if (pc) pc.textContent = catAtual;
    if (scroll) { var el = $('inscricao'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
  }
  function setModo(modo) {
    modoAtual = modo === 'cartao' ? 'cartao' : 'pix';
    document.querySelectorAll('.pay-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-modo') === modoAtual); });
    var v = valorAtual();
    var sum = document.querySelector('.pay-sum strong');
    if (sum) sum.textContent = 'R$ ' + v.toFixed(2).replace('.', ',');
    var btn = $('btnPagar'); if (btn) btn.textContent = 'Confirmar inscrição · R$ ' + v.toFixed(2).replace('.', ',');
    var hint = $('payHint');
    if (hint) hint.textContent = modoAtual === 'cartao' ? 'Crédito à vista R$ 235 — sem parcelamento.' : 'PIX R$ 200,00.';
  }
  function okForm() {
    var nomeDupla = String(($('nomeDupla') || {}).value || '').trim();
    var nome = String(($('nome') || {}).value || '').trim();
    var cpf = soDigitos(($('cpf') || {}).value);
    var whats = String(($('whats') || {}).value || '').trim();
    if (!nomeDupla || !nome) { setMsg('Preencha nome da dupla e do atleta.', 'err'); return false; }
    if (cpf.length !== 11) { setMsg('CPF inválido.', 'err'); return false; }
    if (whats.length < 8) { setMsg('Informe o WhatsApp.', 'err'); return false; }
    return true;
  }
  function novoId() { return 'JUN-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  async function salvarInscricao(item) {
    var base = NUVEM.replace(/\.json$/, '');
    await fetch(base + '/inscricoes/' + encodeURIComponent(item.id) + '.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
  }
  async function enviarInscricao() {
    if (enviando) return;
    if (!userAtual || !userAtual.username) { setMsg('Entre ou crie uma conta antes de se inscrever.', 'err'); return; }
    if (!okForm()) return;
    enviando = true;
    var btn = $('btnPagar'); if (btn) btn.disabled = true;
    setMsg('Gerando pagamento…', '');
    var id = novoId();
    var item = {
      id: id,
      nomeDupla: String($('nomeDupla').value).trim().slice(0, 160),
      nome: String($('nome').value).trim().slice(0, 120),
      parceiro: String(($('pNome') || {}).value || '').trim().slice(0, 120),
      cpf: soDigitos($('cpf').value).slice(0, 11),
      whatsapp: String($('whats').value).trim().slice(0, 30),
      email: String(($('email') || {}).value || '').trim().slice(0, 120).toLowerCase() || (userAtual.username + '@junin.local'),
      instagram: String(($('insta') || {}).value || '').trim().slice(0, 60),
      categoria: catAtual, metodo: modoAtual, valor: valorAtual(), status: 'aguardando',
      ingresso: 'JUNIN-' + id.replace(/^JUN-/, ''), evento: 'Desafio Junin Imports',
      username: userAtual.username, createdAt: new Date().toISOString()
    };
    try {
      await salvarInscricao(item);
      var r = await fetch(API + '/asaas-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia: item.id, categoria: item.categoria, metodo: modoAtual === 'cartao' ? 'cartao' : 'pix', nome: item.nome, cpf: item.cpf, email: item.email, whatsapp: item.whatsapp, nomeDupla: item.nomeDupla, parceiro: item.parceiro })
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok || !data.ok || !(data.url || data.paymentUrl)) {
        setMsg(data.error || 'Não foi possível abrir o pagamento.', 'err');
        enviando = false; if (btn) btn.disabled = false; return;
      }
      setMsg('Redirecionando…', 'ok');
      window.location.href = data.url || data.paymentUrl;
    } catch (e) {
      setMsg('Erro ao gerar pagamento.', 'err');
      enviando = false; if (btn) btn.disabled = false;
    }
  }
  async function verificarRetornoAsaas() {
    var q = new URLSearchParams(location.search);
    if (q.get('asaas') !== 'retorno') return;
    var order = q.get('order') || '';
    setMsg('Confirmando pagamento…', '');
    try {
      var r = await fetch(API + '/asaas-verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: order, orderNsu: order }) });
      var data = await r.json().catch(function () { return {}; });
      if (data.ok && (data.status === 'pago' || data.pago)) {
        setMsg('Pagamento confirmado! Ingresso liberado.', 'ok');
        var t = $('ticket'), c = $('ticketCode');
        if (c) c.textContent = data.ingresso || ('JUNIN-' + String(order).replace(/^JUN-/, ''));
        if (t) t.classList.add('show');
        if (userAtual) carregarMeusIngressos();
      } else setMsg('Pagamento em análise. Atualize em instantes se já pagou.', '');
    } catch (e) { setMsg('Confirmação pendente. Seu pagamento será validado em breve.', ''); }
    try { history.replaceState({}, '', location.pathname + '#inscricao'); } catch (e) {}
  }
  function adminLogged() { try { return sessionStorage.getItem('junin_admin') === '1'; } catch (e) { return false; } }
  function setAdminLogged(on) { try { if (on) sessionStorage.setItem('junin_admin', '1'); else sessionStorage.removeItem('junin_admin'); } catch (e) {} }
  function abrirAuth() { var a = document.getElementById('auth'); if (a) a.classList.add('open'); }
  function fecharAuth() { var a = document.getElementById('auth'); if (a) a.classList.remove('open'); }
  function abrirPainel() { fecharAuth(); var ad = document.getElementById('admin'); if (ad) ad.classList.add('open'); try { listarAdmin(); } catch (e) {} }
  function fecharSecreta() { var ad = document.getElementById('admin'); if (ad) ad.classList.remove('open'); fecharAuth(); }
  function tentarLogin() {
    var u = String(($('adminUser') || {}).value || '').trim().toLowerCase();
    var p = String(($('adminPass') || {}).value || '');
    var err = $('adminErr'); if (err) err.textContent = '';
    if (u === ADMIN_USER && p === 'presida2026') { setAdminLogged(true); abrirPainel(); return; }
    if (err) err.textContent = 'Usuário ou senha incorretos';
  }
  function logoutAdmin() { setAdminLogged(false); fecharSecreta(); }
  var _adminCache = [], _adminDb = null;
  function estaPago(x) { return String((x && x.status) || '').toLowerCase() === 'pago'; }
  function fmtBRL(n) { n = Number(n) || 0; return 'R$ ' + n.toFixed(2).replace('.', ','); }
  async function listarAdmin() {
    var box = $('lista'); if (!box) return;
    box.innerHTML = '<p class="note">Carregando…</p>';
    try {
      var r = await fetch(NUVEM, { cache: 'no-store' });
      var db = r.ok ? (await r.json() || {}) : {};
      _adminDb = db;
      var map = db.inscricoes && typeof db.inscricoes === 'object' ? db.inscricoes : {};
      var arr = Object.keys(map).map(function (k) { var it = map[k] || {}; it._key = k; if (!it.id) it.id = k; return it; });
      arr.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
      _adminCache = arr;
      var pagas = arr.filter(estaPago), wait = arr.filter(function (x) { return !estaPago(x); });
      var gerado = arr.reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
      var pago = pagas.reduce(function (s, x) { return s + (Number(x.valorPago != null ? x.valorPago : x.valor) || 0); }, 0);
      if ($('kpiTotal')) $('kpiTotal').textContent = arr.length;
      if ($('kpiPagas')) $('kpiPagas').textContent = pagas.length;
      if ($('kpiWait')) $('kpiWait').textContent = wait.length;
      if ($('kpiPago')) $('kpiPago').textContent = fmtBRL(pago);
      if ($('kpiGerado')) $('kpiGerado').textContent = fmtBRL(gerado);
      renderListaAdmin(arr);
    } catch (e) { box.innerHTML = '<p class="msg err">Erro ao carregar.</p>'; }
  }
  function filtrarListaAdmin() {
    var q = String(($('buscaDupla') || {}).value || '').toLowerCase().trim();
    var st = String(($('filtroStatus') || {}).value || 'todos');
    renderListaAdmin(_adminCache.filter(function (x) {
      if (st === 'pago' && !estaPago(x)) return false;
      if (st === 'aguardando' && estaPago(x)) return false;
      if (!q) return true;
      return [x.nomeDupla, x.nome, x.parceiro, x.categoria, x.ingresso, x.id, x.username].join(' ').toLowerCase().indexOf(q) >= 0;
    }));
  }
  function renderListaAdmin(list) {
    var box = $('lista'); if (!box) return;
    if (!list.length) { box.innerHTML = '<p class="note">Nenhuma inscrição.</p>'; return; }
    box.innerHTML = list.map(function (it) {
      var pago = estaPago(it), id = it._key || it.id;
      return '<div class="admin-row"><div><strong>' + esc(it.nomeDupla || it.nome || '—') + '</strong> ' + (pago ? '<span class="badge-pago">PAGO</span>' : '<span class="badge-wait">AGUARDANDO</span>') + '</div><div class="note">' + esc(it.categoria) + ' · ' + fmtBRL(it.valor) + ' · ' + esc(it.ingresso || id) + '</div></div>';
    }).join('');
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.card-cat').forEach(function (card) {
      card.addEventListener('click', function () { setCat(card.getAttribute('data-cat'), true); });
    });
    var logoEl = document.getElementById('logo') || document.querySelector('.logo');
    var n = 0, t;
    if (logoEl) {
      logoEl.addEventListener('click', function (e) {
        n++; clearTimeout(t); t = setTimeout(function () { n = 0; }, 2000);
        if (n >= 5) { e.preventDefault(); abrirAuth(); }
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) { e.preventDefault(); abrirAuth(); }
    });
    if (/[?&](admin|painel)=1\b/.test(location.search)) abrirAuth();
    var tabL = $('tabLogin'), tabR = $('tabReg');
    if (tabL) tabL.addEventListener('click', function () { mostrarModoAuth('login'); });
    if (tabR) tabR.addEventListener('click', function () { mostrarModoAuth('registro'); });
    var btnL = $('btnLogin'), btnR = $('btnRegister');
    if (btnL) btnL.addEventListener('click', function (e) { e.preventDefault(); loginLocal(); });
    if (btnR) btnR.addEventListener('click', function (e) { e.preventDefault(); registrar(); });
    var btnPay = $('btnPagar');
    if (btnPay) btnPay.addEventListener('click', function (e) { e.preventDefault(); enviarInscricao(); });
    document.querySelectorAll('.pay-tab').forEach(function (b) {
      b.addEventListener('click', function () { setModo(b.getAttribute('data-modo')); });
    });
    [['btnAdminFechar', fecharSecreta], ['btnAuthFechar', fecharAuth], ['btnAdminEntrar', tentarLogin], ['btnAdminListar', listarAdmin], ['btnAdminSair', logoutAdmin], ['btnBuscar', filtrarListaAdmin]].forEach(function (pair) {
      var el = $(pair[0]); if (el) el.addEventListener('click', function (e) { e.preventDefault(); pair[1](); });
    });
    var busca = $('buscaDupla'); if (busca) busca.addEventListener('input', filtrarListaAdmin);
    var fs = $('filtroStatus'); if (fs) fs.addEventListener('change', filtrarListaAdmin);
    loadUser(); atualizarUIAuth(); verificarRetornoAsaas();
  });
})();
