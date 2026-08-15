import { Router } from 'express';
import { getDatabase } from '../db/database';

const router = Router();

// GET /api/directories - Listar todos os diretórios mapeados
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(`SELECT * FROM diretorios_config ORDER BY created_at DESC`).all();

    const formatted = rows.map((r: any) => ({
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
      statusMonitoramento: r.status_monitoramento,
      ultimaSincronizacao: r.ultima_sincronizacao
    }));

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error('❌ Erro ao listar diretórios:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao listar configurações de diretório.' });
  }
});

// POST /api/directories - Criar nova regra de diretório por CNPJ Raiz
router.post('/', (req, res) => {
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
    } = req.body;

    if (!cnpjRaiz || !razaoSocial || !diretorioEntrada || !diretorioSaida) {
      return res.status(400).json({ success: false, message: 'CNPJ Raiz, Razão Social e Diretórios de Entrada/Saída são obrigatórios.' });
    }

    const cleanRaiz = cnpjRaiz.replace(/\D/g, '');
    const id = `cfg-${cleanRaiz}`;
    const db = getDatabase();

    db.prepare(`
      INSERT OR REPLACE INTO diretorios_config (
        id, cnpj_raiz, razao_social, diretorio_entrada, subpasta_data_entrada, estrutura_nome_entrada,
        diretorio_saida, subpasta_data_saida, estrutura_nome_saida, diretorio_eventos, auto_organizar,
        status_monitoramento, ultima_sincronizacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', 'Cadastrado agora')
    `).run(
      id,
      cnpjRaiz,
      razaoSocial,
      diretorioEntrada,
      subpastaDataEntrada ? 1 : 0,
      estruturaNomeEntrada || 'chave',
      diretorioSaida,
      subpastaDataSaida ? 1 : 0,
      estruturaNomeSaida || 'chave',
      diretorioEventos || diretorioEntrada,
      autoOrganizarAoCapturar ? 1 : 0
    );

    return res.json({ success: true, message: 'Regra de diretório salva com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao salvar regra de diretório:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao salvar diretório: ' + err.message });
  }
});

// DELETE /api/directories/:id - Excluir regra de diretório
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const result = db.prepare(`DELETE FROM diretorios_config WHERE id = ?`).run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Configuração não encontrada.' });
    }

    return res.json({ success: true, message: 'Mapeamento de diretório removido com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao excluir diretório:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao excluir regra de diretório.' });
  }
});

export default router;
