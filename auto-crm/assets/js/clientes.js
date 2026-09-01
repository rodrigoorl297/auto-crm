/* =====================================================================
   AutoCRM — Clientes e Veículos (clientes.js)
   ===================================================================== */

(function () {
  'use strict';

  var sessao = AutoCRMAuth.requireAuth('clientes');
  if (!sessao) return;
  DB.init();
  AutoCRMUI.montarShell({ modulo: 'clientes', titulo: 'Clientes e Veículos', subtitulo: 'Cadastro de clientes e dos veículos de cada um' });

  var listaClientes = document.getElementById('listaClientes');
  var campoBusca = document.getElementById('campoBusca');
  var modalCliente = new bootstrap.Modal(document.getElementById('modalCliente'));
  var modalVeiculos = new bootstrap.Modal(document.getElementById('modalVeiculos'));

  function veiculosDoCliente(clienteId, agrupado) {
    if (agrupado) return agrupado[clienteId] || [];
    return DB.where('veiculos', function (v) { return v.clienteId === clienteId; });
  }

  function ordensDoCliente(clienteId) {
    return DB.where('ordens', function (o) { return o.clienteId === clienteId; });
  }

  // --------------------------------------------------------------- lista (cards)

  function montarVeiculosHtml(veiculos) {
    if (!veiculos.length) {
      return '<span class="text-muted-2 small">Sem veículos cadastrados</span>';
    }
    return veiculos.slice(0, 3).map(function (v) {
      return '<span class="badge text-bg-secondary cliente-veiculo-badge"><i class="bi bi-car-front me-1"></i>' +
        AutoCRMUI.escapeHTML(v.modelo) + ' · ' + AutoCRMUI.escapeHTML(v.placa) + '</span>';
    }).join('') + (veiculos.length > 3 ? '<span class="badge text-bg-secondary cliente-veiculo-badge">+' + (veiculos.length - 3) + '</span>' : '');
  }

  function montarAcoesHtml(c, wa) {
    return '<div class="cliente-acoes">' +
      (wa ? '<a class="btn btn-sm btn-outline-secondary btn-whatsapp" href="' + wa + '" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp"><i class="bi bi-whatsapp"></i></a>' : '') +
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-acao="veiculos" data-id="' + c.id + '" title="Veículos" aria-label="Veículos"><i class="bi bi-car-front"></i></button>' +
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-acao="editar" data-id="' + c.id + '" title="Editar" aria-label="Editar"><i class="bi bi-pencil"></i></button>' +
      '<button type="button" class="btn btn-sm btn-outline-danger ms-auto" data-acao="excluir" data-id="' + c.id + '" title="Excluir" aria-label="Excluir"><i class="bi bi-trash"></i></button>' +
    '</div>';
  }

  function renderizarLista() {
    var termo = campoBusca.value.trim().toLowerCase();
    var clientes = DB.all('clientes').sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    var veiculosPorCliente = DB.groupBy('veiculos', 'clienteId');

    var filtrados = clientes.filter(function (c) {
      if (!termo) return true;
      var veiculos = veiculosPorCliente[c.id] || [];
      var alvo = [c.nome, c.telefone, c.email, c.documento].join(' ').toLowerCase();
      var alvoPlacas = veiculos.map(function (v) { return v.placa; }).join(' ').toLowerCase();
      return alvo.indexOf(termo) !== -1 || alvoPlacas.indexOf(termo) !== -1;
    });

    var contador = document.getElementById('contadorClientes');
    if (contador) contador.textContent = filtrados.length + (filtrados.length === 1 ? ' cliente' : ' clientes');

    if (!filtrados.length) {
      listaClientes.innerHTML =
        '<div class="col-12"><div class="empty-state panel"><i class="bi bi-people"></i>' +
        (termo ? 'Nenhum cliente para "' + AutoCRMUI.escapeHTML(campoBusca.value) + '".' : 'Nenhum cliente cadastrado.') +
        (termo ? '' : ' <button type="button" class="btn btn-sm btn-primary mt-2" id="btnNovoClienteVazio">Cadastrar primeiro cliente</button>') +
        '</div></div>';
      var btnVazio = document.getElementById('btnNovoClienteVazio');
      if (btnVazio) btnVazio.addEventListener('click', function () { document.getElementById('btnNovoCliente').click(); });
      return;
    }

    listaClientes.innerHTML = filtrados.map(function (c) {
      var veiculos = veiculosPorCliente[c.id] || [];
      var wa = AutoCRMUI.linkWhatsApp(c.telefone);
      var meta = [];
      if (c.telefone) meta.push('<li><i class="bi bi-telephone"></i>' + AutoCRMUI.escapeHTML(c.telefone) + '</li>');
      if (c.email) meta.push('<li><i class="bi bi-envelope"></i><span class="text-truncate">' + AutoCRMUI.escapeHTML(c.email) + '</span></li>');
      if (c.documento) meta.push('<li><i class="bi bi-person-vcard"></i>' + AutoCRMUI.escapeHTML(c.documento) + '</li>');

      return '<div class="col">' +
        '<div class="card cliente-card h-100">' +
          '<div class="card-body d-flex flex-column">' +
            '<div class="d-flex align-items-start gap-3 mb-2">' +
              '<span class="cliente-avatar">' + AutoCRMUI.iniciais(c.nome) + '</span>' +
              '<div class="min-w-0 flex-grow-1">' +
                '<h6 class="card-title mb-0 text-truncate">' + AutoCRMUI.escapeHTML(c.nome) + '</h6>' +
                (c.endereco ? '<p class="text-muted-2 small mb-0 text-truncate">' + AutoCRMUI.escapeHTML(c.endereco) + '</p>' : '') +
              '</div>' +
            '</div>' +
            (meta.length ? '<ul class="cliente-meta list-unstyled mb-2">' + meta.join('') + '</ul>' : '') +
            '<div class="cliente-veiculos mb-2">' + montarVeiculosHtml(veiculos) + '</div>' +
            '<div class="cliente-rodape mt-auto">' +
              '<span class="text-muted-2 small">Desde ' + AutoCRMUI.formatarData(c.criadoEm) + '</span>' +
              montarAcoesHtml(c, wa) +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  listaClientes.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-acao]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var acao = btn.getAttribute('data-acao');
    if (acao === 'editar') abrirEditarCliente(id);
    else if (acao === 'excluir') excluirCliente(id);
    else if (acao === 'veiculos') abrirVeiculos(id);
  });

  campoBusca.addEventListener('input', AutoCRMUI.debounce(renderizarLista, 200));

  document.getElementById('clienteTelefone').addEventListener('input', function () {
    this.value = AutoCRMUI.mascararTelefone(this.value);
  });

  // --------------------------------------------------------- modal cliente

  function limparFormCliente() {
    document.getElementById('formCliente').reset();
    document.getElementById('clienteId').value = '';
  }

  document.getElementById('btnNovoCliente').addEventListener('click', function () {
    limparFormCliente();
    document.getElementById('tituloModalCliente').textContent = 'Novo Cliente';
    modalCliente.show();
  });

  function abrirEditarCliente(id) {
    var c = DB.find('clientes', id);
    if (!c) return;
    document.getElementById('clienteId').value = c.id;
    document.getElementById('clienteNome').value = c.nome || '';
    document.getElementById('clienteTelefone').value = c.telefone || '';
    document.getElementById('clienteEmail').value = c.email || '';
    document.getElementById('clienteDocumento').value = c.documento || '';
    document.getElementById('clienteEndereco').value = c.endereco || '';
    document.getElementById('clienteObservacoes').value = c.observacoes || '';
    document.getElementById('tituloModalCliente').textContent = 'Editar Cliente';
    modalCliente.show();
  }

  document.getElementById('formCliente').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('clienteId').value;
    var dados = {
      nome: document.getElementById('clienteNome').value.trim(),
      telefone: document.getElementById('clienteTelefone').value.trim(),
      email: document.getElementById('clienteEmail').value.trim(),
      documento: document.getElementById('clienteDocumento').value.trim(),
      endereco: document.getElementById('clienteEndereco').value.trim(),
      observacoes: document.getElementById('clienteObservacoes').value.trim()
    };
    if (!dados.nome || !dados.telefone) {
      AutoCRMUI.toast('Preencha nome e telefone.', 'warning');
      return;
    }
    if (id) {
      DB.update('clientes', id, dados);
      AutoCRMUI.toast('Cliente atualizado com sucesso.', 'success');
    } else {
      DB.insert('clientes', dados);
      AutoCRMUI.toast('Cliente cadastrado com sucesso.', 'success');
    }
    modalCliente.hide();
    renderizarLista();
  });

  function excluirCliente(id) {
    var c = DB.find('clientes', id);
    if (!c) return;
    var vinculadas = ordensDoCliente(id).length;
    if (vinculadas > 0) {
      AutoCRMUI.toast('Não é possível excluir: há ' + vinculadas + ' ordem(ns) de serviço vinculada(s) a ' + c.nome + '.', 'danger');
      return;
    }
    AutoCRMUI.confirmar({
      titulo: 'Excluir cliente',
      mensagem: 'Tem certeza que deseja excluir "' + c.nome + '"? Os veículos cadastrados para este cliente também serão removidos.',
      textoConfirmar: 'Excluir'
    }).then(function (ok) {
      if (!ok) return;
      veiculosDoCliente(id).forEach(function (v) { DB.remove('veiculos', v.id); });
      DB.remove('clientes', id);
      AutoCRMUI.toast('Cliente excluído.', 'success');
      renderizarLista();
    });
  }

  // --------------------------------------------------------- modal veículos

  var clienteAtualId = null;

  function abrirVeiculos(clienteId) {
    var c = DB.find('clientes', clienteId);
    if (!c) return;
    clienteAtualId = clienteId;
    document.getElementById('veiculosClienteId').value = clienteId;
    document.getElementById('veiculosClienteNome').textContent = c.nome;
    resetarFormVeiculo();
    renderizarListaVeiculos();
    modalVeiculos.show();
  }

  function renderizarListaVeiculos() {
    var veiculos = veiculosDoCliente(clienteAtualId);
    var container = document.getElementById('listaVeiculosCliente');
    if (!veiculos.length) {
      container.innerHTML = '<div class="empty-state py-3"><i class="bi bi-car-front"></i>Nenhum veículo cadastrado.</div>';
      return;
    }
    container.innerHTML = '<div class="row row-cols-1 row-cols-sm-2 g-2">' + veiculos.map(function (v) {
      return '<div class="col">' +
        '<div class="card veiculo-card h-100">' +
          '<div class="card-body p-3">' +
            '<div class="d-flex justify-content-between align-items-start gap-2 mb-1">' +
              '<span class="veiculo-placa">' + AutoCRMUI.escapeHTML(v.placa) + '</span>' +
              '<div class="d-flex gap-1">' +
                '<button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2" data-vacao="editar" data-vid="' + v.id + '" title="Editar"><i class="bi bi-pencil"></i></button>' +
                '<button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" data-vacao="excluir" data-vid="' + v.id + '" title="Excluir"><i class="bi bi-trash"></i></button>' +
              '</div>' +
            '</div>' +
            '<div class="fw-semibold small">' + AutoCRMUI.escapeHTML(v.marca) + ' ' + AutoCRMUI.escapeHTML(v.modelo) + '</div>' +
            '<div class="text-muted-2 small">' + AutoCRMUI.escapeHTML(v.cor || 'Cor não informada') + (v.ano ? ' · ' + v.ano : '') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  document.getElementById('listaVeiculosCliente').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-vacao]');
    if (!btn) return;
    var vid = btn.getAttribute('data-vid');
    var vacao = btn.getAttribute('data-vacao');
    if (vacao === 'editar') carregarVeiculoNoForm(vid);
    else if (vacao === 'excluir') excluirVeiculo(vid);
  });

  function resetarFormVeiculo() {
    document.getElementById('formVeiculo').reset();
    document.getElementById('veiculoId').value = '';
    document.getElementById('btnSalvarVeiculo').innerHTML = '<i class="bi bi-plus-lg"></i>';
    document.getElementById('btnSalvarVeiculo').title = 'Adicionar';
    document.getElementById('btnCancelarEdicaoVeiculo').classList.add('d-none');
  }

  function carregarVeiculoNoForm(id) {
    var v = DB.find('veiculos', id);
    if (!v) return;
    document.getElementById('veiculoId').value = v.id;
    document.getElementById('veiculoPlaca').value = v.placa;
    document.getElementById('veiculoMarca').value = v.marca;
    document.getElementById('veiculoModelo').value = v.modelo;
    document.getElementById('veiculoCor').value = v.cor || '';
    document.getElementById('veiculoAno').value = v.ano || '';
    document.getElementById('btnSalvarVeiculo').innerHTML = '<i class="bi bi-check-lg"></i>';
    document.getElementById('btnSalvarVeiculo').title = 'Salvar alterações';
    document.getElementById('btnCancelarEdicaoVeiculo').classList.remove('d-none');
    document.getElementById('veiculoPlaca').focus();
  }

  document.getElementById('btnCancelarEdicaoVeiculo').addEventListener('click', resetarFormVeiculo);

  document.getElementById('veiculoPlaca').addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  });

  document.getElementById('formVeiculo').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('veiculoId').value;
    var dados = {
      clienteId: clienteAtualId,
      placa: document.getElementById('veiculoPlaca').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7),
      marca: document.getElementById('veiculoMarca').value.trim(),
      modelo: document.getElementById('veiculoModelo').value.trim(),
      cor: document.getElementById('veiculoCor').value.trim(),
      ano: document.getElementById('veiculoAno').value ? Number(document.getElementById('veiculoAno').value) : null
    };
    if (!dados.placa || !dados.marca || !dados.modelo) {
      AutoCRMUI.toast('Preencha placa, marca e modelo.', 'warning');
      return;
    }
    if (id) {
      DB.update('veiculos', id, dados);
      AutoCRMUI.toast('Veículo atualizado.', 'success');
    } else {
      DB.insert('veiculos', dados);
      AutoCRMUI.toast('Veículo adicionado.', 'success');
    }
    resetarFormVeiculo();
    renderizarListaVeiculos();
    renderizarLista();
  });

  function excluirVeiculo(id) {
    var v = DB.find('veiculos', id);
    if (!v) return;
    var vinculadas = DB.where('ordens', function (o) { return o.veiculoId === id; }).length;
    if (vinculadas > 0) {
      AutoCRMUI.toast('Não é possível excluir: há ' + vinculadas + ' ordem(ns) de serviço vinculada(s) a este veículo.', 'danger');
      return;
    }
    AutoCRMUI.confirmar({
      titulo: 'Excluir veículo',
      mensagem: 'Tem certeza que deseja excluir o veículo ' + v.placa + '?',
      textoConfirmar: 'Excluir'
    }).then(function (ok) {
      if (!ok) return;
      DB.remove('veiculos', id);
      AutoCRMUI.toast('Veículo excluído.', 'success');
      renderizarListaVeiculos();
      renderizarLista();
    });
  }

  renderizarLista();
})();
