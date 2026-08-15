import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

export interface Empresa {
  id: string;
  cnpjRaiz: string;
  cnpjCompleto: string;
  razaoSocial: string;
  nomeFantasia: string;
  uf: string;
  regimeTributario: string;
}

interface AuthContextType {
  user: User | null;
  empresaAtiva: Empresa | null;
  empresasDisponiveis: Empresa[];
  token: string | null;
  login: (token: string, user: User, empresaAtiva: Empresa, empresas: Empresa[]) => void;
  logout: () => void;
  switchEmpresa: (novaEmpresa: Empresa, novoToken: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [empresaAtiva, setEmpresaAtiva] = useState<Empresa | null>(null);
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<Empresa[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sessão do localStorage
    const storedToken = localStorage.getItem('@RadarFiscal:token');
    const storedUser = localStorage.getItem('@RadarFiscal:user');
    const storedEmpresa = localStorage.getItem('@RadarFiscal:empresaAtiva');
    const storedEmpresas = localStorage.getItem('@RadarFiscal:empresasDisponiveis');

    if (storedToken && storedUser && storedEmpresa) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setEmpresaAtiva(JSON.parse(storedEmpresa));
      if (storedEmpresas) {
        setEmpresasDisponiveis(JSON.parse(storedEmpresas));
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User, novaEmpresa: Empresa, empresas: Empresa[]) => {
    setToken(newToken);
    setUser(newUser);
    setEmpresaAtiva(novaEmpresa);
    setEmpresasDisponiveis(empresas);

    localStorage.setItem('@RadarFiscal:token', newToken);
    localStorage.setItem('@RadarFiscal:user', JSON.stringify(newUser));
    localStorage.setItem('@RadarFiscal:empresaAtiva', JSON.stringify(novaEmpresa));
    localStorage.setItem('@RadarFiscal:empresasDisponiveis', JSON.stringify(empresas));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setEmpresaAtiva(null);
    setEmpresasDisponiveis([]);

    localStorage.removeItem('@RadarFiscal:token');
    localStorage.removeItem('@RadarFiscal:user');
    localStorage.removeItem('@RadarFiscal:empresaAtiva');
    localStorage.removeItem('@RadarFiscal:empresasDisponiveis');
  };

  const switchEmpresa = (novaEmpresa: Empresa, novoToken: string) => {
    setToken(novoToken);
    setEmpresaAtiva(novaEmpresa);
    localStorage.setItem('@RadarFiscal:token', novoToken);
    localStorage.setItem('@RadarFiscal:empresaAtiva', JSON.stringify(novaEmpresa));
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0a0f18] text-white flex items-center justify-center">Carregando...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, empresaAtiva, empresasDisponiveis, token, login, logout, switchEmpresa }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
