# GestorPag — Sistema de Agendamento e Controle de Contas a Pagar

Sistema web completo, 100% client-side (HTML5 + CSS3 + JavaScript puro),
que roda direto no navegador, sem instalação e sem servidor. Os dados são
gravados localmente no navegador (LocalStorage), funcionando offline.

## Estrutura de pastas

```
sistema-contas-pagar/
├── index.html          → estrutura de todas as telas (SPA)
├── css/
│   └── style.css        → visual ERP denso e responsivo
├── js/
│   ├── database.js      → camada de persistência (LocalStorage) + CRUD genérico
│   ├── relatorios.js     → geração/filtragem/exportação de relatórios
│   └── app.js            → navegação, dashboard, gráficos, formulários, modais
└── assets/               → reservado para ícones/imagens futuras
```

## Como executar

1. Baixe a pasta `sistema-contas-pagar` completa.
2. Dê duplo clique em `index.html` (abre no Chrome, Edge ou Firefox).
   - Alternativamente, sirva a pasta com qualquer servidor estático
     (ex.: `npx serve .` ou extensão "Live Server" do VS Code) para evitar
     eventuais restrições de `file://` em alguns navegadores.
3. O sistema já vem com dados auxiliares pré-cadastrados (tipos de conta,
   centros de custo, tipos de custo, um pagador padrão e um usuário
   administrador `admin/admin`). Comece cadastrando beneficiários e, depois,
   as contas a pagar.

## Funcionalidades implementadas

- **Login obrigatório**: tela de login com cadastro de novo usuário (login +
  senha + perfil). Sessão válida enquanto a aba estiver aberta. Usuário
  padrão: `admin` / `admin`.
- **Dashboard**: KPIs (total a pagar, vencidas, vencendo hoje, próximos 7
  dias, total pago, total pendente), filtros rápidos (hoje/semana/mês/ano/
  tudo), 4 gráficos (evolução, centro de custo, beneficiário, tipo de conta)
  e tabela de alertas (vencidas, vence hoje, alto valor) — tudo recalculado
  automaticamente a cada alteração.
- **Contas a Pagar**: cadastro completo (número, beneficiário, pagador,
  tipo de conta, centro de custo, tipo de custo, valor, datas de emissão/
  vencimento/pagamento, forma de pagamento, recorrência, observações),
  edição, exclusão, cancelamento, filtros por status/tipo/centro de
  custo/período. Inclui também:
  - **Código de barras**: campo para o número do código de barras/boleto,
    com geração visual (CODE128) e opção de impressão.
  - **Upload de comprovante**: anexar PDF ou imagem JPEG (armazenado em
    Base64 no LocalStorage, limite de 4MB por arquivo), com link para
    visualizar/abrir o anexo.
  - **Validação/confirmação de pagamento**: checkbox dedicado que confirma
    o pagamento, registra data/hora e o usuário responsável.
  - **Status 100% automático**: o sistema calcula o status sozinho a
    partir da data de vencimento e da validação/confirmação — não é mais
    um campo editável manualmente:
    - Validada → **Paga**
    - Não validada e vencimento já passado → **Vencida**
    - Não validada e dentro do prazo → **Aberta** ou **Agendada**
    - Cancelamento é a única ação manual de status (botão "🚫 Cancelar").
- **Beneficiários**: PF e PJ com todos os campos solicitados (documentos,
  endereço, contato, dados bancários, PIX, observações), busca, edição e
  exclusão.
- **Pagadores**: cadastro de múltiplas empresas/unidades pagadoras.
- **Cadastros Auxiliares (globais/compartilhados)**: Tipos de Conta,
  Centros de Custo e Tipos de Custo são tabelas únicas no sistema — ou
  seja, já são automaticamente compartilhadas e usadas por todas as
  empresas (pagadores) cadastradas, sem necessidade de duplicar cadastros.
- **Relatórios**: contas abertas, pagas, vencidas, fluxo financeiro,
  despesas por categoria, despesas por empresa e ranking das maiores
  despesas — com filtros por período/beneficiário/centro de custo,
  exportação para CSV (abre no Excel) e exportação/impressão em PDF
  (via diálogo de impressão do navegador).
- **Histórico/Auditoria**: registra automaticamente inclusões, alterações,
  exclusões e pagamentos/validações.
- **Usuários**: cadastro de administrador/operador/visualização com login
  e senha, usados na tela de autenticação.
- **Backup**:
  - Exportação/importação manual de todos os dados em JSON.
  - **Backup automático por intervalo de tempo** (5/15/30/60 min) salvo
    diretamente em uma **pasta escolhida pelo usuário** no computador
    (via File System Access API — suportado em Chrome/Edge; em
    navegadores sem suporte, o sistema oferece o download do arquivo).
  - **Backup ao encerrar o sistema** (logout/fechamento da aba), em
    melhor esforço.
  - Botão para limpar toda a base de dados.
- **Busca global**: pesquisa por nome, CNPJ/CPF, número de conta ou valor,
  no topo da tela.

### Sobre o status automático das contas
A regra fica centralizada em `DB.calcularStatus()` (arquivo
`js/database.js`) e é aplicada toda vez que o sistema carrega e sempre que
uma conta é salva, garantindo que **vencimento + validação de pagamento**
sejam a única fonte de verdade do status — eliminando inconsistência entre
contas "vencidas" que já foram pagas, por exemplo.

### Sobre login e segurança
Por ser um sistema 100% client-side (sem servidor/backend), o login e as
senhas dos usuários são validados e armazenados localmente no navegador,
em texto simples. Isso é adequado para uso pessoal/local ou em rede
interna controlada, mas **não é recomendado para exposição pública na
internet sem um backend real com hashing de senha** (ver seção
"Melhorias Futuras").

### Sobre o backup automático em pasta
A API usada (`showDirectoryPicker`) exige que o usuário escolha a pasta
novamente a cada nova sessão (o navegador não permite salvar esse acesso
de forma persistente entre recarregamentos por segurança). Por isso, ao
abrir o sistema, vá em **Backup → Escolher Pasta de Backup** sempre que
quiser reativar o backup automático naquela sessão.

## Melhorias futuras recomendadas

1. **Autenticação com hashing de senha** (bcrypt/Argon2) e backend real
   caso o sistema seja exposto publicamente — hoje a senha é validada
   localmente, em texto simples.
2. **Migrar para IndexedDB** caso o volume de contas/anexos cresça muito
   (LocalStorage tem limite de ~5–10MB por origem; anexos em Base64 podem
   consumir esse espaço rapidamente).
3. **Persistência da pasta de backup entre sessões** usando IndexedDB para
   guardar a permissão do `FileSystemDirectoryHandle` (hoje é necessário
   reselecionar a pasta a cada nova sessão, por restrição do navegador).
4. **Geração de boletos/PIX copia-e-cola** integrando com APIs bancárias.
5. **Multiempresa com isolamento de dados** por usuário/empresa, caso
   futuramente seja necessário que cada empresa veja apenas suas próprias
   contas (hoje os cadastros auxiliares e contas são compartilhados entre
   todos os pagadores, por design).
6. **Exportação real para .xlsx** (hoje é CSV, compatível com Excel) usando
   uma biblioteca como SheetJS, e PDF nativo (jsPDF) em vez do diálogo de
   impressão do navegador.
7. **Sincronização em nuvem** (Firebase, Supabase ou backend próprio) para
   acesso multiusuário simultâneo.
8. **Notificações por e-mail/WhatsApp** para contas próximas do vencimento.
9. **Testes automatizados** (Jest) para as regras de negócio de
   `database.js` e `relatorios.js`.

## Revisão técnica

- Toda a lógica de CRUD passa por uma camada única (`DB`), evitando
  duplicação e facilitando trocar o mecanismo de persistência no futuro.
- O dashboard e as listagens são *sempre* recalculados a partir da fonte
  única de dados após qualquer inclusão/edição/exclusão (`App.renderTudo`),
  evitando inconsistência de tela.
- O layout usa CSS Grid/Flex com variáveis de cor centralizadas e é
  responsivo (sidebar colapsa em telas pequenas, grids se reorganizam).
- Estilos de impressão (`@media print`) ocultam menus/filtros para um PDF
  limpo ao exportar relatórios.
