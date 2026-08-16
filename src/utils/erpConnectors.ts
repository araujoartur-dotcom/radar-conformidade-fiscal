/**
 * ============================================================
 * CONECTORES NATIVOS DE ERP (SAP S/4HANA, TOTVS PROTHEUS & WEBHOOKS)
 * ============================================================
 * Geração de estruturas de dados e payloads oficiais para
 * integração com ERPs de grande porte corporativo.
 * ============================================================
 */

import { DfeXmlItem } from '../types';

// =========================================================
// SAP S/4HANA & ECC — BAPI / IDOC CONVERTER
// =========================================================

export interface SapBapiHeader {
  INVOICE_IND: 'X';
  DOC_TYPE: 'RE';
  DOC_DATE: string; // YYYYMMDD
  PSTNG_DATE: string; // YYYYMMDD
  REF_DOC_NO: string; // Número NF-e
  COMP_CODE: string; // Empresa SAP (ex: 1000)
  DIFF_INV: string; // Fornecedor CNPJ / Código SAP
  CURRENCY: 'BRL';
  GROSS_AMOUNT: number;
  HEADER_TXT: string;
  FISCAL_CODE: string; // Chave de acesso 44 dígitos
}

export interface SapBapiItem {
  INVOICE_DOC_ITEM: number;
  PO_NUMBER?: string;
  PO_ITEM?: string;
  ITEM_AMOUNT: number;
  TAX_CODE: string;
  QUANTITY?: number;
  PO_UNIT?: string;
  ITEM_TEXT: string;
  CFOP: string;
  NCM: string;
}

export interface SapBapiTaxData {
  TAX_TYPE: 'ICMS' | 'IPI' | 'PIS' | 'COFINS' | 'CBS' | 'IBS';
  TAX_BASE: number;
  TAX_RATE: number;
  TAX_AMOUNT: number;
}

export interface SapPayloadResult {
  bapiName: 'BAPI_INCOMINGINVOICE_CREATE';
  headerData: SapBapiHeader;
  itemData: SapBapiItem[];
  taxData: SapBapiTaxData[];
  idocEquivalent: string;
}

export function buildSapBapiPayload(doc: DfeXmlItem, compCode: string = '1000'): SapPayloadResult {
  const docDate = (doc.dataEmissao || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const pstngDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

  const headerData: SapBapiHeader = {
    INVOICE_IND: 'X',
    DOC_TYPE: 'RE',
    DOC_DATE: docDate,
    PSTNG_DATE: pstngDate,
    REF_DOC_NO: doc.numero,
    COMP_CODE: compCode,
    DIFF_INV: doc.emitenteCnpj.replace(/\D/g, ''),
    CURRENCY: 'BRL',
    GROSS_AMOUNT: doc.valorTotal,
    HEADER_TXT: `NF-e ${doc.numero}/${doc.serie} - ${doc.emitenteNome.substring(0, 25)}`,
    FISCAL_CODE: doc.chaveAcesso,
  };

  const itemData: SapBapiItem[] = (doc.itens || []).map((it, idx) => ({
    INVOICE_DOC_ITEM: it.numeroItem || (idx + 1),
    ITEM_AMOUNT: it.valorTotal || doc.valorTotal,
    TAX_CODE: 'I1',
    QUANTITY: it.quantidade || 1,
    PO_UNIT: it.unidade || 'UN',
    ITEM_TEXT: it.descricao || 'ITEM DA NOTA FISCAL',
    CFOP: it.cfop || '1102',
    NCM: it.ncm || '00000000',
  }));

  if (itemData.length === 0) {
    itemData.push({
      INVOICE_DOC_ITEM: 1,
      ITEM_AMOUNT: doc.valorTotal,
      TAX_CODE: 'I1',
      QUANTITY: 1,
      PO_UNIT: 'UN',
      ITEM_TEXT: 'VALOR TOTAL DA NOTA FISCAL',
      CFOP: '1102',
      NCM: '00000000',
    });
  }

  const taxData: SapBapiTaxData[] = [
    { TAX_TYPE: 'ICMS', TAX_BASE: doc.valorTotal, TAX_RATE: 18.0, TAX_AMOUNT: doc.valorIcms },
    { TAX_TYPE: 'PIS', TAX_BASE: doc.valorTotal, TAX_RATE: 1.65, TAX_AMOUNT: doc.valorPis },
    { TAX_TYPE: 'COFINS', TAX_BASE: doc.valorTotal, TAX_RATE: 7.6, TAX_AMOUNT: doc.valorCofins },
    { TAX_TYPE: 'CBS', TAX_BASE: doc.valorTotal, TAX_RATE: doc.aliquotaCbs, TAX_AMOUNT: doc.valorCbs },
    { TAX_TYPE: 'IBS', TAX_BASE: doc.valorTotal, TAX_RATE: doc.aliquotaIbs, TAX_AMOUNT: doc.valorIbs },
  ];

  const idocEquivalent = `EDI_DC40: IDOC_NUM="0000000001" MESTYP="INVOIC" DOCTYP="INVOIC02"
E1EDK01: CURCY="BRL" BELNR="${doc.numero}" REC_CNPJ="${doc.destinatarioCnpj.replace(/\D/g, '')}"
E1EDKA1: PARVW="LF" PARTN="${doc.emitenteCnpj.replace(/\D/g, '')}" NAME1="${doc.emitenteNome}"
E1EDK02: QUALF="001" BELNR="${doc.chaveAcesso}"
E1EDS01: SUMID="020" SUMME="${doc.valorTotal.toFixed(2)}"`;

  return {
    bapiName: 'BAPI_INCOMINGINVOICE_CREATE',
    headerData,
    itemData,
    taxData,
    idocEquivalent,
  };
}

// =========================================================
// TOTVS PROTHEUS — TABELAS SF1 & SD1 (EXECAUTO MATA103)
// =========================================================

export interface TotvsProtheusSf1Header {
  F1_DOC: string; // Número
  F1_SERIE: string; // Série
  F1_FORNECE: string; // Código Fornecedor
  F1_LOJA: string; // Loja Fornecedor
  F1_EMISSAO: string; // YYYYMMDD
  F1_EST: string; // UF Fornecedor
  F1_VALBRUT: number;
  F1_VALICM: number;
  F1_VALPIS: number;
  F1_VALCOF: number;
  F1_VALCBS: number; // Reforma Tributária
  F1_VALIBS: number; // Reforma Tributária
  F1_CHVNFE: string; // Chave 44 dígitos
  F1_ESPECIE: 'SPED';
}

export interface TotvsProtheusSd1Item {
  D1_ITEM: string; // 01, 02...
  D1_COD: string;
  D1_QUANT: number;
  D1_VUNIT: number;
  D1_TOTAL: number;
  D1_CF: string;
  D1_CLASFIS: string; // cClassTrib
  D1_VALICM: number;
  D1_VALCBS: number;
  D1_VALIBS: number;
}

export interface TotvsPayloadResult {
  execAuto: 'MATA103';
  sf1Header: TotvsProtheusSf1Header;
  sd1Items: TotvsProtheusSd1Item[];
}

export function buildTotvsProtheusPayload(doc: DfeXmlItem): TotvsPayloadResult {
  const emissao = (doc.dataEmissao || new Date().toISOString().split('T')[0]).replace(/-/g, '');

  const sf1Header: TotvsProtheusSf1Header = {
    F1_DOC: doc.numero.padStart(9, '0'),
    F1_SERIE: doc.serie.padStart(3, '0'),
    F1_FORNECE: doc.emitenteCnpj.replace(/\D/g, '').substring(0, 6),
    F1_LOJA: '01',
    F1_EMISSAO: emissao,
    F1_EST: doc.emitenteUf || 'SP',
    F1_VALBRUT: doc.valorTotal,
    F1_VALICM: doc.valorIcms,
    F1_VALPIS: doc.valorPis,
    F1_VALCOF: doc.valorCofins,
    F1_VALCBS: doc.valorCbs,
    F1_VALIBS: doc.valorIbs,
    F1_CHVNFE: doc.chaveAcesso,
    F1_ESPECIE: 'SPED',
  };

  const sd1Items: TotvsProtheusSd1Item[] = (doc.itens || []).map((it, idx) => ({
    D1_ITEM: String(idx + 1).padStart(2, '0'),
    D1_COD: it.codigo || `PROD-${idx + 1}`,
    D1_QUANT: it.quantidade || 1,
    D1_VUNIT: it.valorUnitario || it.valorTotal || doc.valorTotal,
    D1_TOTAL: it.valorTotal || doc.valorTotal,
    D1_CF: it.cfop || '1102',
    D1_CLASFIS: it.cClassTrib || '000001',
    D1_VALICM: it.valorIcms || 0,
    D1_VALCBS: it.valorCbs || 0,
    D1_VALIBS: it.valorIbs || 0,
  }));

  if (sd1Items.length === 0) {
    sd1Items.push({
      D1_ITEM: '01',
      D1_COD: 'PROD-01',
      D1_QUANT: 1,
      D1_VUNIT: doc.valorTotal,
      D1_TOTAL: doc.valorTotal,
      D1_CF: '1102',
      D1_CLASFIS: '000001',
      D1_VALICM: doc.valorIcms,
      D1_VALCBS: doc.valorCbs,
      D1_VALIBS: doc.valorIbs,
    });
  }

  return {
    execAuto: 'MATA103',
    sf1Header,
    sd1Items,
  };
}

// =========================================================
// WEBHOOK REST GENÉRICO (JSON + HMAC SHA-256)
// =========================================================

export interface WebhookDfePayload {
  event: 'dfe.captured' | 'dfe.synchronized' | 'dfe.manifested';
  timestamp: string;
  environment: 'homologacao' | 'producao';
  dfe: {
    chaveAcesso: string;
    tipo: string;
    numero: string;
    serie: string;
    dataEmissao: string;
    emitente: {
      cnpj: string;
      razaoSocial: string;
      uf: string;
    };
    destinatario: {
      cnpj: string;
      razaoSocial: string;
      uf: string;
    };
    totais: {
      valorBruto: number;
      icms: number;
      pis: number;
      cofins: number;
      cbs: number;
      ibs: number;
      impostoSeletivo: number;
    };
    statusAuditoria: string;
    xmlBase64?: string;
  };
}

export function buildGenericWebhookPayload(doc: DfeXmlItem, eventType: WebhookDfePayload['event'] = 'dfe.captured'): WebhookDfePayload {
  return {
    event: eventType,
    timestamp: new Date().toISOString(),
    environment: 'producao',
    dfe: {
      chaveAcesso: doc.chaveAcesso,
      tipo: doc.tipo,
      numero: doc.numero,
      serie: doc.serie,
      dataEmissao: doc.dataEmissao,
      emitente: {
        cnpj: doc.emitenteCnpj,
        razaoSocial: doc.emitenteNome,
        uf: doc.emitenteUf,
      },
      destinatario: {
        cnpj: doc.destinatarioCnpj,
        razaoSocial: doc.destinatarioNome,
        uf: doc.destinatarioUf,
      },
      totais: {
        valorBruto: doc.valorTotal,
        icms: doc.valorIcms,
        pis: doc.valorPis,
        cofins: doc.valorCofins,
        cbs: doc.valorCbs,
        ibs: doc.valorIbs,
        impostoSeletivo: doc.valorImpostoSeletivo,
      },
      statusAuditoria: doc.statusAuditoria,
    },
  };
}
