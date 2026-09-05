import React, { useState } from 'react';
import { Search, Plug, CheckCircle2, XCircle, AlertCircle, Settings, MapPin, Key, X, Shield, KeyRound, Lock, Info } from 'lucide-react';
import { MunicipioConector, TipoAutenticacaoConector } from '../types';

const MOCK_MUNICIPIOS: MunicipioConector[] = [
  { ibge: '3550308', municipio: 'São Paulo', uf: 'SP', provedor: 'PMSP (Nota do Milhão)', tipoAutenticacao: 'certificado_a1', status: 'ativo', credenciaisConfiguradas: true },
  { ibge: '3304557', municipio: 'Rio de Janeiro', uf: 'RJ', provedor: 'Nota Carioca (ABRASF 1.0)', tipoAutenticacao: 'certificado_a1', status: 'configuracao_pendente' },
  { ibge: '3106200', municipio: 'Belo Horizonte', uf: 'MG', provedor: 'BHISS (ABRASF 2.04)', tipoAutenticacao: 'certificado_a1', status: 'inativo' },
  { ibge: '3509502', municipio: 'Campinas', uf: 'SP', provedor: 'ISSONLINE (DSF)', tipoAutenticacao: 'token_api', status: 'inativo' },
  { ibge: '4106902', municipio: 'Curitiba', uf: 'PR', provedor: 'Curitiba (ABRASF 2.04)', tipoAutenticacao: 'certificado_token', status: 'configuracao_pendente' },
  { ibge: '4314902', municipio: 'Porto Alegre', uf: 'RS', provedor: 'NFSE POA (ABRASF 2.04)', tipoAutenticacao: 'certificado_a1', status: 'ativo', credenciaisConfiguradas: true },
  { ibge: '5300108', municipio: 'Brasília', uf: 'DF', provedor: 'ISSNET', tipoAutenticacao: 'usuario_senha', status: 'inativo' },
  { ibge: '2927408', municipio: 'Salvador', uf: 'BA', provedor: 'Salvador (ABRASF 1.0)', tipoAutenticacao: 'token_api', status: 'inativo' },
];

const UFS = ['SP', 'RJ', 'MG', 'RS', 'PR', 'DF', 'BA', 'SC', 'GO', 'PE'];

export const ConectoresMunicipaisPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState('');
  const [municipios, setMunicipios] = useState<MunicipioConector[]>(MOCK_MUNICIPIOS);
  const [selectedMunicipio, setSelectedMunicipio] = useState<MunicipioConector | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    token: '',
    usuario: '',
    senha: '',
  });

  const filtered = municipios.filter(m => {
    const matchUf = selectedUf ? m.uf === selectedUf : true;
    const matchSearch = m.municipio.toLowerCase().includes(searchTerm.toLowerCase()) || m.ibge.includes(searchTerm);
    return matchUf && matchSearch;
  });

  const handleOpenConfig = (m: MunicipioConector) => {
    setSelectedMunicipio(m);
    setIsModalOpen(true);
    setFormData({ token: '', usuario: '', senha: '' });
  };

  const handleSaveConfig = () => {
    if (!selectedMunicipio) return;
    setMunicipios(prev => prev.map(m => {
      if (m.ibge === selectedMunicipio.ibge) {
        return { ...m, status: 'ativo', credenciaisConfiguradas: true };
      }
      return m;
    }));
    setIsModalOpen(false);
  };

  const getStatusBadge = (status: MunicipioConector['status']) => {
    switch (status) {
      case 'ativo': return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> ATIVO</span>;
      case 'inativo': return <span className="px-2.5 py-1 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30 text-[10px] font-bold flex items-center gap-1.5"><XCircle className="w-3 h-3" /> INATIVO</span>;
      case 'configuracao_pendente': return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> PENDENTE</span>;
      case 'erro_autenticacao': return <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> ERRO</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="glass-panel-glow rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Plug className="w-6 h-6 text-emerald-400" />
            Conectores Municipais
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Gestão de credenciais e integrações diretas com WebServices das prefeituras.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm">
            <span className="text-slate-400">Total Suportados:</span>
            <span className="text-emerald-400 font-bold">{municipios.length} Municípios</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="glass-panel-glow rounded-2xl p-5 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full max-w-xl relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-4" />
          <input
            type="text"
            placeholder="Pesquisar por município ou código IBGE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        
        <select
          value={selectedUf}
          onChange={(e) => setSelectedUf(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 min-w-[120px]"
        >
          <option value="">Todas as UFs</option>
          {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
        {filtered.map(m => (
          <div key={m.ibge} className="glass-panel-glow rounded-2xl p-5 flex flex-col gap-4 border border-slate-700/50 hover:border-emerald-500/50 transition-colors group">
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-slate-800/80 text-emerald-400 mt-1">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">{m.municipio} - {m.uf}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-mono">IBGE: {m.ibge}</p>
                </div>
              </div>
              {getStatusBadge(m.status)}
            </div>

            <div className="mt-2 bg-slate-900/50 rounded-xl p-3 border border-slate-800/80">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-400">Padrão: <strong className="text-slate-300">{m.provedor}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-400">Autenticação: <strong className="text-slate-300 uppercase">{m.tipoAutenticacao.replace('_', ' ')}</strong></span>
              </div>
            </div>

            <div className="mt-auto pt-2">
              <button
                onClick={() => handleOpenConfig(m)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-slate-700"
              >
                <Settings className="w-4 h-4" />
                Configurar Conexão
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center flex flex-col items-center justify-center text-slate-500">
            <Search className="w-12 h-12 mb-4 opacity-20" />
            <p>Nenhum município encontrado com os filtros atuais.</p>
          </div>
        )}
      </div>

      {/* Modal de Configuração */}
      {isModalOpen && selectedMunicipio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-emerald-950/30">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plug className="w-5 h-5 text-emerald-400" />
                  Conexão {selectedMunicipio.municipio} - {selectedMunicipio.uf}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Padrão {selectedMunicipio.provedor}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
              
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-200/90 flex gap-3">
                <Info className="w-5 h-5 text-emerald-400 shrink-0" />
                <p>
                  Esta prefeitura utiliza o padrão <strong>{selectedMunicipio.tipoAutenticacao.toUpperCase().replace('_', ' ')}</strong>. 
                  Preencha as informações abaixo para habilitar o robô de captura.
                </p>
              </div>

              {(selectedMunicipio.tipoAutenticacao === 'certificado_a1' || selectedMunicipio.tipoAutenticacao === 'certificado_token') && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Certificado Digital</label>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <Shield className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Certificado A1 da Empresa Atual</p>
                      <p className="text-xs text-slate-500 mt-0.5">O certificado já carregado será utilizado via mTLS.</p>
                    </div>
                  </div>
                </div>
              )}

              {(selectedMunicipio.tipoAutenticacao === 'token_api' || selectedMunicipio.tipoAutenticacao === 'certificado_token') && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Token de Integração (API)</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input 
                      type="text" 
                      value={formData.token}
                      onChange={e => setFormData({ ...formData, token: e.target.value })}
                      placeholder="Cole aqui o Token gerado no portal da Prefeitura..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {selectedMunicipio.tipoAutenticacao === 'usuario_senha' && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Usuário / Login</label>
                    <input 
                      type="text" 
                      value={formData.usuario}
                      onChange={e => setFormData({ ...formData, usuario: e.target.value })}
                      placeholder="Login de acesso web..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Senha</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input 
                        type="password" 
                        value={formData.senha}
                        onChange={e => setFormData({ ...formData, senha: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

            </div>

            <div className="p-5 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveConfig}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Salvar & Ativar Conector
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
