/* =====================================================================
   AutoCRM — Layout compartilhado e helpers de UI (ui.js)
   ===================================================================== */

(function (global) {
  'use strict';

  var CHAVE_TEMA = 'autocrm_tema';

  var NAV_ITENS = [
    { modulo: 'dashboard', href: 'dashboard.html', label: 'Dashboard', icone: 'bi-speedometer2', grupo: 'operacao' },
    { modulo: 'clientes', href: 'clientes.html', label: 'Clientes', icone: 'bi-people', grupo: 'operacao' },
    { modulo: 'ordens', href: 'ordens.html', label: 'Ordens de Serviço', icone: 'bi-clipboard2-check', grupo: 'operacao' },
    { modulo: 'financeiro', href: 'financeiro.html', label: 'Financeiro', icone: 'bi-cash-coin', grupo: 'gestao' },
    { modulo: 'estoque', href: 'estoque.html', label: 'Estoque', icone: 'bi-box-seam', grupo: 'gestao' },
    { modulo: 'usuarios', href: 'usuarios.html', label: 'Usuários', icone: 'bi-person-gear', grupo: 'gestao' }
  ];

  function escapeHTML(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function iniciais(nome) {
    var partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    var ini = partes[0][0];
    if (partes.length > 1) ini += partes[partes.length - 1][0];
    return ini.toUpperCase();
  }

  function formatarMoeda(valor) {
    var n = Number(valor);
    if (isNaN(n)) n = 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarData(iso, comHora) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var opts = comHora
      ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };
    return d.toLocaleString('pt-BR', opts);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms || 250);
    };
  }

  function preencherSelect(select, itens, opts) {
    opts = opts || {};
    var vazio = opts.placeholder ? '<option value="">' + escapeHTML(opts.placeholder) + '</option>' : '';
    select.innerHTML = vazio + itens.map(function (it) {
      return '<option value="' + escapeHTML(it.valor) + '">' + escapeHTML(it.texto) + '</option>';
    }).join('');
  }

  var LABELS_STATUS_OS = { agendado: 'Agendado', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };
  var LABELS_PAGAMENTO = { pendente: 'Pendente', parcial: 'Parcial', pago: 'Pago' };

  function badgeStatusOS(status) {
    var label = LABELS_STATUS_OS[status] || status;
    return '<span class="badge-status badge-' + escapeHTML(status) + '">' + escapeHTML(label) + '</span>';
  }
  function badgePagamento(status) {
    var label = LABELS_PAGAMENTO[status] || status;
    return '<span class="badge-status badge-' + escapeHTML(status) + '">' + escapeHTML(label) + '</span>';
  }
  function badgePerfil(perfil) {
    var label = global.AutoCRMAuth.nomePerfil(perfil);
    return '<span class="badge-status badge-perfil-' + escapeHTML(perfil) + '">' + escapeHTML(label) + '</span>';
  }

  function corCSS(nome, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || fallback;
  }

  function aplicarDefaultsChart() {
    if (!global.Chart) return;
    Chart.defaults.font.family = 'Inter, Segoe UI, system-ui, sans-serif';
    Chart.defaults.color = corCSS('--acrm-text-muted', '#a1a1aa');
    Chart.defaults.borderColor = 'rgba(127,127,127,.12)';
    if (Chart.defaults.animation && typeof Chart.defaults.animation === 'object') {
      Chart.defaults.animation.duration = 380;
    }
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.font = { size: 11 };
    Chart.defaults.maintainAspectRatio = false;
  }

  function eixoGrafico() {
    return {
      ticks: { color: corCSS('--acrm-text-muted', '#a1a1aa'), font: { size: 11 } },
      grid: { color: 'rgba(127,127,127,.12)' }
    };
  }

  function mascararTelefone(valor) {
    var d = String(valor || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 10) {
      return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, function (_, a, b, c) {
        var out = '';
        if (a) out += '(' + a;
        if (a.length === 2) out += ') ';
        if (b) out += b;
        if (c) out += '-' + c;
        return out;
      });
    }
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  }

  function linkWhatsApp(telefone) {
    var n = String(telefone || '').replace(/\D/g, '');
    if (!n) return '';
    if (n.length === 10 || n.length === 11) n = '55' + n;
    return 'https://wa.me/' + n;
  }

  function getTema() {
    try {
      var t = localStorage.getItem(CHAVE_TEMA);
      if (t === 'light' || t === 'dark') return t;
    } catch (e) { /* silencioso */ }
    return document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark';
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-bs-theme', tema);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tema === 'light' ? '#f4f6f8' : '#09090b');
    try { localStorage.setItem(CHAVE_TEMA, tema); } catch (e) { /* silencioso */ }
    var btn = document.getElementById('btnTema');
    if (btn) {
      btn.innerHTML = tema === 'light' ? '<i class="bi bi-moon-stars"></i>' : '<i class="bi bi-sun"></i>';
      btn.title = tema === 'light' ? 'Usar tema escuro' : 'Usar tema claro';
      btn.setAttribute('aria-label', btn.title);
    }
  }

  function alternarTema() {
    aplicarTema(getTema() === 'dark' ? 'light' : 'dark');
    document.documentElement.dispatchEvent(new Event('acrm-tema'));
  }

  function montarShell(opts) {
    var sessao = global.AutoCRMAuth.getSessao();
    if (!sessao) return;

    var itensPermitidos = NAV_ITENS.filter(function (item) {
      return global.AutoCRMAuth.temAcesso(sessao.perfil, item.modulo);
    });

    function linksDoGrupo(grupo) {
      return itensPermitidos.filter(function (item) { return item.grupo === grupo; }).map(function (item) {
        var ativo = item.modulo === opts.modulo ? ' ativo' : '';
        return '<a class="nav-link' + ativo + '" href="' + item.href + '"><i class="bi ' + item.icone + '"></i>' + escapeHTML(item.label) + '</a>';
      }).join('');
    }

    var linksOperacao = linksDoGrupo('operacao');
    var linksGestao = linksDoGrupo('gestao');

    var htmlSidebar =
      '<div class="sidebar-header">' +
        '<span class="brand-mark"><i class="bi bi-car-front-fill"></i></span>' +
        '<div><div class="brand-name">AutoCRM</div><div class="brand-sub">Estética automotiva</div></div>' +
      '</div>' +
      '<nav class="sidebar-nav">' +
        (linksOperacao ? '<div class="nav-section-label">Operação</div>' + linksOperacao : '') +
        (linksGestao ? '<div class="nav-section-label">Gestão</div>' + linksGestao : '') +
      '</nav>' +
      '<div class="sidebar-footer">Logado como<br><strong style="color:var(--acrm-text)">' + escapeHTML(sessao.nome) + '</strong><br>' + badgePerfil(sessao.perfil) + '</div>';

    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) sidebarEl.innerHTML = htmlSidebar;

    var htmlTopbar =
      '<div class="d-flex align-items-center gap-2 min-w-0">' +
        '<button class="btn-toggle-sidebar" type="button" id="btnAbrirSidebar" aria-label="Abrir menu"><i class="bi bi-list"></i></button>' +
        '<div class="min-w-0">' +
          '<p class="titulo-pagina text-truncate">' + escapeHTML(opts.titulo || '') + '</p>' +
          (opts.subtitulo ? '<div class="subtitulo-pagina text-truncate">' + escapeHTML(opts.subtitulo) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="d-flex align-items-center gap-2">' +
        '<button class="btn-icon" type="button" id="btnTema" title="Alternar tema" aria-label="Alternar tema"></button>' +
        '<div class="dropdown">' +
          '<button class="btn btn-sm d-flex align-items-center gap-2 border-0 bg-transparent" type="button" data-bs-toggle="dropdown" aria-expanded="false">' +
            '<span class="avatar-usuario">' + iniciais(sessao.nome) + '</span>' +
            '<span class="d-none d-sm-flex flex-column text-start">' +
              '<span class="fw-semibold" style="font-size:.85rem; color: var(--acrm-text);">' + escapeHTML(sessao.nome) + '</span>' +
              '<span class="text-muted-2" style="font-size:.72rem;">' + escapeHTML(global.AutoCRMAuth.nomePerfil(sessao.perfil)) + '</span>' +
            '</span>' +
            '<i class="bi bi-chevron-down text-muted-2"></i>' +
          '</button>' +
          '<ul class="dropdown-menu dropdown-menu-end">' +
            '<li><span class="dropdown-item-text text-muted-2" style="font-size:.78rem;">' + escapeHTML(sessao.email) + '</span></li>' +
            '<li><hr class="dropdown-divider"></li>' +
            '<li><a class="dropdown-item" href="#" id="btnSair"><i class="bi bi-box-arrow-right me-2"></i>Sair</a></li>' +
          '</ul>' +
        '</div>' +
      '</div>';

    var topbarEl = document.getElementById('topbar');
    if (topbarEl) topbarEl.innerHTML = htmlTopbar;

    document.title = (opts.titulo ? opts.titulo + ' · ' : '') + 'AutoCRM';

    var btnSair = document.getElementById('btnSair');
    if (btnSair) btnSair.addEventListener('click', function (e) { e.preventDefault(); global.AutoCRMAuth.logout(); });

    var btnAbrir = document.getElementById('btnAbrirSidebar');
    if (btnAbrir) btnAbrir.addEventListener('click', abrirSidebar);

    var btnTema = document.getElementById('btnTema');
    if (btnTema) btnTema.addEventListener('click', alternarTema);
    aplicarTema(getTema());

    garantirBackdrop();

    if (sidebarEl) {
      sidebarEl.addEventListener('click', function (e) {
        if (e.target.closest('.nav-link') && window.matchMedia('(max-width: 991px)').matches) fecharSidebar();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fecharSidebar();
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !e.target.closest('input, textarea, select')) {
        var busca = document.getElementById('campoBusca');
        if (busca) {
          e.preventDefault();
          busca.focus();
          busca.select();
        }
      }
    });

    var flash = global.AutoCRMAuth.consumirFlash();
    if (flash) toast(flash.texto, flash.tipo);

    aplicarDefaultsChart();
  }

  function garantirBackdrop() {
    if (document.getElementById('sidebarBackdrop')) return;
    var div = document.createElement('div');
    div.id = 'sidebarBackdrop';
    div.className = 'sidebar-backdrop';
    div.addEventListener('click', fecharSidebar);
    document.body.appendChild(div);
  }

  function abrirSidebar() {
    var s = document.getElementById('sidebar');
    var b = document.getElementById('sidebarBackdrop');
    if (s) s.classList.add('aberta');
    if (b) b.classList.add('mostrar');
  }
  function fecharSidebar() {
    var s = document.getElementById('sidebar');
    var b = document.getElementById('sidebarBackdrop');
    if (s) s.classList.remove('aberta');
    if (b) b.classList.remove('mostrar');
  }

  function garantirToastContainer() {
    var c = document.getElementById('toastContainer');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(c);
    return c;
  }

  var ICONES_TOAST = { success: 'bi-check-circle-fill', danger: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };

  function toast(mensagem, tipo) {
    tipo = tipo || 'info';
    var container = garantirToastContainer();
    var el = document.createElement('div');
    var classeCor = tipo === 'danger' ? 'danger' : tipo === 'success' ? 'success' : tipo === 'warning' ? 'warning' : 'info';
    el.className = 'toast align-items-center border-0 text-bg-' + classeCor;
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<div class="d-flex">' +
        '<div class="toast-body"><i class="bi ' + (ICONES_TOAST[tipo] || ICONES_TOAST.info) + ' me-2"></i>' + escapeHTML(mensagem) + '</div>' +
        '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>' +
      '</div>';
    container.appendChild(el);
    var instancia = new bootstrap.Toast(el, { delay: 4200 });
    instancia.show();
    el.addEventListener('hidden.bs.toast', function () { el.remove(); });
  }

  function confirmar(opts) {
    opts = typeof opts === 'string' ? { mensagem: opts } : (opts || {});
    return new Promise(function (resolve) {
      var idModal = 'modalConfirmar';
      var existente = document.getElementById(idModal);
      if (existente) existente.remove();

      var wrapper = document.createElement('div');
      wrapper.innerHTML =
        '<div class="modal fade" id="' + idModal + '" tabindex="-1">' +
          '<div class="modal-dialog modal-dialog-centered">' +
            '<div class="modal-content">' +
              '<div class="modal-body pt-4">' +
                '<h5 class="mb-2">' + escapeHTML(opts.titulo || 'Confirmar ação') + '</h5>' +
                '<p class="text-muted-2 mb-0">' + escapeHTML(opts.mensagem || 'Tem certeza?') + '</p>' +
              '</div>' +
              '<div class="modal-footer border-0 pt-0">' +
                '<button type="button" class="btn btn-outline-secondary" data-acao="cancelar">Cancelar</button>' +
                '<button type="button" class="btn ' + (opts.perigo === false ? 'btn-primary' : 'btn-danger') + '" data-acao="confirmar">' + escapeHTML(opts.textoConfirmar || 'Confirmar') + '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(wrapper.firstChild);

      var modalEl = document.getElementById(idModal);
      var instancia = new bootstrap.Modal(modalEl);
      var resolvido = false;

      modalEl.addEventListener('click', function (e) {
        var alvo = e.target.closest('[data-acao]');
        if (!alvo) return;
        resolvido = true;
        instancia.hide();
        resolve(alvo.getAttribute('data-acao') === 'confirmar');
      });
      modalEl.addEventListener('hidden.bs.modal', function () {
        modalEl.remove();
        if (!resolvido) resolve(false);
      });
      instancia.show();
    });
  }

  function imprimirOS(ordem, cliente, veiculo, responsavel) {
    var itens = (ordem.itens || []).map(function (it) {
      return '<tr><td>' + escapeHTML(it.nome) + '</td><td style="text-align:right">' + formatarMoeda(it.valor) + '</td></tr>';
    }).join('');
    var win = window.open('', '_blank', 'width=760,height=900');
    if (!win) {
      toast('Permita pop-ups para imprimir a ordem de serviço.', 'warning');
      return;
    }
    win.document.write(
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>OS #' + ordem.numero + '</title>' +
      '<style>body{font-family:Inter,Segoe UI,sans-serif;padding:32px;color:#111}h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:left}.muted{color:#64748b;font-size:13px}.row{display:flex;justify-content:space-between;gap:24px;margin-top:18px}</style>' +
      '</head><body>' +
      '<div class="row"><div><h1>AutoCRM · OS #' + ordem.numero + '</h1><div class="muted">Estética automotiva</div></div><div class="muted">' + formatarData(ordem.dataAgendada, true) + '</div></div>' +
      '<div class="row"><div><strong>Cliente</strong><br>' + escapeHTML(cliente ? cliente.nome : '—') + '<br class="muted">' + escapeHTML(cliente ? (cliente.telefone || '') : '') + '</div>' +
      '<div><strong>Veículo</strong><br>' + escapeHTML(veiculo ? (veiculo.marca + ' ' + veiculo.modelo) : '—') + '<br>' + escapeHTML(veiculo ? veiculo.placa : '') + '</div>' +
      '<div><strong>Responsável</strong><br>' + escapeHTML(responsavel ? responsavel.nome : '—') + '</div></div>' +
      '<table><thead><tr><th>Serviço</th><th style="text-align:right">Valor</th></tr></thead><tbody>' + itens +
      '<tr><td><strong>Total</strong></td><td style="text-align:right"><strong>' + formatarMoeda(ordem.valorTotal) + '</strong></td></tr></tbody></table>' +
      (ordem.observacoes ? '<p class="muted" style="margin-top:18px"><strong>Obs.:</strong> ' + escapeHTML(ordem.observacoes) + '</p>' : '') +
      '<p class="muted" style="margin-top:28px">Status: ' + (LABELS_STATUS_OS[ordem.status] || ordem.status) + ' · Pagamento: ' + (LABELS_PAGAMENTO[ordem.statusPagamento] || ordem.statusPagamento) + '</p>' +
      '<script>window.onload=function(){window.print();}<\/script></body></html>'
    );
    win.document.close();
  }

  try { aplicarTema(getTema()); } catch (e) { /* silencioso */ }

  global.AutoCRMUI = {
    NAV_ITENS: NAV_ITENS,
    LABELS_STATUS_OS: LABELS_STATUS_OS,
    LABELS_PAGAMENTO: LABELS_PAGAMENTO,
    escapeHTML: escapeHTML,
    iniciais: iniciais,
    formatarMoeda: formatarMoeda,
    formatarData: formatarData,
    debounce: debounce,
    preencherSelect: preencherSelect,
    badgeStatusOS: badgeStatusOS,
    badgePagamento: badgePagamento,
    badgePerfil: badgePerfil,
    montarShell: montarShell,
    abrirSidebar: abrirSidebar,
    fecharSidebar: fecharSidebar,
    toast: toast,
    confirmar: confirmar,
    mascararTelefone: mascararTelefone,
    linkWhatsApp: linkWhatsApp,
    eixoGrafico: eixoGrafico,
    corCSS: corCSS,
    imprimirOS: imprimirOS,
    aplicarTema: aplicarTema,
    getTema: getTema
  };
})(window);
