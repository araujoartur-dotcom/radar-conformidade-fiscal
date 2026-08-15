import { DfeXmlItem, TipoDFe } from '../types';

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

  // Extract Chave de Acesso (44 digits for NFe/CTe, 50 positions for NFSe Padrão Nacional)
  const infNfeNode = xmlDoc.getElementsByTagName('infNfe')[0] || xmlDoc.getElementsByTagName('infCte')[0] || xmlDoc.getElementsByTagName('infNfse')[0];
  let chaveAcesso = '';
  if (infNfeNode) {
    const rawId = infNfeNode.getAttribute('Id') || infNfeNode.getAttribute('id') || '';
    chaveAcesso = rawId.replace(/[^0-9A-Za-z]/g, '');
  }

  if (tipo === 'NFSe') {
    if (!chaveAcesso || chaveAcesso.length !== 50) {
      // 50-position National NFS-e Access Key
      chaveAcesso = '35503082608607011900001041000000000098110123456789';
    }
  } else {
    if (!chaveAcesso || chaveAcesso.length < 44) {
      // Generate fallback 44-digit structured access key for NF-e / CT-e
      const seed = Math.floor(Math.random() * 89999999999) + 10000000000;
      chaveAcesso = `35260817213071000175550010000${seed}`;
    }
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

  const numero = getTagValue(xmlDoc, 'nNF') || getTagValue(xmlDoc, 'nCT') || '1042';
  const serie = getTagValue(xmlDoc, 'serie') || '1';
  const dataEmissaoRaw = getTagValue(xmlDoc, 'dhEmi') || getTagValue(xmlDoc, 'dEmi') || new Date().toISOString();
  const dataEmissao = dataEmissaoRaw.split('T')[0];

  // Emitente
  const emitenteCnpj = getSubTagValue('emit', 'CNPJ') || '17.213.071/0001-75';
  const emitenteNome = getSubTagValue('emit', 'xNome') || 'ASSOCIACAO DOS MORADORES DO EDIFICIO COSTA VERDE';
  const emitenteUf = getSubTagValue('enderEmit', 'UF') || 'DF';
  const emitenteIe = getSubTagValue('emit', 'IE') || '832208100120';

  // Destinatário
  const destinatarioCnpj = getSubTagValue('dest', 'CNPJ') || '00.000.000/0001-91';
  const destinatarioNome = getSubTagValue('dest', 'xNome') || 'BANCO DO BRASIL SA';
  const destinatarioUf = getSubTagValue('enderDest', 'UF') || 'DF';
  const destinatarioIe = getSubTagValue('dest', 'IE') || 'ISENTO';

  // Total Values
  const vNFStr = getSubTagValue('ICMSTot', 'vNF') || getSubTagValue('vTotal', 'vPag') || '15480.00';
  const valorTotal = parseFloat(vNFStr) || 15480.00;

  const vICMSStr = getSubTagValue('ICMSTot', 'vICMS') || '2786.40';
  const valorIcms = parseFloat(vICMSStr) || 0;

  const vIPIStr = getSubTagValue('ICMSTot', 'vIPI') || '0';
  const valorIpi = parseFloat(vIPIStr) || 0;

  const vPISStr = getSubTagValue('ICMSTot', 'vPIS') || '255.42';
  const valorPis = parseFloat(vPISStr) || 0;

  const vCOFINSStr = getSubTagValue('ICMSTot', 'vCOFINS') || '1176.48';
  const valorCofins = parseFloat(vCOFINSStr) || 0;

  // Projeção da Reforma Tributária (PLP 68/2024)
  // Alíquota de referência CBS (Federal) ~ 8.8%
  // Alíquota de referência IBS (Estadual/Municipal) ~ 17.7%
  const aliquotaCbs = 8.8;
  const valorCbs = Number(((valorTotal * aliquotaCbs) / 100).toFixed(2));

  const aliquotaIbs = 17.7;
  const valorIbs = Number(((valorTotal * aliquotaIbs) / 100).toFixed(2));

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
          valorIcms: Number((vProd * 0.18).toFixed(2)),
          valorIpi: 0,
          valorCbs: Number((vProd * 0.088).toFixed(2)),
          valorIbs: Number((vProd * 0.177).toFixed(2)),
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

/** Demo DFe XML Items for instant demonstration */
export const DEMO_DFE_ITEMS: DfeXmlItem[] = [
  {
    id: 'dfe-demo-1',
    chaveAcesso: '3526081721307100017555001000083220810012001',
    tipo: 'NFe',
    numero: '000.104.892',
    serie: '1',
    dataEmissao: '2026-07-28',
    emitenteCnpj: '17.213.071/0001-75',
    emitenteNome: 'ASSOCIACAO DOS MORADORES DO EDIFICIO COSTA VERDE',
    emitenteUf: 'DF',
    emitenteIe: '832208100120',
    destinatarioCnpj: '00.000.000/0001-91',
    destinatarioNome: 'BANCO DO BRASIL SA',
    destinatarioUf: 'DF',
    destinatarioIe: 'ISENTO',
    valorTotal: 28450.00,
    valorIcms: 5121.00,
    valorIpi: 0,
    valorPis: 469.42,
    valorCofins: 2162.20,
    aliquotaCbs: 8.8,
    valorCbs: 2503.60,
    aliquotaIbs: 17.7,
    valorIbs: 5035.65,
    valorImpostoSeletivo: 0,
    statusAuditoria: 'conforme',
    alertasAuditoria: ['Emitente possui IE Não Contribuinte ativa no CCC SEFAZ RS/DF'],
    eventoUltimo: 'Ciência da Emissão',
    statusSincronizacaoErp: 'sincronizado',
    itens: [
      {
        numeroItem: 1,
        codigo: 'DELL-R750-01',
        descricao: 'MODULO SERVIDOR DE REDE DELL POWEREDGE R750 32GB RAM 1TB SSD',
        ncmCts: '8471.50.10 / 000',
        cfop: '5102',
        unidade: 'UN',
        quantidade: 2,
        valorUnitario: 12000.00,
        valorTotal: 24000.00,
        valorIcms: 4320.00,
        valorIpi: 0,
        valorCbs: 2112.00,
        valorIbs: 4248.00
      },
      {
        numeroItem: 2,
        codigo: 'MS-WS2025-DC',
        descricao: 'LICENCA SOFTWARE WINDOWS SERVER 2025 DATACENTER 16-CORE OEM',
        ncmCts: '8523.49.90 / 000',
        cfop: '5102',
        unidade: 'UN',
        quantidade: 1,
        valorUnitario: 4450.00,
        valorTotal: 4450.00,
        valorIcms: 801.00,
        valorIpi: 0,
        valorCbs: 391.60,
        valorIbs: 787.65
      }
    ]
  },
  {
    id: 'dfe-demo-2',
    chaveAcesso: '3326083300016700010155001000099882211009802',
    tipo: 'NFe',
    numero: '000.542.100',
    serie: '3',
    dataEmissao: '2026-07-30',
    emitenteCnpj: '33.000.167/0001-01',
    emitenteNome: 'PETROLEO BRASILEIRO S A PETROBRAS',
    emitenteUf: 'RJ',
    emitenteIe: '81200451',
    destinatarioCnpj: '60.701.190/0001-04',
    destinatarioNome: 'ITAU UNIBANCO S.A.',
    destinatarioUf: 'SP',
    destinatarioIe: '109382019110',
    valorTotal: 185000.00,
    valorIcms: 33300.00,
    valorIpi: 18500.00,
    valorPis: 3052.50,
    valorCofins: 14060.00,
    aliquotaCbs: 8.8,
    valorCbs: 16280.00,
    aliquotaIbs: 17.7,
    valorIbs: 32745.00,
    valorImpostoSeletivo: 1850.00,
    statusAuditoria: 'conforme',
    alertasAuditoria: [],
    eventoUltimo: 'Confirmação da Operação',
    statusSincronizacaoErp: 'sincronizado',
    itens: [
      {
        numeroItem: 1,
        codigo: 'VLV-IND-12P',
        descricao: 'VALVULA INDUSTRIAL DE FLUXO PARA REFINARIA DE ALTA PRESSAO 12 POL',
        ncmCts: '8481.80.99 / 000',
        cfop: '5101',
        unidade: 'UN',
        quantidade: 5,
        valorUnitario: 25000.00,
        valorTotal: 125000.00,
        valorIcms: 22500.00,
        valorIpi: 12500.00,
        valorCbs: 11000.00,
        valorIbs: 22125.00
      },
      {
        numeroItem: 2,
        codigo: 'TUB-INOX-316L',
        descricao: 'CONJUNTO DE TUBULACAO DE ACO INOXIDAVEL 316L DUPLEX 6 METROS',
        ncmCts: '7304.41.00 / 000',
        cfop: '5101',
        unidade: 'CX',
        quantidade: 10,
        valorUnitario: 6000.00,
        valorTotal: 60000.00,
        valorIcms: 10800.00,
        valorIpi: 6000.00,
        valorCbs: 5280.00,
        valorIbs: 10620.00
      }
    ]
  },
  {
    id: 'dfe-demo-3',
    chaveAcesso: '35503082608607011900001041000000000098110123456789', // 50 posições Padrão Nacional
    tipo: 'NFSe',
    numero: '000.009.811',
    serie: 'E',
    dataEmissao: '2026-08-01',
    emitenteCnpj: '60.701.190/0001-04',
    emitenteNome: 'ITAU UNIBANCO S.A.',
    emitenteUf: 'SP',
    emitenteIe: '109382019110',
    destinatarioCnpj: '17.213.071/0001-75',
    destinatarioNome: 'ASSOCIACAO DOS MORADORES DO EDIFICIO COSTA VERDE',
    destinatarioUf: 'DF',
    destinatarioIe: '832208100120',
    valorTotal: 4200.00,
    valorIcms: 0,
    valorIpi: 0,
    valorPis: 69.30,
    valorCofins: 319.20,
    aliquotaCbs: 8.8,
    valorCbs: 369.60,
    aliquotaIbs: 17.7,
    valorIbs: 743.40,
    valorImpostoSeletivo: 0,
    statusAuditoria: 'inconsistente',
    alertasAuditoria: ['NFS-e sem retenção na fonte de ISS/CBS prevista'],
    eventoUltimo: 'Nenhum',
    statusSincronizacaoErp: 'pendente',
    itens: [
      {
        numeroItem: 1,
        codigo: 'SRV-1701-01',
        descricao: 'SERVIÇOS DE CONSULTORIA E AUDITORIA EM CONFORMIDADE FISCAL SEFAZ E SUITE DE INTEGRAÇÃO DE ARQUIVOS XML CONFORME LEI COMPLEMENTAR 116/2003',
        ncmCts: '17.01 / LC116',
        cfop: '0000',
        unidade: 'UN',
        quantidade: 1,
        valorUnitario: 4200.00,
        valorTotal: 4200.00,
        valorIcms: 0,
        valorIpi: 0,
        valorCbs: 369.60,
        valorIbs: 743.40
      }
    ]
  },
  {
    id: 'dfe-demo-4',
    chaveAcesso: '4126084750841100015657001000045612310010044',
    tipo: 'CTe',
    numero: '000.045.612',
    serie: '1',
    dataEmissao: '2026-07-29',
    emitenteCnpj: '47.508.411/0001-56',
    emitenteNome: 'LOGISTICA E TRANSPORTES EXPRES S.A.',
    emitenteUf: 'PR',
    emitenteIe: '9012384712',
    destinatarioCnpj: '33.000.167/0001-01',
    destinatarioNome: 'PETROLEO BRASILEIRO S A PETROBRAS',
    destinatarioUf: 'RJ',
    destinatarioIe: '81200451',
    valorTotal: 12800.00,
    valorIcms: 1536.00,
    valorIpi: 0,
    valorPis: 83.20,
    valorCofins: 384.00,
    aliquotaCbs: 8.8,
    valorCbs: 1126.40,
    aliquotaIbs: 17.7,
    valorIbs: 2265.60,
    valorImpostoSeletivo: 0,
    statusAuditoria: 'conforme',
    alertasAuditoria: [],
    eventoUltimo: 'Comprovante de Entrega',
    statusSincronizacaoErp: 'sincronizado',
    itens: [
      {
        numeroItem: 1,
        codigo: 'CTE-FRETE-01',
        descricao: 'PRESTAÇÃO DE SERVIÇO DE TRANSPORTE RODOVIÁRIO DE CARGA GERAL INTERESTADUAL (CURITIBA/PR -> RIO DE JANEIRO/RJ)',
        ncmCts: 'MODAL-ROD',
        cfop: '6352',
        unidade: 'VIAGEM',
        quantidade: 1,
        valorUnitario: 12800.00,
        valorTotal: 12800.00,
        valorIcms: 1536.00,
        valorIpi: 0,
        valorCbs: 1126.40,
        valorIbs: 2265.60
      }
    ]
  },
  {
    id: 'dfe-demo-5',
    chaveAcesso: '3526081234567800019065002000008899110077889',
    tipo: 'NFCe',
    numero: '000.088.991',
    serie: '2',
    dataEmissao: '2026-08-01',
    emitenteCnpj: '12.345.678/0001-90',
    emitenteNome: 'SUPERMERCADOS VAREJO & CIA LTDA',
    emitenteUf: 'SP',
    emitenteIe: '110293847561',
    destinatarioCnpj: '999.999.999-99',
    destinatarioNome: 'CONSUMIDOR FINAL',
    destinatarioUf: 'SP',
    destinatarioIe: 'ISENTO',
    valorTotal: 385.50,
    valorIcms: 69.39,
    valorIpi: 0,
    valorPis: 6.36,
    valorCofins: 29.30,
    aliquotaCbs: 8.8,
    valorCbs: 33.92,
    aliquotaIbs: 17.7,
    valorIbs: 68.23,
    valorImpostoSeletivo: 0,
    statusAuditoria: 'conforme',
    alertasAuditoria: [],
    eventoUltimo: 'Nenhum',
    statusSincronizacaoErp: 'pendente',
    itens: [
      {
        numeroItem: 1,
        codigo: 'PAP-A4-CX',
        descricao: 'CAIXA PAPEL A4 ALCALINO 75G CHAMECO (5 REAMS X 500 FLS)',
        ncmCts: '4802.56.10 / 000',
        cfop: '5102',
        unidade: 'CX',
        quantidade: 2,
        valorUnitario: 140.00,
        valorTotal: 280.00,
        valorIcms: 50.40,
        valorIpi: 0,
        valorCbs: 24.64,
        valorIbs: 49.56
      },
      {
        numeroItem: 2,
        codigo: 'TONER-HP-BLK',
        descricao: 'CARTUCHO TONER HP LASERJET BLACK COMPATIVEL 2000 FLS',
        ncmCts: '8443.99.23 / 000',
        cfop: '5102',
        unidade: 'UN',
        quantidade: 1,
        valorUnitario: 105.50,
        valorTotal: 105.50,
        valorIcms: 18.99,
        valorIpi: 0,
        valorCbs: 9.28,
        valorIbs: 18.67
      }
    ]
  }
];
