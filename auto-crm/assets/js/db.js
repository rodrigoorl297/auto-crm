/* =====================================================================
   AutoCRM — Camada de dados (db.js)
   ---------------------------------------------------------------------
   Tudo é guardado no localStorage do navegador (sem backend/servidor).
   Isso é ótimo para testar e usar em um computador só, mas os dados
   NÃO sincronizam entre dispositivos/funcionários — cada navegador tem
   sua própria "base". Veja o README.md para como migrar para um
   backend real (ex.: Supabase) quando precisar disso.

   MODELO DE DADOS (cada coleção é um array salvo sob uma chave própria)
   ---------------------------------------------------------------------
   usuarios[]     { id, nome, email, senhaHash, perfil, ativo, criadoEm }
   clientes[]     { id, nome, telefone, email, documento, endereco,
                     observacoes, criadoEm }
   veiculos[]     { id, clienteId, placa, marca, modelo, cor, ano, criadoEm }
   servicos[]     { id, nome, precoSugerido, ativo }   (catálogo de serviços)
   ordens[]       { id, numero, clienteId, veiculoId, itens[{nome,valor}],
                     responsavelId, status, dataAgendada, dataConclusao,
                     formaPagamento, statusPagamento, valorTotal,
                     observacoes, criadoEm }
   produtos[]     { id, nome, categoria, unidade, quantidade,
                     estoqueMinimo, precoCusto, criadoEm }
   movimentacoes[]{ id, produtoId, tipo, quantidade, motivo, criadoEm }
   lancamentos[]  { id, tipo, categoria, descricao, valor, data,
                     ordemId, criadoEm }

   perfil ∈ 'admin' | 'atendente' | 'financeiro'
   status (ordem) ∈ 'agendado' | 'em_andamento' | 'concluido' | 'cancelado'
   statusPagamento ∈ 'pendente' | 'parcial' | 'pago'
   tipo (movimentação) ∈ 'entrada' | 'saida'
   tipo (lançamento) ∈ 'receita' | 'despesa'
   ===================================================================== */

(function (global) {
  'use strict';

  var PREFIXO = 'autocrm_';
  var CHAVE_SEED = PREFIXO + 'seed_v1';
  var cache = Object.create(null);

  function chave(nome) { return PREFIXO + nome; }

  function invalidarCache(nome) {
    if (nome) delete cache[nome];
    else cache = Object.create(null);
  }

  function ler(nome, valorPadrao) {
    if (Object.prototype.hasOwnProperty.call(cache, nome)) return cache[nome];
    try {
      var bruto = localStorage.getItem(chave(nome));
      var valor = bruto ? JSON.parse(bruto) : valorPadrao;
      cache[nome] = valor;
      return valor;
    } catch (erro) {
      console.error('[AutoCRM] Erro ao ler "' + nome + '":', erro);
      return valorPadrao;
    }
  }

  function escrever(nome, valor) {
    cache[nome] = valor;
    try {
      localStorage.setItem(chave(nome), JSON.stringify(valor));
      return true;
    } catch (erro) {
      invalidarCache(nome);
      console.error('[AutoCRM] Erro ao salvar "' + nome + '":', erro);
      if (global.AutoCRMUI && global.AutoCRMUI.toast) {
        global.AutoCRMUI.toast('Não foi possível salvar os dados (armazenamento local cheio ou bloqueado).', 'danger');
      }
      return false;
    }
  }

  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function agora() { return new Date().toISOString(); }

  // Retorna um ISO string relativo a "hoje", útil para os dados de
  // exemplo sempre parecerem atuais, não importa quando o CRM é aberto.
  function diasAtras(n, horas, minutos) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(horas === undefined ? 9 : horas, minutos || 0, 0, 0);
    return d.toISOString();
  }

  function diasNaFrente(n, horas, minutos) {
    return diasAtras(-n, horas, minutos);
  }

  // ---- API genérica de coleções ----------------------------------------

  var DB = {
    uid: uid,
    agora: agora,
    diasAtras: diasAtras,
    diasNaFrente: diasNaFrente,

    all: function (colecao) {
      return ler(colecao, []);
    },

    saveAll: function (colecao, lista) {
      return escrever(colecao, lista);
    },

    find: function (colecao, id) {
      var lista = this.all(colecao);
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].id === id) return lista[i];
      }
      return null;
    },

    mapById: function (colecao) {
      var lista = this.all(colecao);
      var mapa = Object.create(null);
      for (var i = 0; i < lista.length; i++) mapa[lista[i].id] = lista[i];
      return mapa;
    },

    groupBy: function (colecao, chaveCampo) {
      var lista = this.all(colecao);
      var mapa = Object.create(null);
      for (var i = 0; i < lista.length; i++) {
        var k = lista[i][chaveCampo];
        if (!mapa[k]) mapa[k] = [];
        mapa[k].push(lista[i]);
      }
      return mapa;
    },

    where: function (colecao, predicado) {
      return this.all(colecao).filter(predicado);
    },

    insert: function (colecao, dados) {
      var lista = this.all(colecao);
      var item = Object.assign({ id: uid(), criadoEm: agora() }, dados);
      lista.push(item);
      this.saveAll(colecao, lista);
      return item;
    },

    update: function (colecao, id, patch) {
      var lista = this.all(colecao);
      var indice = -1;
      for (var i = 0; i < lista.length; i++) { if (lista[i].id === id) { indice = i; break; } }
      if (indice === -1) return null;
      lista[indice] = Object.assign({}, lista[indice], patch, { atualizadoEm: agora() });
      this.saveAll(colecao, lista);
      return lista[indice];
    },

    remove: function (colecao, id) {
      var lista = this.all(colecao);
      var nova = lista.filter(function (item) { return item.id !== id; });
      this.saveAll(colecao, nova);
      return nova.length !== lista.length;
    },

    proximoNumeroOS: function () {
      var atual = parseInt(localStorage.getItem(chave('seq_os')) || '1000', 10);
      var proximo = atual + 1;
      localStorage.setItem(chave('seq_os'), String(proximo));
      return proximo;
    },

    // Soma os lançamentos de receita já registrados para uma ordem —
    // usado para saber quanto falta receber (pagamentos parciais).
    totalPagoOrdem: function (ordemId) {
      return this.all('lancamentos')
        .filter(function (l) { return l.tipo === 'receita' && l.ordemId === ordemId; })
        .reduce(function (soma, l) { return soma + l.valor; }, 0);
    },

    // Some para produção: limpa tudo e recarrega os dados de exemplo.
    resetarTudo: function () {
      Object.keys(localStorage)
        .filter(function (k) { return k.indexOf(PREFIXO) === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
      invalidarCache();
      DB.init(true);
    },

    // Apaga só os dados de exemplo/seed, mantendo a estrutura (coleções
    // vazias) — use quando for começar a usar o sistema "pra valer".
    limparDadosDeExemplo: function () {
      ['clientes', 'veiculos', 'ordens', 'produtos', 'movimentacoes', 'lancamentos']
        .forEach(function (c) { DB.saveAll(c, []); });
      localStorage.setItem(chave('seq_os'), '1000');
    },

    init: function (forcar) {
      var jaSemeado = localStorage.getItem(CHAVE_SEED);
      if (jaSemeado && !forcar) return;
      semear();
      localStorage.setItem(CHAVE_SEED, agora());
    }
  };

  // ---- dados de exemplo (seed) ------------------------------------------

  function semear() {
    // Usuários — as senhas abaixo são só para você testar cada perfil.
    // O que fica salvo é o HASH (SHA-256) da senha, nunca o texto puro.
    // admin@autocrm.com      / admin123
    // atendente@autocrm.com  / atendente123
    // financeiro@autocrm.com / financeiro123
    var uAdmin = uid(), uAtendente = uid(), uFinanceiro = uid();
    DB.saveAll('usuarios', [
      {
        id: uAdmin, nome: 'Administrador', email: 'admin@autocrm.com',
        senhaHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
        perfil: 'admin', ativo: true, criadoEm: diasAtras(180)
      },
      {
        id: uAtendente, nome: 'Ana Souza', email: 'atendente@autocrm.com',
        senhaHash: 'e94e143d3a999c2004bed70fdc93ae37470fb3c3c5cd328fa20fbd053e65c4f9',
        perfil: 'atendente', ativo: true, criadoEm: diasAtras(150)
      },
      {
        id: uFinanceiro, nome: 'Paulo Ferreira', email: 'financeiro@autocrm.com',
        senhaHash: '18aaf426c24faf79a69d66ab71e66d2a8e6e4d593af11863ab6f41ca04833848',
        perfil: 'financeiro', ativo: true, criadoEm: diasAtras(150)
      }
    ]);

    // Catálogo de serviços
    var servicos = [
      { nome: 'Lavagem Simples', precoSugerido: 40 },
      { nome: 'Lavagem Completa', precoSugerido: 70 },
      { nome: 'Lavagem Detalhada', precoSugerido: 150 },
      { nome: 'Polimento Técnico', precoSugerido: 350 },
      { nome: 'Vitrificação de Pintura', precoSugerido: 900 },
      { nome: 'Higienização Interna Completa', precoSugerido: 280 },
      { nome: 'Cristalização de Vidros', precoSugerido: 120 },
      { nome: 'Hidratação de Bancos em Couro', precoSugerido: 100 }
    ].map(function (s) { return Object.assign({ id: uid(), ativo: true, criadoEm: diasAtras(180) }, s); });
    DB.saveAll('servicos', servicos);

    // Clientes
    var clientesBase = [
      { nome: 'Marcos Vinícius Oliveira', telefone: '(62) 99123-4501', email: 'marcos.oliveira@gmail.com', documento: '123.456.789-01', endereco: 'Rua T-30, 450 - Setor Bueno, Goiânia/GO' },
      { nome: 'Fernanda Lima Souza', telefone: '(62) 98234-1187', email: 'fe.lima@gmail.com', documento: '234.567.890-12', endereco: 'Av. T-9, 1200 - Setor Bueno, Goiânia/GO' },
      { nome: 'Rafael Costa Andrade', telefone: '(62) 99876-2233', email: 'rafael.andrade@hotmail.com', documento: '345.678.901-23', endereco: 'Rua 84, 320 - Setor Sul, Goiânia/GO' },
      { nome: 'Juliana Pereira Rocha', telefone: '(62) 98111-4455', email: 'ju.rocha@outlook.com', documento: '456.789.012-34', endereco: 'Av. Anhanguera, 2100 - Centro, Goiânia/GO' },
      { nome: 'Eduardo Santos Barbosa', telefone: '(62) 99345-7788', email: 'eduardo.barbosa@gmail.com', documento: '567.890.123-45', endereco: 'Rua C-135, 88 - Jardim América, Goiânia/GO' },
      { nome: 'Camila Rodrigues Nunes', telefone: '(62) 98456-9911', email: 'camila.nunes@gmail.com', documento: '678.901.234-56', endereco: 'Av. Perimetral Norte, 500 - Goiânia/GO' }
    ];
    var clientes = clientesBase.map(function (c, i) {
      return Object.assign({ id: uid(), observacoes: '', criadoEm: diasAtras(160 - i * 10) }, c);
    });
    DB.saveAll('clientes', clientes);

    var veiculosBase = [
      { c: 0, placa: 'QLK4B18', marca: 'Volkswagen', modelo: 'T-Cross', cor: 'Branco', ano: 2023 },
      { c: 1, placa: 'RTV2C45', marca: 'Chevrolet', modelo: 'Onix Plus', cor: 'Prata', ano: 2022 },
      { c: 1, placa: 'PLM8D02', marca: 'Fiat', modelo: 'Pulse', cor: 'Cinza', ano: 2024 },
      { c: 2, placa: 'SDK1E77', marca: 'Toyota', modelo: 'Corolla', cor: 'Preto', ano: 2021 },
      { c: 3, placa: 'HTB3F29', marca: 'Hyundai', modelo: 'Creta', cor: 'Vermelho', ano: 2023 },
      { c: 4, placa: 'MXP6G54', marca: 'Honda', modelo: 'Civic', cor: 'Branco', ano: 2020 },
      { c: 5, placa: 'JBN9H61', marca: 'Jeep', modelo: 'Compass', cor: 'Azul', ano: 2022 },
      { c: 5, placa: 'FQW5J83', marca: 'Renault', modelo: 'Kwid', cor: 'Laranja', ano: 2021 }
    ];
    var veiculos = veiculosBase.map(function (v) {
      return { id: uid(), clienteId: clientes[v.c].id, placa: v.placa, marca: v.marca, modelo: v.modelo, cor: v.cor, ano: v.ano, criadoEm: clientes[v.c].criadoEm };
    });
    DB.saveAll('veiculos', veiculos);

    // Produtos / insumos de estoque (alguns propositalmente abaixo do mínimo)
    var produtosBase = [
      { nome: 'Shampoo Automotivo Concentrado', categoria: 'Limpeza', unidade: 'Litro', quantidade: 12, estoqueMinimo: 5, precoCusto: 28 },
      { nome: 'Cera de Carnaúba Premium', categoria: 'Proteção', unidade: 'Pote', quantidade: 8, estoqueMinimo: 3, precoCusto: 65 },
      { nome: 'Cristalizador de Vidros', categoria: 'Proteção', unidade: 'Unidade', quantidade: 2, estoqueMinimo: 4, precoCusto: 90 },
      { nome: 'Pretinho para Pneu', categoria: 'Acabamento', unidade: 'Litro', quantidade: 6, estoqueMinimo: 3, precoCusto: 22 },
      { nome: 'Toalha de Microfibra', categoria: 'Acessórios', unidade: 'Unidade', quantidade: 25, estoqueMinimo: 10, precoCusto: 9 },
      { nome: 'Polidor de Pintura (composto)', categoria: 'Polimento', unidade: 'Unidade', quantidade: 3, estoqueMinimo: 4, precoCusto: 75 },
      { nome: 'APC - Limpador Multiuso', categoria: 'Limpeza', unidade: 'Litro', quantidade: 10, estoqueMinimo: 5, precoCusto: 32 },
      { nome: 'Selante de Pintura', categoria: 'Proteção', unidade: 'Unidade', quantidade: 1, estoqueMinimo: 3, precoCusto: 110 }
    ];
    var produtos = produtosBase.map(function (p, i) {
      return Object.assign({ id: uid(), criadoEm: diasAtras(170 - i * 5) }, p);
    });
    DB.saveAll('produtos', produtos);
    DB.saveAll('movimentacoes', produtos.map(function (p) {
      return { id: uid(), produtoId: p.id, tipo: 'entrada', quantidade: p.quantidade, motivo: 'Estoque inicial', criadoEm: p.criadoEm };
    }));

    // Ordens de serviço — espalhadas nos últimos ~5 meses, com status variados,
    // para o dashboard e o financeiro terem dados interessantes de mostrar.
    var responsaveis = [uAtendente, uAdmin];
    function item(nome, valor) { return { nome: nome, valor: valor }; }

    var ordensBase = [
      { cliente: 0, veiculo: 0, dias: 118, status: 'concluido', pagamento: 'pago', itens: [item('Lavagem Completa', 70), item('Cristalização de Vidros', 120)] },
      { cliente: 1, veiculo: 1, dias: 95, status: 'concluido', pagamento: 'pago', itens: [item('Polimento Técnico', 350)] },
      { cliente: 2, veiculo: 3, dias: 80, status: 'concluido', pagamento: 'pago', itens: [item('Vitrificação de Pintura', 900)] },
      { cliente: 3, veiculo: 4, dias: 63, status: 'concluido', pagamento: 'pago', itens: [item('Higienização Interna Completa', 280), item('Lavagem Completa', 70)] },
      { cliente: 4, veiculo: 5, dias: 47, status: 'concluido', pagamento: 'pago', itens: [item('Lavagem Simples', 40)] },
      { cliente: 5, veiculo: 6, dias: 33, status: 'concluido', pagamento: 'pago', itens: [item('Hidratação de Bancos em Couro', 100), item('Lavagem Completa', 70)] },
      { cliente: 1, veiculo: 2, dias: 21, status: 'concluido', pagamento: 'pago', itens: [item('Lavagem Detalhada', 150)] },
      { cliente: 0, veiculo: 0, dias: 14, status: 'concluido', pagamento: 'parcial', itens: [item('Polimento Técnico', 350), item('Cristalização de Vidros', 120)] },
      { cliente: 2, veiculo: 3, dias: 9, status: 'concluido', pagamento: 'pago', itens: [item('Lavagem Completa', 70)] },
      { cliente: 3, veiculo: 4, dias: 5, status: 'em_andamento', pagamento: 'pendente', itens: [item('Vitrificação de Pintura', 900)] },
      { cliente: 4, veiculo: 5, dias: 2, status: 'em_andamento', pagamento: 'pendente', itens: [item('Higienização Interna Completa', 280)] },
      { cliente: 5, veiculo: 7, dias: 1, status: 'agendado', pagamento: 'pendente', itens: [item('Lavagem Simples', 40)] },
      { cliente: 1, veiculo: 1, dias: 0, status: 'agendado', pagamento: 'pendente', itens: [item('Polimento Técnico', 350)] },
      { cliente: 0, veiculo: 0, dias: -2, status: 'agendado', pagamento: 'pendente', itens: [item('Lavagem Completa', 70)] },
      { cliente: 2, veiculo: 3, dias: 40, status: 'cancelado', pagamento: 'pendente', itens: [item('Vitrificação de Pintura', 900)] }
    ];

    var ordens = ordensBase.map(function (o, i) {
      var valorTotal = o.itens.reduce(function (s, it) { return s + it.valor; }, 0);
      var criadoEm = diasAtras(o.dias + 1);
      var dataAgendada = diasAtras(o.dias, 10, 0);
      var dataConclusao = (o.status === 'concluido') ? diasAtras(o.dias, 16, 30) : null;
      return {
        id: uid(),
        numero: DB.proximoNumeroOS(),
        clienteId: clientes[o.cliente].id,
        veiculoId: veiculos[o.veiculo].id,
        itens: o.itens,
        responsavelId: responsaveis[i % responsaveis.length],
        status: o.status,
        dataAgendada: dataAgendada,
        dataConclusao: dataConclusao,
        formaPagamento: o.pagamento === 'pendente' ? '' : 'Pix',
        statusPagamento: o.pagamento,
        valorTotal: valorTotal,
        observacoes: '',
        criadoEm: criadoEm
      };
    });
    DB.saveAll('ordens', ordens);

    // Lançamentos financeiros: receita para toda ordem paga (total ou parcial)
    // + algumas despesas soltas de exemplo.
    var lancamentos = [];
    ordens.forEach(function (o) {
      var nomeClienteOrdem = DB.find('clientes', o.clienteId) ? DB.find('clientes', o.clienteId).nome : 'Cliente removido';
      if (o.statusPagamento === 'pago') {
        lancamentos.push({
          id: uid(), tipo: 'receita', categoria: 'Ordem de Serviço',
          descricao: 'Pagamento OS #' + o.numero + ' — ' + nomeClienteOrdem, valor: o.valorTotal,
          data: o.dataConclusao || o.criadoEm, ordemId: o.id, criadoEm: o.dataConclusao || o.criadoEm
        });
      } else if (o.statusPagamento === 'parcial') {
        var pago = Math.round(o.valorTotal * 0.5);
        lancamentos.push({
          id: uid(), tipo: 'receita', categoria: 'Ordem de Serviço',
          descricao: 'Pagamento parcial OS #' + o.numero + ' — ' + nomeClienteOrdem, valor: pago,
          data: o.criadoEm, ordemId: o.id, criadoEm: o.criadoEm
        });
      }
    });
    var despesasBase = [
      { dias: 110, categoria: 'Compras', descricao: 'Compra de produtos de limpeza', valor: 480 },
      { dias: 75, categoria: 'Contas', descricao: 'Conta de energia elétrica', valor: 320 },
      { dias: 60, categoria: 'Aluguel', descricao: 'Aluguel do box', valor: 1800 },
      { dias: 44, categoria: 'Compras', descricao: 'Compra de ceras e selantes', valor: 610 },
      { dias: 30, categoria: 'Contas', descricao: 'Conta de água', valor: 150 },
      { dias: 30, categoria: 'Aluguel', descricao: 'Aluguel do box', valor: 1800 },
      { dias: 12, categoria: 'Manutenção', descricao: 'Manutenção da lavadora de alta pressão', valor: 240 }
    ];
    despesasBase.forEach(function (d) {
      lancamentos.push({
        id: uid(), tipo: 'despesa', categoria: d.categoria, descricao: d.descricao,
        valor: d.valor, data: diasAtras(d.dias), ordemId: null, criadoEm: diasAtras(d.dias)
      });
    });
    DB.saveAll('lancamentos', lancamentos);
  }

  global.DB = DB;
})(window);
