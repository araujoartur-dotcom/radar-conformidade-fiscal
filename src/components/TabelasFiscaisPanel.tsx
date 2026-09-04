import React, { useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontal, Table, Plus, Edit3, Trash2, CheckCircle2,
  AlertTriangle, FileText, Scale, Save, Percent, ShieldCheck, Search, Filter, X,
  Check, FileCheck, Layers, Upload, Download, FileSpreadsheet, Sparkles, Receipt
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApi } from '../hooks/useApi';
import { AliquotaTabelaItem, NcmRegraAnexoItem } from '../types';

interface CClassRule {
  id: string;
  cclasstrib: string;
  descricao_interna: string;
  tratamento_esperado: 'tributado' | 'aliquota_reduzida' | 'isento' | 'nao_incidencia' | 'monofasico';
  permite_credito: 'Sim' | 'Não' | 'Parcial' | 'Depende';
  aliquota_esperada: string;
  alertas?: string;
}

interface CfopRule {
  id: string;
  cfop: string;
  descricao: string;
  categoria: 'Compra' | 'Devolução' | 'Transferência' | 'Remessa' | 'Outros';
  tratamento_padrao: 'Elegível' | 'Não elegível' | 'Depende';
  exige_onerosidade: boolean;
  evidencia_minima?: string;
}

interface RegraElegibilidade {
  id: string;
  codigo_regra: string;
  nome: string;
  descricao: string;
  tipo_aquisicao: string;
  cfops_aplicaveis: string;
  resultado_padrao: string;
  evidencia_minima: string;
  base_legal: string;
}

export interface InferenciaParamItem {
  id: string;
  codigo: string;
  descricao: string;
  icms_medio: number;
  pis_medio: number;
  cofins_medio: number;
  ipi_medio: number;
  iss_medio: number;
  aplica_simples_nac: number;
  aplica_cte: number;
  aplica_nfse: number;
  inicio_vigencia: string;
  final_vigencia: string;
  created_at?: string;
  updated_at?: string;
}

export const REGRAS_RETENCAO_SERVICOS = [
  {
    codigo: 'RET-IRRF-01',
    tributo: 'IRRF (Serviços Profissionais)',
    aliquota: '1,50%',
    baseLegal: 'Art. 714 do RIR/2018 (Decreto nº 9.580/2018)',
    hipotese: 'Serviços de assessoria, consultoria, contabilidade, auditoria, advocacia, engenharia, informática e profissões regulamentadas.',
    tipoRetencao: 'Federal (DARF 1708)',
    responsavel: 'Tomador (Pessoa Jurídica)'
  },
  {
    codigo: 'RET-IRRF-02',
    tributo: 'IRRF (Limpeza, Segurança e Mão de Obra)',
    aliquota: '1,00%',
    baseLegal: 'Art. 716 do RIR/2018',
    hipotese: 'Serviços de limpeza, conservação, segurança, vigilância e locação de mão de obra temporária.',
    tipoRetencao: 'Federal (DARF 1708)',
    responsavel: 'Tomador (Pessoa Jurídica)'
  },
  {
    codigo: 'RET-CSLL-01',
    tributo: 'CSLL Retida (Segregada Individual)',
    aliquota: '1,00%',
    baseLegal: 'Art. 30 da Lei nº 10.833/2003 e IN RFB nº 2.145/2023',
    hipotese: 'Serviços profissionais e locação de mão de obra. Segregada individualmente na apuração.',
    tipoRetencao: 'Federal',
    responsavel: 'Tomador (Pessoa Jurídica)'
  },
  {
    codigo: 'RET-PIS-01',
    tributo: 'PIS Retido',
    aliquota: '0,65%',
    baseLegal: 'Art. 30 da Lei nº 10.833/2003 e Lei nº 13.137/2015',
    hipotese: 'Componente da retenção na fonte sobre pagamentos a pessoas jurídicas prestadoras de serviços.',
    tipoRetencao: 'Federal',
    responsavel: 'Tomador (Pessoa Jurídica)'
  },
  {
    codigo: 'RET-COF-01',
    tributo: 'COFINS Retida',
    aliquota: '3,00%',
    baseLegal: 'Art. 30 da Lei nº 10.833/2003 e Lei nº 13.137/2015',
    hipotese: 'Componente da retenção na fonte sobre pagamentos a pessoas jurídicas prestadoras de serviços.',
    tipoRetencao: 'Federal',
    responsavel: 'Tomador (Pessoa Jurídica)'
  },
  {
    codigo: 'RET-CRF-01',
    tributo: 'CRF / PCC Global (PIS + COFINS + CSLL)',
    aliquota: '4,65%',
    baseLegal: 'Art. 30 a 32 da Lei nº 10.833/2003',
    hipotese: 'Retenção conjunta das 3 contribuições sociais federais (DARF 5952). Dispensa se imposto <= R$ 10,00.',
    tipoRetencao: 'Federal (DARF 5952)',
    responsavel: 'Tomador (Pessoa Jurídica)'
  },
  {
    codigo: 'RET-INSS-01',
    tributo: 'INSS Previdenciário (Mão de Obra)',
    aliquota: '11,00% (ou 3,5% CPRB)',
    baseLegal: 'Art. 31 da Lei nº 8.212/1991 e IN RFB nº 2.110/2022',
    hipotese: 'Serviços prestados mediante cessão de mão de obra ou empreitada (limpeza, vigilância, construção civil, temporários).',
    tipoRetencao: 'Previdenciária (DCTFWeb)',
    responsavel: 'Tomador (Pessoa Jurídica)'
  },
  {
    codigo: 'RET-ISS-01',
    tributo: 'ISSQN Retido no Destino',
    aliquota: '2,00% a 5,00%',
    baseLegal: 'Art. 3º e 6º da Lei Complementar nº 116/2003',
    hipotese: 'Serviços com incidência no local da prestação (incisos I a XXV do Art. 3º) ou tomador como substituto tributário municipal.',
    tipoRetencao: 'Municipal (DAM)',
    responsavel: 'Tomador (Substituto Tributário)'
  }
];

export const TabelasFiscaisPanel: React.FC = () => {
  const { get, post, put, del } = useApi();
  const [activeTab, setActiveTab] = useState<'ad_valorem' | 'ad_rem' | 'anexos_ncm' | 'retencoes_servicos' | 'cclasstrib' | 'cfop' | 'regras' | 'inferencia'>('ad_valorem');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // ── TAB 8: ALÍQUOTAS MÉDIAS (INFERÊNCIA SIMULADOR) ─────────
  const [inferenciaList, setInferenciaList] = useState<InferenciaParamItem[]>([]);
  const [showModalInferencia, setShowModalInferencia] = useState(false);
  const [editingInferencia, setEditingInferencia] = useState<InferenciaParamItem | null>(null);
  const [inferenciaForm, setInferenciaForm] = useState({
    codigo: 'INF_001',
    descricao: '',
    icms_medio: 0.0,
    pis_medio: 0.0,
    cofins_medio: 0.0,
    ipi_medio: 0.0,
    iss_medio: 0.0,
    aplica_simples_nac: 1,
    aplica_cte: 0,
    aplica_nfse: 0,
    inicio_vigencia: '2026-01-01',
    final_vigencia: '2099-12-31'
  });

  // ── TAB 1: AD VALOREM STATE ──────────────────────────────
  const [adValoremList, setAdValoremList] = useState<AliquotaTabelaItem[]>([]);
  const [showModalAdValorem, setShowModalAdValorem] = useState(false);
  const [editingAdValorem, setEditingAdValorem] = useState<AliquotaTabelaItem | null>(null);
  const [adValForm, setAdValForm] = useState({
    codigo_cadastro: '00001',
    cbs_federal: 0.9000,
    ibs_estadual: 0.1000,
    ibs_municipal: 0.0000,
    is_federal: 0.0000,
    inicio_vigencia: '2026-01-01',
    final_vigencia: '2026-12-31',
    descricao: ''
  });

  // ── TAB 2: AD REM STATE ──────────────────────────────────
  const [adRemList, setAdRemList] = useState<AliquotaTabelaItem[]>([]);
  const [showModalAdRem, setShowModalAdRem] = useState(false);
  const [editingAdRem, setEditingAdRem] = useState<AliquotaTabelaItem | null>(null);
  const [adRemForm, setAdRemForm] = useState({
    codigo_cadastro: '00001',
    cbs_federal: 0.0000,
    ibs_estadual: 0.0000,
    ibs_municipal: 0.0000,
    is_federal: 0.0000,
    unidade_medida: 'kg',
    inicio_vigencia: '2026-01-01',
    final_vigencia: '2026-12-31',
    descricao: ''
  });

  // ── TAB 3: ANEXOS NCM STATE ──────────────────────────────
  const [ncmList, setNcmList] = useState<NcmRegraAnexoItem[]>([]);
  const [ncmSearch, setNcmSearch] = useState('');
  const [ncmFilterTipo, setNcmFilterTipo] = useState('todos');
  const [showModalNcm, setShowModalNcm] = useState(false);
  const [editingNcm, setEditingNcm] = useState<NcmRegraAnexoItem | null>(null);
  const [ncmForm, setNcmForm] = useState<Partial<NcmRegraAnexoItem>>({
    ncm: '',
    nbs: '',
    cclasstrib: '',
    descricao: '',
    tipo_tratamento: 'cesta_basica_zero',
    percentual_reducao: 100,
    anexo_lei: 'Anexo I Cesta Básica Nacional',
    base_legal: 'Art. 8º LC 214/2025',
    vigencia_inicio: '2026-01-01',
    vigencia_fim: '2033-12-31'
  });

  // Upload Excel State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelPreview, setExcelPreview] = useState<any[] | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);

  // ── OTHER TABS (cClassTrib, CFOP, Regras) ────────────────
  const [cClassRules, setCClassRules] = useState<CClassRule[]>([]);
  const [searchTermCClass, setSearchTermCClass] = useState('');
  const [showAddCClass, setShowAddCClass] = useState(false);
  const [editingCClass, setEditingCClass] = useState<CClassRule | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTratamento, setNewTratamento] = useState<CClassRule['tratamento_esperado']>('tributado');
  const [newCredito, setNewCredito] = useState<CClassRule['permite_credito']>('Sim');
  const [newAliquota, setNewAliquota] = useState('26.5%');

  const [cfopRules, setCfopRules] = useState<CfopRule[]>([]);
  const [showAddCfop, setShowAddCfop] = useState(false);
  const [editingCfop, setEditingCfop] = useState<CfopRule | null>(null);
  const [newCfopCode, setNewCfopCode] = useState('');
  const [newCfopDesc, setNewCfopDesc] = useState('');
  const [newCfopCat, setNewCfopCat] = useState<CfopRule['categoria']>('Compra');
  const [newCfopTrat, setNewCfopTrat] = useState<CfopRule['tratamento_padrao']>('Elegível');
  const [newCfopOneroso, setNewCfopOneroso] = useState(true);
  const [newCfopEvidencia, setNewCfopEvidencia] = useState('');

  const [regras, setRegras] = useState<RegraElegibilidade[]>([]);

  // ── LOAD ALL DATA ────────────────────────────────────────
  const reloadData = async () => {
    setLoading(true);
    try {
      const [resAdVal, resAdRem, resNcm, resClass, resCfop, resRegras, resInfer] = await Promise.all([
        get<{ success: boolean; data: AliquotaTabelaItem[] }>('/tables/aliquotas/ad-valorem'),
        get<{ success: boolean; data: AliquotaTabelaItem[] }>('/tables/aliquotas/ad-rem'),
        get<{ success: boolean; data: NcmRegraAnexoItem[] }>('/tables/anexos-ncm'),
        get<{ success: boolean; data: CClassRule[] }>('/tables/cclasstrib'),
        get<{ success: boolean; data: CfopRule[] }>('/tables/cfop'),
        get<{ success: boolean; data: RegraElegibilidade[] }>('/tables/regras'),
        get<{ success: boolean; data: InferenciaParamItem[] }>('/tables/inferencia')
      ]);

      if (resAdVal.ok && resAdVal.data?.data) setAdValoremList(resAdVal.data.data);
      if (resAdRem.ok && resAdRem.data?.data) setAdRemList(resAdRem.data.data);
      if (resNcm.ok && resNcm.data?.data) setNcmList(resNcm.data.data);
      if (resClass.ok && resClass.data?.data) setCClassRules(resClass.data.data);
      if (resCfop.ok && resCfop.data?.data) setCfopRules(resCfop.data.data);
      if (resRegras.ok && resRegras.data?.data) setRegras(resRegras.data.data);
      if (resInfer.ok && resInfer.data?.data) setInferenciaList(resInfer.data.data);
    } catch (err) {
      console.error('Erro ao recarregar tabelas fiscais:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // ── AD VALOREM HANDLERS ──────────────────────────────────
  const handleOpenNewAdValorem = () => {
    setEditingAdValorem(null);
    const nextCod = String(adValoremList.length + 1).padStart(5, '0');
    setAdValForm({
      codigo_cadastro: nextCod,
      cbs_federal: 0.9000,
      ibs_estadual: 0.1000,
      ibs_municipal: 0.0000,
      is_federal: 0.0000,
      inicio_vigencia: '2026-01-01',
      final_vigencia: '2026-12-31',
      descricao: ''
    });
    setShowModalAdValorem(true);
  };

  const handleEditAdValorem = (item: AliquotaTabelaItem) => {
    setEditingAdValorem(item);
    setAdValForm({
      codigo_cadastro: item.codigo_cadastro,
      cbs_federal: Number(item.cbs_federal),
      ibs_estadual: Number(item.ibs_estadual),
      ibs_municipal: Number(item.ibs_municipal),
      is_federal: Number(item.is_federal),
      inicio_vigencia: item.inicio_vigencia,
      final_vigencia: item.final_vigencia,
      descricao: item.descricao || ''
    });
    setShowModalAdValorem(true);
  };

  const handleSaveAdValorem = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: editingAdValorem?.id,
      ...adValForm
    };
    const res = await post('/tables/aliquotas/ad-valorem', payload);
    if (res.ok) {
      showSuccess('Tabela Ad Valorem gravada com sucesso!');
      setShowModalAdValorem(false);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao gravar Ad Valorem');
    }
  };

  const handleDeleteAdValorem = async (id?: string) => {
    if (!id) return;
    if (confirm('Deseja realmente excluir esta vigência de alíquota Ad Valorem?')) {
      const res = await del(`/tables/aliquotas/ad-valorem/${id}`);
      if (res.ok) {
        showSuccess('Vigência Ad Valorem removida!');
        await reloadData();
      }
    }
  };

  // ── AD REM HANDLERS ──────────────────────────────────────
  const handleOpenNewAdRem = () => {
    setEditingAdRem(null);
    const nextCod = String(adRemList.length + 1).padStart(5, '0');
    setAdRemForm({
      codigo_cadastro: nextCod,
      cbs_federal: 0.0000,
      ibs_estadual: 0.0000,
      ibs_municipal: 0.0000,
      is_federal: 0.0000,
      unidade_medida: 'kg',
      inicio_vigencia: '2026-01-01',
      final_vigencia: '2026-12-31',
      descricao: ''
    });
    setShowModalAdRem(true);
  };

  const handleEditAdRem = (item: AliquotaTabelaItem) => {
    setEditingAdRem(item);
    setAdRemForm({
      codigo_cadastro: item.codigo_cadastro,
      cbs_federal: Number(item.cbs_federal),
      ibs_estadual: Number(item.ibs_estadual),
      ibs_municipal: Number(item.ibs_municipal),
      is_federal: Number(item.is_federal),
      unidade_medida: item.unidade_medida || 'kg',
      inicio_vigencia: item.inicio_vigencia,
      final_vigencia: item.final_vigencia,
      descricao: item.descricao || ''
    });
    setShowModalAdRem(true);
  };

  const handleSaveAdRem = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: editingAdRem?.id,
      ...adRemForm
    };
    const res = await post('/tables/aliquotas/ad-rem', payload);
    if (res.ok) {
      showSuccess('Tabela Ad Rem gravada com sucesso!');
      setShowModalAdRem(false);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao gravar Ad Rem');
    }
  };

  const handleDeleteAdRem = async (id?: string) => {
    if (!id) return;
    if (confirm('Deseja realmente excluir esta vigência de alíquota Ad Rem?')) {
      const res = await del(`/tables/aliquotas/ad-rem/${id}`);
      if (res.ok) {
        showSuccess('Vigência Ad Rem removida!');
        await reloadData();
      }
    }
  };

  // ── ANEXOS NCM HANDLERS ──────────────────────────────────
  const handleOpenNewNcm = () => {
    setEditingNcm(null);
    setNcmForm({
      ncm: '',
      nbs: '',
      cclasstrib: '',
      descricao: '',
      tipo_tratamento: 'cesta_basica_zero',
      percentual_reducao: 100,
      anexo_lei: 'Anexo I Cesta Básica Nacional',
      base_legal: 'Art. 8º LC 214/2025',
      vigencia_inicio: '2026-01-01',
      vigencia_fim: '2033-12-31'
    });
    setShowModalNcm(true);
  };

  const handleEditNcm = (item: NcmRegraAnexoItem) => {
    setEditingNcm(item);
    setNcmForm({
      ncm: item.ncm,
      nbs: item.nbs || '',
      cclasstrib: item.cclasstrib || '',
      descricao: item.descricao,
      tipo_tratamento: item.tipo_tratamento,
      percentual_reducao: item.percentual_reducao,
      anexo_lei: item.anexo_lei || '',
      base_legal: item.base_legal || '',
      vigencia_inicio: item.vigencia_inicio,
      vigencia_fim: item.vigencia_fim
    });
    setShowModalNcm(true);
  };

  const handleSaveNcm = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: editingNcm?.id,
      ...ncmForm
    };
    const res = await post('/tables/anexos-ncm', payload);
    if (res.ok) {
      showSuccess('Regra de NCM salva com sucesso!');
      setShowModalNcm(false);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao gravar NCM');
    }
  };

  const handleDeleteNcm = async (id?: string) => {
    if (!id) return;
    if (confirm('Deseja excluir esta regra de NCM/Anexo?')) {
      const res = await del(`/tables/anexos-ncm/${id}`);
      if (res.ok) {
        showSuccess('Regra de NCM removida!');
        await reloadData();
      }
    }
  };

  // ── EXCEL UPLOAD HANDLER ─────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<any>(ws);

        // Normalize rows
        const parsedRows = rawData.map((row: any) => {
          const ncm = String(row['NCM'] || row['ncm'] || row['Codigo'] || '').trim();
          const desc = String(row['Descricao'] || row['descricao'] || row['Nome'] || 'Item Importado').trim();
          const tipo = String(row['Tratamento'] || row['tipo_tratamento'] || 'cesta_basica_zero').toLowerCase();
          const red = Number(row['Reducao'] || row['percentual_reducao'] || (tipo.includes('cesta') ? 100 : tipo.includes('60') ? 60 : 0));
          const anexo = String(row['Anexo'] || row['anexo_lei'] || 'Importação Excel').trim();
          const base = String(row['BaseLegal'] || row['base_legal'] || 'LC 214/2025').trim();

          let normalizedTipo: NcmRegraAnexoItem['tipo_tratamento'] = 'cesta_basica_zero';
          if (tipo.includes('60') || red === 60) normalizedTipo = 'reducao_60';
          else if (tipo.includes('30') || red === 30) normalizedTipo = 'reducao_30';
          else if (tipo.includes('rem') || tipo.includes('ad_rem')) normalizedTipo = 'ad_rem';
          else if (tipo.includes('padrao')) normalizedTipo = 'padrao';
          else if (tipo.includes('isento')) normalizedTipo = 'isento';

          return {
            ncm,
            descricao: desc,
            tipo_tratamento: normalizedTipo,
            percentual_reducao: red,
            anexo_lei: anexo,
            base_legal: base,
            vigencia_inicio: '2026-01-01',
            vigencia_fim: '2033-12-31'
          };
        }).filter(r => r.ncm.length >= 4);

        if (parsedRows.length === 0) {
          alert('Nenhuma linha com NCM válido encontrada na planilha.');
          return;
        }

        setExcelPreview(parsedRows);
        setShowExcelModal(true);
      } catch (err: any) {
        alert('Erro ao processar planilha Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmExcelImport = async () => {
    if (!excelPreview || excelPreview.length === 0) return;
    setLoading(true);
    try {
      const res = await post('/tables/anexos-ncm/upload-lote', { itens: excelPreview });
      if (res.ok) {
        showSuccess(`${excelPreview.length} regras de NCM importadas com sucesso!`);
        setShowExcelModal(false);
        setExcelPreview(null);
        await reloadData();
      } else {
        alert(res.error || 'Erro ao importar lote de NCMs');
      }
    } catch (err: any) {
      alert('Falha na comunicação com o servidor: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── INFERÊNCIA HANDLERS ──────────────────────────────────
  const handleOpenNewInferencia = () => {
    setEditingInferencia(null);
    const nextCod = 'INF_' + String(inferenciaList.length + 1).padStart(3, '0');
    setInferenciaForm({
      codigo: nextCod,
      descricao: '',
      icms_medio: 0.0,
      pis_medio: 0.0,
      cofins_medio: 0.0,
      ipi_medio: 0.0,
      iss_medio: 0.0,
      aplica_simples_nac: 1,
      aplica_cte: 0,
      aplica_nfse: 0,
      inicio_vigencia: '2026-01-01',
      final_vigencia: '2099-12-31'
    });
    setShowModalInferencia(true);
  };

  const handleEditInferencia = (item: InferenciaParamItem) => {
    setEditingInferencia(item);
    setInferenciaForm({
      codigo: item.codigo,
      descricao: item.descricao,
      icms_medio: Number(item.icms_medio) || 0,
      pis_medio: Number(item.pis_medio) || 0,
      cofins_medio: Number(item.cofins_medio) || 0,
      ipi_medio: Number(item.ipi_medio) || 0,
      iss_medio: Number(item.iss_medio) || 0,
      aplica_simples_nac: item.aplica_simples_nac ? 1 : 0,
      aplica_cte: item.aplica_cte ? 1 : 0,
      aplica_nfse: item.aplica_nfse ? 1 : 0,
      inicio_vigencia: item.inicio_vigencia || '2026-01-01',
      final_vigencia: item.final_vigencia || '2099-12-31'
    });
    setShowModalInferencia(true);
  };

  const handleSaveInferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await post('/tables/inferencia', inferenciaForm);
    if (res.ok) {
      showSuccess('Parâmetro de inferência gravado com sucesso!');
      setShowModalInferencia(false);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao gravar parâmetro de inferência');
    }
  };

  const handleDeleteInferencia = async (id?: string) => {
    if (!id) return;
    if (confirm('Deseja realmente excluir este parâmetro de inferência?')) {
      const res = await del(`/tables/inferencia/${id}`);
      if (res.ok) {
        showSuccess('Parâmetro de inferência removido com sucesso!');
        await reloadData();
      } else {
        alert(res.error || 'Erro ao excluir parâmetro');
      }
    }
  };

  // ── FILTERED NCMS ────────────────────────────────────────
  const filteredNcms = ncmList.filter(n => {
    if (ncmFilterTipo !== 'todos' && n.tipo_tratamento !== ncmFilterTipo) return false;
    if (ncmSearch) {
      const s = ncmSearch.toLowerCase();
      return n.ncm.toLowerCase().includes(s) || n.descricao.toLowerCase().includes(s) || (n.cclasstrib && n.cclasstrib.includes(s));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Module Tabs Selector */}
      <div className="flex flex-wrap items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 gap-1.5 shadow-xl">
        <button
          onClick={() => setActiveTab('ad_valorem')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ad_valorem'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Percent className="w-4 h-4 text-cyan-400" />
          <span>Alíquota Ad Valorem (%)</span>
        </button>

        <button
          onClick={() => setActiveTab('ad_rem')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ad_rem'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Scale className="w-4 h-4 text-amber-300" />
          <span>Alíquota Ad Rem (Valor R$)</span>
        </button>

        <button
          onClick={() => setActiveTab('anexos_ncm')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'anexos_ncm'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-300" />
          <span>Anexos da Lei & NCMs ({ncmList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('retencoes_servicos')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'retencoes_servicos'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Receipt className="w-4 h-4 text-amber-300" />
          <span>Retenções de Serviços (NFS-e)</span>
        </button>

        <button
          onClick={() => setActiveTab('cclasstrib')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'cclasstrib'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>cClassTrib (6D)</span>
        </button>

        <button
          onClick={() => setActiveTab('cfop')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'cfop'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Matriz CFOP ({cfopRules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('regras')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'regras'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Regras Elegibilidade ({regras.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inferencia')}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'inferencia'
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-violet-400" />
          <span>Inferência Simulador ({inferenciaList.length})</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB 1: TABELA DE ALÍQUOTA AD VALOREM (%)
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'ad_valorem' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Percent className="w-5 h-5 text-cyan-400" />
                Tabela de Alíquota Ad Valorem (%)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Parâmetros oficiais de alíquotas percentuais por período de vigência para CBS Federal, IBS Estadual, IBS Municipal e IS Federal.
              </p>
            </div>

            <button
              onClick={handleOpenNewAdValorem}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Vigência Ad Valorem</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Cadastro</th>
                  <th className="py-3 px-4">CBS Federal</th>
                  <th className="py-3 px-4">IBS Estadual</th>
                  <th className="py-3 px-4">IBS Municipal</th>
                  <th className="py-3 px-4">IS Federal</th>
                  <th className="py-3 px-4">Início de Vigência</th>
                  <th className="py-3 px-4">Final de Vigência</th>
                  <th className="py-3 px-4">Descrição / Base Legal</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {adValoremList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                      Nenhuma vigência Ad Valorem cadastrada. Clique em "Nova Vigência" para incluir.
                    </td>
                  </tr>
                ) : (
                  adValoremList.map((item) => {
                    const totalAliq = Number(item.cbs_federal) + Number(item.ibs_estadual) + Number(item.ibs_municipal) + Number(item.is_federal);
                    return (
                      <tr key={item.id || item.codigo_cadastro} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-cyan-400">{item.codigo_cadastro}</td>
                        <td className="py-3 px-4 font-bold text-slate-200">
                          {Number(item.cbs_federal).toFixed(4)}%
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-200">
                          {Number(item.ibs_estadual).toFixed(4)}%
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-200">
                          {Number(item.ibs_municipal).toFixed(4)}%
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-200">
                          {Number(item.is_federal).toFixed(4)}%
                        </td>
                        <td className="py-3 px-4 text-emerald-400 font-bold">
                          {item.inicio_vigencia.split('-').reverse().join('/')}
                        </td>
                        <td className="py-3 px-4 text-amber-400 font-bold">
                          {item.final_vigencia.split('-').reverse().join('/')}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-400 max-w-xs truncate">
                          {item.descricao || `IVA Total: ${totalAliq.toFixed(2)}%`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditAdValorem(item)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-blue-400 transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAdValorem(item.id)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 2: TABELA DE ALÍQUOTA AD REM (VALOR R$)
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'ad_rem' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                Tabela de Alíquota Ad Rem (valor em R$)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Alíquotas específicas em valor monetário fixo por unidade de medida (combustíveis, GLP, bebidas) conforme LC 214/2025.
              </p>
            </div>

            <button
              onClick={handleOpenNewAdRem}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Vigência Ad Rem</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Cadastro</th>
                  <th className="py-3 px-4">CBS Federal (R$)</th>
                  <th className="py-3 px-4">IBS Estadual (R$)</th>
                  <th className="py-3 px-4">IBS Municipal (R$)</th>
                  <th className="py-3 px-4">IS Federal (R$)</th>
                  <th className="py-3 px-4">Unidade</th>
                  <th className="py-3 px-4">Início de Vigência</th>
                  <th className="py-3 px-4">Final de Vigência</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {adRemList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                      Nenhuma vigência Ad Rem cadastrada. Clique em "Nova Vigência Ad Rem" para incluir.
                    </td>
                  </tr>
                ) : (
                  adRemList.map((item) => (
                    <tr key={item.id || item.codigo_cadastro} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-amber-400">{item.codigo_cadastro}</td>
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {Number(item.cbs_federal).toFixed(4)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {Number(item.ibs_estadual).toFixed(4)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {Number(item.ibs_municipal).toFixed(4)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {Number(item.is_federal).toFixed(4)}
                      </td>
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        {item.unidade_medida || 'kg'}
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">
                        {item.inicio_vigencia.split('-').reverse().join('/')}
                      </td>
                      <td className="py-3 px-4 text-amber-400 font-bold">
                        {item.final_vigencia.split('-').reverse().join('/')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditAdRem(item)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAdRem(item.id)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 3: ANEXOS DA LEI & NCMs (Reduções e Isenções)
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'anexos_ncm' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Catálogo de Anexos da Lei & Regimes Especiais (NCM / NBS)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mapeamento de NCMs com Alíquota Zero (Cesta Básica), Reduções de 60%, 30% e Regimes Específicos.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-700/20 cursor-pointer"
                title="Importar planilha com centenas de NCMs de uma só vez"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Importar Planilha Excel</span>
              </button>

              <button
                onClick={handleOpenNewNcm}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo NCM / Anexo</span>
              </button>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por NCM, descrição ou cClassTrib..."
                value={ncmSearch}
                onChange={(e) => setNcmSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={ncmFilterTipo}
                onChange={(e) => setNcmFilterTipo(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="todos">Todos os Regimes ({ncmList.length})</option>
                <option value="cesta_basica_zero">Cesta Básica Nacional (Alíquota Zero / 100% Redução)</option>
                <option value="reducao_60">Redução de 60% (Saúde / Medicamentos / Insumos)</option>
                <option value="reducao_30">Redução de 30% (Serviços / Educação)</option>
                <option value="ad_rem">Regime Monofásico Ad Rem (GLP / Combustíveis)</option>
                <option value="padrao">Tributação Normal</option>
              </select>
            </div>
          </div>

          {/* Tabela de NCMs */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">NCM / Código</th>
                  <th className="py-3 px-4">Descrição do Item</th>
                  <th className="py-3 px-4">Tratamento Tributário</th>
                  <th className="py-3 px-4">Redução (%)</th>
                  <th className="py-3 px-4">Anexo / Base Legal</th>
                  <th className="py-3 px-4">Vigência</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredNcms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Nenhum NCM encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredNcms.map((item) => {
                    let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                    let label = 'Tributação Normal';
                    if (item.tipo_tratamento === 'cesta_basica_zero') {
                      badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                      label = 'Cesta Básica (0% / 100% Redução)';
                    } else if (item.tipo_tratamento === 'reducao_60') {
                      badgeColor = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
                      label = 'Redução de 60%';
                    } else if (item.tipo_tratamento === 'reducao_30') {
                      badgeColor = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
                      label = 'Redução de 30%';
                    } else if (item.tipo_tratamento === 'ad_rem') {
                      badgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
                      label = 'Ad Rem Monofásico';
                    }

                    return (
                      <tr key={item.id || item.ncm} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{item.ncm}</td>
                        <td className="py-3 px-4 font-bold text-slate-200 max-w-sm truncate">{item.descricao}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${badgeColor}`}>
                            {label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                          {item.percentual_reducao > 0 ? `-${item.percentual_reducao}%` : '0%'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {item.anexo_lei || item.base_legal || 'LC 214/2025'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {item.vigencia_inicio.slice(0, 4)} a {item.vigencia_fim.slice(0, 4)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditNcm(item)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteNcm(item.id)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 3.5: TABELA DE REGRAS DE RETENÇÃO DE SERVIÇOS (NFS-e)
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'retencoes_servicos' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                Matriz de Retenções na Fonte em Serviços (NFS-e) & Fundamentação Legal
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Regras tributárias parametrizadas para auditoria automática de retenção na fonte (IRRF, CSLL, PIS, COFINS, INSS e ISS) conforme Lei 10.833/03, RIR/2018 e LC 116/03.
              </p>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-300 text-xs font-bold font-mono">
              8 Regras Parametrizadas
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Tributo Retido</th>
                  <th className="py-3 px-4">Alíquota</th>
                  <th className="py-3 px-4">Base Legal</th>
                  <th className="py-3 px-4">Hipótese de Incidência</th>
                  <th className="py-3 px-4">Tipo Recolhimento</th>
                  <th className="py-3 px-4">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {REGRAS_RETENCAO_SERVICOS.map((regra) => (
                  <tr key={regra.codigo} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">{regra.codigo}</td>
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">{regra.tributo}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">{regra.aliquota}</td>
                    <td className="py-3 px-4 font-mono text-cyan-300 text-[11px] whitespace-nowrap">{regra.baseLegal}</td>
                    <td className="py-3 px-4 text-slate-300 text-[11px] max-w-xs">{regra.hipotese}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">{regra.tipoRetencao}</td>
                    <td className="py-3 px-4 text-indigo-300 whitespace-nowrap font-semibold text-[11px]">{regra.responsavel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 4: cClassTrib Rules
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'cclasstrib' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por cClassTrib ou descrição..."
                value={searchTermCClass}
                onChange={(e) => setSearchTermCClass(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={() => setShowAddCClass(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo cClassTrib</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">cClassTrib</th>
                  <th className="py-3 px-4">Descrição Oficial</th>
                  <th className="py-3 px-4">Tratamento Fisco</th>
                  <th className="py-3 px-4">Permite Crédito?</th>
                  <th className="py-3 px-4">Alíquota Referência</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {cClassRules.filter(c => !searchTermCClass || c.cclasstrib.includes(searchTermCClass) || c.descricao_interna.toLowerCase().includes(searchTermCClass.toLowerCase())).map((rule) => (
                  <tr key={rule.id || rule.cclasstrib} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-cyan-400">{rule.cclasstrib}</td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-200 max-w-xs truncate">{rule.descricao_interna}</td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                        {rule.tratamento_esperado}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        rule.permite_credito === 'Sim' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                        rule.permite_credito === 'Não' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {rule.permite_credito}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-400">{rule.aliquota_esperada}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setEditingCClass(rule)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-cyan-400">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 5: MATRIZ CFOP
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'cfop' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-400" />
              Matriz de CFOP x Tratamento e Onerosidade
            </h3>
            <button
              onClick={() => setShowAddCfop(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo CFOP</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">CFOP</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Tratamento</th>
                  <th className="py-3 px-4">Exige Onerosidade?</th>
                  <th className="py-3 px-4">Evidência Mínima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cfopRules.map((rule) => (
                  <tr key={rule.id || rule.cfop} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">{rule.cfop}</td>
                    <td className="py-3 px-4 font-medium text-slate-200">{rule.descricao}</td>
                    <td className="py-3 px-4 text-slate-400">{rule.categoria}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        rule.tratamento_padrao === 'Elegível' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                        rule.tratamento_padrao === 'Não elegível' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {rule.tratamento_padrao}
                      </span>
                    </td>
                    <td className="py-3 px-4">{rule.exige_onerosidade ? '✅ Sim' : '❌ Não'}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">{rule.evidencia_minima || 'XML Válido'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 6: REGRAS DE ELEGIBILIDADE
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'regras' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            Regras de Elegibilidade de Crédito da Reforma Tributária (LC 214/2025)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {regras.map((r) => (
              <div key={r.id || r.codigo_regra} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-teal-400">{r.codigo_regra}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                    {r.resultado_padrao}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200">{r.nome}</h4>
                <p className="text-[11px] text-slate-400">{r.descricao}</p>
                <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-2 flex items-center justify-between">
                  <span>Evidência: {r.evidencia_minima}</span>
                  <span className="font-mono">{r.base_legal}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 8: ALÍQUOTAS MÉDIAS PARA INFERÊNCIA (SIMULADOR)
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'inferencia' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-violet-400" />
                Parâmetros de Inferência — Alíquotas Médias do Simulador
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
                Alíquotas médias de ICMS, PIS, COFINS, IPI e ISS aplicadas exclusivamente pelo <strong>Simulador Comparativo de Transição</strong> da Central de KPIs quando os XMLs não discriminam os tributos (ex: Simples Nacional CRT 1/4 e CT-e sem PIS/COFINS). Os relatórios e dados do XML continuam refletindo <strong>estritamente</strong> os valores originais.
              </p>
            </div>

            <button
              onClick={handleOpenNewInferencia}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-violet-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Parâmetro de Inferência</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Descrição do Contexto</th>
                  <th className="py-3 px-4 text-right">ICMS (%)</th>
                  <th className="py-3 px-4 text-right">PIS (%)</th>
                  <th className="py-3 px-4 text-right">COFINS (%)</th>
                  <th className="py-3 px-4 text-right">IPI (%)</th>
                  <th className="py-3 px-4 text-right">ISS (%)</th>
                  <th className="py-3 px-4">Aplica-se em</th>
                  <th className="py-3 px-4">Vigência</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {inferenciaList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500 font-sans">
                      Nenhum parâmetro de inferência cadastrado. Clique em "Novo Parâmetro de Inferência" para cadastrar.
                    </td>
                  </tr>
                ) : (
                  inferenciaList.map((item) => (
                    <tr key={item.id || item.codigo} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-violet-400">{item.codigo}</td>
                      <td className="py-3 px-4 font-sans text-slate-200 font-semibold">{item.descricao}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-200">
                        {Number(item.icms_medio).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-200">
                        {Number(item.pis_medio).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-200">
                        {Number(item.cofins_medio).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-200">
                        {Number(item.ipi_medio).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-200">
                        {Number(item.iss_medio).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="flex flex-wrap gap-1">
                          {item.aplica_simples_nac ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Simples CRT 1/4
                            </span>
                          ) : null}
                          {item.aplica_cte ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              CT-e Frete
                            </span>
                          ) : null}
                          {item.aplica_nfse ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              NFS-e Serviços
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-400 text-[11px]">
                        {item.inicio_vigencia} a {item.final_vigencia}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditInferencia(item)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-violet-400 transition-colors cursor-pointer"
                            title="Editar Parâmetro"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteInferencia(item.id)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Excluir Parâmetro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: AD VALOREM (%)
      ═══════════════════════════════════════════════════════ */}
      {showModalAdValorem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Percent className="w-5 h-5 text-blue-400" />
                {editingAdValorem ? `Editar Vigência Ad Valorem (${adValForm.codigo_cadastro})` : 'Nova Vigência Ad Valorem (%)'}
              </h3>
              <button onClick={() => setShowModalAdValorem(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveAdValorem} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Código Cadastro *</label>
                  <input
                    type="text"
                    value={adValForm.codigo_cadastro}
                    onChange={(e) => setAdValForm({ ...adValForm, codigo_cadastro: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">CBS Federal (%) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={adValForm.cbs_federal}
                    onChange={(e) => setAdValForm({ ...adValForm, cbs_federal: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">IBS Estadual (%) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={adValForm.ibs_estadual}
                    onChange={(e) => setAdValForm({ ...adValForm, ibs_estadual: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">IBS Municipal (%) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={adValForm.ibs_municipal}
                    onChange={(e) => setAdValForm({ ...adValForm, ibs_municipal: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">IS Federal (%)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={adValForm.is_federal}
                    onChange={(e) => setAdValForm({ ...adValForm, is_federal: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Início de Vigência *</label>
                  <input
                    type="date"
                    value={adValForm.inicio_vigencia}
                    onChange={(e) => setAdValForm({ ...adValForm, inicio_vigencia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Final de Vigência *</label>
                  <input
                    type="date"
                    value={adValForm.final_vigencia}
                    onChange={(e) => setAdValForm({ ...adValForm, final_vigencia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Descrição / Fase de Transição</label>
                <input
                  type="text"
                  placeholder="Ex: Ano de Teste (Art. 342 LC 214/2025)"
                  value={adValForm.descricao}
                  onChange={(e) => setAdValForm({ ...adValForm, descricao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Total IVA Combinado:</span>
                <span className="text-sm font-extrabold text-cyan-400 font-mono">
                  {(adValForm.cbs_federal + adValForm.ibs_estadual + adValForm.ibs_municipal + adValForm.is_federal).toFixed(4)}%
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowModalAdValorem(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold">Salvar Vigência</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: AD REM (R$ / UNIDADE)
      ═══════════════════════════════════════════════════════ */}
      {showModalAdRem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                {editingAdRem ? `Editar Vigência Ad Rem (${adRemForm.codigo_cadastro})` : 'Nova Vigência Ad Rem (R$)'}
              </h3>
              <button onClick={() => setShowModalAdRem(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveAdRem} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Código Cadastro *</label>
                  <input
                    type="text"
                    value={adRemForm.codigo_cadastro}
                    onChange={(e) => setAdRemForm({ ...adRemForm, codigo_cadastro: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Unidade de Medida *</label>
                  <select
                    value={adRemForm.unidade_medida}
                    onChange={(e) => setAdRemForm({ ...adRemForm, unidade_medida: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="kg">kg (Quilograma - GLP / Gás)</option>
                    <option value="L">L (Litro - Combustíveis)</option>
                    <option value="m3">m³ (Metro Cúbico - Gás Natural)</option>
                    <option value="unid">unid (Unidade)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">CBS Federal (R$/unid) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={adRemForm.cbs_federal}
                    onChange={(e) => setAdRemForm({ ...adRemForm, cbs_federal: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">IBS Estadual (R$/unid) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={adRemForm.ibs_estadual}
                    onChange={(e) => setAdRemForm({ ...adRemForm, ibs_estadual: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Início de Vigência *</label>
                  <input
                    type="date"
                    value={adRemForm.inicio_vigencia}
                    onChange={(e) => setAdRemForm({ ...adRemForm, inicio_vigencia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Final de Vigência *</label>
                  <input
                    type="date"
                    value={adRemForm.final_vigencia}
                    onChange={(e) => setAdRemForm({ ...adRemForm, final_vigencia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Regime Monofásico GLP / Combustíveis"
                  value={adRemForm.descricao}
                  onChange={(e) => setAdRemForm({ ...adRemForm, descricao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowModalAdRem(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold">Salvar Vigência</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: NOVO NCM / ANEXO
      ═══════════════════════════════════════════════════════ */}
      {showModalNcm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                {editingNcm ? `Editar NCM ${ncmForm.ncm}` : 'Novo NCM / Anexo de Redução'}
              </h3>
              <button onClick={() => setShowModalNcm(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveNcm} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Código NCM *</label>
                  <input
                    type="text"
                    placeholder="Ex: 1006.10.92 ou 2711.19.10"
                    value={ncmForm.ncm}
                    onChange={(e) => setNcmForm({ ...ncmForm, ncm: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">cClassTrib Vinculado</label>
                  <input
                    type="text"
                    placeholder="Ex: 030001 ou 900001"
                    value={ncmForm.cclasstrib}
                    onChange={(e) => setNcmForm({ ...ncmForm, cclasstrib: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Descrição do Item / Mercadoria *</label>
                <input
                  type="text"
                  placeholder="Ex: Arroz em grãos, Medicamentos essenciais, GLP..."
                  value={ncmForm.descricao}
                  onChange={(e) => setNcmForm({ ...ncmForm, descricao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Tratamento Tributário</label>
                  <select
                    value={ncmForm.tipo_tratamento}
                    onChange={(e) => {
                      const tipo = e.target.value as any;
                      let red = 0;
                      if (tipo === 'cesta_basica_zero') red = 100;
                      else if (tipo === 'reducao_60') red = 60;
                      else if (tipo === 'reducao_30') red = 30;
                      setNcmForm({ ...ncmForm, tipo_tratamento: tipo, percentual_reducao: red });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="cesta_basica_zero">Cesta Básica Nacional (Alíquota Zero / 100%)</option>
                    <option value="reducao_60">Redução de 60% (Saúde / Dispositivos)</option>
                    <option value="reducao_30">Redução de 30% (Educação / Serviços)</option>
                    <option value="ad_rem">Regime Monofásico Ad Rem (GLP / Combustíveis)</option>
                    <option value="padrao">Tributação Normal (Sem Redução)</option>
                    <option value="isento">Isenção / Imunidade</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Percentual de Redução (%)</label>
                  <input
                    type="number"
                    value={ncmForm.percentual_reducao}
                    onChange={(e) => setNcmForm({ ...ncmForm, percentual_reducao: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Anexo da Lei</label>
                  <input
                    type="text"
                    placeholder="Ex: Anexo I Cesta Básica Nacional"
                    value={ncmForm.anexo_lei}
                    onChange={(e) => setNcmForm({ ...ncmForm, anexo_lei: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Base Legal</label>
                  <input
                    type="text"
                    placeholder="Ex: Art. 8º LC 214/2025"
                    value={ncmForm.base_legal}
                    onChange={(e) => setNcmForm({ ...ncmForm, base_legal: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowModalNcm(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold">Salvar NCM</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: PARÂMETRO DE INFERÊNCIA (SIMULADOR)
      ═══════════════════════════════════════════════════════ */}
      {showModalInferencia && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-violet-400" />
                {editingInferencia ? `Editar Parâmetro (${inferenciaForm.codigo})` : 'Novo Parâmetro de Inferência'}
              </h3>
              <button onClick={() => setShowModalInferencia(false)} className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveInferencia} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Código *</label>
                  <input
                    type="text"
                    value={inferenciaForm.codigo}
                    onChange={(e) => setInferenciaForm({ ...inferenciaForm, codigo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="font-bold text-slate-300 block mb-1">Descrição do Contexto *</label>
                  <input
                    type="text"
                    placeholder="Ex: Alíquotas Médias - Simples Nacional"
                    value={inferenciaForm.descricao}
                    onChange={(e) => setInferenciaForm({ ...inferenciaForm, descricao: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-2">Alíquotas Médias a Deduzir no Simulador (%)</label>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">ICMS (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={inferenciaForm.icms_medio}
                      onChange={(e) => setInferenciaForm({ ...inferenciaForm, icms_medio: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-center focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">PIS (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={inferenciaForm.pis_medio}
                      onChange={(e) => setInferenciaForm({ ...inferenciaForm, pis_medio: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-center focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">COFINS (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={inferenciaForm.cofins_medio}
                      onChange={(e) => setInferenciaForm({ ...inferenciaForm, cofins_medio: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-center focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">IPI (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={inferenciaForm.ipi_medio}
                      onChange={(e) => setInferenciaForm({ ...inferenciaForm, ipi_medio: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-center focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">ISS (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={inferenciaForm.iss_medio}
                      onChange={(e) => setInferenciaForm({ ...inferenciaForm, iss_medio: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-center focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-2">Contextos de Aplicação</label>
                <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inferenciaForm.aplica_simples_nac === 1}
                      onChange={(e) => setInferenciaForm({ ...inferenciaForm, aplica_simples_nac: e.target.checked ? 1 : 0 })}
                      className="rounded border-slate-700 text-violet-600 focus:ring-violet-500 bg-slate-900 w-4 h-4"
                    />
                    <span>Aplicar ao <strong>Simples Nacional (CRT 1 e CRT 4 / MEI)</strong></span>
                  </label>
                  <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inferenciaForm.aplica_cte === 1}
                      onChange={(e) => setInferenciaForm({ ...inferenciaForm, aplica_cte: e.target.checked ? 1 : 0 })}
                      className="rounded border-slate-700 text-violet-600 focus:ring-violet-500 bg-slate-900 w-4 h-4"
                    />
                    <span>Aplicar ao <strong>CT-e</strong> (Frete de Transporte sem PIS/COFINS no XML)</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inferenciaForm.aplica_nfse === 1}
                      onChange={(e) => setInferenciaForm({ ...inferenciaForm, aplica_nfse: e.target.checked ? 1 : 0 })}
                      className="rounded border-slate-700 text-violet-600 focus:ring-violet-500 bg-slate-900 w-4 h-4"
                    />
                    <span>Aplicar à <strong>NFS-e</strong> (Serviços Municipais)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Início de Vigência *</label>
                  <input
                    type="date"
                    value={inferenciaForm.inicio_vigencia}
                    onChange={(e) => setInferenciaForm({ ...inferenciaForm, inicio_vigencia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Final de Vigência *</label>
                  <input
                    type="date"
                    value={inferenciaForm.final_vigencia}
                    onChange={(e) => setInferenciaForm({ ...inferenciaForm, final_vigencia: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModalInferencia(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold cursor-pointer shadow-lg shadow-violet-600/30"
                >
                  Salvar Parâmetro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: PREVIEW E IMPORTAÇÃO DE PLANILHA EXCEL
      ═══════════════════════════════════════════════════════ */}
      {showExcelModal && excelPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Importar {excelPreview.length} Regras de NCM da Planilha
              </h3>
              <button onClick={() => setShowExcelModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              Confira os primeiros itens lidos da planilha antes de confirmar a gravação no banco de dados:
            </p>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">NCM</th>
                    <th className="py-2 px-3">Descrição</th>
                    <th className="py-2 px-3">Tratamento</th>
                    <th className="py-2 px-3">Redução</th>
                    <th className="py-2 px-3">Anexo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {excelPreview.slice(0, 20).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-emerald-400 font-bold">{r.ncm}</td>
                      <td className="py-2 px-3 font-sans text-slate-200 max-w-xs truncate">{r.descricao}</td>
                      <td className="py-2 px-3 font-sans">{r.tipo_tratamento}</td>
                      <td className="py-2 px-3 text-cyan-300">-{r.percentual_reducao}%</td>
                      <td className="py-2 px-3 font-sans text-slate-400">{r.anexo_lei}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {excelPreview.length > 20 && (
              <p className="text-[11px] text-slate-500 text-center">
                ... e mais {excelPreview.length - 20} itens que serão importados com segurança.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmExcelImport}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Importação de {excelPreview.length} Itens</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
