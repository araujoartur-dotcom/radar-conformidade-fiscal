import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { getSupabase, verifyAuthToken, handleCors } from './_supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
  }

  const supabase = getSupabase();

  // GET /api/users
  if (req.method === 'GET') {
    try {
      const { data: users, error: uErr } = await supabase
        .from('usuarios')
        .select('id, nome, email, perfil, mfa_habilitado, status, ultimo_acesso, created_at')
        .order('created_at', { ascending: false });

      if (uErr) throw uErr;

      const { data: vinculos } = await supabase
        .from('usuario_empresa')
        .select('usuario_id, empresas (cnpj_completo, razao_social)');

      const formatted = (users || []).map((u: any) => {
        const userVinculos = (vinculos || []).filter((v: any) => v.usuario_id === u.id);
        const cnpjsAutorizados = userVinculos.length > 0
          ? userVinculos.map((v: any) => v.empresas?.cnpj_completo).filter(Boolean)
          : ['*'];

        return {
          id: u.id,
          nome: u.nome,
          email: u.email,
          perfil: u.perfil,
          grupoContabil: 'Carteira Geral',
          cnpjsAutorizados,
          mfaHabilitado: Boolean(u.mfa_habilitado),
          status: u.status,
          ultimoAcesso: u.ultimo_acesso || 'Nunca',
          createdAt: u.created_at
        };
      });

      return res.status(200).json({ success: true, data: formatted });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao listar usuários: ' + err.message });
    }
  }

  // POST /api/users
  if (req.method === 'POST') {
    try {
      const { nome, email, perfil, senha, cnpjsAutorizados } = req.body || {};
      if (!nome || !email || !senha) {
        return res.status(400).json({ success: false, message: 'Nome, e-mail e senha são obrigatórios.' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const senhaHash = bcrypt.hashSync(senha, 10);

      const { data: newUser, error: insertErr } = await supabase
        .from('usuarios')
        .insert({
          nome: nome.trim(),
          email: cleanEmail,
          senha_hash: senhaHash,
          perfil: perfil || 'analista_fiscal',
          status: 'ativo'
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      if (Array.isArray(cnpjsAutorizados) && cnpjsAutorizados.length > 0 && !cnpjsAutorizados.includes('*')) {
        const { data: matchedEmpresas } = await supabase
          .from('empresas')
          .select('id, cnpj_completo')
          .in('cnpj_completo', cnpjsAutorizados);

        if (matchedEmpresas && matchedEmpresas.length > 0) {
          const vinculos = matchedEmpresas.map(e => ({
            usuario_id: newUser.id,
            empresa_id: e.id,
            permissao: 'total',
            modulos_permitidos: '*'
          }));
          await supabase.from('usuario_empresa').insert(vinculos);
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Usuário cadastrado com sucesso.',
        data: {
          id: newUser.id,
          nome: newUser.nome,
          email: newUser.email,
          perfil: newUser.perfil,
          status: newUser.status,
          ultimoAcesso: 'Nunca'
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao cadastrar usuário: ' + err.message });
    }
  }

  // PUT /api/users
  if (req.method === 'PUT') {
    try {
      const { id, nome, email, perfil, senha, status, cnpjsAutorizados } = req.body || {};
      const targetId = id || req.query.id;
      if (!targetId) {
        return res.status(400).json({ success: false, message: 'ID do usuário é obrigatório.' });
      }

      const updateData: any = { updated_at: new Date().toISOString() };
      if (nome) updateData.nome = nome.trim();
      if (email) updateData.email = email.toLowerCase().trim();
      if (perfil) updateData.perfil = perfil;
      if (status) updateData.status = status;
      if (senha && senha.trim()) updateData.senha_hash = bcrypt.hashSync(senha, 10);

      const { error } = await supabase.from('usuarios').update(updateData).eq('id', targetId);
      if (error) throw error;

      if (Array.isArray(cnpjsAutorizados)) {
        await supabase.from('usuario_empresa').delete().eq('usuario_id', targetId);
        if (!cnpjsAutorizados.includes('*') && cnpjsAutorizados.length > 0) {
          const { data: matchedEmpresas } = await supabase
            .from('empresas')
            .select('id, cnpj_completo')
            .in('cnpj_completo', cnpjsAutorizados);

          if (matchedEmpresas && matchedEmpresas.length > 0) {
            const vinculos = matchedEmpresas.map(e => ({
              usuario_id: targetId,
              empresa_id: e.id,
              permissao: 'total',
              modulos_permitidos: '*'
            }));
            await supabase.from('usuario_empresa').insert(vinculos);
          }
        }
      }

      return res.status(200).json({ success: true, message: 'Usuário atualizado com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao atualizar usuário: ' + err.message });
    }
  }

  // DELETE /api/users
  if (req.method === 'DELETE') {
    try {
      const targetId = req.body?.id || req.query.id;
      if (!targetId) {
        return res.status(400).json({ success: false, message: 'ID do usuário é obrigatório.' });
      }

      await supabase.from('usuario_empresa').delete().eq('usuario_id', targetId);
      const { error } = await supabase.from('usuarios').delete().eq('id', targetId);
      if (error) throw error;

      return res.status(200).json({ success: true, message: 'Usuário excluído com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro ao excluir usuário: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
