/**
 * ============================================================
 * CATÁLOGO DE MÓDULOS, PERFIS PRONTOS & REGRAS DE AUTORIZAÇÃO
 * ============================================================
 * Governança baseada em botões e conjuntos de informações.
 * Permite concessão granular via checkboxes organizados por grupo.
 * ============================================================
 */

import { QueryMode, PerfilUsuario } from '../types';
import { User, Empresa } from '../contexts/AuthContext';

export interface ModuloInfo {
  id: QueryMode;
  label: string;
  grupo: string;
  descricao: string;
  accent?: 'cyan' | 'indigo' | 'emerald' | 'amber' | 'purple';
  badge?: string;
}

export interface GrupoModulos {
  titulo: string;
  modulos: ModuloInfo[];
}

export const GRUPOS_MODULOS: GrupoModulos[] = [
  {
    titulo: 'Painel Executivo & BI Fiscal',
    modulos: [
      {
        id: 'central_kpis',
        label: 'Central de KPIs & Dashboards',
        grupo: 'Painel Executivo & BI Fiscal',
        descricao: 'Visão macro com gráficos, faturamento, retenções e métricas tributárias',
        accent: 'cyan',
        badge: 'BI'
      }
    ]
  },
  {
    titulo: 'Documentos Fiscais (DF-e)',
    modulos: [
      {
        id: 'dfe_xml',
        label: 'Captura de XMLs (DF-e)',
        grupo: 'Documentos Fiscais (DF-e)',
        descricao: 'Download SEFAZ de NF-e/CT-e/NFS-e, upload de XMLs e espelho de documentos',
        accent: 'cyan'
      },
      {
        id: 'eventos_dfe',
        label: 'Central de Eventos DF-e',
        grupo: 'Documentos Fiscais (DF-e)',
        descricao: 'Manifestação do destinatário (ciência, confirmação), cancelamentos e cartas',
        accent: 'indigo'
      }
    ]
  },
  {
    titulo: 'Reforma Tributária (RTC / CGIBS)',
    modulos: [
      {
        id: 'apuracao_assistida',
        label: 'Apuração Assistida (IBS/CBS)',
        grupo: 'Reforma Tributária (RTC / CGIBS)',
        descricao: 'Cálculo assistido de créditos e débitos, simulação de split payment e alíquotas',
        accent: 'emerald',
        badge: 'RTC'
      },
      {
        id: 'simulador_regimes',
        label: 'Modelador de Regimes & CPP',
        grupo: 'Reforma Tributária (RTC / CGIBS)',
        descricao: 'Comparativo Simples vs Híbrido vs Presumido, DRE Gerencial e Break-Even de Colaboradores (CPP)',
        accent: 'indigo',
        badge: 'NOVO'
      }
    ]
  },
  {
    titulo: 'Relatórios Fiscais (SAP / ERP)',
    modulos: [
      {
        id: 'relatorios_xml',
        label: 'Relatórios Fiscais Especializados',
        grupo: 'Relatórios Fiscais (SAP / ERP)',
        descricao: 'Razão de entradas, matriz de elegibilidade, mapa CFOP e retenções na fonte',
        accent: 'cyan'
      },
      {
        id: 'tabelas_fiscais',
        label: 'Parâmetros & Tabelas Fiscais',
        grupo: 'Relatórios Fiscais (SAP / ERP)',
        descricao: 'Parâmetros fiscais, tabelas de alíquotas, cClassTrib e regras de tributação',
        accent: 'indigo'
      }
    ]
  },
  {
    titulo: 'Consultas Cadastrais (CCC)',
    modulos: [
      {
        id: 'lote',
        label: 'Consulta em Lote (Excel / CSV)',
        grupo: 'Consultas Cadastrais (CCC)',
        descricao: 'Varredura cadastral automatizada de listas de clientes e fornecedores no CCC/Sintegra',
        accent: 'cyan'
      },
      {
        id: 'detalhada',
        label: 'Consulta Rápida Direta',
        grupo: 'Consultas Cadastrais (CCC)',
        descricao: 'Pesquisa individual e imediata de CNPJ, IE e situação cadastral com comprovante',
        accent: 'cyan'
      }
    ]
  },
  {
    titulo: 'Governança & Integrações',
    modulos: [
      {
        id: 'conectores_municipais',
        label: 'Conectores Municipais (NFS-e)',
        grupo: 'Governança & Integrações',
        descricao: 'Conexão com prefeituras municipais e webservices do padrão nacional NFS-e',
        accent: 'emerald'
      },
      {
        id: 'auditoria_fiscal',
        label: 'Auditoria & Conformidade',
        grupo: 'Governança & Integrações',
        descricao: 'Análise automática de pendências, omissões e inconsistências regulatórias',
        accent: 'amber'
      },
      {
        id: 'observabilidade_dlq',
        label: 'Observabilidade & DLQ',
        grupo: 'Governança & Integrações',
        descricao: 'Monitoramento técnico de filas assíncronas, falhas de conexão e contingência',
        accent: 'purple',
        badge: 'FILAS'
      }
    ]
  },
  {
    titulo: 'Acesso & Gestão Multi-Tenant',
    modulos: [
      {
        id: 'carteira_cnpjs',
        label: 'Cadastro de Empresas & Certificados',
        grupo: 'Acesso & Gestão Multi-Tenant',
        descricao: 'Gestão da carteira de clientes, dados cadastrais, SPED 0100 e certificados A1',
        accent: 'emerald'
      },
      {
        id: 'acesso_corporativo',
        label: 'Gestão de Acessos & Equipe',
        grupo: 'Acesso & Gestão Multi-Tenant',
        descricao: 'Controle de colaboradores, concessão de botões e permissões na carteira',
        accent: 'cyan'
      }
    ]
  }
];

export const TODOS_MODULOS: ModuloInfo[] = GRUPOS_MODULOS.flatMap(g => g.modulos);

/**
 * Perfis Prontos (Atalhos rápidos para o Contador/Admin)
 */
export interface PresetAcesso {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  badge: string;
  perfil: PerfilUsuario;
  permissao: 'total' | 'escrita' | 'leitura';
  modulos: QueryMode[];
}

export const PRESETS_ACESSO: PresetAcesso[] = [
  {
    id: 'faturista',
    nome: 'Faturista / Operador de Notas',
    descricao: 'Captura de DF-e, manifestação de notas e consulta cadastral de clientes/fornecedores',
    icone: '⚡',
    badge: 'Operação',
    perfil: 'analista_fiscal',
    permissao: 'escrita',
    modulos: ['dfe_xml', 'eventos_dfe', 'lote', 'detalhada']
  },
  {
    id: 'cliente_consulta',
    nome: 'Cliente / Diretoria (Somente Consulta)',
    descricao: 'Visualização executiva de Dashboards e Relatórios Fiscais em modo leitura protegida',
    icone: '📊',
    badge: 'Leitura',
    perfil: 'operador_leitura',
    permissao: 'leitura',
    modulos: ['central_kpis', 'relatorios_xml']
  },
  {
    id: 'analista_fiscal',
    nome: 'Analista Fiscal Pleno',
    descricao: 'Gestão operacional completa de notas, apuração IBS/CBS, SPED e relatórios',
    icone: '📑',
    badge: 'Fiscal',
    perfil: 'analista_fiscal',
    permissao: 'escrita',
    modulos: ['central_kpis', 'dfe_xml', 'eventos_dfe', 'apuracao_assistida', 'simulador_regimes', 'relatorios_xml', 'tabelas_fiscais']
  },
  {
    id: 'auditor_compliance',
    nome: 'Auditoria & Compliance Fiscal',
    descricao: 'Auditoria de inconsistências, conformidade e apuração em modo somente leitura',
    icone: '🛡️',
    badge: 'Compliance',
    perfil: 'auditor_externo',
    permissao: 'leitura',
    modulos: ['central_kpis', 'dfe_xml', 'apuracao_assistida', 'simulador_regimes', 'relatorios_xml', 'auditoria_fiscal']
  },
  {
    id: 'contador_gestor',
    nome: 'Contador Gestor / Gerente',
    descricao: 'Acesso integral a todas as operações, cadastros, relatórios e gestão da equipe da carteira',
    icone: '👑',
    badge: 'Gestão',
    perfil: 'contador_gestor',
    permissao: 'total',
    modulos: TODOS_MODULOS.map(m => m.id)
  }
];

/**
 * Avalia se o usuário logado tem permissão para visualizar/acessar um botão/módulo específico.
 */
export function hasModuleAccess(
  moduleId: QueryMode,
  user: User | null,
  empresaAtiva: Empresa | null
): boolean {
  if (!user) return false;

  // 1. Administrador Master tem acesso irrestrito a todos os botões do sistema
  if (user.perfil === 'admin_master') return true;

  // 2. Módulo de Gestão de Acessos é restrito a Admin Master, Suporte TI e Contador Gestor
  if (moduleId === 'acesso_corporativo') {
    return ['admin_master', 'suporte_ti', 'contador_gestor'].includes(user.perfil);
  }

  // 3. Módulo de Cadastro de Empresas (carteira) também é exclusivo de perfis de gestão
  if (moduleId === 'carteira_cnpjs') {
    return ['admin_master', 'suporte_ti', 'contador_gestor'].includes(user.perfil);
  }

  // 4. Se a empresa ativa possui lista específica de módulos permitidos
  const rawModulos = empresaAtiva?.modulosPermitidos;
  if (!rawModulos || rawModulos === '*' || rawModulos === '["*"]') {
    return true;
  }

  try {
    const parsed = typeof rawModulos === 'string' ? JSON.parse(rawModulos) : rawModulos;
    if (Array.isArray(parsed)) {
      if (parsed.includes('*')) return true;
      return parsed.includes(moduleId);
    }
  } catch {
    if (typeof rawModulos === 'string') {
      const parts = rawModulos.split(',').map(s => s.trim());
      if (parts.includes('*')) return true;
      return parts.includes(moduleId);
    }
  }

  return true;
}

/**
 * Normaliza uma lista ou string de módulos em um array de QueryMode
 */
export function parseModulosList(rawModulos?: string[] | string | null): QueryMode[] {
  if (!rawModulos || rawModulos === '*' || rawModulos === '["*"]') {
    return TODOS_MODULOS.map(m => m.id);
  }

  if (Array.isArray(rawModulos)) {
    return rawModulos as QueryMode[];
  }

  try {
    const parsed = JSON.parse(rawModulos);
    if (Array.isArray(parsed)) {
      if (parsed.includes('*')) return TODOS_MODULOS.map(m => m.id);
      return parsed as QueryMode[];
    }
  } catch {
    const parts = rawModulos.split(',').map(s => s.trim() as QueryMode);
    if (parts.includes('*' as QueryMode)) return TODOS_MODULOS.map(m => m.id);
    return parts;
  }

  return TODOS_MODULOS.map(m => m.id);
}
