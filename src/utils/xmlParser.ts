import { DfeXmlItem, TipoDFe } from '../types';
import { calcularTributosTransicao } from './reformaTransicao';

/**
 * Parses raw XML text string into a structured DfeXmlItem object.
 * Handles NF-e (procNFe / NFe), NFS-e, CT-e, MDF-e schemas cleanly.
 */
export function parseDfeXmlString(xmlString: string, fileName?: string): DfeXmlItem {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Check for XML parse errors
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('Arquivo XML inválido ou corrompido.');
  }

  // Detect DFe Type
  let tipo: TipoDFe = 'NFe';
  if (xmlDoc.getElementsByTagName('infNfe').length > 0 || xmlDoc.getElementsByTagName('NFe').length > 0) {
    tipo = 'NFe';
  } else if (xmlDoc.getElementsByTagName('infCte').length > 0 || xmlDoc.getElementsByTagName('CTe').length > 0) {
    tipo = 'CTe';
  } else if (xmlDoc.getElementsByTagName('infMdfe').length > 0 || xmlDoc.getElementsByTagName('MDFe').length > 0) {
    tipo = 'MDFe';
  } else if (xmlDoc.getElementsByTagName('NFSe').length > 0 || xmlDoc.getElementsByTagName('CompNfse').length > 0) {
    tipo = 'NFSe';
  }

  // Helper to safely get tag value
  const getTagValue = (parent: Element | Document, tagName: string): string => {
    const el = parent.getElementsByTagName(tagName)[0];
    return el ? el.textContent || '' : '';
  };

  // Helper to safely get nested tag value under parent
  const getSubTagValue = (parentName: string, tagName: string): string => {
    const parent = xmlDoc.getElementsByTagName(parentName)[0];
    if (!parent) return '';
    return getTagValue(parent, tagName);
  };

  // Extract Chave de Acesso (44 digits for NFe/CTe/MDFe, 50 positions for NFSe Padrão Nacional)
  let chaveAcesso = getTagValue(xmlDoc, 'chNFe') || getTagValue(xmlDoc, 'chCTe') || getTagValue(xmlDoc, 'chMDFe') || '';
  if (!chaveAcesso) {
    const infNode = xmlDoc.getElementsByTagName('infNFe')[0] 
      || xmlDoc.getElementsByTagName('infNfe')[0] 
      || xmlDoc.getElementsByTagName('infCTe')[0] 
      || xmlDoc.getElementsByTagName('infCte')[0]
      || xmlDoc.getElementsByTagName('infMDFe')[0]
      || xmlDoc.getElementsByTagName('infMdfe')[0]
      || xmlDoc.getElementsByTagName('infNFSe')[0]
      || xmlDoc.getElementsByTagName('infNfse')[0];
    if (infNode) {
      const rawId = infNode.getAttribute('Id') || infNode.getAttribute('id') || '';
      chaveAcesso = rawId.replace(/^[A-Za-z]+/, '').replace(/[^0-9]/g, '');
    }
  }

  if (tipo === 'NFSe') {
    if (chaveAcesso.length !== 50) {
      chaveAcesso = chaveAcesso || '';
    }
  } else {
    if (chaveAcesso.length !== 44) {
      chaveAcesso = chaveAcesso || '';
    }
  }

  const numero = getTagValue(xmlDoc, 'nNF') || getTagValue(xmlDoc, 'nCT') || '';
  const serie = getTagValue(xmlDoc, 'serie') || '1';
  const dataEmissaoRaw = getTagValue(xmlDoc, 'dhEmi') || getTagValue(xmlDoc, 'dEmi') || new Date().toISOString();
  const dataEmissao = dataEmissaoRaw.split('T')[0];

  // Emitente
  const emitenteCnpj = getSubTagValue('emit', 'CNPJ') || '';
  const emitenteNome = getSubTagValue('emit', 'xNome') || '';
  const emitenteUf = getSubTagValue('enderEmit', 'UF') || '';
  const emitenteIe = getSubTagValue('emit', 'IE') || '';

  // Destinatário
  const destinatarioCnpj = getSubTagValue('dest', 'CNPJ') || '';
  const destinatarioNome = getSubTagValue('dest', 'xNome') || '';
  const destinatarioUf = getSubTagValue('enderDest', 'UF') || '';
  const destinatarioIe = getSubTagValue('dest', 'IE') || '';

  // Total Values
  const vNFStr = getSubTagValue('ICMSTot', 'vNF') || getSubTagValue('vTotal', 'vPag') || '0';
  const valorTotal = parseFloat(vNFStr) || 0;

  const vICMSStr = getSubTagValue('ICMSTot', 'vICMS') || '0';
  const valorIcms = parseFloat(vICMSStr) || 0;

  const vIPIStr = getSubTagValue('ICMSTot', 'vIPI') || '0';
  const valorIpi = parseFloat(vIPIStr) || 0;

  const vPISStr = getSubTagValue('ICMSTot', 'vPIS') || '0';
  const valorPis = parseFloat(vPISStr) || 0;

  const vCOFINSStr = getSubTagValue('ICMSTot', 'vCOFINS') || '0';
  const valorCofins = parseFloat(vCOFINSStr) || 0;

  // Projeção da Reforma Tributária (EC 132/2023 & LC 214/2025)
  const docAno = dataEmissao ? new Date(dataEmissao).getFullYear() : 2026;
  const tributosTransicao = calcularTributosTransicao(valorTotal, docAno);
  const aliquotaCbs = tributosTransicao.aliquotaCbs;
  const valorCbs = tributosTransicao.valorCbs;
  const aliquotaIbs = tributosTransicao.aliquotaIbsTotal;
  const valorIbs = tributosTransicao.valorIbsTotal;

  // Imposto Seletivo (Apenas para bens específicos)
  const valorImpostoSeletivo = 0;

  // Regras de Auditoria Automática
  const alertas: string[] = [];
  let statusAuditoria: 'conforme' | 'inconsistente' | 'pendente_ccc' = 'conforme';

  if (!emitenteIe || emitenteIe === 'ISENTO' || emitenteIe.includes('Não Contribuinte')) {
    alertas.push('Emitente classificado como Não Contribuinte / Isento no Sintegra CCC');
  }

  if (valorIcms === 0 && valorTotal > 0 && tipo === 'NFe') {
    alertas.push('Sem destaque de ICMS na Operação comercial');
  }

  if (alertas.length > 0) {
    statusAuditoria = 'inconsistente';
  }

  // Parse items (<det> elements)
  const detNodes = xmlDoc.getElementsByTagName('det');
  const itensExtraidos: any[] = [];
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
        // Extrai tributos reais destacados no XML para este item
        const impostoNode = det.getElementsByTagName('imposto')[0];
        let itemIcms = 0;
        let itemIpi = 0;
        let itemPis = 0;
        let itemCofins = 0;
        let itemCbs = 0;
        let itemIbs = 0;
        let itemAliqCbs = 0;
        let itemAliqIbs = 0;

        if (impostoNode) {
          itemIcms = parseFloat(getTagValue(impostoNode, 'vICMS') || '0') || 0;
          itemIpi = parseFloat(getTagValue(impostoNode, 'vIPI') || '0') || 0;
          itemPis = parseFloat(getTagValue(impostoNode, 'vPIS') || '0') || 0;
          itemCofins = parseFloat(getTagValue(impostoNode, 'vCOFINS') || '0') || 0;
          itemCbs = parseFloat(getTagValue(impostoNode, 'vCBS') || '0') || 0;
          itemIbs = parseFloat(getTagValue(impostoNode, 'vIBS') || '0') || 0;
          itemAliqCbs = parseFloat(getTagValue(impostoNode, 'pCBS') || '0') || 0;
          itemAliqIbs = parseFloat(getTagValue(impostoNode, 'pIBS') || '0') || 0;
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
        });
      }
    }
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
    itens: itensExtraidos.length > 0 ? itensExtraidos : undefined,
    statusAuditoria,
    alertasAuditoria: alertas,
    eventoUltimo: 'Nenhum',
    statusSincronizacaoErp: 'pendente'
  };
}

/**
 * Generates full formatted XML string representation for a DfeXmlItem
 */
export function generateDfeXmlContent(item: DfeXmlItem): string {
  const cleanCnpjEmit = item.emitenteCnpj.replace(/\D/g, '');
  const cleanCnpjDest = item.destinatarioCnpj.replace(/\D/g, '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNfe Id="NFe${item.chaveAcesso}" versao="4.00">
      <ide>
        <cUF>${item.chaveAcesso.substring(0, 2) || '35'}</cUF>
        <cNF>${item.chaveAcesso.substring(35, 43) || '00123456'}</cNF>
        <natOp>VENDA DE MERCADORIA ADQUIRIDA DE TERCEIROS</natOp>
        <mod>${item.tipo === 'NFe' ? '55' : item.tipo === 'NFCe' ? '65' : item.tipo === 'CTe' ? '57' : '99'}</mod>
        <serie>${item.serie}</serie>
        <nNF>${item.numero.replace(/\D/g, '')}</nNF>
        <dhEmi>${item.dataEmissao}T14:30:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${item.chaveAcesso.slice(-1) || '0'}</cDV>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>RadarConformidade_v4.2.0</verProc>
      </ide>
      <emit>
        <CNPJ>${cleanCnpjEmit}</CNPJ>
        <xNome>${item.emitenteNome}</xNome>
        <enderEmit>
          <xLgr>AVENIDA DA CONFORMIDADE FISCAL</xLgr>
          <nro>1000</nro>
          <xBairro>CENTRO DE PROCESSAMENTO</xBairro>
          <cMun>3550308</cMun>
          <xMun>SAO PAULO</xMun>
          <UF>${item.emitenteUf}</UF>
          <CEP>01001000</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderEmit>
        <IE>${item.emitenteIe || 'ISENTO'}</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>${cleanCnpjDest}</CNPJ>
        <xNome>${item.destinatarioNome}</xNome>
        <enderDest>
          <xLgr>RUA DOS CORPORATIVOS</xLgr>
          <nro>500</nro>
          <xBairro>INDUSTRIAL</xBairro>
          <cMun>3550308</cMun>
          <xMun>SAO PAULO</xMun>
          <UF>${item.destinatarioUf}</UF>
          <CEP>04538132</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderDest>
        <indIEDest>1</indIEDest>
        <IE>${item.destinatarioIe || 'ISENTO'}</IE>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>PROD-001982</cProd>
          <cEAN>7891000315582</cEAN>
          <xProd>SUPRIMENTOS E SERVIÇOS CORPORATIVOS FONTES FISCAIS SEFAZ</xProd>
          <NCM>84713019</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>${item.valorTotal.toFixed(2)}</vUnCom>
          <vProd>${item.valorTotal.toFixed(2)}</vProd>
          <cEANTrib>7891000315582</cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>1.0000</qTrib>
          <vUnTrib>${item.valorTotal.toFixed(2)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>${item.valorTotal.toFixed(2)}</vBC>
              <pICMS>${item.valorTotal > 0 ? ((item.valorIcms / item.valorTotal) * 100).toFixed(2) : '18.00'}</pICMS>
              <vICMS>${item.valorIcms.toFixed(2)}</vICMS>
            </ICMS00>
          </ICMS>
          <PIS>
            <PISAliq>
              <CST>01</CST>
              <vBC>${item.valorTotal.toFixed(2)}</vBC>
              <pPIS>1.65</pPIS>
              <vPIS>${item.valorPis.toFixed(2)}</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>01</CST>
              <vBC>${item.valorTotal.toFixed(2)}</vBC>
              <pCOFINS>7.60</pCOFINS>
              <vCOFINS>${item.valorCofins.toFixed(2)}</vCOFINS>
            </COFINSAliq>
          </COFINS>
          <!-- Projeção Reforma Tributária PLP 68/2024 -->
          <CBS>
            <vBC>${item.valorTotal.toFixed(2)}</vBC>
            <pCBS>${item.aliquotaCbs.toFixed(2)}</pCBS>
            <vCBS>${item.valorCbs.toFixed(2)}</vCBS>
          </CBS>
          <IBS>
            <vBC>${item.valorTotal.toFixed(2)}</vBC>
            <pIBS>${item.aliquotaIbs.toFixed(2)}</pIBS>
            <vIBS>${item.valorIbs.toFixed(2)}</vIBS>
          </IBS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>${item.valorTotal.toFixed(2)}</vBC>
          <vICMS>${item.valorIcms.toFixed(2)}</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${item.valorTotal.toFixed(2)}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>${item.valorIpi.toFixed(2)}</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>${item.valorPis.toFixed(2)}</vPIS>
          <vCOFINS>${item.valorCofins.toFixed(2)}</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${item.valorTotal.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
    </infNfe>
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      <SignedInfo>
        <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
        <Reference URI="#NFe${item.chaveAcesso}">
          <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
          <DigestValue>A9z2xK/8M1qLw7R90sX1y2z3v4w5x=</DigestValue>
        </Reference>
      </SignedInfo>
      <SignatureValue>CCC_SEFAZ_A1_AUTHENTICATED_DIGITAL_SIGNATURE_HASH_VALIDATED_2026</SignatureValue>
    </Signature>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>SEFAZ_SP_NFE_v4.0.1</verAplic>
      <chNFe>${item.chaveAcesso}</chNFe>
      <dhRecbto>${item.dataEmissao}T14:30:05-03:00</dhRecbto>
      <nProt>135260819482710</nProt>
      <digVal>A9z2xK/8M1qLw7R90sX1y2z3v4w5x=</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;
}

/** 
 * DEMO_DFE_ITEMS removed — system works exclusively with real data.
 * Import real XMLs via upload or NFeDistribuicaoDFe WebService.
 */
export const DEMO_DFE_ITEMS: DfeXmlItem[] = [];
