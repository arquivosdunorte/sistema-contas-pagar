/* ============================================================
   database.js
   Camada de persistência local (LocalStorage) do sistema.
   Expõe o objeto global DB com métodos CRUD genéricos por
   "tabela" (coleção), além de rotinas de seed, backup,
   exportação e importação de dados.
   ============================================================ */

const DB_PREFIX = 'cap_'; // Contas A Pagar

const DB_TABLES = [
  'beneficiarios',
  'pagadores',
  'contas',
  'tiposConta',
  'centrosCusto',
  'tiposCusto',
  'usuarios',
  'historico',
  'config'
];

const DB = {

  /* ---------- núcleo genérico ---------- */

  _key(table) {
    return DB_PREFIX + table;
  },

  getAll(table) {
    const raw = localStorage.getItem(this._key(table));
    return raw ? JSON.parse(raw) : [];
  },

  saveAll(table, list) {
    localStorage.setItem(this._key(table), JSON.stringify(list));
  },

  getById(table, id) {
    return this.getAll(table).find(item => item.id === id) || null;
  },

  insert(table, obj) {
    const list = this.getAll(table);
    obj.id = obj.id || this._nextId(table);
    obj.criadoEm = obj.criadoEm || new Date().toISOString();
    obj.atualizadoEm = new Date().toISOString();
    list.push(obj);
    this.saveAll(table, list);
    return obj;
  },

  update(table, id, changes) {
    const list = this.getAll(table);
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...changes, id, atualizadoEm: new Date().toISOString() };
    this.saveAll(table, list);
    return list[idx];
  },

  remove(table, id) {
    const list = this.getAll(table).filter(i => i.id !== id);
    this.saveAll(table, list);
  },

  _nextId(table) {
    const list = this.getAll(table);
    const max = list.reduce((m, i) => Math.max(m, Number(i.id) || 0), 0);
    return max + 1;
  },

  /* ---------- histórico / auditoria ---------- */

  log(acao, entidade, descricao) {
    const list = this.getAll('historico');
    list.unshift({
      id: this._nextId('historico'),
      data: new Date().toISOString(),
      acao,        // Inclusão | Alteração | Exclusão | Pagamento
      entidade,    // conta | beneficiario | pagador ...
      descricao
    });
    this.saveAll('historico', list.slice(0, 500)); // limita histórico
  },

  /* ---------- backup / restauração ---------- */

  exportBackup() {
    const data = {};
    DB_TABLES.forEach(t => data[t] = this.getAll(t));
    return JSON.stringify(data, null, 2);
  },

  importBackup(jsonString) {
    const data = JSON.parse(jsonString);
    DB_TABLES.forEach(t => {
      if (data[t]) this.saveAll(t, data[t]);
    });
  },

  clearAll() {
    DB_TABLES.forEach(t => localStorage.removeItem(this._key(t)));
  },

  /* ---------- configurações (chave/valor único) ---------- */

  getConfig(chave, padrao = null) {
    const list = this.getAll('config');
    const item = list.find(i => i.chave === chave);
    return item ? item.valor : padrao;
  },

  setConfig(chave, valor) {
    const list = this.getAll('config');
    const idx = list.findIndex(i => i.chave === chave);
    if (idx === -1) list.push({ chave, valor });
    else list[idx].valor = valor;
    this.saveAll('config', list);
  },

  /* ---------- status automático das contas ----------
     Regra única de negócio, usada em todo o sistema:
     - Cancelada permanece Cancelada (controle manual)
     - Se a conta foi validada/confirmada -> Paga
     - Se não foi validada e o vencimento já passou -> Vencida
     - Caso contrário, mantém Agendada (se já estava) ou Aberta
  ----------------------------------------------------------- */
  calcularStatus(conta, hojeISO) {
    if (conta.status === 'Cancelada') return 'Cancelada';
    if (conta.validado) return 'Paga';
    if (conta.vencimento && conta.vencimento < hojeISO) return 'Vencida';
    if (conta.status === 'Agendada') return 'Agendada';
    return 'Aberta';
  },

  atualizarStatusContas() {
    const hoje = new Date().toISOString().slice(0, 10);
    const contas = this.getAll('contas');
    let mudou = false;
    contas.forEach(c => {
      const novo = this.calcularStatus(c, hoje);
      if (novo !== c.status) { c.status = novo; mudou = true; }
    });
    if (mudou) this.saveAll('contas', contas);
  },

  /* ---------- seed inicial ---------- */

  seedIfEmpty() {
    if (this.getAll('tiposConta').length === 0) {
      ['Fornecedor', 'Impostos', 'Salários', 'Energia', 'Água', 'Aluguel',
        'Financiamentos', 'Serviços', 'Compras', 'Outros']
        .forEach(nome => this.insert('tiposConta', { nome }));
    }

    if (this.getAll('centrosCusto').length === 0) {
      ['Administrativo', 'Produção', 'Comercial', 'Logística', 'Manutenção', 'Financeiro']
        .forEach(nome => this.insert('centrosCusto', { nome }));
    }

    if (this.getAll('tiposCusto').length === 0) {
      ['Fixo', 'Variável', 'Investimento', 'Emergencial']
        .forEach(nome => this.insert('tiposCusto', { nome }));
    }

    if (this.getAll('usuarios').length === 0) {
      this.insert('usuarios', {
        nome: 'Administrador', login: 'admin', senha: 'admin', perfil: 'Administrador'
      });
    }

    /* Observação: tiposConta, centrosCusto e tiposCusto são tabelas
       globais (não vinculadas a um pagador/empresa específico), portanto
       já são compartilhadas automaticamente por todas as empresas
       (pagadores) cadastradas no sistema. */
    if (this.getAll('pagadores').length === 0) {
      this.insert('pagadores', {
        nomeEmpresa: 'Minha Empresa LTDA', cnpj: '', endereco: '',
        responsavel: '', telefone: '', bancoPrincipal: '', contaBancaria: ''
      });
    }
  }
};

DB.seedIfEmpty();
