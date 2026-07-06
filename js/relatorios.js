/* ============================================================
   relatorios.js
   Geração de relatórios financeiros, filtros e exportação
   (CSV/Excel e impressão/PDF via window.print).
   ============================================================ */

const Relatorios = {

  /* aplica filtros comuns: período, beneficiário, centro de custo, tipo de conta, tipo de custo, status */
  filtrarContas({ de, ate, beneficiarioId, centroCustoId, tipoContaId, tipoCustoId, status }) {
    let contas = DB.getAll('contas');

    if (de) contas = contas.filter(c => c.vencimento >= de);
    if (ate) contas = contas.filter(c => c.vencimento <= ate);
    if (beneficiarioId) contas = contas.filter(c => String(c.beneficiarioId) === String(beneficiarioId));
    if (centroCustoId) contas = contas.filter(c => String(c.centroCustoId) === String(centroCustoId));
    if (tipoContaId) contas = contas.filter(c => String(c.tipoContaId) === String(tipoContaId));
    if (tipoCustoId) contas = contas.filter(c => String(c.tipoCustoId) === String(tipoCustoId));
    if (status) contas = contas.filter(c => c.status === status);

    return contas;
  },

  nomeTipoConta(id) {
    const t = DB.getById('tiposConta', Number(id));
    return t ? t.nome : '—';
  },

  nomeTipoCusto(id) {
    const t = DB.getById('tiposCusto', Number(id));
    return t ? t.nome : '—';
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
      case 'todas': return base.slice().sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
      case 'abertas': return base.filter(c => c.status === 'Aberta' || c.status === 'Agendada');
      case 'pagas': return base.filter(c => c.status === 'Paga');
      case 'vencidas': return base.filter(c => c.status === 'Vencida');
      case 'fluxo': return base.slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      case 'categoria': return this.agrupar(base, 'tipoContaId', DB.getAll('tiposConta'));
      case 'tipoCusto': return this.agrupar(base, 'tipoCustoId', DB.getAll('tiposCusto'));
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

    // ---- relatórios agrupados (categoria / tipoCusto / empresa) ----
    if (['categoria', 'tipoCusto', 'empresa'].includes(tipo)) {
      const titulo = { categoria: 'Tipo de Conta', tipoCusto: 'Tipo de Custo', empresa: 'Empresa Pagadora' }[tipo];
      let html = `<table class="dense-table"><thead><tr><th>${titulo}</th><th>Qtd. Contas</th><th>Total</th><th>% do Total</th></tr></thead><tbody>`;
      const totalGeral = dados.reduce((s, d) => s + d.total, 0);
      dados.forEach(d => {
        const pct = totalGeral ? ((d.total / totalGeral) * 100).toFixed(1) : '0.0';
        html += `<tr><td>${d.nome}</td><td>${d.qtd}</td><td>${App.formatMoney(d.total)}</td><td>${pct}%</td></tr>`;
      });
      html += `</tbody><tfoot><tr><td style="font-weight:700;">Total</td><td style="font-weight:700;">${dados.reduce((s,d)=>s+d.qtd,0)}</td><td style="font-weight:700;">${App.formatMoney(totalGeral)}</td><td>100%</td></tr></tfoot></table>`;
      return html;
    }

    // ---- relatório "todas as contas" — tabela completa com status em destaque ----
    const isTodas = tipo === 'todas';
    const colunas = isTodas
      ? ['Nº', 'Beneficiário', 'Tipo de Conta', 'Tipo de Custo', 'Vencimento', 'Pagamento', 'Forma Pgto', 'Valor', 'Status']
      : ['Nº', 'Beneficiário', 'Vencimento', 'Pagamento', 'Valor', 'Status'];

    let html = `<table class="dense-table"><thead><tr>${colunas.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;

    const corStatus = { Aberta:'#2f6fed', Agendada:'#cf9e0a', Paga:'#1c9c6b', Vencida:'#d6453d', Cancelada:'#7c8aa8' };

    dados.forEach(c => {
      const statusTag = `<span class="tag" style="background:${corStatus[c.status]||'#999'}">${c.status}</span>`;
      if (isTodas) {
        html += `<tr>
          <td>${c.numero || c.id}</td>
          <td>${this.nomeBeneficiario(c.beneficiarioId)}</td>
          <td>${this.nomeTipoConta(c.tipoContaId)}</td>
          <td>${this.nomeTipoCusto(c.tipoCustoId)}</td>
          <td>${App.formatDate(c.vencimento)}</td>
          <td>${c.pagamento ? App.formatDate(c.pagamento) : '-'}</td>
          <td>${c.formaPagamento || '-'}</td>
          <td>${App.formatMoney(c.valor)}</td>
          <td>${statusTag}</td>
        </tr>`;
      } else {
        html += `<tr>
          <td>${c.numero || c.id}</td>
          <td>${this.nomeBeneficiario(c.beneficiarioId)}</td>
          <td>${App.formatDate(c.vencimento)}</td>
          <td>${c.pagamento ? App.formatDate(c.pagamento) : '-'}</td>
          <td>${App.formatMoney(c.valor)}</td>
          <td>${statusTag}</td>
        </tr>`;
      }
    });

    const total = dados.reduce((s, c) => s + (Number(c.valor) || 0), 0);
    const colspan = isTodas ? 7 : 4;
    html += `</tbody><tfoot><tr>
      <td colspan="${colspan}" style="text-align:right;font-weight:700;">Total Geral</td>
      <td style="font-weight:700;">${App.formatMoney(total)}</td>
      <td></td>
    </tr></tfoot></table>`;
    return html;
  },

  exportarCSV(tipo, dados) {
    let linhas = [];

    if (['categoria', 'tipoCusto', 'empresa'].includes(tipo)) {
      const titulo = { categoria: 'Tipo de Conta', tipoCusto: 'Tipo de Custo', empresa: 'Empresa Pagadora' }[tipo];
      linhas.push([titulo, 'Qtd. Contas', 'Total (R$)']);
      dados.forEach(d => linhas.push([d.nome, d.qtd, d.total.toFixed(2)]));
    } else if (tipo === 'todas') {
      linhas.push(['Numero', 'Beneficiario', 'Tipo de Conta', 'Tipo de Custo', 'Vencimento', 'Pagamento', 'Forma Pagamento', 'Valor', 'Status']);
      dados.forEach(c => linhas.push([
        c.numero || c.id,
        this.nomeBeneficiario(c.beneficiarioId),
        this.nomeTipoConta(c.tipoContaId),
        this.nomeTipoCusto(c.tipoCustoId),
        c.vencimento,
        c.pagamento || '',
        c.formaPagamento || '',
        Number(c.valor).toFixed(2),
        c.status
      ]));
    } else {
      linhas.push(['Numero', 'Beneficiario', 'Vencimento', 'Pagamento', 'Valor', 'Status']);
      dados.forEach(c => linhas.push([
        c.numero || c.id, this.nomeBeneficiario(c.beneficiarioId),
        c.vencimento, c.pagamento || '', Number(c.valor).toFixed(2), c.status
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
