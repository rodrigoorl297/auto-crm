/* =====================================================================
   AutoCRM — Estoque (estoque.js)
   A quantidade de um produto só muda por "Movimentar" (entrada/saída),
   nunca por edição direta — assim o histórico de movimentações sempre
   bate com a quantidade atual.
   ===================================================================== */

(function () {
  'use strict';

  var sessao = AutoCRMAuth.requireAuth('estoque');
  if (!sessao) return;
  DB.init();
  AutoCRMUI.montarShell({ modulo: 'estoque', titulo: 'Estoque', subtitulo: 'Produtos e insumos usados nos serviços' });

  var corpoProdutos = document.getElementById('corpoTabelaProdutos');
  var campoBusca = document.getElementById('campoBusca');
  var modalProduto = new bootstrap.Modal(document.getElementById('modalProduto'));
  var modalMovimentacao = new bootstrap.Modal(document.getElementById('modalMovimentacao'));

  // --------------------------------------------------------------- cards

  function montarCards() {
    var produtos = DB.all('produtos');
    var baixo = produtos.filter(function (p) { return p.quantidade <= p.estoqueMinimo; });
    var valorTotal = produtos.reduce(function (s, p) { return s + (p.quantidade * (p.precoCusto || 0)); }, 0);

    var cards = [
      { label: 'Produtos cadastrados', valor: produtos.length, icone: 'bi-box-seam', tint: 'accent' },
      { label: 'Estoque baixo', valor: baixo.length, icone: 'bi-exclamation-triangle', tint: baixo.length ? 'danger' : 'success' },
      { label: 'Valor total em estoque', valor: AutoCRMUI.formatarMoeda(valorTotal), icone: 'bi-cash-stack', tint: 'info' }
    ];
    document.getElementById('cardsEstoque').innerHTML = cards.map(function (c) {
      return '<div class="col-sm-6 col-xl-4"><div class="stat-card">' +
        '<span class="stat-icon icon-tint-' + c.tint + '"><i class="bi ' + c.icone + '"></i></span>' +
        '<div class="stat-valor">' + c.valor + '</div>' +
        '<div class="stat-label">' + c.label + '</div>' +
      '</div></div>';
    }).join('');
  }

  // --------------------------------------------------------------- tabela produtos

  function renderizarTabela() {
    var termo = campoBusca.value.trim().toLowerCase();
    var produtos = DB.all('produtos')
      .filter(function (p) { return !termo || (p.nome + ' ' + p.categoria).toLowerCase().indexOf(termo) !== -1; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

    if (!produtos.length) {
      corpoProdutos.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-box-seam"></i>Nenhum produto encontrado.</div></td></tr>';
      return;
    }

    corpoProdutos.innerHTML = produtos.map(function (p) {
      var baixo = p.quantidade <= p.estoqueMinimo;
      return '<tr>' +
        '<td class="fw-semibold">' + AutoCRMUI.escapeHTML(p.nome) + '</td>' +
        '<td class="text-muted-2">' + AutoCRMUI.escapeHTML(p.categoria) + '</td>' +
        '<td>' +
          '<div>' + p.quantidade + ' ' + AutoCRMUI.escapeHTML(p.unidade) + '</div>' +
          '<div class="progress-estoque' + (baixo ? ' baixo' : '') + ' mt-1" style="max-width:88px"><span style="width:' + Math.min(100, Math.round((p.quantidade / Math.max(1, p.estoqueMinimo * 2)) * 100)) + '%"></span></div>' +
        '</td>' +
        '<td class="text-muted-2">' + p.estoqueMinimo + '</td>' +
        '<td><span class="badge-status badge-' + (baixo ? 'baixo' : 'ok') + '">' + (baixo ? 'Baixo' : 'OK') + '</span></td>' +
        '<td class="text-muted-2">' + AutoCRMUI.formatarMoeda(p.precoCusto || 0) + '</td>' +
        '<td class="text-end text-nowrap">' +
          '<button class="btn btn-sm btn-outline-primary me-1" data-acao="movimentar" data-id="' + p.id + '" title="Movimentar"><i class="bi bi-arrow-left-right"></i></button>' +
          '<button class="btn btn-sm btn-outline-secondary me-1" data-acao="editar" data-id="' + p.id + '" title="Editar"><i class="bi bi-pencil"></i></button>' +
          '<button class="btn btn-sm btn-outline-danger" data-acao="excluir" data-id="' + p.id + '" title="Excluir"><i class="bi bi-trash"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  corpoProdutos.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-acao]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var acao = btn.getAttribute('data-acao');
    if (acao === 'editar') abrirEditarProduto(id);
    else if (acao === 'excluir') excluirProduto(id);
    else if (acao === 'movimentar') abrirMovimentacao(id);
  });

  campoBusca.addEventListener('input', AutoCRMUI.debounce(renderizarTabela, 200));

  // --------------------------------------------------------------- modal produto

  function limparFormProduto() {
    document.getElementById('formProduto').reset();
    document.getElementById('produtoId').value = '';
    document.getElementById('grupoQuantidadeInicial').classList.remove('d-none');
    document.getElementById('produtoQuantidade').required = true;
    document.getElementById('avisoEdicaoQuantidade').classList.add('d-none');
  }

  document.getElementById('btnNovoProduto').addEventListener('click', function () {
    limparFormProduto();
    document.getElementById('tituloModalProduto').textContent = 'Novo Produto';
    modalProduto.show();
  });

  function abrirEditarProduto(id) {
    var p = DB.find('produtos', id);
    if (!p) return;
    limparFormProduto();
    document.getElementById('produtoId').value = p.id;
    document.getElementById('produtoNome').value = p.nome;
    document.getElementById('produtoCategoria').value = p.categoria;
    document.getElementById('produtoUnidade').value = p.unidade;
    document.getElementById('produtoEstoqueMinimo').value = p.estoqueMinimo;
    document.getElementById('produtoPrecoCusto').value = p.precoCusto || '';
    document.getElementById('grupoQuantidadeInicial').classList.add('d-none');
    document.getElementById('produtoQuantidade').required = false;
    document.getElementById('avisoEdicaoQuantidade').classList.remove('d-none');
    document.getElementById('tituloModalProduto').textContent = 'Editar Produto';
    modalProduto.show();
  }

  document.getElementById('formProduto').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('produtoId').value;
    var dados = {
      nome: document.getElementById('produtoNome').value.trim(),
      categoria: document.getElementById('produtoCategoria').value.trim(),
      unidade: document.getElementById('produtoUnidade').value.trim(),
      estoqueMinimo: Number(document.getElementById('produtoEstoqueMinimo').value) || 0,
      precoCusto: Number(document.getElementById('produtoPrecoCusto').value) || 0
    };
    if (!dados.nome || !dados.categoria || !dados.unidade) {
      AutoCRMUI.toast('Preencha nome, categoria e unidade.', 'warning');
      return;
    }

    if (id) {
      DB.update('produtos', id, dados);
      AutoCRMUI.toast('Produto atualizado.', 'success');
    } else {
      var quantidadeInicial = Number(document.getElementById('produtoQuantidade').value) || 0;
      dados.quantidade = quantidadeInicial;
      var novo = DB.insert('produtos', dados);
      DB.insert('movimentacoes', { produtoId: novo.id, tipo: 'entrada', quantidade: quantidadeInicial, motivo: 'Estoque inicial' });
      AutoCRMUI.toast('Produto cadastrado.', 'success');
    }

    modalProduto.hide();
    montarCards();
    renderizarTabela();
    renderizarMovimentacoes();
  });

  function excluirProduto(id) {
    var p = DB.find('produtos', id);
    if (!p) return;
    AutoCRMUI.confirmar({
      titulo: 'Excluir produto',
      mensagem: 'Tem certeza que deseja excluir "' + p.nome + '"? O histórico de movimentações deste produto também será removido.',
      textoConfirmar: 'Excluir'
    }).then(function (ok) {
      if (!ok) return;
      DB.where('movimentacoes', function (m) { return m.produtoId === id; }).forEach(function (m) { DB.remove('movimentacoes', m.id); });
      DB.remove('produtos', id);
      AutoCRMUI.toast('Produto excluído.', 'success');
      montarCards();
      renderizarTabela();
      renderizarMovimentacoes();
    });
  }

  // --------------------------------------------------------------- movimentação

  function abrirMovimentacao(id) {
    var p = DB.find('produtos', id);
    if (!p) return;
    document.getElementById('formMovimentacao').reset();
    document.getElementById('tipoEntrada').checked = true;
    document.getElementById('movimentacaoProdutoId').value = p.id;
    document.getElementById('movimentacaoProdutoNome').textContent = p.nome;
    document.getElementById('movimentacaoQuantidadeAtual').textContent = p.quantidade + ' ' + p.unidade;
    modalMovimentacao.show();
  }

  document.getElementById('formMovimentacao').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('movimentacaoProdutoId').value;
    var p = DB.find('produtos', id);
    if (!p) return;

    var tipo = document.querySelector('input[name="movimentacaoTipo"]:checked').value;
    var quantidade = Number(document.getElementById('movimentacaoQuantidade').value);
    var motivo = document.getElementById('movimentacaoMotivo').value.trim();

    if (!quantidade || quantidade <= 0) { AutoCRMUI.toast('Informe uma quantidade válida.', 'warning'); return; }
    if (!motivo) { AutoCRMUI.toast('Informe o motivo da movimentação.', 'warning'); return; }

    var novaQuantidade = tipo === 'entrada' ? p.quantidade + quantidade : p.quantidade - quantidade;
    if (novaQuantidade < 0) {
      AutoCRMUI.toast('Quantidade insuficiente em estoque (disponível: ' + p.quantidade + ' ' + p.unidade + ').', 'danger');
      return;
    }

    DB.update('produtos', id, { quantidade: novaQuantidade });
    DB.insert('movimentacoes', { produtoId: id, tipo: tipo, quantidade: quantidade, motivo: motivo });

    AutoCRMUI.toast('Movimentação registrada.', 'success');
    modalMovimentacao.hide();
    montarCards();
    renderizarTabela();
    renderizarMovimentacoes();
  });

  // --------------------------------------------------------------- histórico

  function renderizarMovimentacoes() {
    var movimentacoes = DB.all('movimentacoes').sort(function (a, b) { return new Date(b.criadoEm) - new Date(a.criadoEm); }).slice(0, 10);
    var corpo = document.getElementById('corpoTabelaMovimentacoes');
    if (!movimentacoes.length) {
      corpo.innerHTML = '<tr><td colspan="5"><div class="empty-state py-3"><i class="bi bi-arrow-left-right"></i>Nenhuma movimentação registrada ainda.</div></td></tr>';
      return;
    }
    corpo.innerHTML = movimentacoes.map(function (m) {
      var produto = DB.find('produtos', m.produtoId);
      var cor = m.tipo === 'entrada' ? 'var(--acrm-success)' : 'var(--acrm-danger)';
      var sinal = m.tipo === 'entrada' ? '+ ' : '− ';
      return '<tr>' +
        '<td class="text-muted-2" style="font-size:.82rem;">' + AutoCRMUI.formatarData(m.criadoEm, true) + '</td>' +
        '<td>' + AutoCRMUI.escapeHTML(produto ? produto.nome : 'Produto removido') + '</td>' +
        '<td style="color:' + cor + '">' + (m.tipo === 'entrada' ? 'Entrada' : 'Saída') + '</td>' +
        '<td style="color:' + cor + '">' + sinal + m.quantidade + '</td>' +
        '<td class="text-muted-2">' + AutoCRMUI.escapeHTML(m.motivo) + '</td>' +
      '</tr>';
    }).join('');
  }

  montarCards();
  renderizarTabela();
  renderizarMovimentacoes();
})();
