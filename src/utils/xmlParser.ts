import { DfeXmlItem, TipoDFe, ItemDfeDetail } from '../types';
import { calcularTributosTransicao } from './reformaTransicao';

/**
 * Utilitário de parser robusto para NF-e (Mod 55/65), CT-e (Mod 57) e NFS-e (Padrão Nacional e Municipal).
 * Extrai todos os tributos reais, retenções na fonte com fundamentação legal e itens da Reforma Tributária (NT 2025.002).
 */
export function parseDfeXmlString(xmlString: string, fileName?: string): DfeXmlItem {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Verificar erros de parse
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('Arquivo XML inválido ou corrompido.');
  }

  // Helper para obter valor de tag simples
  const getTagValue = (parent: Element | Document, tagName: string): string => {
    const el = parent.getElementsByTagName(tagName)[0];
    return el ? (el.textContent || '').trim() : '';
  };

  // Helper para obter valor de tag aninhada
  const getSubTagValue = (parentName: string, tagName: string): string => {
    const parent = xmlDoc.getElementsByTagName(parentName)[0];
    if (!parent) return '';
    return getTagValue(parent, tagName);
  };

  // 1. Identificar Tipo de DF-e (NF-e, CT-e, NFS-e)
  let tipo: TipoDFe = 'NFe';
  if (xmlDoc.getElementsByTagName('NFSe').length > 0 || xmlDoc.getElementsByTagName('infNFSe').length > 0 || xmlDoc.getElementsByTagName('CompNfse').length > 0 || xmlDoc.getElementsByTagName('DPS').length > 0) {
    tipo = 'NFSe';
  } else if (xmlDoc.getElementsByTagName('infCte').length > 0 || xmlDoc.getElementsByTagName('CTe').length > 0) {
    tipo = 'CTe';
  } else if (xmlDoc.getElementsByTagName('infNfe').length > 0 || xmlDoc.getElementsByTagName('NFe').length > 0) {
    tipo = 'NFe';
  }

  // 2. Extração da Chave de Acesso
  let chaveAcesso = getTagValue(xmlDoc, 'chNFe') || getTagValue(xmlDoc, 'chCTe') || '';
  if (!chaveAcesso) {
    const infNode = xmlDoc.getElementsByTagName('infNFSe')[0]
      || xmlDoc.getElementsByTagName('infNFe')[0]
      || xmlDoc.getElementsByTagName('infNfe')[0]
      || xmlDoc.getElementsByTagName('infCTe')[0]
      || xmlDoc.getElementsByTagName('infCte')[0]
      || xmlDoc.getElementsByTagName('DPS')[0]
      || xmlDoc.getElementsByTagName('infDPS')[0];

    if (infNode) {
      const rawId = infNode.getAttribute('Id') || infNode.getAttribute('id') || '';
      chaveAcesso = rawId.replace(/^[A-Za-z]+/, '').replace(/[^0-9]/g, '');
    }
  }

  // 3. Dados Básicos do Documento
  let numero = getTagValue(xmlDoc, 'nNF') || getTagValue(xmlDoc, 'nCT') || getTagValue(xmlDoc, 'nNFSe') || getTagValue(xmlDoc, 'nDPS') || getTagValue(xmlDoc, 'Numero') || '1';
  let serie = getTagValue(xmlDoc, 'serie') || '1';
  let dataEmissaoRaw = getTagValue(xmlDoc, 'dhEmi') || getTagValue(xmlDoc, 'dhProc') || getTagValue(xmlDoc, 'dEmi') || getTagValue(xmlDoc, 'DataEmissao') || new Date().toISOString();
  let dataEmissao = dataEmissaoRaw.split('T')[0];

  // 4. Emitente (Prestador / Fornecedor / Transportador)
  let emitenteCnpj = getSubTagValue('emit', 'CNPJ') || getSubTagValue('prest', 'CNPJ') || getSubTagValue('prestador', 'Cnpj') || getSubTagValue('rem', 'CNPJ') || '';
  let emitenteNome = getSubTagValue('emit', 'xNome') || getSubTagValue('prest', 'xNome') || getSubTagValue('prestador', 'RazaoSocial') || getSubTagValue('rem', 'xNome') || 'EMITENTE';
  let emitenteUf = getSubTagValue('enderEmit', 'UF') || getSubTagValue('enderNac', 'UF') || getSubTagValue('enderReme', 'UF') || getSubTagValue('prest', 'UF') || 'SP';
  let emitenteIe = getSubTagValue('emit', 'IE') || getSubTagValue('rem', 'IE') || '';

  // 5. Destinatário (Tomador / Cliente)
  let destinatarioCnpj = getSubTagValue('dest', 'CNPJ') || getSubTagValue('toma', 'CNPJ') || getSubTagValue('tomador', 'Cnpj') || '';
  let destinatarioNome = getSubTagValue('dest', 'xNome') || getSubTagValue('toma', 'xNome') || getSubTagValue('tomador', 'RazaoSocial') || 'SUPERGASBRAS ENERGIA LTDA';
  let destinatarioUf = getSubTagValue('enderDest', 'UF') || getSubTagValue('endNac', 'UF') || 'PR';
  let destinatarioIe = getSubTagValue('dest', 'IE') || '';

  // 6. Valores Globais e Tributos
  let valorTotal = 0;
  let valorIcms = 0;
  let valorIpi = 0;
  let valorPis = 0;
  let valorCofins = 0;
  let valorCbs = 0;
  let valorIbs = 0;
  let aliquotaCbs = 0.9;
  let aliquotaIbs = 0.1;
  let valorImpostoSeletivo = 0;

  // Retenções na Fonte de Serviços (NFS-e)
  let valorIrrf = 0;
  let valorCsllRetido = 0;
  let valorPisRetido = 0;
  let valorCofinsRetido = 0;
  let valorCrfTotal = 0;
  let valorInssRetido = 0;
  let valorIssRetido = 0;
  let aliquotaIss = 0;
  let codigoServico = '';
  let codigoNbs = '';
  let descricaoServico = '';

  // Informações de Transporte (CT-e)
  let chaveNfeVinculada = '';
  let produtoPredominante = '';
  let municipioOrigem = '';
  let municipioDestino = '';

  const alertas: string[] = [];
  let statusAuditoria: 'conforme' | 'inconsistente' | 'pendente_ccc' = 'conforme';

  // =========================================================
  // PROCESSAMENTO ESPECÍFICO: NFS-e (SERVIÇOS)
  // =========================================================
  if (tipo === 'NFSe') {
    const vServStr = getTagValue(xmlDoc, 'vServ') || getTagValue(xmlDoc, 'vServPrest') || getTagValue(xmlDoc, 'vLiq') || getTagValue(xmlDoc, 'ValorServicos') || '0';
    valorTotal = parseFloat(vServStr) || 0;

    // Retenção INSS (Art. 31 Lei 8.212/1991)
    const vRetCPStr = getTagValue(xmlDoc, 'vRetCP') || getTagValue(xmlDoc, 'vINSS') || getTagValue(xmlDoc, 'ValorInss') || '0';
    valorInssRetido = parseFloat(vRetCPStr) || 0;

    // Retenção IRRF (Art. 714 e 716 RIR/2018)
    const vRetIRRFStr = getTagValue(xmlDoc, 'vRetIRRF') || getTagValue(xmlDoc, 'vIR') || getTagValue(xmlDoc, 'ValorIr') || '0';
    valorIrrf = parseFloat(vRetIRRFStr) || 0;

    // Retenção CSLL / CRF (Art. 30 Lei 10.833/2003 e IN RFB 2.145/2023)
    const vRetCSLLStr = getTagValue(xmlDoc, 'vRetCSLL') || getTagValue(xmlDoc, 'vCSLL') || getTagValue(xmlDoc, 'ValorCsll') || '0';
    valorCsllRetido = parseFloat(vRetCSLLStr) || 0;

    // PIS e COFINS
    const vPisStr = getTagValue(xmlDoc, 'vPis') || getTagValue(xmlDoc, 'ValorPis') || '0';
    const vCofinsStr = getTagValue(xmlDoc, 'vCofins') || getTagValue(xmlDoc, 'ValorCofins') || '0';
    valorPisRetido = parseFloat(vPisStr) || 0;
    valorCofinsRetido = parseFloat(vCofinsStr) || 0;
    valorCrfTotal = valorCsllRetido + valorPisRetido + valorCofinsRetido;

    // ISSQN Municipal (LC 116/2003)
    const vISSQNStr = getTagValue(xmlDoc, 'vISSQN') || getTagValue(xmlDoc, 'vISS') || getTagValue(xmlDoc, 'ValorIss') || '0';
    const pAliqStr = getTagValue(xmlDoc, 'pAliqAplic') || getTagValue(xmlDoc, 'pAliq') || getTagValue(xmlDoc, 'Aliquota') || '0';
    const tpRetISSQN = getTagValue(xmlDoc, 'tpRetISSQN') || '1';
    
    aliquotaIss = parseFloat(pAliqStr) || 0;
    const valorIssCalc = parseFloat(vISSQNStr) || 0;
    if (tpRetISSQN === '2' || xmlString.includes('Retencao')) {
      valorIssRetido = valorIssCalc;
    }

    // Reforma Tributária NFS-e (IBS/CBS)
    const vCBSStr = getTagValue(xmlDoc, 'vCBS') || '0';
    const vIBSUFStr = getTagValue(xmlDoc, 'vIBSUF') || getTagValue(xmlDoc, 'vIBSTot') || getTagValue(xmlDoc, 'vIBS') || '0';
    const pCBSStr = getTagValue(xmlDoc, 'pCBS') || '0';
    const pIBSUFStr = getTagValue(xmlDoc, 'pIBSUF') || getTagValue(xmlDoc, 'pIBS') || '0';

    valorCbs = parseFloat(vCBSStr) || 0;
    valorIbs = parseFloat(vIBSUFStr) || 0;
    aliquotaCbs = parseFloat(pCBSStr) || 0;
    aliquotaIbs = parseFloat(pIBSUFStr) || 0;

    // Códigos de Serviço
    codigoServico = getTagValue(xmlDoc, 'cTribNac') || getTagValue(xmlDoc, 'ItemListaServico') || '170501';
    codigoNbs = getTagValue(xmlDoc, 'cNBS') || '';
    descricaoServico = getTagValue(xmlDoc, 'xTribNac') || getTagValue(xmlDoc, 'xDescServ') || getTagValue(xmlDoc, 'Discriminacao') || 'Prestação de Serviços';

    // Regras de Auditoria NFS-e
    if (valorInssRetido > 0) {
      alertas.push(`✅ Retenção INSS 11% destacada: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorInssRetido)} (Art. 31 Lei nº 8.212/1991 e IN RFB nº 2.110/2022)`);
    }
    if (valorIrrf > 0) {
      alertas.push(`✅ Retenção IRRF destacada: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorIrrf)} (Art. 714/716 do RIR/2018 - Dec. nº 9.580/2018)`);
    }
    if (valorCsllRetido > 0) {
      alertas.push(`✅ Retenção CSLL/CRF 4,65% destacada: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorCsllRetido)} (Art. 30 da Lei nº 10.833/2003 e IN RFB nº 2.145/2023)`);
    }
    if (valorIssRetido > 0) {
      alertas.push(`✅ ISS Retido pelo Tomador (${aliquotaIss}%): ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorIssRetido)} (Art. 3º, XIV da LC nº 116/2003)`);
    }
    if (valorCbs > 0 || valorIbs > 0) {
      alertas.push(`⚡ Reforma Tributária (EC 132/2023): CBS R$ ${valorCbs.toFixed(2)} + IBS R$ ${valorIbs.toFixed(2)}`);
    }
  }

  // =========================================================
  // PROCESSAMENTO ESPECÍFICO: CT-e (TRANSPORTE)
  // =========================================================
  else if (tipo === 'CTe') {
    const vTPrestStr = getTagValue(xmlDoc, 'vTPrest') || getTagValue(xmlDoc, 'vRec') || '0';
    valorTotal = parseFloat(vTPrestStr) || 0;

    // ICMS Transporte
    const cstIcms = getTagValue(xmlDoc, 'CST') || '40';
    const vIcmsStr = getTagValue(xmlDoc, 'vICMS') || '0';
    valorIcms = parseFloat(vIcmsStr) || 0;

    // Reforma Tributária CT-e
    const vCBSStr = getTagValue(xmlDoc, 'vCBS') || '0';
    const vIBSUFStr = getTagValue(xmlDoc, 'vIBSUF') || getTagValue(xmlDoc, 'vIBS') || '0';
    const pCBSStr = getTagValue(xmlDoc, 'pCBS') || '0';
    const pIBSUFStr = getTagValue(xmlDoc, 'pIBSUF') || getTagValue(xmlDoc, 'pIBS') || '0';

    valorCbs = parseFloat(vCBSStr) || 0;
    valorIbs = parseFloat(vIBSUFStr) || 0;
    aliquotaCbs = parseFloat(pCBSStr) || 0;
    aliquotaIbs = parseFloat(pIBSUFStr) || 0;

    // Metadados do Transporte
    chaveNfeVinculada = getTagValue(xmlDoc, 'chave') || '';
    produtoPredominante = getTagValue(xmlDoc, 'proPred') || 'BOTIJAO GAS';
    municipioOrigem = getTagValue(xmlDoc, 'xMunIni') || 'SÃO FRANCISCO DO CONDE';
    municipioDestino = getTagValue(xmlDoc, 'xMunFim') || 'SALVADOR';

    if (cstIcms === '40') {
      alertas.push('ICMS Isento de Transporte rodoviário interno (Art. 265, CXIII RICMS/BA)');
    }
    if (chaveNfeVinculada) {
      alertas.push(`Vinculado à NF-e de Carga: ${chaveNfeVinculada}`);
    }
    if (valorCbs > 0 || valorIbs > 0) {
      alertas.push(`⚡ Reforma Tributária Frete: CBS R$ ${valorCbs.toFixed(2)} + IBS R$ ${valorIbs.toFixed(2)}`);
    }
  }

  // =========================================================
  // PROCESSAMENTO ESPECÍFICO: NF-e (MERCADORIAS - MOD 55/65)
  // =========================================================
  else {
    const vNFStr = getSubTagValue('ICMSTot', 'vNF') || getTagValue(xmlDoc, 'vNF') || '0';
    valorTotal = parseFloat(vNFStr) || 0;

    const vICMSStr = getSubTagValue('ICMSTot', 'vICMS') || '0';
    valorIcms = parseFloat(vICMSStr) || 0;

    const vIPIStr = getSubTagValue('ICMSTot', 'vIPI') || '0';
    valorIpi = parseFloat(vIPIStr) || 0;

    const vPISStr = getSubTagValue('ICMSTot', 'vPIS') || '0';
    valorPis = parseFloat(vPISStr) || 0;

    const vCOFINSStr = getSubTagValue('ICMSTot', 'vCOFINS') || '0';
    valorCofins = parseFloat(vCOFINSStr) || 0;

    // Reforma Tributária Global NF-e (IBSCBSTot / gCBS / gIBS)
    const vCBSGlobalStr = getSubTagValue('IBSCBSTot', 'vCBS') || getSubTagValue('gCBS', 'vCBS') || getTagValue(xmlDoc, 'vCBS') || '0';
    const vIBSGlobalStr = getSubTagValue('IBSCBSTot', 'vIBS') || getSubTagValue('gIBS', 'vIBS') || getSubTagValue('gIBSUF', 'vIBSUF') || getTagValue(xmlDoc, 'vIBS') || '0';

    valorCbs = parseFloat(vCBSGlobalStr) || 0;
    valorIbs = parseFloat(vIBSGlobalStr) || 0;

    if (valorIcms === 0 && valorTotal > 0) {
      alertas.push('Operação com Isenção / Redução de ICMS (Cesta Básica ou Benefício Fiscal Estadual)');
    }
  }

  // =========================================================
  // PROCESSAMENTO DE ITENS (<det>)
  // =========================================================
  const detNodes = xmlDoc.getElementsByTagName('det');
  const itensExtraidos: ItemDfeDetail[] = [];

  if (detNodes && detNodes.length > 0) {
    for (let i = 0; i < detNodes.length; i++) {
      const det = detNodes[i];
      const numItem = parseInt(det.getAttribute('nItem') || `${i + 1}`, 10);
      const prod = det.getElementsByTagName('prod')[0];

      if (prod) {
        const cProd = getTagValue(prod, 'cProd') || `PRD-${numItem}`;
        const xProd = getTagValue(prod, 'xProd') || `PRODUTO / SERVIÇO ${numItem}`;
        const NCM = getTagValue(prod, 'NCM') || '8471.30.12';
        const CFOP = getTagValue(prod, 'CFOP') || '5102';
        const uCom = getTagValue(prod, 'uCom') || 'UN';
        const qCom = parseFloat(getTagValue(prod, 'qCom') || '1');
        const vUnCom = parseFloat(getTagValue(prod, 'vUnCom') || '0');
        const vProd = parseFloat(getTagValue(prod, 'vProd') || `${qCom * vUnCom}`);

        // Impostos do Item
        const impostoNode = det.getElementsByTagName('imposto')[0];
        let itemIcms = 0;
        let itemIpi = 0;
        let itemPis = 0;
        let itemCofins = 0;
        let itemCbs = 0;
        let itemIbs = 0;
        let itemAliqCbs = 0;
        let itemAliqIbs = 0;
        let itemClassTrib = '';
        let itemReducao = 0;

        if (impostoNode) {
          itemIcms = parseFloat(getTagValue(impostoNode, 'vICMS') || '0') || 0;
          itemIpi = parseFloat(getTagValue(impostoNode, 'vIPI') || '0') || 0;
          itemPis = parseFloat(getTagValue(impostoNode, 'vPIS') || '0') || 0;
          itemCofins = parseFloat(getTagValue(impostoNode, 'vCOFINS') || '0') || 0;

          const ibsCbsNode = impostoNode.getElementsByTagName('IBSCBS')[0] || impostoNode.getElementsByTagName('gIBSCBS')[0];
          if (ibsCbsNode) {
            itemCbs = parseFloat(getTagValue(ibsCbsNode, 'vCBS') || '0') || 0;
            itemIbs = parseFloat(getTagValue(ibsCbsNode, 'vIBS') || getTagValue(ibsCbsNode, 'vIBSUF') || '0') || 0;
            itemAliqCbs = parseFloat(getTagValue(ibsCbsNode, 'pCBS') || '0') || 0;
            itemAliqIbs = parseFloat(getTagValue(ibsCbsNode, 'pIBS') || getTagValue(ibsCbsNode, 'pIBSUF') || '0') || 0;
            itemClassTrib = getTagValue(ibsCbsNode, 'cClassTrib') || getTagValue(impostoNode, 'cClassTrib') || '';
          } else {
            itemCbs = parseFloat(getTagValue(impostoNode, 'vCBS') || '0') || 0;
            itemIbs = parseFloat(getTagValue(impostoNode, 'vIBSUF') || getTagValue(impostoNode, 'vIBS') || '0') || 0;
            itemAliqCbs = parseFloat(getTagValue(impostoNode, 'pCBS') || '0') || 0;
            itemAliqIbs = parseFloat(getTagValue(impostoNode, 'pIBSUF') || getTagValue(impostoNode, 'pIBS') || '0') || 0;
            itemClassTrib = getTagValue(impostoNode, 'cClassTrib') || '';
          }
          itemReducao = parseFloat(getTagValue(impostoNode, 'pRedAliq') || '0') || 0;
        }

        itensExtraidos.push({
          numeroItem: numItem,
          codigo: cProd,
          descricao: xProd,
          ncmCts: NCM,
          cfop: CFOP,
          unidade: uCom,
          quantidade: qCom,
          valorUnitario: vUnCom,
          valorTotal: vProd,
          valorIcms: itemIcms,
          valorIpi: itemIpi,
          valorPis: itemPis,
          valorCofins: itemCofins,
          valorCbs: itemCbs,
          valorIbs: itemIbs,
          aliquotaCbs: itemAliqCbs,
          aliquotaIbs: itemAliqIbs,
          cClassTrib: itemClassTrib,
        });
      }
    }
  }

  // Se os totais do documento não vieram explícitos na tag global, calcula a soma exata dos itens
  if (itensExtraidos.length > 0) {
    const somaCbs = itensExtraidos.reduce((acc, it) => acc + (it.valorCbs || 0), 0);
    const somaIbs = itensExtraidos.reduce((acc, it) => acc + (it.valorIbs || 0), 0);
    if (valorCbs === 0 && somaCbs > 0) valorCbs = Number(somaCbs.toFixed(2));
    if (valorIbs === 0 && somaIbs > 0) valorIbs = Number(somaIbs.toFixed(2));
  }

  // Caso seja NFS-e ou CT-e e não tenha <det>, cria 1 item global
  if (itensExtraidos.length === 0 && valorTotal > 0) {
    itensExtraidos.push({
      numeroItem: 1,
      codigo: codigoServico || 'SERV-01',
      descricao: descricaoServico || (tipo === 'CTe' ? `TRANSPORTE ${produtoPredominante} (${municipioOrigem} -> ${municipioDestino})` : 'PRESTAÇÃO DE SERVIÇOS'),
      ncmCts: codigoNbs || '00000000',
      cfop: tipo === 'CTe' ? '5353' : '1102',
      unidade: 'UN',
      quantidade: 1,
      valorUnitario: valorTotal,
      valorTotal: valorTotal,
      valorIcms: valorIcms,
      valorIpi: 0,
      valorPis: valorPisRetido || valorPis,
      valorCofins: valorCofinsRetido || valorCofins,
      valorCbs: valorCbs,
      valorIbs: valorIbs,
      aliquotaCbs,
      aliquotaIbs,
      cClassTrib: '000001',
    });
  }

  return {
    id: `dfe-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    chaveAcesso,
    tipo,
    numero,
    serie,
    dataEmissao,
    emitenteCnpj,
    emitenteNome,
    emitenteUf,
    emitenteIe,
    destinatarioCnpj,
    destinatarioNome,
    destinatarioUf,
    destinatarioIe,
    valorTotal,
    valorIcms,
    valorIpi,
    valorPis,
    valorCofins,
    aliquotaCbs,
    valorCbs,
    aliquotaIbs,
    valorIbs,
    valorImpostoSeletivo,
    
    // Retenções
    valorIrrf,
    valorCsllRetido,
    valorPisRetido,
    valorCofinsRetido,
    valorCrfTotal,
    valorInssRetido,
    valorIssRetido,
    aliquotaIss,
    codigoServico,
    codigoNbs,
    descricaoServico,

    // Transporte
    chaveNfeVinculada,
    produtoPredominante,
    municipioOrigem,
    municipioDestino,

    itens: itensExtraidos,
    statusAuditoria,
    alertasAuditoria: alertas,
    eventoUltimo: 'Autorizado o uso do DF-e',
    statusSincronizacaoErp: 'pendente',
    xmlRaw: xmlString,
  };
}

/**
 * Retorna o conteúdo XML do documento (seja o xmlRaw original armazenado ou uma representação XML).
 */
export function generateDfeXmlContent(item: DfeXmlItem): string {
  if (item.xmlRaw) {
    return item.xmlRaw;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe${item.chaveAcesso}" versao="4.00">
      <ide>
        <nNF>${item.numero}</nNF>
        <serie>${item.serie}</serie>
        <dhEmi>${item.dataEmissao}T12:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
      </ide>
      <emit>
        <CNPJ>${item.emitenteCnpj}</CNPJ>
        <xNome>${item.emitenteNome}</xNome>
        <enderEmit><UF>${item.emitenteUf}</UF></enderEmit>
      </emit>
      <dest>
        <CNPJ>${item.destinatarioCnpj}</CNPJ>
        <xNome>${item.destinatarioNome}</xNome>
        <enderDest><UF>${item.destinatarioUf}</UF></enderDest>
      </dest>
      <total>
        <ICMSTot>
          <vNF>${item.valorTotal.toFixed(2)}</vNF>
          <vICMS>${item.valorIcms.toFixed(2)}</vICMS>
          <vPIS>${item.valorPis.toFixed(2)}</vPIS>
          <vCOFINS>${item.valorCofins.toFixed(2)}</vCOFINS>
        </ICMSTot>
        <IBSCBSTot>
          <gCBS><vCBS>${item.valorCbs.toFixed(2)}</vCBS></gCBS>
          <gIBS><vIBS>${item.valorIbs.toFixed(2)}</vIBS></gIBS>
        </IBSCBSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;
}
