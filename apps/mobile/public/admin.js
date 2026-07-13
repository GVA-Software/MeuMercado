      'use strict';
      var API_BASE = (location.port === '5173' ? 'http://localhost:3000' : '') + '/api';
      var token = null;
      var state = { tab: 'app', stats: null, funil: null, feedbacks: null, qa: null, qaLoading: false, dups: null, dupsLoading: false, users: [], busca: '', aberto: null, agindo: null, erro: '' };
      var FB_TIPO = { bug: '🐛 Bug', sugestao: '💡 Sugestão', elogio: '❤️ Elogio', outro: '💬 Outro' };

      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      function el(id) { return document.getElementById(id); }

      async function apiFetch(path, opts) {
        opts = opts || {};
        var res = await fetch(API_BASE + path, {
          method: opts.method || 'GET',
          credentials: 'include',
          headers: Object.assign(
            { 'content-type': 'application/json' },
            token ? { authorization: 'Bearer ' + token } : {},
            opts.headers || {}
          ),
          body: opts.body,
        });
        if (res.status === 401 && path.indexOf('/auth/') !== 0) {
          if (await tryRefresh()) return apiFetch(path, opts);
        }
        if (!res.ok) {
          var body = null;
          try { body = await res.json(); } catch (e) {}
          var err = new Error((body && body.message) || res.statusText);
          err.status = res.status;
          err.issues = body && body.issues;
          throw err;
        }
        return res.status === 204 ? null : res.json();
      }
      async function tryRefresh() {
        try {
          var r = await fetch(API_BASE + '/auth/refresh', {
            method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
          });
          if (!r.ok) return false;
          var b = await r.json();
          token = b.accessToken;
          return true;
        } catch (e) { return false; }
      }

      // ---------- Login ----------
      function renderLogin(erro) {
        document.getElementById('root').innerHTML =
          '<div class="login"><div class="login-card">' +
          '<div class="brand"><img src="/Loading.png" alt=""/><b>Meu Mercado</b></div>' +
          '<h1>Administração</h1>' +
          '<p class="hint">Acesso restrito. Entre com uma conta de administrador.</p>' +
          '<label>E-mail</label><input id="email" type="email" autocomplete="username" placeholder="voce@email.com"/>' +
          '<label>Senha</label><div class="pw-wrap"><input id="senha" type="password" autocomplete="current-password" placeholder="••••••••"/>' +
          '<button type="button" class="pw-eye" id="verSenha" aria-label="Mostrar senha">👁️</button></div>' +
          '<div class="err" id="loginErr">' + esc(erro || '') + '</div>' +
          '<button class="btn" id="entrar" style="margin-top:14px">Entrar</button>' +
          '</div></div>';
        el('entrar').onclick = fazerLogin;
        el('senha').onkeydown = function (e) { if (e.key === 'Enter') fazerLogin(); };
        el('verSenha').onclick = function () {
          var inp = el('senha');
          var mostrar = inp.type === 'password';
          inp.type = mostrar ? 'text' : 'password';
          this.textContent = mostrar ? '🙈' : '👁️';
        };
      }
      async function fazerLogin() {
        var email = el('email').value.trim();
        var senha = el('senha').value;
        var btn = el('entrar');
        var errEl = el('loginErr');
        errEl.textContent = '';
        if (!email || !senha) { errEl.textContent = 'Preencha e-mail e senha.'; return; }
        if (email.indexOf('@') < 0) { errEl.textContent = 'Informe um e-mail válido.'; el('email').focus(); return; }
        btn.disabled = true; btn.textContent = 'Entrando…';
        try {
          var r = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email: email, senha: senha }) });
          if (!r.user || !r.user.isAdmin) {
            token = null;
            throw new Error('Esta conta não tem acesso de administrador.');
          }
          token = r.accessToken;
          await carregar();
        } catch (e) {
          var msg;
          var campos = (e.issues || []).map(function (i) { return i.path; });
          if (campos.indexOf('email') >= 0) {
            msg = 'O e-mail está vazio ou inválido — digite seu e-mail completo no 1º campo (às vezes o navegador preenche só a senha).';
          } else if (campos.indexOf('senha') >= 0) {
            msg = 'A senha está vazia — digite sua senha.';
          } else if (e.message === 'Credenciais inválidas') {
            msg = 'E-mail ou senha incorretos.';
          } else {
            msg = e.message || 'Falha ao entrar.';
          }
          errEl.textContent = msg;
          btn.disabled = false; btn.textContent = 'Entrar';
        }
      }

      // ---------- Dashboard ----------
      function chipHtml(u) {
        var cor = '#8a93a3', label = 'FREE';
        if (u.isPro && u.status === 'trial') { cor = '#38bdf8'; label = 'TESTE · ' + u.diasRestantes + 'd'; }
        else if (u.isPro) {
          cor = '#22c55e';
          var plano = u.periodo ? esc(u.periodo).toUpperCase() : esc(u.status);
          label = 'PRO ' + plano + ' · ' + u.diasRestantes + 'd';
        }
        return '<span class="chip" style="background:' + cor + '22;color:' + cor + '">' + label + '</span>';
      }
      function dataLabel(iso) {
        try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }); }
        catch (e) { return ''; }
      }

      function statCard(n, l, cor) {
        return '<div class="stat" style="background:' + cor + '14;border:1px solid ' + cor + '40">' +
          '<p class="n" style="color:' + cor + '">' + n + '</p><p class="l">' + l + '</p></div>';
      }
      function mini(n, l) { return '<div><p class="n">' + n + '</p><p class="l">' + l + '</p></div>'; }

      function pct(n, base) { return base > 0 ? Math.round((n / base) * 100) + '%' : '—'; }
      function funnelHtml(f) {
        var base = f.totalUsuarios || 1;
        function step(label, n, sub, cor) {
          var w = Math.max(6, Math.min(100, Math.round((n / base) * 100)));
          return '<div class="fstep">' +
            '<div class="fmeta"><span>' + label + '</span><b>' + n +
            (sub ? ' <i>' + sub + '</i>' : '') + '</b></div>' +
            '<div class="ftrack"><div class="ffill" style="width:' + w + '%;background:' + cor + '"></div></div>' +
            '</div>';
        }
        return '<div class="funnel"><p class="ftitle">Funil de ativação</p>' +
          step('Cadastraram', f.totalUsuarios, '', '#ff6b2b') +
          step('Viram as boas-vindas', f.onboardingVistos, pct(f.onboardingVistos, f.totalUsuarios), '#38bdf8') +
          step('Clicaram “registrar 1º preço”', f.clicaramRegistrar, pct(f.clicaramRegistrar, f.onboardingVistos), '#a78bfa') +
          step('Registraram 1º preço', f.registraramPreco, pct(f.registraramPreco, f.totalUsuarios), '#22c55e') +
          '<p class="fnote">Coorte: <b>' + f.vistosQueRegistraram + '</b> dos que viram as boas-vindas registraram preço (' +
          pct(f.vistosQueRegistraram, f.onboardingVistos) + ').</p>' +
          '</div>';
      }

      var LENTE_EMOJI = { busca: '🔎', fluxo: '🧭', cobertura: '🗺️', copy: '💬', edge: '🧪' };
      function qaCardHtml() {
        var q = state.qa;
        var corpo;
        if (state.qaLoading) {
          corpo = '<p class="fnote">Rodando sobre todos os produtos…</p>';
        } else if (!q) {
          corpo = '<p class="fnote">Varre TODOS os produtos (inclusive novos) pelas 5 lentes: busca, fluxo, cobertura, copy e edge.</p>';
        } else {
          var lentes = q.porLente.map(function (l) {
            var cor = l.problemas > 0 ? '#f59e0b' : '#22c55e';
            return '<span class="qa-lente">' + (LENTE_EMOJI[l.lente] || '') + ' ' + l.lente +
              ' <b style="color:' + cor + '">' + l.ok + '✓' + (l.problemas ? ' · ' + l.problemas + '⚠' : '') + '</b></span>';
          }).join('');
          var achados = q.achados.length
            ? '<ul class="qa-list">' + q.achados.slice(0, 60).map(function (a) {
                var cor = a.severidade === 'erro' ? '#ef4444' : '#f59e0b';
                return '<li><span style="color:' + cor + '">[' + a.lente + ']</span> ' +
                  esc(a.produtoNome) + ' — ' + esc(a.problema) + '</li>';
              }).join('') + '</ul>'
            : '<p class="fnote">Nenhum problema encontrado 🎉</p>';
          corpo =
            '<p class="qa-sum">Varreu <b>' + q.totalProdutos + '</b> produtos (' + q.comPreco +
            ' com preço) · <b style="color:' + (q.erros ? '#ef4444' : '#22c55e') + '">' + q.erros +
            ' erros</b> · ' + q.avisos + ' avisos</p>' +
            '<div class="qa-lentes">' + lentes + '</div>' + achados;
        }
        return '<div class="funnel"><p class="ftitle">QA da conversa da Nina</p>' +
          '<button id="qa-run" class="qa-run"' + (state.qaLoading ? ' disabled' : '') + '>' +
          (state.qaLoading ? 'Rodando…' : '▶ Rodar QA da conversa') + '</button>' + corpo + '</div>';
      }
      async function rodarQa() {
        state.qaLoading = true;
        renderDashboard();
        try {
          state.qa = await apiFetch('/admin/qa-conversa');
        } catch (e) {
          state.erro = e.message;
        }
        state.qaLoading = false;
        renderDashboard();
      }

      function dupsCardHtml() {
        var d = state.dups;
        var corpo;
        if (state.dupsLoading) {
          corpo = '<p class="fnote">Varrendo o catálogo…</p>';
        } else if (!d) {
          corpo = '<p class="fnote">Acha produtos iguais com nomes diferentes (ex.: "PAO PANCO 500G FORMA" e "PAO FORMA PANCO 500G U") pra você juntar.</p>';
        } else if (d.grupos.length === 0) {
          corpo = '<p class="fnote">Nenhum duplicado encontrado 🎉</p>';
        } else {
          corpo = d.grupos.map(function (g) {
            var linhas = g.produtos.map(function (p) {
              var outros = g.produtos.filter(function (x) { return x.id !== p.id; })
                .map(function (x) { return x.id; }).join(',');
              return '<div class="dup-row"><div class="dup-info"><b>' + esc(p.nome) + '</b>' +
                '<span>' + p.precos + ' preço · ' + p.mercados + ' merc</span></div>' +
                '<button class="dup-keep" data-manter="' + p.id + '" data-remover="' + outros +
                '">Manter este</button></div>';
            }).join('');
            return '<div class="dup-grp">' + linhas + '</div>';
          }).join('');
        }
        return '<div class="funnel"><p class="ftitle">Duplicados de produtos</p>' +
          '<button id="dups-run" class="qa-run"' + (state.dupsLoading ? ' disabled' : '') + '>' +
          (state.dupsLoading ? 'Varrendo…' : '🔍 Procurar duplicados') + '</button>' + corpo + '</div>';
      }
      async function rodarDups() {
        state.dupsLoading = true;
        renderDashboard();
        try {
          state.dups = await apiFetch('/admin/duplicados');
        } catch (e) {
          state.erro = e.message;
        }
        state.dupsLoading = false;
        renderDashboard();
      }
      async function juntarDup(manterId, removerIds) {
        try {
          await apiFetch('/admin/duplicados/juntar', {
            method: 'POST',
            body: JSON.stringify({ manterId: manterId, removerIds: removerIds }),
          });
          await rodarDups();
        } catch (e) {
          state.erro = e.message;
          renderDashboard();
        }
      }

      function usersFiltrados() {
        var t = state.busca.trim().toLowerCase();
        if (!t) return state.users;
        return state.users.filter(function (u) {
          return u.nome.toLowerCase().indexOf(t) >= 0 || u.email.toLowerCase().indexOf(t) >= 0;
        });
      }

      function userHtml(u) {
        var inicial = esc((u.nome.trim()[0] || '?').toUpperCase());
        var aberto = state.aberto === u.id;
        var agindo = state.agindo === u.id;
        var acts = '';
        if (aberto) {
          acts = '<div class="actions">' +
            btn(u.id, 'trial', '🎁 Teste Nina (7d)', agindo) +
            btn(u.id, 'mensal', 'Pro mensal', agindo) +
            btn(u.id, 'anual', 'Pro anual', agindo) +
            (u.isPro ? btn(u.id, 'revoke', 'Revogar', agindo) : '') +
            (u.isAdmin ? '' : btn(u.id, 'excluir', '🗑️ Excluir', agindo, true)) +
            '</div>';
        }
        return '<div class="user">' +
          '<button class="user-head" data-toggle="' + u.id + '">' +
          '<div class="avatar">' + inicial + '</div>' +
          '<div class="user-info"><p class="user-name">' + esc(u.nome) +
          (u.isAdmin ? ' <span class="tag-admin">ADMIN</span>' : '') + '</p>' +
          '<p class="user-email">' + esc(u.email) + '</p></div>' +
          '<div class="right">' + chipHtml(u) + '<span class="date">' + dataLabel(u.criadoEm) + '</span></div>' +
          '</button>' + acts + '</div>';
      }
      function btn(id, act, label, disabled, danger) {
        return '<button class="act' + (danger ? ' danger' : '') + '" data-id="' + id + '" data-act="' + act + '"' +
          (disabled ? ' disabled' : '') + '>' + label + '</button>';
      }

      function tabBtn(id, label, cur, badge) {
        return '<button class="tab' + (cur === id ? ' on' : '') + '" data-tab="' + id + '">' + label +
          (badge ? ' <span class="tab-badge">' + badge + '</span>' : '') + '</button>';
      }
      function renderDashboard() {
        var s = state.stats;
        var root = document.getElementById('root');
        var tab = state.tab;
        var abertos = state.feedbacks ? state.feedbacks.abertos : 0;
        var conteudo;
        if (tab === 'projeto') {
          conteudo = qaCardHtml() + dupsCardHtml();
        } else if (tab === 'feedbacks') {
          conteudo = feedbacksHtml();
        } else {
          conteudo = (s ? (
              '<div class="stats">' +
                statCard(s.totalUsuarios, 'Usuários', '#ff6b2b') +
                statCard(s.proAtivos, 'Pro ativos', '#22c55e') +
                statCard(s.trials, 'Em teste', '#38bdf8') +
                statCard(s.free, 'Free', '#8a93a3') +
              '</div>' +
              '<div class="mini">' + mini(s.cadastrosHoje, 'hoje') + mini(s.cadastros7d, '7 dias') +
                mini(s.cadastros30d, '30 dias') + mini(s.admins, 'admins') + '</div>'
            ) : '') +
            (state.funil ? funnelHtml(state.funil) : '') +
            '<input class="search" id="busca" placeholder="Buscar por nome ou e-mail…" value="' + esc(state.busca) + '"/>' +
            '<div id="lista"></div>';
        }
        root.innerHTML = '<div class="wrap">' +
          '<div class="top"><div><div class="brand"><img src="/Loading.png" alt=""/><b>Meu Mercado</b></div>' +
          '<div class="top-sub">Painel de administração</div></div>' +
          (abertos ? '<button class="bell" id="bell">🔔<span class="bell-badge">' + abertos + '</span></button>' : '') +
          '<button class="logout" id="sair">Sair</button></div>' +
          (state.erro ? '<div class="banner">' + esc(state.erro) + '</div>' : '') +
          '<div class="tabs">' +
            tabBtn('app', '📊 Aplicação', tab) +
            tabBtn('feedbacks', '💬 Feedbacks', tab, abertos) +
            tabBtn('projeto', '🛠️ Projeto', tab) +
          '</div>' +
          conteudo + '</div>';
        el('sair').onclick = sair;
        var bell = el('bell');
        if (bell) bell.onclick = function () { state.tab = 'feedbacks'; renderDashboard(); };
        var tabs = document.querySelectorAll('[data-tab]');
        for (var i = 0; i < tabs.length; i++) {
          tabs[i].onclick = function () { state.tab = this.getAttribute('data-tab'); renderDashboard(); };
        }
        if (tab === 'app') {
          var busca = el('busca');
          busca.oninput = function () { state.busca = busca.value; renderLista(); };
          renderLista();
        } else if (tab === 'projeto') {
          var qaBtn = el('qa-run');
          if (qaBtn) qaBtn.onclick = rodarQa;
          var dupsBtn = el('dups-run');
          if (dupsBtn) dupsBtn.onclick = rodarDups;
        }
      }
      function renderLista() {
        var lista = usersFiltrados();
        el('lista').innerHTML = lista.length
          ? lista.map(userHtml).join('')
          : '<div class="empty">Nenhum usuário encontrado.</div>';
      }

      // Delegação de eventos (toggle + ações)
      document.addEventListener('click', function (ev) {
        var head = ev.target.closest ? ev.target.closest('[data-toggle]') : null;
        if (head) {
          var id = head.getAttribute('data-toggle');
          state.aberto = state.aberto === id ? null : id;
          renderLista();
          return;
        }
        var keep = ev.target.closest ? ev.target.closest('.dup-keep') : null;
        if (keep) {
          var manter = keep.getAttribute('data-manter');
          var remover = (keep.getAttribute('data-remover') || '').split(',').filter(Boolean);
          if (
            remover.length &&
            confirm('Juntar os outros NESTE produto? Os preços são movidos e os duplicados removidos.')
          ) {
            juntarDup(manter, remover);
          }
          return;
        }
        var fbBtn = ev.target.closest ? ev.target.closest('.fb-resp') : null;
        if (fbBtn) { responderFeedback(fbBtn.getAttribute('data-id')); return; }
        var a = ev.target.closest ? ev.target.closest('.act') : null;
        if (a && !a.disabled) executarAcao(a.getAttribute('data-id'), a.getAttribute('data-act'));
      });

      async function executarAcao(id, act) {
        var u = state.users.find(function (x) { return x.id === id; });
        if (!u) return;
        if (act === 'excluir') {
          if (!confirm('Excluir ' + u.nome + ' (' + u.email + ')? Esta ação não pode ser desfeita.')) return;
          state.agindo = id; state.erro = ''; renderLista();
          try {
            await apiFetch('/admin/users/' + id, { method: 'DELETE' });
            state.users = state.users.filter(function (x) { return x.id !== id; });
            await atualizarStats();
          } catch (e) { state.erro = e.message; }
          state.agindo = null; renderDashboard();
          return;
        }
        state.agindo = id; state.erro = ''; renderLista();
        try {
          var atualizado;
          if (act === 'trial') atualizado = await apiFetch('/admin/users/' + id + '/trial', { method: 'POST' });
          else if (act === 'revoke') atualizado = await apiFetch('/admin/users/' + id + '/revoke', { method: 'POST' });
          else atualizado = await apiFetch('/admin/users/' + id + '/pro', { method: 'POST', body: JSON.stringify({ periodo: act }) });
          state.users = state.users.map(function (x) { return x.id === id ? atualizado : x; });
          await atualizarStats();
        } catch (e) { state.erro = e.message; }
        state.agindo = null; renderDashboard();
      }

      async function atualizarStats() {
        try { state.stats = await apiFetch('/admin/stats'); } catch (e) {}
      }

      function feedbacksHtml() {
        var d = state.feedbacks;
        if (!d) return '<p class="fnote">Carregando os feedbacks…</p>';
        if (!d.feedbacks.length) return '<p class="fnote">Nenhum feedback ainda.</p>';
        return d.feedbacks.map(function (f) {
          var corpo = f.status === 'respondido'
            ? '<div class="fb-answered">✓ Você respondeu: ' + esc(f.resposta) + '</div>'
            : '<div class="fb-reply"><textarea id="resp-' + f.id + '" placeholder="Escreva a resposta…"></textarea>' +
              '<button class="fb-resp" data-id="' + f.id + '">Responder</button></div>';
          return '<div class="fb' + (f.status === 'aberto' ? ' fb-open' : '') + '">' +
            '<div class="fb-head"><span class="fb-tipo">' + (FB_TIPO[f.tipo] || f.tipo) + '</span>' +
            '<span class="fb-user">' + esc(f.usuarioNome) + ' · ' + esc(f.usuarioEmail) + '</span></div>' +
            '<p class="fb-msg">' + esc(f.mensagem) + '</p>' + corpo + '</div>';
        }).join('');
      }
      async function responderFeedback(id) {
        var ta = el('resp-' + id);
        var resposta = ta ? ta.value.trim() : '';
        if (!resposta) return;
        try {
          await apiFetch('/admin/feedbacks/' + id + '/responder', {
            method: 'POST',
            body: JSON.stringify({ resposta: resposta }),
          });
          state.feedbacks = await apiFetch('/admin/feedbacks');
        } catch (e) {
          state.erro = e.message;
        }
        renderDashboard();
      }

      async function carregar() {
        document.getElementById('root').innerHTML =
          '<div class="loading"><img src="/Loading.png" alt=""/><p>Carregando o painel…</p></div>';
        try {
          var res = await Promise.all([
            apiFetch('/admin/stats'),
            apiFetch('/admin/users?limit=100'),
            apiFetch('/admin/funil').catch(function () { return null; }),
            apiFetch('/admin/feedbacks').catch(function () { return null; }),
          ]);
          state.stats = res[0];
          state.users = res[1].items;
          state.funil = res[2];
          state.feedbacks = res[3];
          renderDashboard();
        } catch (e) {
          // Já autenticado: mostra o erro no painel (não volta pro login).
          if (token) { state.erro = e.message || 'Falha ao carregar os dados.'; renderDashboard(); }
          else renderLogin(e.message || 'Falha ao carregar. Faça login novamente.');
        }
      }

      function sair() {
        token = null;
        fetch(API_BASE + '/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () {});
        renderLogin('');
      }

      // Boot: tenta usar a sessão existente (cookie de refresh); senão, login.
      (async function () {
        if (await tryRefresh()) {
          try {
            var me = await apiFetch('/auth/me');
            if (me && me.isAdmin) { return carregar(); }
          } catch (e) {}
        }
        renderLogin('');
      })();
