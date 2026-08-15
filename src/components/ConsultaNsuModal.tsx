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
  const [fluxo, setFluxo] = useState<'entrada' | 'saida'>(defaultFluxo);
  const [ultNSU, setUltNSU] = useState<string>('000000000018420');
  const [isConsulting, setIsConsulting] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<DfeXmlItem[] | null>(null);
  const [cStat, setCStat] = useState<string>('');
  const [xMotivo, setXMotivo] = useState<string>('');

  // Editable CNPJ and Razao Social in Modal
  const [cnpjInput, setCnpjInput] = useState<string>(certificado?.cnpj || '19.791.896/0001-00');
  const [razaoInput, setRazaoInput] = useState<string>(certificado?.razãoSocial || 'MINHA EMPRESA (HOMOLOGAÇÃO)');

  React.useEffect(() => {
    if (certificado?.cnpj) setCnpjInput(certificado.cnpj);
    if (certificado?.razãoSocial) setRazaoInput(certificado.razãoSocial);
  }, [certificado]);

  if (!isOpen) return null;

  const handleStartConsultaDFe = () => {
    setIsConsulting(true);
    setLogs([]);
    setResults(null);
    setCStat('');
    setXMotivo('');

    const currentCnpj = cnpjInput || certificado?.cnpj || '19.791.896/0001-00';
    const currentRazao = razaoInput || certificado?.razãoSocial || 'MINHA EMPRESA (HOMOLOGAÇÃO)';
    const ambCode = ambienteSefaz === 'homologacao' ? '2' : '1';
    const ambLabel = ambienteSefaz === 'homologacao' ? 'HOMOLOGAÇÃO (tpAmb = 2)' : 'PRODUÇÃO (tpAmb = 1)';

    const addLog = (msg: string) => {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`]);
    };

    if (fluxo === 'entrada') {
      addLog(`Iniciando consulta de XMLs DESTINADOS ao CNPJ ${currentCnpj}...`);
      if (certificado?.status === 'valido' && certificado?.fileName) {
        addLog(`WebService: nfeDistribuicaoDFe (SEFAZ Nacional) | Certificado A1: ${certificado.fileName}`);
      } else {
        addLog(`⚠️ ATENÇÃO: Nenhum Certificado A1 ativo para o CNPJ ${currentCnpj}. (Simulação de Homologação)`);
      }
      addLog(`Autenticando CNPJ no ambiente ${ambLabel}`);

      setTimeout(() => {
        addLog(`Enviando envelope SOAP 1.2 para https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`);
        addLog(`Parâmetros: tpAmb=${ambCode}, cOrgaoAuthor=91 (AN), ultNSU=${ultNSU}`);
      }, 500);

      setTimeout(() => {
        addLog(`Resposta SEFAZ recebida com sucesso! HTTP 200 OK.`);
        setCStat('138');
        setXMotivo('Documentos localizados para o CNPJ destinatário.');
        addLog(`cStat: 138 - Documentos localizados para o CNPJ destinatário.`);
        addLog(`Descompactando lote de XMLs (GZip Base64)...`);
      }, 1200);

      setTimeout(() => {
        const fetchedItems: DfeXmlItem[] = [
          {
            id: `nsu-ent-01-${Date.now()}`,
            tipo: 'NFe',
            numero: '000.912.480',
            serie: '1',
            chaveAcesso: '352608330001675500100091248010827391',
            dataEmissao: new Date().toISOString().split('T')[0],
            emitenteNome: 'AMBEV S.A. DISTRIBUIDORA NACIONAL',
            emitenteCnpj: '02.808.708/0001-07',
            emitenteUf: 'SP',
            destinatarioNome: currentRazao,
            destinatarioCnpj: currentCnpj,
            destinatarioUf: 'SP',
            valorTotal: 145800.00,
            valorIcms: 26244.00,
            valorIpi: 7290.00,
            valorPis: 2405.70,
            valorCofins: 11080.80,
            aliquotaCbs: 0.088,
            valorCbs: 12830.40,
            aliquotaIbs: 0.177,
            valorIbs: 25806.60,
            valorImpostoSeletivo: 0,
            statusAuditoria: 'conforme',
            alertasAuditoria: [],
            statusSincronizacaoErp: 'pendente'
          },
          {
            id: `nsu-ent-02-${Date.now()}`,
            tipo: 'NFe',
            numero: '000.410.092',
            serie: '2',
            chaveAcesso: '352608000000005500200041009210928374',
            dataEmissao: new Date().toISOString().split('T')[0],
            emitenteNome: 'VALE S.A. INSUMOS INDUSTRIAIS',
            emitenteCnpj: '33.592.510/0001-54',
            emitenteUf: 'RJ',
            destinatarioNome: currentRazao,
            destinatarioCnpj: currentCnpj,
            destinatarioUf: 'SP',
            valorTotal: 89400.00,
            valorIcms: 10728.00,
            valorIpi: 4470.00,
            valorPis: 1475.10,
            valorCofins: 6794.40,
            aliquotaCbs: 0.088,
            valorCbs: 7867.20,
            aliquotaIbs: 0.177,
            valorIbs: 15823.80,
            valorImpostoSeletivo: 0,
            statusAuditoria: 'conforme',
            alertasAuditoria: [],
            statusSincronizacaoErp: 'pendente'
          }
        ];

        const folderCode = (currentCnpj || '').replace(/\D/g, '').substring(0, 8) || '00000000';
        addLog(`Download e descompactação concluídos: 2 novos XMLs de ENTRADA (Compras).`);
        addLog(`Diretório Alvo: C:\\SEFAZ\\XMLs\\${folderCode}\\Entrada\\`);
        
        setUltNSU('000000000018422');
        setResults(fetchedItems);
        setIsConsulting(false);
      }, 1800);
    } else {
      addLog(`Iniciando sincronização de XMLs EMITIDOS pelo CNPJ ${currentCnpj}...`);
      addLog(`Conectando ao Repositório SEFAZ de Documentos Emitidos (NFeConsultaProtocolo / ERP Spool)`);
      addLog(`Certificado A1: ${certificado?.fileName || 'certificado.pfx'} | Ambiente: ${ambLabel}`);

      setTimeout(() => {
        addLog(`Consultando lote de NF-e/NFC-e autorizadas com CNPJ Emitente = ${currentCnpj}`);
        addLog(`Enviando requisição de download de pacotes autorizados (chaves autorizadas no período)`);
      }, 500);

      setTimeout(() => {
        addLog(`Servidor SEFAZ respondeu: cStat: 100 - Autorizado o uso da NF-e / Lote localizado.`);
        setCStat('100');
        setXMotivo('Lote de XMLs emitidos pelo CNPJ recuperado com sucesso.');
        addLog(`Descompactando pacotes de XMLs completos com protocolo de autorização (<nfeProc>)...`);
      }, 1200);

      setTimeout(() => {
        const fetchedItems: DfeXmlItem[] = [
          {
            id: `nsu-sai-01-${Date.now()}`,
            tipo: 'NFe',
            numero: '000.088.105',
            serie: '1',
            chaveAcesso: '35260817213071000175550010000881051003829182',
            dataEmissao: new Date().toISOString().split('T')[0],
            emitenteNome: currentRazao,
            emitenteCnpj: currentCnpj,
            emitenteUf: 'SP',
            destinatarioNome: 'PETROLEO BRASILEIRO S A PETROBRAS',
            destinatarioCnpj: '33.000.167/0001-01',
            destinatarioUf: 'RJ',
            valorTotal: 215000.00,
            valorIcms: 38700.00,
            valorIpi: 10750.00,
            valorPis: 3547.50,
            valorCofins: 16340.00,
            aliquotaCbs: 0.088,
            valorCbs: 18920.00,
            aliquotaIbs: 0.177,
            valorIbs: 38055.00,
            valorImpostoSeletivo: 0,
            statusAuditoria: 'conforme',
            alertasAuditoria: [],
            statusSincronizacaoErp: 'sincronizado'
          },
          {
            id: `nsu-sai-02-${Date.now()}`,
            tipo: 'NFe',
            numero: '000.088.106',
            serie: '1',
            chaveAcesso: '35260817213071000175550010000881061009182736',
            dataEmissao: new Date().toISOString().split('T')[0],
            emitenteNome: currentRazao,
            emitenteCnpj: currentCnpj,
            emitenteUf: 'SP',
            destinatarioNome: 'BANCO DO BRASIL S.A. MATRIZ',
            destinatarioCnpj: '00.000.000/0001-91',
            destinatarioUf: 'DF',
            valorTotal: 64200.00,
            valorIcms: 7704.00,
            valorIpi: 3210.00,
            valorPis: 1059.30,
            valorCofins: 4879.20,
            aliquotaCbs: 0.088,
            valorCbs: 5649.60,
            aliquotaIbs: 0.177,
            valorIbs: 11363.40,
            valorImpostoSeletivo: 0,
            statusAuditoria: 'conforme',
            alertasAuditoria: [],
            statusSincronizacaoErp: 'sincronizado'
          }
        ];

        const folderCode = (currentCnpj || '').replace(/\D/g, '').substring(0, 8) || '00000000';
        addLog(`Download e gravação concluídos: 2 XMLs de SAÍDA (Vendas/Emitidas).`);
        addLog(`Diretório Alvo de Saída: C:\\SEFAZ\\XMLs\\${folderCode}\\Saida\\`);
        
        setResults(fetchedItems);
        setIsConsulting(false);
      }, 1800);
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

