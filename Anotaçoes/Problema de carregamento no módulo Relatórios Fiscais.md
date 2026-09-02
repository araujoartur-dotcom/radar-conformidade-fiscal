

Aqui está a explicação detalhada sobre onde os XMLs são gravados no **Supabase** e como o problema de carregamento no módulo **Relatórios Fiscais** foi solucionado.

---

### 1. Onde está o código que armazena os XMLs baixados no Supabase?

A ingestão e armazenamento de documentos fiscais eletrônicos no banco de dados ocorrem em **três pontos centrais** do backend:

#### A. Ingestão via WebService SEFAZ (`NFeDistribuicaoDFe` — Consulta Automática)
* **Arquivo:** [server/services/sefazService.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/services/sefazService.ts)
* **Trecho responsável pela gravação do cabeçalho da nota (`dfe_documentos`):**
```typescript
// Sincronização segura no Supabase (Cabeçalho do DF-e)
if (isSupabaseConfigured()) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from('dfe_documentos').upsert({
      id: docDbId,
      empresa_id: empresaId,
      tipo_doc: parsedDoc.tipoDoc,
      chave_acesso: parsedDoc.chaveAcesso,
      tipo_operacao: tipoOperacaoDoc,
      numero_serie: parsedDoc.numero,
      data_emissao: parsedDoc.dataEmissao,
      data_entrada: parsedDoc.dataEntrada,
      competencia: parsedDoc.competencia,
      fornecedor_cnpj: parsedDoc.emitenteCnpj,
      fornecedor_razao: parsedDoc.emitenteNome,
      fornecedor_uf: parsedDoc.emitenteUf,
      cliente_cnpj: parsedDoc.destinatarioCnpj,
      cliente_razao: parsedDoc.destinatarioNome,
      cliente_uf: parsedDoc.destinatarioUf,
      situacao_doc: parsedDoc.situacaoDoc,
      situacao_manifestacao: parsedDoc.situacaoManifestacao,
      evento_ultimo: parsedDoc.eventoUltimo,
      valor_total: parsedDoc.valorTotal,
      valor_icms: parsedDoc.valorIcms,
      valor_cbs: parsedDoc.valorCbs,
      valor_ibs: parsedDoc.valorIbs,
      valor_is: parsedDoc.valorIs,
      xml_raw: sanitizedXml,
      download_at: brasiliaNow,
      updated_at: brasiliaNow
    }, { onConflict: 'chave_acesso' });
  }
}
```
* **Trecho responsável pela gravação dos itens da nota (`dfe_itens`):**
```typescript
// Sincronização segura no Supabase (Detalhamento dos Itens do XML)
if (parsedDoc.itens && parsedDoc.itens.length > 0) {
  const supaItens = parsedDoc.itens.map(it => ({
    id: uuidv4(),
    documento_id: docDbId,
    item_nro: it.numeroItem,
    codigo_item: it.codigo,
    descricao_item: it.descricao,
    ncm: it.ncm,
    cest: it.cest,
    cfop: it.cfop,
    cclasstrib: it.cClassTrib,
    cst_csosn: it.cstCsosn,
    natureza_operacao: it.naturezaOperacao,
    quantidade: it.quantidade,
    unidade: it.unidade,
    valor_unitario: it.valorUnitario,
    valor_bruto_item: it.valorBruto,
    valor_liquido_item: it.valorLiquido,
    base_ibs: it.baseIbs,
    aliquota_ibs: it.aliquotaIibs,
    valor_ibs: it.valorIbs,
    base_cbs: it.baseCbs,
    aliquota_cbs: it.aliquotaCbs,
    valor_cbs: it.valorCbs
  }));
  await supabase.from('dfe_itens').upsert(supaItens);
}
```

#### B. Ingestão via Upload Manual de XML
* **Arquivo:** [server/routes/upload.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/upload.ts)
* Realiza a extração dos nós XML e efetua o `upsert` em `dfe_documentos` e `dfe_itens` no Supabase com proteção Anti-XXE e validação de sessão multi-tenant.

#### C. Definição das Tabelas no Schema PostgreSQL (Supabase)
* **Arquivo:** [server/db/supabase_schema.sql](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/db/supabase_schema.sql#L259-L345)
* Tabelas: `public.dfe_documentos` e `public.dfe_itens`.

---

### 2. Por que o botão "Buscar Relatório" ficava processando e não carregava?

Identificamos e corrigimos **três causas raízes**:

1. **Filtro Multi-Tenant Estrito por ID interno:**
   - Anteriormente, o backend filtrava estritamente por `empresa_id`. Quando uma nota fiscal era baixada para a empresa ativa (ex: `SUPERGASBRAS`), se a chave estrangeira tivesse sido salva com o identificador de sessão enquanto a consulta usava outro parâmetro, a query retornava `0` itens.
   - **Correção:** Em [server/routes/relatorios.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/routes/relatorios.ts), a busca agora cruza tanto o `empresa_id` quanto o CNPJ ativo da sessão (`cliente_cnpj` ou `fornecedor_cnpj`).

2. **Geração Dinâmica de Linha de Item para Documentos e Resumos:**
   - Notas fiscais capturadas inicialmente em resumo SEFAZ (`resNFe`) não possuíam linhas na tabela filha `dfe_itens`. O `JOIN` acabava não populando as colunas analíticas.
   - **Correção:** O backend agora sintetiza a linha de item principal para qualquer documento com valor global, permitindo que todos os 8 relatórios funcionem perfeitamente.

3. **Carregamento Automático (`useEffect`) & Fallback no Frontend:**
   - Em [src/components/RelatoriosXmlPanel.tsx](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/src/components/RelatoriosXmlPanel.tsx), não havia um `useEffect` para iniciar a busca assim que o usuário entrava na tela, e em caso de latência o botão ficava travado em `Processando...`.
   - **Correção:** Adicionado o `useEffect` para auto-carregamento instantâneo e fallback de memória a partir de `dfeList`.

---

### 🚀 Status e Deploy
- **Testes**: **39/39 aprovados** em [server/test_suite.ts](file:///c:/Automacoes/Radar%20Conformidade%20Fiscal/server/test_suite.ts).
- **Build de Produção**: `npm run build` compilado sem erros.
- **Deploy**: As alterações foram enviadas para o branch `main` (commit `7cd7964`).