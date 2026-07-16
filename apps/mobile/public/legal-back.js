/*
 * "Voltar" das páginas jurídicas (privacidade/termos). Precisa ser um script EXTERNO:
 * a CSP do app tem `script-src-attr 'none'`, que bloqueia handlers inline (onclick="...").
 * Volta pra tela anterior (history.back) ou, se abriu direto pela URL, pro app (/).
 */
(function () {
  function voltar() {
    if (history.length > 1) history.back();
    else location.replace('/');
  }
  document.querySelectorAll('[data-back]').forEach(function (botao) {
    botao.addEventListener('click', voltar);
  });
})();
