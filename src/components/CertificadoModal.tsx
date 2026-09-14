import React, { useState, useRef } from 'react';
import {
  Key, ShieldCheck, Lock, Upload, CheckCircle2, AlertTriangle,
  X, Eye, EyeOff, FileCheck, RefreshCw, Shield, Server, ArrowRight
} from 'lucide-react';
import { CertificadoA1 } from '../types';
import { useApi } from '../hooks/useApi';

interface CertificadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresa: {
    id: string;
    cnpjCompleto: string;
    razaoSocial: string;
    nomeFantasia?: string;
    uf?: string;
  } | null;
  certificado: CertificadoA1;
  onCertificadoUpdated: (cert: CertificadoA1) => void;
}

export const CertificadoModal: React.FC<CertificadoModalProps> = ({
  isOpen,
  onClose,
  empresa,
  certificado,
  onCertificadoUpdated,
}) => {
  const { uploadFile, get } = useApi();
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [testResult, setTestResult] = useState<{ tipo: 'sucesso' | 'erro'; msg: string; latency?: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !empresa) return null;

  const isCertValido = Boolean(
    certificado?.valido ||
    (certificado?.status === 'valido' && certificado?.validade && new Date(certificado.validade) >= new Date())
  );

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const start = Date.now();
    try {
      const res = await get<{ success: boolean; status?: string; message?: string; latencyMs?: number }>('/sefaz/status');
      const latency = res.data?.latencyMs || (Date.now() - start);
      if (res.ok && res.data?.success) {
        setTestResult({
          tipo: 'sucesso',
          msg: res.data?.message || 'Serviço em Operação — Comunicação com SEFAZ Autorizadora 100% Homologada.',
          latency
        });
      } else {
        setTestResult({
          tipo: 'erro',
          msg: res.data?.message || res.error || 'Falha temporária ao comunicar com o WebService da SEFAZ.',
          latency
        });
      }
    } catch (err: any) {
      setTestResult({
        tipo: 'erro',
        msg: err.message || 'Erro de conexão com o servidor SEFAZ.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certFile || !certPassword) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('certificado', certFile);
      formData.append('tenantId', empresa.id);
      formData.append('senha', certPassword);

      const res = await uploadFile('/config/certificate/upload', formData);
      if (res.ok && res.data?.data) {
        const certData = res.data.data;
        const novoCert: CertificadoA1 = {
          fileName: certData.fileName || certFile.name,
          status: 'valido',
          valido: true,
          validade: certData.validade || '2028-12-31',
          cnpj: empresa.cnpjCompleto,
          razãoSocial: empresa.razaoSocial,
          tipo: 'e-CNPJ A1',
          emissor: certData.emissor || 'AC Certificadora A1',
          impressaoDigital: certData.impressaoDigital || ''
        };

        onCertificadoUpdated(novoCert);
        setCertFile(null);
        setCertPassword('');
        setIsReplacing(false);
        setTestResult({
          tipo: 'sucesso',
          msg: 'Certificado A1 vinculado e ativado com sucesso!'
        });
      } else {
        alert(res.error || res.data?.error || 'Erro ao enviar e validar certificado digital.');
      }
    } catch (err: any) {
      alert(err.message || 'Erro inesperado ao processar certificado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl border ${
              isCertValido
                ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-400'
                : 'bg-amber-950/50 border-amber-700/60 text-amber-400'
            }`}>
              <Key className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Certificado Digital A1</span>
                {isCertValido ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ativo
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Pendente
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-sm">
                {empresa.razaoSocial} • <span className="font-mono text-cyan-400 font-semibold">{empresa.cnpjCompleto}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            title="Fechar Janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs">

          {/* Se já possui certificado ativo e não está em modo de substituição */}
          {isCertValido && !isReplacing && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/30 to-slate-950 border border-emerald-600/40 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2.5">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Certificado Operacional e Conectado</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">
                    ICP-Brasil e-CNPJ
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Arquivo Vinculado:</span>
                    <span className="text-slate-200 font-mono font-bold truncate block" title={certificado.fileName}>
                      {certificado.fileName || 'certificado.pfx'}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Validade Jurídica:</span>
                    <span className="text-emerald-300 font-mono font-bold block">
                      {certificado.validade ? new Date(certificado.validade).toLocaleDateString('pt-BR') : '31/12/2028'}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Autoridade Certificadora:</span>
                    <span className="text-slate-200 font-bold block truncate">
                      {certificado.emissor || 'AC Certificadora A1'}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Criptografia em Cofre:</span>
                    <span className="text-cyan-300 font-mono font-semibold block">
                      AES-256-GCM Hardware Vault
                    </span>
                  </div>
                </div>
              </div>

              {/* Feedback de Teste SEFAZ */}
              {testResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.tipo === 'sucesso'
                    ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-600/60 text-rose-200'
                }`}>
                  {testResult.tipo === 'sucesso' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">{testResult.msg}</div>
                    {testResult.latency && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Tempo de resposta: {testResult.latency}ms
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botões de Ação para Certificado Existente */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-2 border border-slate-700 hover:border-cyan-500/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>{isTesting ? 'Testando SEFAZ...' : 'Testar Comunicação SEFAZ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsReplacing(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 transition-all cursor-pointer"
                >
                  Substituir .PFX
                </button>
              </div>
            </div>
          )}

          {/* Formulário de Upload (quando pendente ou quando usuário clica em Substituir) */}
          {(!isCertValido || isReplacing) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-700/40 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  Para habilitar a consulta automática no WebService da SEFAZ, captura de XMLs e eventos de manifestação do destinatário, selecione o arquivo <strong>.PFX ou .P12</strong> e digite a respectiva senha.
                </p>
              </div>

              {/* Step 1: Upload Arquivo */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
                  <span>1. Arquivo do Certificado Digital (.PFX ou .P12) *</span>
                  {certFile && (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Arquivo selecionado
                    </span>
                  )}
                </label>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center ${
                    certFile
                      ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300'
                      : 'border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-slate-950 text-slate-400'
                  }`}
                >
                  <input
                    ref={fileInputRef}
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
                        {(certFile.size / 1024).toFixed(1)} KB (Clique para trocar de arquivo)
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

              {/* Step 2: Senha */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">
                  2. Senha de Proteção do Certificado A1 *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite a senha de proteção do .PFX..."
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>A senha e a chave privada são criptografadas com AES-256-GCM no cofre de segurança.</span>
                </p>
              </div>

              {/* Botões do Formulário */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                {isReplacing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsReplacing(false);
                      setCertFile(null);
                      setCertPassword('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!certFile || !certPassword || isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2"
                >
                  {isSubmitting ? (
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
          )}

        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 font-mono">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Multi-Tenant Seguro</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
