import { Router } from 'express';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';

const router = Router();

// GET /api/directories - Listar todos os diretórios mapeados
router.get('/', async (req, res) => {
  try {
    // 1. Prioridade: Supabase (Produção / Cloud)
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        let { data: rows, error } = await supabase
          .from('diretorios_config')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Auto-popular diretórios a partir das empresas cadastradas se houver empresas sem diretório
        const { data: empresas } = await supabase
          .from('empresas')
          .select('cnpj_raiz, razao_social, cnpj_completo');

        if (empresas && empresas.length > 0) {
          const existingRaizSet = new Set((rows || []).map((r: any) => (r.cnpj_raiz || '').replace(/\D/g, '')));
          const toInsert: any[] = [];

          for (const emp of empresas) {
            const clean = (emp.cnpj_raiz || emp.cnpj_completo || '').replace(/\D/g, '').substring(0, 8);
            if (clean.length === 8 && !existingRaizSet.has(clean)) {
              existingRaizSet.add(clean);
              const formatted = `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}`;
              toInsert.push({
                id: `cfg-${clean}`,
                cnpj_raiz: clean,
                razao_social: emp.razao_social || `EMPRESA CNPJ RAIZ ${formatted}`,
                diretorio_entrada: `C:\\SEFAZ\\XMLs\\${clean}\\Entrada`,
                subpasta_data_entrada: true,
                estrutura_nome_entrada: 'chave',
                diretorio_saida: `C:\\SEFAZ\\XMLs\\${clean}\\Saida`,
                subpasta_data_saida: true,
                estrutura_nome_saida: 'chave',
                diretorio_eventos: `C:\\SEFAZ\\XMLs\\${clean}\\Eventos`,
                auto_organizar: true,
                status_monitoramento: 'ativo',
                ultima_sincronizacao: 'Auto-gerado da Carteira'
              });
            }
          }

          if (toInsert.length > 0) {
            await supabase.from('diretorios_config').upsert(toInsert);
            const { data: reloaded } = await supabase
              .from('diretorios_config')
              .select('*')
              .order('created_at', { ascending: false });
            if (reloaded) rows = reloaded;
          }
        }

        const formatted = (rows || []).map((r: any) => {
          const clean = (r.cnpj_raiz || '').replace(/\D/g, '');
          const formattedRaiz = clean.length === 8 ? `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}` : r.cnpj_raiz;
          return {
            id: r.id,
            cnpjRaiz: formattedRaiz,
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
          };
        });

        return res.json({ success: true, data: formatted });
      }
    }

    // 2. Fallback: SQLite Local
    const db = getDatabase();
    let rows = db.prepare(`SELECT * FROM diretorios_config ORDER BY created_at DESC`).all();

    // Auto-popular diretórios a partir das empresas cadastradas se a tabela estiver vazia
    try {
      const empresas = db.prepare(`
        SELECT DISTINCT cnpj_raiz, razao_social, cnpj_completo 
        FROM empresas 
        WHERE (cnpj_raiz IS NOT NULL AND cnpj_raiz != '') 
           OR (cnpj_completo IS NOT NULL AND cnpj_completo != '')
      `).all() as any[];

      const existingRaizSet = new Set((rows || []).map((r: any) => (r.cnpj_raiz || '').replace(/\D/g, '')));

      for (const emp of empresas) {
        const clean = (emp.cnpj_raiz || emp.cnpj_completo || '').replace(/\D/g, '').substring(0, 8);
        if (clean.length === 8 && !existingRaizSet.has(clean)) {
          existingRaizSet.add(clean);
          const formatted = `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}`;
          const id = `cfg-${clean}`;
          db.prepare(`
            INSERT OR IGNORE INTO diretorios_config (
              id, cnpj_raiz, razao_social, diretorio_entrada, subpasta_data_entrada, estrutura_nome_entrada,
              diretorio_saida, subpasta_data_saida, estrutura_nome_saida, diretorio_eventos, auto_organizar,
              status_monitoramento, ultima_sincronizacao
            ) VALUES (?, ?, ?, ?, 1, 'chave', ?, 1, 'chave', ?, 1, 'ativo', 'Auto-gerado da Carteira')
          `).run(
            id,
            formatted,
            emp.razao_social || `EMPRESA CNPJ RAIZ ${formatted}`,
            `C:\\SEFAZ\\XMLs\\${clean}\\Entrada`,
            `C:\\SEFAZ\\XMLs\\${clean}\\Saida`,
            `C:\\SEFAZ\\XMLs\\${clean}\\Eventos`
          );
        }
      }
      rows = db.prepare(`SELECT * FROM diretorios_config ORDER BY created_at DESC`).all();
    } catch (seedErr: any) {
      console.warn('⚠️ Aviso ao auto-popular diretórios a partir de empresas:', seedErr.message);
    }

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

// POST /api/directories - Criar/Atualizar regra de diretório por CNPJ Raiz
router.post('/', async (req, res) => {
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

    const cleanRaiz = cnpjRaiz.replace(/\D/g, '').substring(0, 8);
    const id = `cfg-${cleanRaiz}`;
    const formatted = `${cleanRaiz.substring(0, 2)}.${cleanRaiz.substring(2, 5)}.${cleanRaiz.substring(5, 8)}`;

    // 1. Salvar no Supabase se configurado
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const payload = {
          id,
          cnpj_raiz: cleanRaiz,
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
        };
        const { error } = await supabase.from('diretorios_config').upsert(payload);
        if (error) throw error;
      }
    }

    // 2. Salvar também no SQLite local
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO diretorios_config (
        id, cnpj_raiz, razao_social, diretorio_entrada, subpasta_data_entrada, estrutura_nome_entrada,
        diretorio_saida, subpasta_data_saida, estrutura_nome_saida, diretorio_eventos, auto_organizar,
        status_monitoramento, ultima_sincronizacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo', 'Cadastrado agora')
    `).run(
      id,
      formatted,
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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { error } = await supabase.from('diretorios_config').delete().eq('id', id);
        if (error) throw error;
      }
    }

    const db = getDatabase();
    db.prepare(`DELETE FROM diretorios_config WHERE id = ?`).run(id);

    return res.json({ success: true, message: 'Mapeamento de diretório removido com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao excluir diretório:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao excluir regra de diretório.' });
  }
});

export default router;
