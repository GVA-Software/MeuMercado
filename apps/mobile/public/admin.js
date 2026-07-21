      'use strict';
      var API_BASE = (location.port === '5173' ? 'http://localhost:3000' : '') + '/api';
      var token = null;
      var state = { tab: 'app', stats: null, funil: null, feedbacks: null, fbTab: 'todos', fbStatus: '', fbSel: null, qa: null, qaLoading: false, dups: null, dupsLoading: false, cobertura: null, coberturaLoading: false, coberturaErro: '', covProdPag: 1, covProdSize: 20, covMercPag: 1, covMercSize: 20, covSel: {}, covMercSel: {}, covProdBusca: '', covMercBusca: '', covProdCat: '', users: [], busca: '', userView: 'ativos', aberto: null, agindo: null, erro: '' };
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
      function dataHora(iso) {
        try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
        catch (e) { return ''; }
      }

      function statCard(n, l, cor) {
        return '<div class="stat" style="background:' + cor + '14;border:1px solid ' + cor + '40">' +
          '<p class="n" style="color:' + cor + '">' + n + '</p><p class="l">' + l + '</p></div>';
      }
      function mini(n, l) { return '<div><p class="n">' + n + '</p><p class="l">' + l + '</p></div>'; }

      // ---------- Gráficos SVG (na mão, sem lib) — reusáveis nos dashboards ----------
      // KPI card do redesign: ícone colorido + número grande + rótulo + delta opcional.
      function kpiCard(icon, n, label, cor, sub) {
        return '<div class="kpi" style="border-color:' + cor + '33">' +
          '<div class="kpi-ico" style="background:' + cor + '22">' + icon + '</div>' +
          '<div class="kpi-body"><p class="kpi-n">' + esc(String(n)) + '</p>' +
          '<p class="kpi-l">' + esc(label) + '</p>' +
          (sub ? '<p class="kpi-s">' + sub + '</p>' : '') + '</div></div>';
      }
      // Utilitários de cor (clarear/escurecer um hex) — dão volume/profundidade aos gráficos.
      function _hex(hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
        return m ? parseInt(m[1], 16) : null;
      }
      function clarear(hex, amt) {
        var n = _hex(hex);
        if (n == null) return hex;
        amt = amt == null ? 0.3 : amt;
        var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      }
      function escurecer(hex, amt) {
        var n = _hex(hex);
        if (n == null) return hex;
        amt = amt == null ? 0.3 : amt;
        var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        r = Math.round(r * (1 - amt)); g = Math.round(g * (1 - amt)); b = Math.round(b * (1 - amt));
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      }
      var svgUid = 0;
      // Anel de progresso (saúde/cobertura %) — gradiente + brilho por trás dão profundidade.
      function svgRing(p, cor, sub) {
        p = Math.max(0, Math.min(100, p || 0));
        var circ = 2 * Math.PI * 50, off = circ * (1 - p / 100);
        var id = 'r' + (++svgUid);
        return '<svg class="ring" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">' +
          '<defs>' +
            '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0.35" y2="1">' +
              '<stop offset="0" stop-color="' + clarear(cor, 0.35) + '"/>' +
              '<stop offset="1" stop-color="' + escurecer(cor, 0.12) + '"/>' +
            '</linearGradient>' +
            '<filter id="' + id + 'b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4.5"/></filter>' +
          '</defs>' +
          '<circle cx="60" cy="60" r="50" fill="none" stroke="#252b38" stroke-width="13"/>' +
          '<circle cx="60" cy="60" r="50" fill="none" stroke="' + cor + '" stroke-width="13" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 60 60)" filter="url(#' + id + 'b)" opacity="0.6"/>' +
          '<circle cx="60" cy="60" r="50" fill="none" stroke="url(#' + id + 'g)" stroke-width="13" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 60 60)"/>' +
          '<text x="60" y="57" text-anchor="middle" font-size="27" font-weight="800" fill="#eef1f6">' + Math.round(p) + '%</text>' +
          (sub ? '<text x="60" y="78" text-anchor="middle" font-size="11" fill="#8a93a3">' + esc(sub) + '</text>' : '') +
          '</svg>';
      }
      // Rosca multi-segmento com volume: gradiente por fatia + sombra (relevo) + brilho no topo.
      function svgDonut(segs, centerTop, centerBot) {
        var total = segs.reduce(function (s, x) { return s + x.value; }, 0) || 1;
        var circ = 2 * Math.PI * 50, acc = 0;
        var id = 'd' + (++svgUid);
        var grads = '';
        var arcs = segs.map(function (seg, i) {
          var frac = seg.value / total, dash = circ * frac, off = -acc * circ;
          acc += frac;
          if (seg.value <= 0) return '';
          var gid = id + 'c' + i;
          grads += '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + clarear(seg.color, 0.28) + '"/>' +
            '<stop offset="1" stop-color="' + escurecer(seg.color, 0.2) + '"/></linearGradient>';
          return '<circle cx="60" cy="60" r="50" fill="none" stroke="url(#' + gid + ')" stroke-width="16" stroke-dasharray="' + dash.toFixed(1) + ' ' + (circ - dash).toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 60 60)"/>';
        }).join('');
        return '<svg class="ring" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">' +
          '<defs>' + grads +
            '<filter id="' + id + 's" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#000" flood-opacity="0.55"/></filter>' +
            '<linearGradient id="' + id + 'gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.4"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
          '</defs>' +
          '<g filter="url(#' + id + 's)">' +
            '<circle cx="60" cy="60" r="50" fill="none" stroke="#252b38" stroke-width="16"/>' + arcs +
          '</g>' +
          '<circle cx="60" cy="60" r="50" fill="none" stroke="url(#' + id + 'gl)" stroke-width="16"/>' +
          '<text x="60" y="55" text-anchor="middle" font-size="23" font-weight="800" fill="#eef1f6">' + esc(String(centerTop)) + '</text>' +
          '<text x="60" y="75" text-anchor="middle" font-size="10.5" fill="#8a93a3">' + esc(centerBot || '') + '</text>' +
          '</svg>';
      }
      // Linha (uma ou mais séries) — escala UNIFORME (texto/pontos nítidos, sem esticar),
      // com área em degradê, ponto marcado na ponta e rótulo de máximo pra dar escala.
      function svgLineChart(labels, series) {
        var W = 900, H = 210, pl = 12, pr = 14, ptop = 20, pb = 26;
        var todos = series.reduce(function (a, s) { return a.concat(s.values); }, [0]);
        var maxV = Math.max.apply(null, todos) || 1;
        var n = labels.length;
        var X = function (i) { return pl + (W - pl - pr) * (n <= 1 ? 0 : i / (n - 1)); };
        var Y = function (v) { return ptop + (H - ptop - pb) * (1 - v / maxV); };
        var id = 'l' + (++svgUid);
        var grid = '';
        for (var g = 0; g <= 3; g++) {
          var gy = ptop + (H - ptop - pb) * (g / 3);
          grid += '<line x1="' + pl + '" y1="' + gy.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + gy.toFixed(1) + '" stroke="#252b38" stroke-width="1"/>';
        }
        var defs = '<defs><filter id="' + id + 'sh" x="-5%" y="-25%" width="110%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/></filter>';
        var body = series.map(function (s, si) {
          if (!s.values.length) return '';
          var gid = id + 'a' + si;
          defs += '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + s.color + '" stop-opacity="0.3"/>' +
            '<stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient>';
          var d = s.values.map(function (v, i) { return (i === 0 ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
          var area = d + ' L' + X(n - 1).toFixed(1) + ' ' + Y(0).toFixed(1) + ' L' + X(0).toFixed(1) + ' ' + Y(0).toFixed(1) + ' Z';
          var lx = X(n - 1), ly = Y(s.values[n - 1]);
          return '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
            '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" filter="url(#' + id + 'sh)"/>' +
            '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="4.5" fill="' + s.color + '" stroke="#fff" stroke-opacity="0.9" stroke-width="2"/>';
        }).join('');
        defs += '</defs>';
        var xl = '';
        var passos = Math.min(5, n);
        for (var k = 0; k < passos; k++) {
          var idx = Math.round((n - 1) * (passos <= 1 ? 0 : k / (passos - 1)));
          var anchor = k === 0 ? 'start' : k === passos - 1 ? 'end' : 'middle';
          xl += '<text x="' + X(idx).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="' + anchor + '" font-size="11" fill="#8a93a3">' + esc(labels[idx] || '') + '</text>';
        }
        var maxlbl = '<text x="' + pl + '" y="13" font-size="11" fill="#6b7280">máx ' + maxV.toLocaleString('pt-BR') + '</text>';
        return '<svg class="linechart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
          defs + grid + body + maxlbl + xl + '</svg>';
      }
      // Legenda compacta em linha (rótulo + valor juntos) — não estica o número na largura.
      function legendaInline(items) {
        return '<div class="legend-inline">' + items.map(function (it) {
          return '<span class="leg-i"><span class="leg-dot" style="background:' + it.color + '"></span>' +
            esc(it.label) + ' <b>' + esc(String(it.value)) + '</b></span>';
        }).join('') + '</div>';
      }
      function legendaHtml(items) {
        return '<div class="legend">' + items.map(function (it) {
          return '<div class="leg"><span class="leg-dot" style="background:' + it.color + '"></span>' +
            '<span class="leg-l">' + esc(it.label) + '</span>' +
            '<span class="leg-v">' + esc(String(it.value)) + (it.pct != null ? ' <i>(' + it.pct + '%)</i>' : '') + '</span></div>';
        }).join('') + '</div>';
      }

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
      // Cores das tags: marcas conhecidas com a cor real; o resto ganha uma cor
      // estável (hash → paleta), pra cada mercado ter sempre a mesma.
      var MERC_COR = { ATACADAO: '#f59e0b', CARREFOUR: '#1d4ed8', ROSSI: '#16a34a', GIGA: '#dc2626',
        EBA: '#7c3aed', ASIA: '#db2777', FOCUS: '#0891b2', FRUTTO: '#65a30d', DIA: '#e11d48',
        PAODEACUCAR: '#16a34a', EXTRA: '#dc2626', ASSAI: '#ea580c', TENDA: '#2563eb' };
      var COV_PALETA = ['#0ea5e9', '#f59e0b', '#22c55e', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#6366f1'];
      function corMercado(tag) {
        var k = String(tag || '').replace(/\s+/g, '');
        if (MERC_COR[k]) return MERC_COR[k];
        var h = 0; for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
        return COV_PALETA[h % COV_PALETA.length];
      }
      function fmtDataCurta(iso) { try { return new Date(iso).toLocaleDateString('pt-BR'); } catch (e) { return ''; } }
      var CATEGORIAS = ['Graos', 'Oleos', 'Basicos', 'Bebidas', 'Laticinios', 'Padaria', 'Massas', 'Conservas', 'Carnes', 'Limpeza', 'Higiene', 'Frutas', 'Verduras', 'Legumes', 'Doces', 'Utilidades', 'Outros'];
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
      function covChip(txt, cor) {
        return '<span class="cov-chip" style="color:' + cor + ';background:' + cor + '1c;border-color:' + cor + '44">' + txt + '</span>';
      }
      function formatDiaCurto(dia) {
        var p = String(dia).split('-'); // YYYY-MM-DD
        return p.length === 3 ? p[2] + '/' + p[1] : dia;
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
        var covPct = t.produtosCatalogo > 0 ? (t.produtosComPreco / t.produtosCatalogo) * 100 : 0;
        var semPreco = t.produtosCatalogo - t.produtosComPreco;
        var completa = c.produtos.filter(function (p) { return p.mercados >= 2; }).length;
        var parcial = c.produtos.filter(function (p) { return p.mercados === 1; }).length;
        var sem = c.produtos.filter(function (p) { return p.precos === 0; }).length;
        var outros = c.produtos.filter(function (p) { return p.categoria === 'Outros'; }).length;
        var top1 = c.topUsuarios[0];
        var pc = function (n) { return t.produtosCatalogo > 0 ? Math.round((n / t.produtosCatalogo) * 100) : 0; };

        // HERO — saúde da cobertura
        var hero = '<div class="cov-hero">' +
          '<div>' + svgRing(covPct, '#22c55e', 'cobertura') + '</div>' +
          '<div class="hero-info">' +
            '<p class="hero-t">Saúde da cobertura</p>' +
            '<p class="hero-sub">' + (covPct >= 90 ? 'Excelente' : covPct >= 60 ? 'Boa' : 'Precisa crescer') + '</p>' +
            '<div class="cov-chips">' +
              covChip('✓ ' + t.produtosComPreco + ' com preço', '#22c55e') +
              (semPreco ? covChip('⚠ ' + semPreco + ' sem preço', '#f59e0b') : covChip('✓ todos com preço', '#22c55e')) +
              covChip('👥 ' + t.contribuidores + ' contribuidores', '#38bdf8') +
              (top1 ? covChip('🥇 ' + esc(top1.nome) + ' · ' + top1.cadastros, '#a78bfa') : '') +
            '</div>' +
          '</div></div>';

        // KPIs
        var kpis = '<div class="kpis">' +
          kpiCard('📦', t.produtosCatalogo, 'Produtos', '#ff6b2b') +
          kpiCard('🏪', t.mercados, 'Mercados', '#38bdf8') +
          kpiCard('🏷️', t.precos, 'Preços', '#a78bfa') +
          kpiCard('⚖️', t.produtosMultiMercado, 'Comparáveis', '#22c55e') +
        '</div>';

        // Insights (reais)
        var ins = ['Cobertura geral: <b>' + Math.round(covPct) + '%</b>.'];
        if (semPreco === 0) ins.push('Todos os produtos têm preço. 🎉');
        else if (semPreco <= 3) ins.push('Apenas <b>' + semPreco + '</b> produto(s) sem preço.');
        else ins.push('<b>' + semPreco + '</b> produtos ainda sem preço.');
        if (outros) ins.push('<b>' + outros + '</b> produtos podem ser classificados automaticamente.');
        ins.push('<b>' + completa + '</b> produtos já dá pra comparar (2+ mercados).');
        var insBox = '<div class="cov-card"><p class="cov-card-t">💡 Insights inteligentes</p>' +
          '<ul class="cov-ins">' + ins.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';

        // Evolução (gráfico de linha)
        var ev = state.covEvolucao && state.covEvolucao.pontos;
        var evoSub = '';
        if (ev && ev.length) {
          var d0 = ev[0], dN = ev[ev.length - 1];
          var dP = dN.precos - d0.precos, dPr = dN.produtos - d0.produtos;
          evoSub = '<p class="cov-card-sub">Total acumulado, dia a dia — no período a base cresceu ' +
            '<b style="color:#a78bfa">+' + dP + ' preços</b> e <b style="color:#ff6b2b">+' + dPr + ' produtos com preço</b>.</p>';
        }
        var evoBox = '<div class="cov-card"><p class="cov-card-t">📈 Evolução da cobertura</p>' +
          (ev && ev.length
            ? evoSub +
              svgLineChart(ev.map(function (p) { return formatDiaCurto(p.dia); }), [
                { values: ev.map(function (p) { return p.precos; }), color: '#a78bfa', nome: 'Preços' },
                { values: ev.map(function (p) { return p.produtos; }), color: '#ff6b2b', nome: 'Produtos' },
              ]) + legendaInline([
                { color: '#a78bfa', label: 'Preços cadastrados', value: dN.precos },
                { color: '#ff6b2b', label: 'Produtos com preço', value: dN.produtos },
              ])
            : '<p class="fnote">Sem série de evolução ainda — os preços novos vão desenhando a curva.</p>') +
          '</div>';

        // Rosca — distribuição
        var donutBox = '<div class="cov-card"><p class="cov-card-t">🍩 Distribuição da cobertura</p>' +
          '<div class="donut-wrap">' + svgDonut([
            { value: completa, color: '#22c55e' },
            { value: parcial, color: '#f59e0b' },
            { value: sem, color: '#ef4444' },
          ], t.produtosCatalogo, 'Produtos') + '</div>' +
          legendaHtml([
            { color: '#22c55e', label: 'Comparável (2+)', value: completa, pct: pc(completa) },
            { color: '#f59e0b', label: '1 mercado', value: parcial, pct: pc(parcial) },
            { color: '#ef4444', label: 'Sem preço', value: sem, pct: pc(sem) },
          ]) + '</div>';

        var grid = '<div class="cov-grid">' + evoBox + insBox + donutBox + '</div>';

        var top = c.topUsuarios.length
          ? '<ol class="cov-top">' + c.topUsuarios.slice(0, 20).map(function (u, i) {
              var pos = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + 'º';
              return '<li><span class="cov-pos">' + pos + '</span>' +
                '<span class="cov-name">' + esc(u.nome) + ' <i>' + esc(u.email) + '</i></span>' +
                '<b>' + u.cadastros + '</b></li>';
            }).join('') + '</ol>'
          : '<p class="fnote">Ninguém cadastrou preço ainda (fora a base inicial).</p>';

        // Mercados e Produtos são renderizados em boxes próprios (renderCov*Box) pra
        // permitir filtro/paginação sem re-render total — o input de busca fica FORA
        // do box, então não perde o foco enquanto digita.
        return hero + kpis + grid +
          '<div class="funnel"><p class="ftitle">🏆 Quem mais cadastra <button id="cov-refresh" class="cov-mini-btn">↻ atualizar</button></p>' + top + '</div>' +
          '<div class="funnel"><p class="ftitle">🏪 Mercados cadastrados</p>' +
            '<p class="fnote">Marque pra <b>Juntar</b> (2+, unifica a mesma loja) ou <b>Excluir</b>. Filtre por nome/endereço — vários termos separados por vírgula.</p>' +
            '<input class="cov-busca" id="cov-merc-busca" placeholder="Filtrar mercados… (ex.: carrefour, atacadao)" value="' + esc(state.covMercBusca) + '"/>' +
            '<div id="cov-merc-box"></div></div>' +
          '<div class="funnel"><p class="ftitle">📦 Produtos — cobertura</p>' +
            '<p class="fnote">Mais mercados no topo. Os <b style="color:#f59e0b">destacados</b> têm menos de 2 mercados. Filtre por texto (nome/categoria/mercado) e/ou pela categoria.</p>' +
            '<div class="cov-filtros"><input class="cov-busca" id="cov-prod-busca" placeholder="Filtrar produtos… (ex.: arroz, cafe)" value="' + esc(state.covProdBusca) + '"/>' +
            catFiltroHtml() + '</div>' +
            autoBtnHtml() +
            '<div id="cov-prod-box"></div></div>';
      }
      function autoBtnHtml() {
        var c = state.cobertura;
        if (!c) return '';
        var outros = c.produtos.filter(function (p) { return p.categoria === 'Outros'; }).length;
        if (!outros) return '';
        return '<button id="cov-auto" class="cov-auto">✨ Auto-classificar os ' + outros + ' em "Outros"</button>';
      }
      function catFiltroHtml() {
        var c = state.cobertura;
        if (!c) return '';
        var cont = {};
        c.produtos.forEach(function (p) { cont[p.categoria] = (cont[p.categoria] || 0) + 1; });
        var opts = '<option value="">Todas as categorias (' + c.produtos.length + ')</option>' +
          CATEGORIAS.filter(function (cat) { return cont[cat]; }).map(function (cat) {
            return '<option value="' + cat + '"' + (state.covProdCat === cat ? ' selected' : '') + '>' + cat + ' (' + cont[cat] + ')</option>';
          }).join('');
        return '<select class="cov-busca cov-catfiltro" id="cov-prod-cat">' + opts + '</select>';
      }
      function tagsDe(p) {
        var v = {}, arr = [];
        (p.mercadosNomes || []).forEach(function (nm) { var s = mercadoCurto(nm); if (!v[s]) { v[s] = 1; arr.push(s); } });
        return arr;
      }
      function covTermos(q) {
        return (q || '').toLowerCase().split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      }
      function covCasa(texto, ts) {
        if (!ts.length) return true;
        var low = String(texto).toLowerCase();
        return ts.some(function (t) { return low.indexOf(t) >= 0; });
      }
      function renderCovMercBox() {
        var box = el('cov-merc-box');
        var c = state.cobertura;
        if (!box || !c) return;
        var ts = covTermos(state.covMercBusca);
        var lista = c.mercados.filter(function (m) { return covCasa((m.nome || '') + ' ' + (m.endereco || ''), ts); });
        var info = pagInfo(lista.length, state.covMercPag, state.covMercSize);
        var mSel = Object.keys(state.covMercSel).length;
        box.innerHTML = (lista.length
          ? '<div class="cov-table"><div class="cov-h cov-h-m"><span></span><span>Mercado</span><span>Prod.</span><span>Preços</span></div>' +
            lista.slice(info.ini, info.fim).map(function (m) {
              return '<div class="cov-r cov-r-m">' +
                '<input type="checkbox" class="cov-mchk" data-id="' + esc(m.id) + '"' + (state.covMercSel[m.id] ? ' checked' : '') + '/>' +
                '<span class="cov-cell">' + esc(m.nome) +
                ' <button class="ed-open" data-medit="' + esc(m.id) + '" title="Editar nome/endereço">✏️</button>' +
                (m.endereco ? '<i class="cov-end">📍 ' + esc(m.endereco) + '</i>' : '<i class="cov-end cov-noend">sem endereço</i>') + '</span>' +
                '<span>' + m.produtos + '</span><span>' + m.precos + '</span></div>';
            }).join('') + '</div>'
          : '<p class="fnote">Nenhum mercado encontrado.</p>') +
          '<div class="cov-toolbar">' +
            '<button id="cov-merc-join" class="cov-join"' + (mSel >= 2 ? '' : ' disabled') + '>🔗 Juntar (' + mSel + ')</button>' +
            '<button id="cov-merc-del" class="cov-del"' + (mSel >= 1 ? '' : ' disabled') + '>🗑 Excluir (' + mSel + ')</button>' +
            sizeSelect('cov-merc-size', state.covMercSize) + pagBar('cov-merc', info, lista.length) + '</div>';
        var jn = el('cov-merc-join'); if (jn) jn.onclick = juntarMercadosUI;
        var ex = el('cov-merc-del'); if (ex) ex.onclick = excluirMercadosUI;
        wireCovPag('cov-merc', 'covMercPag', 'covMercSize', renderCovMercBox);
      }
      function renderCovProdBox() {
        var box = el('cov-prod-box');
        var c = state.cobertura;
        if (!box || !c) return;
        var ts = covTermos(state.covProdBusca);
        var lista = c.produtos.filter(function (p) {
          if (state.covProdCat && p.categoria !== state.covProdCat) return false;
          return covCasa((p.nome || '') + ' ' + (p.categoria || '') + ' ' + (p.mercadosNomes || []).join(' '), ts);
        }).sort(function (a, b) {
          return tagsDe(b).length - tagsDe(a).length || b.precos - a.precos || a.nome.localeCompare(b.nome);
        });
        var info = pagInfo(lista.length, state.covProdPag, state.covProdSize);
        var sel = covSelCount();
        var pagina = lista.slice(info.ini, info.fim);
        var todosNaPag = pagina.length > 0 && pagina.every(function (p) { return state.covSel[p.id]; });
        box.innerHTML = '<div class="cov-toolbar">' +
            '<label class="cov-selall"><input type="checkbox" id="cov-sel-all"' + (todosNaPag ? ' checked' : '') + '/> pág.</label>' +
            '<button id="cov-prod-join" class="cov-join"' + (sel >= 2 ? '' : ' disabled') + '>🔗 Juntar (' + sel + ')</button>' +
            '<button id="cov-prod-cat-btn" class="cov-catbtn"' + (sel ? '' : ' disabled') + '>🏷️ Categoria (' + sel + ')</button>' +
            '<button id="cov-del" class="cov-del"' + (sel ? '' : ' disabled') + '>🗑 Excluir (' + sel + ')</button>' +
            sizeSelect('cov-prod-size', state.covProdSize) + pagBar('cov-prod', info, lista.length) + '</div>' +
          (lista.length
            ? '<div class="cov-table"><div class="cov-h cov-h-p"><span></span><span>Produto</span><span>Merc.</span><span>Preços</span></div>' +
              pagina.map(function (p) {
                var cls = p.mercados < 2 ? 'cov-r cov-r-p low' : 'cov-r cov-r-p';
                var tags = tagsDe(p).map(function (n) {
                  var cor = corMercado(n);
                  return '<span class="cov-tag" style="background:' + cor + '22;border-color:' + cor + '66;color:' + cor + '">' + esc(n) + '</span>';
                }).join('');
                return '<div class="' + cls + '">' +
                  '<input type="checkbox" class="cov-chk" data-id="' + p.id + '"' + (state.covSel[p.id] ? ' checked' : '') + '/>' +
                  '<span class="cov-cell">' + esc(p.nome) + ' <i>' + esc(p.categoria) + '</i>' +
                    ' <button class="ed-open" data-edit="' + esc(p.id) + '" title="Editar">✏️</button>' +
                    (tags ? '<span class="cov-tags">' + tags + '</span>' : '') + '</span>' +
                  '<span>' + p.mercados + '</span><span>' + p.precos + '</span></div>';
              }).join('') + '</div>'
            : '<p class="fnote">Nenhum produto encontrado.</p>');
        var selAll = el('cov-sel-all');
        if (selAll) selAll.onclick = function () {
          var marcar = !todosNaPag; // alterna pelo estado real da página, não pelo this.checked
          pagina.forEach(function (p) { if (marcar) state.covSel[p.id] = 1; else delete state.covSel[p.id]; });
          renderCovProdBox();
        };
        var del = el('cov-del'); if (del) del.onclick = excluirCobertura;
        var pjoin = el('cov-prod-join'); if (pjoin) pjoin.onclick = juntarProdutosUI;
        var pcat = el('cov-prod-cat-btn'); if (pcat) pcat.onclick = classificarUI;
        wireCovPag('cov-prod', 'covProdPag', 'covProdSize', renderCovProdBox);
      }
      function classificarUI() {
        var ids = Object.keys(state.covSel);
        if (!ids.length) return;
        var opts = CATEGORIAS.map(function (cat) { return '<option value="' + cat + '">' + cat + '</option>'; }).join('');
        mmModal({
          title: 'Classificar ' + ids.length + ' produto(s)',
          message: 'Define a categoria de todos os selecionados de uma vez.',
          bodyHtml: '<select class="mm-select" data-mm-cat>' + opts + '</select>',
          okText: 'Aplicar',
          onOk: function (mov) {
            var cat = (mov.querySelector('[data-mm-cat]') || {}).value;
            doClassificar(ids, cat);
          },
        });
      }
      async function doClassificar(ids, categoria) {
        try {
          var r = await apiFetch('/admin/produtos/categoria', { method: 'POST', body: JSON.stringify({ ids: ids, categoria: categoria }) });
          state.covSel = {};
          toast('🏷️ ' + (r && r.classificados != null ? r.classificados : ids.length) + ' classificado(s) como ' + categoria);
          await carregarCobertura(false);
        } catch (e) {
          toast('Erro: ' + ((e && e.message) || 'falha ao classificar'));
        }
      }
      function autoClassificarUI() {
        mmModal({
          title: '✨ Auto-classificar',
          message: 'Vou definir a categoria dos produtos em "Outros" pela heurística de nome (biscoito→Doces, leite→Laticínios, sabonete→Higiene…). Só mexe nos "Outros" — não toca no que você já classificou. Os poucos ambíguos ficam em Outros pra você ajustar.',
          okText: 'Auto-classificar',
          onOk: function () { doAutoClassificar(); },
        });
      }
      async function doAutoClassificar() {
        toast('✨ Classificando…');
        try {
          var r = await apiFetch('/admin/produtos/auto-classificar', { method: 'POST' });
          var det = r && r.porCategoria
            ? Object.keys(r.porCategoria).map(function (k) { return [k, r.porCategoria[k]]; })
                .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 4)
                .map(function (e) { return e[0] + ' ' + e[1]; }).join(', ')
            : '';
          toast('✨ ' + (r && r.classificados != null ? r.classificados : '') + ' classificados' + (det ? ' — ' + det : ''));
          await carregarCobertura(false);
        } catch (e) {
          toast('Erro: ' + ((e && e.message) || 'falha ao auto-classificar'));
        }
      }
      function juntarProdutosUI() {
        var c = state.cobertura;
        if (!c) return;
        var byId = {};
        c.produtos.forEach(function (p) { byId[p.id] = p; });
        var sel = Object.keys(state.covSel).map(function (id) { return byId[id]; }).filter(Boolean);
        if (sel.length < 2) { toast('Selecione 2+ produtos pra juntar'); return; }
        var opts = sel.map(function (p) {
          return '<option value="' + esc(p.id) + '">' + esc(p.nome) + ' (' + p.precos + ' preço' + (p.precos === 1 ? '' : 's') + ')</option>';
        }).join('');
        mmModal({
          title: 'Juntar ' + sel.length + ' produtos',
          message: 'Escolha qual manter. Os preços dos outros passam pra ele e os outros são removidos. Use quando é o MESMO produto com nomes diferentes.',
          bodyHtml: '<select class="mm-select" data-mm-keep>' + opts + '</select>',
          okText: 'Juntar',
          onOk: function (mov) {
            var keep = (mov.querySelector('[data-mm-keep]') || {}).value;
            doJuntarProdutos(keep, sel.map(function (p) { return p.id; }).filter(function (x) { return x !== keep; }));
          },
        });
      }
      async function doJuntarProdutos(manterId, removerIds) {
        try {
          await apiFetch('/admin/duplicados/juntar', { method: 'POST', body: JSON.stringify({ manterId: manterId, removerIds: removerIds }) });
          state.covSel = {};
          toast('🔗 ' + (removerIds.length + 1) + ' produtos unificados');
          await carregarCobertura(false);
        } catch (e) {
          toast('Erro: ' + ((e && e.message) || 'falha ao juntar'));
        }
      }
      async function carregarCobertura(comToast) {
        state.coberturaLoading = true; state.coberturaErro = '';
        try {
          state.cobertura = await apiFetch('/admin/cobertura');
          // Série de evolução (best-effort: se falhar, o gráfico só não aparece).
          try { state.covEvolucao = await apiFetch('/admin/cobertura/evolucao?dias=30'); } catch (e) {}
          if (comToast) toast('✓ Cobertura atualizada');
        } catch (e) {
          state.coberturaErro = (e && e.message) || 'Falha ao carregar a cobertura.';
        }
        state.coberturaLoading = false;
        renderDashboard();
      }
      // Modal próprio (no tema do painel) — substitui o confirm() do navegador.
      function mmModal(opts) {
        var ov = document.createElement('div');
        ov.className = 'mm-modal-ov';
        ov.innerHTML = '<div class="mm-modal">' +
          '<h3>' + esc(opts.title) + '</h3>' +
          (opts.message ? '<p>' + esc(opts.message) + '</p>' : '') +
          (opts.bodyHtml || '') +
          '<div class="mm-modal-acts">' +
            '<button class="mm-btn-ghost" data-mm="cancel">Cancelar</button>' +
            '<button class="mm-btn ' + (opts.okClass || '') + '" data-mm="ok">' + esc(opts.okText || 'Confirmar') + '</button>' +
          '</div></div>';
        function fechar() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
        ov.addEventListener('click', function (ev) {
          var act = ev.target.getAttribute && ev.target.getAttribute('data-mm');
          if (ev.target === ov || act === 'cancel') { fechar(); return; }
          if (act === 'ok') { if (opts.onOk) opts.onOk(ov); fechar(); }
        });
        document.body.appendChild(ov);
      }
      function excluirCobertura() {
        var ids = Object.keys(state.covSel);
        if (!ids.length) return;
        mmModal({
          title: 'Excluir ' + ids.length + ' produto(s)?',
          message: 'Isso remove do catálogo e some da comparação nos apps dos usuários. Não dá pra desfazer.',
          okText: 'Excluir', okClass: 'mm-danger',
          onOk: function () { doExcluirCobertura(ids); },
        });
      }
      async function doExcluirCobertura(ids) {
        try {
          var r = await apiFetch('/admin/produtos/excluir', { method: 'POST', body: JSON.stringify({ ids: ids }) });
          state.covSel = {};
          toast('🗑 ' + (r && r.excluidos != null ? r.excluidos : ids.length) + ' produto(s) excluído(s)');
          await carregarCobertura(false);
        } catch (e) {
          toast('Erro: ' + ((e && e.message) || 'falha ao excluir'));
        }
      }
      function juntarMercadosUI() {
        var c = state.cobertura;
        if (!c) return;
        var sel = c.mercados.filter(function (m) { return state.covMercSel[m.id]; });
        if (sel.length < 2) { toast('Selecione 2+ mercados pra juntar'); return; }
        var opts = sel.map(function (m) {
          return '<option value="' + esc(m.id) + '">' + esc(m.nome) +
            (m.endereco ? ' — ' + esc(m.endereco) : ' (sem endereço)') + '</option>';
        }).join('');
        mmModal({
          title: 'Juntar ' + sel.length + ' mercados',
          message: 'Escolha qual manter. Os preços dos outros passam pra ele (o endereço é preservado).',
          bodyHtml: '<select class="mm-select" data-mm-keep>' + opts + '</select>',
          okText: 'Juntar',
          onOk: function (ov) {
            var keep = ov.querySelector('[data-mm-keep]').value;
            doJuntarMercados(keep, sel.map(function (m) { return m.id; }).filter(function (id) { return id !== keep; }));
          },
        });
      }
      async function doJuntarMercados(manterId, removerIds) {
        try {
          var r = await apiFetch('/admin/mercados/juntar', { method: 'POST', body: JSON.stringify({ manterId: manterId, removerIds: removerIds }) });
          state.covMercSel = {};
          toast('🔗 ' + (r && r.mercados != null ? r.mercados : removerIds.length) + ' mercado(s) unificado(s)');
          await carregarCobertura(false);
        } catch (e) {
          toast('Erro: ' + ((e && e.message) || 'falha ao juntar'));
        }
      }
      function excluirMercadosUI() {
        var ids = Object.keys(state.covMercSel);
        if (!ids.length) return;
        mmModal({
          title: 'Excluir ' + ids.length + ' mercado(s)?',
          message: 'Apaga TODOS os preços desses mercados — some da comparação nos apps. Os produtos ficam no catálogo, mas perdem essa cobertura. Não dá pra desfazer.',
          okText: 'Excluir', okClass: 'mm-danger',
          onOk: function () { doExcluirMercados(ids); },
        });
      }
      async function doExcluirMercados(ids) {
        try {
          var r = await apiFetch('/admin/mercados/excluir', { method: 'POST', body: JSON.stringify({ ids: ids }) });
          state.covMercSel = {};
          var msg = '🗑 ' + (r && r.mercados != null ? r.mercados : ids.length) + ' mercado(s)';
          if (r && r.precos != null) msg += ' e ' + r.precos + ' preço(s)';
          toast(msg + ' excluído(s)');
          await carregarCobertura(false);
        } catch (e) {
          toast('Erro: ' + ((e && e.message) || 'falha ao excluir'));
        }
      }
      // Editar nome/endereço de um mercado (mudar o endereço recoloca no mapa).
      function editarMercadoUI(id) {
        var c = state.cobertura;
        var m = c && c.mercados.filter(function (x) { return x.id === id; })[0];
        if (!m) { toast('Mercado não encontrado — recarregue a lista'); return; }
        mmModal({
          title: '✏️ Editar mercado',
          message: 'Corrija o nome e/ou o endereço. Mudar o endereço recoloca o mercado no mapa (recalcula a localização).',
          bodyHtml:
            '<label>Nome</label><input class="mm-select" data-mm-nome value="' + esc(m.nome) + '"/>' +
            '<label>Endereço</label><input class="mm-select" data-mm-end value="' + esc(m.endereco || '') + '" placeholder="Rua, número, bairro, cidade, UF"/>',
          okText: 'Salvar',
          onOk: function (mov) {
            var nome = ((mov.querySelector('[data-mm-nome]') || {}).value || '').trim();
            var endereco = ((mov.querySelector('[data-mm-end]') || {}).value || '').trim();
            if (!nome) { toast('Informe o nome'); return; }
            doEditarMercado(id, nome, endereco || null);
          },
        });
      }
      async function doEditarMercado(id, nome, endereco) {
        try {
          await apiFetch('/admin/mercados/editar', {
            method: 'POST',
            body: JSON.stringify({ mercadoId: id, nome: nome, endereco: endereco }),
          });
          toast('✓ Mercado salvo'); carregarCobertura(false);
        } catch (e) { toast('Erro: ' + ((e && e.message) || 'falha')); }
      }
      // Editor de produto (nome/categoria) + seus reportes de preço (corrigir/excluir).
      function abrirEditorProduto(id) {
        var ov = document.createElement('div');
        ov.className = 'mm-modal-ov';
        ov.innerHTML = '<div class="mm-modal ed-modal"><h3>✏️ Editar produto</h3>' +
          '<div id="ed-body"><p class="fnote">Carregando…</p></div>' +
          '<div class="mm-modal-acts"><button class="mm-btn-ghost" data-ed="close">Fechar</button></div></div>';
        var recarregar = false;
        var dados = null;
        function fechar() {
          if (ov.parentNode) ov.parentNode.removeChild(ov);
          if (recarregar) carregarCobertura(false);
        }
        function pintar() {
          var cats = CATEGORIAS.map(function (cat) {
            return '<option value="' + cat + '"' + (cat === dados.categoria ? ' selected' : '') + '>' + cat + '</option>';
          }).join('');
          var precos = dados.precos.length ? dados.precos.map(function (pr) {
            return '<div class="ed-preco"><div class="ed-preco-top"><b>' + esc(pr.mercadoNome) + '</b>' +
              '<span>' + fmtDataCurta(pr.observedAt) + '</span></div>' +
              '<div class="ed-preco-bot"><span class="ed-rs">R$</span>' +
              '<input type="number" step="0.01" min="0" class="ed-val" id="edval-' + esc(pr.id) + '" value="' + (pr.precoCents / 100).toFixed(2) + '"/>' +
              '<button class="ed-mini" data-ed="save-preco" data-pid="' + esc(pr.id) + '">Salvar</button>' +
              '<button class="ed-mini ed-danger" data-ed="del-preco" data-pid="' + esc(pr.id) + '">🗑</button></div>' +
              '<button class="ed-split-link" data-ed="split-preco" data-pid="' + esc(pr.id) + '">↗ Separar em produto novo (gramatura diferente)</button></div>';
          }).join('') : '<p class="fnote">Sem reportes de preço.</p>';
          el('ed-body').innerHTML =
            '<label>Nome</label><input class="mm-select" id="ed-nome" value="' + esc(dados.nome) + '"/>' +
            '<label>Categoria</label><select class="mm-select" id="ed-cat">' + cats + '</select>' +
            '<button class="mm-btn ed-full" data-ed="save-prod">Salvar produto</button>' +
            '<div class="ed-sep">Reportes de preço</div>' + precos;
        }
        async function fetchDados() {
          try {
            dados = await apiFetch('/admin/produtos/' + encodeURIComponent(id) + '/edicao');
            pintar();
          } catch (e) {
            el('ed-body').innerHTML = '<p class="fnote" style="color:#ef4444">' + esc((e && e.message) || 'Falha ao carregar.') + '</p>';
          }
        }
        async function salvarProduto() {
          var nome = (el('ed-nome').value || '').trim();
          if (!nome) { toast('Informe o nome'); return; }
          try {
            await apiFetch('/admin/produtos/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ nome: nome, categoria: el('ed-cat').value }) });
            recarregar = true; toast('✓ Produto salvo');
          } catch (e) { toast('Erro: ' + ((e && e.message) || 'falha')); }
        }
        async function salvarPreco(pid) {
          var inp = el('edval-' + pid);
          if (!inp) return;
          var cents = Math.round(parseFloat(inp.value) * 100);
          if (!(cents > 0)) { toast('Valor inválido'); return; }
          try {
            await apiFetch('/admin/precos/' + encodeURIComponent(pid), { method: 'PATCH', body: JSON.stringify({ precoCents: cents }) });
            recarregar = true; toast('✓ Preço corrigido'); await fetchDados();
          } catch (e) { toast('Erro: ' + ((e && e.message) || 'falha')); }
        }
        function armarExcluir(btn) {
          var pid = btn.getAttribute('data-pid');
          if (btn.getAttribute('data-armed') !== '1') {
            btn.setAttribute('data-armed', '1'); btn.textContent = 'Excluir?';
            setTimeout(function () { if (btn.getAttribute('data-armed') === '1') { btn.removeAttribute('data-armed'); btn.textContent = '🗑'; } }, 2500);
            return;
          }
          doExcluirPreco(pid);
        }
        async function doExcluirPreco(pid) {
          try {
            await apiFetch('/admin/precos/' + encodeURIComponent(pid), { method: 'DELETE' });
            recarregar = true; toast('🗑 Reporte excluído'); await fetchDados();
          } catch (e) { toast('Erro: ' + ((e && e.message) || 'falha')); }
        }
        function separarUI(pid) {
          mmModal({
            title: '↗ Separar em produto novo',
            message: 'Este reporte vira um produto separado (use quando gramaturas diferentes ficaram juntas). Nome do novo produto:',
            bodyHtml: '<input class="mm-select" data-mm-nome value="' + esc(dados.nome) + '"/>',
            okText: 'Separar',
            onOk: function (mov) {
              var nome = ((mov.querySelector('[data-mm-nome]') || {}).value || '').trim();
              if (!nome) { toast('Informe o nome'); return; }
              doSepararPreco(pid, nome);
            },
          });
        }
        async function doSepararPreco(pid, nome) {
          try {
            await apiFetch('/admin/precos/' + encodeURIComponent(pid) + '/separar', { method: 'POST', body: JSON.stringify({ nome: nome }) });
            recarregar = true; toast('↗ Separado em novo produto'); await fetchDados();
          } catch (e) { toast('Erro: ' + ((e && e.message) || 'falha')); }
        }
        ov.addEventListener('click', function (ev) {
          var t = ev.target;
          var acao = t.getAttribute && t.getAttribute('data-ed');
          if (t === ov || acao === 'close') { fechar(); return; }
          if (acao === 'save-prod') salvarProduto();
          else if (acao === 'save-preco') salvarPreco(t.getAttribute('data-pid'));
          else if (acao === 'del-preco') armarExcluir(t);
          else if (acao === 'split-preco') separarUI(t.getAttribute('data-pid'));
        });
        document.body.appendChild(ov);
        fetchDados();
      }
      function wireCovPag(prefix, pagKey, sizeKey, rerender) {
        var fn = rerender || renderDashboard;
        var sz = el(prefix + '-size');
        if (sz) sz.onchange = function () { state[sizeKey] = parseInt(this.value, 10) || 20; state[pagKey] = 1; fn(); };
        var pv = el(prefix + '-prev');
        if (pv) pv.onclick = function () { state[pagKey] = Math.max(1, state[pagKey] - 1); fn(); };
        var nx = el(prefix + '-next');
        if (nx) nx.onclick = function () { state[pagKey] = state[pagKey] + 1; fn(); };
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
        var verExcluidos = state.userView === 'excluidos';
        return state.users.filter(function (u) {
          if (verExcluidos !== !!u.excluidoEm) return false; // aba Ativos vs Excluídos
          if (!t) return true;
          return u.nome.toLowerCase().indexOf(t) >= 0 || u.email.toLowerCase().indexOf(t) >= 0;
        });
      }
      function uviewBtn(id, label) {
        var on = (state.userView || 'ativos') === id;
        return '<button data-uview="' + id + '" style="flex:1;padding:9px;border-radius:8px;border:1px solid ' +
          (on ? '#ff6b2b' : '#2a2f3a') + ';background:' + (on ? '#ff6b2b' : 'transparent') + ';color:' +
          (on ? '#fff' : '#8a93a3') + ';font-weight:700;font-size:13px;cursor:pointer">' + label + '</button>';
      }

      function userHtml(u) {
        var inicial = esc((u.nome.trim()[0] || '?').toUpperCase());
        var aberto = state.aberto === u.id;
        var agindo = state.agindo === u.id;
        var acts = '';
        if (aberto) {
          var consent = u.politicaVersao
            ? '<p style="color:#9aa3b2;font-size:11.5px;margin:0 0 8px">✓ Aceitou a Política/Termos <b>v' + esc(u.politicaVersao) + '</b> em ' + esc(dataHora(u.criadoEm)) + ' (no cadastro)</p>'
            : '<p style="color:#9aa3b2;font-size:11.5px;margin:0 0 8px">Consentimento não registrado (cadastro anterior à política).</p>';
          acts = consent + '<div class="actions">' +
            btn(u.id, 'trial', '🎁 Teste Nina (7d)', agindo) +
            btn(u.id, 'mensal', 'Pro mensal', agindo) +
            btn(u.id, 'anual', 'Pro anual', agindo) +
            (u.isPro ? btn(u.id, 'revoke', 'Revogar', agindo) : '') +
            (u.isAdmin || u.excluidoEm ? '' : btn(u.id, 'excluir', '🗑️ Excluir', agindo, true)) +
            '</div>';
        }
        var tagExcl = u.excluidoEm
          ? ' <span style="background:#7f1d1d;color:#fecaca;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px">EXCLUÍDO</span>'
          : '';
        var linhaExcl = u.excluidoEm
          ? '<p style="color:#f87171;font-size:11px;margin:2px 0 0">🗑️ excluído em ' + esc(dataHora(u.excluidoEm)) + '</p>'
          : '';
        return '<div class="user"' + (u.excluidoEm ? ' style="opacity:.75"' : '') + '>' +
          '<button class="user-head" data-toggle="' + u.id + '">' +
          '<div class="avatar">' + inicial + '</div>' +
          '<div class="user-info"><p class="user-name">' + esc(u.nome) +
          (u.isAdmin ? ' <span class="tag-admin">ADMIN</span>' : '') + tagExcl + '</p>' +
          '<p class="user-email">' + esc(u.email) + '</p>' + linhaExcl + '</div>' +
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
      function ninaHtml() {
        if (state.ninaErro) return '<div class="funnel"><p class="fnote" style="color:#ef4444">' + esc(state.ninaErro) + '</p><button class="cov-btn" id="nina-refresh">Tentar de novo</button></div>';
        var d = state.nina;
        if (!d || state.ninaLoading) return '<div class="funnel"><p class="fnote">Carregando o treino da Nina…</p></div>';
        var sem = d.semResposta || [], sins = d.sinonimos || [];
        var rowStyle = 'border:1px solid #252b3a;border-radius:10px;padding:10px 12px;margin:6px 0;background:#161a23';
        var inpStyle = 'flex:1;min-width:110px;padding:7px 9px;border-radius:8px;border:1px solid #252b3a;background:#0d0f14;color:#e8eaed;font-size:13px';
        var btnStyle = 'padding:7px 12px;border-radius:8px;border:none;background:#ff6b2b;color:#fff;font-weight:700;cursor:pointer;font-size:13px';
        var listaSem = sem.length ? sem.map(function (q) {
          return '<div style="' + rowStyle + '">' +
            '<div style="margin-bottom:6px"><b>' + esc(q.pergunta) + '</b> <i style="color:#8a93a3;font-style:normal">— ' + q.vezes + '×' + (q.usuarios ? ' · ' + q.usuarios + ' usuário' + (q.usuarios === 1 ? '' : 's') : '') + '</i></div>' +
            '<div style="display:flex;gap:6px;align-items:center">' +
              '<input class="nina-canon" style="' + inpStyle + '" placeholder="buscar como… (ex.: refrigerante)"/>' +
              '<button class="nina-ensinar" data-alias="' + esc(q.pergunta) + '" style="' + btnStyle + '">Ensinar</button>' +
            '</div></div>';
        }).join('') : '<p class="fnote">Nenhuma pergunta sem resposta ainda 🎉 (a Nina registra aqui quando não entende algo).</p>';
        var listaSin = sins.length ? sins.map(function (s) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;' + rowStyle + '">' +
            '<span><b>' + esc(s.alias) + '</b> → ' + esc(s.canonico) + '</span>' +
            '<button class="nina-esquecer" data-alias="' + esc(s.alias) + '" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px">✕</button></div>';
        }).join('') : '<p class="fnote">Nenhum sinônimo ensinado ainda.</p>';
        var recs = d.receitas || [];
        var listaRec = recs.length ? recs.map(function (r) {
          return '<div style="' + rowStyle + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
              '<span><b>' + esc(r.nome) + '</b> <i style="color:#8a93a3;font-style:normal">— gatilhos: ' + esc((r.gatilhos || []).join(', ')) + '</i></span>' +
              '<button class="nina-esq-rec" data-nome="' + esc(r.nome) + '" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px">✕</button></div>' +
            '<div style="color:#8a93a3;font-size:12px;margin-top:4px">🛒 ' + esc((r.itens || []).join(', ')) + '</div></div>';
        }).join('') : '<p class="fnote">Nenhuma receita ensinada ainda (a Nina já tem várias embutidas: churrasco, bolo, feijoada…).</p>';
        var fullInp = inpStyle + ';width:100%;box-sizing:border-box;margin-bottom:6px';
        var formRec = '<div style="' + rowStyle + '">' +
          '<input id="rec-nome" style="' + fullInp + '" placeholder="Nome (ex.: sushi)"/>' +
          '<input id="rec-gat" style="' + fullInp + '" placeholder="Gatilhos, por vírgula (ex.: sushi, temaki)"/>' +
          '<input id="rec-itens" style="' + fullInp + '" placeholder="Itens, por vírgula (ex.: arroz, alga nori, salmão, shoyu)"/>' +
          '<button id="rec-salvar" style="' + btnStyle + '">Salvar receita</button></div>';
        return '<div class="funnel">' +
          '<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">🧡 Treino da Nina</h3><button class="cov-btn" id="nina-refresh">↻ Atualizar</button></div>' +
          '<p class="fnote">Quando a Nina não entende, a pergunta aparece aqui. Ensine o que ela deve buscar (o sinônimo) e ela passa a entender <b>na hora</b>.</p>' +
          '<h4 style="margin:12px 0 4px">Perguntas sem resposta (mais frequentes)</h4>' + listaSem +
          '<h4 style="margin:16px 0 4px">Sinônimos ensinados</h4>' + listaSin +
          '<h4 style="margin:16px 0 4px">🍳 Receitas ensinadas (evento → lista de compras)</h4>' + listaRec +
          '<h4 style="margin:14px 0 4px">Nova receita</h4>' + formRec +
        '</div>';
      }
      async function carregarNina(force) {
        if (state.ninaLoading) return;
        if (state.nina && !force) return;
        state.ninaLoading = true; state.ninaErro = ''; renderDashboard();
        try { state.nina = await apiFetch('/admin/nina'); }
        catch (e) { state.ninaErro = (e && e.message) || 'Falha ao carregar o treino.'; }
        state.ninaLoading = false; renderDashboard();
      }
      async function ensinarSinonimoUI() {
        var alias = this.getAttribute('data-alias');
        var input = this.parentNode.querySelector('.nina-canon');
        var canonico = input ? input.value.trim() : '';
        if (!canonico) { if (input) input.focus(); return; }
        this.disabled = true; this.textContent = '…';
        try {
          await apiFetch('/admin/nina/sinonimos', { method: 'POST', body: JSON.stringify({ alias: alias, canonico: canonico }) });
          state.nina = null; carregarNina(true);
        } catch (e) { this.disabled = false; this.textContent = 'Ensinar'; state.ninaErro = (e && e.message) || 'Erro ao ensinar.'; renderDashboard(); }
      }
      async function esquecerSinonimoUI() {
        var alias = this.getAttribute('data-alias');
        try {
          await apiFetch('/admin/nina/sinonimos/' + encodeURIComponent(alias), { method: 'DELETE' });
          state.nina = null; carregarNina(true);
        } catch (e) { state.ninaErro = (e && e.message) || 'Erro ao remover.'; renderDashboard(); }
      }
      function csv(id) {
        var v = (el(id) && el(id).value) || '';
        return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      }
      async function ensinarReceitaUI() {
        var nomeEl = el('rec-nome');
        var nome = nomeEl ? nomeEl.value.trim() : '';
        var gat = csv('rec-gat'), itens = csv('rec-itens');
        if (!nome || !gat.length || !itens.length) { state.ninaErro = 'Preencha nome, gatilhos e itens.'; renderDashboard(); return; }
        this.disabled = true; this.textContent = '…';
        try {
          await apiFetch('/admin/nina/receitas', { method: 'POST', body: JSON.stringify({ nome: nome, gatilhos: gat, itens: itens }) });
          state.nina = null; carregarNina(true);
        } catch (e) { this.disabled = false; this.textContent = 'Salvar receita'; state.ninaErro = (e && e.message) || 'Erro ao salvar.'; renderDashboard(); }
      }
      async function esquecerReceitaUI() {
        var nome = this.getAttribute('data-nome');
        try {
          await apiFetch('/admin/nina/receitas/' + encodeURIComponent(nome), { method: 'DELETE' });
          state.nina = null; carregarNina(true);
        } catch (e) { state.ninaErro = (e && e.message) || 'Erro ao remover.'; renderDashboard(); }
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
        } else if (tab === 'nina') {
          conteudo = ninaHtml();
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
            '<div style="display:flex;gap:6px;margin:2px 0 10px">' +
              uviewBtn('ativos', 'Ativos') +
              uviewBtn('excluidos', 'Excluídos (' + state.users.filter(function (u) { return u.excluidoEm; }).length + ')') +
            '</div>' +
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
            tabBtn('nina', '🧡 Nina', tab) +
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
          var uv = document.querySelectorAll('[data-uview]');
          for (var k = 0; k < uv.length; k++) {
            uv[k].onclick = function () { state.userView = this.getAttribute('data-uview'); renderDashboard(); };
          }
          renderLista();
        } else if (tab === 'projeto') {
          var qaBtn = el('qa-run');
          if (qaBtn) qaBtn.onclick = rodarQa;
          var dupsBtn = el('dups-run');
          if (dupsBtn) dupsBtn.onclick = rodarDups;
        } else if (tab === 'cobertura') {
          var covBtn = el('cov-refresh');
          if (covBtn) covBtn.onclick = function () { carregarCobertura(true); };
          var mb = el('cov-merc-busca');
          if (mb) mb.oninput = function () { state.covMercBusca = mb.value; state.covMercPag = 1; renderCovMercBox(); };
          var pb = el('cov-prod-busca');
          if (pb) pb.oninput = function () { state.covProdBusca = pb.value; state.covProdPag = 1; renderCovProdBox(); };
          var pcat = el('cov-prod-cat');
          if (pcat) pcat.onchange = function () { state.covProdCat = pcat.value; state.covProdPag = 1; renderCovProdBox(); };
          var autoB = el('cov-auto');
          if (autoB) autoB.onclick = autoClassificarUI;
          renderCovMercBox();
          renderCovProdBox();
          if (!state.cobertura && !state.coberturaLoading) carregarCobertura();
        } else if (tab === 'nina') {
          var nr = el('nina-refresh');
          if (nr) nr.onclick = function () { carregarNina(true); };
          var ens = document.querySelectorAll('.nina-ensinar');
          for (var e1 = 0; e1 < ens.length; e1++) ens[e1].onclick = ensinarSinonimoUI;
          var esq = document.querySelectorAll('.nina-esquecer');
          for (var e2 = 0; e2 < esq.length; e2++) esq[e2].onclick = esquecerSinonimoUI;
          var salvarRec = el('rec-salvar');
          if (salvarRec) salvarRec.onclick = ensinarReceitaUI;
          var esqRec = document.querySelectorAll('.nina-esq-rec');
          for (var e3 = 0; e3 < esqRec.length; e3++) esqRec[e3].onclick = esquecerReceitaUI;
          if (!state.nina && !state.ninaLoading) carregarNina();
        }
      }
      function renderLista() {
        var lista = usersFiltrados();
        el('lista').innerHTML = lista.length
          ? lista.map(userHtml).join('')
          : '<div class="empty">Nenhum usuário encontrado.</div>';
      }

      // Delegação de eventos (toggle + ações)
      // Checkboxes da Cobertura: atualizam a seleção sem re-render (mantêm o scroll).
      document.addEventListener('change', function (ev) {
        var t = ev.target;
        if (!t || !t.classList) return;
        if (t.classList.contains('cov-chk')) {
          var pid = t.getAttribute('data-id');
          if (t.checked) state.covSel[pid] = 1; else delete state.covSel[pid];
          var n = covSelCount();
          var del = document.getElementById('cov-del');
          if (del) { del.disabled = n === 0; del.textContent = '🗑 Excluir (' + n + ')'; }
          var pj = document.getElementById('cov-prod-join');
          if (pj) { pj.disabled = n < 2; pj.textContent = '🔗 Juntar (' + n + ')'; }
          var pcb = document.getElementById('cov-prod-cat-btn');
          if (pcb) { pcb.disabled = n === 0; pcb.textContent = '🏷️ Categoria (' + n + ')'; }
        } else if (t.classList.contains('cov-mchk')) {
          var mid = t.getAttribute('data-id');
          if (t.checked) state.covMercSel[mid] = 1; else delete state.covMercSel[mid];
          var m = Object.keys(state.covMercSel).length;
          var jn = document.getElementById('cov-merc-join');
          if (jn) { jn.disabled = m < 2; jn.textContent = '🔗 Juntar (' + m + ')'; }
          var mex = document.getElementById('cov-merc-del');
          if (mex) { mex.disabled = m < 1; mex.textContent = '🗑 Excluir (' + m + ')'; }
        }
      });

      document.addEventListener('click', function (ev) {
        var edBtn = ev.target.closest ? ev.target.closest('[data-edit]') : null;
        if (edBtn) { abrirEditorProduto(edBtn.getAttribute('data-edit')); return; }
        var medBtn = ev.target.closest ? ev.target.closest('[data-medit]') : null;
        if (medBtn) { editarMercadoUI(medBtn.getAttribute('data-medit')); return; }
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
        var fbT = ev.target.closest ? ev.target.closest('[data-fbtab]') : null;
        if (fbT) { state.fbTab = fbT.getAttribute('data-fbtab'); state.fbSel = null; renderDashboard(); return; }
        var fbS = ev.target.closest ? ev.target.closest('[data-fbstatus]') : null;
        if (fbS) { state.fbStatus = fbS.getAttribute('data-fbstatus'); state.fbSel = null; renderDashboard(); return; }
        var fbC = ev.target.closest ? ev.target.closest('[data-fbsel]') : null;
        if (fbC) { var fid = fbC.getAttribute('data-fbsel'); state.fbSel = (state.fbSel === fid ? null : fid); renderDashboard(); return; }
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

      // ---------- Feedbacks: dashboard (KPIs + gráficos + abas + detalhe) ----------
      // Tudo derivado de GET /admin/feedbacks (lista inteira + abertos). Zero backend novo.
      var FB_COR = { bug: '#ef4444', sugestao: '#a78bfa', elogio: '#22c55e', outro: '#38bdf8' };
      function fbDiaKey(dt) {
        return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
      }
      // Duração humana curta (min/h/d). null → '—'.
      function fmtDur(ms) {
        if (ms == null || isNaN(ms)) return '—';
        var min = Math.round(ms / 60000);
        if (min < 1) return 'agora';
        if (min < 60) return min + 'min';
        var h = min / 60;
        if (h < 48) return Math.round(h) + 'h';
        return Math.round(h / 24) + 'd';
      }
      function tempoRel(iso) {
        if (!iso) return '';
        var dt = new Date() - new Date(iso);
        return dt >= 0 ? 'há ' + fmtDur(dt) : '';
      }
      // Estatísticas determinísticas (pendentes vem do backend p/ bater com o sininho).
      function fbStats(list) {
        var respondidos = 0, bugs = 0, bugsAbertos = 0, elogios = 0, somaMs = 0, nResp = 0;
        list.forEach(function (f) {
          if (f.status === 'respondido') {
            respondidos++;
            if (f.respondidoEm && f.criadoEm) {
              var dt = new Date(f.respondidoEm) - new Date(f.criadoEm);
              if (dt >= 0) { somaMs += dt; nResp++; }
            }
          }
          if (f.tipo === 'bug') { bugs++; if (f.status === 'aberto') bugsAbertos++; }
          if (f.tipo === 'elogio') elogios++;
        });
        return {
          total: list.length,
          respondidos: respondidos,
          pendentes: state.feedbacks ? state.feedbacks.abertos : (list.length - respondidos),
          bugs: bugs, bugsAbertos: bugsAbertos,
          tempoMedioMs: nResp ? somaMs / nResp : null,
          pctElogio: list.length ? Math.round((elogios / list.length) * 100) : 0,
        };
      }
      // Série CUMULATIVA por dia (últimos N): recebidos (criadoEm) × respondidos (respondidoEm).
      // A distância entre as curvas = fila esperando resposta. Semeia com os anteriores à janela.
      function fbSeriePorDia(list, dias) {
        dias = dias || 30;
        var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        var inicio = new Date(hoje); inicio.setDate(hoje.getDate() - (dias - 1));
        var labels = [], rec = [], resp = [], idx = {};
        for (var i = 0; i < dias; i++) {
          var dd = new Date(inicio); dd.setDate(inicio.getDate() + i);
          var k = fbDiaKey(dd);
          idx[k] = i; labels.push(formatDiaCurto(k)); rec.push(0); resp.push(0);
        }
        var recBase = 0, respBase = 0;
        list.forEach(function (f) {
          if (f.criadoEm) {
            var c = new Date(f.criadoEm);
            if (!isNaN(c)) { if (c < inicio) recBase++; else { var kc = fbDiaKey(c); if (kc in idx) rec[idx[kc]]++; } }
          }
          if (f.respondidoEm) {
            var r = new Date(f.respondidoEm);
            if (!isNaN(r)) { if (r < inicio) respBase++; else { var kr = fbDiaKey(r); if (kr in idx) resp[idx[kr]]++; } }
          }
        });
        rec[0] += recBase; resp[0] += respBase;
        for (var j = 1; j < dias; j++) { rec[j] += rec[j - 1]; resp[j] += resp[j - 1]; }
        return { labels: labels, rec: rec, resp: resp };
      }
      function fbPorTipo(list) {
        var ordem = ['bug', 'sugestao', 'elogio', 'outro'];
        var cont = { bug: 0, sugestao: 0, elogio: 0, outro: 0 };
        list.forEach(function (f) { if (cont[f.tipo] != null) cont[f.tipo]++; else cont.outro++; });
        var segs = ordem.map(function (t) { return { value: cont[t], color: FB_COR[t] }; });
        var itens = ordem.map(function (t) {
          return { color: FB_COR[t], label: FB_TIPO[t], value: cont[t], pct: list.length ? Math.round((cont[t] / list.length) * 100) : 0 };
        });
        return { segs: segs, itens: itens, cont: cont };
      }
      function fbFiltrada(list) {
        var t = state.fbTab || 'todos', st = state.fbStatus || '';
        return list.filter(function (f) {
          if (t !== 'todos' && f.tipo !== t) return false;
          if (st && f.status !== st) return false;
          return true;
        });
      }
      // Resumo inteligente = agregação determinística (sem LLM, sem API paga).
      function fbResumo(st, cont) {
        var out = [];
        out.push(st.pendentes > 0
          ? '<b>' + st.pendentes + '</b> feedback(s) aguardando sua resposta.'
          : 'Tudo respondido. 🎉');
        if (st.tempoMedioMs != null) out.push('Responde em média em <b>' + fmtDur(st.tempoMedioMs) + '</b>.');
        if (cont.bug > 0) out.push('<b>' + cont.bug + '</b> bug(s) reportado(s)' + (st.bugsAbertos ? ' — <b>' + st.bugsAbertos + '</b> em aberto' : '') + '.');
        if (cont.sugestao > 0) out.push('<b>' + cont.sugestao + '</b> ideia(s)/sugestão(ões) dos usuários.');
        if (st.total > 0) out.push('<b>' + st.pctElogio + '%</b> dos feedbacks são elogios. ❤️');
        return out;
      }
      function fbTabBtn(id, label, n) {
        var on = (state.fbTab || 'todos') === id;
        return '<button class="fb-aba' + (on ? ' on' : '') + '" data-fbtab="' + id + '">' + label +
          ' <span class="fb-aba-n">' + n + '</span></button>';
      }
      function fbStatusBtn(id, label) {
        var on = (state.fbStatus || '') === id;
        return '<button class="fb-st' + (on ? ' on' : '') + '" data-fbstatus="' + id + '">' + label + '</button>';
      }
      // Timeline determinística: 2 marcos reais (enviado → respondido/aguardando).
      function fbDetalheHtml(f) {
        var delta = (f.status === 'respondido' && f.respondidoEm && f.criadoEm)
          ? fmtDur(new Date(f.respondidoEm) - new Date(f.criadoEm)) : null;
        var timeline = '<div class="fb-tl">' +
          '<div class="fb-tl-i"><span class="fb-tl-dot" style="background:#38bdf8"></span>' +
            '<div class="fb-tl-b"><b>Enviado</b><i>' + dataHora(f.criadoEm) + '</i></div></div>' +
          (f.status === 'respondido'
            ? '<div class="fb-tl-i"><span class="fb-tl-dot" style="background:#22c55e"></span>' +
              '<div class="fb-tl-b"><b>Respondido</b><i>' + dataHora(f.respondidoEm) + (delta ? ' · em ' + delta : '') + '</i></div></div>'
            : '<div class="fb-tl-i"><span class="fb-tl-dot" style="background:#f59e0b"></span>' +
              '<div class="fb-tl-b"><b>Aguardando resposta</b><i>' + tempoRel(f.criadoEm) + '</i></div></div>') +
          '</div>';
        var corpo = f.status === 'respondido'
          ? '<div class="fb-answered">✓ Você respondeu: ' + esc(f.resposta) + '</div>'
          : '<div class="fb-reply"><textarea id="resp-' + f.id + '" placeholder="Escreva a resposta…"></textarea>' +
            '<button class="fb-resp" data-id="' + f.id + '">Responder</button></div>';
        return '<p class="fb-msg-full">' + esc(f.mensagem) + '</p>' + timeline + corpo;
      }
      function fbCard(f) {
        var sel = state.fbSel === f.id;
        var badge = '<span class="fb-badge ' + (f.status === 'aberto' ? 'op' : 'ok') + '">' +
          (f.status === 'aberto' ? 'Aberto' : 'Respondido') + '</span>';
        var head = '<div class="fb-head"><span class="fb-tipo">' + (FB_TIPO[f.tipo] || esc(f.tipo)) + '</span>' +
          '<span class="fb-user">' + esc(f.usuarioNome) + ' · ' + esc(f.usuarioEmail) + '</span>' +
          '<span class="fb-when">' + tempoRel(f.criadoEm) + '</span>' + badge + '</div>';
        if (!sel) {
          return '<div class="fb fb-clik' + (f.status === 'aberto' ? ' fb-open' : '') + '" data-fbsel="' + f.id + '">' +
            head + '<p class="fb-msg fb-clamp">' + esc(f.mensagem) + '</p></div>';
        }
        return '<div class="fb fb-sel' + (f.status === 'aberto' ? ' fb-open' : '') + '">' +
          '<div class="fb-clik" data-fbsel="' + f.id + '">' + head + '</div>' + fbDetalheHtml(f) + '</div>';
      }
      function feedbacksHtml() {
        var d = state.feedbacks;
        if (!d) return '<p class="fnote">Carregando os feedbacks…</p>';
        var list = d.feedbacks;
        var st = fbStats(list);
        var header = '<div class="fb-topbar"><div class="fb-hl">' +
          '<h2 class="fb-h2">Feedbacks dos usuários</h2>' +
          '<span class="fb-hsub">' + st.total + ' no total · ' + st.pendentes + ' aguardando</span></div>' +
          '<button class="test-email"' + (state.emailTesting ? ' disabled' : '') + '>' +
          (state.emailTesting ? 'Enviando…' : '✉️ Testar e-mail') + '</button></div>' +
          (state.emailMsg ? '<p class="email-msg ' + (state.emailErro ? 'err' : 'ok') + '">' + esc(state.emailMsg) + '</p>' : '');

        if (!list.length) return header + '<p class="fnote">Nenhum feedback ainda — quando alguém enviar, aparece aqui.</p>';

        var kpis = '<div class="kpis3">' +
          kpiCard('💬', st.total, 'Feedbacks', '#ff6b2b') +
          kpiCard('⏳', st.pendentes, 'Pendentes', '#f59e0b') +
          kpiCard('✅', st.respondidos, 'Respondidos', '#22c55e') +
          kpiCard('🐛', st.bugs, 'Bugs', '#ef4444', st.bugsAbertos ? st.bugsAbertos + ' em aberto' : 'nenhum aberto') +
          kpiCard('⏱️', fmtDur(st.tempoMedioMs), 'Resposta média', '#38bdf8', st.respondidos ? 'de ' + st.respondidos + ' resp.' : 'sem resposta ainda') +
          kpiCard('❤️', st.pctElogio + '%', 'Elogios', '#ec4899') +
          '</div>';

        var serie = fbSeriePorDia(list, 30);
        var evoBox = '<div class="cov-card"><p class="cov-card-t">📈 Feedbacks ao longo do tempo</p>' +
          '<p class="cov-card-sub">Acumulado nos últimos 30 dias — a distância entre as curvas é a fila esperando resposta.</p>' +
          svgLineChart(serie.labels, [
            { values: serie.rec, color: '#ff6b2b', nome: 'Recebidos' },
            { values: serie.resp, color: '#22c55e', nome: 'Respondidos' },
          ]) + legendaInline([
            { color: '#ff6b2b', label: 'Recebidos', value: st.total },
            { color: '#22c55e', label: 'Respondidos', value: st.respondidos },
          ]) + '</div>';

        var pt = fbPorTipo(list);
        var insBox = '<div class="cov-card"><p class="cov-card-t">💡 Resumo</p>' +
          '<ul class="cov-ins">' + fbResumo(st, pt.cont).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
        var donutBox = '<div class="cov-card"><p class="cov-card-t">🍩 Distribuição por tipo</p>' +
          '<div class="donut-wrap">' + svgDonut(pt.segs, st.total, 'feedbacks') + '</div>' +
          legendaHtml(pt.itens) + '</div>';
        var grid = '<div class="cov-grid">' + evoBox + insBox + donutBox + '</div>';

        var abas = '<div class="fb-abas">' +
          fbTabBtn('todos', 'Todos', list.length) +
          fbTabBtn('bug', FB_TIPO.bug, pt.cont.bug) +
          fbTabBtn('sugestao', FB_TIPO.sugestao, pt.cont.sugestao) +
          fbTabBtn('elogio', FB_TIPO.elogio, pt.cont.elogio) +
          fbTabBtn('outro', FB_TIPO.outro, pt.cont.outro) +
          '</div>';
        var statusBar = '<div class="fb-status">' +
          fbStatusBtn('', 'Todos') + fbStatusBtn('aberto', 'Abertos') + fbStatusBtn('respondido', 'Respondidos') +
          '</div>';

        var filtrada = fbFiltrada(list);
        var listaHtml = filtrada.length
          ? filtrada.map(fbCard).join('')
          : '<p class="fnote">Nenhum feedback neste filtro.</p>';

        return header + kpis + grid +
          '<div class="fb-filtros">' + abas + statusBar + '</div>' +
          '<div class="fb-lista">' + listaHtml + '</div>';
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
