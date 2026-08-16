/**
 * ============================================================
 * MOTOR DE CRUZAMENTO AUTOMATIZADO SPED FISCAL (EFD) x SEFAZ
 * ============================================================
 * Auditoria de Omissão de Entradas (Registro C100), Divergências
 * de Valores e Validação de Participantes (Registro 0150).
 * ============================================================
 */

import { DfeXmlItem } from '../types';

export interface SpedRegistro0000 {
  cnpj: string;
  razaoSocial: string;
  uf: string;
  ie: string;
  dataInicio: string;
  dataFim: string;
}

export interface SpedRegistro0150 {
  codPart: string;
  nome: string;
  cnpjCpf: string;
  ie: string;
  codMun: string;
}

export interface SpedRegistroC100 {
  indOper: '0' | '1'; // 0 = Entrada, 1 = Saída
  indEmit: '0' | '1'; // 0 = Emissão Própria, 1 = Terceiros
  codPart: string;
  codMod: string; // 55 = NF-e
  numDoc: string;
  chaveNfe: string;
  dtDoc: string;
  dtES: string;
  vlDoc: number;
  vlIcms: number;
  vlPis: number;
  vlCofins: number;
}

export interface SpedArquivoParseado {
  header: SpedRegistro0000;
  participantes: SpedRegistro0150[];
  documentosC100: SpedRegistroC100[];
  totalLinhas: number;
}

export interface DivergenciaSpedItem {
  id: string;
  tipoDivergencia: 'OMISSAO_SEFAZ_NAO_NO_SPED' | 'DIVERGENCIA_VALOR' | 'PARTICIPANTE_NAO_CADASTRADO' | 'SPED_SEM_SEFAZ';
  gravidade: 'CRITICO' | 'ALERTA' | 'INFO';
  chaveAcesso: string;
  numero: string;
  dataEmissao: string;
  fornecedorCnpj: string;
  fornecedorNome: string;
  valorSefaz: number;
  valorSped: number;
  diferenca: number;
  descricao: string;
  recomendacao: string;
}

export interface RelatorioCruzamentoSped {
  periodoSped: string;
  cnpjEmpresa: string;
  razaoSocial: string;
  totalNotasSefaz: number;
  totalNotasSped: number;
  totalNotasConciliadas: number;
  totalOmissoesEntrada: number;
  totalDivergenciasValor: number;
  totalParticipantesFaltantes: number;
  valorTotalOmitido: number;
  riscoFiscalGeral: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  divergencias: DivergenciaSpedItem[];
}

/**
 * Faz o parse do arquivo TXT do SPED Fiscal (EFD ICMS/IPI)
 */
export function parseSpedFiscalTxt(txtContent: string): SpedArquivoParseado {
  const lines = txtContent.split(/\r?\n/);
  
  let header: SpedRegistro0000 = {
    cnpj: '',
    razaoSocial: 'EMPRESA NÃO IDENTIFICADA',
    uf: 'SP',
    ie: '',
    dataInicio: '',
    dataFim: '',
  };

  const participantes: SpedRegistro0150[] = [];
  const documentosC100: SpedRegistroC100[] = [];

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const fields = line.split('|');
    const reg = fields[1];

    if (reg === '0000') {
      header = {
        cnpj: fields[7] || '',
        razaoSocial: fields[6] || '',
        uf: fields[9] || '',
        ie: fields[10] || '',
        dataInicio: fields[4] || '',
        dataFim: fields[5] || '',
      };
    } else if (reg === '0150') {
      participantes.push({
        codPart: fields[2] || '',
        nome: fields[3] || '',
        cnpjCpf: fields[5] || fields[6] || '',
        ie: fields[7] || '',
        codMun: fields[8] || '',
      });
    } else if (reg === 'C100') {
      documentosC100.push({
        indOper: (fields[2] as any) || '0',
        indEmit: (fields[3] as any) || '1',
        codPart: fields[4] || '',
        codMod: fields[5] || '55',
        numDoc: fields[8] || '',
        chaveNfe: (fields[9] || '').replace(/\D/g, ''),
        dtDoc: fields[10] || '',
        dtES: fields[11] || '',
        vlDoc: parseFloat((fields[12] || '0').replace(',', '.')) || 0,
        vlIcms: parseFloat((fields[22] || '0').replace(',', '.')) || 0,
        vlPis: parseFloat((fields[26] || '0').replace(',', '.')) || 0,
        vlCofins: parseFloat((fields[27] || '0').replace(',', '.')) || 0,
      });
    }
  }

  return {
    header,
    participantes,
    documentosC100,
    totalLinhas: lines.length,
  };
}

/**
 * Executa o cruzamento inteligente entre a base da SEFAZ e o arquivo SPED
 */
export function cruzarSefazComSped(
  dfeListSefaz: DfeXmlItem[],
  spedData: SpedArquivoParseado
): RelatorioCruzamentoSped {
  const divergencias: DivergenciaSpedItem[] = [];

  const spedChavesMap = new Map<string, SpedRegistroC100>();
  spedData.documentosC100.forEach(doc => {
    if (doc.chaveNfe && doc.chaveNfe.length === 44) {
      spedChavesMap.set(doc.chaveNfe, doc);
    }
  });

  const participantesCnpjs = new Set<string>(
    spedData.participantes.map(p => p.cnpjCpf.replace(/\D/g, ''))
  );

  let conciliadas = 0;
  let valorOmitido = 0;

  // 1. Verificar cada nota fiscal capturada na SEFAZ contra o SPED
  for (const sefazDoc of dfeListSefaz) {
    const cleanChave = (sefazDoc.chaveAcesso || '').replace(/\D/g, '');
    if (!cleanChave || cleanChave.length !== 44) continue;

    const spedDoc = spedChavesMap.get(cleanChave);

    if (!spedDoc) {
      // OMISSÃO DE ENTRADA: Nota autorizada na SEFAZ que NÃO está no SPED C100
      valorOmitido += sefazDoc.valorTotal;
      divergencias.push({
        id: `div-omissao-${cleanChave}`,
        tipoDivergencia: 'OMISSAO_SEFAZ_NAO_NO_SPED',
        gravidade: 'CRITICO',
        chaveAcesso: cleanChave,
        numero: sefazDoc.numero,
        dataEmissao: sefazDoc.dataEmissao,
        fornecedorCnpj: sefazDoc.emitenteCnpj,
        fornecedorNome: sefazDoc.emitenteNome,
        valorSefaz: sefazDoc.valorTotal,
        valorSped: 0,
        diferenca: sefazDoc.valorTotal,
        descricao: `NF-e ${sefazDoc.numero} emitida na SEFAZ mas ausente no Registro C100 do SPED Fiscal.`,
        recomendacao: 'Escriturar o documento fiscal no ERP ou retificar a EFD para evitar autuação por omissão de entrada.',
      });
    } else {
      conciliadas++;

      // DIVERGÊNCIA DE VALORES
      const dif = Math.abs(sefazDoc.valorTotal - spedDoc.vlDoc);
      if (dif > 0.05) {
        divergencias.push({
          id: `div-val-${cleanChave}`,
          tipoDivergencia: 'DIVERGENCIA_VALOR',
          gravidade: 'ALERTA',
          chaveAcesso: cleanChave,
          numero: sefazDoc.numero,
          dataEmissao: sefazDoc.dataEmissao,
          fornecedorCnpj: sefazDoc.emitenteCnpj,
          fornecedorNome: sefazDoc.emitenteNome,
          valorSefaz: sefazDoc.valorTotal,
          valorSped: spedDoc.vlDoc,
          diferenca: Number((sefazDoc.valorTotal - spedDoc.vlDoc).toFixed(2)),
          descricao: `Divergência de valor: SEFAZ R$ ${sefazDoc.valorTotal.toFixed(2)} vs. SPED R$ ${spedDoc.vlDoc.toFixed(2)}.`,
          recomendacao: 'Conferir se houve rateio de frete, desconto incondicional ou erro de digitação no ERP.',
        });
      }
    }

    // Verificar se o participante existe no Registro 0150
    const cleanEmitCnpj = sefazDoc.emitenteCnpj.replace(/\D/g, '');
    if (cleanEmitCnpj && !participantesCnpjs.has(cleanEmitCnpj)) {
      divergencias.push({
        id: `div-part-${cleanChave}`,
        tipoDivergencia: 'PARTICIPANTE_NAO_CADASTRADO',
        gravidade: 'ALERTA',
        chaveAcesso: cleanChave,
        numero: sefazDoc.numero,
        dataEmissao: sefazDoc.dataEmissao,
        fornecedorCnpj: sefazDoc.emitenteCnpj,
        fornecedorNome: sefazDoc.emitenteNome,
        valorSefaz: sefazDoc.valorTotal,
        valorSped: 0,
        diferenca: 0,
        descricao: `Fornecedor ${sefazDoc.emitenteNome} (${sefazDoc.emitenteCnpj}) não cadastrado no Registro |0150| do SPED.`,
        recomendacao: 'Cadastrar o participante na tabela 0150 da EFD para evitar erro no validador PVA do SPED.',
      });
    }
  }

  const omissoesCount = divergencias.filter(d => d.tipoDivergencia === 'OMISSAO_SEFAZ_NAO_NO_SPED').length;
  const difValoresCount = divergencias.filter(d => d.tipoDivergencia === 'DIVERGENCIA_VALOR').length;
  const partFaltantesCount = divergencias.filter(d => d.tipoDivergencia === 'PARTICIPANTE_NAO_CADASTRADO').length;

  let riscoGeral: RelatorioCruzamentoSped['riscoFiscalGeral'] = 'BAIXO';
  if (omissoesCount > 5 || valorOmitido > 50000) riscoGeral = 'CRITICO';
  else if (omissoesCount > 0 || difValoresCount > 3) riscoGeral = 'ALTO';
  else if (difValoresCount > 0 || partFaltantesCount > 0) riscoGeral = 'MEDIO';

  return {
    periodoSped: `${spedData.header.dataInicio || '01082026'} a ${spedData.header.dataFim || '31082026'}`,
    cnpjEmpresa: spedData.header.cnpj,
    razaoSocial: spedData.header.razaoSocial,
    totalNotasSefaz: dfeListSefaz.length,
    totalNotasSped: spedData.documentosC100.length,
    totalNotasConciliadas: conciliadas,
    totalOmissoesEntrada: omissoesCount,
    totalDivergenciasValor: difValoresCount,
    totalParticipantesFaltantes: partFaltantesCount,
    valorTotalOmitido: Number(valorOmitido.toFixed(2)),
    riscoFiscalGeral: riscoGeral,
    divergencias,
  };
}
