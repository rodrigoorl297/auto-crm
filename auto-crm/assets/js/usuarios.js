/* =====================================================================
   AutoCRM — Usuários (usuarios.js) — somente perfil Administrador
   ===================================================================== */

(function () {
  'use strict';

  var sessao = AutoCRMAuth.requireAuth('usuarios');
  if (!sessao) return;
  DB.init();
  AutoCRMUI.montarShell({ modulo: 'usuarios', titulo: 'Usuários', subtitulo: 'Quem acessa o sistema e com qual perfil' });

  var corpoTabela = document.getElementById('corpoTabelaUsuarios');
  var modalUsuario = new bootstrap.Modal(document.getElementById('modalUsuario'));

  function emailJaExiste(email, idIgnorar) {
    var alvo = email.toLowerCase().trim();
    return DB.all('usuarios').some(function (u) { return u.id !== idIgnorar && u.email.toLowerCase() === alvo; });
  }

  function contarAdminsAtivos(idExcluir) {
    return DB.all('usuarios').filter(function (u) { return u.perfil === 'admin' && u.ativo && u.id !== idExcluir; }).length;
  }

  // --------------------------------------------------------------- tabela

  function renderizarTabela() {
    var usuarios = DB.all('usuarios').sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    corpoTabela.innerHTML = usuarios.map(function (u) {
      return '<tr>' +
        '<td><div class="d-flex align-items-center gap-2">' +
          '<span class="avatar-usuario" style="width:32px;height:32px;font-size:.72rem;">' + AutoCRMUI.iniciais(u.nome) + '</span>' +
          '<div><div class="fw-semibold">' + AutoCRMUI.escapeHTML(u.nome) + (u.id === sessao.usuarioId ? ' <span class="text-muted-2" style="font-size:.74rem;">(você)</span>' : '') + '</div>' +
          '<div class="text-muted-2" style="font-size:.78rem;">' + AutoCRMUI.escapeHTML(u.email) + '</div></div>' +
        '</div></td>' +
        '<td>' + AutoCRMUI.badgePerfil(u.perfil) + '</td>' +
        '<td><span class="badge-status badge-' + (u.ativo ? 'ok' : 'baixo') + '">' + (u.ativo ? 'Ativo' : 'Inativo') + '</span></td>' +
        '<td class="text-muted-2">' + AutoCRMUI.formatarData(u.criadoEm) + '</td>' +
        '<td class="text-end text-nowrap">' +
          '<button class="btn btn-sm btn-outline-secondary me-1" data-acao="alternar" data-id="' + u.id + '" title="' + (u.ativo ? 'Desativar' : 'Ativar') + '"><i class="bi ' + (u.ativo ? 'bi-toggle-on' : 'bi-toggle-off') + '"></i></button>' +
          '<button class="btn btn-sm btn-outline-secondary me-1" data-acao="editar" data-id="' + u.id + '" title="Editar"><i class="bi bi-pencil"></i></button>' +
          '<button class="btn btn-sm btn-outline-danger" data-acao="excluir" data-id="' + u.id + '" title="Excluir"><i class="bi bi-trash"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  corpoTabela.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-acao]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var acao = btn.getAttribute('data-acao');
    if (acao === 'editar') abrirEditarUsuario(id);
    else if (acao === 'excluir') excluirUsuario(id);
    else if (acao === 'alternar') alternarAtivo(id);
  });

  // --------------------------------------------------------------- modal

  function limparFormUsuario() {
    document.getElementById('formUsuario').reset();
    document.getElementById('usuarioId').value = '';
    document.getElementById('usuarioAtivo').checked = true;
  }

  function modoCriacao() {
    document.getElementById('labelSenha').textContent = 'Senha *';
    document.getElementById('usuarioSenha').required = true;
    document.getElementById('dicaSenha').textContent = 'Mínimo de 6 caracteres.';
  }

  function modoEdicao() {
    document.getElementById('labelSenha').textContent = 'Nova senha';
    document.getElementById('usuarioSenha').required = false;
    document.getElementById('dicaSenha').textContent = 'Deixe em branco para manter a senha atual.';
  }

  document.getElementById('btnNovoUsuario').addEventListener('click', function () {
    limparFormUsuario();
    modoCriacao();
    document.getElementById('tituloModalUsuario').textContent = 'Novo Usuário';
    modalUsuario.show();
  });

  function abrirEditarUsuario(id) {
    var u = DB.find('usuarios', id);
    if (!u) return;
    limparFormUsuario();
    modoEdicao();
    document.getElementById('usuarioId').value = u.id;
    document.getElementById('usuarioNome').value = u.nome;
    document.getElementById('usuarioEmail').value = u.email;
    document.getElementById('usuarioPerfil').value = u.perfil;
    document.getElementById('usuarioAtivo').checked = !!u.ativo;
    document.getElementById('tituloModalUsuario').textContent = 'Editar Usuário';
    modalUsuario.show();
  }

  document.getElementById('formUsuario').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('usuarioId').value;
    var nome = document.getElementById('usuarioNome').value.trim();
    var email = document.getElementById('usuarioEmail').value.trim();
    var senha = document.getElementById('usuarioSenha').value;
    var perfil = document.getElementById('usuarioPerfil').value;
    var ativo = document.getElementById('usuarioAtivo').checked;

    if (!nome || !email) { AutoCRMUI.toast('Preencha nome e e-mail.', 'warning'); return; }
    if (emailJaExiste(email, id)) { AutoCRMUI.toast('Já existe um usuário com este e-mail.', 'danger'); return; }
    if (!id && (!senha || senha.length < 6)) { AutoCRMUI.toast('Defina uma senha com pelo menos 6 caracteres.', 'warning'); return; }
    if (senha && senha.length < 6) { AutoCRMUI.toast('A senha deve ter pelo menos 6 caracteres.', 'warning'); return; }

    if (id) {
      var atual = DB.find('usuarios', id);
      var perdeAdmin = atual.perfil === 'admin' && atual.ativo && (perfil !== 'admin' || !ativo);
      if (perdeAdmin && contarAdminsAtivos(id) === 0) {
        AutoCRMUI.toast('Não é possível concluir: este é o único administrador ativo do sistema.', 'danger');
        return;
      }
      if (id === sessao.usuarioId && !ativo) {
        AutoCRMUI.toast('Você não pode desativar o próprio usuário logado.', 'danger');
        return;
      }
    }

    var salvar = function (senhaHash) {
      var dados = { nome: nome, email: email, perfil: perfil, ativo: ativo };
      if (senhaHash) dados.senhaHash = senhaHash;
      if (id) {
        DB.update('usuarios', id, dados);
        AutoCRMUI.toast('Usuário atualizado.', 'success');
      } else {
        dados.senhaHash = senhaHash;
        DB.insert('usuarios', dados);
        AutoCRMUI.toast('Usuário cadastrado.', 'success');
      }
      modalUsuario.hide();
      renderizarTabela();
    };

    if (senha) {
      AutoCRMAuth.hashSenha(senha).then(salvar);
    } else {
      salvar(null);
    }
  });

  function excluirUsuario(id) {
    var u = DB.find('usuarios', id);
    if (!u) return;
    if (u.id === sessao.usuarioId) { AutoCRMUI.toast('Você não pode excluir o próprio usuário logado.', 'danger'); return; }
    if (u.perfil === 'admin' && u.ativo && contarAdminsAtivos(u.id) === 0) {
      AutoCRMUI.toast('Não é possível excluir: este é o único administrador ativo do sistema.', 'danger');
      return;
    }
    AutoCRMUI.confirmar({
      titulo: 'Excluir usuário',
      mensagem: 'Tem certeza que deseja excluir "' + u.nome + '"?',
      textoConfirmar: 'Excluir'
    }).then(function (ok) {
      if (!ok) return;
      DB.remove('usuarios', id);
      AutoCRMUI.toast('Usuário excluído.', 'success');
      renderizarTabela();
    });
  }

  function alternarAtivo(id) {
    var u = DB.find('usuarios', id);
    if (!u) return;
    if (u.id === sessao.usuarioId && u.ativo) { AutoCRMUI.toast('Você não pode desativar o próprio usuário logado.', 'danger'); return; }
    if (u.ativo && u.perfil === 'admin' && contarAdminsAtivos(u.id) === 0) {
      AutoCRMUI.toast('Não é possível desativar: este é o único administrador ativo do sistema.', 'danger');
      return;
    }
    var eraAtivo = u.ativo;
    DB.update('usuarios', id, { ativo: !eraAtivo });
    AutoCRMUI.toast('Usuário ' + (eraAtivo ? 'desativado' : 'ativado') + '.', 'success');
    renderizarTabela();
  }

  renderizarTabela();
})();
