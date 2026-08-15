import React, { useState } from 'react';
import { Database, Link2, CheckCircle2, RefreshCw, Key, ArrowRight, Code, Server, ShieldCheck, Copy, Terminal, Zap } from 'lucide-react';
import { ErpConnectionConfig, DfeXmlItem } from '../types';

interface ErpIntegrationPanelProps {
  dfeList: DfeXmlItem[];
}

export const ErpIntegrationPanel: React.FC<ErpIntegrationPanelProps> = ({ dfeList }) => {
  const [config, setConfig] = useState<ErpConnectionConfig>({
    tipoErp: 'SAP_S4HANA',
    endpointUrl: 'https://sap-s4hana-prd.empresa.com.br/sap/bc/srt/rfc/sap/z_dfe_sync',
    systemId: 'PRD-100',
    clientNumber: '100',
    apiKey: 'sk_live_sap_a89f92019b88300291039a',
    autoSyncEvents: true,
    autoSyncAudit: true,
    statusConexao: 'conectado',
    ultimaSincronizacao: '2026-08-01 15:45:10'
  });

  const [isTesting, setIsTesting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'payload' | 'api'>('config');

  const handleTestConnection = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setConfig(prev => ({
        ...prev,
        statusConexao: 'conectado',
        ultimaSincronizacao: new Date().toISOString().replace('T', ' ').slice(0, 19)
      }));
    }, 1000);
  };

  const sampleSapPayload = {
    header: {
      systemId: config.systemId,
      client: config.clientNumber,
      timestamp: new Date().toISOString(),
      sourceApp: 'PAINEL_AUDITORIA_FISCAL_CCC_SEFAZ'
    },
    dfeRecords: dfeList.map(item => ({
      accessKey: item.chaveAcesso,
      type: item.tipo,
      number: item.numero,
      issueDate: item.dataEmissao,
      issuerCNPJ: item.emitenteCnpj,
      issuerName: item.emitenteNome,
      issuerState: item.emitenteUf,
      recipientCNPJ: item.destinatarioCnpj,
      totalAmount: item.valorTotal,
      taxModel: {
        icms: item.valorIcms,
        cbsProjected: item.valorCbs,
        ibsProjected: item.valorIbs
      },
      sefazAuditStatus: item.statusAuditoria,
      lastManifestationEvent: item.eventoUltimo
    }))
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(config.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 text-xs font-semibold mb-2">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            Hub de Conectividade ERP & SAP S/4HANA / ECC
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Integração Nativa de Dados Fiscais & Eventos
          </h2>
          <p className="text-sm text-slate-300 max-w-2xl mt-1">
            Transfira automaticamente os status do CCC SEFAZ, eventos de manifestação e apurações da Reforma Tributária (IBS/CBS) diretamente para o seu ERP.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3 text-xs">
            <div className={`w-3 h-3 rounded-full ${config.statusConexao === 'conectado' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <div>
              <div className="text-white font-bold uppercase">
                {config.tipoErp.replace('_', ' ')}: {config.statusConexao}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Última Sinc: {config.ultimaSincronizacao}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Subnavigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'config'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <Server className="w-4 h-4" />
          Conectores SAP & ERPs
        </button>

        <button
          onClick={() => setActiveTab('payload')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'payload'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <Code className="w-4 h-4" />
          Payload de Envio JSON / RFC
        </button>

        <button
          onClick={() => setActiveTab('api')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'api'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <Key className="w-4 h-4" />
          API REST Webhook
        </button>
      </div>

      {/* Tab 1: Config */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5 shadow-lg">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Link2 className="w-5 h-5 text-cyan-400" />
              Parâmetros da Conexão
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Sistema ERP de Destino</label>
                <select
                  value={config.tipoErp}
                  onChange={(e: any) => setConfig({ ...config, tipoErp: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-bold"
                >
                  <option value="SAP_S4HANA">SAP S/4HANA (OData / REST)</option>
                  <option value="SAP_ECC">SAP ECC 6.0 (RFC / BAPI)</option>
                  <option value="TOTVS_PROTHEUS">TOTVS Protheus / RM</option>
                  <option value="REST_WEBHOOK">Webhook REST Universal</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">ID do Mandante / Client</label>
                <input
                  type="text"
                  value={config.clientNumber}
                  onChange={(e) => setConfig({ ...config, clientNumber: e.target.value })}
                  placeholder="Ex: 100"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">URL do Webhook / Endpoint SAP</label>
              <input
                type="text"
                value={config.endpointUrl}
                onChange={(e) => setConfig({ ...config, endpointUrl: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-300">Regras de Sincronização Automática</label>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoSyncEvents}
                    onChange={(e) => setConfig({ ...config, autoSyncEvents: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-slate-200 font-medium">Sincronizar eventos de Manifestação em tempo real para o SAP</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoSyncAudit}
                    onChange={(e) => setConfig({ ...config, autoSyncAudit: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-slate-200 font-medium">Atualizar status cadastral IE (CCC SEFAZ) nos parceiros de negócio (Business Partners / KNA1 / LFA1)</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-600/30"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Testando Conexão RFC SAP...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-cyan-300" />
                    Testar Conectividade com SAP
                  </>
                )}
              </button>

              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Conectado com Sucesso
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-lg">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Status dos Conectores ERP
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">SAP S/4HANA Cloud / On-Premise</div>
                  <div className="text-[10px] text-slate-400">RFC / OData v4 Active</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Operacional
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">TOTVS Protheus ADVPL REST</div>
                  <div className="text-[10px] text-slate-400">Endpoint /api/v1/dfe</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  Pronto
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Senior Sistemas / Linx ERP</div>
                  <div className="text-[10px] text-slate-400">JSON Webhook Integration</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                  Aguardando Trigger
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Payload Preview */}
      {activeTab === 'payload' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-cyan-400" />
              Payload JSON de Integração SAP / REST
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Formato de transferência nativo
            </span>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 max-h-[500px] overflow-auto leading-relaxed">
            {JSON.stringify(sampleSapPayload, null, 2)}
          </pre>
        </div>
      )}

      {/* Tab 3: API REST */}
      {activeTab === 'api' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5 shadow-lg max-w-3xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Key className="w-5 h-5 text-amber-400" />
            Chave de API & Endpoint Webhook
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">Sua API Key do Painel Fiscal</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={config.apiKey}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-amber-400"
              />
              <button
                onClick={handleCopyKey}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Copy className="w-4 h-4" />
                {copiedKey ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="font-bold text-white">Endpoint para Recebimento em Lote:</div>
            <code className="block p-2 rounded bg-slate-900 font-mono text-cyan-400 text-[11px]">
              POST https://ais-dev-67ecr4keuqmqbjvxjswxxn-28469430122.us-west2.run.app/api/dfe/sync
            </code>
          </div>
        </div>
      )}

    </div>
  );
};
