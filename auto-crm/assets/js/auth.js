/* =====================================================================
   AutoCRM — Autenticação e controle de acesso (auth.js)
   ---------------------------------------------------------------------
   IMPORTANTE — leia antes de usar em produção:
   Como este é um app 100% client-side (sem servidor), a "segurança"
   aqui é de conveniência, não de proteção real. As senhas são
   comparadas por hash (SHA-256) em vez de texto puro, mas todo o
   código roda no navegador do usuário: qualquer pessoa com acesso ao
   DevTools consegue ler os dados do localStorage ou forjar uma sessão.
   Isso é adequado para uso interno/demonstração em um único
   computador. Para expor isso pela internet ou usar em vários
   dispositivos com dados sensíveis de verdade, troque esta camada por
   autenticação de servidor (ex.: Supabase Auth) — ver README.md.
   ===================================================================== */

(function (global) {
  'use strict';

  var CHAVE_SESSAO = 'autocrm_sessao';
  var CHAVE_FLASH = 'autocrm_flash';

  // Quais módulos cada perfil enxerga. Ajuste livremente aqui — todo o
  // resto do app (sidebar, guarda de páginas) lê esta única fonte.
  var PERFIS = {
    admin: {
      label: 'Administrador',
      icone: 'bi-shield-lock',
      modulos: ['dashboard', 'clientes', 'ordens', 'financeiro', 'estoque', 'usuarios']
    },
    atendente: {
      label: 'Atendente',
      icone: 'bi-headset',
      modulos: ['dashboard', 'clientes', 'ordens']
    },
    financeiro: {
      label: 'Financeiro',
      icone: 'bi-cash-coin',
      modulos: ['dashboard', 'ordens', 'financeiro']
    }
  };

  function hashSimples(texto) {
    // Fallback NÃO criptográfico, usado só se o navegador não tiver
    // Web Crypto disponível (raro). Não confie nisso para segurança.
    var hash = 0;
    for (var i = 0; i < texto.length; i++) {
      hash = ((hash << 5) - hash) + texto.charCodeAt(i);
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
  }

  function suportaWebCrypto() {
    return !!(global.crypto && global.crypto.subtle && global.crypto.subtle.digest);
  }

  function hashSenha(texto) {
    if (suportaWebCrypto()) {
      var codificado = new TextEncoder().encode(texto);
      return global.crypto.subtle.digest('SHA-256', codificado).then(function (buffer) {
        return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
      }).catch(function (erro) {
        console.warn('[AutoCRM] Falha ao usar Web Crypto, usando hash alternativo.', erro);
        return hashSimples(texto);
      });
    }
    console.warn('[AutoCRM] Web Crypto indisponível neste navegador — usando hash alternativo (menos seguro).');
    return Promise.resolve(hashSimples(texto));
  }

  function getSessao() {
    try {
      var bruto = localStorage.getItem(CHAVE_SESSAO);
      return bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
      return null;
    }
  }

  function usuarioAtual() {
    var sessao = getSessao();
    if (!sessao) return null;
    return global.DB.find('usuarios', sessao.usuarioId);
  }

  function login(email, senha) {
    return hashSenha(senha).then(function (hash) {
      var emailNormalizado = String(email || '').toLowerCase().trim();
      var usuario = global.DB.all('usuarios').filter(function (u) {
        return u.email.toLowerCase() === emailNormalizado;
      })[0];

      if (!usuario) return { ok: false, erro: 'E-mail ou senha inválidos.' };
      if (!usuario.ativo) return { ok: false, erro: 'Este usuário está inativo. Fale com um administrador.' };
      if (usuario.senhaHash !== hash) return { ok: false, erro: 'E-mail ou senha inválidos.' };

      var sessao = {
        usuarioId: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        loginEm: new Date().toISOString()
      };
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
      return { ok: true, sessao: sessao };
    });
  }

  function logout() {
    localStorage.removeItem(CHAVE_SESSAO);
    window.location.href = 'index.html';
  }

  function temAcesso(perfil, modulo) {
    var def = PERFIS[perfil];
    if (!def) return false;
    if (!modulo) return true;
    return def.modulos.indexOf(modulo) !== -1;
  }

  function definirFlash(tipo, texto) {
    try {
      sessionStorage.setItem(CHAVE_FLASH, JSON.stringify({ tipo: tipo, texto: texto }));
    } catch (erro) { /* silencioso */ }
  }

  function consumirFlash() {
    try {
      var bruto = sessionStorage.getItem(CHAVE_FLASH);
      if (!bruto) return null;
      sessionStorage.removeItem(CHAVE_FLASH);
      return JSON.parse(bruto);
    } catch (erro) {
      return null;
    }
  }

  // Chame no topo de toda página protegida: AutoCRMAuth.requireAuth('clientes')
  // Sem sessão -> volta pro login. Sem permissão pro módulo -> volta pro
  // dashboard com um aviso. Retorna a sessão quando tudo certo.
  function requireAuth(modulo) {
    var sessao = getSessao();
    if (!sessao || !PERFIS[sessao.perfil]) {
      window.location.href = 'index.html';
      return null;
    }
    if (modulo && !temAcesso(sessao.perfil, modulo)) {
      definirFlash('danger', 'Você não tem permissão para acessar essa área.');
      window.location.href = 'dashboard.html';
      return null;
    }
    return sessao;
  }

  // Chame no topo da tela de login: se já tem sessão válida, pula pro dashboard.
  function redirectSeLogado() {
    var sessao = getSessao();
    if (sessao && PERFIS[sessao.perfil]) {
      window.location.href = 'dashboard.html';
      return true;
    }
    return false;
  }

  global.AutoCRMAuth = {
    PERFIS: PERFIS,
    login: login,
    logout: logout,
    getSessao: getSessao,
    usuarioAtual: usuarioAtual,
    temAcesso: temAcesso,
    requireAuth: requireAuth,
    redirectSeLogado: redirectSeLogado,
    definirFlash: definirFlash,
    consumirFlash: consumirFlash,
    hashSenha: hashSenha,
    suportaWebCrypto: suportaWebCrypto,
    nomePerfil: function (perfil) { return (PERFIS[perfil] && PERFIS[perfil].label) || perfil; }
  };
})(window);
