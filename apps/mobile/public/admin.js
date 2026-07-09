      'use strict';
      var API_BASE = (location.port === '5173' ? 'http://localhost:3000' : '') + '/api';
      var token = null;
      var state = { stats: null, users: [], busca: '', aberto: null, agindo: null, erro: '' };

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
        else if (u.isPro) { cor = '#22c55e'; label = 'PRO · ' + esc(u.status); }
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

      function renderDashboard() {
        var s = state.stats;
        var root = document.getElementById('root');
        root.innerHTML = '<div class="wrap">' +
          '<div class="top"><div><div class="brand"><img src="/Loading.png" alt=""/><b>Meu Mercado</b></div>' +
          '<div class="top-sub">Painel de administração</div></div>' +
          '<button class="logout" id="sair">Sair</button></div>' +
          (state.erro ? '<div class="banner">' + esc(state.erro) + '</div>' : '') +
          (s ? (
            '<div class="stats">' +
              statCard(s.totalUsuarios, 'Usuários', '#ff6b2b') +
              statCard(s.proAtivos, 'Pro ativos', '#22c55e') +
              statCard(s.trials, 'Em teste', '#38bdf8') +
              statCard(s.free, 'Free', '#8a93a3') +
            '</div>' +
            '<div class="mini">' + mini(s.cadastrosHoje, 'hoje') + mini(s.cadastros7d, '7 dias') +
              mini(s.cadastros30d, '30 dias') + mini(s.admins, 'admins') + '</div>'
          ) : '') +
          '<input class="search" id="busca" placeholder="Buscar por nome ou e-mail…" value="' + esc(state.busca) + '"/>' +
          '<div id="lista"></div></div>';
        el('sair').onclick = sair;
        var busca = el('busca');
        busca.oninput = function () { state.busca = busca.value; renderLista(); };
        renderLista();
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

      async function carregar() {
        document.getElementById('root').innerHTML =
          '<div class="loading"><img src="/Loading.png" alt=""/><p>Carregando o painel…</p></div>';
        try {
          var res = await Promise.all([apiFetch('/admin/stats'), apiFetch('/admin/users?limit=500')]);
          state.stats = res[0];
          state.users = res[1].items;
          renderDashboard();
        } catch (e) {
          renderLogin(e.message || 'Falha ao carregar. Faça login novamente.');
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
