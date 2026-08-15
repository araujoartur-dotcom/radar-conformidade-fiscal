import React, { useState, useEffect } from 'react';
import { 
  Activity, AlertOctagon, RefreshCw, Cpu, ShieldAlert, KeyRound, 
  Terminal, CheckCircle2, AlertTriangle, Layers, Filter, FileSpreadsheet, 
  Trash2, Play, Lock, ShieldCheck, Wifi, ArrowUpRight, Zap, Info
} from 'lucide-react';
import { DlqTaskItem, CircuitBreakerState, CofreCertificadoSecurity, StructuredAuditLog } from '../types';
import { exportToExcel } from '../utils/excel';
import { useApi } from '../hooks/useApi';

// Demo Initial Data for DLQ Tasks
export const DEMO_DLQ_TASKS: DlqTaskItem[] = [
  {
    id: 'job-dlq-001',
    correlationId: 'req-sefaz-98123-abf8',
    queueName: 'capture.execute',
    organizationId: 'ORG-PETROBRAS-BR',
    companyCnpj: '33.000.167/0001-01',
    companyName: 'PETROLEO BRASILEIRO S A PETROBRAS',
    taskType: 'Consulta Web Service SEFAZ NSU #10489',
    priority: 'alta',
    createdAt: '2026-08-06 09:10:12',
    startedAt: '2026-08-06 09:10:15',
    finishedAt: '2026-08-06 09:12:45',
    currentAttempt: 3,
    maxAttempts: 3,
    status: 'dlq_retido',
    errorMessage: 'HTTP 503 Service Unavailable: SEFAZ-AN WebService indisponível por timeout no lote 4492.',
    errorCategory: 'timeout_sefaz',
    errorDetails: 'Error: Timeout of 30000ms exceeded at SefazSoapAdapter.sendQuery (sefaz.client.ts:142)\n    at QueueWorker.processJob (capture-worker.ts:88)\n    at BullMQWorker.execute (worker-engine.ts:210)',
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    retryBackoffMs: 120000,
    isIdempotent: true
  },
  {
    id: 'job-dlq-002',
    correlationId: 'req-ibs-77102-c901',
    queueName: 'ibs-cbs.calculate',
    organizationId: 'ORG-BANCO-BB',
    companyCnpj: '00.000.000/0001-91',
    companyName: 'BANCO DO BRASIL SA (MATRIZ CCC)',
    taskType: 'Apuração Assistida Reforma Tributária PLP 68/2024',
    priority: 'alta',
    createdAt: '2026-08-06 09:15:00',
    startedAt: '2026-08-06 09:15:02',
    finishedAt: '2026-08-06 09:15:10',
    currentAttempt: 3,
    maxAttempts: 3,
    status: 'dlq_retido',
    errorMessage: 'cClassTrib "9999" não reconhecido no catálogo de regras IBS/CBS versão 2026.2.',
    errorCategory: 'schema_xml_invalido',
    errorDetails: 'ValidationError: Field cClassTrib in item #3 has value "9999" which is not defined in TaxRuleRegistry v2026.2.\n    at IbsCbsValidator.validateItem (ibs-cbs.validator.ts:64)',
    payloadHash: '4a8a08f09d37b73795649038080b080c98f98c8c7f7d7e7f8a9b0c1d2e3f4a5b',
    retryBackoffMs: 300000,
    isIdempotent: true
  },
  {
    id: 'job-dlq-003',
    correlationId: 'req-sign-55410-0982',
    queueName: 'certificate.sign',
    organizationId: 'ORG-COSTA-VERDE',
    companyCnpj: '17.213.071/0001-75',
    companyName: 'ASSOCIACAO DOS MORADORES DO EDIFICIO COSTA VERDE',
    taskType: 'Assinatura XMLDSig Manifestação do Destinatário',
    priority: 'normal',
    createdAt: '2026-08-06 09:20:00',
    startedAt: '2026-08-06 09:20:01',
    finishedAt: '2026-08-06 09:20:05',
    currentAttempt: 2,
    maxAttempts: 3,
    status: 'erro_reprocessavel',
    errorMessage: 'Agente local A3 desconectado durante a inicialização do token HSM/ICP-Brasil.',
    errorCategory: 'certificado_invalido',
    errorDetails: 'CertError: SmartCardReaderNotResponding: Device disconnected on USB port /dev/ttyUSB0\n    at CertificateSignerWorker.signXml (certificate-worker.ts:112)',
    payloadHash: '8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e',
    retryBackoffMs: 60000,
    isIdempotent: true
  }
];

// Initial Circuit Breaker State
export const INITIAL_CIRCUIT_BREAKERS: CircuitBreakerState[] = [
  {
    serviceName: 'API Oficial SEFAZ NFe (Ambiente de Produção TP=1)',
    status: 'CLOSED',
    failureCount: 1,
    failureThreshold: 5,
    lastFailureTime: '09:12:45',
    successRate: 99.4,
    averageLatencyMs: 340,
    rateLimitReqSec: 8,
    currentActiveWorkers: 4
  },
  {
    serviceName: 'API Apuração Assistida IBS/CBS (Receita Federal)',
    status: 'CLOSED',
    failureCount: 0,
    failureThreshold: 5,
    successRate: 100.0,
    averageLatencyMs: 190,
    rateLimitReqSec: 15,
    currentActiveWorkers: 2
  },
  {
    serviceName: 'Serviço de Consulta Cadastro Centralizado (CCC/SEFAZ)',
    status: 'HALF_OPEN',
    failureCount: 2,
    failureThreshold: 5,
    lastFailureTime: '09:21:00',
    successRate: 94.2,
    averageLatencyMs: 820,
    rateLimitReqSec: 5,
    currentActiveWorkers: 1
  }
];

// Initial Certificate Vault State
export const INITIAL_CERTIFICATE_VAULT: CofreCertificadoSecurity[] = [
  {
    id: 'cert-sec-01',
    cnpjOwner: '33.000.167/0001-01',
    razaoSocial: 'PETROLEO BRASILEIRO S A PETROBRAS',
    tipoCertificado: 'A1_PKCS12',
    algoritmoCriptografia: 'AES-256-GCM',
    validadeData: '2028-12-31',
    diasParaVencimento: 878,
    statusAlerta: 'ok',
    chavePublicaFingerprint: 'SHA256: 7F:8A:2B:9C:1D:3E:4F:5A:6B:7C:8D:9E:0F:1A:2B:3C',
    ultimaVerificacao: 'Há 5 min'
  },
  {
    id: 'cert-sec-02',
    cnpjOwner: '17.213.071/0001-75',
    razaoSocial: 'ASSOCIACAO DOS MORADORES DO EDIFICIO COSTA VERDE',
    tipoCertificado: 'A3_LOCAL_AGENT',
    algoritmoCriptografia: 'AES-256-GCM',
    validadeData: '2026-09-01',
    diasParaVencimento: 26,
    statusAlerta: 'alerta_30_dias',
    chavePublicaFingerprint: 'SHA256: 1A:2B:3C:4D:5E:6F:7A:8B:9C:0D:1E:2F:3A:4B:5C:6D',
    agenteA3Status: 'online',
    ultimaVerificacao: 'Há 1 min'
  },
  {
    id: 'cert-sec-03',
    cnpjOwner: '00.000.000/0001-91',
    razaoSocial: 'BANCO DO BRASIL SA (MATRIZ CCC)',
    tipoCertificado: 'A1_PKCS12',
    algoritmoCriptografia: 'AES-256-GCM',
    validadeData: '2028-10-15',
    diasParaVencimento: 801,
    statusAlerta: 'ok',
    chavePublicaFingerprint: 'SHA256: 9E:8D:7C:6B:5A:4F:3E:2D:1C:0B:9A:8F:7E:6D:5C:4B',
    ultimaVerificacao: 'Há 12 min'
  }
];

// Initial Structured JSON Logs
export const INITIAL_AUDIT_LOGS: StructuredAuditLog[] = [
  {
    timestamp: '2026-08-06T09:21:04.102Z',
    level: 'INFO',
    service: 'capture-worker',
    correlationId: 'req-sefaz-98123-abf8',
    jobId: 'job-dlq-001',
    organizationId: 'ORG-PETROBRAS-BR',
    companyCnpj: '33.000.167/0001-01',
    userId: 'usr-admin-01',
    action: 'CAPTURE_SEFAZ_CHECKPOINT_UPDATED',
    message: 'Checkpoint de captura NSU atualizado para 104892 com sucesso. 0 novos documentos.',
    ipAddress: '186.204.12.98'
  },
  {
    timestamp: '2026-08-06T09:20:05.882Z',
    level: 'ERROR',
    service: 'certificate-worker',
    correlationId: 'req-sign-55410-0982',
    jobId: 'job-dlq-003',
    organizationId: 'ORG-COSTA-VERDE',
    companyCnpj: '17.213.071/0001-75',
    userId: 'usr-analista-02',
    action: 'CERTIFICATE_SIGN_FAILURE',
    message: 'Falha na assinatura do evento de manifestação com certificado A3. Erro retido na fila com backoff de 60s.',
    ipAddress: '201.88.45.12'
  },
  {
    timestamp: '2026-08-06T09:18:22.410Z',
    level: 'WARN',
    service: 'ibs-cbs-adapter',
    correlationId: 'req-ibs-77102-c901',
    jobId: 'job-dlq-002',
    organizationId: 'ORG-BANCO-BB',
    companyCnpj: '00.000.000/0001-91',
    userId: 'usr-admin-01',
    action: 'TAX_CALCULATION_SCHEMA_WARNING',
    message: 'Atributo cClassTrib desconhecido detectado no item #3. Tarefa movida para Dead-Letter Queue (DLQ).',
    ipAddress: '189.12.33.104'
  }
];

export const ObservabilidadeDlqPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dlq' | 'filas' | 'resiliencia' | 'cofre' | 'logs'>('dlq');
  const [dlqTasks, setDlqTasks] = useState<DlqTaskItem[]>(DEMO_DLQ_TASKS);
  const [circuitBreakers] = useState<CircuitBreakerState[]>(INITIAL_CIRCUIT_BREAKERS);
  const [certificatesVault] = useState<CofreCertificadoSecurity[]>(INITIAL_CERTIFICATE_VAULT);
  const [auditLogs, setAuditLogs] = useState<StructuredAuditLog[]>([]);
  const [selectedTask, setSelectedTask] = useState<DlqTaskItem | null>(null);
  const [logFilterText, setLogFilterText] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  
  const { get } = useApi();

  const loadAuditLogs = async () => {
    const res = await get<{ success: boolean; data: any[] }>('/audit/logs');
    if (res.ok && res.data?.data) {
      setAuditLogs(res.data.data.map(log => ({
        timestamp: log.timestamp,
        level: log.nivel,
        service: log.servico,
        correlationId: log.correlation_id || '',
        jobId: log.id,
        organizationId: '',
        companyCnpj: '',
        userId: log.usuario_email,
        action: log.acao,
        message: log.descricao,
        ipAddress: log.ip_address || ''
      })));
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  // Reprocess Task from DLQ
  const handleReprocessTask = (taskId: string) => {
    setDlqTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: 'reprocessado',
          finishedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
          currentAttempt: t.currentAttempt + 1
        };
      }
      return t;
    }));
    setActionNotice(`Tarefa ${taskId} reenviada para a fila ativa de processamento com sucesso (idempotente).`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Reprocess All Tasks in DLQ
  const handleReprocessAllDlq = () => {
    setDlqTasks(prev => prev.map(t => ({
      ...t,
      status: 'reprocessado',
      finishedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    })));
    setActionNotice('Todas as tarefas com erro na DLQ foram re-enfileiradas com sucesso!');
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Export DLQ Errors to Excel
  const handleExportDlqExcel = () => {
    const exportData = dlqTasks.map(t => ({
      ID_Tarefa: t.id,
      Correlation_ID: t.correlationId,
      Fila: t.queueName,
      Organizacao: t.organizationId,
      CNPJ_Empresa: t.companyCnpj,
      Razao_Social: t.companyName,
      Status: t.status,
      Tentativa: `${t.currentAttempt}/${t.maxAttempts}`,
      Categoria_Erro: t.errorCategory,
      Mensagem_Erro: t.errorMessage,
      Hash_Payload: t.payloadHash,
      Criado_Em: t.createdAt
    }));
    exportToExcel(exportData, 'Relatorio_Erros_Dead_Letter_Queue_DLQ');
  };

  const filteredLogs = auditLogs.filter(log => 
    !logFilterText || 
    log.message.toLowerCase().includes(logFilterText.toLowerCase()) ||
    log.correlationId.toLowerCase().includes(logFilterText.toLowerCase()) ||
    log.companyCnpj.includes(logFilterText) ||
    log.service.toLowerCase().includes(logFilterText.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      {/* Top Banner Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 w-full min-w-0">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-900/60 border border-purple-700/60 text-purple-300 text-xs font-semibold mb-2">
            <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate">Painel de Observabilidade Técnica & Arquitetura de Filas Assíncronas</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Gestão de Dead-Letter Queue (DLQ), Resiliência e Cofre AES-256
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mt-1">
            Monitoramento de workers, reprocessamento de tarefas retidas na DLQ, gestão de circuit breakers para APIs fiscais e segurança criptográfica de certificados digitais.
          </p>
        </div>

        {/* Action / Stats Counter */}
        <div className="grid grid-cols-3 gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center shrink-0 min-w-[280px]">
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">Em DLQ</div>
            <div className="text-lg font-bold text-rose-400 font-mono">
              {dlqTasks.filter(t => t.status === 'dlq_retido').length}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">Workers</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">7 Ativos</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">Circuit Breakers</div>
            <div className="text-lg font-bold text-cyan-400 font-mono">100% Ok</div>
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-pulse-subtle">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 w-full min-w-0">
        <button
          onClick={() => setActiveTab('dlq')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'dlq' 
              ? 'bg-rose-950/90 text-rose-200 border border-rose-700 shadow-md' 
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Dead Letter Queue (DLQ)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-900/80 text-rose-200 border border-rose-700">
            {dlqTasks.filter(t => t.status === 'dlq_retido').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('filas')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'filas' 
              ? 'bg-purple-950/90 text-purple-200 border border-purple-700 shadow-md' 
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Filas Assíncronas (11 Filas)</span>
        </button>

        <button
          onClick={() => setActiveTab('resiliencia')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'resiliencia' 
              ? 'bg-cyan-950/90 text-cyan-200 border border-cyan-700 shadow-md' 
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Circuit Breakers & Rate Limit</span>
        </button>

        <button
          onClick={() => setActiveTab('cofre')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'cofre' 
              ? 'bg-amber-950/90 text-amber-200 border border-amber-700 shadow-md' 
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Cofre AES-256 & Certificados</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'logs' 
              ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-md' 
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Logs JSON & Auditoria RLS</span>
        </button>
      </div>

      {/* TAB 1: DEAD LETTER QUEUE (DLQ) */}
      {activeTab === 'dlq' && (
        <div className="space-y-4 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                Tarefas Retidas na Dead Letter Queue (DLQ)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tarefas que excederam o número máximo de tentativas em erros de processamento e requerem análise ou intervenção parametrizada.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportDlqExcel}
                className="px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Exportar Relatório DLQ
              </button>

              <button
                onClick={handleReprocessAllDlq}
                className="px-3 py-1.5 rounded-lg bg-rose-900 text-white hover:bg-rose-800 border border-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reprocessar Tudo na DLQ
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {dlqTasks.map(task => (
              <div 
                key={task.id} 
                className={`p-4 rounded-xl border transition-all ${
                  task.status === 'reprocessado' 
                    ? 'bg-slate-950/60 border-slate-800 opacity-60' 
                    : 'bg-rose-950/20 border-rose-800/60'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono text-[10px] font-bold">
                        {task.queueName}
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {task.taskType}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        Attempt {task.currentAttempt}/{task.maxAttempts}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 flex items-center gap-3 flex-wrap">
                      <span>Organização: <strong className="text-cyan-300">{task.organizationId}</strong></span>
                      <span>CNPJ: <strong className="font-mono text-slate-200">{task.companyCnpj}</strong></span>
                      <span className="font-mono text-[10px] text-slate-400">CID: {task.correlationId}</span>
                    </div>

                    <div className="text-xs text-rose-300 bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/60 mt-2 font-mono">
                      <strong>Erro Registrado:</strong> {task.errorMessage}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5 text-cyan-400" />
                      Detalhes & Stack
                    </button>

                    {task.status !== 'reprocessado' && (
                      <button
                        onClick={() => handleReprocessTask(task.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reprocessar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: ARQUITETURA DE FILAS */}
      {activeTab === 'filas' && (
        <div className="space-y-4 w-full min-w-0">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              Arquitetura de Processamento Assíncrono (BullMQ + Redis)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Topologia de 11 filas isoladas para prevenir travamentos de HTTP, garantir idenpotência e isolamento de falhas por CNPJ.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { queue: 'xml.ingest', name: 'Ingestão de XMLs', status: 'Ativa', workers: 2, pending: 0 },
              { queue: 'xml.validate', name: 'Validação Estrutural e XSD', status: 'Ativa', workers: 2, pending: 0 },
              { queue: 'xml.parse', name: 'Extração e Parsing de Itens', status: 'Ativa', workers: 3, pending: 0 },
              { queue: 'capture.execute', name: 'Captura Automática SEFAZ', status: 'Ativa', workers: 4, pending: 1 },
              { queue: 'certificate.sign', name: 'Assinatura Digital PKCS#12/A3', status: 'Ativa', workers: 2, pending: 0 },
              { queue: 'events.send', name: 'Envio de Eventos & Manifestação', status: 'Ativa', workers: 2, pending: 0 },
              { queue: 'events.query', name: 'Consulta de Protocolos de Eventos', status: 'Ativa', workers: 1, pending: 0 },
              { queue: 'ibs-cbs.calculate', name: 'Cálculo e Apuração IBS/CBS', status: 'Ativa', workers: 3, pending: 0 },
              { queue: 'reports.generate', name: 'Geração Assíncrona de Relatórios', status: 'Ativa', workers: 2, pending: 0 },
              { queue: 'notifications.send', name: 'Disparo de Alertas & E-mails', status: 'Ativa', workers: 1, pending: 0 },
              { queue: 'maintenance.execute', name: 'Limpeza e Purga de Logs', status: 'Agendada', workers: 1, pending: 0 }
            ].map((q, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="text-xs font-mono font-bold text-purple-300 truncate">{q.queue}</div>
                  <div className="text-xs text-slate-300 font-medium truncate">{q.name}</div>
                  <div className="text-[10px] text-slate-400">Workers: {q.workers} | Pendentes: {q.pending}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold shrink-0">
                  {q.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CIRCUIT BREAKERS & RESILIÊNCIA */}
      {activeTab === 'resiliencia' && (
        <div className="space-y-4 w-full min-w-0">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Adaptador de Resiliência & Circuit Breakers (SEFAZ & IBS/CBS)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Controle automático de falhas temporárias com Backoff Exponencial, limitação de concorrência por CNPJ e isolamento de instabilidades de Web Services externos.
            </p>
          </div>

          <div className="space-y-3">
            {circuitBreakers.map((cb, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{cb.serviceName}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      cb.status === 'CLOSED' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                      cb.status === 'HALF_OPEN' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                      'bg-rose-950 text-rose-300 border-rose-800'
                    }`}>
                      Circuit Status: {cb.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Taxa de Sucesso: <span className="text-emerald-400 font-bold">{cb.successRate}%</span> | Latência Média: {cb.averageLatencyMs}ms | Rate Limit: {cb.rateLimitReqSec} req/s
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right shrink-0">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-semibold">Falhas / Limite</div>
                    <div className="text-xs font-mono font-bold text-amber-400">{cb.failureCount} / {cb.failureThreshold}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-semibold">Workers Ativos</div>
                    <div className="text-xs font-mono font-bold text-cyan-400">{cb.currentActiveWorkers}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: COFRE DE CERTIFICADOS AES-256 */}
      {activeTab === 'cofre' && (
        <div className="space-y-4 w-full min-w-0">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              Cofre de Certificados Digitais A1/A3 (Criptografia AES-256-GCM em Repouso)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Armazenamento estritamente criptografado dos arquivos PKCS#12 e chaves privadas, com alertas preventivos de expiração e integração via agente local para A3.
            </p>
          </div>

          <div className="space-y-3">
            {certificatesVault.map(cert => (
              <div key={cert.id} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{cert.razaoSocial}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-mono text-[10px] font-bold">
                      {cert.tipoCertificado}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-[10px] font-bold">
                      {cert.algoritmoCriptografia}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    CNPJ: {cert.cnpjOwner} | Validade: <strong className="text-white">{cert.validadeData}</strong> ({cert.diasParaVencimento} dias restantes)
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Fingerprint: {cert.chavePublicaFingerprint}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {cert.statusAlerta === 'alerta_30_dias' && (
                    <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Renovação Próxima
                    </span>
                  )}
                  {cert.statusAlerta === 'ok' && (
                    <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Protegido & Válido
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: LOGS ESTRUTURADOS JSON & AUDITORIA RLS */}
      {activeTab === 'logs' && (
        <div className="space-y-4 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Console de Logs Estruturados JSON (Observabilidade Backend)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Logs no padrão Winston/Pino contendo Correlation ID, Organization ID, Tenant CNPJ e rastreabilidade de requisições.
              </p>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Filtrar por CID, CNPJ ou texto..."
                value={logFilterText}
                onChange={e => setLogFilterText(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2.5 max-h-[450px] overflow-y-auto">
            {filteredLogs.map((log, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all">
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1 flex-wrap">
                  <span className="text-slate-500">{log.timestamp}</span>
                  <span className={`px-1.5 py-0.2 rounded font-bold ${
                    log.level === 'INFO' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                    log.level === 'WARN' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                    'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}>{log.level}</span>
                  <span className="text-purple-300">{log.service}</span>
                  <span className="text-cyan-400">CID: {log.correlationId}</span>
                  <span className="text-slate-400">IP: {log.ipAddress}</span>
                </div>
                <div className="text-slate-200 text-xs font-mono">
                  {log.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DETALHES DA TAREFA DLQ */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-400" />
                Detalhes da Tarefa Retida na DLQ ({selectedTask.id})
              </h3>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-white font-bold text-sm">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Correlation ID:</span>
                  <span className="font-mono text-cyan-300 font-bold">{selectedTask.correlationId}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Fila de Origem:</span>
                  <span className="font-mono text-purple-300 font-bold">{selectedTask.queueName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Empresa CNPJ:</span>
                  <span className="font-mono text-slate-200">{selectedTask.companyCnpj}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Tentativas Realizadas:</span>
                  <span className="font-mono text-amber-400 font-bold">{selectedTask.currentAttempt} / {selectedTask.maxAttempts}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mensagem de Erro:</span>
                <div className="p-3 bg-rose-950/40 text-rose-200 border border-rose-900 rounded-xl font-mono text-xs">
                  {selectedTask.errorMessage}
                </div>
              </div>

              {selectedTask.errorDetails && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Stack Trace Técnica:</span>
                  <pre className="p-3 bg-slate-950 text-slate-300 border border-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {selectedTask.errorDetails}
                  </pre>
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Hash SHA-256 do Payload:</span>
                <div className="p-2 bg-slate-950 text-slate-400 font-mono text-[10px] rounded-lg border border-slate-800 truncate">
                  {selectedTask.payloadHash}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  handleReprocessTask(selectedTask.id);
                  setSelectedTask(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reprocessar Tarefa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
