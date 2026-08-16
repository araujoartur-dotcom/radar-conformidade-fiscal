import React, { useState, useEffect } from 'react';
import {
  Building2, ShieldCheck, Key, FileCheck, Layers, Plus, Search,
  CheckCircle2, AlertTriangle, Lock, RefreshCw, Upload, Sparkles, Filter,
  Users, Trash2, ArrowUpRight, Database, FolderCheck, Check, Edit3, Eye, EyeOff,
  FileText, MapPin, UserCheck, FileCode, Copy, Download, Zap, Grid, List,
  Shield, Activity, ExternalLink, ArrowRight
} from 'lucide-react';
import { ClienteEmpresaTenant, CertificadoA1 } from '../types';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { lookupCnpj, formatCNPJ } from '../utils/cnpj';

interface CarteiraCnpjsPanelProps {
  selectedTenantCnpj: string;
  onSelectTenantCnpj: (cnpj: string) => void;
  certificado: CertificadoA1;
  setCertificado: (cert: CertificadoA1) => void;
}

export const INITIAL_TENANTS: ClienteEmpresaTenant[] = [];

const UF_LIST = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

export const CarteiraCnpjsPanel: React.FC<CarteiraCnpjsPanelProps> = ({
  selectedTenantCnpj,
  onSelectTenantCnpj,
  certificado,
  setCertificado
}) => {
  const { get, post, put, del, uploadFile } = useApi();
  const {
    switchEmpresa,
    empresaAtiva,
    setEmpresaAtiva,
    setEmpresasDisponiveis,
    removerEmpresa,
    adicionarEmpresa,
    atualizarEmpresa
  } = useAuth();
  const [tenants, setTenants] = useState<ClienteEmpresaTenant[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('todos');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Quick Fast-Lookup Bar
  const [quickLookupCnpj, setQuickLookupCnpj] = useState('');
  const [quickLookupUf, setQuickLookupUf] = useState('SP');
  const [isQuickSearching, setIsQuickSearching] = useState(false);
  const [quickSearchError, setQuickSearchError] = useState<string | null>(null);

  // Modal State
  const [modalTab, setModalTab] = useState<'identificacao' | 'endereco' | 'contador' | 'sped'>('identificacao');
  const [copiedSped, setCopiedSped] = useState<string | null>(null);

  // Modal Novo CNPJ / Cliente
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCnpj, setNewCnpj] = useState('');
  const [newRazaoSocial, setNewRazaoSocial] = useState('');
  const [newNomeFantasia, setNewNomeFantasia] = useState('');
  const [newGrupo, setNewGrupo] = useState('Carteira Geral');
  const [newUf, setNewUf] = useState('SP');
  const [newRegime, setNewRegime] = useState<'Real' | 'Presumido' | 'Simples Nacional' | 'MEI'>('Real');
  const [newIe, setNewIe] = useState('');
  const [newIm, setNewIm] = useState('');
  const [newCnae, setNewCnae] = useState('');
  const [newCodMunIbge, setNewCodMunIbge] = useState('3550308');
  const [newPerfilSped, setNewPerfilSped] = useState<'A' | 'B' | 'C'>('A');
  const [newIndAtiv, setNewIndAtiv] = useState<'0' | '1'>('0');
  const [newSuframa, setNewSuframa] = useState('');
  const [newManifestarCiencia, setNewManifestarCiencia] = useState(true);

  // Endereço (SPED 0005)
  const [newCep, setNewCep] = useState('');
  const [newLogradouro, setNewLogradouro] = useState('');
  const [newNumero, setNewNumero] = useState('');
  const [newComplemento, setNewComplemento] = useState('');
  const [newBairro, setNewBairro] = useState('');
  const [newMunicipio, setNewMunicipio] = useState('');
  const [newTelefone, setNewTelefone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Contador (SPED 0100) — Campos Opcionais
  const [newContadorNome, setNewContadorNome] = useState('');
  const [newContadorCpf, setNewContadorCpf] = useState('');
  const [newContadorCrc, setNewContadorCrc] = useState('');
  const [newContadorUfCrc, setNewContadorUfCrc] = useState('SP');
  const [newContadorCnpjEscritorio, setNewContadorCnpjEscritorio] = useState('');
  const [newContadorCep, setNewContadorCep] = useState('');
  const [newContadorLogradouro, setNewContadorLogradouro] = useState('');
  const [newContadorNumero, setNewContadorNumero] = useState('');
  const [newContadorComplemento, setNewContadorComplemento] = useState('');
  const [newContadorBairro, setNewContadorBairro] = useState('');
  const [newContadorCodMun, setNewContadorCodMun] = useState('');
  const [newContadorTelefone, setNewContadorTelefone] = useState('');
  const [newContadorEmail, setNewContadorEmail] = useState('');

  // Modal Editar CNPJ
  const [editingTenant, setEditingTenant] = useState<ClienteEmpresaTenant | null>(null);

  const handleOpenEdit = (tenant: ClienteEmpresaTenant) => {
    setEditingTenant({
      ...tenant,
      manifestarCienciaAutomatica: tenant.manifestarCienciaAutomatica !== false
    });
    setModalTab('identificacao');
  };

  // Modal Ativar Certificado A1 (.PFX)
  const [certModalTenant, setCertModalTenant] = useState<ClienteEmpresaTenant | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCertSubmitting, setIsCertSubmitting] = useState(false);
  const certFileInputRef = React.useRef<HTMLInputElement>(null);

  // ── CARREGAR EMPRESAS DO BANCO DE DADOS ─────────────────
  const loadTenants = async () => {
    setIsLoading(true);
    const res = await get<{ success: boolean; data: ClienteEmpresaTenant[] }>('/tenants');
    if (res.ok && res.data?.data) {
      const list = res.data.data;
      setTenants(list);

      const formattedEmpresas = list.map(t => ({
        id: t.id,
        cnpjRaiz: t.cnpjRaiz,
        cnpjCompleto: t.cnpjCompleto,
        razaoSocial: t.razaoSocial,
        nomeFantasia: t.nomeFantasia,
        uf: t.uf,
        regimeTributario: t.regimeTributario
      }));
      setEmpresasDisponiveis(formattedEmpresas);

      if (empresaAtiva && !list.some(t => t.id === empresaAtiva.id || t.cnpjCompleto === empresaAtiva.cnpjCompleto)) {
        setEmpresaAtiva(formattedEmpresas.length > 0 ? formattedEmpresas[0] : null);
      } else if (!empresaAtiva && formattedEmpresas.length > 0) {
        setEmpresaAtiva(formattedEmpresas[0]);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTenants();
  }, []);

  // ── FAST LOOKUP VIA RECEITA / BRASILAPI / MINHARECEITA ──
  const handlePerformCnpjLookup = async (cnpjInput: string, ufInput: string) => {
    const raw = cnpjInput.replace(/\D/g, '');
    if (raw.length !== 14 && raw.length !== 8) {
      setQuickSearchError('Informe um CNPJ válido com 14 dígitos.');
      return;
    }

    setIsQuickSearching(true);
    setQuickSearchError(null);

    try {
      const data = await lookupCnpj(raw, ufInput);
      if (data) {
        if (data.statusConsulta === 'erro') {
          setQuickSearchError(data.mensagemErro || 'CNPJ não localizado ou inválido.');
          return;
        }

        // Preenche todos os estados do formulário com fidelidade
        setNewCnpj(formatCNPJ(data.cnpj || raw));
        setNewRazaoSocial(data.razaoSocial || '');
        setNewNomeFantasia(data.nomeFantasia || data.razaoSocial || '');
        setNewUf(data.uf || ufInput || 'SP');
        setNewCnae(data.cnaePrincipal || '');
        setNewIe(data.ie || '');
        
        // Mapear Regime Tributário de forma segura
        const regStr = (data.regimeTributario || '').toLowerCase();
        let regimeMapped: 'Real' | 'Presumido' | 'Simples Nacional' | 'MEI' = 'Real';
        if (regStr.includes('mei')) {
          regimeMapped = 'MEI';
        } else if (regStr.includes('simples')) {
          regimeMapped = 'Simples Nacional';
        } else if (regStr.includes('presumido')) {
          regimeMapped = 'Presumido';
        }
        setNewRegime(regimeMapped);

        // Endereço
        setNewCep(data.cep || '');
        setNewLogradouro(data.logradouro || data.enderecoCompleto || '');
        setNewNumero(data.numero || 'S/N');
        setNewComplemento(data.complemento || '');
        setNewBairro(data.bairro || '');
        setNewMunicipio(data.municipio || '');
        setNewTelefone(data.telefone || '');
        setNewEmail(data.email || '');

        // Abre o modal na primeira aba
        setModalTab('identificacao');
        setShowAddModal(true);
      } else {
        setQuickSearchError('Não foi possível localizar os dados deste CNPJ na base pública.');
      }
    } catch (err: any) {
      setQuickSearchError('Erro ao consultar CNPJ: ' + (err.message || 'Falha na conexão'));
    } finally {
      setIsQuickSearching(false);
    }
  };

  // ── SUBMIT CERTIFICADO A1 (Arquivo + Senha Juntos) ─────────
  const handleCertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certFile || !certModalTenant || !certPassword) return;

    const formData = new FormData();
    formData.append('certificado', certFile);
    formData.append('tenantId', certModalTenant.id);
    formData.append('senha', certPassword);

    setIsCertSubmitting(true);
    const res = await uploadFile('/config/certificate/upload', formData);
    setIsCertSubmitting(false);

    if (res.ok && res.data?.data) {
      const certData = res.data.data;

      setTenants(prev => prev.map(t => {
        if (t.id === certModalTenant.id || t.cnpjCompleto === certModalTenant.cnpjCompleto) {
          return {
            ...t,
            certificadoA1: certData,
            statusConexaoSefaz: 'ativo'
          };
        }
        return t;
      }));

      onSelectTenantCnpj(certModalTenant.cnpjCompleto);
      setCertificado({
        fileName: certData.fileName,
        status: certData.status,
        validade: certData.validade,
        cnpj: certModalTenant.cnpjCompleto,
        razãoSocial: certModalTenant.razaoSocial,
        tipo: 'e-CNPJ A1'
      });

      setCertModalTenant(null);
      setCertFile(null);
      setCertPassword('');
      alert('Certificado A1 vinculado e ativado com sucesso!');
    } else {
      alert(res.error || 'Erro ao enviar e ativar certificado.');
    }
  };

  const deferredSearchTerm = React.useDeferredValue(searchTerm);

  const groupsAvailable = Array.from(new Set(tenants.map(t => t.grupoContabilCliente || 'Sem Grupo')));

  const tenantsFiltered = tenants.filter(t => {
    const matchesSearch =
      t.cnpjCompleto.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
      t.razaoSocial.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
      t.nomeFantasia.toLowerCase().includes(deferredSearchTerm.toLowerCase());
    const matchesGroup = selectedGroupFilter === 'todos' || t.grupoContabilCliente === selectedGroupFilter;
    return matchesSearch && matchesGroup;
  });

  // ── CRIAR EMPRESA (Backend) ─────────────────────────────
  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCnpj || !newRazaoSocial) {
      alert('Informe o CNPJ e a Razão Social.');
      return;
    }

    const res = await post('/tenants', {
      cnpjCompleto: newCnpj,
      razaoSocial: newRazaoSocial,
      nomeFantasia: newNomeFantasia || newRazaoSocial,
      uf: newUf,
      regimeTributario: newRegime,
      grupoContabilCliente: newGrupo,
      manifestarCienciaAutomatica: newManifestarCiencia,
      ie: newIe,
      im: newIm,
      cnaePrincipal: newCnae,
      codMunicipioIbge: newCodMunIbge,
      suframa: newSuframa,
      perfilSped: newPerfilSped,
      indAtiv: newIndAtiv,
      endereco: {
        cep: newCep,
        logradouro: newLogradouro,
        numero: newNumero,
        complemento: newComplemento,
        bairro: newBairro,
        municipio: newMunicipio,
        uf: newUf,
        codMunicipioIbge: newCodMunIbge,
        telefone: newTelefone,
        email: newEmail
      },
      contador: {
        nome: newContadorNome,
        cpf: newContadorCpf,
        crc: newContadorCrc,
        ufCrc: newContadorUfCrc,
        cnpjEscritorio: newContadorCnpjEscritorio,
        cep: newContadorCep,
        logradouro: newContadorLogradouro,
        numero: newContadorNumero,
        complemento: newContadorComplemento,
        bairro: newContadorBairro,
        codMunicipioIbge: newContadorCodMun,
        municipio: newMunicipio,
        uf: newUf,
        telefone: newContadorTelefone,
        email: newContadorEmail
      }
    });

    if (res.ok && res.data?.data) {
      const created = res.data.data;
      setTenants(prev => [created, ...prev]);
      adicionarEmpresa({
        id: created.id,
        cnpjRaiz: created.cnpjRaiz,
        cnpjCompleto: created.cnpjCompleto,
        razaoSocial: created.razaoSocial,
        nomeFantasia: created.nomeFantasia,
        uf: created.uf,
        regimeTributario: created.regimeTributario
      });
      onSelectTenantCnpj(created.cnpjCompleto);
      setSearchTerm('');
      setSelectedGroupFilter('todos');
      setShowAddModal(false);
      setQuickLookupCnpj('');
      alert(`Empresa ${created.razaoSocial} cadastrada com sucesso!`);
    } else {
      alert(res.error || 'Erro ao cadastrar empresa.');
    }
  };

  const generateSpedLines = (t: Partial<ClienteEmpresaTenant>) => {
    const dataIni = '01082026';
    const dataFim = '31082026';
    const cleanCnpj = (t.cnpjCompleto || '').replace(/\D/g, '');
    const cleanIe = (t.ie || '').replace(/\D/g, '') || '';
    const codMun = t.codMunicipioIbge || t.endereco?.codMunicipioIbge || '3550308';
    const im = t.im || '';
    const suframa = t.suframa || '';
    const perfil = t.perfilSped || 'A';
    const indAtiv = t.indAtiv || '0';

    // |0000|017|0|DT_INI|DT_FIN|NOME|CNPJ|UF|IE|COD_MUN|IM|SUFRAMA|IND_PERFIL|IND_ATIV|
    const r0000 = `|0000|017|0|${dataIni}|${dataFim}|${t.razaoSocial || 'EMPRESA EXEMPLO LTDA'}|${cleanCnpj}|${t.uf || 'SP'}|${cleanIe}|${codMun}|${im}|${suframa}|${perfil}|${indAtiv}|`;

    // |0005|FANTASIA|CEP|END|NUM|COMPL|BAIRRO|FONE|FAX|EMAIL|
    const end: any = t.endereco || {};
    const cleanCep = (end.cep || '').replace(/\D/g, '');
    const fone = (end.telefone || '').replace(/\D/g, '');
    const r0005 = `|0005|${t.nomeFantasia || t.razaoSocial || ''}|${cleanCep}|${end.logradouro || ''}|${end.numero || 'S/N'}|${end.complemento || ''}|${end.bairro || ''}|${fone}||${end.email || ''}|`;

    // |0100|NOME|CPF|CRC|CNPJ|CEP|END|NUM|COMPL|BAIRRO|FONE|FAX|EMAIL|COD_MUN|
    const cont: any = t.contador || {};
    const cleanCpf = (cont.cpf || '').replace(/\D/g, '');
    const crc = cont.crc || (cont.ufCrc ? `${cont.ufCrc}-${cont.crc || '000000'}` : 'SP-000000/O-0');
    const cnpjEsc = (cont.cnpjEscritorio || '').replace(/\D/g, '');
    const cleanCepCont = (cont.cep || '').replace(/\D/g, '');
    const foneCont = (cont.telefone || '').replace(/\D/g, '');
    const codMunCont = cont.codMunicipioIbge || codMun;
    const r0100 = `|0100|${cont.nome || 'CONTADOR RESPONSAVEL'}|${cleanCpf}|${crc}|${cnpjEsc}|${cleanCepCont}|${cont.logradouro || ''}|${cont.numero || 'S/N'}|${cont.complemento || ''}|${cont.bairro || ''}|${foneCont}||${cont.email || ''}|${codMunCont}|`;

    // Registro |0150| Participantes
    const r0150Exemplo = `|0150|PART-001|FORNECEDOR MATERIA PRIMA S/A|1058|33000167000101||81281882|3304557||AV BRASIL|1000||CENTRO|\n|0150|PART-002|DISTRIBUIDORA LOGISTICA LTDA|1058|12ABC345000130|||3106200||AV AFONSO PENA|2000||FUNCIONARIOS|`;

    const bloco0Completo = `${r0000}\n${r0005}\n${r0100}\n${r0150Exemplo}`;

    return { r0000, r0005, r0100, r0150Exemplo, bloco0Completo };
  };

  const handleCopySped = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSped(id);
    setTimeout(() => setCopiedSped(null), 2000);
  };

  const handleExportSpedTxt = (t: Partial<ClienteEmpresaTenant>) => {
    const { bloco0Completo } = generateSpedLines(t);
    const blob = new Blob([bloco0Completo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPED_BLOCO_0_${(t.cnpjCompleto || 'EMPRESA').replace(/\D/g, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── EDITAR EMPRESA (Backend) ────────────────────────────
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    const res = await put(`/tenants/${editingTenant.id}`, {
      razaoSocial: editingTenant.razaoSocial,
      nomeFantasia: editingTenant.nomeFantasia,
      uf: editingTenant.uf,
      regimeTributario: editingTenant.regimeTributario,
      manifestarCienciaAutomatica: editingTenant.manifestarCienciaAutomatica !== false,
      ie: editingTenant.ie,
      im: editingTenant.im,
      cnaePrincipal: editingTenant.cnaePrincipal,
      codMunicipioIbge: editingTenant.codMunicipioIbge,
      suframa: editingTenant.suframa,
      perfilSped: editingTenant.perfilSped,
      indAtiv: editingTenant.indAtiv,
      endereco: editingTenant.endereco,
      contador: editingTenant.contador
    });

    if (res.ok) {
      setTenants(prev => prev.map(t => t.id === editingTenant.id ? editingTenant : t));
      atualizarEmpresa({
        id: editingTenant.id,
        cnpjRaiz: editingTenant.cnpjRaiz,
        cnpjCompleto: editingTenant.cnpjCompleto,
        razaoSocial: editingTenant.razaoSocial,
        nomeFantasia: editingTenant.nomeFantasia,
        uf: editingTenant.uf,
        regimeTributario: editingTenant.regimeTributario
      });
      if (selectedTenantCnpj === editingTenant.cnpjCompleto) {
        setCertificado({ ...certificado, razãoSocial: editingTenant.razaoSocial });
      }
      setEditingTenant(null);
      alert('Dados cadastrais e parametrização SPED atualizados com sucesso!');
    } else {
      alert(res.error || 'Erro ao atualizar empresa.');
    }
  };

  // ── EXCLUIR EMPRESA (Backend) ───────────────────────────
  const handleDeleteTenant = async (id: string, cnpj: string, razao: string) => {
    if (confirm(`Tem certeza que deseja excluir o cliente ${razao} (${cnpj}) da carteira?`)) {
      const res = await del(`/tenants/${id}`);
      if (res.ok) {
        setTenants(prev => prev.filter(t => t.id !== id));
        removerEmpresa(id);
        if (selectedTenantCnpj === cnpj) {
          onSelectTenantCnpj('');
          setCertificado({
            fileName: '',
            cnpj: '',
            razãoSocial: '',
            tipo: 'e-CNPJ A1',
            validade: '',
            status: 'pendente'
          });
        }
      } else {
        alert(res.error || 'Erro ao excluir empresa.');
      }
    }
  };

  const totalEmpresas = tenants.length;
  const certificadosValidos = tenants.filter(t => t.certificadoA1?.status === 'valido' || t.certificadoA1?.status === 'ok').length;
  const certificadosPendentes = tenants.filter(t => !t.certificadoA1).length;
  const spedConfigurados = tenants.filter(t => t.cnaePrincipal || t.ie || t.endereco).length;

  return (
    <div className="space-y-6">
      
      {/* ── KPI METRICS CARDS ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-3.5 shadow-lg">
          <div className="w-11 h-11 rounded-xl bg-blue-950/80 border border-blue-800 flex items-center justify-center text-cyan-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Empresas</div>
            <div className="text-xl font-extrabold text-white font-mono">{totalEmpresas}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-3.5 shadow-lg">
          <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Certificados A1 Ativos</div>
            <div className="text-xl font-extrabold text-emerald-400 font-mono">{certificadosValidos}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-3.5 shadow-lg">
          <div className="w-11 h-11 rounded-xl bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">A1 Pendente</div>
            <div className="text-xl font-extrabold text-amber-400 font-mono">{certificadosPendentes}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-3.5 shadow-lg">
          <div className="w-11 h-11 rounded-xl bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-indigo-400 shrink-0">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SPED Bloco 0 Pronto</div>
            <div className="text-xl font-extrabold text-indigo-300 font-mono">{spedConfigurados}</div>
          </div>
        </div>
      </div>

      {/* ── FAST LOOKUP & AUTO-ONBOARDING BANNER ─────────── */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950/60 to-slate-900 border border-cyan-500/30 shadow-xl space-y-3 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Consulta Rápida & Importação Instantânea de Empresa
              </h3>
              <p className="text-[11px] text-slate-400">
                Informe o CNPJ para buscar automaticamente Razão Social, CNAE, Endereço, Regime Tributário e gerar o SPED.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Digite o CNPJ (ex: 31.758.338/0001-30 ou apenas dígitos)..."
              value={quickLookupCnpj}
              onChange={(e) => setQuickLookupCnpj(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePerformCnpjLookup(quickLookupCnpj, quickLookupUf);
                }
              }}
              className="w-full bg-slate-950 border border-cyan-800/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400 shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={quickLookupUf}
              onChange={(e) => setQuickLookupUf(e.target.value)}
              className="bg-slate-950 border border-cyan-800/60 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-mono font-bold focus:outline-none cursor-pointer"
            >
              {UF_LIST.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>

            <button
              type="button"
              disabled={isQuickSearching || !quickLookupCnpj.trim()}
              onClick={() => handlePerformCnpjLookup(quickLookupCnpj, quickLookupUf)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isQuickSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                  <span>Consultando Receita...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-cyan-200" />
                  <span>Consultar na Receita & Cadastrar (+ Novo Cadastro)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {quickSearchError && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{quickSearchError}</span>
          </div>
        )}
      </div>

      {/* ── FILTERS & VIEW MODE ACTION BAR ────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="search"
            name="search_query_company_no_autofill"
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            placeholder="Buscar por CNPJ, Razão Social ou Fantasia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
              title="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto text-xs justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 font-semibold">Grupo / Carteira:</span>
            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-medium focus:outline-none"
            >
              <option value="todos">Todos os Grupos ({tenants.length})</option>
              {groupsAvailable.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-slate-800 text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Visualização em Cards"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-slate-800 text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Visualização em Tabela"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              setNewCnpj('');
              setNewRazaoSocial('');
              setNewNomeFantasia('');
              setModalTab('identificacao');
              setShowAddModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-cyan-300" />
            <span>Novo CNPJ</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {tenantsFiltered.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">
            {searchTerm || selectedGroupFilter !== 'todos'
              ? 'Nenhuma empresa encontrada para o filtro atual'
              : 'Nenhum CNPJ cadastrado na carteira'}
          </h3>
          <div className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm || selectedGroupFilter !== 'todos' ? (
              <div className="flex flex-col gap-2 items-center">
                <span>Filtro digitado: <strong className="text-cyan-300">"{searchTerm}"</strong></span>
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setSelectedGroupFilter('todos'); }}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs cursor-pointer border border-slate-700"
                >
                  ✕ Limpar Filtro de Busca
                </button>
              </div>
            ) : (
              <span>Utilize a barra de consulta rápida acima para cadastrar a primeira empresa em 1 clique com dados automáticos da Receita Federal.</span>
            )}
          </div>
        </div>
      )}

      {/* ── GRID VIEW MODE ───────────────────────────────── */}
      {viewMode === 'grid' && tenantsFiltered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tenantsFiltered.map(tenant => {
            const isSelected = tenant.cnpjCompleto === selectedTenantCnpj;
            return (
              <div
                key={tenant.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  isSelected
                    ? 'bg-gradient-to-br from-slate-900 via-indigo-950/80 to-slate-900 border-cyan-400 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded bg-blue-950 text-cyan-300 border border-blue-800">
                        {tenant.cnpjCompleto}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        UF: {tenant.uf}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                        {tenant.regimeTributario}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-white leading-snug pt-1">
                      {tenant.razaoSocial}
                    </h3>
                    <div className="text-xs text-slate-400">
                      Fantasia: <strong className="text-slate-200">{tenant.nomeFantasia}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Ativo Agora
                      </span>
                    ) : (
                      <button
                        onClick={async () => {
                          onSelectTenantCnpj(tenant.cnpjCompleto);
                          if (tenant.id) {
                            const res = await post<{ success: boolean; accessToken: string; empresaAtiva: any }>('/auth/switch-empresa', {
                              empresaId: tenant.id
                            });
                            if (res.ok && res.data?.accessToken && res.data?.empresaAtiva) {
                              switchEmpresa(res.data.empresaAtiva, res.data.accessToken);
                            }
                          }
                          if (tenant.certificadoA1) {
                            setCertificado({
                              fileName: tenant.certificadoA1.fileName,
                              cnpj: tenant.cnpjCompleto,
                              razãoSocial: tenant.razaoSocial,
                              tipo: 'e-CNPJ A1',
                              validade: tenant.certificadoA1.validade,
                              status: 'valido'
                            });
                          } else {
                            setCertificado({
                              fileName: '',
                              cnpj: tenant.cnpjCompleto,
                              razãoSocial: tenant.razaoSocial,
                              tipo: 'e-CNPJ A1',
                              validade: '',
                              status: 'pendente'
                            });
                          }
                        }}
                        className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        Selecionar
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEdit(tenant)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                      title="Editar dados cadastrais & SPED Bloco 0"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteTenant(tenant.id, tenant.cnpjCompleto, tenant.razaoSocial)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all cursor-pointer"
                      title="Excluir empresa da carteira"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  </div>
                </div>

                {/* Group & Cert Details */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Carteira Contábil:</span>
                    <span className="font-bold text-slate-200 truncate block">{tenant.grupoContabilCliente || 'Geral'}</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Doc. Capturados:</span>
                    <span className="font-mono font-bold text-cyan-300">{tenant.totalDocumentosCapturados.toLocaleString('pt-BR')} XMLs</span>
                  </div>
                </div>

                {/* Certificate A1 Status Box */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs mt-3">
                  <div className="flex items-center gap-2.5">
                    <Key className={`w-4 h-4 ${tenant.certificadoA1 ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <div>
                      <div className="font-bold text-white text-[11px]">
                        {tenant.certificadoA1 ? 'Certificado Digital A1 Ativo' : 'Certificado A1 Pendente'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {tenant.certificadoA1 ? `${tenant.certificadoA1.fileName} (Venc: ${tenant.certificadoA1.validade})` : 'Nenhum certificado .PFX vinculado'}
                      </div>
                    </div>
                  </div>

                  {!tenant.certificadoA1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCertModalTenant(tenant);
                        setCertFile(null);
                        setCertPassword('');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all cursor-pointer shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5 text-cyan-300" />
                      <span>Ativar Certificado A1</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Ativo
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCertModalTenant(tenant);
                          setCertFile(null);
                          setCertPassword('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                        title="Substituir por um novo certificado A1"
                      >
                        Trocar .PFX
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TABLE VIEW MODE ──────────────────────────────── */}
      {viewMode === 'table' && tenantsFiltered.length > 0 && (
        <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">CNPJ & Empresa</th>
                  <th className="py-3 px-3">UF</th>
                  <th className="py-3 px-3">Regime</th>
                  <th className="py-3 px-3">Carteira / Grupo</th>
                  <th className="py-3 px-3">Certificado A1</th>
                  <th className="py-3 px-3 text-right">XMLs</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tenantsFiltered.map(tenant => {
                  const isSelected = tenant.cnpjCompleto === selectedTenantCnpj;
                  return (
                    <tr
                      key={tenant.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                          {tenant.cnpjCompleto}
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Empresa Ativa" />
                          )}
                        </div>
                        <div className="font-semibold text-white truncate max-w-xs">{tenant.razaoSocial}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{tenant.nomeFantasia}</div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 text-[11px]">
                          {tenant.uf}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/60 text-[10px]">
                          {tenant.regimeTributario}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {tenant.grupoContabilCliente || 'Geral'}
                      </td>

                      <td className="py-3 px-3">
                        {tenant.certificadoA1 ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                            <Key className="w-3.5 h-3.5" />
                            <span>Venc: {tenant.certificadoA1.validade}</span>
                          </div>
                        ) : (
                          <span className="text-amber-400 font-semibold text-[11px] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-cyan-300">
                        {tenant.totalDocumentosCapturados.toLocaleString('pt-BR')}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isSelected ? (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold">
                              Ativo
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                onSelectTenantCnpj(tenant.cnpjCompleto);
                                if (tenant.id) {
                                  const res = await post<{ success: boolean; accessToken: string; empresaAtiva: any }>('/auth/switch-empresa', {
                                    empresaId: tenant.id
                                  });
                                  if (res.ok && res.data?.accessToken && res.data?.empresaAtiva) {
                                    switchEmpresa(res.data.empresaAtiva, res.data.accessToken);
                                  }
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white text-[11px] font-bold cursor-pointer"
                            >
                              Ativar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(tenant)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white cursor-pointer"
                            title="Editar Dados & SPED"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCertModalTenant(tenant);
                              setCertFile(null);
                              setCertPassword('');
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white cursor-pointer"
                            title="Gerenciar Certificado A1"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTenant(tenant.id, tenant.cnpjCompleto, tenant.razaoSocial)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL ADD NEW TENANT CNPJ (4 TABS) ────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-5 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Novo Cadastro de Empresa & Configuração SPED Bloco 0
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cadastre a empresa cliente preenchendo os dados ou usando a consulta automática da Receita Federal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalTab('identificacao')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  modalTab === 'identificacao'
                    ? 'bg-blue-950 text-blue-200 border border-blue-700 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4 text-blue-400" />
                1. Identificação & Fisco (0000)
              </button>

              <button
                type="button"
                onClick={() => setModalTab('endereco')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  modalTab === 'endereco'
                    ? 'bg-emerald-950 text-emerald-200 border border-emerald-700 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MapPin className="w-4 h-4 text-emerald-400" />
                2. Endereço & Contato (0005)
              </button>

              <button
                type="button"
                onClick={() => setModalTab('contador')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  modalTab === 'contador'
                    ? 'bg-indigo-950 text-indigo-200 border border-indigo-700 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-4 h-4 text-indigo-400" />
                3. Contador Responsável (0100)
              </button>

              <button
                type="button"
                onClick={() => setModalTab('sped')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  modalTab === 'sped'
                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-700 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-4 h-4 text-cyan-400" />
                4. Automatismo SPED Bloco 0
              </button>
            </div>

            <form onSubmit={handleAddTenant} className="space-y-4 text-xs">
              
              {/* TAB 1: IDENTIFICAÇÃO */}
              {modalTab === 'identificacao' && (
                <div className="space-y-3">
                  
                  {/* Auto-Lookup bar inside Modal */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-cyan-800/40 flex flex-col sm:flex-row items-center gap-2">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold shrink-0">
                      <Zap className="w-4 h-4" />
                      <span>Autopreencher por CNPJ:</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Cole o CNPJ para buscar na Receita..."
                      value={newCnpj}
                      onChange={(e) => setNewCnpj(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      disabled={isQuickSearching || !newCnpj.trim()}
                      onClick={() => handlePerformCnpjLookup(newCnpj, newUf)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isQuickSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>Preencher Automaticamente</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CNPJ *</label>
                      <input
                        type="text"
                        placeholder="00.000.000/0000-00"
                        value={newCnpj}
                        onChange={(e) => setNewCnpj(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Razão Social *</label>
                      <input
                        type="text"
                        placeholder="Razão Social da Empresa..."
                        value={newRazaoSocial}
                        onChange={(e) => setNewRazaoSocial(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Nome Fantasia</label>
                      <input
                        type="text"
                        placeholder="Nome Fantasia..."
                        value={newNomeFantasia}
                        onChange={(e) => setNewNomeFantasia(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Inscrição Estadual (IE)</label>
                      <input
                        type="text"
                        placeholder="Ex: 81281882 ou ISENTO"
                        value={newIe}
                        onChange={(e) => setNewIe(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Inscrição Municipal (IM)</label>
                      <input
                        type="text"
                        placeholder="Ex: 1234567-8"
                        value={newIm}
                        onChange={(e) => setNewIm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">UF da Matriz/Filial</label>
                      <select
                        value={newUf}
                        onChange={(e) => setNewUf(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      >
                        {UF_LIST.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Regime Tributário</label>
                      <select
                        value={newRegime}
                        onChange={(e) => setNewRegime(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="Real">Lucro Real</option>
                        <option value="Presumido">Lucro Presumido</option>
                        <option value="Simples Nacional">Simples Nacional</option>
                        <option value="MEI">MEI</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Perfil SPED Fiscal</label>
                      <select
                        value={newPerfilSped}
                        onChange={(e) => setNewPerfilSped(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="A">Perfil A (Mais Detalhado)</option>
                        <option value="B">Perfil B (Médio)</option>
                        <option value="C">Perfil C (Simplificado)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Tipo de Atividade</label>
                      <select
                        value={newIndAtiv}
                        onChange={(e) => setNewIndAtiv(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="0">0 - Industrial ou Equiparado</option>
                        <option value="1">1 - Outros (Comércio / Serviços)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CNAE Principal</label>
                      <input
                        type="text"
                        placeholder="Ex: 6622300 ou 6201501"
                        value={newCnae}
                        onChange={(e) => setNewCnae(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Inscrição SUFRAMA</label>
                      <input
                        type="text"
                        placeholder="Se aplicável (9 dígitos)"
                        value={newSuframa}
                        onChange={(e) => setNewSuframa(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Grupo Contábil / Carteira</label>
                      <input
                        type="text"
                        value={newGrupo}
                        onChange={(e) => setNewGrupo(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* PARÂMETRO: MANIFESTAÇÃO AUTOMÁTICA DE CIÊNCIA (SEFAZ - 210210) */}
                  <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-slate-950 border border-cyan-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-white text-xs">Manifestação Automática de Ciência da Operação (SEFAZ - 210210)</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">Recomendado</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Ao consultar novos documentos via WebService <code className="text-cyan-300 font-mono">NFeDistribuicaoDFe</code>, manifesta automaticamente a Ciência da Emissão para liberar o download do XML completo com produtos e tributos.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={newManifestarCiencia}
                        onChange={(e) => setNewManifestarCiencia(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: ENDEREÇO & CONTATO (SPED 0005) */}
              {modalTab === 'endereco' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CEP</label>
                      <input
                        type="text"
                        placeholder="00000-000"
                        value={newCep}
                        onChange={(e) => setNewCep(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Logradouro</label>
                      <input
                        type="text"
                        placeholder="Avenida / Rua / Alameda..."
                        value={newLogradouro}
                        onChange={(e) => setNewLogradouro(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Número</label>
                      <input
                        type="text"
                        placeholder="Ex: 1000 ou S/N"
                        value={newNumero}
                        onChange={(e) => setNewNumero(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Complemento</label>
                      <input
                        type="text"
                        placeholder="Sala / Bloco / Andar"
                        value={newComplemento}
                        onChange={(e) => setNewComplemento(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Bairro</label>
                      <input
                        type="text"
                        placeholder="Bairro"
                        value={newBairro}
                        onChange={(e) => setNewBairro(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Município</label>
                      <input
                        type="text"
                        placeholder="Nome do Município"
                        value={newMunicipio}
                        onChange={(e) => setNewMunicipio(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Cód. IBGE (7 dígitos)</label>
                      <input
                        type="text"
                        placeholder="Ex: 3550308"
                        value={newCodMunIbge}
                        onChange={(e) => setNewCodMunIbge(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">UF</label>
                      <input
                        type="text"
                        value={newUf}
                        disabled
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Telefone Principal</label>
                      <input
                        type="text"
                        placeholder="(11) 3000-0000"
                        value={newTelefone}
                        onChange={(e) => setNewTelefone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">E-mail Fiscal / Contábil</label>
                      <input
                        type="email"
                        placeholder="fiscal@empresa.com.br"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CONTADOR (SPED 0100) */}
              {modalTab === 'contador' && (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-indigo-300 text-xs">
                    <strong>Registro |0100| do SPED:</strong> Cadastro do Contabilista / Contador responsável técnico pela escrituração contábil e fiscal da empresa.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Nome do Contador Responsável (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Nome Completo do Contador (Opcional)..."
                        value={newContadorNome}
                        onChange={(e) => setNewContadorNome(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CPF do Contador (Opcional)</label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={newContadorCpf}
                        onChange={(e) => setNewContadorCpf(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Registro no CRC (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: SP-123456/O-0"
                        value={newContadorCrc}
                        onChange={(e) => setNewContadorCrc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">UF do CRC</label>
                      <select
                        value={newContadorUfCrc}
                        onChange={(e) => setNewContadorUfCrc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      >
                        {UF_LIST.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CNPJ do Escritório Contábil</label>
                      <input
                        type="text"
                        placeholder="Se PJ (00.000.000/0000-00)"
                        value={newContadorCnpjEscritorio}
                        onChange={(e) => setNewContadorCnpjEscritorio(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CEP do Escritório</label>
                      <input
                        type="text"
                        placeholder="00000-000"
                        value={newContadorCep}
                        onChange={(e) => setNewContadorCep(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Endereço do Escritório</label>
                      <input
                        type="text"
                        placeholder="Avenida / Rua..."
                        value={newContadorLogradouro}
                        onChange={(e) => setNewContadorLogradouro(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Telefone do Contador</label>
                      <input
                        type="text"
                        placeholder="(11) 3200-0000"
                        value={newContadorTelefone}
                        onChange={(e) => setNewContadorTelefone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">E-mail do Contador</label>
                      <input
                        type="email"
                        placeholder="contador@escritorio.com.br"
                        value={newContadorEmail}
                        onChange={(e) => setNewContadorEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: AUTOMATISMO SPED BLOCO 0 */}
              {modalTab === 'sped' && (
                <div className="space-y-4">
                  {(() => {
                    const tempTenant: Partial<ClienteEmpresaTenant> = {
                      cnpjCompleto: newCnpj,
                      razaoSocial: newRazaoSocial,
                      nomeFantasia: newNomeFantasia,
                      uf: newUf,
                      ie: newIe,
                      im: newIm,
                      cnaePrincipal: newCnae,
                      codMunicipioIbge: newCodMunIbge,
                      perfilSped: newPerfilSped,
                      indAtiv: newIndAtiv,
                      endereco: {
                        cep: newCep,
                        logradouro: newLogradouro,
                        numero: newNumero,
                        complemento: newComplemento,
                        bairro: newBairro,
                        municipio: newMunicipio,
                        uf: newUf,
                        codMunicipioIbge: newCodMunIbge,
                        telefone: newTelefone,
                        email: newEmail
                      },
                      contador: {
                        nome: newContadorNome,
                        cpf: newContadorCpf,
                        crc: newContadorCrc,
                        ufCrc: newContadorUfCrc,
                        cnpjEscritorio: newContadorCnpjEscritorio,
                        cep: newContadorCep,
                        logradouro: newContadorLogradouro,
                        numero: newContadorNumero,
                        complemento: newContadorComplemento,
                        bairro: newContadorBairro,
                        codMunicipioIbge: newContadorCodMun,
                        municipio: newMunicipio,
                        uf: newUf,
                        telefone: newContadorTelefone,
                        email: newContadorEmail
                      }
                    };
                    const sped = generateSpedLines(tempTenant);
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl">
                          <div>
                            <h4 className="font-bold text-cyan-300 text-xs">
                              Pré-visualização do Bloco 0 da Empresa
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              Layout oficial pronto para ser emitido e validado no PVA da Receita Federal.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleExportSpedTxt(tempTenant)}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Baixar BLOCO_0.TXT
                          </button>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-cyan-400 text-xs">|0000| Abertura e Identificação</span>
                            <button
                              type="button"
                              onClick={() => handleCopySped(sped.r0000, '0000_new')}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedSped === '0000_new' ? 'Copiado!' : 'Copiar'}
                            </button>
                          </div>
                          <pre className="p-2 bg-slate-900 rounded-lg font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                            {sped.r0000}
                          </pre>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-emerald-400 text-xs">|0005| Dados Complementares de Endereço</span>
                            <button
                              type="button"
                              onClick={() => handleCopySped(sped.r0005, '0005_new')}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedSped === '0005_new' ? 'Copiado!' : 'Copiar'}
                            </button>
                          </div>
                          <pre className="p-2 bg-slate-900 rounded-lg font-mono text-[11px] text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                            {sped.r0005}
                          </pre>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-indigo-400 text-xs">|0100| Contabilista Responsável</span>
                            <button
                              type="button"
                              onClick={() => handleCopySped(sped.r0100, '0100_new')}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedSped === '0100_new' ? 'Copiado!' : 'Copiar'}
                            </button>
                          </div>
                          <pre className="p-2 bg-slate-900 rounded-lg font-mono text-[11px] text-amber-300 overflow-x-auto whitespace-pre-wrap">
                            {sped.r0100}
                          </pre>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                <div className="text-slate-400 text-[11px]">
                  💡 Ao salvar, a empresa ficará disponível no seletor e pronta para vincular o Certificado A1 (.PFX).
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold cursor-pointer shadow-lg shadow-blue-600/20"
                  >
                    Salvar e Alocar Empresa
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Editar CNPJ / Cliente & Configuração SPED Bloco 0 */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-5 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Ficha Cadastral & Configuração SPED Bloco 0
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {editingTenant.razaoSocial} ({editingTenant.cnpjCompleto})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTenant(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalTab('identificacao')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  modalTab === 'identificacao'
                    ? 'bg-blue-950 text-blue-200 border border-blue-700 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4 text-blue-400" />
                1. Identificação & Fisco (0000)
              </button>

              <button
                type="button"
                onClick={() => setModalTab('endereco')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  modalTab === 'endereco'
                    ? 'bg-emerald-950 text-emerald-200 border border-emerald-700 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MapPin className="w-4 h-4 text-emerald-400" />
                2. Endereço & Contato (0005)
              </button>

              <button
                type="button"
                onClick={() => setModalTab('contador')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  modalTab === 'contador'
                    ? 'bg-indigo-950 text-indigo-200 border border-indigo-700 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-4 h-4 text-indigo-400" />
                3. Contador Responsável (0100)
              </button>

              <button
                type="button"
                onClick={() => setModalTab('sped')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  modalTab === 'sped'
                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-700 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-4 h-4 text-cyan-400" />
                4. Automatismo SPED Bloco 0
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              
              {/* TAB 1: IDENTIFICAÇÃO */}
              {modalTab === 'identificacao' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CNPJ (Somente Leitura)</label>
                      <input
                        type="text"
                        value={editingTenant.cnpjCompleto}
                        disabled
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-500 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Razão Social *</label>
                      <input
                        type="text"
                        value={editingTenant.razaoSocial}
                        onChange={(e) => setEditingTenant({ ...editingTenant, razaoSocial: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Nome Fantasia</label>
                      <input
                        type="text"
                        value={editingTenant.nomeFantasia}
                        onChange={(e) => setEditingTenant({ ...editingTenant, nomeFantasia: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Inscrição Estadual (IE)</label>
                      <input
                        type="text"
                        placeholder="Ex: 81281882 ou ISENTO"
                        value={editingTenant.ie || ''}
                        onChange={(e) => setEditingTenant({ ...editingTenant, ie: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Inscrição Municipal (IM)</label>
                      <input
                        type="text"
                        placeholder="Ex: 1234567-8"
                        value={editingTenant.im || ''}
                        onChange={(e) => setEditingTenant({ ...editingTenant, im: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">UF da Matriz/Filial</label>
                      <select
                        value={editingTenant.uf}
                        onChange={(e) => setEditingTenant({ ...editingTenant, uf: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      >
                        {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'DF', 'PE', 'CE', 'AM', 'GO'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Regime Tributário</label>
                      <select
                        value={editingTenant.regimeTributario}
                        onChange={(e) => setEditingTenant({ ...editingTenant, regimeTributario: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="Real">Lucro Real</option>
                        <option value="Presumido">Lucro Presumido</option>
                        <option value="Simples Nacional">Simples Nacional</option>
                        <option value="MEI">MEI</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Perfil SPED Fiscal</label>
                      <select
                        value={editingTenant.perfilSped || 'A'}
                        onChange={(e) => setEditingTenant({ ...editingTenant, perfilSped: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="A">Perfil A (Mais Detalhado)</option>
                        <option value="B">Perfil B (Médio)</option>
                        <option value="C">Perfil C (Simplificado)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Tipo de Atividade</label>
                      <select
                        value={editingTenant.indAtiv || '0'}
                        onChange={(e) => setEditingTenant({ ...editingTenant, indAtiv: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      >
                        <option value="0">0 - Industrial ou Equiparado</option>
                        <option value="1">1 - Outros (Comércio / Serviços)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CNAE Principal</label>
                      <input
                        type="text"
                        placeholder="Ex: 0600001 ou 6201501"
                        value={editingTenant.cnaePrincipal || ''}
                        onChange={(e) => setEditingTenant({ ...editingTenant, cnaePrincipal: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Inscrição SUFRAMA</label>
                      <input
                        type="text"
                        placeholder="Se aplicável (9 dígitos)"
                        value={editingTenant.suframa || ''}
                        onChange={(e) => setEditingTenant({ ...editingTenant, suframa: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Grupo Contábil / Carteira</label>
                      <input
                        type="text"
                        value={editingTenant.grupoContabilCliente || ''}
                        onChange={(e) => setEditingTenant({ ...editingTenant, grupoContabilCliente: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Opção Manifestação Automática de Ciência da Operação */}
                  <div className="p-3.5 bg-cyan-950/30 border border-cyan-800/60 rounded-2xl flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-slate-100 text-xs">
                          Manifestar Ciência da Emissão Automaticamente (Evento 210210 na SEFAZ)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Quando ativado, a SEFAZ autoriza o download do XML completo (<code className="text-cyan-300">procNFe</code>) automaticamente sem retenção fiscal.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={editingTenant.manifestarCienciaAutomatica !== false}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          manifestarCienciaAutomatica: e.target.checked
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: ENDEREÇO & CONTATO (SPED 0005) */}
              {modalTab === 'endereco' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CEP</label>
                      <input
                        type="text"
                        placeholder="00000-000"
                        value={editingTenant.endereco?.cep || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          endereco: { ...editingTenant.endereco, cep: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Logradouro</label>
                      <input
                        type="text"
                        placeholder="Avenida / Rua / Alameda..."
                        value={editingTenant.endereco?.logradouro || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          endereco: { ...editingTenant.endereco, logradouro: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Número</label>
                      <input
                        type="text"
                        placeholder="Ex: 1000 ou S/N"
                        value={editingTenant.endereco?.numero || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          endereco: { ...editingTenant.endereco, numero: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Complemento</label>
                      <input
                        type="text"
                        placeholder="Sala / Bloco / Andar"
                        value={editingTenant.endereco?.complemento || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          endereco: { ...editingTenant.endereco, complemento: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Bairro</label>
                      <input
                        type="text"
                        placeholder="Bairro"
                        value={editingTenant.endereco?.bairro || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          endereco: { ...editingTenant.endereco, bairro: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Município</label>
                      <input
                        type="text"
                        placeholder="Nome do Município"
                        value={editingTenant.endereco?.municipio || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          endereco: { ...editingTenant.endereco, municipio: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Cód. IBGE (7 dígitos)</label>
                      <input
                        type="text"
                        placeholder="Ex: 3550308"
                        value={editingTenant.codMunicipioIbge || editingTenant.endereco?.codMunicipioIbge || '3550308'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingTenant({
                            ...editingTenant,
                            codMunicipioIbge: val,
                            endereco: { ...editingTenant.endereco, codMunicipioIbge: val }
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">UF</label>
                      <input
                        type="text"
                        value={editingTenant.uf}
                        disabled
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Telefone Principal</label>
                      <input
                        type="text"
                        placeholder="(11) 3000-0000"
                        value={editingTenant.endereco?.telefone || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          endereco: { ...editingTenant.endereco, telefone: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">E-mail Fiscal / Contábil</label>
                      <input
                        type="email"
                        placeholder="fiscal@empresa.com.br"
                        value={editingTenant.endereco?.email || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          endereco: { ...editingTenant.endereco, email: e.target.value }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CONTADOR (SPED 0100) */}
              {modalTab === 'contador' && (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-indigo-300 text-xs">
                    <strong>Registro |0100| do SPED:</strong> Cadastro do Contabilista / Contador responsável técnico pela escrituração contábil e fiscal da empresa.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Nome do Contador Responsável (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Nome Completo do Contador (Opcional)..."
                        value={editingTenant.contador?.nome || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          contador: { ...editingTenant.contador, nome: e.target.value, cpf: editingTenant.contador?.cpf || '', crc: editingTenant.contador?.crc || '' }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CPF do Contador (Opcional)</label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={editingTenant.contador?.cpf || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          contador: { ...editingTenant.contador, cpf: e.target.value, nome: editingTenant.contador?.nome || '', crc: editingTenant.contador?.crc || '' }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Registro no CRC (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: SP-123456/O-0"
                        value={editingTenant.contador?.crc || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          contador: { ...editingTenant.contador, crc: e.target.value, nome: editingTenant.contador?.nome || '', cpf: editingTenant.contador?.cpf || '' }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">UF do CRC</label>
                      <select
                        value={editingTenant.contador?.ufCrc || editingTenant.uf}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          contador: { ...editingTenant.contador, ufCrc: e.target.value, nome: editingTenant.contador?.nome || '', cpf: editingTenant.contador?.cpf || '', crc: editingTenant.contador?.crc || '' }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      >
                        {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'DF', 'PE', 'CE', 'AM', 'GO'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CNPJ do Escritório Contábil</label>
                      <input
                        type="text"
                        placeholder="Se PJ (00.000.000/0000-00)"
                        value={editingTenant.contador?.cnpjEscritorio || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          contador: { ...editingTenant.contador, cnpjEscritorio: e.target.value, nome: editingTenant.contador?.nome || '', cpf: editingTenant.contador?.cpf || '', crc: editingTenant.contador?.crc || '' }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">CEP do Escritório</label>
                      <input
                        type="text"
                        placeholder="00000-000"
                        value={editingTenant.contador?.cep || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          contador: { ...editingTenant.contador, cep: e.target.value, nome: editingTenant.contador?.nome || '', cpf: editingTenant.contador?.cpf || '', crc: editingTenant.contador?.crc || '' }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-300 block mb-1">Endereço do Escritório</label>
                      <input
                        type="text"
                        placeholder="Avenida / Rua..."
                        value={editingTenant.contador?.logradouro || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          contador: { ...editingTenant.contador, logradouro: e.target.value, nome: editingTenant.contador?.nome || '', cpf: editingTenant.contador?.cpf || '', crc: editingTenant.contador?.crc || '' }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Telefone do Contador</label>
                      <input
                        type="text"
                        placeholder="(11) 3200-0000"
                        value={editingTenant.contador?.telefone || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          contador: { ...editingTenant.contador, telefone: e.target.value, nome: editingTenant.contador?.nome || '', cpf: editingTenant.contador?.cpf || '', crc: editingTenant.contador?.crc || '' }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1">E-mail do Contador</label>
                      <input
                        type="email"
                        placeholder="contador@escritorio.com.br"
                        value={editingTenant.contador?.email || ''}
                        onChange={(e) => setEditingTenant({
                          ...editingTenant,
                          contador: { ...editingTenant.contador, email: e.target.value, nome: editingTenant.contador?.nome || '', cpf: editingTenant.contador?.cpf || '', crc: editingTenant.contador?.crc || '' }
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: AUTOMATISMO SPED BLOCO 0 */}
              {modalTab === 'sped' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl">
                    <div>
                      <h4 className="font-bold text-cyan-300 text-xs">
                        Estrutura do Bloco 0 (Abertura, Identificação, Contador e Participantes)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Linhas geradas no layout oficial do Guia Prático da EFD ICMS/IPI e EFD Contribuições.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExportSpedTxt(editingTenant)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar BLOCO_0.TXT
                    </button>
                  </div>

                  {(() => {
                    const sped = generateSpedLines(editingTenant);
                    return (
                      <div className="space-y-3">
                        {/* Registro 0000 */}
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-cyan-400 text-xs">|0000| Abertura e Identificação da Entidade</span>
                            <button
                              type="button"
                              onClick={() => handleCopySped(sped.r0000, '0000')}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedSped === '0000' ? 'Copiado!' : 'Copiar'}
                            </button>
                          </div>
                          <pre className="p-2 bg-slate-900 rounded-lg font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                            {sped.r0000}
                          </pre>
                        </div>

                        {/* Registro 0005 */}
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-emerald-400 text-xs">|0005| Dados Complementares da Entidade</span>
                            <button
                              type="button"
                              onClick={() => handleCopySped(sped.r0005, '0005')}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedSped === '0005' ? 'Copiado!' : 'Copiar'}
                            </button>
                          </div>
                          <pre className="p-2 bg-slate-900 rounded-lg font-mono text-[11px] text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                            {sped.r0005}
                          </pre>
                        </div>

                        {/* Registro 0100 */}
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-indigo-400 text-xs">|0100| Dados do Contabilista / Contador</span>
                            <button
                              type="button"
                              onClick={() => handleCopySped(sped.r0100, '0100')}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedSped === '0100' ? 'Copiado!' : 'Copiar'}
                            </button>
                          </div>
                          <pre className="p-2 bg-slate-900 rounded-lg font-mono text-[11px] text-amber-300 overflow-x-auto whitespace-pre-wrap">
                            {sped.r0100}
                          </pre>
                        </div>

                        {/* Registro 0150 */}
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-purple-400 text-xs">|0150| Tabela de Cadastro do Participante (Clientes / Fornecedores)</span>
                            <button
                              type="button"
                              onClick={() => handleCopySped(sped.r0150Exemplo, '0150')}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedSped === '0150' ? 'Copiado!' : 'Copiar'}
                            </button>
                          </div>
                          <pre className="p-2 bg-slate-900 rounded-lg font-mono text-[11px] text-purple-300 overflow-x-auto whitespace-pre-wrap">
                            {sped.r0150Exemplo}
                          </pre>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                <div className="text-slate-400 text-[11px]">
                  💡 Os dados alimentam os módulos de DF-e, SPED Fiscal e Reinf.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTenant(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold cursor-pointer shadow-lg"
                  >
                    Salvar Dados & SPED
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ativar / Vincular Certificado Digital A1 */}
      {certModalTenant && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Vincular Certificado Digital A1
                  </h3>
                  <p className="text-xs text-cyan-300 font-mono">
                    {certModalTenant.razaoSocial} ({certModalTenant.cnpjCompleto})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCertModalTenant(null)}
                className="text-slate-400 hover:text-white text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCertSubmit} className="space-y-4 text-xs">
              {/* Step 1: File selection */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
                  <span>1. Selecione o arquivo do Certificado (.PFX ou .P12) *</span>
                  {certFile && (
                    <span className="text-[10px] text-emerald-400 font-normal flex items-center gap-1">
                      <Check className="w-3 h-3" /> Arquivo pronto
                    </span>
                  )}
                </label>
                <div
                  onClick={() => certFileInputRef.current?.click()}
                  className={`p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center ${
                    certFile
                      ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300 shadow-inner'
                      : 'border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-slate-950 text-slate-400'
                  }`}
                >
                  <input
                    ref={certFileInputRef}
                    type="file"
                    accept=".pfx,.p12,.pem"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setCertFile(e.target.files[0]);
                    }}
                  />
                  {certFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <FileCheck className="w-5 h-5 text-emerald-400" />
                        <span className="font-mono">{certFile.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Tamanho: {(certFile.size / 1024).toFixed(1)} KB (Clique para trocar de arquivo)
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-indigo-400" />
                      <span className="text-xs font-semibold text-slate-200">
                        Clique aqui para escolher o arquivo .PFX ou .P12
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Padrão ICP-Brasil (e-CNPJ A1)
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Step 2: Password */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">
                  2. Senha do Certificado Digital A1 *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    placeholder="Digite a senha de proteção do arquivo..."
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer p-1"
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>A senha e a chave privada são criptografadas com AES-256-GCM no cofre seguro.</span>
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCertModalTenant(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!certFile || !certPassword || isCertSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2"
                >
                  {isCertSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Validando e Ativando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                      <span>Validar e Ativar Certificado</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
