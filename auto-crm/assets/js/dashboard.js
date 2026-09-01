/* =====================================================================
   AutoCRM — Dashboard (dashboard.js)
   ===================================================================== */

(function () {
  'use strict';

  var sessao = AutoCRMAuth.requireAuth('dashboard');
  if (!sessao) return;
  DB.init();

  var primeiroNome = sessao.nome.split(' ')[0];
  var hoje = new Date();
  var dataExtenso = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  AutoCRMUI.montarShell({
    modulo: 'dashboard',
    titulo: 'Olá, ' + primeiroNome,
    subtitulo: dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1)
  });

  var perfil = sessao.perfil;
  var podeFinanceiro = AutoCRMAuth.temAcesso(perfil, 'financeiro');
  var podeEstoque = AutoCRMAuth.temAcesso(perfil, 'estoque');
  var podeClientes = AutoCRMAuth.temAcesso(perfil, 'clientes');
  var podeOrdens = AutoCRMAuth.temAcesso(perfil, 'ordens');

  var clientes = DB.all('clientes');
  var veiculos = DB.all('veiculos');
  var ordens = DB.all('ordens');
  var produtos = DB.all('produtos');
  var lancamentos = DB.all('lancamentos');
  var mapaClientes = DB.mapById('clientes');
  var mapaVeiculos = DB.mapById('veiculos');

  function nomeCliente(id) { return (mapaClientes[id] && mapaClientes[id].nome) || 'Cliente removido'; }
  function veiculoTexto(id) {
    var v = mapaVeiculos[id];
    return v ? (v.marca + ' ' + v.modelo + ' · ' + v.placa) : '—';
  }

  var inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  var inicioMesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  var inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  var ordensAbertas = ordens.filter(function (o) { return o.status === 'agendado' || o.status === 'em_andamento'; });
  var ordensConcluidasMes = ordens.filter(function (o) { return o.status === 'concluido' && o.dataConclusao && new Date(o.dataConclusao) >= inicioMes; });
  var ordensConcluidasMesPassado = ordens.filter(function (o) {
    return o.status === 'concluido' && o.dataConclusao && new Date(o.dataConclusao) >= inicioMesPassado && new Date(o.dataConclusao) < inicioMes;
  });

  var faturamentoMes = lancamentos.filter(function (l) { return l.tipo === 'receita' && new Date(l.data) >= inicioMes; }).reduce(function (s, l) { return s + l.valor; }, 0);
  var faturamentoMesPassado = lancamentos.filter(function (l) { return l.tipo === 'receita' && new Date(l.data) >= inicioMesPassado && new Date(l.data) < inicioMes; }).reduce(function (s, l) { return s + l.valor; }, 0);

  var ordensAReceber = ordens.filter(function (o) { return o.status !== 'cancelado' && o.statusPagamento !== 'pago'; });
  var valorAReceber = ordensAReceber.reduce(function (s, o) { return s + Math.max(0, o.valorTotal - DB.totalPagoOrdem(o.id)); }, 0);
  var produtosBaixo = produtos.filter(function (p) { return p.quantidade <= p.estoqueMinimo; });

  function deltaTexto(atual, anterior) {
    if (!anterior && !atual) return '<span class="stat-delta text-muted-2">Sem movimento neste mês</span>';
    if (!anterior) return '<span class="stat-delta" style="color:var(--acrm-success)">Novo no mês</span>';
    var pct = Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
    var cor = pct > 0 ? 'var(--acrm-success)' : pct < 0 ? 'var(--acrm-danger)' : 'var(--acrm-text-muted)';
    var seta = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
    return '<span class="stat-delta" style="color:' + cor + '">' + seta + ' ' + Math.abs(pct) + '% vs. mês anterior</span>';
  }

  var cards = [];
  if (podeClientes) cards.push({ label: 'Clientes cadastrados', valor: clientes.length, icone: 'bi-people', tint: 'accent', href: 'clientes.html', delta: '<span class="stat-delta text-muted-2">' + veiculos.length + ' veículos</span>' });
  cards.push({ label: 'Ordens em aberto', valor: ordensAbertas.length, icone: 'bi-clipboard2-check', tint: 'info', href: 'ordens.html', delta: '<span class="stat-delta text-muted-2">' + ordens.filter(function (o) { return o.status === 'em_andamento'; }).length + ' em andamento</span>' });
  if (podeFinanceiro) {
    cards.push({ label: 'Faturamento do mês', valor: AutoCRMUI.formatarMoeda(faturamentoMes), icone: 'bi-cash-coin', tint: 'success', href: 'financeiro.html', delta: deltaTexto(faturamentoMes, faturamentoMesPassado, true) });
  } else {
    cards.push({ label: 'Concluídas este mês', valor: ordensConcluidasMes.length, icone: 'bi-check2-circle', tint: 'success', href: 'ordens.html', delta: deltaTexto(ordensConcluidasMes.length, ordensConcluidasMesPassado.length) });
  }
  if (podeEstoque) {
    cards.push({ label: 'Estoque baixo', valor: produtosBaixo.length, icone: 'bi-box-seam', tint: produtosBaixo.length ? 'danger' : 'success', href: 'estoque.html', delta: '<span class="stat-delta text-muted-2">' + produtos.length + ' produtos</span>' });
  } else if (podeFinanceiro) {
    cards.push({ label: 'A receber', valor: AutoCRMUI.formatarMoeda(valorAReceber), icone: 'bi-hourglass-split', tint: 'warning', href: 'financeiro.html', delta: '<span class="stat-delta text-muted-2">' + ordensAReceber.length + ' OS pendentes</span>' });
  } else {
    cards.push({ label: 'Veículos cadastrados', valor: veiculos.length, icone: 'bi-car-front', tint: 'accent', href: 'clientes.html', delta: '<span class="stat-delta text-muted-2">Na base ativa</span>' });
  }

  var atalhos = [];
  if (podeClientes) atalhos.push({ href: 'clientes.html', icone: 'bi-person-plus', label: 'Novo cliente' });
  if (podeOrdens) atalhos.push({ href: 'ordens.html', icone: 'bi-plus-lg', label: 'Nova OS' });
  if (podeFinanceiro) atalhos.push({ href: 'financeiro.html', icone: 'bi-receipt', label: 'Lançamento' });
  if (podeEstoque) atalhos.push({ href: 'estoque.html', icone: 'bi-box-arrow-in-down', label: 'Estoque' });

  var agendaHoje = ordens
    .filter(function (o) {
      if (o.status === 'cancelado') return false;
      var d = new Date(o.dataAgendada);
      return d >= inicioHoje && d < new Date(inicioHoje.getTime() + 86400000);
    })
    .sort(function (a, b) { return new Date(a.dataAgendada) - new Date(b.dataAgendada); });

  var painelLateralTitulo, painelLateralHtml, painelLateralSub;
  if (podeEstoque) {
    painelLateralTitulo = 'Estoque baixo';
    painelLateralSub = 'Produtos no mínimo ou abaixo';
    painelLateralHtml = !produtosBaixo.length
      ? '<div class="empty-state py-4"><i class="bi bi-box-seam"></i>Nenhum produto abaixo do mínimo.</div>'
      : produtosBaixo.map(function (p) {
          var pct = Math.min(100, Math.round((p.quantidade / Math.max(1, p.estoqueMinimo)) * 100));
          return '<div class="mb-3">' +
            '<div class="d-flex justify-content-between" style="font-size:.85rem;"><span>' + AutoCRMUI.escapeHTML(p.nome) + '</span><span class="text-muted-2">' + p.quantidade + '/' + p.estoqueMinimo + '</span></div>' +
            '<div class="progress-estoque baixo mt-1"><span style="width:' + pct + '%"></span></div>' +
          '</div>';
        }).join('');
  } else if (podeFinanceiro) {
    painelLateralTitulo = 'Contas a receber';
    painelLateralSub = 'OS com pagamento aberto';
    var listaReceber = ordensAReceber.slice(0, 6);
    painelLateralHtml = !listaReceber.length
      ? '<div class="empty-state py-4"><i class="bi bi-emoji-smile"></i>Nada pendente por aqui.</div>'
      : listaReceber.map(function (o) {
          var restante = Math.max(0, o.valorTotal - DB.totalPagoOrdem(o.id));
          return '<div class="d-flex justify-content-between align-items-center mb-3">' +
            '<div><div style="font-size:.85rem;">' + AutoCRMUI.escapeHTML(nomeCliente(o.clienteId)) + '</div><div class="text-muted-2" style="font-size:.76rem;">OS #' + o.numero + '</div></div>' +
            '<span class="fw-bold" style="color:var(--acrm-warning); font-size:.85rem;">' + AutoCRMUI.formatarMoeda(restante) + '</span>' +
          '</div>';
        }).join('');
  } else {
    painelLateralTitulo = 'Próximos agendamentos';
    painelLateralSub = 'A partir de hoje';
    var proximos = ordens
      .filter(function (o) { return o.status === 'agendado' && new Date(o.dataAgendada) >= inicioHoje; })
      .sort(function (a, b) { return new Date(a.dataAgendada) - new Date(b.dataAgendada); })
      .slice(0, 6);
    painelLateralHtml = !proximos.length
      ? '<div class="empty-state py-4"><i class="bi bi-calendar2-check"></i>Nenhum agendamento futuro.</div>'
      : proximos.map(function (o) {
          return '<div class="d-flex justify-content-between align-items-center mb-3">' +
            '<div><div style="font-size:.85rem;">' + AutoCRMUI.escapeHTML(nomeCliente(o.clienteId)) + '</div><div class="text-muted-2" style="font-size:.76rem;">' + AutoCRMUI.escapeHTML(veiculoTexto(o.veiculoId)) + '</div></div>' +
            '<span class="text-muted-2" style="font-size:.78rem;">' + AutoCRMUI.formatarData(o.dataAgendada, true) + '</span>' +
          '</div>';
        }).join('');
  }

  var ultimasOrdens = ordens.slice().sort(function (a, b) { return new Date(b.criadoEm) - new Date(a.criadoEm); }).slice(0, 6);
  var linhasUltimasOrdens = !ultimasOrdens.length
    ? '<tr><td colspan="5"><div class="empty-state"><i class="bi bi-clipboard2-x"></i>Nenhuma ordem de serviço ainda.</div></td></tr>'
    : ultimasOrdens.map(function (o) {
        return '<tr class="linha-clicavel" onclick="location.href=\'ordens.html\'">' +
          '<td class="fw-semibold">#' + o.numero + '</td>' +
          '<td>' + AutoCRMUI.escapeHTML(nomeCliente(o.clienteId)) + '<div class="text-muted-2" style="font-size:.76rem;">' + AutoCRMUI.escapeHTML(veiculoTexto(o.veiculoId)) + '</div></td>' +
          '<td>' + AutoCRMUI.badgeStatusOS(o.status) + '</td>' +
          '<td>' + AutoCRMUI.formatarMoeda(o.valorTotal) + '</td>' +
          '<td class="text-muted-2">' + AutoCRMUI.formatarData(o.dataAgendada) + '</td>' +
        '</tr>';
      }).join('');

  var agendaHtml = !agendaHoje.length
    ? '<div class="empty-state py-3"><i class="bi bi-calendar2"></i>Nada na agenda de hoje.</div>'
    : '<div class="lista-agenda">' + agendaHoje.map(function (o) {
        return '<div class="item-agenda">' +
          '<div><div class="fw-semibold" style="font-size:.85rem;">' + AutoCRMUI.escapeHTML(nomeCliente(o.clienteId)) + '</div>' +
          '<div class="text-muted-2" style="font-size:.75rem;">' + AutoCRMUI.escapeHTML(veiculoTexto(o.veiculoId)) + '</div></div>' +
          '<div class="text-end"><div style="font-size:.8rem;">' + AutoCRMUI.formatarData(o.dataAgendada, true).split(' ')[1] + '</div>' + AutoCRMUI.badgeStatusOS(o.status) + '</div>' +
        '</div>';
      }).join('') + '</div>';

  var tituloGraficoSecundario = podeFinanceiro ? 'Faturamento x despesas' : 'Serviços mais realizados';

  document.getElementById('paginaDashboard').innerHTML =
    (atalhos.length ? '<div class="quick-actions mb-3">' + atalhos.map(function (a) {
      return '<a class="quick-action" href="' + a.href + '"><i class="bi ' + a.icone + '"></i>' + a.label + '</a>';
    }).join('') + '</div>' : '') +

    '<div class="row g-3 mb-3">' + cards.map(function (c) {
      return '<div class="col-sm-6 col-xl-3"><a class="stat-card clicavel d-block text-reset" href="' + c.href + '">' +
        '<span class="stat-icon icon-tint-' + c.tint + '"><i class="bi ' + c.icone + '"></i></span>' +
        '<div class="stat-valor">' + c.valor + '</div>' +
        '<div class="stat-label">' + c.label + '</div>' +
        (c.delta || '') +
      '</a></div>';
    }).join('') + '</div>' +

    '<div class="row g-3 mb-3">' +
      '<div class="col-lg-8">' +
        '<div class="panel h-100">' +
          '<div class="panel-title">' + tituloGraficoSecundario + '</div>' +
          '<div class="panel-sub mb-2">' + (podeFinanceiro ? 'Comparativo dos últimos 6 meses' : 'Contagem entre as ordens registradas') + '</div>' +
          '<div class="chart-wrap"><canvas id="graficoSecundario"></canvas></div>' +
        '</div>' +
      '</div>' +
      '<div class="col-lg-4">' +
        '<div class="panel h-100">' +
          '<div class="panel-title">Agenda de hoje</div>' +
          '<div class="panel-sub mb-3">' + agendaHoje.length + ' atendimento' + (agendaHoje.length === 1 ? '' : 's') + '</div>' +
          agendaHtml +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="row g-3">' +
      '<div class="col-lg-8">' +
        '<div class="panel h-100">' +
          '<div class="d-flex justify-content-between align-items-center mb-2">' +
            '<div><div class="panel-title">Últimas ordens</div><div class="panel-sub">As 6 mais recentes</div></div>' +
            '<a href="ordens.html" class="btn btn-sm btn-outline-primary">Ver todas</a>' +
          '</div>' +
          '<div class="table-responsive"><table class="table table-hover align-middle mb-0">' +
            '<thead><tr><th>OS</th><th>Cliente / Veículo</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead>' +
            '<tbody>' + linhasUltimasOrdens + '</tbody>' +
          '</table></div>' +
        '</div>' +
      '</div>' +
      '<div class="col-lg-4">' +
        '<div class="panel h-100">' +
          '<div class="d-flex justify-content-between align-items-center mb-1">' +
            '<div><div class="panel-title">' + painelLateralTitulo + '</div><div class="panel-sub mb-0">' + painelLateralSub + '</div></div>' +
          '</div>' +
          '<div class="mt-3">' + painelLateralHtml + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  var eixoEscuro = AutoCRMUI.eixoGrafico();
  var accent = AutoCRMUI.corCSS('--acrm-accent', '#ff7a59');
  var success = AutoCRMUI.corCSS('--acrm-success', '#34d399');
  var danger = AutoCRMUI.corCSS('--acrm-danger', '#f87171');

  if (podeFinanceiro) {
    var meses = [];
    for (var i = 5; i >= 0; i--) {
      var dm = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      meses.push({ ano: dm.getFullYear(), mes: dm.getMonth(), label: dm.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') });
    }
    var receitas = meses.map(function (m) {
      return lancamentos.filter(function (l) {
        var d = new Date(l.data);
        return l.tipo === 'receita' && d.getFullYear() === m.ano && d.getMonth() === m.mes;
      }).reduce(function (s, l) { return s + l.valor; }, 0);
    });
    var despesas = meses.map(function (m) {
      return lancamentos.filter(function (l) {
        var d = new Date(l.data);
        return l.tipo === 'despesa' && d.getFullYear() === m.ano && d.getMonth() === m.mes;
      }).reduce(function (s, l) { return s + l.valor; }, 0);
    });

    new Chart(document.getElementById('graficoSecundario'), {
      type: 'bar',
      data: {
        labels: meses.map(function (m) { return m.label; }),
        datasets: [
          { label: 'Receitas', data: receitas, backgroundColor: success, borderRadius: 6, maxBarThickness: 28 },
          { label: 'Despesas', data: despesas, backgroundColor: danger, borderRadius: 6, maxBarThickness: 28 }
        ]
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: { x: eixoEscuro, y: eixoEscuro }
      }
    });
  } else {
    var contagemServicos = {};
    ordens.forEach(function (o) {
      (o.itens || []).forEach(function (it) {
        contagemServicos[it.nome] = (contagemServicos[it.nome] || 0) + 1;
      });
    });
    var servicosOrdenados = Object.keys(contagemServicos)
      .map(function (nome) { return { nome: nome, qtd: contagemServicos[nome] }; })
      .sort(function (a, b) { return b.qtd - a.qtd; })
      .slice(0, 6);

    new Chart(document.getElementById('graficoSecundario'), {
      type: 'bar',
      data: {
        labels: servicosOrdenados.map(function (s) { return s.nome; }),
        datasets: [{ label: 'Vezes realizado', data: servicosOrdenados.map(function (s) { return s.qtd; }), backgroundColor: accent, borderRadius: 6, maxBarThickness: 22 }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: eixoEscuro, y: eixoEscuro }
      }
    });
  }
})();
