/* ============================================================
   auth.js
   Tela de login, cadastro de novo usuário e controle de sessão.
   A sessão é mantida em sessionStorage (válida enquanto a aba
   do navegador estiver aberta). As senhas são armazenadas em
   texto simples no LocalStorage do navegador — adequado para uso
   local/offline, mas NÃO recomendado caso o sistema seja exposto
   publicamente sem um backend real (ver README "Melhorias Futuras").
   ============================================================ */

const Auth = {

  SESSION_KEY: 'cap_sessao',

  getUsuarioLogado() {
    const raw = sessionStorage.getItem(this.SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  estaLogado() {
    return !!this.getUsuarioLogado();
  },

  login(loginInformado, senhaInformada) {
    const usuarios = DB.getAll('usuarios');
    const usuario = usuarios.find(u =>
      u.login.toLowerCase() === loginInformado.trim().toLowerCase() && u.senha === senhaInformada
    );
    if (!usuario) return false;
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify({ id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil }));
    return true;
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    location.reload();
  },

  cadastrar({ nome, login, senha, perfil }) {
    const usuarios = DB.getAll('usuarios');
    if (usuarios.some(u => u.login.toLowerCase() === login.trim().toLowerCase())) {
      return { ok: false, erro: 'Já existe um usuário com este login.' };
    }
    DB.insert('usuarios', { nome, login, senha, perfil: perfil || 'Operador' });
    DB.log('Inclusão', 'usuario', `Usuário "${login}" cadastrado.`);
    return { ok: true };
  },

  /* ---------------- tela de login ---------------- */

  renderLoginScreen() {
    const overlay = document.getElementById('loginOverlay');
    overlay.classList.add('open');
    overlay.innerHTML = `
      <div class="login-box">
        <div class="login-brand">
          <span class="brand-mark">GP</span>
          <span class="brand-name">GestorPag</span>
        </div>

        <div id="loginForm">
          <h2>Entrar no sistema</h2>
          <div class="form-field"><label>Login</label><input id="loginUser" autocomplete="username"></div>
          <div class="form-field"><label>Senha</label><input id="loginPass" type="password" autocomplete="current-password"></div>
          <p id="loginErro" class="login-erro"></p>
          <button class="btn-primary" id="btnFazerLogin" style="width:100%;margin-top:6px;">Entrar</button>
          <p class="login-switch">Não tem conta? <a id="linkCadastrar">Cadastre-se</a></p>
          <p class="login-hint">Usuário padrão: <b>admin</b> / senha: <b>admin</b></p>
        </div>

        <div id="cadastroForm" style="display:none;">
          <h2>Criar novo usuário</h2>
          <div class="form-field"><label>Nome completo</label><input id="cadNome"></div>
          <div class="form-field"><label>Login</label><input id="cadLogin"></div>
          <div class="form-field"><label>Senha</label><input id="cadSenha" type="password"></div>
          <div class="form-field"><label>Perfil</label>
            <select id="cadPerfil"><option>Operador</option><option>Visualização</option><option>Administrador</option></select>
          </div>
          <p id="cadastroErro" class="login-erro"></p>
          <button class="btn-primary" id="btnCadastrarUsuario" style="width:100%;margin-top:6px;">Criar conta</button>
          <p class="login-switch">Já tem conta? <a id="linkVoltarLogin">Voltar ao login</a></p>
        </div>
      </div>
    `;

    const loginForm = document.getElementById('loginForm');
    const cadastroForm = document.getElementById('cadastroForm');

    document.getElementById('linkCadastrar').addEventListener('click', () => {
      loginForm.style.display = 'none';
      cadastroForm.style.display = 'block';
    });
    document.getElementById('linkVoltarLogin').addEventListener('click', () => {
      cadastroForm.style.display = 'none';
      loginForm.style.display = 'block';
    });

    const tentarLogin = () => {
      const u = document.getElementById('loginUser').value;
      const p = document.getElementById('loginPass').value;
      if (this.login(u, p)) {
        overlay.classList.remove('open');
        App.init();
      } else {
        document.getElementById('loginErro').textContent = 'Login ou senha inválidos.';
      }
    };
    document.getElementById('btnFazerLogin').addEventListener('click', tentarLogin);
    document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') tentarLogin(); });

    document.getElementById('btnCadastrarUsuario').addEventListener('click', () => {
      const nome = document.getElementById('cadNome').value.trim();
      const login = document.getElementById('cadLogin').value.trim();
      const senha = document.getElementById('cadSenha').value;
      const perfil = document.getElementById('cadPerfil').value;
      if (!nome || !login || !senha) {
        document.getElementById('cadastroErro').textContent = 'Preencha todos os campos.';
        return;
      }
      const res = this.cadastrar({ nome, login, senha, perfil });
      if (!res.ok) {
        document.getElementById('cadastroErro').textContent = res.erro;
        return;
      }
      this.login(login, senha);
      overlay.classList.remove('open');
      App.init();
    });
  },

  init() {
    if (this.estaLogado()) {
      App.init();
    } else {
      this.renderLoginScreen();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => Auth.init());
