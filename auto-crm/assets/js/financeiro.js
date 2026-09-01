/* =====================================================================
   AutoCRM — Financeiro (financeiro.js)
   ===================================================================== */

(function () {
  'use strict';

  var sessao = AutoCRMAuth.requireAuth('financeiro');
  if (!sessao) return;
  DB.init();
  AutoCRMUI.montarShell({ modulo: 'financeiro', titulo: 'Financeiro', subtitulo: 'Receitas, despesas e contas a receber' });

  var modalLancamento = new bootstrap.Modal(document.getElementById('modalLancamento'));
  var modalPagamentoFin = new bootstrap.Modal(document.getElementById('modalPagamentoFin'));
  var campoBusca = document.getElementById('campoBusca');
  var filtroTipo = document.getElementById('filtroTipo');
  var filtroPeriodo = document.getElementById('filtroPeriodo');

  var hoje = new Date();
  var inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  var chartReceitaDespesa = null;
  var chartCategorias = null;

  function nomeCliente(id) { var c = DB.find('clientes', id); return c ? c.nome : 'Cliente removido'; }
  function paraDataInput(d) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // --------------------------------------------------------------- cards

  function montarCards() {
    var lancamentos = DB.all('lancamentos');
    var ordens = DB.all('ordens');

    var receitasMes = lancamentos.filter(function (l) { return l.tipo === 'receita' && new Date(l.data) >= inicioMes; }).reduce(function (s, l) { return s + l.valor; }, 0);
    var despesasMes = lancamentos.filter(function (l) { return l.tipo === 'despesa' && new Date(l.data) >= inicioMes; }).reduce(function (s, l) { return s + l.valor; }, 0);
    var saldoMes = receitasMes - despesasMes;

    var ordensAReceber = ordens.filter(function (o) { return o.status !== 'cancelado' && o.statusPagamento !== 'pago'; });
    var valorAReceber = ordensAReceber.reduce(function (s, o) { return s + Math.max(0, o.valorTotal - DB.totalPagoOrdem(o.id)); }, 0);

    var cards = [
      { label: 'Receitas do mês', valor: AutoCRMUI.formatarMoeda(receitasMes), icone: 'bi-graph-up-arrow', tint: 'success' },
      { label: 'Despesas do mês', valor: AutoCRMUI.formatarMoeda(despesasMes), icone: 'bi-graph-down-arrow', tint: 'danger' },
      { label: 'Saldo do mês', valor: AutoCRMUI.formatarMoeda(saldoMes), icone: 'bi-wallet2', tint: saldoMes >= 0 ? 'success' : 'danger' },
      { label: 'A receber', valor: AutoCRMUI.formatarMoeda(valorAReceber), icone: 'bi-hourglass-split', tint: 'warning' }
    ];

    document.getElementById('cardsFinanceiro').innerHTML = cards.map(function (c) {
      return '<div class="col-sm-6 col-xl-3"><div class="stat-card">' +
        '<span class="stat-icon icon-tint-' + c.tint + '"><i class="bi ' + c.icone + '"></i></span>' +
        '<div class="stat-valor">' + c.valor + '</div>' +
        '<div class="stat-label">' + c.label + '</div>' +
      '</div></div>';
    }).join('');
  }

  // --------------------------------------------------------------- gráficos

  var eixoEscuro = AutoCRMUI.eixoGrafico();

  function ultimosMeses(n) {
    var arr = [];
    for (var i = n - 1; i >= 0; i--) {
      var dm = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      arr.push({ ano: dm.getFullYear(), mes: dm.getMonth(), label: dm.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') });
    }
    return arr;
  }

  function desenharGraficoReceitaDespesa() {
    var lancamentos = DB.all('lancamentos');
    var meses = ultimosMeses(6);
    var receitas = meses.map(function (m) {
      return lancamentos.filter(function (l) { var d = new Date(l.data); return l.tipo === 'receita' && d.getFullYear() === m.ano && d.getMonth() === m.mes; }).reduce(function (s, l) { return s + l.valor; }, 0);
    });
    var despesas = meses.map(function (m) {
      return lancamentos.filter(function (l) { var d = new Date(l.data); return l.tipo === 'despesa' && d.getFullYear() === m.ano && d.getMonth() === m.mes; }).reduce(function (s, l) { return s + l.valor; }, 0);
    });

    if (chartReceitaDespesa) chartReceitaDespesa.destroy();
    chartReceitaDespesa = new Chart(document.getElementById('graficoReceitaDespesa').getContext('2d'), {
      type: 'bar',
      data: {
        labels: meses.map(function (m) { return m.label; }),
        datasets: [
          { label: 'Receitas', data: receitas, backgroundColor: AutoCRMUI.corCSS('--acrm-success', '#34d399'), borderRadius: 6, maxBarThickness: 30 },
          { label: 'Despesas', data: despesas, backgroundColor: AutoCRMUI.corCSS('--acrm-danger', '#f87171'), borderRadius: 6, maxBarThickness: 30 }
        ]
      },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { x: eixoEscuro, y: eixoEscuro } }
    });
  }

  function desenharGraficoCategorias() {
    var despesas = DB.all('lancamentos').filter(function (l) { return l.tipo === 'despesa'; });
    var porCategoria = {};
    despesas.forEach(function (l) { porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + l.valor; });
    var categorias = Object.keys(porCategoria).sort(function (a, b) { return porCategoria[b] - porCategoria[a]; });
    var cores = [AutoCRMUI.corCSS('--acrm-accent', '#ff7a59'), AutoCRMUI.corCSS('--acrm-info', '#38bdf8'), AutoCRMUI.corCSS('--acrm-warning', '#f5b942'), AutoCRMUI.corCSS('--acrm-success', '#34d399'), '#a78bfa', AutoCRMUI.corCSS('--acrm-danger', '#f87171'), '#fb923c'];
    if (!categorias.length) {
      if (chartCategorias) chartCategorias.destroy();
      chartCategorias = new Chart(document.getElementById('graficoCategorias').getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Sem despesas'], datasets: [{ data: [1], backgroundColor: [AutoCRMUI.corCSS('--acrm-border', '#27272a')], borderWidth: 0 }] },
        options: { plugins: { legend: { display: false } }, cutout: '62%' }
      });
      return;
    }

    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(document.getElementById('graficoCategorias').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: categorias,
        datasets: [{ data: categorias.map(function (c) { return porCategoria[c]; }), backgroundColor: categorias.map(function (_, i) { return cores[i % cores.length]; }), borderWidth: 0 }]
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        cutout: '62%'
      }
    });
  }

  // --------------------------------------------------------------- tabela de lançamentos

  function dataDentroDoFiltro(dataIso, periodo) {
    var d = new Date(dataIso);
    if (periodo === 'mes') return d >= inicioMes;
    if (periodo === '3meses') return d >= new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
    if (periodo === '6meses') return d >= new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
    return true;
  }

  function renderizarTabela() {
    var termo = campoBusca.value.trim().toLowerCase();
    var tipo = filtroTipo.value;
    var periodo = filtroPeriodo.value;

    var lista = DB.all('lancamentos')
      .filter(function (l) { return dataDentroDoFiltro(l.data, periodo); })
      .filter(function (l) { return !tipo || l.tipo === tipo; })
      .filter(function (l) { return !termo || (l.descricao + ' ' + l.categoria).toLowerCase().indexOf(termo) !== -1; })
      .sort(function (a, b) { return new Date(b.data) - new Date(a.data); });

    var corpo = document.getElementById('corpoTabelaLancamentos');
    if (!lista.length) {
      corpo.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="bi bi-receipt"></i>Nenhum lançamento encontrado para este filtro.</div></td></tr>';
      return;
    }

    corpo.innerHTML = lista.map(function (l) {
      var cor = l.tipo === 'receita' ? 'var(--acrm-success)' : 'var(--acrm-danger)';
      var sinal = l.tipo === 'receita' ? '+ ' : '− ';
      return '<tr>' +
        '<td class="text-muted-2">' + AutoCRMUI.formatarData(l.data) + '</td>' +
        '<td><span class="badge-status badge-' + l.tipo + '">' + (l.tipo === 'receita' ? 'Receita' : 'Despesa') + '</span></td>' +
        '<td>' + AutoCRMUI.escapeHTML(l.categoria) + '</td>' +
        '<td>' + AutoCRMUI.escapeHTML(l.descricao) + '</td>' +
        '<td class="text-end fw-semibold" style="color:' + cor + '">' + sinal + AutoCRMUI.formatarMoeda(l.valor) + '</td>' +
        '<td class="text-end"><button class="btn btn-sm btn-outline-danger" data-excluir-lancamento="' + l.id + '" title="Excluir"><i class="bi bi-trash"></i></button></td>' +
      '</tr>';
    }).join('');
  }

  document.getElementById('corpoTabelaLancamentos').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-excluir-lancamento]');
    if (!btn) return;
    excluirLancamento(btn.getAttribute('data-excluir-lancamento'));
  });

  function excluirLancamento(id) {
    var l = DB.find('lancamentos', id);
    if (!l) return;
    var mensagem = 'Tem certeza que deseja excluir o lançamento "' + l.descricao + '" (' + AutoCRMUI.formatarMoeda(l.valor) + ')?';
    if (l.ordemId) mensagem += ' Isso também pode alterar o status de pagamento da ordem de serviço relacionada.';
    AutoCRMUI.confirmar({ titulo: 'Excluir lançamento', mensagem: mensagem, textoConfirmar: 'Excluir' }).then(function (ok) {
      if (!ok) return;
      DB.remove('lancamentos', id);
      if (l.ordemId) {
        var o = DB.find('ordens', l.ordemId);
        if (o) {
          var totalPago = DB.totalPagoOrdem(o.id);
          var novoStatus = totalPago >= o.valorTotal - 0.01 ? 'pago' : (totalPago > 0 ? 'parcial' : 'pendente');
          DB.update('ordens', o.id, { statusPagamento: novoStatus });
        }
      }
      AutoCRMUI.toast('Lançamento excluído.', 'success');
      atualizarTudo();
    });
  }

  campoBusca.addEventListener('input', AutoCRMUI.debounce(renderizarTabela, 200));
  filtroTipo.addEventListener('change', renderizarTabela);
  filtroPeriodo.addEventListener('change', renderizarTabela);

  // --------------------------------------------------------------- novo lançamento manual

  document.getElementById('btnNovoLancamento').addEventListener('click', function () {
    document.getElementById('formLancamento').reset();
    document.getElementById('lancamentoTipo').value = 'despesa';
    document.getElementById('lancamentoData').value = paraDataInput(hoje);
    modalLancamento.show();
  });

  document.getElementById('formLancamento').addEventListener('submit', function (e) {
    e.preventDefault();
    var dados = {
      tipo: document.getElementById('lancamentoTipo').value,
      categoria: document.getElementById('lancamentoCategoria').value.trim(),
      descricao: document.getElementById('lancamentoDescricao').value.trim(),
      valor: Number(document.getElementById('lancamentoValor').value),
      data: new Date(document.getElementById('lancamentoData').value + 'T12:00:00').toISOString(),
      ordemId: null
    };
    if (!dados.categoria || !dados.descricao || !dados.valor || dados.valor <= 0) {
      AutoCRMUI.toast('Preencha categoria, descrição e um valor válido.', 'warning');
      return;
    }
    DB.insert('lancamentos', dados);
    AutoCRMUI.toast('Lançamento registrado.', 'success');
    modalLancamento.hide();
    atualizarTudo();
  });

  // --------------------------------------------------------------- contas a receber

  function renderizarContasReceber() {
    var ordens = DB.all('ordens')
      .filter(function (o) { return o.status !== 'cancelado' && o.statusPagamento !== 'pago'; })
      .sort(function (a, b) { return new Date(a.dataAgendada) - new Date(b.dataAgendada); });

    var container = document.getElementById('listaContasReceber');
    if (!ordens.length) {
      container.innerHTML = '<div class="empty-state py-4"><i class="bi bi-emoji-smile"></i>Nada pendente por aqui.</div>';
      return;
    }

    container.innerHTML = ordens.map(function (o) {
      var restante = Math.max(0, o.valorTotal - DB.totalPagoOrdem(o.id));
      return '<div class="d-flex justify-content-between align-items-center mb-3">' +
        '<div>' +
          '<div style="font-size:.85rem;">' + AutoCRMUI.escapeHTML(nomeCliente(o.clienteId)) + '</div>' +
          '<div class="text-muted-2" style="font-size:.76rem;">OS #' + o.numero + ' · ' + AutoCRMUI.badgePagamento(o.statusPagamento) + '</div>' +
        '</div>' +
        '<div class="text-end">' +
          '<div class="fw-bold mb-1" style="color:var(--acrm-warning); font-size:.85rem;">' + AutoCRMUI.formatarMoeda(restante) + '</div>' +
          '<button class="btn btn-sm btn-outline-primary py-0" data-pagar="' + o.id + '">Registrar</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  document.getElementById('listaContasReceber').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pagar]');
    if (!btn) return;
    abrirPagamentoFin(btn.getAttribute('data-pagar'));
  });

  function abrirPagamentoFin(ordemId) {
    var o = DB.find('ordens', ordemId);
    if (!o) return;
    var pago = DB.totalPagoOrdem(ordemId);
    var restante = Math.max(0, o.valorTotal - pago);
    document.getElementById('pagFinOrdemId').value = ordemId;
    document.getElementById('pagFinNumeroOS').textContent = o.numero;
    document.getElementById('pagFinValorTotal').textContent = AutoCRMUI.formatarMoeda(o.valorTotal);
    document.getElementById('pagFinValorPago').textContent = AutoCRMUI.formatarMoeda(pago);
    document.getElementById('pagFinValorRestante').textContent = AutoCRMUI.formatarMoeda(restante);
    document.getElementById('pagFinValor').value = restante > 0 ? restante.toFixed(2) : '';
    modalPagamentoFin.show();
  }

  document.getElementById('formPagamentoFin').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('pagFinOrdemId').value;
    var o = DB.find('ordens', id);
    if (!o) return;
    var valor = Number(document.getElementById('pagFinValor').value);
    var forma = document.getElementById('pagFinForma').value;
    if (!valor || valor <= 0) { AutoCRMUI.toast('Informe um valor válido.', 'warning'); return; }

    DB.insert('lancamentos', {
      tipo: 'receita', categoria: 'Ordem de Serviço',
      descricao: 'Pagamento OS #' + o.numero + ' — ' + nomeCliente(o.clienteId) + ' (' + forma + ')',
      valor: valor, data: DB.agora(), ordemId: o.id
    });

    var totalPago = DB.totalPagoOrdem(o.id);
    var novoStatusPagamento = totalPago >= o.valorTotal - 0.01 ? 'pago' : (totalPago > 0 ? 'parcial' : 'pendente');
    DB.update('ordens', o.id, { statusPagamento: novoStatusPagamento, formaPagamento: forma });

    AutoCRMUI.toast('Pagamento registrado.', 'success');
    modalPagamentoFin.hide();
    atualizarTudo();
  });

  // --------------------------------------------------------------- init

  function atualizarTudo() {
    montarCards();
    desenharGraficoReceitaDespesa();
    desenharGraficoCategorias();
    renderizarTabela();
    renderizarContasReceber();
  }

  atualizarTudo();
  document.documentElement.addEventListener('acrm-tema', atualizarTudo);
})();
