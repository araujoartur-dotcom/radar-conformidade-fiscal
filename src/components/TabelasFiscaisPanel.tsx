import React, { useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontal, Table, Plus, Edit3, Trash2, CheckCircle2,
  AlertTriangle, FileText, Scale, Save, Percent, ShieldCheck, Search, Filter, X,
  Check, FileCheck, Layers, Upload, Download, FileSpreadsheet, Sparkles, Receipt,
  Pencil, Calculator, Building2, Briefcase, TrendingUp, Users, ChevronDown, ChevronUp,
  FileCode, MapPin, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApi } from '../hooks/useApi';
import { getApiBaseUrl } from '../utils/apiConfig';
import {
  AliquotaTabelaItem,
  NcmRegraAnexoItem,
  SimplesNacionalFaixaItem,
  SimplesNacionalPartilhaItem,
  LucroPresumidoParamItem,
  EncargoPatronalParamItem,
  IndOperItem
} from '../types';

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

interface UniversalTableActionsProps {
  endpoint: string;
  baseFilename: string;
  onUploadSuccess: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  searchPlaceholder?: string;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}

const UniversalTableActions: React.FC<UniversalTableActionsProps> = ({
  endpoint,
  baseFilename,
  onUploadSuccess,
  onAddNew,
  addNewLabel = 'Novo Registro',
  searchPlaceholder = 'Filtrar registros...',
  searchTerm,
  onSearchChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleExport = async (format: 'xlsx' | 'json') => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${getApiBaseUrl()}/tables/${endpoint}/export?format=${format}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao exportar');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFilename}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Erro na exportação: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fileName = file.name.toLowerCase();
      let rows: any[] = [];
      if (fileName.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : (parsed.itens || parsed.data || []);
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws);
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('Arquivo vazio ou formato não reconhecido.');
      }
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${getApiBaseUrl()}/tables/${endpoint}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itens: rows })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Erro ao processar importação');
      }
      alert(data.message || 'Importação realizada com sucesso!');
      onUploadSuccess();
    } catch (err: any) {
      alert('Erro no upload: ' + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-slate-800/80 mb-3">
      {onSearchChange !== undefined && (
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelected}
          accept=".xlsx,.xls,.json,.csv"
          className="hidden"
        />

        <button
          onClick={() => handleExport('xlsx')}
          disabled={isExporting}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
          title="Exportar dados da tabela em formato Microsoft Excel (.xlsx)"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Exportar XLSX</span>
        </button>

        <button
          onClick={() => handleExport('json')}
          disabled={isExporting}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
          title="Exportar dados da tabela em formato JSON estruturado"
        >
          <FileCode className="w-3.5 h-3.5 text-amber-400" />
          <span>Exportar JSON</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
          title="Importar registros em massa a partir de arquivo .xlsx ou .json"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>{isUploading ? 'Importando...' : 'Importar (JSON / XLSX)'}</span>
        </button>

        {onAddNew && (
          <button
            onClick={onAddNew}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{addNewLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export const TabelasFiscaisPanel: React.FC = () => {
  const { get, post, put, del, uploadFile } = useApi();
  const [activeTab, setActiveTab] = useState<'ad_valorem' | 'ad_rem' | 'anexos_ncm' | 'cclasstrib' | 'indoper' | 'cfop' | 'regras' | 'retencoes_servicos' | 'simples_nacional' | 'lucro_presumido' | 'inferencia'>('ad_valorem');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showCategoriasGuide, setShowCategoriasGuide] = useState(false);

  // ── TAB: indOper (LOCAL DA OPERAÇÃO SVRS) ─────────────────
  const [indOperList, setIndOperList] = useState<IndOperItem[]>([]);
  const [searchTermIndOper, setSearchTermIndOper] = useState('');
  const [showAddIndOper, setShowAddIndOper] = useState(false);
  const [editingIndOper, setEditingIndOper] = useState<IndOperItem | null>(null);
  const [indOperForm, setIndOperForm] = useState({
    id: '',
    codigo: '',
    nome: '',
    dispositivo_legal: 'Art. 11 da LC 214/2025',
    local: 'Estabelecimento fornecedor',
    local_fornecedor: '',
    caracteristica: '',
    data_publicacao: '17/11/2025',
    inicio_vigencia: '17/11/2025',
    fim_vigencia: '-'
  });

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

  // ── TAB: SIMPLES NACIONAL (LC 123/2006) ───────────────────
  const [faixasSimples, setFaixasSimples] = useState<SimplesNacionalFaixaItem[]>([]);
  const [partilhasSimples, setPartilhasSimples] = useState<SimplesNacionalPartilhaItem[]>([]);
  const [selectedAnexoSimples, setSelectedAnexoSimples] = useState<string>('anexo1');
  const [showPartilhaReforma, setShowPartilhaReforma] = useState(false);
  const [showModalFaixaSimples, setShowModalFaixaSimples] = useState(false);
  const [editingFaixaSimples, setEditingFaixaSimples] = useState<SimplesNacionalFaixaItem | null>(null);
  const [faixaSimplesForm, setFaixaSimplesForm] = useState({
    id: '',
    anexo: 'anexo1',
    nome_anexo: 'Anexo I - Comércio',
    faixa: 1,
    limite_superior: 180000,
    aliq_nominal: 0.040,
    deducao: 0,
    reparticao_irpj: 0.055,
    reparticao_csll: 0.035,
    reparticao_cofins: 0.1274,
    reparticao_pis: 0.0276,
    reparticao_cpp: 0.4150,
    reparticao_icms: 0.3400,
    reparticao_iss: 0.0,
    reparticao_ipi: 0.0
  });

  // ── TAB: LUCRO PRESUMIDO & ENCARGOS (LEI 9.249 & 8.212) ──
  const [lucroPresumidoList, setLucroPresumidoList] = useState<LucroPresumidoParamItem[]>([]);
  const [encargosList, setEncargosList] = useState<EncargoPatronalParamItem[]>([]);
  const [showModalLucroPresumido, setShowModalLucroPresumido] = useState(false);
  const [editingLucroPresumido, setEditingLucroPresumido] = useState<LucroPresumidoParamItem | null>(null);
  const [lucroPresumidoForm, setLucroPresumidoForm] = useState({
    id: '',
    codigo_atividade: '',
    nome_atividade: '',
    presuncao_irpj: 0.08,
    presuncao_csll: 0.12,
    aliq_irpj_basico: 0.15,
    aliq_irpj_adicional: 0.10,
    limite_mensal_adicional: 20000,
    aliq_csll: 0.09,
    artigo_legal: '',
    detalhe: '',
    categoria: 'comercio',
    anexo_simples_padrao: 'anexo1'
  });

  const [showModalEncargo, setShowModalEncargo] = useState(false);
  const [editingEncargo, setEditingEncargo] = useState<EncargoPatronalParamItem | null>(null);
  const [encargoForm, setEncargoForm] = useState({
    id: '',
    codigo_atividade: '',
    nome_ramo: '',
    inss_patronal: 0.20,
    rat_fap: 0.03,
    sistema_s: 0.052,
    entidades_descricao: ''
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
  const [newAliquota, setNewAliquota] = useState('');

  const [cfopRules, setCfopRules] = useState<CfopRule[]>([]);
  const [searchTermCfop, setSearchTermCfop] = useState('');
  const [showAddCfop, setShowAddCfop] = useState(false);
  const [editingCfop, setEditingCfop] = useState<CfopRule | null>(null);
  const [newCfopCode, setNewCfopCode] = useState('');
  const [newCfopDesc, setNewCfopDesc] = useState('');
  const [newCfopCat, setNewCfopCat] = useState<CfopRule['categoria']>('Compra');
  const [newCfopTrat, setNewCfopTrat] = useState<CfopRule['tratamento_padrao']>('Elegível');
  const [newCfopOneroso, setNewCfopOneroso] = useState(true);
  const [newCfopEvidencia, setNewCfopEvidencia] = useState('');

  const [regras, setRegras] = useState<RegraElegibilidade[]>([]);
  const [searchTermRegras, setSearchTermRegras] = useState('');
  const [showAddRegra, setShowAddRegra] = useState(false);
  const [editingRegra, setEditingRegra] = useState<RegraElegibilidade | null>(null);
  const [regraForm, setRegraForm] = useState({
    codigo_regra: '',
    nome: '',
    descricao: '',
    tipo_aquisicao: 'Insumo Operacional',
    cfops_aplicaveis: '',
    resultado_padrao: 'Elegível ao Crédito',
    evidencia_minima: 'XML + Documento Fiscal',
    base_legal: 'LC 214/2025'
  });

  // ── TAB 3.5: RETENCOES SERVICOS STATE ─────────────────────
  const [regrasRetencao, setRegrasRetencao] = useState<any[]>([]);
  const [searchTermRetencao, setSearchTermRetencao] = useState('');
  const [loadingRetencoes, setLoadingRetencoes] = useState(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [showModalRegraRetencao, setShowModalRegraRetencao] = useState(false);
  const [editingRegraRetencao, setEditingRegraRetencao] = useState<any | null>(null);
  const [regraRetencaoForm, setRegraRetencaoForm] = useState<any>({
    item_lc116: '', descricao_item: '', nbs: '', descricao_nbs: '',
    ps_onerosa: true, adq_exterior: false, indop: '', local_incidencia_ibs: '',
    cclasstrib: '', nome_cclasstrib: '', irrf: '', csrf: '', inss: '', iss: '',
    cosirf_orgaos_publicos: '', fundamentos_legais: '', tipo_operacao: '',
    caracteristica_fornecimento: '', local_fornecimento: '', dispositivo_legal_lc214: '',
    observacao: '', indnfe: '', indnfse: ''
  });

  const loadRetencoes = async () => {
    setLoadingRetencoes(true);
    try {
      const res = await get<{ success: boolean; data: any[] }>('/tables/regras-retencao-servicos');
      if (res?.ok && res?.data?.data && Array.isArray(res.data.data)) {
        setRegrasRetencao(res.data.data);
      } else if (res?.ok && Array.isArray(res?.data)) {
        setRegrasRetencao(res.data as any);
      } else {
        console.warn('Não foi possível carregar regras de retenção:', res?.error);
      }
    } catch (e) {
      console.error('Erro ao carregar retenções do servidor:', e);
    }
    setLoadingRetencoes(false);
  };

  const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsUploadingCSV(true);
    try {
      // 1. Ler o arquivo no navegador usando XLSX
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][];

      if (rawData.length < 2) {
        alert('Arquivo parece estar vazio ou sem cabeçalhos.');
        setIsUploadingCSV(false);
        return;
      }

      const fixEncoding = (val: any): string => {
        if (val === undefined || val === null) return '';
        let str = String(val).trim();
        if (!str) return '';
        try {
          if (/[\u00C2\u00C3]/.test(str)) {
            const latin1Bytes = new Uint8Array([...str].map(c => c.charCodeAt(0) & 0xff));
            const decodedUtf8 = new TextDecoder('utf-8').decode(latin1Bytes);
            if (!decodedUtf8.includes('\uFFFD')) str = decodedUtf8;
          }
        } catch (_) {}
        return str.replace(/\u00A0/g, ' ').trim();
      };

      // 2. Montar os registros conforme a estrutura do arquivo
      const records: any[] = [];
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        const hasValue = row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
        if (!hasValue) continue;
        const getStr = (idx: number) => fixEncoding(row[idx]);
        records.push({
          item_lc116: getStr(0),
          descricao_item: getStr(1),
          nbs: getStr(2),
          descricao_nbs: getStr(3),
          ps_onerosa: getStr(4).toUpperCase() === 'S',
          adq_exterior: getStr(5).toUpperCase() === 'S',
          cclasstrib: getStr(6),
          nome_cclasstrib: getStr(7),
          irrf: getStr(8),
          csrf: getStr(9),
          inss: getStr(10),
          iss: getStr(11),
          cosirf_orgaos_publicos: getStr(12),
          fundamentos_legais: getStr(13),
          indop: getStr(14),
          local_incidencia_ibs: getStr(15),
          tipo_operacao: getStr(16),
          caracteristica_fornecimento: getStr(17),
          local_fornecimento: getStr(18),
          dispositivo_legal_lc214: getStr(19),
          observacao: getStr(20),
          indnfe: getStr(21),
          indnfse: getStr(22),
        });
      }

      if (records.length === 0) {
        alert('Nenhum registro válido encontrado no arquivo.');
        setIsUploadingCSV(false);
        return;
      }

      // 3. Gravar via API backend com validação completa
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadFile<{ success: boolean; message: string }>('/tables/regras-retencao-servicos/upload', formData);
      if (res.ok && res.data?.success) {
        showSuccess(res.data.message || `Importadas ${records.length} regras via API com sucesso!`);
        loadRetencoes();
      } else {
        alert(res.error || (res.data as any)?.message || 'Erro ao importar arquivo no servidor.');
      }
    } catch (err: any) {
      console.error('Falha crítica ao processar arquivo:', err);
      alert(`Falha ao processar o arquivo:\n${err.message || 'Erro desconhecido.'}`);
    }
    setIsUploadingCSV(false);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleOpenNewRegraRetencao = () => {
    setEditingRegraRetencao(null);
    setRegraRetencaoForm({
      item_lc116: '', descricao_item: '', nbs: '', descricao_nbs: '',
      ps_onerosa: true, adq_exterior: false, indop: '', local_incidencia_ibs: '',
      cclasstrib: '', nome_cclasstrib: '', irrf: '', csrf: '', inss: '', iss: '',
      cosirf_orgaos_publicos: '', fundamentos_legais: '', tipo_operacao: '',
      caracteristica_fornecimento: '', local_fornecimento: '', dispositivo_legal_lc214: '',
      observacao: '', indnfe: '', indnfse: ''
    });
    setShowModalRegraRetencao(true);
  };

  const handleEditRegraRetencao = (item: any) => {
    setEditingRegraRetencao(item);
    setRegraRetencaoForm({ ...item, ps_onerosa: item.ps_onerosa === 1, adq_exterior: item.adq_exterior === 1 });
    setShowModalRegraRetencao(true);
  };

  const handleSaveRegraRetencao = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: editingRegraRetencao?.id,
      ...regraRetencaoForm
    };
    
    let res;
    if (payload.id) {
      res = await put(`/tables/regras-retencao-servicos/${payload.id}`, payload);
    } else {
      res = await post('/tables/regras-retencao-servicos', payload);
    }

    if (res?.ok && (res?.data?.success || res.status === 200 || res.status === 201)) {
      showSuccess(payload.id ? 'Regra atualizada com sucesso!' : 'Regra criada com sucesso!');
      setShowModalRegraRetencao(false);
      loadRetencoes();
    } else {
      alert(res?.error || res?.data?.message || 'Erro ao salvar regra no servidor.');
    }
  };

  const handleDeleteRegraRetencao = async (id: string) => {
    if (confirm('Deseja realmente excluir esta regra de retenção?')) {
      const res = await del(`/tables/regras-retencao-servicos/${id}`);
      if (res?.ok && (res?.data?.success || res.status === 200)) {
        showSuccess('Regra excluída com sucesso!');
        loadRetencoes();
      } else {
        alert(res?.error || res?.data?.message || 'Erro ao excluir regra no servidor.');
      }
    }
  };

  // ── LOAD ALL DATA ────────────────────────────────────────
  const reloadData = async () => {
    setLoading(true);
    try {
      const [resAdVal, resAdRem, resNcm, resClass, resCfop, resRegras, resInfer, resSimples, resPresumido, resEncargos, resIndOper] = await Promise.all([
        get<{ success: boolean; data: AliquotaTabelaItem[] }>('/tables/aliquotas/ad-valorem'),
        get<{ success: boolean; data: AliquotaTabelaItem[] }>('/tables/aliquotas/ad-rem'),
        get<{ success: boolean; data: NcmRegraAnexoItem[] }>('/tables/anexos-ncm'),
        get<{ success: boolean; data: CClassRule[] }>('/tables/cclasstrib'),
        get<{ success: boolean; data: CfopRule[] }>('/tables/cfop'),
        get<{ success: boolean; data: RegraElegibilidade[] }>('/tables/regras'),
        get<{ success: boolean; data: InferenciaParamItem[] }>('/tables/inferencia'),
        get<{ success: boolean; faixas: SimplesNacionalFaixaItem[]; partilhas: SimplesNacionalPartilhaItem[] }>('/tables/simples-nacional'),
        get<{ success: boolean; data: LucroPresumidoParamItem[] }>('/tables/lucro-presumido'),
        get<{ success: boolean; data: EncargoPatronalParamItem[] }>('/tables/encargos-patronais'),
        get<{ success: boolean; data: IndOperItem[] }>('/tables/indoper')
      ]);

      if (resAdVal.ok && resAdVal.data?.data) setAdValoremList(resAdVal.data.data);
      if (resAdRem.ok && resAdRem.data?.data) setAdRemList(resAdRem.data.data);
      if (resNcm.ok && resNcm.data?.data) setNcmList(resNcm.data.data);
      if (resClass.ok && resClass.data?.data) setCClassRules(resClass.data.data);
      if (resCfop.ok && resCfop.data?.data) setCfopRules(resCfop.data.data);
      if (resRegras.ok && resRegras.data?.data) setRegras(resRegras.data.data);
      if (resInfer.ok && resInfer.data?.data) setInferenciaList(resInfer.data.data);
      if (resSimples.ok && resSimples.data) {
        if (resSimples.data.faixas) setFaixasSimples(resSimples.data.faixas);
        if (resSimples.data.partilhas) setPartilhasSimples(resSimples.data.partilhas);
      }
      if (resPresumido.ok && resPresumido.data?.data) setLucroPresumidoList(resPresumido.data.data);
      if (resEncargos.ok && resEncargos.data?.data) setEncargosList(resEncargos.data.data);
      if (resIndOper?.ok && resIndOper.data?.data) setIndOperList(resIndOper.data.data);
    } catch (err) {
      console.error('Erro ao recarregar tabelas fiscais:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── SIMPLES NACIONAL HANDLERS ────────────────────────────
  const handleEditFaixaSimples = (item: SimplesNacionalFaixaItem) => {
    setEditingFaixaSimples(item);
    setFaixaSimplesForm({
      id: item.id || '',
      anexo: item.anexo,
      nome_anexo: item.nome_anexo,
      faixa: item.faixa,
      limite_superior: Number(item.limite_superior),
      aliq_nominal: Number(item.aliq_nominal),
      deducao: Number(item.deducao),
      reparticao_irpj: Number(item.reparticao_irpj),
      reparticao_csll: Number(item.reparticao_csll),
      reparticao_cofins: Number(item.reparticao_cofins),
      reparticao_pis: Number(item.reparticao_pis),
      reparticao_cpp: Number(item.reparticao_cpp),
      reparticao_icms: Number(item.reparticao_icms),
      reparticao_iss: Number(item.reparticao_iss),
      reparticao_ipi: Number(item.reparticao_ipi)
    });
    setShowModalFaixaSimples(true);
  };

  const handleSaveFaixaSimples = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await post('/tables/simples-nacional/faixa', faixaSimplesForm);
    if (res.ok) {
      showSuccess(`Faixa ${faixaSimplesForm.faixa} (${faixaSimplesForm.nome_anexo}) atualizada com sucesso!`);
      setShowModalFaixaSimples(false);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao gravar faixa do Simples Nacional');
    }
  };

  // ── LUCRO PRESUMIDO & ENCARGOS HANDLERS ──────────────────
  const handleEditLucroPresumido = (item: LucroPresumidoParamItem) => {
    setEditingLucroPresumido(item);
    setLucroPresumidoForm({
      id: item.id || '',
      codigo_atividade: item.codigo_atividade,
      nome_atividade: item.nome_atividade,
      presuncao_irpj: Number(item.presuncao_irpj),
      presuncao_csll: Number(item.presuncao_csll),
      aliq_irpj_basico: Number(item.aliq_irpj_basico),
      aliq_irpj_adicional: Number(item.aliq_irpj_adicional),
      limite_mensal_adicional: Number(item.limite_mensal_adicional),
      aliq_csll: Number(item.aliq_csll),
      artigo_legal: item.artigo_legal || '',
      detalhe: item.detalhe || '',
      categoria: item.categoria || 'servicos',
      anexo_simples_padrao: item.anexo_simples_padrao || 'anexo1'
    });
    setShowModalLucroPresumido(true);
  };

  const handleSaveLucroPresumido = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await post('/tables/lucro-presumido', lucroPresumidoForm);
    if (res.ok) {
      showSuccess(`Parâmetros de Lucro Presumido para "${lucroPresumidoForm.nome_atividade}" salvos com sucesso!`);
      setShowModalLucroPresumido(false);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao gravar parâmetros do Lucro Presumido');
    }
  };

  const handleEditEncargo = (item: EncargoPatronalParamItem) => {
    setEditingEncargo(item);
    setEncargoForm({
      id: item.id || '',
      codigo_atividade: item.codigo_atividade,
      nome_ramo: item.nome_ramo,
      inss_patronal: Number(item.inss_patronal),
      rat_fap: Number(item.rat_fap),
      sistema_s: Number(item.sistema_s),
      entidades_descricao: item.entidades_descricao || ''
    });
    setShowModalEncargo(true);
  };

  const handleSaveEncargo = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await post('/tables/encargos-patronais', encargoForm);
    if (res.ok) {
      showSuccess(`Encargos patronais para "${encargoForm.nome_ramo}" salvos com sucesso!`);
      setShowModalEncargo(false);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao gravar encargos patronais');
    }
  };

  useEffect(() => {
    reloadData();
    loadRetencoes();
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

  // ── INDOPER HANDLERS ─────────────────────────────────────
  const handleSaveIndOper = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await post('/tables/indoper', indOperForm);
    if (res.ok) {
      showSuccess('Indicador indOper salvo com sucesso!');
      setShowAddIndOper(false);
      setEditingIndOper(null);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao salvar indOper');
    }
  };

  // ── CCLASSTRIB HANDLERS ──────────────────────────────────
  const handleSaveCClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: editingCClass?.id,
      cclasstrib: newCode,
      descricao_interna: newDesc,
      tratamento_esperado: newTratamento,
      permite_credito: newCredito,
      aliquota_esperada: newAliquota
    };
    const res = await post('/tables/cclasstrib', payload);
    if (res.ok) {
      showSuccess('cClassTrib salvo com sucesso!');
      setShowAddCClass(false);
      setEditingCClass(null);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao salvar cClassTrib');
    }
  };

  // ── CFOP HANDLERS ────────────────────────────────────────
  const handleSaveCfop = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: editingCfop?.id,
      cfop: newCfopCode,
      descricao: newCfopDesc,
      categoria: newCfopCat,
      tratamento_padrao: newCfopTrat,
      exige_onerosidade: newCfopOneroso ? 1 : 0,
      evidencia_minima: newCfopEvidencia
    };
    const res = await post('/tables/cfop', payload);
    if (res.ok) {
      showSuccess('Regra de CFOP salva com sucesso!');
      setShowAddCfop(false);
      setEditingCfop(null);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao salvar regra de CFOP');
    }
  };

  // ── REGRAS ELEGIBILIDADE HANDLERS ────────────────────────
  const handleSaveRegra = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: editingRegra?.id,
      ...regraForm
    };
    const res = await post('/tables/regras', payload);
    if (res.ok) {
      showSuccess('Regra de elegibilidade salva com sucesso!');
      setShowAddRegra(false);
      setEditingRegra(null);
      await reloadData();
    } else {
      alert(res.error || 'Erro ao salvar regra de elegibilidade');
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

      {/* PAINEL DE GOVERNANÇA E CLASSIFICAÇÃO DE ALÍQUOTAS (CATEGORIAS A, B E C) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/70 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Governança & Parâmetros Fiscais
              </span>
            </div>
            <h2 className="text-base font-bold text-white mt-1.5 flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-400" />
              Matriz Parametrizada de Alíquotas & Governança Fiscal
            </h2>
          </div>

          <button
            onClick={() => setShowCategoriasGuide(!showCategoriasGuide)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition shrink-0 self-start md:self-center cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>{showCategoriasGuide ? 'Ocultar Classificação' : 'Entenda as Categorias (A, B e C)'}</span>
            {showCategoriasGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showCategoriasGuide && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-4 border-t border-slate-800 animate-in fade-in duration-200">
            {/* Categoria A */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-blue-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Categoria A
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Oficiais RFB</span>
              </div>
              <h4 className="text-xs font-bold text-white">Tabelas Oficiais da Lei / RFB</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tabelas de alíquotas de referência Ad Valorem e Ad Rem da Reforma Tributária (LC 214/2025, EC 132/2023) por ano de transição (2026 a 2033), além dos Anexos Oficiais de NCMs com alíquota zero (Cesta Básica Nacional) ou redução de 60%.
              </p>
            </div>

            {/* Categoria B */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-emerald-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Categoria B
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Motores de Cálculo</span>
              </div>
              <h4 className="text-xs font-bold text-white">Parâmetros Operacionais e Equações</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tabelas editáveis que governam os cálculos: faixas e partilhas do Simples Nacional (LC 123/06), presunções e limites do Lucro Presumido (Lei 9.249/95), encargos patronais (Lei 8.212/91), regras de elegibilidade e inferência de alíquotas médias. Operam <strong>sem fallback</strong>.
              </p>
            </div>

            {/* Categoria C */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-purple-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Categoria C
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Informativas & Rótulos</span>
              </div>
              <h4 className="text-xs font-bold text-white">Tabelas Informativas, Rótulos e Colunas</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Matriz de Retenções de Serviços (NFS-e), Enquadramentos cClassTrib (6D) e Matriz CFOP. Servem para classificação visual, auditoria e conciliação em relatórios e DANFE, sem embutir alíquotas fixas no código.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Module Tabs Selector */}
      <div className="flex flex-wrap items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 gap-1.5 shadow-xl">
        <button
          onClick={() => setActiveTab('ad_valorem')}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ad_valorem'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Percent className="w-4 h-4 text-cyan-400" />
          <span>Alíquota Ad Valorem (%)</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">Cat. A & B</span>
        </button>

        <button
          onClick={() => setActiveTab('ad_rem')}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ad_rem'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Scale className="w-4 h-4 text-amber-300" />
          <span>Alíquota Ad Rem (Valor R$)</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">Cat. A & B</span>
        </button>

        <button
          onClick={() => setActiveTab('anexos_ncm')}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'anexos_ncm'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-300" />
          <span>Anexos da Lei & NCMs ({ncmList.length})</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">Cat. A & B</span>
        </button>

        <button
          onClick={() => setActiveTab('retencoes_servicos')}
          className={`flex-1 min-w-[180px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'retencoes_servicos'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Receipt className="w-4 h-4 text-amber-300" />
          <span>Retenções de Serviços (NFS-e)</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">Cat. C</span>
        </button>

        <button
          onClick={() => setActiveTab('simples_nacional')}
          className={`flex-1 min-w-[180px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'simples_nacional'
              ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-300" />
          <span>Simples Nacional (LC 123)</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">Cat. B</span>
        </button>

        <button
          onClick={() => setActiveTab('lucro_presumido')}
          className={`flex-1 min-w-[190px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'lucro_presumido'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Briefcase className="w-4 h-4 text-cyan-300" />
          <span>Lucro Presumido & Encargos</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">Cat. B</span>
        </button>

        <button
          onClick={() => setActiveTab('cclasstrib')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'cclasstrib'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>cClassTrib ({cClassRules.length})</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">Cat. C</span>
        </button>

        <button
          onClick={() => setActiveTab('indoper')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'indoper'
              ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>indOper Destino ({indOperList.length})</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">Cat. C</span>
        </button>

        <button
          onClick={() => setActiveTab('cfop')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'cfop'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Matriz CFOP ({cfopRules.length})</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">Cat. C</span>
        </button>

        <button
          onClick={() => setActiveTab('regras')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'regras'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Elegibilidade ({regras.length})</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">Cat. C</span>
        </button>


        <button
          onClick={() => setActiveTab('inferencia')}
          className={`flex-1 min-w-[180px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'inferencia'
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-violet-400" />
          <span>Inferência Simulador ({inferenciaList.length})</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono">Cat. B</span>
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
          </div>

          <UniversalTableActions
            endpoint="aliquotas/ad-valorem"
            baseFilename="Aliquotas_Ad_Valorem"
            onUploadSuccess={reloadData}
            onAddNew={handleOpenNewAdValorem}
            addNewLabel="Nova Vigência Ad Valorem"
          />

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
          </div>

          <UniversalTableActions
            endpoint="aliquotas/ad-rem"
            baseFilename="Aliquotas_Ad_Rem"
            onUploadSuccess={reloadData}
            onAddNew={handleOpenNewAdRem}
            addNewLabel="Nova Vigência Ad Rem"
          />

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
          </div>

          <UniversalTableActions
            endpoint="anexos-ncm"
            baseFilename="Anexos_NCM_LC214_2025"
            onUploadSuccess={reloadData}
            onAddNew={handleOpenNewNcm}
            addNewLabel="Novo NCM / Anexo"
            searchPlaceholder="Buscar por NCM, descrição ou cClassTrib..."
            searchTerm={ncmSearch}
            onSearchChange={setNcmSearch}
          />

          {/* Filtro por Tipo */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3">

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
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-400" />
                  Matriz de Retenções na Fonte em Serviços (NFS-e) & Fundamentação Legal
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {regrasRetencao.length} Regras Cadastradas
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Regras tributárias parametrizadas para auditoria automática (IRRF, CSLL, PIS, COFINS, INSS e ISS) conforme LC 116/03, LC 214 e normativos federais.
              </p>
            </div>
          </div>

          <UniversalTableActions
            endpoint="regras-retencao-servicos"
            baseFilename="Regras_Retencao_Servicos_LC116_LC214"
            onUploadSuccess={loadRetencoes}
            onAddNew={handleOpenNewRegraRetencao}
            addNewLabel="Nova Regra"
            searchPlaceholder="Buscar por código LC 116, NBS ou descrição..."
            searchTerm={searchTermRetencao}
            onSearchChange={setSearchTermRetencao}
          />

          <div className="overflow-x-auto rounded-xl border border-slate-800 pb-2">
            <table className="w-max min-w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Item LC116</th>
                  <th className="py-3 px-4 min-w-[200px]">Descrição Serviço (LC116)</th>
                  <th className="py-3 px-4 whitespace-nowrap">NBS</th>
                  <th className="py-3 px-4 whitespace-nowrap text-center">Onerosa?</th>
                  <th className="py-3 px-4 whitespace-nowrap">IndOp</th>
                  <th className="py-3 px-4 whitespace-nowrap text-emerald-400">cClassTrib</th>
                  <th className="py-3 px-4 whitespace-nowrap text-red-400">IRRF</th>
                  <th className="py-3 px-4 whitespace-nowrap text-rose-400">CSRF</th>
                  <th className="py-3 px-4 whitespace-nowrap text-indigo-400">INSS</th>
                  <th className="py-3 px-4 whitespace-nowrap text-cyan-400">ISS</th>
                  <th className="py-3 px-4 min-w-[300px]">Fundamentos Legais</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loadingRetencoes ? (
                  <tr><td colSpan={12} className="py-8 text-center text-slate-500">Carregando regras...</td></tr>
                ) : regrasRetencao.length === 0 ? (
                  <tr><td colSpan={12} className="py-8 text-center text-slate-500">Nenhuma regra encontrada. Importe um arquivo JSON ou XLSX.</td></tr>
                ) : regrasRetencao
                  .filter((regra) => {
                    if (!searchTermRetencao) return true;
                    const s = searchTermRetencao.toLowerCase();
                    return (
                      (regra.item_lc116 && String(regra.item_lc116).toLowerCase().includes(s)) ||
                      (regra.descricao_item && String(regra.descricao_item).toLowerCase().includes(s)) ||
                      (regra.nbs && String(regra.nbs).toLowerCase().includes(s)) ||
                      (regra.cclasstrib && String(regra.cclasstrib).toLowerCase().includes(s))
                    );
                  })
                  .map((regra) => (
                  <tr key={regra.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">{regra.item_lc116}</td>
                    <td className="py-2.5 px-4 text-slate-200 text-[11px] truncate max-w-[250px]" title={regra.descricao_item}>{regra.descricao_item}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-200 whitespace-nowrap">{regra.nbs}</td>
                    <td className="py-2.5 px-4 text-center font-bold">{regra.ps_onerosa ? <span className="text-emerald-400">S</span> : <span className="text-slate-500">N</span>}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px]">{regra.indop}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">{regra.cclasstrib}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-red-400">{regra.irrf || '-'}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-rose-400">{regra.csrf || '-'}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-400">{regra.inss || '-'}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-cyan-400">{regra.iss || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-400 text-[10px] truncate max-w-[300px]" title={regra.fundamentos_legais}>{regra.fundamentos_legais}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditRegraRetencao(regra)}
                          className="p-1.5 bg-slate-800 hover:bg-cyan-900/50 text-slate-400 hover:text-cyan-400 rounded-lg transition-colors border border-slate-700 hover:border-cyan-800 cursor-pointer"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRegraRetencao(regra.id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 rounded-lg transition-colors border border-slate-700 hover:border-rose-800 cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
          TAB 4: cClassTrib Rules
      ═══════════════════════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════════
          TAB 4: cClassTrib Rules
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'cclasstrib' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          {/* Header Oficial SEFAZ / SVRS */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 border border-purple-800/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Table className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-300 text-sm">Classificação Tributária cClassTrib & CST (Reforma Tributária RTC)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {cClassRules.length} Enquadramentos Oficiais SEFAZ/SVRS
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tabela oficial unificada conforme Lei Complementar 214/2025. Combustíveis enquadrados estritamente no CST 620 (Monofásica) e cClassTrib 620001–620007.
                </p>
              </div>
            </div>
            <a
              href="https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributaria"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-xs font-bold border border-cyan-800/80 transition-colors shadow-sm cursor-pointer"
            >
              <span>Portal da Conformidade Fácil (SVRS)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <UniversalTableActions
            endpoint="cclasstrib"
            baseFilename="Tabela_Oficial_cClassTrib_SVRS"
            onUploadSuccess={reloadData}
            onAddNew={() => setShowAddCClass(true)}
            addNewLabel="Novo cClassTrib"
            searchPlaceholder="Filtrar por cClassTrib ou descrição..."
            searchTerm={searchTermCClass}
            onSearchChange={setSearchTermCClass}
          />

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
                        <button onClick={() => setEditingCClass(rule)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-cyan-400 cursor-pointer" title="Editar">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Deseja excluir o cClassTrib ${rule.cclasstrib}?`)) return;
                            const res = await del(`/tables/cclasstrib/${rule.id || rule.cclasstrib}`);
                            if (res.ok) {
                              showSuccess('cClassTrib excluído com sucesso!');
                              reloadData();
                            } else {
                              alert('Erro ao excluir: ' + res.error);
                            }
                          }}
                          className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-red-400 cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
          TAB: indOper (Local da Operação / Princípio do Destino - LC 214)
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'indoper' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="p-4 rounded-xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-950 border border-teal-800/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-teal-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-teal-300 text-sm">
                    Tabela Oficial SEFAZ / SVRS — Indicadores de Operação (indOper)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {indOperList.length} Códigos Oficiais (Art. 11/12 da LC 214/2025)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Determina o local de incidência do IBS e CBS com base no Princípio do Destino, caracterizando onde o tributo é devido e partilhado entre os entes federativos.
                </p>
              </div>
            </div>
            <a
              href="https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributaria"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-xs font-bold border border-cyan-800/80 transition-colors shadow-sm cursor-pointer"
            >
              <span>Portal da Conformidade Fácil (SVRS)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <UniversalTableActions
            endpoint="indoper"
            baseFilename="Tabela_Oficial_indOper_SVRS"
            onUploadSuccess={reloadData}
            onAddNew={() => {
              setEditingIndOper(null);
              setIndOperForm({
                id: '',
                codigo: '',
                nome: '',
                dispositivo_legal: 'Art. 11 da LC 214/2025',
                local: 'Estabelecimento fornecedor',
                local_fornecedor: '',
                caracteristica: '',
                data_publicacao: '17/11/2025',
                inicio_vigencia: '17/11/2025',
                fim_vigencia: '-'
              });
              setShowAddIndOper(true);
            }}
            addNewLabel="Novo indOper"
            searchPlaceholder="Buscar por código, nome, local ou dispositivo..."
            searchTerm={searchTermIndOper}
            onSearchChange={setSearchTermIndOper}
          />

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Nome / Descrição da Operação</th>
                  <th className="py-3 px-4">Dispositivo Legal</th>
                  <th className="py-3 px-4">Local de Incidência</th>
                  <th className="py-3 px-4">Vigência</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {indOperList
                  .filter(item => {
                    if (!searchTermIndOper) return true;
                    const s = searchTermIndOper.toLowerCase();
                    return (
                      item.codigo.toLowerCase().includes(s) ||
                      item.nome.toLowerCase().includes(s) ||
                      (item.local && item.local.toLowerCase().includes(s)) ||
                      (item.dispositivo_legal && item.dispositivo_legal.toLowerCase().includes(s))
                    );
                  })
                  .map((item) => (
                    <tr key={item.id || item.codigo} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-cyan-400">{item.codigo}</td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-200 max-w-sm">{item.nome}</td>
                      <td className="py-3 px-4 font-sans text-slate-400">{item.dispositivo_legal}</td>
                      <td className="py-3 px-4 font-sans text-slate-300">{item.local}</td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">{item.inicio_vigencia || '17/11/2025'}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingIndOper(item);
                              setIndOperForm({
                                id: item.id,
                                codigo: item.codigo,
                                nome: item.nome,
                                dispositivo_legal: item.dispositivo_legal,
                                local: item.local,
                                local_fornecedor: item.local_fornecedor || '',
                                caracteristica: item.caracteristica || '',
                                data_publicacao: item.data_publicacao || '17/11/2025',
                                inicio_vigencia: item.inicio_vigencia || '17/11/2025',
                                fim_vigencia: item.fim_vigencia || '-'
                              });
                              setShowAddIndOper(true);
                            }}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-cyan-400 cursor-pointer"
                            title="Editar indOper"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Deseja excluir o código indOper ${item.codigo}?`)) return;
                              const res = await del(`/tables/indoper/${item.id || item.codigo}`);
                              if (res.ok) {
                                showSuccess('Código indOper excluído com sucesso!');
                                reloadData();
                              } else {
                                alert('Erro ao excluir: ' + res.error);
                              }
                            }}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-red-400 cursor-pointer"
                            title="Excluir indOper"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
          </div>

          <UniversalTableActions
            endpoint="cfop"
            baseFilename="Tabela_Matriz_CFOP"
            onUploadSuccess={reloadData}
            onAddNew={() => {
              setEditingCfop(null);
              setNewCfopCode('');
              setNewCfopDesc('');
              setNewCfopCat('Compra');
              setNewCfopTrat('Elegível');
              setNewCfopOneroso(true);
              setNewCfopEvidencia('');
              setShowAddCfop(true);
            }}
            addNewLabel="Novo CFOP"
            searchPlaceholder="Filtrar por CFOP ou descrição..."
            searchTerm={searchTermCfop}
            onSearchChange={setSearchTermCfop}
          />

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
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cfopRules
                  .filter(rule => {
                    if (!searchTermCfop) return true;
                    const s = searchTermCfop.toLowerCase();
                    return rule.cfop.toLowerCase().includes(s) || rule.descricao.toLowerCase().includes(s) || rule.categoria.toLowerCase().includes(s);
                  })
                  .map((rule) => (
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
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingCfop(rule);
                              setNewCfopCode(rule.cfop);
                              setNewCfopDesc(rule.descricao);
                              setNewCfopCat(rule.categoria);
                              setNewCfopTrat(rule.tratamento_padrao);
                              setNewCfopOneroso(rule.exige_onerosidade);
                              setNewCfopEvidencia(rule.evidencia_minima || '');
                              setShowAddCfop(true);
                            }}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-indigo-400 cursor-pointer"
                            title="Editar CFOP"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Deseja excluir o CFOP ${rule.cfop}?`)) return;
                              const res = await del(`/tables/cfop/${rule.id || rule.cfop}`);
                              if (res.ok) {
                                showSuccess('CFOP excluído com sucesso!');
                                reloadData();
                              } else {
                                alert('Erro ao excluir CFOP: ' + res.error);
                              }
                            }}
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-red-400 cursor-pointer"
                            title="Excluir CFOP"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
          TAB 6: REGRAS DE ELEGIBILIDADE
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'regras' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              Regras de Elegibilidade de Crédito da Reforma Tributária (LC 214/2025)
            </h3>
          </div>

          <UniversalTableActions
            endpoint="regras"
            baseFilename="Tabela_Regras_Elegibilidade"
            onUploadSuccess={reloadData}
            onAddNew={() => {
              setEditingRegra(null);
              setRegraForm({
                codigo_regra: '',
                nome: '',
                descricao: '',
                tipo_aquisicao: 'Insumo Operacional',
                cfops_aplicaveis: '',
                resultado_padrao: 'Elegível ao Crédito',
                evidencia_minima: 'XML + Documento Fiscal',
                base_legal: 'LC 214/2025'
              });
              setShowAddRegra(true);
            }}
            addNewLabel="Nova Regra"
            searchPlaceholder="Filtrar regras por código, nome ou CFOPs..."
            searchTerm={searchTermRegras}
            onSearchChange={setSearchTermRegras}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {regras
              .filter(r => {
                if (!searchTermRegras) return true;
                const s = searchTermRegras.toLowerCase();
                return r.codigo_regra.toLowerCase().includes(s) || r.nome.toLowerCase().includes(s) || (r.cfops_aplicaveis && r.cfops_aplicaveis.toLowerCase().includes(s));
              })
              .map((r) => (
                <div key={r.id || r.codigo_regra} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-teal-400">{r.codigo_regra}</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                        {r.resultado_padrao}
                      </span>
                      <button
                        onClick={() => {
                          setEditingRegra(r);
                          setRegraForm({
                            codigo_regra: r.codigo_regra,
                            nome: r.nome,
                            descricao: r.descricao,
                            tipo_aquisicao: r.tipo_aquisicao || 'Insumo Operacional',
                            cfops_aplicaveis: r.cfops_aplicaveis || '',
                            resultado_padrao: r.resultado_padrao || 'Elegível ao Crédito',
                            evidencia_minima: r.evidencia_minima || 'XML + Documento Fiscal',
                            base_legal: r.base_legal || 'LC 214/2025'
                          });
                          setShowAddRegra(true);
                        }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-teal-400 cursor-pointer"
                        title="Editar Regra"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Deseja excluir a regra ${r.codigo_regra}?`)) return;
                          const res = await del(`/tables/regras/${r.id || r.codigo_regra}`);
                          if (res.ok) {
                            showSuccess('Regra excluída com sucesso!');
                            reloadData();
                          } else {
                            alert('Erro ao excluir regra: ' + res.error);
                          }
                        }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 cursor-pointer"
                        title="Excluir Regra"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-violet-400" />
              Parâmetros de Inferência — Alíquotas Médias do Simulador
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
              Alíquotas médias de ICMS, PIS, COFINS, IPI e ISS aplicadas exclusivamente pelo <strong>Simulador Comparativo de Transição</strong> da Central de KPIs quando os XMLs não discriminam os tributos (ex: Simples Nacional CRT 1/4 e CT-e sem PIS/COFINS). Os relatórios e dados do XML continuam refletindo <strong>estritamente</strong> os valores originais.
            </p>
          </div>

          <UniversalTableActions
            endpoint="inferencia"
            baseFilename="Tabela_Parametros_Inferencia"
            onUploadSuccess={reloadData}
            onAddNew={handleOpenNewInferencia}
            addNewLabel="Novo Parâmetro de Inferência"
          />

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
          TAB: SIMPLES NACIONAL (LC 123/2006 & REFORMA LC 214)
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'simples_nacional' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                Tabelas Oficiais do Simples Nacional (LC nº 123/2006 & LC nº 214/2025)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Alíquotas nominais, parcelas a deduzir e repartição dos tributos (IRPJ, CSLL, PIS, COFINS, CPP, ICMS, ISS e IPI).
              </p>
            </div>

            <button
              onClick={() => setShowPartilhaReforma(!showPartilhaReforma)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                showPartilhaReforma
                  ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/30'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span>{showPartilhaReforma ? 'Ocultar Transição LC 214' : 'Ver Transição LC 214 (2027-2033)'}</span>
            </button>
          </div>

          <UniversalTableActions
            endpoint="simples-nacional"
            baseFilename="Tabela_Simples_Nacional"
            onUploadSuccess={reloadData}
          />

          {/* Anexo Pills Selector */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { id: 'anexo1', label: 'Anexo I • Comércio' },
              { id: 'anexo2', label: 'Anexo II • Indústria' },
              { id: 'anexo3', label: 'Anexo III • Serviços Gerais' },
              { id: 'anexo4', label: 'Anexo IV • Construção/Limpeza (Sem CPP)' },
              { id: 'anexo5', label: 'Anexo V • Serviços (Fator R)' },
              { id: 'transporte_cargas', label: 'Transporte de Cargas (Art. 18 § 5º-E)' }
            ].map(anx => (
              <button
                key={anx.id}
                onClick={() => setSelectedAnexoSimples(anx.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedAnexoSimples === anx.id
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/40'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {anx.label}
              </button>
            ))}
          </div>

          {/* Tabela de Faixas */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3 text-center">Faixa</th>
                  <th className="py-3 px-3">Limite RBT12</th>
                  <th className="py-3 px-3 text-right">Alíquota Nominal</th>
                  <th className="py-3 px-3 text-right">Parcela a Deduzir</th>
                  <th className="py-3 px-2 text-right">IRPJ</th>
                  <th className="py-3 px-2 text-right">CSLL</th>
                  <th className="py-3 px-2 text-right">COFINS</th>
                  <th className="py-3 px-2 text-right">PIS</th>
                  <th className="py-3 px-2 text-right">CPP</th>
                  <th className="py-3 px-2 text-right">ICMS</th>
                  <th className="py-3 px-2 text-right">ISS</th>
                  <th className="py-3 px-2 text-right">IPI</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {faixasSimples.filter(f => f.anexo === selectedAnexoSimples).length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-slate-500 font-sans">
                      Nenhuma faixa cadastrada para este anexo.
                    </td>
                  </tr>
                ) : (
                  faixasSimples
                    .filter(f => f.anexo === selectedAnexoSimples)
                    .sort((a, b) => a.faixa - b.faixa)
                    .map((item) => (
                      <tr key={item.id || `${item.anexo}-${item.faixa}`} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 text-center font-bold text-emerald-400">
                          {item.faixa}ª Faixa
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-200">
                          R$ {Number(item.limite_superior).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-cyan-300">
                          {(Number(item.aliq_nominal) * 100).toFixed(2)}%
                        </td>
                        <td className="py-3 px-3 text-right text-amber-300 font-bold">
                          R$ {Number(item.deducao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300">
                          {(Number(item.reparticao_irpj) * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300">
                          {(Number(item.reparticao_csll) * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300">
                          {(Number(item.reparticao_cofins) * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300">
                          {(Number(item.reparticao_pis) * 100).toFixed(1)}%
                        </td>
                        <td className={`py-3 px-2 text-right font-bold ${Number(item.reparticao_cpp) > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {(Number(item.reparticao_cpp) * 100).toFixed(1)}%
                        </td>
                        <td className={`py-3 px-2 text-right font-bold ${Number(item.reparticao_icms) > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
                          {(Number(item.reparticao_icms) * 100).toFixed(1)}%
                        </td>
                        <td className={`py-3 px-2 text-right font-bold ${Number(item.reparticao_iss) > 0 ? 'text-purple-400' : 'text-slate-600'}`}>
                          {(Number(item.reparticao_iss) * 100).toFixed(1)}%
                        </td>
                        <td className={`py-3 px-2 text-right font-bold ${Number(item.reparticao_ipi) > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                          {(Number(item.reparticao_ipi) * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-center font-sans">
                          <button
                            onClick={() => handleEditFaixaSimples(item)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Editar Parâmetros da Faixa"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          {/* Sub-tabela: Partilha Reforma 2027 a 2033 */}
          {showPartilhaReforma && (
            <div className="p-4 rounded-xl bg-slate-950 border border-purple-900/40 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Fração de Desoneração IBS & CBS no Simples Híbrido (LC nº 214/2025)
                </h4>
              </div>
              <p className="text-[11px] text-slate-400">
                Percentual do valor do DAS que é remanejado/desonerado quando a optante pelo Simples Nacional decide recolher IBS e CBS no regime regular (Não-Cumulativo) para transferir créditos integrais a clientes PJ.
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300 font-mono">
                  <thead className="bg-slate-900 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Ano Transição</th>
                      <th className="py-2.5 px-3 text-right">1ª Faixa</th>
                      <th className="py-2.5 px-3 text-right">2ª Faixa</th>
                      <th className="py-2.5 px-3 text-right">3ª Faixa</th>
                      <th className="py-2.5 px-3 text-right">4ª Faixa</th>
                      <th className="py-2.5 px-3 text-right">5ª Faixa</th>
                      <th className="py-2.5 px-3 text-right">6ª Faixa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-[11px]">
                    {[2027, 2029, 2030, 2031, 2032, 2033].map(ano => {
                      const parts = partilhasSimples.filter(p => p.anexo === selectedAnexoSimples && Number(p.ano_transicao) === ano).sort((a, b) => a.faixa - b.faixa);
                      return (
                        <tr key={ano} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-bold text-purple-400 font-sans">{ano}</td>
                          {[1, 2, 3, 4, 5, 6].map(fNum => {
                            const found = parts.find(p => p.faixa === fNum);
                            const val = found ? Number(found.perc_remanejado) : 0;
                            return (
                              <td key={fNum} className="py-2 px-3 text-right text-slate-200">
                                {(val * 100).toFixed(2)}%
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB: LUCRO PRESUMIDO & ENCARGOS PATRONAIS
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'lucro_presumido' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl animate-fade-in">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-cyan-400" />
              Lucro Presumido (Lei nº 9.249/1995) & Encargos Patronais (Lei nº 8.212/1991)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Coeficientes legais de presunção de lucro para IRPJ e CSLL por atividade econômica, limites do adicional e alíquotas de encargos previdenciários patronais (INSS 20%, RAT e Sistema S).
            </p>
          </div>

          <UniversalTableActions
            endpoint="lucro-presumido"
            baseFilename="Tabela_Lucro_Presumido"
            onUploadSuccess={reloadData}
            onAddNew={() => {
              setEditingLucroPresumido(null);
              setLucroPresumidoForm({
                codigo_atividade: '',
                nome_atividade: '',
                categoria: 'Serviços',
                presuncao_irpj: 0.32,
                presuncao_csll: 0.32,
                aliq_irpj_base: 0.15,
                aliq_irpj_adicional: 0.10,
                limite_adicional_mes: 20000,
                aliq_csll_base: 0.09,
                base_legal: 'Lei 9.249/1995, art. 15 e 20',
                detalhe: ''
              });
              setShowModalLucroPresumido(true);
            }}
            addNewLabel="Nova Atividade / Presunção"
          />

          {/* Seção 1: Atividades e Presunções */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Scale className="w-4 h-4 text-cyan-400" />
                1. Coeficientes de Presunção de Lucro (IRPJ & CSLL)
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">{lucroPresumidoList.length} Atividades Cadastradas</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Atividade Econômica</th>
                    <th className="py-3 px-3">Categoria</th>
                    <th className="py-3 px-3 text-right">Presunção IRPJ</th>
                    <th className="py-3 px-3 text-right">Presunção CSLL</th>
                    <th className="py-3 px-3 text-right">IRPJ Básico</th>
                    <th className="py-3 px-3 text-right">IRPJ Adicional</th>
                    <th className="py-3 px-3 text-right">CSLL Geral</th>
                    <th className="py-3 px-3">Base Legal</th>
                    <th className="py-3 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {lucroPresumidoList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                        Nenhum parâmetro de Lucro Presumido cadastrado.
                      </td>
                    </tr>
                  ) : (
                    lucroPresumidoList.map(item => (
                      <tr key={item.id || item.codigo_atividade} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-sans font-bold text-slate-200">
                          {item.nome_atividade}
                          {item.detalhe && (
                            <span className="block text-[10px] text-slate-500 font-normal">{item.detalhe}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {item.categoria}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-amber-300">
                          {(Number(item.presuncao_irpj) * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-cyan-300">
                          {(Number(item.presuncao_csll) * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-right text-slate-200">
                          {(Number(item.aliq_irpj_basico) * 100).toFixed(0)}%
                        </td>
                        <td className="py-3 px-3 text-right text-slate-200">
                          {(Number(item.aliq_irpj_adicional) * 100).toFixed(0)}%
                          <span className="block text-[9px] text-slate-500">&gt; R$20k/mês</span>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-200">
                          {(Number(item.aliq_csll) * 100).toFixed(0)}%
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-400 text-[10px] max-w-[150px] truncate" title={item.artigo_legal}>
                          {item.artigo_legal}
                        </td>
                        <td className="py-3 px-3 text-center font-sans">
                          <button
                            onClick={() => handleEditLucroPresumido(item)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seção 2: Encargos Patronais */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                2. Encargos Previdenciários Patronais sobre a Folha (Lei nº 8.212/1991)
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">{encargosList.length} Ramos Parametrizados</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Ramo / Setor de Atividade</th>
                    <th className="py-3 px-3 text-right">INSS Patronal</th>
                    <th className="py-3 px-3 text-right">RAT / FAP</th>
                    <th className="py-3 px-3 text-right">Sistema S (Terceiros)</th>
                    <th className="py-3 px-3 text-right">Carga Total Patronal</th>
                    <th className="py-3 px-3">Entidades / Fundamentação</th>
                    <th className="py-3 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {encargosList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                        Nenhum encargo cadastrado.
                      </td>
                    </tr>
                  ) : (
                    encargosList.map(item => {
                      const totalPatronal = Number(item.inss_patronal) + Number(item.rat_fap) + Number(item.sistema_s);
                      return (
                        <tr key={item.id || item.codigo_atividade} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-sans font-bold text-slate-200">
                            {item.nome_ramo}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-200">
                            {(Number(item.inss_patronal) * 100).toFixed(2)}%
                          </td>
                          <td className="py-3 px-3 text-right text-amber-300">
                            {(Number(item.rat_fap) * 100).toFixed(2)}%
                          </td>
                          <td className="py-3 px-3 text-right text-cyan-300">
                            {(Number(item.sistema_s) * 100).toFixed(2)}%
                          </td>
                          <td className="py-3 px-3 text-right font-black text-emerald-400">
                            {(totalPatronal * 100).toFixed(2)}%
                          </td>
                          <td className="py-3 px-3 font-sans text-slate-400 text-[10px]">
                            {item.entidades_descricao || 'INSS Patronal + RAT + Terceiros'}
                          </td>
                          <td className="py-3 px-3 text-center font-sans">
                            <button
                              onClick={() => handleEditEncargo(item)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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

      {/* ═══════════════════════════════════════════════════════
          MODAL REGRA RETENÇÃO
      ═══════════════════════════════════════════════════════ */}
      {showModalRegraRetencao && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-amber-500" />
                  {editingRegraRetencao ? 'Editar Regra de Retenção' : 'Nova Regra de Retenção'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Configure os parâmetros fiscais e tributários do serviço</p>
              </div>
              <button
                onClick={() => setShowModalRegraRetencao(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRegraRetencao} className="p-6 flex-1 overflow-y-auto space-y-8">
              
              {/* SECTION: IDENTIFICAÇÃO DO SERVIÇO */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                  <FileText className="w-4 h-4" /> Identificação do Serviço
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Item LC116 *</label>
                    <input required type="text" value={regraRetencaoForm.item_lc116} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, item_lc116: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" placeholder="Ex: 01.01" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Descrição do Serviço (LC116)</label>
                    <input type="text" value={regraRetencaoForm.descricao_item} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, descricao_item: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">NBS</label>
                    <input type="text" value={regraRetencaoForm.nbs} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, nbs: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Descrição NBS</label>
                    <input type="text" value={regraRetencaoForm.descricao_nbs} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, descricao_nbs: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">IndOp</label>
                    <input type="text" value={regraRetencaoForm.indop} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, indop: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">cClassTrib</label>
                    <input type="text" value={regraRetencaoForm.cclasstrib} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, cclasstrib: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Nome cClassTrib</label>
                    <input type="text" value={regraRetencaoForm.nome_cclasstrib} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, nome_cclasstrib: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={regraRetencaoForm.ps_onerosa} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, ps_onerosa: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                      <span className="text-sm font-bold text-slate-300">PS Onerosa?</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={regraRetencaoForm.adq_exterior} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, adq_exterior: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                      <span className="text-sm font-bold text-slate-300">Adq. Exterior?</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* SECTION: TRIBUTAÇÃO */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Calculator className="w-4 h-4" /> Alíquotas e Tributos
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">IRRF</label>
                    <input type="text" value={regraRetencaoForm.irrf} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, irrf: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-red-400 focus:outline-none focus:border-amber-500" placeholder="Ex: 1,50%" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">CSRF</label>
                    <input type="text" value={regraRetencaoForm.csrf} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, csrf: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-rose-400 focus:outline-none focus:border-amber-500" placeholder="Ex: 4,65%" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">INSS</label>
                    <input type="text" value={regraRetencaoForm.inss} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, inss: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-indigo-400 focus:outline-none focus:border-amber-500" placeholder="Ex: 11%" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">ISS</label>
                    <input type="text" value={regraRetencaoForm.iss} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, iss: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-cyan-400 focus:outline-none focus:border-amber-500" placeholder="Ex: 2% a 5%" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5" title="Órgãos Públicos">COSIRF</label>
                    <input type="text" value={regraRetencaoForm.cosirf_orgaos_publicos} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, cosirf_orgaos_publicos: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-purple-400 focus:outline-none focus:border-amber-500" placeholder="Ex: 9,45%" />
                  </div>
                </div>
              </div>

              {/* SECTION: INFORMAÇÕES FISCAIS ADICIONAIS */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                  <FileText className="w-4 h-4" /> Informações Complementares DFe
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Fundamentos Legais</label>
                    <textarea value={regraRetencaoForm.fundamentos_legais} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, fundamentos_legais: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" rows={2} />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Local Incidência IBS</label>
                    <input type="text" value={regraRetencaoForm.local_incidencia_ibs} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, local_incidencia_ibs: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Tipo de Operação</label>
                    <input type="text" value={regraRetencaoForm.tipo_operacao} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, tipo_operacao: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Característica do Fornecimento</label>
                    <input type="text" value={regraRetencaoForm.caracteristica_fornecimento} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, caracteristica_fornecimento: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Local Fornecimento (DFe)</label>
                    <input type="text" value={regraRetencaoForm.local_fornecimento} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, local_fornecimento: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Dispositivo Legal (LC 214/2025)</label>
                    <input type="text" value={regraRetencaoForm.dispositivo_legal_lc214} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, dispositivo_legal_lc214: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Observação</label>
                    <textarea value={regraRetencaoForm.observacao} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, observacao: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" rows={2} />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">indNFe</label>
                    <input type="text" value={regraRetencaoForm.indnfe} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, indnfe: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">indNFSe</label>
                    <input type="text" value={regraRetencaoForm.indnfse} onChange={(e) => setRegraRetencaoForm({ ...regraRetencaoForm, indnfse: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-800 sticky bottom-0 bg-slate-900 pb-2">
                <button
                  type="button"
                  onClick={() => setShowModalRegraRetencao(false)}
                  className="px-6 py-2.5 rounded-xl text-slate-300 font-bold hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-amber-600/20 cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {editingRegraRetencao ? 'Salvar Alterações' : 'Criar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: EDITAR FAIXA SIMPLES NACIONAL
      ═══════════════════════════════════════════════════════ */}
      {showModalFaixaSimples && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                Editar Parâmetros: {faixaSimplesForm.faixa}ª Faixa • {faixaSimplesForm.nome_anexo}
              </h3>
              <button onClick={() => setShowModalFaixaSimples(false)} className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveFaixaSimples} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Identificação da Tabela</div>
                <div className="text-slate-200 font-medium">
                  {faixaSimplesForm.nome_anexo} • Faixa {faixaSimplesForm.faixa} de 6
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Limite Superior RBT12 (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={faixaSimplesForm.limite_superior}
                    onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, limite_superior: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Alíquota Nominal (decimal, ex: 0.04) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={faixaSimplesForm.aliq_nominal}
                    onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, aliq_nominal: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <span className="text-[10px] text-cyan-400 mt-0.5 block">Equivale a {(faixaSimplesForm.aliq_nominal * 100).toFixed(2)}%</span>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Parcela a Deduzir (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={faixaSimplesForm.deducao}
                    onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, deducao: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Repartição dos Tributos */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                    Repartição dos Tributos na Faixa (Decimais, soma = 1.0)
                  </span>
                  {(() => {
                    const soma = faixaSimplesForm.reparticao_irpj + faixaSimplesForm.reparticao_csll +
                      faixaSimplesForm.reparticao_cofins + faixaSimplesForm.reparticao_pis +
                      faixaSimplesForm.reparticao_cpp + faixaSimplesForm.reparticao_icms +
                      faixaSimplesForm.reparticao_iss + faixaSimplesForm.reparticao_ipi;
                    const somaPct = (soma * 100).toFixed(2);
                    const isOk = Math.abs(soma - 1.0) < 0.005;
                    return (
                      <span className={`font-mono text-xs font-bold ${isOk ? 'text-emerald-400' : 'text-amber-400'}`}>
                        Soma: {somaPct}% {isOk ? '✓' : '(Atenção: Deve totalizar 100%)'}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">IRPJ</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={faixaSimplesForm.reparticao_irpj}
                      onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, reparticao_irpj: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">CSLL</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={faixaSimplesForm.reparticao_csll}
                      onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, reparticao_csll: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">COFINS</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={faixaSimplesForm.reparticao_cofins}
                      onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, reparticao_cofins: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">PIS</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={faixaSimplesForm.reparticao_pis}
                      onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, reparticao_pis: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400 font-bold block mb-0.5">CPP</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={faixaSimplesForm.reparticao_cpp}
                      onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, reparticao_cpp: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-emerald-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-blue-400 font-bold block mb-0.5">ICMS</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={faixaSimplesForm.reparticao_icms}
                      onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, reparticao_icms: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-blue-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-purple-400 font-bold block mb-0.5">ISS</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={faixaSimplesForm.reparticao_iss}
                      onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, reparticao_iss: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-purple-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-400 font-bold block mb-0.5">IPI</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={faixaSimplesForm.reparticao_ipi}
                      onChange={(e) => setFaixaSimplesForm({ ...faixaSimplesForm, reparticao_ipi: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-amber-300 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModalFaixaSimples(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Salvar Faixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: EDITAR LUCRO PRESUMIDO
      ═══════════════════════════════════════════════════════ */}
      {showModalLucroPresumido && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-cyan-400" />
                Editar Parâmetros: {lucroPresumidoForm.nome_atividade}
              </h3>
              <button onClick={() => setShowModalLucroPresumido(false)} className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveLucroPresumido} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Presunção IRPJ (decimal, ex: 0.08) *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={lucroPresumidoForm.presuncao_irpj}
                    onChange={(e) => setLucroPresumidoForm({ ...lucroPresumidoForm, presuncao_irpj: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                    required
                  />
                  <span className="text-[10px] text-amber-300 mt-0.5 block">Equivale a {(lucroPresumidoForm.presuncao_irpj * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Presunção CSLL (decimal, ex: 0.12) *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={lucroPresumidoForm.presuncao_csll}
                    onChange={(e) => setLucroPresumidoForm({ ...lucroPresumidoForm, presuncao_csll: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                    required
                  />
                  <span className="text-[10px] text-cyan-300 mt-0.5 block">Equivale a {(lucroPresumidoForm.presuncao_csll * 100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">IRPJ Básico (decimal) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={lucroPresumidoForm.aliq_irpj_basico}
                    onChange={(e) => setLucroPresumidoForm({ ...lucroPresumidoForm, aliq_irpj_basico: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">IRPJ Adicional (decimal) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={lucroPresumidoForm.aliq_irpj_adicional}
                    onChange={(e) => setLucroPresumidoForm({ ...lucroPresumidoForm, aliq_irpj_adicional: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Limite Mensal Adicional (R$) *</label>
                  <input
                    type="number"
                    step="1000"
                    value={lucroPresumidoForm.limite_mensal_adicional}
                    onChange={(e) => setLucroPresumidoForm({ ...lucroPresumidoForm, limite_mensal_adicional: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Alíquota CSLL Geral (decimal) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={lucroPresumidoForm.aliq_csll}
                  onChange={(e) => setLucroPresumidoForm({ ...lucroPresumidoForm, aliq_csll: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Base Legal / Artigo Normativo</label>
                <input
                  type="text"
                  value={lucroPresumidoForm.artigo_legal}
                  onChange={(e) => setLucroPresumidoForm({ ...lucroPresumidoForm, artigo_legal: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModalLucroPresumido(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Salvar Parâmetros
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: EDITAR ENCARGO PATRONAL
      ═══════════════════════════════════════════════════════ */}
      {showModalEncargo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                Editar Encargos: {encargoForm.nome_ramo}
              </h3>
              <button onClick={() => setShowModalEncargo(false)} className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveEncargo} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">INSS Patronal (ex: 0.20) *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={encargoForm.inss_patronal}
                    onChange={(e) => setEncargoForm({ ...encargoForm, inss_patronal: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                    required
                  />
                  <span className="text-[10px] text-emerald-300 mt-0.5 block">{(encargoForm.inss_patronal * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">RAT / FAP (ex: 0.03) *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={encargoForm.rat_fap}
                    onChange={(e) => setEncargoForm({ ...encargoForm, rat_fap: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                    required
                  />
                  <span className="text-[10px] text-amber-300 mt-0.5 block">{(encargoForm.rat_fap * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Sistema S (ex: 0.052) *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={encargoForm.sistema_s}
                    onChange={(e) => setEncargoForm({ ...encargoForm, sistema_s: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                    required
                  />
                  <span className="text-[10px] text-cyan-300 mt-0.5 block">{(encargoForm.sistema_s * 100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 font-bold">Total Carga Patronal:</span>
                <span className="font-mono text-sm font-black text-emerald-400">
                  {((encargoForm.inss_patronal + encargoForm.rat_fap + encargoForm.sistema_s) * 100).toFixed(2)}%
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Entidades / Descrição Normativa</label>
                <input
                  type="text"
                  value={encargoForm.entidades_descricao}
                  onChange={(e) => setEncargoForm({ ...encargoForm, entidades_descricao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModalEncargo(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Salvar Encargos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: ADICIONAR / EDITAR INDOPER (SVRS / LC 214)
      ═══════════════════════════════════════════════════════ */}
      {showAddIndOper && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-400" />
                {editingIndOper ? 'Editar Indicador de Operação (indOper)' : 'Novo Indicador de Operação (indOper)'}
              </h3>
              <button
                onClick={() => { setShowAddIndOper(false); setEditingIndOper(null); }}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveIndOper} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Código Oficial (ex: 001, 101) *</label>
                  <input
                    type="text"
                    value={indOperForm.codigo}
                    onChange={(e) => setIndOperForm({ ...indOperForm, codigo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-teal-400 font-mono font-bold"
                    placeholder="ex: 101"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Dispositivo Legal *</label>
                  <input
                    type="text"
                    value={indOperForm.dispositivo_legal}
                    onChange={(e) => setIndOperForm({ ...indOperForm, dispositivo_legal: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                    placeholder="Art. 11 da LC 214/2025"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Nome / Descrição da Hipótese *</label>
                <input
                  type="text"
                  value={indOperForm.nome}
                  onChange={(e) => setIndOperForm({ ...indOperForm, nome: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  placeholder="Nome oficial da operação"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Local da Operação (Princípio do Destino)</label>
                <input
                  type="text"
                  value={indOperForm.local}
                  onChange={(e) => setIndOperForm({ ...indOperForm, local: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  placeholder="Estabelecimento fornecedor, destinatário, etc."
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Características / Observações</label>
                <textarea
                  rows={2}
                  value={indOperForm.caracteristica}
                  onChange={(e) => setIndOperForm({ ...indOperForm, caracteristica: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 resize-none"
                  placeholder="Detalhes complementares"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowAddIndOper(false); setEditingIndOper(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-teal-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Salvar indOper
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: ADICIONAR / EDITAR CCLASSTRIB (SVRS RTC)
      ═══════════════════════════════════════════════════════ */}
      {(showAddCClass || editingCClass) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                {editingCClass ? 'Editar Classificação Tributária (cClassTrib)' : 'Nova Classificação Tributária (cClassTrib)'}
              </h3>
              <button
                onClick={() => { setShowAddCClass(false); setEditingCClass(null); }}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCClass} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Código cClassTrib (6 dígitos oficiais, ex: 620006, 000001) *</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-purple-400 font-mono font-bold"
                  placeholder="ex: 620006"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Descrição Oficial (SVRS / RFB) *</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 resize-none"
                  placeholder="Descrição da regra de tributação"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Tratamento Esperado *</label>
                  <select
                    value={newTratamento}
                    onChange={(e) => setNewTratamento(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="tributado">Tributado</option>
                    <option value="aliquota_reduzida">Alíquota Reduzida</option>
                    <option value="isento">Isento</option>
                    <option value="nao_incidencia">Não Incidência</option>
                    <option value="monofasico">Monofásico</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Permite Crédito? *</label>
                  <select
                    value={newCredito}
                    onChange={(e) => setNewCredito(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                    <option value="Parcial">Parcial</option>
                    <option value="Depende">Depende</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Alíquota Esperada / Referência</label>
                <input
                  type="text"
                  value={newAliquota}
                  onChange={(e) => setNewAliquota(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  placeholder="ex: Padrão (26.5%), Alíquota Zero, etc."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowAddCClass(false); setEditingCClass(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Salvar cClassTrib
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: ADICIONAR / EDITAR CFOP
      ═══════════════════════════════════════════════════════ */}
      {showAddCfop && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-400" />
                {editingCfop ? 'Editar Regra de CFOP' : 'Nova Regra de CFOP'}
              </h3>
              <button
                onClick={() => { setShowAddCfop(false); setEditingCfop(null); }}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCfop} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">CFOP (4 dígitos) *</label>
                  <input
                    type="text"
                    value={newCfopCode}
                    onChange={(e) => setNewCfopCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-indigo-400 font-mono font-bold"
                    placeholder="ex: 1102"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Categoria *</label>
                  <select
                    value={newCfopCat}
                    onChange={(e) => setNewCfopCat(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="Compra">Compra</option>
                    <option value="Devolução">Devolução</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Remessa">Remessa</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Descrição do CFOP *</label>
                <input
                  type="text"
                  value={newCfopDesc}
                  onChange={(e) => setNewCfopDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  placeholder="ex: Compra para comercialização"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Tratamento Padrão *</label>
                  <select
                    value={newCfopTrat}
                    onChange={(e) => setNewCfopTrat(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="Elegível">Elegível</option>
                    <option value="Não elegível">Não elegível</option>
                    <option value="Depende">Depende</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Exige Onerosidade? *</label>
                  <select
                    value={newCfopOneroso ? 'true' : 'false'}
                    onChange={(e) => setNewCfopOneroso(e.target.value === 'true')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="true">Sim (Exige Pagamento)</option>
                    <option value="false">Não (Bonificação/Remessa)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Evidência Mínima Exigida</label>
                <input
                  type="text"
                  value={newCfopEvidencia}
                  onChange={(e) => setNewCfopEvidencia(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  placeholder="ex: XML Válido + Extrato Financeiro"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowAddCfop(false); setEditingCfop(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Salvar CFOP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: ADICIONAR / EDITAR REGRA DE ELEGIBILIDADE
      ═══════════════════════════════════════════════════════ */}
      {showAddRegra && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                {editingRegra ? 'Editar Regra de Elegibilidade' : 'Nova Regra de Elegibilidade'}
              </h3>
              <button
                onClick={() => { setShowAddRegra(false); setEditingRegra(null); }}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRegra} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Código da Regra *</label>
                  <input
                    type="text"
                    value={regraForm.codigo_regra}
                    onChange={(e) => setRegraForm({ ...regraForm, codigo_regra: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-teal-400 font-mono font-bold"
                    placeholder="ex: REG_INSUMO_01"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Resultado Padrão *</label>
                  <select
                    value={regraForm.resultado_padrao}
                    onChange={(e) => setRegraForm({ ...regraForm, resultado_padrao: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="Elegível ao Crédito">Elegível ao Crédito</option>
                    <option value="Não Elegível">Não Elegível</option>
                    <option value="Depende de Evidência">Depende de Evidência</option>
                    <option value="Monofásico / Vedado">Monofásico / Vedado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Nome da Regra *</label>
                <input
                  type="text"
                  value={regraForm.nome}
                  onChange={(e) => setRegraForm({ ...regraForm, nome: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  placeholder="Nome descritivo da regra"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={regraForm.descricao}
                  onChange={(e) => setRegraForm({ ...regraForm, descricao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 resize-none"
                  placeholder="Descrição da regra de negócio"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">CFOPs Aplicáveis (separados por vírgula)</label>
                  <input
                    type="text"
                    value={regraForm.cfops_aplicaveis}
                    onChange={(e) => setRegraForm({ ...regraForm, cfops_aplicaveis: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono"
                    placeholder="1101, 1102, 2101"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Base Legal *</label>
                  <input
                    type="text"
                    value={regraForm.base_legal}
                    onChange={(e) => setRegraForm({ ...regraForm, base_legal: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                    placeholder="Art. 28 da LC 214/2025"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Evidência Mínima</label>
                <input
                  type="text"
                  value={regraForm.evidencia_minima}
                  onChange={(e) => setRegraForm({ ...regraForm, evidencia_minima: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  placeholder="XML + Comprovante de Pagamento"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowAddRegra(false); setEditingRegra(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-teal-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Salvar Regra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
