/* ============================================================
   app.js — núcleo da aplicação GestorPag
   Navegação SPA, CRUDs, dashboard, gráficos, modais, busca.
   ============================================================ */

const App = {

  charts: {},
  dashFiltro: 'mes',

  /* ---------------- util ---------------- */
  formatMoney(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
  formatDate(iso) {
    if (!iso) return '-';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  },
  todayISO() {
    return new Date().toISOString().slice(0, 10);
  },
  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  },

  /* ---------------- inicialização ---------------- */
  init() {
    this.mostrarUsuarioLogado();
    DB.atualizarStatusContas();
    this.bindNav();
    this.bindModal();
    this.bindDashboard();
    this.bindContas();
    this.bindBeneficiarios();
    this.bindPagadores();
    this.bindRelatorios();
    this.bindAux();
    this.bindUsuarios();
    this.bindBackup();
    this.bindBuscaGlobal();
    this.bindLogout();
    this.renderClock();
    this.renderTudo();
    this.iniciarBackupAutomatico();
    setInterval(() => this.renderClock(), 1000 * 30);
  },

  mostrarUsuarioLogado() {
    const u = Auth.getUsuarioLogado();
    if (u) document.getElementById('userTag').textContent = `${u.login} · ${u.perfil}`;
  },

  bindLogout() {
    document.getElementById('btnLogout').addEventListener('click', () => {
      if (confirm('Encerrar sessão?')) Auth.logout();
    });
  },

  renderClock() {
    document.getElementById('clock').textContent = new Date().toLocaleString('pt-BR');
  },

  // Status automático agora é centralizado em DB.atualizarStatusContas()
  // (considera vencimento + validação/confirmação de pagamento).

  renderTudo() {
    this.renderDashboard();
    this.renderContas();
    this.renderBeneficiarios();
    this.renderPagadores();
    this.renderAux();
    this.renderHistorico();
    this.renderUsuarios();
    this.popularSelects();
  },

  /* ---------------- navegação ---------------- */
  bindNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + btn.dataset.view).classList.add('active');
      });
    });
  },

  /* ---------------- modal genérico ---------------- */
  bindModal() {
    document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('modalOverlay').addEventListener('click', e => {
      if (e.target.id === 'modalOverlay') this.closeModal();
    });
  },
  openModal(title, bodyHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('open');
  },
  closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
  },

  /* =========================================================
     DASHBOARD
     ========================================================= */
  bindDashboard() {
    document.querySelectorAll('#dashFiltros button').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#dashFiltros button').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        this.dashFiltro = b.dataset.f;
        this.renderDashboard();
      });
    });
  },

  periodoFiltro() {
    const hoje = new Date();
    let de = null;
    if (this.dashFiltro === 'hoje') de = new Date(hoje);
    if (this.dashFiltro === 'semana') { de = new Date(hoje); de.setDate(de.getDate() - 7); }
    if (this.dashFiltro === 'mes') { de = new Date(hoje); de.setMonth(de.getMonth() - 1); }
    if (this.dashFiltro === 'ano') { de = new Date(hoje); de.setFullYear(de.getFullYear() - 1); }
    return de ? de.toISOString().slice(0, 10) : null;
  },

  renderDashboard() {
    DB.atualizarStatusContas();
    const contas = DB.getAll('contas');
    const de = this.periodoFiltro();
    const filtradas = de ? contas.filter(c => c.vencimento >= de) : contas;

    const hoje = this.todayISO();
    const em7dias = new Date(); em7dias.setDate(em7dias.getDate() + 7);
    const em7ISO = em7dias.toISOString().slice(0, 10);

    const totalGeral = filtradas.reduce((s, c) => s + Number(c.valor || 0), 0);
    const vencidas = filtradas.filter(c => c.status === 'Vencida');
    const venceHoje = filtradas.filter(c => c.vencimento === hoje && c.status !== 'Paga');
    const prox7 = filtradas.filter(c => c.vencimento > hoje && c.vencimento <= em7ISO && c.status !== 'Paga');
    const pagas = filtradas.filter(c => c.status === 'Paga');
    const pendentes = filtradas.filter(c => ['Aberta', 'Agendada', 'Vencida'].includes(c.status));

    document.getElementById('kpiTotal').textContent = this.formatMoney(totalGeral);
    document.getElementById('kpiVencidas').textContent = vencidas.length;
    document.getElementById('kpiHoje').textContent = venceHoje.length;
    document.getElementById('kpiProx').textContent = prox7.length;
    document.getElementById('kpiPago').textContent = this.formatMoney(pagas.reduce((s, c) => s + Number(c.valor || 0), 0));
    document.getElementById('kpiPendente').textContent = this.formatMoney(pendentes.reduce((s, c) => s + Number(c.valor || 0), 0));

    this.renderAlertas(vencidas, venceHoje, filtradas);
    this.renderCharts(filtradas);
  },

  renderAlertas(vencidas, venceHoje, filtradas) {
    const altoValor = filtradas.filter(c => Number(c.valor) >= 5000 && c.status !== 'Paga');
    const linhas = [];
    vencidas.slice(0, 8).forEach(c => linhas.push(['🔴 Vencida', c, ]));
    venceHoje.slice(0, 8).forEach(c => linhas.push(['🟠 Vence hoje', c]));
    altoValor.slice(0, 8).forEach(c => linhas.push(['🟣 Alto valor', c]));

    const tbody = document.querySelector('#tabelaAlertas tbody');
    tbody.innerHTML = linhas.length ? linhas.map(([tag, c]) => `
      <tr><td>${tag}</td><td>${c.numero || c.id}</td><td>${Relatorios.nomeBeneficiario(c.beneficiarioId)}</td>
      <td>${this.formatDate(c.vencimento)}</td><td>${this.formatMoney(c.valor)}</td></tr>
    `).join('') : '<tr><td colspan="5" class="empty-msg">Nenhum alerta no momento.</td></tr>';
  },

  renderCharts(contas) {
    const ctx1 = document.getElementById('chartEvolucao');
    const porMes = {};
    contas.forEach(c => {
      const mes = (c.vencimento || '').slice(0, 7);
      porMes[mes] = (porMes[mes] || 0) + Number(c.valor || 0);
    });
    const meses = Object.keys(porMes).sort();
    this.drawChart('chartEvolucao', 'line', meses, [{ label: 'Despesas', data: meses.map(m => porMes[m]), borderColor: '#2f6fed', backgroundColor: 'rgba(47,111,237,.15)', fill: true, tension: .3 }]);

    const centros = DB.getAll('centrosCusto');
    const porCentro = Relatorios.agrupar(contas, 'centroCustoId', centros);
    this.drawChart('chartCentro', 'bar', porCentro.map(c => c.nome), [{ label: 'Total', data: porCentro.map(c => c.total), backgroundColor: '#1c9c6b' }]);

    const benefs = DB.getAll('beneficiarios').map(b => ({ ...b, nome: b.tipo === 'PJ' ? b.razaoSocial : b.nomeCompleto }));
    const porBenef = Relatorios.agrupar(contas, 'beneficiarioId', benefs).slice(0, 6);
    this.drawChart('chartBenef', 'doughnut', porBenef.map(c => c.nome), [{ data: porBenef.map(c => c.total), backgroundColor: ['#2f6fed', '#1c9c6b', '#e08a2c', '#cf9e0a', '#d6453d', '#7c8aa8'] }]);

    const tipos = DB.getAll('tiposConta');
    const porTipo = Relatorios.agrupar(contas, 'tipoContaId', tipos);
    this.drawChart('chartTipo', 'pie', porTipo.map(c => c.nome), [{ data: porTipo.map(c => c.total), backgroundColor: ['#2f6fed', '#1c9c6b', '#e08a2c', '#cf9e0a', '#d6453d', '#7c8aa8', '#9b59b6', '#16a085', '#34495e', '#c0392b'] }]);
  },

  drawChart(id, type, labels, datasets) {
    if (this.charts[id]) this.charts[id].destroy();
    this.charts[id] = new Chart(document.getElementById(id), {
      type, data: { labels, datasets },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type !== 'bar' && type !== 'line', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
  },

  /* =========================================================
     CONTAS A PAGAR
     ========================================================= */
  bindContas() {
    document.getElementById('btnNovaConta').addEventListener('click', () => this.formConta());
    document.getElementById('btnFiltrarContas').addEventListener('click', () => this.renderContas());
    document.getElementById('btnLimparContas').addEventListener('click', () => {
      ['fStatus', 'fTipoConta', 'fCentro', 'fDe', 'fAte'].forEach(id => document.getElementById(id).value = '');
      this.renderContas();
    });
  },

  formConta(conta = null) {
    const benefs = DB.getAll('beneficiarios');
    const pagadores = DB.getAll('pagadores');
    const tipos = DB.getAll('tiposConta');
    const centros = DB.getAll('centrosCusto');
    const tiposCusto = DB.getAll('tiposCusto');

    const opt = (list, sel, labelFn) => list.map(i => `<option value="${i.id}" ${conta && conta[sel] == i.id ? 'selected' : ''}>${labelFn(i)}</option>`).join('');

    this.openModal(conta ? 'Editar Conta' : 'Nova Conta a Pagar', `
      <div class="form-grid">
        <div class="form-field"><label>Número</label><input id="cNumero" value="${conta?.numero || ''}"></div>
        <div class="form-field"><label>Status (automático)</label>
          <input id="cStatusView" value="${conta?.status || 'Aberta'}" disabled>
        </div>
        <div class="form-field"><label>Beneficiário</label><select id="cBenef"><option value="">Selecione</option>${opt(benefs, 'beneficiarioId', b => b.tipo === 'PJ' ? b.razaoSocial : b.nomeCompleto)}</select></div>
        <div class="form-field"><label>Pagador</label><select id="cPagador"><option value="">Selecione</option>${opt(pagadores, 'pagadorId', p => p.nomeEmpresa)}</select></div>
        <div class="form-field"><label>Tipo de Conta</label><select id="cTipoConta"><option value="">Selecione</option>${opt(tipos, 'tipoContaId', t => t.nome)}</select></div>
        <div class="form-field"><label>Centro de Custo</label><select id="cCentro"><option value="">Selecione</option>${opt(centros, 'centroCustoId', c => c.nome)}</select></div>
        <div class="form-field"><label>Tipo de Custo</label><select id="cTipoCusto"><option value="">Selecione</option>${opt(tiposCusto, 'tipoCustoId', t => t.nome)}</select></div>
        <div class="form-field"><label>Forma de Pagamento</label>
          <select id="cForma">${['PIX', 'TED', 'DOC', 'Boleto', 'Cartão', 'Dinheiro', 'Cheque', 'Outros'].map(f => `<option ${conta?.formaPagamento === f ? 'selected' : ''}>${f}</option>`).join('')}</select>
        </div>
        <div class="form-field"><label>Valor (R$)</label><input id="cValor" type="number" step="0.01" value="${conta?.valor || ''}"></div>
        <div class="form-field"><label>Data de Emissão</label><input id="cEmissao" type="date" value="${conta?.emissao || ''}"></div>
        <div class="form-field"><label>Data de Vencimento</label><input id="cVencimento" type="date" value="${conta?.vencimento || ''}"></div>
        <div class="form-field"><label>Data de Pagamento</label><input id="cPagamento" type="date" value="${conta?.pagamento || ''}"></div>
        <div class="form-field"><label>Recorrência</label>
          <select id="cRecorrencia"><option value="">Nenhuma</option>${['Mensal', 'Semanal', 'Anual'].map(r => `<option ${conta?.recorrencia === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        </div>

        <div class="form-field"><label>Código de Barras</label><input id="cBarcode" value="${conta?.codigoBarras || ''}" placeholder="Número do código de barras/boleto"></div>
        <div class="form-field">
          <label>&nbsp;</label>
          <button type="button" class="btn-secondary" id="cVerBarcode" ${conta?.codigoBarras ? '' : 'style="display:none;"'}>🏷️ Ver código de barras</button>
        </div>

        <div class="form-field full">
          <label>Anexar comprovante (PDF ou imagem JPEG)</label>
          <input id="cAnexo" type="file" accept="application/pdf,image/jpeg,image/jpg">
          <div id="cAnexoAtual" style="margin-top:4px;font-size:11.5px;">
            ${conta?.anexoNome ? `📎 Atual: <a href="${conta.anexoData}" target="_blank" rel="noopener">${conta.anexoNome}</a> <button type="button" id="cRemoverAnexo" style="color:var(--red);background:none;border:none;cursor:pointer;">remover</button>` : 'Nenhum anexo.'}
          </div>
        </div>

        <div class="form-field full" style="background:#fffbe8;border:1px solid #f0dca0;border-radius:6px;padding:10px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text);">
            <input type="checkbox" id="cValidado" ${conta?.validado ? 'checked' : ''} style="width:16px;height:16px;">
            Confirmar / validar pagamento desta conta (marca automaticamente como <b>Paga</b>)
          </label>
          ${conta?.validadoEm ? `<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">Validado em ${new Date(conta.validadoEm).toLocaleString('pt-BR')} por ${conta.validadoPor || '-'}</div>` : ''}
        </div>

        <div class="form-field full"><label>Descrição</label><input id="cDescricao" value="${conta?.descricao || ''}"></div>
        <div class="form-field full"><label>Observações</label><textarea id="cObs" rows="2">${conta?.observacoes || ''}</textarea></div>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" id="cCancelar">Cancelar</button>
        <button class="btn-primary" id="cSalvar">Salvar</button>
      </div>
    `);

    // preselect dos selects (precisa ser feito após inserir no DOM)
    if (conta) {
      document.getElementById('cBenef').value = conta.beneficiarioId || '';
      document.getElementById('cPagador').value = conta.pagadorId || '';
      document.getElementById('cTipoConta').value = conta.tipoContaId || '';
      document.getElementById('cCentro').value = conta.centroCustoId || '';
      document.getElementById('cTipoCusto').value = conta.tipoCustoId || '';
    }

    let anexoRemovido = false;

    document.getElementById('cBarcode').addEventListener('input', e => {
      document.getElementById('cVerBarcode').style.display = e.target.value ? '' : 'none';
    });
    document.getElementById('cVerBarcode').addEventListener('click', () => {
      this.verCodigoBarras(document.getElementById('cBarcode').value);
    });

    const btnRemoverAnexo = document.getElementById('cRemoverAnexo');
    if (btnRemoverAnexo) {
      btnRemoverAnexo.addEventListener('click', () => {
        anexoRemovido = true;
        document.getElementById('cAnexoAtual').innerHTML = 'Anexo será removido ao salvar.';
      });
    }

    document.getElementById('cCancelar').addEventListener('click', () => this.closeModal());
    document.getElementById('cSalvar').addEventListener('click', async () => {
      const dados = {
        numero: document.getElementById('cNumero').value,
        beneficiarioId: document.getElementById('cBenef').value,
        pagadorId: document.getElementById('cPagador').value,
        tipoContaId: document.getElementById('cTipoConta').value,
        centroCustoId: document.getElementById('cCentro').value,
        tipoCustoId: document.getElementById('cTipoCusto').value,
        formaPagamento: document.getElementById('cForma').value,
        valor: parseFloat(document.getElementById('cValor').value) || 0,
        emissao: document.getElementById('cEmissao').value,
        vencimento: document.getElementById('cVencimento').value,
        pagamento: document.getElementById('cPagamento').value,
        recorrencia: document.getElementById('cRecorrencia').value,
        descricao: document.getElementById('cDescricao').value,
        observacoes: document.getElementById('cObs').value,
        codigoBarras: document.getElementById('cBarcode').value
      };

      if (!dados.beneficiarioId || !dados.vencimento || !dados.valor) {
        this.toast('Preencha beneficiário, vencimento e valor.');
        return;
      }

      // ---- validação/confirmação de pagamento ----
      const validadoAgora = document.getElementById('cValidado').checked;
      const usuarioAtual = Auth.getUsuarioLogado();
      dados.validado = validadoAgora;
      if (validadoAgora) {
        if (!conta?.validado) {
          dados.validadoEm = new Date().toISOString();
          dados.validadoPor = usuarioAtual ? usuarioAtual.login : '-';
        } else {
          dados.validadoEm = conta.validadoEm;
          dados.validadoPor = conta.validadoPor;
        }
        if (!dados.pagamento) dados.pagamento = this.todayISO();
      } else {
        dados.validadoEm = null;
        dados.validadoPor = null;
      }
      // status é sempre recalculado automaticamente a partir de vencimento + validação
      dados.status = DB.calcularStatus({ ...dados, status: conta?.status }, this.todayISO());

      // ---- anexo (PDF/JPEG) ----
      const fileInput = document.getElementById('cAnexo');
      const file = fileInput.files[0];
      if (file) {
        if (!['application/pdf', 'image/jpeg', 'image/jpg'].includes(file.type)) {
          this.toast('Anexo deve ser PDF ou imagem JPEG.');
          return;
        }
        if (file.size > 4 * 1024 * 1024) {
          this.toast('Arquivo muito grande (máx. 4MB).');
          return;
        }
        dados.anexoData = await this.lerArquivoBase64(file);
        dados.anexoNome = file.name;
        dados.anexoTipo = file.type;
      } else if (anexoRemovido) {
        dados.anexoData = null;
        dados.anexoNome = null;
        dados.anexoTipo = null;
      }

      if (conta) {
        DB.update('contas', conta.id, dados);
        DB.log('Alteração', 'conta', `Conta nº ${dados.numero || conta.id} atualizada.`);
      } else {
        const nova = DB.insert('contas', dados);
        DB.log('Inclusão', 'conta', `Conta nº ${dados.numero || nova.id} cadastrada.`);
      }
      this.closeModal();
      this.renderTudo();
      this.toast('Conta salva com sucesso.');
    });
  },

  lerArquivoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  verCodigoBarras(codigo) {
    if (!codigo) { this.toast('Informe o código de barras primeiro.'); return; }
    this.openModal('Código de Barras', `
      <div style="text-align:center;">
        <svg id="svgBarcode"></svg>
        <p style="margin-top:8px;font-size:12px;color:var(--text-dim);">${codigo}</p>
        <button class="btn-secondary" id="btnImprimirBarcode" style="margin-top:8px;">Imprimir</button>
      </div>
    `);
    try {
      JsBarcode('#svgBarcode', codigo, { format: 'CODE128', height: 60, displayValue: false });
    } catch (e) {
      document.getElementById('modalBody').innerHTML = '<p class="empty-msg">Não foi possível gerar o código de barras com o valor informado.</p>';
    }
    document.getElementById('btnImprimirBarcode')?.addEventListener('click', () => window.print());
  },

  renderContas() {
    const status = document.getElementById('fStatus').value;
    const tipo = document.getElementById('fTipoConta').value;
    const centro = document.getElementById('fCentro').value;
    const de = document.getElementById('fDe').value;
    const ate = document.getElementById('fAte').value;

    let contas = DB.getAll('contas');
    if (status) contas = contas.filter(c => c.status === status);
    if (tipo) contas = contas.filter(c => String(c.tipoContaId) === tipo);
    if (centro) contas = contas.filter(c => String(c.centroCustoId) === centro);
    if (de) contas = contas.filter(c => c.vencimento >= de);
    if (ate) contas = contas.filter(c => c.vencimento <= ate);

    contas.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));

    const pagadores = DB.getAll('pagadores');
    const tipos = DB.getAll('tiposConta');
    const centros = DB.getAll('centrosCusto');

    const tbody = document.querySelector('#tabelaContas tbody');
    tbody.innerHTML = contas.length ? contas.map(c => `
      <tr>
        <td>${c.numero || c.id}</td>
        <td>${Relatorios.nomeBeneficiario(c.beneficiarioId)}</td>
        <td>${pagadores.find(p => p.id == c.pagadorId)?.nomeEmpresa || '-'}</td>
        <td>${tipos.find(t => t.id == c.tipoContaId)?.nome || '-'}</td>
        <td>${centros.find(cc => cc.id == c.centroCustoId)?.nome || '-'}</td>
        <td>${this.formatDate(c.vencimento)}</td>
        <td>${this.formatMoney(c.valor)}</td>
        <td><span class="tag tag-${(c.status || '').toLowerCase()}">${c.status}</span>${c.validado ? ' ✅' : ''}</td>
        <td>${c.formaPagamento || '-'}</td>
        <td class="row-actions">
          <button title="Editar" onclick="App.editarConta(${c.id})">✏️</button>
          <button title="Confirmar pagamento" onclick="App.pagarConta(${c.id})">💲</button>
          ${c.anexoData ? `<button title="Ver anexo" onclick="window.open('${c.anexoData}','_blank')">📎</button>` : ''}
          ${c.codigoBarras ? `<button title="Código de barras" onclick="App.verCodigoBarras('${c.codigoBarras}')">🏷️</button>` : ''}
          <button title="Cancelar conta" onclick="App.cancelarConta(${c.id})">🚫</button>
          <button title="Excluir" onclick="App.excluirConta(${c.id})">🗑️</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="10" class="empty-msg">Nenhuma conta encontrada.</td></tr>';
  },

  editarConta(id) { this.formConta(DB.getById('contas', id)); },

  pagarConta(id) {
    const usuarioAtual = Auth.getUsuarioLogado();
    DB.update('contas', id, {
      validado: true, status: 'Paga', pagamento: this.todayISO(),
      validadoEm: new Date().toISOString(), validadoPor: usuarioAtual ? usuarioAtual.login : '-'
    });
    DB.log('Pagamento', 'conta', `Conta ID ${id} confirmada/validada como paga.`);
    this.renderTudo();
    this.toast('Pagamento confirmado.');
  },

  cancelarConta(id) {
    if (!confirm('Cancelar esta conta? Ela deixará de contar nos totais pendentes.')) return;
    DB.update('contas', id, { status: 'Cancelada' });
    DB.log('Alteração', 'conta', `Conta ID ${id} cancelada.`);
    this.renderTudo();
    this.toast('Conta cancelada.');
  },

  excluirConta(id) {
    if (!confirm('Excluir esta conta?')) return;
    DB.remove('contas', id);
    DB.log('Exclusão', 'conta', `Conta ID ${id} excluída.`);
    this.renderTudo();
    this.toast('Conta excluída.');
  },

  /* =========================================================
     BENEFICIÁRIOS
     ========================================================= */
  bindBeneficiarios() {
    document.getElementById('btnNovoBenef').addEventListener('click', () => this.formBeneficiario());
  },

  formBeneficiario(b = null) {
    this.openModal(b ? 'Editar Beneficiário' : 'Novo Beneficiário', `
      <div class="form-field full"><label>Tipo</label>
        <select id="bTipo">
          <option value="PJ" ${b?.tipo === 'PJ' ? 'selected' : ''}>Pessoa Jurídica</option>
          <option value="PF" ${b?.tipo === 'PF' ? 'selected' : ''}>Pessoa Física</option>
        </select>
      </div>
      <div class="form-grid" style="margin-top:10px;">
        <div class="form-field"><label>Razão Social / Nome Completo</label><input id="bNome" value="${b?.razaoSocial || b?.nomeCompleto || ''}"></div>
        <div class="form-field"><label>Nome Fantasia</label><input id="bFantasia" value="${b?.nomeFantasia || ''}"></div>
        <div class="form-field"><label>CNPJ / CPF</label><input id="bDoc" value="${b?.cnpj || b?.cpf || ''}"></div>
        <div class="form-field"><label>IE / RG</label><input id="bIe" value="${b?.ie || b?.rg || ''}"></div>
        <div class="form-field full"><label>Endereço</label><input id="bEndereco" value="${b?.endereco || ''}"></div>
        <div class="form-field"><label>Telefone</label><input id="bTelefone" value="${b?.telefone || ''}"></div>
        <div class="form-field"><label>E-mail</label><input id="bEmail" value="${b?.email || ''}"></div>
        <div class="form-field"><label>Banco</label><input id="bBanco" value="${b?.banco || ''}"></div>
        <div class="form-field"><label>Agência</label><input id="bAgencia" value="${b?.agencia || ''}"></div>
        <div class="form-field"><label>Conta</label><input id="bConta" value="${b?.conta || ''}"></div>
        <div class="form-field"><label>PIX</label><input id="bPix" value="${b?.pix || ''}"></div>
        <div class="form-field full"><label>Observações</label><textarea id="bObs" rows="2">${b?.observacoes || ''}</textarea></div>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" id="bCancelar">Cancelar</button>
        <button class="btn-primary" id="bSalvar">Salvar</button>
      </div>
    `);

    document.getElementById('bCancelar').addEventListener('click', () => this.closeModal());
    document.getElementById('bSalvar').addEventListener('click', () => {
      const tipo = document.getElementById('bTipo').value;
      const nome = document.getElementById('bNome').value;
      const doc = document.getElementById('bDoc').value;
      if (!nome) { this.toast('Informe o nome/razão social.'); return; }
      const dados = {
        tipo,
        razaoSocial: tipo === 'PJ' ? nome : undefined,
        nomeCompleto: tipo === 'PF' ? nome : undefined,
        nomeFantasia: document.getElementById('bFantasia').value,
        cnpj: tipo === 'PJ' ? doc : undefined,
        cpf: tipo === 'PF' ? doc : undefined,
        ie: tipo === 'PJ' ? document.getElementById('bIe').value : undefined,
        rg: tipo === 'PF' ? document.getElementById('bIe').value : undefined,
        endereco: document.getElementById('bEndereco').value,
        telefone: document.getElementById('bTelefone').value,
        email: document.getElementById('bEmail').value,
        banco: document.getElementById('bBanco').value,
        agencia: document.getElementById('bAgencia').value,
        conta: document.getElementById('bConta').value,
        pix: document.getElementById('bPix').value,
        observacoes: document.getElementById('bObs').value
      };
      if (b) { DB.update('beneficiarios', b.id, dados); DB.log('Alteração', 'beneficiario', `${nome} atualizado.`); }
      else { DB.insert('beneficiarios', dados); DB.log('Inclusão', 'beneficiario', `${nome} cadastrado.`); }
      this.closeModal();
      this.renderTudo();
      this.toast('Beneficiário salvo.');
    });
  },

  renderBeneficiarios(lista = null) {
    const benefs = lista || DB.getAll('beneficiarios');
    const tbody = document.querySelector('#tabelaBenef tbody');
    tbody.innerHTML = benefs.length ? benefs.map(b => `
      <tr>
        <td>${b.tipo === 'PJ' ? b.razaoSocial : b.nomeCompleto}</td>
        <td>${b.tipo}</td>
        <td>${b.cnpj || b.cpf || '-'}</td>
        <td>${b.telefone || '-'}</td>
        <td>${b.email || '-'}</td>
        <td class="row-actions">
          <button onclick="App.editarBeneficiario(${b.id})">✏️</button>
          <button onclick="App.excluirBeneficiario(${b.id})">🗑️</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty-msg">Nenhum beneficiário cadastrado.</td></tr>';
  },
  editarBeneficiario(id) { this.formBeneficiario(DB.getById('beneficiarios', id)); },
  excluirBeneficiario(id) {
    if (!confirm('Excluir este beneficiário?')) return;
    DB.remove('beneficiarios', id);
    DB.log('Exclusão', 'beneficiario', `ID ${id} excluído.`);
    this.renderTudo();
    this.toast('Beneficiário excluído.');
  },

  /* =========================================================
     PAGADORES
     ========================================================= */
  bindPagadores() {
    document.getElementById('btnNovoPagador').addEventListener('click', () => this.formPagador());
  },

  formPagador(p = null) {
    this.openModal(p ? 'Editar Pagador' : 'Novo Pagador', `
      <div class="form-grid">
        <div class="form-field"><label>Nome da Empresa</label><input id="pNome" value="${p?.nomeEmpresa || ''}"></div>
        <div class="form-field"><label>CNPJ</label><input id="pCnpj" value="${p?.cnpj || ''}"></div>
        <div class="form-field full"><label>Endereço</label><input id="pEndereco" value="${p?.endereco || ''}"></div>
        <div class="form-field"><label>Responsável</label><input id="pResp" value="${p?.responsavel || ''}"></div>
        <div class="form-field"><label>Telefone</label><input id="pTel" value="${p?.telefone || ''}"></div>
        <div class="form-field"><label>Banco Principal</label><input id="pBanco" value="${p?.bancoPrincipal || ''}"></div>
        <div class="form-field"><label>Conta Bancária</label><input id="pConta" value="${p?.contaBancaria || ''}"></div>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" id="pCancelar">Cancelar</button>
        <button class="btn-primary" id="pSalvar">Salvar</button>
      </div>
    `);
    document.getElementById('pCancelar').addEventListener('click', () => this.closeModal());
    document.getElementById('pSalvar').addEventListener('click', () => {
      const nomeEmpresa = document.getElementById('pNome').value;
      if (!nomeEmpresa) { this.toast('Informe o nome da empresa.'); return; }
      const dados = {
        nomeEmpresa, cnpj: document.getElementById('pCnpj').value,
        endereco: document.getElementById('pEndereco').value,
        responsavel: document.getElementById('pResp').value,
        telefone: document.getElementById('pTel').value,
        bancoPrincipal: document.getElementById('pBanco').value,
        contaBancaria: document.getElementById('pConta').value
      };
      if (p) { DB.update('pagadores', p.id, dados); DB.log('Alteração', 'pagador', `${nomeEmpresa} atualizado.`); }
      else { DB.insert('pagadores', dados); DB.log('Inclusão', 'pagador', `${nomeEmpresa} cadastrado.`); }
      this.closeModal();
      this.renderTudo();
      this.toast('Pagador salvo.');
    });
  },

  renderPagadores() {
    const lista = DB.getAll('pagadores');
    const tbody = document.querySelector('#tabelaPagadores tbody');
    tbody.innerHTML = lista.length ? lista.map(p => `
      <tr>
        <td>${p.nomeEmpresa}</td><td>${p.cnpj || '-'}</td><td>${p.responsavel || '-'}</td><td>${p.bancoPrincipal || '-'}</td>
        <td class="row-actions">
          <button onclick="App.editarPagador(${p.id})">✏️</button>
          <button onclick="App.excluirPagador(${p.id})">🗑️</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="empty-msg">Nenhum pagador cadastrado.</td></tr>';
  },
  editarPagador(id) { this.formPagador(DB.getById('pagadores', id)); },
  excluirPagador(id) {
    if (!confirm('Excluir este pagador?')) return;
    DB.remove('pagadores', id);
    DB.log('Exclusão', 'pagador', `ID ${id} excluído.`);
    this.renderTudo();
    this.toast('Pagador excluído.');
  },

  /* =========================================================
     RELATÓRIOS
     ========================================================= */
  bindRelatorios() {
    document.getElementById('btnGerarRelatorio').addEventListener('click', () => this.gerarRelatorio());
    document.getElementById('btnExportCSV').addEventListener('click', () => {
      const { tipo, dados } = this._ultimoRelatorio || {};
      if (!dados) { this.toast('Gere o relatório primeiro.'); return; }
      Relatorios.exportarCSV(tipo, dados);
    });
    document.getElementById('btnExportPDF').addEventListener('click', () => window.print());
  },

  gerarRelatorio() {
    const tipo = document.getElementById('repTipo').value;
    const filtros = {
      de: document.getElementById('repDe').value,
      ate: document.getElementById('repAte').value,
      beneficiarioId: document.getElementById('repBenef').value,
      centroCustoId: document.getElementById('repCentro').value
    };
    const dados = Relatorios.gerar(tipo, filtros);
    this._ultimoRelatorio = { tipo, dados };
    document.getElementById('relatorioResultado').innerHTML = Relatorios.renderTabela(tipo, dados);
  },

  /* =========================================================
     CADASTROS AUXILIARES
     ========================================================= */
  bindAux() {
    document.querySelectorAll('[data-aux]').forEach(btn => {
      btn.addEventListener('click', () => {
        const table = btn.dataset.aux;
        const inputId = { tiposConta: 'novoTipoConta', centrosCusto: 'novoCentro', tiposCusto: 'novoTipoCusto' }[table];
        const input = document.getElementById(inputId);
        const nome = input.value.trim();
        if (!nome) return;
        DB.insert(table, { nome });
        input.value = '';
        this.renderAux();
        this.popularSelects();
        this.toast('Item adicionado.');
      });
    });
  },

  renderAux() {
    const map = [['tiposConta', 'listaTiposConta'], ['centrosCusto', 'listaCentros'], ['tiposCusto', 'listaTiposCusto']];
    map.forEach(([table, ulId]) => {
      const ul = document.getElementById(ulId);
      const itens = DB.getAll(table);
      ul.innerHTML = itens.map(i => `<li>${i.nome} <button onclick="App.excluirAux('${table}', ${i.id}, '${ulId}')">✕</button></li>`).join('') || '<li class="empty-msg">Nenhum item.</li>';
    });
  },
  excluirAux(table, id) {
    DB.remove(table, id);
    this.renderAux();
    this.popularSelects();
  },

  /* popula todos os <select> que dependem de cadastros auxiliares/beneficiários */
  popularSelects() {
    const tipos = DB.getAll('tiposConta');
    const centros = DB.getAll('centrosCusto');
    const benefs = DB.getAll('beneficiarios');

    const fillSelect = (id, items, labelFn, keepFirst = true) => {
      const el = document.getElementById(id);
      if (!el) return;
      const atual = el.value;
      el.innerHTML = (keepFirst ? el.querySelector('option')?.outerHTML || '' : '') +
        items.map(i => `<option value="${i.id}">${labelFn(i)}</option>`).join('');
      el.value = atual;
    };

    fillSelect('fTipoConta', tipos, t => t.nome);
    fillSelect('fCentro', centros, c => c.nome);
    fillSelect('repBenef', benefs, b => b.tipo === 'PJ' ? b.razaoSocial : b.nomeCompleto);
    fillSelect('repCentro', centros, c => c.nome);
  },

  /* =========================================================
     HISTÓRICO
     ========================================================= */
  renderHistorico() {
    const lista = DB.getAll('historico');
    const tbody = document.querySelector('#tabelaHistorico tbody');
    tbody.innerHTML = lista.length ? lista.map(h => `
      <tr><td>${new Date(h.data).toLocaleString('pt-BR')}</td><td>${h.acao}</td><td>${h.entidade}</td><td>${h.descricao}</td></tr>
    `).join('') : '<tr><td colspan="4" class="empty-msg">Sem registros.</td></tr>';
  },

  /* =========================================================
     USUÁRIOS
     ========================================================= */
  bindUsuarios() {
    document.getElementById('btnNovoUsuario').addEventListener('click', () => this.formUsuario());
  },
  formUsuario(u = null) {
    this.openModal(u ? 'Editar Usuário' : 'Novo Usuário', `
      <div class="form-grid">
        <div class="form-field"><label>Nome</label><input id="uNome" value="${u?.nome || ''}"></div>
        <div class="form-field"><label>Login</label><input id="uLogin" value="${u?.login || ''}"></div>
        <div class="form-field"><label>Senha</label><input id="uSenha" type="password" value="${u?.senha || ''}"></div>
        <div class="form-field"><label>Perfil</label>
          <select id="uPerfil">${['Administrador', 'Operador', 'Visualização'].map(p => `<option ${u?.perfil === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" id="uCancelar">Cancelar</button>
        <button class="btn-primary" id="uSalvar">Salvar</button>
      </div>
    `);
    document.getElementById('uCancelar').addEventListener('click', () => this.closeModal());
    document.getElementById('uSalvar').addEventListener('click', () => {
      const dados = {
        nome: document.getElementById('uNome').value,
        login: document.getElementById('uLogin').value,
        senha: document.getElementById('uSenha').value,
        perfil: document.getElementById('uPerfil').value
      };
      if (!dados.nome || !dados.login) { this.toast('Informe nome e login.'); return; }
      if (u) DB.update('usuarios', u.id, dados); else DB.insert('usuarios', dados);
      this.closeModal();
      this.renderUsuarios();
      this.toast('Usuário salvo.');
    });
  },
  renderUsuarios() {
    const lista = DB.getAll('usuarios');
    const tbody = document.querySelector('#tabelaUsuarios tbody');
    tbody.innerHTML = lista.map(u => `
      <tr><td>${u.nome}</td><td>${u.login}</td><td>${u.perfil}</td>
      <td class="row-actions"><button onclick="App.editarUsuario(${u.id})">✏️</button><button onclick="App.excluirUsuario(${u.id})">🗑️</button></td></tr>
    `).join('');
  },
  editarUsuario(id) { this.formUsuario(DB.getById('usuarios', id)); },
  excluirUsuario(id) {
    if (!confirm('Excluir este usuário?')) return;
    DB.remove('usuarios', id);
    this.renderUsuarios();
  },

  /* =========================================================
     BACKUP
     ========================================================= */
  bindBackup() {
    document.getElementById('btnExportBackup').addEventListener('click', () => {
      const blob = new Blob([DB.exportBackup()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `backup_gestorpag_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    });
    document.getElementById('inputImportBackup').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        DB.importBackup(reader.result);
        this.renderTudo();
        this.toast('Backup importado com sucesso.');
      };
      reader.readAsText(file);
    });
    document.getElementById('btnClearAll').addEventListener('click', () => {
      if (!confirm('Isso apagará TODOS os dados do sistema. Confirmar?')) return;
      DB.clearAll();
      DB.seedIfEmpty();
      this.renderTudo();
      this.toast('Todos os dados foram apagados.');
    });

    /* ---------- backup automático ---------- */
    const selIntervalo = document.getElementById('backupIntervalo');
    selIntervalo.value = DB.getConfig('backupIntervaloMin', '0');
    selIntervalo.addEventListener('change', () => {
      DB.setConfig('backupIntervaloMin', selIntervalo.value);
      this.iniciarBackupAutomatico();
      this.toast('Configuração de backup automático salva.');
    });

    document.getElementById('btnEscolherPasta').addEventListener('click', async () => {
      if (!window.showDirectoryPicker) {
        this.toast('Seu navegador não suporta escolha de pasta (use Chrome ou Edge).');
        return;
      }
      try {
        this._backupDirHandle = await window.showDirectoryPicker();
        document.getElementById('pastaBackupAtual').textContent = '📁 Pasta selecionada: ' + (this._backupDirHandle.name || 'selecionada');
        this.toast('Pasta de backup definida para esta sessão.');
      } catch (e) { /* usuário cancelou */ }
    });

    // Tenta fazer um último backup ao encerrar o sistema (melhor esforço;
    // navegadores podem bloquear operações assíncronas no unload).
    window.addEventListener('beforeunload', () => {
      if (this._backupDirHandle) this.salvarBackupNaPasta();
    });
  },

  iniciarBackupAutomatico() {
    if (this._backupTimer) clearInterval(this._backupTimer);
    const minutos = Number(DB.getConfig('backupIntervaloMin', '0'));
    if (!minutos) return;
    this._backupTimer = setInterval(() => this.salvarBackupNaPasta(true), minutos * 60 * 1000);
  },

  async salvarBackupNaPasta(silencioso = false) {
    const conteudo = DB.exportBackup();
    const nomeArquivo = `backup_gestorpag_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    if (this._backupDirHandle) {
      try {
        const fileHandle = await this._backupDirHandle.getFileHandle(nomeArquivo, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(conteudo);
        await writable.close();
        if (!silencioso) this.toast('Backup automático salvo na pasta escolhida.');
        return;
      } catch (e) {
        console.warn('Falha ao salvar backup na pasta escolhida:', e);
      }
    }
    // sem pasta escolhida (ou navegador sem suporte): faz download do arquivo
    const blob = new Blob([conteudo], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeArquivo;
    a.click();
  },

  /* =========================================================
     BUSCA GLOBAL
     ========================================================= */
  bindBuscaGlobal() {
    document.getElementById('globalSearch').addEventListener('input', e => {
      const termo = e.target.value.trim().toLowerCase();
      if (!termo) { this.renderBeneficiarios(); this.renderContas(); return; }

      const benefs = DB.getAll('beneficiarios').filter(b =>
        (b.razaoSocial || b.nomeCompleto || '').toLowerCase().includes(termo) ||
        (b.cnpj || '').includes(termo) || (b.cpf || '').includes(termo)
      );
      this.renderBeneficiarios(benefs);

      const contas = DB.getAll('contas').filter(c =>
        String(c.numero || c.id).includes(termo) || String(c.valor).includes(termo)
      );
      const tbody = document.querySelector('#tabelaContas tbody');
      if (contas.length) {
        const pagadores = DB.getAll('pagadores');
        tbody.innerHTML = contas.map(c => `
          <tr><td>${c.numero || c.id}</td><td>${Relatorios.nomeBeneficiario(c.beneficiarioId)}</td>
          <td>${pagadores.find(p => p.id == c.pagadorId)?.nomeEmpresa || '-'}</td><td>-</td><td>-</td>
          <td>${this.formatDate(c.vencimento)}</td><td>${this.formatMoney(c.valor)}</td>
          <td><span class="tag tag-${(c.status || '').toLowerCase()}">${c.status}</span></td><td>-</td>
          <td class="row-actions"><button onclick="App.editarConta(${c.id})">✏️</button></td></tr>
        `).join('');
      }
    });
  }
};

/* A inicialização do App agora é disparada pelo módulo Auth (auth.js)
   após o login bem-sucedido, e não mais diretamente no carregamento
   da página. Ver auth.js -> Auth.init(). */
