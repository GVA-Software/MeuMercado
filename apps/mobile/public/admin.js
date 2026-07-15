      'use strict';
      var API_BASE = (location.port === '5173' ? 'http://localhost:3000' : '') + '/api';
      var token = null;
      var state = { tab: 'app', stats: null, funil: null, feedbacks: null, qa: null, qaLoading: false, dups: null, dupsLoading: false, cobertura: null, coberturaLoading: false, coberturaErro: '', covProdPag: 1, covProdSize: 20, covMercPag: 1, covMercSize: 20, covSel: {}, users: [], busca: '', aberto: null, agindo: null, erro: '' };
      var FB_TIPO = { bug: '🐛 Bug', sugestao: '💡 Sugestão', elogio: '❤️ Elogio', outro: '💬 Outro' };

      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      function el(id) { return document.getElementById(id); }

      async function apiFetch(path, opts) {
        opts = opts || {};
        // Timeout de segurança: nenhuma chamada do painel pode ficar pendurada.
        var ctrl = new AbortController();
        var to = setTimeout(function () { ctrl.abort(); }, 25000);
        var res;
        try {
          res = await fetch(API_BASE + path, {
            method: opts.method || 'GET',
            credentials: 'include',
            headers: Object.assign(
              { 'content-type': 'application/json' },
              token ? { authorization: 'Bearer ' + token } : {},
              opts.headers || {}
            ),
            body: opts.body,
            signal: ctrl.signal,
          });
        } catch (e) {
          clearTimeout(to);
          throw new Error(
            e && e.name === 'AbortError'
              ? 'Sem resposta do servidor (timeout). Tente de novo.'
              : (e && e.message) || 'Falha de rede.'
          );
        }
        clearTimeout(to);
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
      // Cold start do Render: enquanto o servidor sobe (~30-50s), mostra a NOSSA tela
      // de "acordando" em vez de deixar o painel vazio / cair no login.
      function renderAcordando() {
        document.getElementById('root').innerHTML =
          '<div class="login"><div class="login-card" style="text-align:center">' +
          '<div class="brand" style="justify-content:center">' +
          '<img src="/Loading.png" alt="" style="animation:mmpulse 1.1s ease-in-out infinite"/><b>Meu Mercado</b></div>' +
          '<h1>Acordando o servidor…</h1>' +
          '<p class="hint">A primeira abertura do dia leva uns segundos. Já já carrega. 🛒</p>' +
          '<style>@keyframes mmpulse{0%,100%{opacity:.45;transform:scale(.95)}50%{opacity:1;transform:scale(1)}}</style>' +
          '</div></div>';
      }
      function renderBootErro() {
        document.getElementById('root').innerHTML =
          '<div class="login"><div class="login-card" style="text-align:center">' +
          '<div class="brand" style="justify-content:center"><img src="/Loading.png" alt=""/><b>Meu Mercado</b></div>' +
          '<h1>Servidor indisponível</h1>' +
          '<p class="hint">Ele pode estar iniciando. Toque pra tentar de novo.</p>' +
          '<button class="btn" id="retry" style="margin-top:14px">Tentar de novo</button>' +
          '</div></div>';
        el('retry').onclick = boot;
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

      // ---------- Cobertura (produtos × mercados + contribuidores) ----------
      // Encurta o nome legal do mercado para virar uma tag limpa (ex.:
      // "CARREFOUR COMERCIO E INDUSTRIA LTDA" -> "CARREFOUR").
      var COV_STOP = { COMERCIO: 1, COM: 1, INDUSTRIA: 1, IND: 1, LTDA: 1, LTD: 1, ME: 1, EPP: 1,
        EIRELI: 1, SA: 1, DE: 1, DA: 1, DO: 1, DOS: 1, DAS: 1, E: 1, EM: 1, GERAL: 1, VAREJO: 1,
        VAREJISTA: 1, SUPERMERCADO: 1, SUPERMERCADOS: 1, MERCADO: 1, MERCADINHO: 1, ATACADO: 1,
        ATACADISTA: 1, NEW: 1, DISTRIBUIDORA: 1, VARIEDADES: 1 };
      function mercadoCurto(nome) {
        var toks = String(nome || '').toUpperCase().split(/[\s.,/]+/).filter(function (x) { return x && !COV_STOP[x]; });
        return toks.slice(0, 2).join(' ') || String(nome || '').trim() || '—';
      }
      function covSelCount() { return Object.keys(state.covSel).length; }
      function pagInfo(total, pag, size) {
        var paginas = Math.max(1, Math.ceil(total / size));
        var p = Math.min(Math.max(1, pag), paginas);
        var ini = (p - 1) * size;
        return { p: p, paginas: paginas, ini: ini, fim: Math.min(ini + size, total) };
      }
      function sizeSelect(id, size) {
        return '<select id="' + id + '" class="cov-size">' + [20, 30, 40, 50].map(function (n) {
          return '<option value="' + n + '"' + (n === size ? ' selected' : '') + '>' + n + '/pág</option>';
        }).join('') + '</select>';
      }
      function pagBar(prefix, info, total) {
        return '<span class="cov-pag">' + (total ? info.ini + 1 + '–' + info.fim : 0) + ' de ' + total +
          ' <button class="cov-pg" id="' + prefix + '-prev"' + (info.p <= 1 ? ' disabled' : '') + '>‹</button>' +
          '<b class="cov-pgn">' + info.p + '/' + info.paginas + '</b>' +
          '<button class="cov-pg" id="' + prefix + '-next"' + (info.p >= info.paginas ? ' disabled' : '') + '>›</button></span>';
      }
      function coberturaHtml() {
        if (state.coberturaErro) {
          return '<div class="funnel"><p class="fnote" style="color:#ef4444">' + esc(state.coberturaErro) + '</p>' +
            '<button id="cov-refresh" class="qa-run">↻ Tentar de novo</button></div>';
        }
        var c = state.cobertura;
        if (!c || state.coberturaLoading) {
          return '<div class="funnel"><p class="fnote">Carregando cobertura…</p></div>';
        }
        var t = c.totais;
        var cards = '<div class="stats">' +
            statCard(t.produtosCatalogo, 'Produtos', '#ff6b2b') +
            statCard(t.mercados, 'Mercados', '#38bdf8') +
            statCard(t.precos, 'Preços', '#a78bfa') +
            statCard(t.produtosMultiMercado, 'Comparáveis', '#22c55e') +
          '</div>' +
          '<div class="mini">' + mini(t.produtosComPreco, 'com preço') +
            mini(t.produtosCatalogo - t.produtosComPreco, 'sem preço') +
            mini(t.contribuidores, 'contribuidores') + '</div>';

        var top = c.topUsuarios.length
          ? '<ol class="cov-top">' + c.topUsuarios.slice(0, 20).map(function (u, i) {
              var pos = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + 'º';
              return '<li><span class="cov-pos">' + pos + '</span>' +
                '<span class="cov-name">' + esc(u.nome) + ' <i>' + esc(u.email) + '</i></span>' +
                '<b>' + u.cadastros + '</b></li>';
            }).join('') + '</ol>'
          : '<p class="fnote">Ninguém cadastrou preço ainda (fora a base inicial).</p>';

        // Mercados: endereço abaixo do nome + paginação.
        var mInfo = pagInfo(c.mercados.length, state.covMercPag, state.covMercSize);
        var merc = c.mercados.length
          ? '<div class="cov-table"><div class="cov-h cov-h-m"><span>Mercado</span><span>Prod.</span><span>Preços</span></div>' +
            c.mercados.slice(mInfo.ini, mInfo.fim).map(function (m) {
              return '<div class="cov-r cov-r-m"><span class="cov-cell">' + esc(m.nome) +
                (m.endereco ? '<i class="cov-end">📍 ' + esc(m.endereco) + '</i>' : '') + '</span>' +
                '<span>' + m.produtos + '</span><span>' + m.precos + '</span></div>';
            }).join('') + '</div>' +
            '<div class="cov-toolbar">' + sizeSelect('cov-merc-size', state.covMercSize) + pagBar('cov-merc', mInfo, c.mercados.length) + '</div>'
          : '<p class="fnote">Nenhum mercado com preço ainda.</p>';

        // Produtos: tags de mercado, seleção/exclusão, paginação.
        var pInfo = pagInfo(c.produtos.length, state.covProdPag, state.covProdSize);
        var sel = covSelCount();
        var barra = '<div class="cov-toolbar">' +
          '<label class="cov-selall"><input type="checkbox" id="cov-sel-all"/> pág.</label>' +
          '<button id="cov-del" class="cov-del"' + (sel ? '' : ' disabled') + '>🗑 Excluir (' + sel + ')</button>' +
          sizeSelect('cov-prod-size', state.covProdSize) + pagBar('cov-prod', pInfo, c.produtos.length) + '</div>';
        var rows = c.produtos.slice(pInfo.ini, pInfo.fim).map(function (p) {
          var cls = p.mercados < 2 ? 'cov-r cov-r-p low' : 'cov-r cov-r-p';
          var vistas = {};
          var tags = (p.mercadosNomes || []).map(mercadoCurto).filter(function (n) {
            if (vistas[n]) return false; vistas[n] = 1; return true;
          }).map(function (n) { return '<span class="cov-tag">' + esc(n) + '</span>'; }).join('');
          return '<div class="' + cls + '">' +
            '<input type="checkbox" class="cov-chk" data-id="' + p.id + '"' + (state.covSel[p.id] ? ' checked' : '') + '/>' +
            '<span class="cov-cell">' + esc(p.nome) + ' <i>' + esc(p.categoria) + '</i>' +
              (tags ? '<span class="cov-tags">' + tags + '</span>' : '') + '</span>' +
            '<span>' + p.mercados + '</span><span>' + p.precos + '</span></div>';
        }).join('');
        var prod = '<div class="cov-table"><div class="cov-h cov-h-p"><span></span><span>Produto</span><span>Merc.</span><span>Preços</span></div>' + rows + '</div>';

        return cards +
          '<div class="funnel"><p class="ftitle">🏆 Quem mais cadastra <button id="cov-refresh" class="cov-mini-btn">↻ atualizar</button></p>' + top + '</div>' +
          '<div class="funnel"><p class="ftitle">🏪 Mercados cadastrados</p>' + merc + '</div>' +
          '<div class="funnel"><p class="ftitle">📦 Produtos — cobertura</p>' +
            '<p class="fnote">Ordenados por cobertura mais rasa. Os <b style="color:#f59e0b">destacados</b> têm menos de 2 mercados. Marque e exclua os que forem lixo — some do catálogo e da comparação nos apps.</p>' +
            barra + prod + '</div>';
      }
      async function carregarCobertura(comToast) {
        state.coberturaLoading = true; state.coberturaErro = '';
        try {
          state.cobertura = await apiFetch('/admin/cobertura');
          if (comToast) toast('✓ Cobertura atualizada');
        } catch (e) {
          state.coberturaErro = (e && e.message) || 'Falha ao carregar a cobertura.';
        }
        state.coberturaLoading = false;
        renderDashboard();
      }
      async function excluirCobertura() {
        var ids = Object.keys(state.covSel);
        if (!ids.length) return;
        if (!confirm('Excluir ' + ids.length + ' produto(s)?\n\nIsso remove do catálogo e some da comparação nos apps dos usuários. Não dá pra desfazer.')) return;
        var btn = el('cov-del');
        if (btn) { btn.disabled = true; btn.textContent = 'Excluindo…'; }
        try {
          var r = await apiFetch('/admin/produtos/excluir', { method: 'POST', body: JSON.stringify({ ids: ids }) });
          state.covSel = {};
          toast('🗑 ' + (r && r.excluidos != null ? r.excluidos : ids.length) + ' produto(s) excluído(s)');
          await carregarCobertura(false);
        } catch (e) {
          toast('Erro: ' + ((e && e.message) || 'falha ao excluir'));
          renderDashboard();
        }
      }
      function wireCovPag(prefix, pagKey, sizeKey) {
        var sz = el(prefix + '-size');
        if (sz) sz.onchange = function () { state[sizeKey] = parseInt(this.value, 10) || 20; state[pagKey] = 1; renderDashboard(); };
        var pv = el(prefix + '-prev');
        if (pv) pv.onclick = function () { state[pagKey] = Math.max(1, state[pagKey] - 1); renderDashboard(); };
        var nx = el(prefix + '-next');
        if (nx) nx.onclick = function () { state[pagKey] = state[pagKey] + 1; renderDashboard(); };
      }
      function toast(msg) {
        var old = document.getElementById('mm-toast');
        if (old) old.parentNode.removeChild(old);
        var d = document.createElement('div');
        d.id = 'mm-toast'; d.className = 'mm-toast'; d.textContent = msg;
        document.body.appendChild(d);
        setTimeout(function () { d.className = 'mm-toast out'; }, 1800);
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2200);
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
        } else if (tab === 'cobertura') {
          conteudo = coberturaHtml();
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
            tabBtn('cobertura', '📦 Cobertura', tab) +
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
        } else if (tab === 'cobertura') {
          var covBtn = el('cov-refresh');
          if (covBtn) covBtn.onclick = function () { carregarCobertura(true); };
          var delBtn = el('cov-del');
          if (delBtn) delBtn.onclick = excluirCobertura;
          var selAll = el('cov-sel-all');
          if (selAll) selAll.onclick = function () {
            var c = state.cobertura;
            if (c) {
              var info = pagInfo(c.produtos.length, state.covProdPag, state.covProdSize);
              var marcar = this.checked;
              c.produtos.slice(info.ini, info.fim).forEach(function (p) {
                if (marcar) state.covSel[p.id] = 1; else delete state.covSel[p.id];
              });
            }
            renderDashboard();
          };
          wireCovPag('cov-prod', 'covProdPag', 'covProdSize');
          wireCovPag('cov-merc', 'covMercPag', 'covMercSize');
          if (!state.cobertura && !state.coberturaLoading) carregarCobertura();
        }
      }
      function renderLista() {
        var lista = usersFiltrados();
        el('lista').innerHTML = lista.length
          ? lista.map(userHtml).join('')
          : '<div class="empty">Nenhum usuário encontrado.</div>';
      }

      // Delegação de eventos (toggle + ações)
      // Checkbox de produto na Cobertura: atualiza a seleção sem re-render (mantém o scroll).
      document.addEventListener('change', function (ev) {
        var chk = ev.target;
        if (!chk || !chk.classList || !chk.classList.contains('cov-chk')) return;
        var pid = chk.getAttribute('data-id');
        if (chk.checked) state.covSel[pid] = 1; else delete state.covSel[pid];
        var del = document.getElementById('cov-del');
        if (del) {
          var n = covSelCount();
          del.disabled = n === 0;
          del.textContent = '🗑 Excluir (' + n + ')';
        }
      });

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
        if (ev.target.closest && ev.target.closest('.test-email')) { testarEmail(); return; }
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
        var topo = '<div class="email-test">' +
          '<button class="test-email"' + (state.emailTesting ? ' disabled' : '') + '>' +
          (state.emailTesting ? 'Enviando…' : '✉️ Testar envio de e-mail') + '</button>' +
          (state.emailMsg ? '<p class="email-msg' + (state.emailErro ? ' err' : ' ok') + '">' +
            esc(state.emailMsg) + '</p>' : '') +
          '</div>';
        var lista;
        if (!d) lista = '<p class="fnote">Carregando os feedbacks…</p>';
        else if (!d.feedbacks.length) lista = '<p class="fnote">Nenhum feedback ainda.</p>';
        else lista = d.feedbacks.map(function (f) {
          var corpo = f.status === 'respondido'
            ? '<div class="fb-answered">✓ Você respondeu: ' + esc(f.resposta) + '</div>'
            : '<div class="fb-reply"><textarea id="resp-' + f.id + '" placeholder="Escreva a resposta…"></textarea>' +
              '<button class="fb-resp" data-id="' + f.id + '">Responder</button></div>';
          return '<div class="fb' + (f.status === 'aberto' ? ' fb-open' : '') + '">' +
            '<div class="fb-head"><span class="fb-tipo">' + (FB_TIPO[f.tipo] || f.tipo) + '</span>' +
            '<span class="fb-user">' + esc(f.usuarioNome) + ' · ' + esc(f.usuarioEmail) + '</span></div>' +
            '<p class="fb-msg">' + esc(f.mensagem) + '</p>' + corpo + '</div>';
        }).join('');
        return topo + lista;
      }
      async function testarEmail() {
        state.emailTesting = true;
        state.emailMsg = null;
        renderDashboard();
        try {
          var r = await apiFetch('/admin/test-email', { method: 'POST' });
          state.emailMsg = r.mensagem;
          state.emailErro = false;
        } catch (e) {
          state.emailMsg = e.message;
          state.emailErro = true;
        }
        state.emailTesting = false;
        renderDashboard();
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

      // Boot resiliente ao cold start do Render: rede/5xx = servidor frio → mostra
      // "acordando…" e re-tenta com backoff (NÃO é login). 401/403 = sem sessão → login.
      // Esgotou as tentativas → "tentar de novo" (nunca deixa a página vazia/quebrada).
      async function boot() {
        var MAX = 12; // ~1 min de folga pro servidor subir
        for (var i = 0; i < MAX; i++) {
          try {
            var r = await fetch(API_BASE + '/auth/refresh', {
              method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
            });
            if (r.status === 401 || r.status === 403) { renderLogin(''); return; }
            if (!r.ok) throw new Error('cold-' + r.status);
            var b = await r.json();
            token = b.accessToken;
            var me = await apiFetch('/auth/me');
            if (me && me.isAdmin) { return carregar(); }
            renderLogin('Esta conta não é administradora.');
            return;
          } catch (e) {
            renderAcordando();
            await new Promise(function (res) { setTimeout(res, Math.min(2000 + i * 800, 6000)); });
          }
        }
        renderBootErro();
      }
      boot();
