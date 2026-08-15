import { createRequire } from 'module';
import { getSupabase, handleCors } from '../_supabase';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const supabase = getSupabase();
    const cleanEmail = String(email).toLowerCase().trim();

    // 1. Buscar usuário
    const { data: user, error: userErr } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (userErr || !user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.', code: 'AUTH_INVALID_CREDENTIALS' });
    }

    if (user.status === 'bloqueado') {
      return res.status(403).json({ error: 'Conta bloqueada pelo administrador.', code: 'AUTH_USER_BLOCKED' });
    }

    // 2. Validar senha com bcrypt
    const senhaValida = bcrypt.compareSync(String(senha), user.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.', code: 'AUTH_INVALID_CREDENTIALS' });
    }

    // Atualizar último acesso em background
    supabase
      .from('usuarios')
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq('id', user.id)
      .then();

    // 3. Buscar empresas vinculadas
    const { data: vinculos } = await supabase
      .from('usuario_empresa')
      .select('permissao, modulos_permitidos, empresa_id')
      .eq('usuario_id', user.id);

    let empresas: any[] = [];
    if (vinculos && vinculos.length > 0) {
      const empIds = vinculos.map(v => v.empresa_id);
      const { data: empData } = await supabase
        .from('empresas')
        .select('*')
        .in('id', empIds)
        .eq('status', 'ativo');

      empresas = (empData || []).map(e => {
        const v = vinculos.find(vinc => vinc.empresa_id === e.id);
        return {
          ...e,
          permissao: v?.permissao || 'total',
          modulosPermitidos: v?.modulos_permitidos || '*',
        };
      });
    }

    // Se admin_master não tiver vínculo explícito, vincular a todas ativas
    if (empresas.length === 0 && user.perfil === 'admin_master') {
      const { data: allEmp } = await supabase
        .from('empresas')
        .select('*')
        .eq('status', 'ativo');

      empresas = (allEmp || []).map(e => ({
        ...e,
        permissao: 'total',
        modulosPermitidos: '*',
      }));
    }

    const empresaAtiva = empresas[0] || null;
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-radar-fiscal-change-in-production-2026';

    const payload = {
      userId: user.id,
      email: user.email,
      perfil: user.perfil,
      empresaAtivaId: empresaAtiva?.id || null,
      empresaCnpj: empresaAtiva?.cnpj_completo || null,
    };

    const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: '8h' });
    const refreshToken = uuid();

    return res.status(200).json({
      accessToken,
      refreshToken,
      expiresIn: '8h',
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        mfaHabilitado: Boolean(user.mfa_habilitado),
      },
      empresaAtiva: empresaAtiva ? {
        id: empresaAtiva.id,
        cnpjRaiz: empresaAtiva.cnpj_raiz,
        cnpjCompleto: empresaAtiva.cnpj_completo,
        razaoSocial: empresaAtiva.razao_social,
        nomeFantasia: empresaAtiva.nome_fantasia || empresaAtiva.razao_social,
        uf: empresaAtiva.uf,
        regimeTributario: empresaAtiva.regime_tributario,
        permissao: empresaAtiva.permissao,
        modulosPermitidos: empresaAtiva.modulosPermitidos,
      } : null,
      empresasDisponiveis: empresas.map((e: any) => ({
        id: e.id,
        cnpjCompleto: e.cnpj_completo,
        razaoSocial: e.razao_social,
        uf: e.uf,
      })),
    });
  } catch (err: any) {
    console.error('Erro no login serverless:', err);
    return res.status(500).json({ error: 'Erro ao autenticar: ' + err.message });
  }
}
