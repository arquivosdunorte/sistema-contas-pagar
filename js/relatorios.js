/* ============================================================
   relatorios.js
   Geração de relatórios financeiros, filtros e exportação
   (CSV/Excel e impressão/PDF via window.print).
   ============================================================ */

const Relatorios = {

  /* aplica filtros comuns: período, beneficiário, centro de custo */
  filtrarContas({ de, ate, beneficiarioId, centroCustoId, status }) {
    let contas = DB.getAll('contas');

    if (de) contas = contas.filter(c => c.vencimento >= de);
    if (ate) contas = contas.filter(c => c.vencimento <= ate);
    if (beneficiarioId) contas = contas.filter(c => String(c.beneficiarioId) === String(beneficiarioId));
    if (centroCustoId) contas = contas.filter(c => String(c.centroCustoId) === String(centroCustoId));
    if (status) contas = contas.filter(c => c.status === status);

    return contas;
  },

  nomeBeneficiario(id) {
    const b = DB.getById('beneficiarios', Number(id));
    return b ? (b.tipo === 'PJ' ? b.razaoSocial : b.nomeCompleto) : '—';
  },

  nomeCentro(id) {
    const c = DB.getById('centrosCusto', Number(id));
    return c ? c.nome : '—';
  },

  gerar(tipo, filtros) {
    const base = this.filtrarContas(filtros);

    switch (tipo) {
      case 'abertas': return base.filter(c => c.status === 'Aberta' || c.status === 'Agendada');
      case 'pagas': return base.filter(c => c.status === 'Paga');
      case 'vencidas': return base.filter(c => c.status === 'Vencida');
      case 'fluxo': return base.slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      case 'categoria': return this.agrupar(base, 'tipoContaId', DB.getAll('tiposConta'));
      case 'empresa': return this.agrupar(base, 'pagadorId', DB.getAll('pagadores'), 'nomeEmpresa');
      case 'ranking': return base.slice().sort((a, b) => b.valor - a.valor).slice(0, 30);
      default: return base;
    }
  },

  agrupar(lista, campo, refTabela, nomeCampo = 'nome') {
    const grupos = {};
    lista.forEach(c => {
      const key = c[campo];
      if (!grupos[key]) grupos[key] = { id: key, total: 0, qtd: 0 };
      grupos[key].total += Number(c.valor) || 0;
      grupos[key].qtd += 1;
    });
    return Object.values(grupos).map(g => {
      const ref = refTabela.find(r => String(r.id) === String(g.id));
      return { ...g, nome: ref ? (ref[nomeCampo] || ref.nome) : 'Não definido' };
    }).sort((a, b) => b.total - a.total);
  },

  renderTabela(tipo, dados) {
    if (!dados.length) return '<p class="empty-msg">Nenhum registro encontrado para os filtros selecionados.</p>';

    if (['categoria', 'empresa'].includes(tipo)) {
      let html = '<table class="dense-table"><thead><tr><th>Descrição</th><th>Qtd. Contas</th><th>Total</th></tr></thead><tbody>';
      dados.forEach(d => {
        html += `<tr><td>${d.nome}</td><td>${d.qtd}</td><td>${App.formatMoney(d.total)}</td></tr>`;
      });
      html += '</tbody></table>';
      return html;
    }

    let html = `<table class="dense-table"><thead><tr>
      <th>Nº</th><th>Beneficiário</th><th>Vencimento</th><th>Pagamento</th><th>Valor</th><th>Status</th>
    </tr></thead><tbody>`;
    dados.forEach(c => {
      html += `<tr>
        <td>${c.numero || c.id}</td>
        <td>${this.nomeBeneficiario(c.beneficiarioId)}</td>
        <td>${App.formatDate(c.vencimento)}</td>
        <td>${c.pagamento ? App.formatDate(c.pagamento) : '-'}</td>
        <td>${App.formatMoney(c.valor)}</td>
        <td>${c.status}</td>
      </tr>`;
    });
    const total = dados.reduce((s, c) => s + (Number(c.valor) || 0), 0);
    html += `</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:700;">Total</td><td style="font-weight:700;">${App.formatMoney(total)}</td><td></td></tr></tfoot></table>`;
    return html;
  },

  exportarCSV(tipo, dados) {
    let linhas = [];
    if (['categoria', 'empresa'].includes(tipo)) {
      linhas.push(['Descrição', 'Qtd. Contas', 'Total']);
      dados.forEach(d => linhas.push([d.nome, d.qtd, d.total.toFixed(2)]));
    } else {
      linhas.push(['Numero', 'Beneficiario', 'Vencimento', 'Pagamento', 'Valor', 'Status']);
      dados.forEach(c => linhas.push([
        c.numero || c.id, this.nomeBeneficiario(c.beneficiarioId),
        c.vencimento, c.pagamento || '', c.valor, c.status
      ]));
    }
    const csv = linhas.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio_${tipo}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }
};
