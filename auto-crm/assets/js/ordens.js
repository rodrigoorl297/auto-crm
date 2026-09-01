/* =====================================================================
   AutoCRM — Ordens de Serviço (ordens.js)
   Regras de permissão desta página (além do acesso à página em si,
   definido em auth.js):
     - admin e atendente: podem criar/editar ordens e mudar status
     - admin e financeiro: podem registrar pagamentos
     - somente admin: pode excluir uma ordem
     - financeiro: enxerga tudo em modo somente-leitura (exceto pagamento)
   ===================================================================== */

(function () {
  'use strict';

  var sessao = AutoCRMAuth.requireAuth('ordens');
  if (!sessao) return;
  DB.init();
  AutoCRMUI.montarShell({ modulo: 'ordens', titulo: 'Ordens de Serviço', subtitulo: 'Agendamentos, atendimentos e pagamentos' });

  var perfil = sessao.perfil;
  var podeEditar = perfil === 'admin' || perfil === 'atendente';
  var podeMudarStatus = perfil === 'admin' || perfil === 'atendente';
  var podePagamento = perfil === 'admin' || perfil === 'financeiro';
  var podeExcluir = perfil === 'admin';

  var corpoTabela = document.getElementById('corpoTabelaOrdens');
  var campoBusca = document.getElementById('campoBusca');
  var filtroStatus = document.getElementById('filtroStatus');
  var quadroKanban = document.getElementById('quadroKanban');
  var modalOrdem = new bootstrap.Modal(document.getElementById('modalOrdem'));
  var modalPagamento = new bootstrap.Modal(document.getElementById('modalPagamento'));

  var itensAtuais = [];
  var modoSomenteLeituraAtual = false;
  var vistaAtual = localStorage.getItem('autocrm_os_view') || 'kanban';

  if (!podeEditar) document.getElementById('btnNovaOrdem').classList.add('d-none');

  function mapas() {
    return {
      clientes: DB.mapById('clientes'),
      veiculos: DB.mapById('veiculos'),
      usuarios: DB.mapById('usuarios')
    };
  }

  // --------------------------------------------------------- selects auxiliares

  function popularSelectClientes() {
    var clientes = DB.all('clientes').sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    AutoCRMUI.preencherSelect(document.getElementById('ordemCliente'), clientes.map(function (c) { return { valor: c.id, texto: c.nome }; }), { placeholder: 'Selecione um cliente' });
  }

  function popularSelectVeiculos(clienteId, selecionarId) {
    var select = document.getElementById('ordemVeiculo');
    var aviso = document.getElementById('avisoSemVeiculo');
    if (!clienteId) {
      select.innerHTML = '<option value="">Selecione um cliente primeiro</option>';
      select.disabled = true;
      aviso.innerHTML = '';
      return;
    }
    var veiculos = DB.where('veiculos', function (v) { return v.clienteId === clienteId; });
    if (!veiculos.length) {
      select.innerHTML = '<option value="">Nenhum veículo cadastrado</option>';
      select.disabled = true;
      aviso.innerHTML = 'Este cliente não tem veículos cadastrados. Cadastre em <a href="clientes.html">Clientes e Veículos</a>.';
      return;
    }
    aviso.innerHTML = '';
    select.disabled = false;
    AutoCRMUI.preencherSelect(select, veiculos.map(function (v) { return { valor: v.id, texto: v.marca + ' ' + v.modelo + ' · ' + v.placa }; }), { placeholder: 'Selecione um veículo' });
    if (selecionarId) select.value = selecionarId;
  }

  function popularSelectResponsaveis() {
    var usuarios = DB.where('usuarios', function (u) { return u.ativo; }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    AutoCRMUI.preencherSelect(document.getElementById('ordemResponsavel'), usuarios.map(function (u) { return { valor: u.id, texto: u.nome }; }), { placeholder: 'Sem responsável definido' });
  }

  function popularSelectCatalogo() {
    var servicos = DB.where('servicos', function (s) { return s.ativo; });
    var select = document.getElementById('itemCatalogo');
    var opcoes = servicos.map(function (s) { return '<option value="' + s.id + '">' + AutoCRMUI.escapeHTML(s.nome) + ' — ' + AutoCRMUI.formatarMoeda(s.precoSugerido) + '</option>'; }).join('');
    select.innerHTML = '<option value="">— escolha do catálogo —</option>' + opcoes + '<option value="__outro__">Outro (digitar manualmente)</option>';
  }

  document.getElementById('ordemCliente').addEventListener('change', function () { popularSelectVeiculos(this.value); });

  document.getElementById('itemCatalogo').addEventListener('change', function () {
    var val = this.value;
    var nomeInput = document.getElementById('itemNome');
    var valorInput = document.getElementById('itemValor');
    if (val === '__outro__') { nomeInput.value = ''; valorInput.value = ''; nomeInput.focus(); return; }
    if (!val) return;
    var servico = DB.find('servicos', val);
    if (servico) { nomeInput.value = servico.nome; valorInput.value = servico.precoSugerido; }
  });

  // --------------------------------------------------------------- itens (serviços)

  function renderizarItens() {
    var container = document.getElementById('listaItensOrdem');
    if (!itensAtuais.length) {
      container.innerHTML = '<div class="text-muted-2 text-center py-2" style="font-size:.82rem;">Nenhum serviço adicionado ainda.</div>';
    } else {
      container.innerHTML = itensAtuais.map(function (it, i) {
        var botaoRemover = modoSomenteLeituraAtual ? '' : '<button type="button" class="btn btn-sm btn-outline-danger py-0 px-1" data-remover="' + i + '"><i class="bi bi-x"></i></button>';
        return '<div class="d-flex justify-content-between align-items-center item-servico-row">' +
          '<span>' + AutoCRMUI.escapeHTML(it.nome) + '</span>' +
          '<span class="d-flex align-items-center gap-2">' + AutoCRMUI.formatarMoeda(it.valor) + botaoRemover + '</span>' +
        '</div>';
      }).join('');
    }
    document.getElementById('totalOrdem').textContent = AutoCRMUI.formatarMoeda(itensAtuais.reduce(function (s, it) { return s + it.valor; }, 0));
  }

  document.getElementById('listaItensOrdem').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remover]');
    if (!btn) return;
    itensAtuais.splice(Number(btn.getAttribute('data-remover')), 1);
    renderizarItens();
  });

  document.getElementById('btnAdicionarItem').addEventListener('click', function () {
    var nome = document.getElementById('itemNome').value.trim();
    var valor = Number(document.getElementById('itemValor').value);
    if (!nome || !valor || valor <= 0) {
      AutoCRMUI.toast('Escolha um serviço do catálogo (ou digite um) e informe um valor válido.', 'warning');
      return;
    }
    itensAtuais.push({ nome: nome, valor: valor });
    document.getElementById('itemCatalogo').value = '';
    document.getElementById('itemNome').value = '';
    document.getElementById('itemValor').value = '';
    renderizarItens();
  });

  // --------------------------------------------------------------- modal ordem

  function paraDatetimeLocal(d) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function aplicarModoSomenteLeitura(ativo) {
    modoSomenteLeituraAtual = ativo;
    ['ordemCliente', 'ordemResponsavel', 'ordemData', 'ordemObservacoes', 'itemCatalogo', 'itemNome', 'itemValor'].forEach(function (id) {
      document.getElementById(id).disabled = ativo;
    });
    if (ativo) document.getElementById('ordemVeiculo').disabled = true;
    document.getElementById('btnAdicionarItem').disabled = ativo;
    document.querySelector('#formOrdem .modal-footer button[type="submit"]').classList.toggle('d-none', ativo);
    renderizarItens();
  }

  function limparFormOrdem() {
    document.getElementById('formOrdem').reset();
    document.getElementById('ordemId').value = '';
    itensAtuais = [];
    popularSelectVeiculos(null);
    aplicarModoSomenteLeitura(false);
  }

  document.getElementById('btnNovaOrdem').addEventListener('click', function () {
    limparFormOrdem();
    document.getElementById('tituloModalOrdem').textContent = 'Nova Ordem de Serviço';
    document.getElementById('ordemData').value = paraDatetimeLocal(new Date());
    modalOrdem.show();
  });

  function abrirEditarOrdem(id) {
    var o = DB.find('ordens', id);
    if (!o) return;
    limparFormOrdem();
    document.getElementById('ordemId').value = o.id;
    document.getElementById('ordemCliente').value = o.clienteId;
    popularSelectVeiculos(o.clienteId, o.veiculoId);
    document.getElementById('ordemResponsavel').value = o.responsavelId || '';
    document.getElementById('ordemData').value = paraDatetimeLocal(new Date(o.dataAgendada));
    document.getElementById('ordemObservacoes').value = o.observacoes || '';
    itensAtuais = (o.itens || []).map(function (it) { return { nome: it.nome, valor: it.valor }; });

    var somenteLeitura = !podeEditar;
    aplicarModoSomenteLeitura(somenteLeitura);
    document.getElementById('tituloModalOrdem').textContent = (somenteLeitura ? 'Detalhes da OS #' : 'Editar Ordem de Serviço #') + o.numero;
    modalOrdem.show();
  }

  document.getElementById('formOrdem').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!podeEditar) return;
    var id = document.getElementById('ordemId').value;
    var clienteId = document.getElementById('ordemCliente').value;
    var veiculoId = document.getElementById('ordemVeiculo').value;
    var dataAgendada = document.getElementById('ordemData').value;

    if (!clienteId) { AutoCRMUI.toast('Selecione um cliente.', 'warning'); return; }
    if (!veiculoId) { AutoCRMUI.toast('Selecione um veículo.', 'warning'); return; }
    if (!dataAgendada) { AutoCRMUI.toast('Informe a data agendada.', 'warning'); return; }
    if (!itensAtuais.length) { AutoCRMUI.toast('Adicione ao menos um serviço.', 'warning'); return; }

    var dados = {
      clienteId: clienteId,
      veiculoId: veiculoId,
      responsavelId: document.getElementById('ordemResponsavel').value || null,
      dataAgendada: new Date(dataAgendada).toISOString(),
      observacoes: document.getElementById('ordemObservacoes').value.trim(),
      itens: itensAtuais.slice(),
      valorTotal: itensAtuais.reduce(function (s, it) { return s + it.valor; }, 0)
    };

    if (id) {
      DB.update('ordens', id, dados);
      AutoCRMUI.toast('Ordem de serviço atualizada.', 'success');
    } else {
      dados.numero = DB.proximoNumeroOS();
      dados.status = 'agendado';
      dados.statusPagamento = 'pendente';
      dados.formaPagamento = '';
      dados.dataConclusao = null;
      DB.insert('ordens', dados);
      AutoCRMUI.toast('Ordem de serviço criada.', 'success');
    }

    modalOrdem.hide();
    renderizarTudo();
  });

  function excluirOrdem(id) {
    var o = DB.find('ordens', id);
    if (!o) return;
    var lancamentosVinculados = DB.where('lancamentos', function (l) { return l.ordemId === id; });
    var mensagem = 'Tem certeza que deseja excluir a OS #' + o.numero + '?';
    if (lancamentosVinculados.length) mensagem += ' Há ' + lancamentosVinculados.length + ' lançamento(s) financeiro(s) vinculado(s) que também serão removidos.';
    AutoCRMUI.confirmar({ titulo: 'Excluir ordem de serviço', mensagem: mensagem, textoConfirmar: 'Excluir' }).then(function (ok) {
      if (!ok) return;
      lancamentosVinculados.forEach(function (l) { DB.remove('lancamentos', l.id); });
      DB.remove('ordens', id);
      AutoCRMUI.toast('Ordem de serviço excluída.', 'success');
      renderizarTudo();
    });
  }

  function mudarStatus(id, novoStatus, rotulo, silencioso) {
    var aplicar = function () {
      var patch = { status: novoStatus };
      if (novoStatus === 'concluido') {
        var o = DB.find('ordens', id);
        patch.dataConclusao = (o && o.dataConclusao) ? o.dataConclusao : DB.agora();
      }
      DB.update('ordens', id, patch);
      AutoCRMUI.toast('Status atualizado.', 'success');
      renderizarTudo();
    };
    if (silencioso) { aplicar(); return; }
    AutoCRMUI.confirmar({
      titulo: rotulo,
      mensagem: 'Confirma esta alteração de status da ordem de serviço?',
      perigo: novoStatus === 'cancelado',
      textoConfirmar: 'Confirmar'
    }).then(function (ok) {
      if (!ok) return;
      aplicar();
    });
  }

  // --------------------------------------------------------------- pagamento

  function abrirPagamento(id) {
    var o = DB.find('ordens', id);
    if (!o) return;
    var pago = DB.totalPagoOrdem(id);
    var restante = Math.max(0, o.valorTotal - pago);
    document.getElementById('pagamentoOrdemId').value = id;
    document.getElementById('pagamentoNumeroOS').textContent = o.numero;
    document.getElementById('pagamentoValorTotal').textContent = AutoCRMUI.formatarMoeda(o.valorTotal);
    document.getElementById('pagamentoValorPago').textContent = AutoCRMUI.formatarMoeda(pago);
    document.getElementById('pagamentoValorRestante').textContent = AutoCRMUI.formatarMoeda(restante);
    document.getElementById('pagamentoValor').value = restante > 0 ? restante.toFixed(2) : '';
    modalPagamento.show();
  }

  document.getElementById('formPagamento').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('pagamentoOrdemId').value;
    var o = DB.find('ordens', id);
    if (!o) return;
    var valor = Number(document.getElementById('pagamentoValor').value);
    var forma = document.getElementById('pagamentoForma').value;
    if (!valor || valor <= 0) { AutoCRMUI.toast('Informe um valor válido.', 'warning'); return; }

    var clienteDaOrdem = DB.find('clientes', o.clienteId);
    DB.insert('lancamentos', {
      tipo: 'receita', categoria: 'Ordem de Serviço',
      descricao: 'Pagamento OS #' + o.numero + ' — ' + (clienteDaOrdem ? clienteDaOrdem.nome : 'Cliente removido') + ' (' + forma + ')',
      valor: valor, data: DB.agora(), ordemId: o.id
    });

    var totalPago = DB.totalPagoOrdem(o.id);
    var novoStatusPagamento = totalPago >= o.valorTotal - 0.01 ? 'pago' : (totalPago > 0 ? 'parcial' : 'pendente');
    DB.update('ordens', o.id, { statusPagamento: novoStatusPagamento, formaPagamento: forma });

    AutoCRMUI.toast('Pagamento registrado.', 'success');
    modalPagamento.hide();
    renderizarTudo();
  });

  // --------------------------------------------------------------- tabela

  function montarMenuAcoes(o) {
    var itens = [];
    itens.push('<li><a class="dropdown-item" href="#" data-menu="ver" data-id="' + o.id + '"><i class="bi bi-eye me-2"></i>' + (podeEditar ? 'Editar' : 'Ver detalhes') + '</a></li>');
    itens.push('<li><a class="dropdown-item" href="#" data-menu="imprimir" data-id="' + o.id + '"><i class="bi bi-printer me-2"></i>Imprimir OS</a></li>');

    var aberta = o.status !== 'cancelado' && o.status !== 'concluido';
    if (podeMudarStatus && aberta) {
      if (o.status === 'agendado') itens.push('<li><a class="dropdown-item" href="#" data-menu="em_andamento" data-id="' + o.id + '"><i class="bi bi-play-circle me-2"></i>Iniciar atendimento</a></li>');
      if (o.status === 'em_andamento') itens.push('<li><a class="dropdown-item" href="#" data-menu="concluido" data-id="' + o.id + '"><i class="bi bi-check2-circle me-2"></i>Concluir</a></li>');
    }
    if (podePagamento && o.status !== 'cancelado' && o.statusPagamento !== 'pago') {
      itens.push('<li><a class="dropdown-item" href="#" data-menu="pagamento" data-id="' + o.id + '"><i class="bi bi-cash-coin me-2"></i>Registrar pagamento</a></li>');
    }
    if (podeMudarStatus && aberta) {
      itens.push('<li><a class="dropdown-item text-warning" href="#" data-menu="cancelado" data-id="' + o.id + '"><i class="bi bi-x-circle me-2"></i>Cancelar</a></li>');
    }
    if (podeExcluir) {
      itens.push('<li><hr class="dropdown-divider"></li>');
      itens.push('<li><a class="dropdown-item text-danger" href="#" data-menu="excluir" data-id="' + o.id + '"><i class="bi bi-trash me-2"></i>Excluir</a></li>');
    }

    return '<div class="dropdown">' +
      '<button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-three-dots"></i></button>' +
      '<ul class="dropdown-menu dropdown-menu-end">' + itens.join('') + '</ul>' +
    '</div>';
  }

  function imprimirOrdem(id) {
    var o = DB.find('ordens', id);
    if (!o) return;
    AutoCRMUI.imprimirOS(o, DB.find('clientes', o.clienteId), DB.find('veiculos', o.veiculoId), o.responsavelId ? DB.find('usuarios', o.responsavelId) : null);
  }

  function ordensFiltradas() {
    var termo = campoBusca.value.trim().toLowerCase();
    var statusFiltro = filtroStatus.value;
    var m = mapas();
    return DB.all('ordens')
      .slice()
      .sort(function (a, b) { return new Date(b.dataAgendada) - new Date(a.dataAgendada); })
      .filter(function (o) {
        if (statusFiltro && o.status !== statusFiltro) return false;
        if (!termo) return true;
        var cliente = m.clientes[o.clienteId];
        var veiculo = m.veiculos[o.veiculoId];
        var alvo = ('#' + o.numero + ' ' + (cliente ? cliente.nome : '') + ' ' + (veiculo ? veiculo.placa : '')).toLowerCase();
        return alvo.indexOf(termo) !== -1;
      });
  }

  function renderizarChips(listaCompleta) {
    var contagem = { '': listaCompleta.length, agendado: 0, em_andamento: 0, concluido: 0, cancelado: 0 };
    listaCompleta.forEach(function (o) { if (contagem[o.status] !== undefined) contagem[o.status]++; });
    var chips = [
      { valor: '', label: 'Todas' },
      { valor: 'agendado', label: 'Agendado' },
      { valor: 'em_andamento', label: 'Em andamento' },
      { valor: 'concluido', label: 'Concluído' },
      { valor: 'cancelado', label: 'Cancelado' }
    ];
    document.getElementById('chipsStatus').innerHTML = chips.map(function (c) {
      return '<button type="button" class="chip-filtro' + (filtroStatus.value === c.valor ? ' ativo' : '') + '" data-status="' + c.valor + '">' +
        c.label + '<span class="count">' + contagem[c.valor] + '</span></button>';
    }).join('');
  }

  function renderizarTabela() {
    var filtradas = ordensFiltradas();
    var m = mapas();
    document.getElementById('contadorOrdens').textContent = filtradas.length + (filtradas.length === 1 ? ' ordem' : ' ordens');

    if (!filtradas.length) {
      corpoTabela.innerHTML = '<tr><td colspan="9"><div class="empty-state"><i class="bi bi-clipboard2-x"></i>Nenhuma ordem de serviço encontrada.</div></td></tr>';
      return;
    }

    corpoTabela.innerHTML = filtradas.map(function (o) {
      var cliente = m.clientes[o.clienteId];
      var veiculo = m.veiculos[o.veiculoId];
      var responsavel = o.responsavelId ? m.usuarios[o.responsavelId] : null;
      var servicosTexto = (o.itens || []).map(function (it) { return it.nome; }).join(', ');

      return '<tr class="linha-clicavel" data-abrir="' + o.id + '">' +
        '<td class="fw-semibold">#' + o.numero + '</td>' +
        '<td>' + AutoCRMUI.escapeHTML(cliente ? cliente.nome : 'Cliente removido') + '<div class="text-muted-2" style="font-size:.76rem;">' + AutoCRMUI.escapeHTML(veiculo ? (veiculo.marca + ' ' + veiculo.modelo + ' · ' + veiculo.placa) : '—') + '</div></td>' +
        '<td class="text-truncate" style="max-width:220px;" title="' + AutoCRMUI.escapeHTML(servicosTexto) + '">' + AutoCRMUI.escapeHTML(servicosTexto) + '</td>' +
        '<td class="text-muted-2">' + AutoCRMUI.escapeHTML(responsavel ? responsavel.nome : '—') + '</td>' +
        '<td>' + AutoCRMUI.badgeStatusOS(o.status) + '</td>' +
        '<td>' + AutoCRMUI.badgePagamento(o.statusPagamento) + '</td>' +
        '<td class="fw-semibold">' + AutoCRMUI.formatarMoeda(o.valorTotal) + '</td>' +
        '<td class="text-muted-2">' + AutoCRMUI.formatarData(o.dataAgendada, true) + '</td>' +
        '<td class="text-end" data-stop-row="1">' + montarMenuAcoes(o) + '</td>' +
      '</tr>';
    }).join('');
  }

  function renderizarKanban() {
    var filtradas = ordensFiltradas();
    var m = mapas();
    document.getElementById('contadorOrdens').textContent = filtradas.length + (filtradas.length === 1 ? ' ordem' : ' ordens');
    var colunas = [
      { id: 'agendado', label: 'Agendado' },
      { id: 'em_andamento', label: 'Em andamento' },
      { id: 'concluido', label: 'Concluído' },
      { id: 'cancelado', label: 'Cancelado' }
    ];
    quadroKanban.innerHTML = colunas.map(function (col) {
      var itens = filtradas.filter(function (o) { return o.status === col.id; });
      var cards = itens.length
        ? itens.map(function (o) {
            var cliente = m.clientes[o.clienteId];
            var veiculo = m.veiculos[o.veiculoId];
            return '<article class="kanban-card" draggable="' + (podeMudarStatus ? 'true' : 'false') + '" data-id="' + o.id + '" data-abrir="' + o.id + '">' +
              '<div class="kc-titulo">#' + o.numero + ' · ' + AutoCRMUI.escapeHTML(cliente ? cliente.nome : 'Cliente removido') + '</div>' +
              '<div class="kc-meta">' + AutoCRMUI.escapeHTML(veiculo ? (veiculo.modelo + ' · ' + veiculo.placa) : '—') + '</div>' +
              '<div class="kc-foot"><span>' + AutoCRMUI.formatarMoeda(o.valorTotal) + '</span>' + AutoCRMUI.badgePagamento(o.statusPagamento) + '</div>' +
            '</article>';
          }).join('')
        : '<div class="text-muted-2 text-center py-3" style="font-size:.78rem;">Vazio</div>';
      return '<div class="kanban-col" data-status="' + col.id + '">' +
        '<div class="kanban-col-header"><span>' + col.label + '</span><span class="text-muted-2">' + itens.length + '</span></div>' +
        '<div class="kanban-col-body">' + cards + '</div></div>';
    }).join('');
  }

  function aplicarVista() {
    var kanban = vistaAtual === 'kanban';
    document.getElementById('viewKanban').classList.toggle('d-none', !kanban);
    document.getElementById('viewTabela').classList.toggle('d-none', kanban);
    document.getElementById('btnViewKanban').classList.toggle('ativo', kanban);
    document.getElementById('btnViewTabela').classList.toggle('ativo', !kanban);
    try { localStorage.setItem('autocrm_os_view', vistaAtual); } catch (e) { /* silencioso */ }
  }

  function renderizarTudo() {
    renderizarChips(DB.all('ordens'));
    aplicarVista();
    if (vistaAtual === 'kanban') renderizarKanban();
    else renderizarTabela();
  }

  document.getElementById('chipsStatus').addEventListener('click', function (e) {
    var chip = e.target.closest('[data-status]');
    if (!chip) return;
    filtroStatus.value = chip.getAttribute('data-status');
    renderizarTudo();
  });

  document.getElementById('btnViewKanban').addEventListener('click', function () { vistaAtual = 'kanban'; renderizarTudo(); });
  document.getElementById('btnViewTabela').addEventListener('click', function () { vistaAtual = 'tabela'; renderizarTudo(); });

  quadroKanban.addEventListener('click', function (e) {
    var card = e.target.closest('[data-abrir]');
    if (card) abrirEditarOrdem(card.getAttribute('data-abrir'));
  });

  quadroKanban.addEventListener('dragstart', function (e) {
    var card = e.target.closest('.kanban-card');
    if (!card || !podeMudarStatus) return;
    card.classList.add('arrastando');
    e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
    e.dataTransfer.effectAllowed = 'move';
  });
  quadroKanban.addEventListener('dragend', function () {
    quadroKanban.querySelectorAll('.kanban-card').forEach(function (c) { c.classList.remove('arrastando'); });
    quadroKanban.querySelectorAll('.kanban-col').forEach(function (c) { c.classList.remove('drag-over'); });
  });
  quadroKanban.addEventListener('dragover', function (e) {
    var col = e.target.closest('.kanban-col');
    if (!col) return;
    e.preventDefault();
    col.classList.add('drag-over');
  });
  quadroKanban.addEventListener('dragleave', function (e) {
    var col = e.target.closest('.kanban-col');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });
  quadroKanban.addEventListener('drop', function (e) {
    var col = e.target.closest('.kanban-col');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drag-over');
    var id = e.dataTransfer.getData('text/plain');
    var novo = col.getAttribute('data-status');
    var o = DB.find('ordens', id);
    if (!o || o.status === novo || !podeMudarStatus) return;
    mudarStatus(id, novo, 'Mover ordem', true);
  });

  corpoTabela.addEventListener('click', function (e) {
    var link = e.target.closest('[data-menu]');
    if (link) {
      e.preventDefault();
      var id = link.getAttribute('data-id');
      var acao = link.getAttribute('data-menu');
      if (acao === 'ver') abrirEditarOrdem(id);
      else if (acao === 'pagamento') abrirPagamento(id);
      else if (acao === 'excluir') excluirOrdem(id);
      else if (acao === 'imprimir') imprimirOrdem(id);
      else if (acao === 'em_andamento') mudarStatus(id, 'em_andamento', 'Iniciar atendimento');
      else if (acao === 'concluido') mudarStatus(id, 'concluido', 'Concluir ordem de serviço');
      else if (acao === 'cancelado') mudarStatus(id, 'cancelado', 'Cancelar ordem de serviço');
      return;
    }
    if (e.target.closest('[data-stop-row]')) return;
    var row = e.target.closest('[data-abrir]');
    if (row) abrirEditarOrdem(row.getAttribute('data-abrir'));
  });

  campoBusca.addEventListener('input', AutoCRMUI.debounce(renderizarTudo, 180));
  filtroStatus.addEventListener('change', renderizarTudo);

  popularSelectClientes();
  popularSelectResponsaveis();
  popularSelectCatalogo();
  renderizarTudo();
})();
