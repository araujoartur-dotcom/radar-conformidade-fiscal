import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, verifyAuthToken, handleCors } from './_supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    try {
      const { data: rows, error } = await supabase
        .from('diretorios_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (rows || []).map((r: any) => ({
        id: r.id,
        cnpjRaiz: r.cnpj_raiz,
        razaoSocial: r.razao_social,
        diretorioEntrada: r.diretorio_entrada,
        subpastaDataEntrada: Boolean(r.subpasta_data_entrada),
        estruturaNomeEntrada: r.estrutura_nome_entrada,
        diretorioSaida: r.diretorio_saida,
        subpastaDataSaida: Boolean(r.subpasta_data_saida),
        estruturaNomeSaida: r.estrutura_nome_saida,
        diretorioEventos: r.diretorio_eventos,
        autoOrganizarAoCapturar: Boolean(r.auto_organizar),
        statusMonitoramento: r.status_monitoramento || 'ativo',
        ultimaSincronizacao: r.ultima_sincronizacao || 'Cadastrado agora'
      }));

      return res.status(200).json({ success: true, data: formatted });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao listar diretórios: ' + err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        cnpjRaiz,
        razaoSocial,
        diretorioEntrada,
        subpastaDataEntrada,
        estruturaNomeEntrada,
        diretorioSaida,
        subpastaDataSaida,
        estruturaNomeSaida,
        diretorioEventos,
        autoOrganizarAoCapturar
      } = req.body || {};

      if (!cnpjRaiz || !razaoSocial || !diretorioEntrada || !diretorioSaida) {
        return res.status(400).json({ success: false, message: 'CNPJ Raiz, Razão Social e Diretórios são obrigatórios.' });
      }

      const cleanRaiz = cnpjRaiz.replace(/\D/g, '');
      const id = `cfg-${cleanRaiz}`;

      const { error } = await supabase
        .from('diretorios_config')
        .upsert({
          id,
          cnpj_raiz: cnpjRaiz,
          razao_social: razaoSocial,
          diretorio_entrada: diretorioEntrada,
          subpasta_data_entrada: Boolean(subpastaDataEntrada),
          estrutura_nome_entrada: estruturaNomeEntrada || 'chave',
          diretorio_saida: diretorioSaida,
          subpasta_data_saida: Boolean(subpastaDataSaida),
          estrutura_nome_saida: estruturaNomeSaida || 'chave',
          diretorio_eventos: diretorioEventos || diretorioEntrada,
          auto_organizar: Boolean(autoOrganizarAoCapturar),
          status_monitoramento: 'ativo',
          ultima_sincronizacao: 'Cadastrado agora',
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Regra de diretório salva com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao salvar diretório: ' + err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const targetId = req.body?.id || req.query.id;
      if (!targetId) {
        return res.status(400).json({ success: false, message: 'ID do diretório é obrigatório.' });
      }

      const { error } = await supabase.from('diretorios_config').delete().eq('id', targetId);
      if (error) throw error;

      return res.status(200).json({ success: true, message: 'Mapeamento de diretório removido com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao excluir diretório: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
