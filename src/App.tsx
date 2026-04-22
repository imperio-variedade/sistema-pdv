import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Telas
import Login from './pages/Login';
import Menu from './pages/Menu';
import PDV from './pages/PDV';
import Estoque from './pages/Estoque';
import Financeiro from './pages/Financeiro';
import DRE from './pages/DRE';
import Despesas from './pages/Despesas';
import Fornecedores from './pages/Fornecedores';
import Configuracoes from './pages/Configuracoes';
import NotaFiscal from './pages/NotaFiscal';

// Componente "Leão de Chácara": Só deixa passar se tiver logado
function RotaProtegida({ children }: { children: React.ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAutenticado(!!user);
      setCarregando(false);
    });
    return () => unsubscribe();
  }, []);

  if (carregando) {
    return <div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0b', color: '#facc15', fontWeight: 'bold'}}>VERIFICANDO ACESSO...</div>;
  }

  // Se não estiver autenticado, joga pro Login
  if (!autenticado) {
    return <Navigate to="/login" />;
  }

  // Se estiver tudo certo, carrega a tela
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename="/sistema-pdv">
      <Routes>
        {/* Rota Pública */}
        <Route path="/login" element={<Login />} />

        {/* Rotas Privadas (Blindadas) */}
        <Route path="/" element={<RotaProtegida><Menu /></RotaProtegida>} />
        <Route path="/pdv" element={<RotaProtegida><PDV /></RotaProtegida>} />
        <Route path="/estoque" element={<RotaProtegida><Estoque /></RotaProtegida>} />
        <Route path="/financeiro" element={<RotaProtegida><Financeiro /></RotaProtegida>} />
        <Route path="/dre" element={<RotaProtegida><DRE /></RotaProtegida>} />
        <Route path="/despesas" element={<RotaProtegida><Despesas /></RotaProtegida>} />
        <Route path="/fornecedores" element={<RotaProtegida><Fornecedores /></RotaProtegida>} />
        <Route path="/configuracoes" element={<RotaProtegida><Configuracoes /></RotaProtegida>} />
        <Route path="/notas" element={<RotaProtegida><NotaFiscal /></RotaProtegida>} />
      </Routes>
    </BrowserRouter>
  );
}