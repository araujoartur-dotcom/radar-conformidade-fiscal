import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  Search,
  CheckCircle2,
  FileCode,
  Download,
  ShieldCheck,
  Globe,
  Database,
  ArrowRight,
  FolderInput,
  FolderOutput,
  Key,
  Server,
  Send,
  Building2
} from 'lucide-react';
import { CertificadoA1, AmbienteSefaz, DfeXmlItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/apiConfig';

interface ConsultaNsuModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificado: CertificadoA1;
  ambienteSefaz: AmbienteSefaz;
  onImportDfeItems: (items: DfeXmlItem[]) => void;
  defaultFluxo?: 'entrada' | 'saida';
}

export const ConsultaNsuModal: React.FC<ConsultaNsuModalProps> = ({
  isOpen,
  onClose,
  certificado,
  ambienteSefaz,
  onImportDfeItems,
  defaultFluxo = 'entrada'
}) => {
  const { token, empresaAtiva } = useAuth();
  const [fluxo, setFluxo] = useState<'entrada' | 'saida'>(defaultFluxo);
  const [ultNSU, setUltNSU] = useState<string>('000000000000000');
  const [isConsulting, setIsConsulting] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<DfeXmlItem[] | null>(null);
  const [cStat, setCStat] = useState<string>('');
  const [xMotivo, setXMotivo] = useState<string>('');
  const [consultaError, setConsultaError] = useState<string>('');

  // Editable CNPJ and Razao Social in Modal
  const [cnpjInput, setCnpjInput] = useState<string>(certificado?.cnpj || '');
  const [razaoInput, setRazaoInput] = useState<string>(certificado?.razãoSocial || '');

  React.useEffect(() => {
    if (certificado?.cnpj) setCnpjInput(certificado.cnpj);
    if (certificado?.razãoSocial) setRazaoInput(certificado.razãoSocial);
  }, [certificado]);

  if (!isOpen) return null;

  const handleStartConsultaDFe = async () => {
    setIsConsulting(true);
    setLogs([]);
    setResults(null);
    setCStat('');
    setXMotivo('');
    setConsultaError('');

    const currentCnpj = cnpjInput || certificado?.cnpj || '';
    const currentRazao = razaoInput || certificado?.razãoSocial || '';
    const ambCode = ambienteSefaz === 'homologacao' ? '2' : '1';
    const ambLabel = ambienteSefaz === 'homologacao' ? 'HOMOLOGAÇÃO (tpAmb = 2)' : 'PRODUÇÃO (tpAmb = 1)';
    const wsName = fluxo === 'entrada' ? 'NFeDistribuicaoDFe' : 'NFeDistribuicaoDFe';

    const addLog = (msg: string) => {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`]);
    };

    if (!currentCnpj || currentCnpj.replace(/\D/g, '').length < 14) {
      addLog(`❌ CNPJ não informado ou inválido. Informe o CNPJ da empresa.`);
      setConsultaError('CNPJ não informado ou inválido.');
      setIsConsulting(false);
      return;
    }

    if (certificado?.status !== 'valido' || !certificado?.fileName) {
      addLog(`❌ Nenhum Certificado Digital A1 ativo para o CNPJ ${currentCnpj}.`);
      addLog(`A comunicação com o WebService ${wsName} da SEFAZ requer certificado A1 (.pfx) vinculado.`);
      addLog(`Vincule um certificado A1 válido na Carteira de CNPJs antes de consultar.`);
      setConsultaError('Certificado Digital A1 não configurado. Vincule um .pfx válido na Carteira de CNPJs.');
      setIsConsulting(false);
      return;
    }

    addLog(`Iniciando consulta de XMLs ${fluxo === 'entrada' ? 'DESTINADOS ao' : 'EMITIDOS pelo'} CNPJ ${currentCnpj}...`);
    addLog(`WebService: ${wsName} (SEFAZ Nacional - Ambiente Nacional AN) | Certificado A1: ${certificado.fileName}`);
    addLog(`Autenticando CNPJ no ambiente ${ambLabel}`);

    const endpointUrl = ambienteSefaz === 'homologacao'
      ? 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
      : 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

    addLog(`Enviando envelope SOAP 1.2 para ${endpointUrl}`);
    addLog(`Parâmetros: tpAmb=${ambCode}, cOrgaoAuthor=91 (AN), ultNSU=${ultNSU}`);

    try {
      const effectiveToken = token || localStorage.getItem('@RadarFiscal:token') || localStorage.getItem('radar_fiscal_token') || '';

      const response = await fetch(`${getApiBaseUrl()}/sefaz/distribui-dfe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          cnpj: currentCnpj.replace(/\D/g, ''),
          ultNSU,
          tpAmb: ambCode,
          fluxo,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        const errorMsg = errorData.error || errorData.message || `Erro HTTP ${response.status}`;
        addLog(`❌ Erro na comunicação com o backend: ${errorMsg}`);

        if (response.status === 404) {
          addLog(`⚠️ Endpoint /sefaz/distribui-dfe não encontrado no backend.`);
          setConsultaError('Endpoint de Distribuição DF-e não localizado no backend.');
        } else {
          setConsultaError(errorMsg);
        }

        setCStat(errorData.cStat || '999');
        setXMotivo(errorMsg);
        setIsConsulting(false);
        return;
      }

      const data = await response.json();

      addLog(`Resposta SEFAZ recebida com sucesso! HTTP 200 OK.`);
      setCStat(data.cStat || '138');
      setXMotivo(data.xMotivo || 'Documentos localizados.');
      addLog(`cStat: ${data.cStat} - ${data.xMotivo}`);

      if (data.docs && data.docs.length > 0) {
        addLog(`Descompactando lote de XMLs (GZip Base64)...`);
        const folderCode = currentCnpj.replace(/\D/g, '').substring(0, 8) || '00000000';
        addLog(`Download concluído: ${data.docs.length} novo(s) XML(s) de ${fluxo === 'entrada' ? 'ENTRADA (Compras)' : 'SAÍDA (Vendas)'}.`);
        addLog(`Diretório Alvo: C:\\SEFAZ\\XMLs\\${folderCode}\\${fluxo === 'entrada' ? 'Entrada' : 'Saida'}\\`);

        if (data.ultNSU) {
          setUltNSU(data.ultNSU);
        }

        setResults(data.docs);
      } else {
        addLog(`ℹ️ Nenhum novo documento encontrado após NSU ${ultNSU}.`);
        if (data.cStat === '137') {
          addLog(`cStat 137: Nenhum documento localizado para o CNPJ destinatário.`);
        }
        setResults([]);
      }

    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        addLog(`❌ Timeout: A SEFAZ não respondeu dentro de 60 segundos.`);
        setConsultaError('Timeout na comunicação com a SEFAZ (60s).');
      } else {
        addLog(`❌ Erro de rede: ${err.message}`);
        setConsultaError(`Erro de rede: ${err.message}`);
      }
      setCStat('999');
      setXMotivo(`Erro de comunicação: ${err.message}`);
    } finally {
      setIsConsulting(false);
    }
  };

  const handleConfirmImport = () => {
    if (results && results.length > 0) {
      onImportDfeItems(results);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${
              fluxo === 'entrada' ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20' : 'bg-gradient-to-br from-emerald-600 to-teal-600 shadow-emerald-500/20'
            }`}>
              {fluxo === 'entrada' ? <FolderInput className="w-5 h-5" /> : <FolderOutput className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {fluxo === 'entrada' ? 'Consulta de XMLs de ENTRADA (Compras)' : 'Sincronização de XMLs de SAÍDA (Vendas / Emitidas)'}
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  ambienteSefaz === 'homologacao'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                }`}>
                  {ambienteSefaz === 'homologacao' ? 'Homologação (tpAmb=2)' : 'Produção (tpAmb=1)'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {fluxo === 'entrada'
                  ? 'Captura via NSU no WebService nfeDistribuicaoDFe (Armazena em Diretório de ENTRADA).'
                  : 'Sincroniza notas emitidas pelo seu CNPJ e salva diretamente no Diretório de SAÍDA.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          
          {/* Fluxo Selector Tabs */}
          <div className="flex items-center bg-slate-900 p-1.5 rounded-xl border border-slate-800 gap-2">
            <button
              onClick={() => { setFluxo('entrada'); setResults(null); setLogs([]); }}
              className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                fluxo === 'entrada'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderInput className="w-4 h-4" />
              <span>📥 ENTRADAS (Compras / Recebidos)</span>
            </button>

            <button
              onClick={() => { setFluxo('saida'); setResults(null); setLogs([]); }}
              className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                fluxo === 'saida'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOutput className="w-4 h-4" />
              <span>📤 SAÍDAS (Vendas / Emitidos pelo meu CNPJ)</span>
            </button>
          </div>

          {/* Certificate & CNPJ Info */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-3">
              <Key className={`w-5 h-5 shrink-0 ${certificado?.status === 'valido' && certificado?.fileName ? 'text-emerald-400' : 'text-amber-400'}`} />
              <div>
                <span className="text-slate-400 block text-[11px]">Certificado Digital A1:</span>
                {certificado?.status === 'valido' && certificado?.fileName ? (
                  <>
                    <strong className="text-white font-mono">{certificado.fileName}</strong>
                    <span className="text-emerald-400 block text-[10px] font-semibold mt-0.5">
                      Autenticado & Válido até {certificado.validade}
                    </span>
                  </>
                ) : (
                  <>
                    <strong className="text-amber-400 font-mono">Sem Certificado Digital A1</strong>
                    <span className="text-amber-400/80 block text-[10px] font-semibold mt-0.5">
                      Vincule um arquivo .PFX na Carteira de CNPJs
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center gap-1">
              <label className="text-slate-400 text-[11px] font-semibold">
                {fluxo === 'entrada' ? 'CNPJ Destinatário (Sua Empresa):' : 'CNPJ Emitente (Sua Empresa):'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={cnpjInput}
                  onChange={(e) => setCnpjInput(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-mono font-bold w-full focus:outline-none focus:border-cyan-500"
                />
              </div>
              <input
                type="text"
                value={razaoInput}
                onChange={(e) => setRazaoInput(e.target.value)}
                placeholder="Razão Social / Nome da Empresa"
                className="bg-slate-950/60 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-300 w-full focus:outline-none focus:border-slate-600 truncate"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {fluxo === 'entrada' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Último NSU Consultado no WebService:
                  </label>
                  <input
                    type="text"
                    value={ultNSU}
                    onChange={(e) => setUltNSU(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-xs text-cyan-300 w-48 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              ) : (
                <div className="text-xs text-slate-300">
                  <span className="font-bold block text-emerald-400">Sincronização de XMLs Emitidos por este CNPJ:</span>
                  <span className="text-slate-400">Busca todas as notas fiscais emitidas no mês atual para arquivamento no Diretório de Saída.</span>
                </div>
              )}

              <button
                onClick={handleStartConsultaDFe}
                disabled={isConsulting}
                className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
                  fluxo === 'entrada'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isConsulting ? 'animate-spin' : ''}`} />
                {isConsulting
                  ? 'Consultando SEFAZ...'
                  : fluxo === 'entrada'
                  ? 'Buscar Novos XMLs Destinados (NSU)'
                  : 'Buscar & Arquivar XMLs Emitidos (Saída)'}
              </button>
            </div>
            
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              {fluxo === 'entrada' ? (
                <>
                  <FolderInput className="w-3.5 h-3.5 text-blue-400" />
                  XMLs salvos automaticamente na pasta: <code className="text-blue-300 font-mono">C:\SEFAZ\XMLs\{(cnpjInput || '00000000').replace(/\D/g, '').substring(0, 8)}\Entrada\</code>
                </>
              ) : (
                <>
                  <FolderOutput className="w-3.5 h-3.5 text-emerald-400" />
                  XMLs salvos automaticamente na pasta: <code className="text-emerald-300 font-mono">C:\SEFAZ\XMLs\{(cnpjInput || '00000000').replace(/\D/g, '').substring(0, 8)}\Saida\</code>
                </>
              )}
            </p>
          </div>

          {/* Real-time WebService Communication Logs */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  Log de Comunicação WebService / SEFAZ:
                </span>
                {cStat && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    cStat: {cStat} — {xMotivo}
                  </span>
                )}
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx} className="leading-tight hover:bg-slate-900/50 px-1 py-0.5 rounded">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results List */}
          {results && results.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Novos Documentos Encontrados ({results.length})
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {results.map((resItem) => (
                  <div key={resItem.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{resItem.tipo} Nº {resItem.numero}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {fluxo === 'entrada' ? `Emitido por: ${resItem.emitenteNome}` : `Cliente/Destino: ${resItem.destinatarioNome}`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Chave: {resItem.chaveAcesso}
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="font-bold text-emerald-400">
                        {resItem.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {fluxo === 'entrada' ? '📥 ENTRADA (Compras)' : '📤 SAÍDA (Vendas)'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            {fluxo === 'entrada' ? (
              <span className="text-blue-400 font-semibold flex items-center gap-1">
                <FolderInput className="w-4 h-4" /> Salvar em: Pasta de Entrada
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <FolderOutput className="w-4 h-4" /> Salvar em: Pasta de Saída
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Fechar
            </button>

            {results && results.length > 0 && (
              <button
                onClick={handleConfirmImport}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Adicionar {results.length} XMLs ao Painel
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

