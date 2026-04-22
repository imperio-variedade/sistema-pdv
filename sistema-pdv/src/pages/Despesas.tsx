import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Wallet, X, Save, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

interface Despesa {
  id?: string;
  descricao: string;
  categoria: string;
  valor: number;
  data_vencimento: string;
  pago: boolean;
  data_pagamento?: string;
}

export default function Despesas() {
  const navigate = useNavigate();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [painelAberto, setPainelAberto] = useState(false);
  const [despesaEditando, setDespesaEditando] = useState<Partial<Despesa> | null>(null);
  const [salvando, setSalvando] = useState(false);
  
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().substring(0, 7));

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const snap = await getDocs(collection(db, "despesas"));
      setDespesas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Despesa[]);
    } catch (error) {
      alert("Erro ao carregar despesas.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  const despesasFiltradas = useMemo(() => {
    return despesas.filter(d => d.data_vencimento.startsWith(mesFiltro)).sort((a,b) => a.data_vencimento.localeCompare(b.data_vencimento));
  }, [despesas, mesFiltro]);

  const kpis = useMemo(() => {
    return despesasFiltradas.reduce((acc, d) => {
      acc.total += d.valor;
      if (d.pago) acc.pago += d.valor;
      else acc.pendente += d.valor;
      return acc;
    }, { total: 0, pago: 0, pendente: 0 });
  }, [despesasFiltradas]);

  const abrirNovaDespesa = () => {
    setDespesaEditando({ descricao: '', categoria: 'Despesa Fixa', valor: 0, data_vencimento: new Date().toISOString().substring(0, 10), pago: false });
    setPainelAberto(true);
  };

  const salvarDespesa = async () => {
    if (!despesaEditando?.descricao || !despesaEditando?.valor || !despesaEditando?.data_vencimento) return alert('Preencha os campos obrigatórios.');
    
    setSalvando(true);
    try {
      const dadosParaSalvar = { ...despesaEditando };
      if (dadosParaSalvar.pago && !dadosParaSalvar.data_pagamento) dadosParaSalvar.data_pagamento = new Date().toISOString();
      delete dadosParaSalvar.id;

      if (despesaEditando.id) await updateDoc(doc(db, "despesas", despesaEditando.id), dadosParaSalvar);
      else await addDoc(collection(db, "despesas"), dadosParaSalvar);
      
      await carregarDados();
      setPainelAberto(false);
      setDespesaEditando(null);
    } catch (error) { 
      alert("Erro ao salvar despesa."); 
    } finally {
      setSalvando(false);
    }
  };

  const alternarPagamento = async (despesa: Despesa) => {
    if (!despesa.id) return;
    const novoStatus = !despesa.pago;
    await updateDoc(doc(db, "despesas", despesa.id), { pago: novoStatus, data_pagamento: novoStatus ? new Date().toISOString() : null });
    setDespesas(prev => prev.map(d => d.id === despesa.id ? { ...d, pago: novoStatus } : d));
  };

  const excluirDespesa = async (id: string | undefined) => {
    if (!id) return;
    if (window.confirm('Tem certeza que deseja excluir?')) {
      await deleteDoc(doc(db, "despesas", id));
      setDespesas(prev => prev.filter(d => d.id !== id));
    }
  };

  return (
    <>
      <style>{`
        html, body, #root { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background-color: #0a0a0b; color: #e4e4e7; font-family: system-ui, sans-serif; }
        .layout { display: flex; flex-direction: column; height: 100%; width: 100%; }
        .header { flex: 0 0 64px; background-color: #18181b; padding: 0 2vw; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #facc15; }
        .btn-voltar { background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: bold; transition: 0.3s;}
        .btn-voltar:hover { background: #3f3f46; color: white; }
        .titulo-loja { font-size: clamp(1rem, 1.2vw, 1.8rem); font-weight: 900; text-transform: uppercase; margin: 0; color: #facc15; letter-spacing: 1px; }
        
        .btn-novo { background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); }
        .btn-novo:hover { background: #dc2626; transform: translateY(-2px); }

        .main-content { flex: 1; display: flex; overflow: hidden; position: relative; }
        .container-lista { flex: 1; display: flex; flex-direction: column; padding: 1.5vw; overflow: hidden; }
        
        .dash-header { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap;}
        .kpi-box { flex: 1; min-width: 200px; background: #121214; padding: 20px; border-radius: 12px; border: 1px solid #27272a; }
        .kpi-title { font-size: 0.8rem; font-weight: bold; color: #a1a1aa; text-transform: uppercase; margin-bottom: 5px; }
        .kpi-val { font-size: 1.8rem; font-weight: 900; }
        
        .filtro-mes { background: #18181b; padding: 10px 15px; border-radius: 8px; border: 1px solid #3f3f46; color: #facc15; font-weight: bold; font-size: 1.1rem; outline: none; color-scheme: dark;}

        .table-wrapper { flex: 1; background: #121214; border: 1px solid #27272a; border-radius: 8px; overflow-y: auto;}
        table { width: 100%; border-collapse: collapse; }
        th { background: #18181b; padding: 1.5vh 1vw; font-size: 0.75rem; text-transform: uppercase; color: #facc15; position: sticky; top: 0; z-index: 10; border-bottom: 2px solid #27272a; text-align: left; letter-spacing: 1px;}
        td { padding: 1.5vh 1vw; border-bottom: 1px dashed #27272a; font-size: 0.9rem; }
        tr:hover { background: #1c1f24; }
        
        .drawer { width: clamp(320px, 30vw, 450px); background: #18181b; border-left: 2px solid #ef4444; display: flex; flex-direction: column; transition: 0.3s; position: absolute; right: 0; top: 0; bottom: 0; transform: translateX(100%); z-index: 50; box-shadow: -10px 0 30px rgba(0,0,0,0.5);}
        .drawer.active { transform: translateX(0); position: relative; }
        .drawer-header { padding: 20px; border-bottom: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; background: #121214; }
        .drawer-body { padding: 2vh 1.5vw; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
        
        .form-control { display: flex; flex-direction: column; gap: 6px; }
        .form-control label { font-size: 0.75rem; font-weight: bold; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;}
        .input-text { padding: 12px; border: 1px solid #3f3f46; border-radius: 6px; outline: none; background: #0a0a0b; color: #e4e4e7; font-size: 0.95rem; transition: 0.2s; color-scheme: dark;}
        .input-text:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1); }
        
        .btn-save { background: #ef4444; color: white; border: none; padding: 15px; border-radius: 8px; font-weight: 900; font-size: 1.1rem; cursor: pointer; width: 100%; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px; text-transform: uppercase; }
        .btn-save:hover:not(:disabled) { background: #dc2626; }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; background: #3f3f46; color: #a1a1aa; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #121214; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
      `}</style>

      <div className="layout">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
            <button onClick={() => navigate('/')} className="btn-voltar"><ArrowLeft size={16} /> VOLTAR</button>
            <h1 className="titulo-loja">CONTAS E DESPESAS</h1>
          </div>
          <button className="btn-novo" onClick={abrirNovaDespesa}><Plus size={20} /> LANÇAR CONTA</button>
        </header>

        <main className="main-content">
          <section className="container-lista">
            
            <div className="dash-header">
              <div style={{display:'flex', flexDirection:'column', justifyContent:'center', marginRight:'20px'}}>
                <span style={{fontSize:'0.8rem', color:'#a1a1aa', fontWeight:'bold', marginBottom:'5px'}}>MÊS DE REFERÊNCIA:</span>
                <input type="month" className="filtro-mes" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} />
              </div>
              <div className="kpi-box"><div className="kpi-title">A Pagar (Pendente)</div><div className="kpi-val" style={{color: '#ef4444'}}>R$ {kpis.pendente.toFixed(2)}</div></div>
              <div className="kpi-box"><div className="kpi-title">Contas Pagas</div><div className="kpi-val" style={{color: '#10b981'}}>R$ {kpis.pago.toFixed(2)}</div></div>
              <div className="kpi-box" style={{background: '#18181b'}}><div className="kpi-title">Total do Mês</div><div className="kpi-val" style={{color: '#facc15'}}>R$ {kpis.total.toFixed(2)}</div></div>
            </div>

            <div className="table-wrapper">
              {carregando ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#facc15' }}>
                  <Loader2 size={40} className="spin" style={{ marginBottom: '16px' }} />
                  <h2 style={{color: '#a1a1aa'}}>Carregando contas...</h2>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr><th style={{textAlign: 'center'}}>Status</th><th>Vencimento</th><th>Descrição / Categoria</th><th style={{ textAlign: 'right' }}>Valor (R$)</th><th style={{ textAlign: 'center' }}>AÇÕES</th></tr>
                  </thead>
                  <tbody>
                    {despesasFiltradas.map(d => (
                      <tr key={d.id} style={{ opacity: d.pago ? 0.6 : 1 }}>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => alternarPagamento(d)} style={{background:'none', border:'none', cursor:'pointer'}}>
                            {d.pago ? <CheckCircle2 size={24} color="#10b981" /> : <Circle size={24} color="#ef4444" />}
                          </button>
                        </td>
                        <td style={{ color: d.pago ? '#a1a1aa' : '#f8fafc', fontWeight: 'bold' }}>{new Date(d.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td>
                          <div style={{ fontWeight: 'bold', color: d.pago ? '#a1a1aa' : '#f8fafc', fontSize: '1rem', textDecoration: d.pago ? 'line-through' : 'none' }}>{d.descricao}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{d.categoria}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '900', color: d.pago ? '#10b981' : '#ef4444' }}>R$ {d.valor.toFixed(2)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#facc15', marginRight: '15px', transition: '0.2s' }} onClick={() => { setDespesaEditando(d); setPainelAberto(true); }}><Edit size={20} /></button>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', transition: '0.2s' }} onClick={() => excluirDespesa(d.id)}><Trash2 size={20} /></button>
                        </td>
                      </tr>
                    ))}
                    {despesasFiltradas.length === 0 && !carregando && (
                      <tr><td colSpan={5} style={{textAlign: 'center', padding: '40px', color: '#52525b'}}>Nenhuma despesa lançada neste mês.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <aside className={`drawer ${painelAberto ? 'active' : ''}`}>
            <div className="drawer-header">
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}><Wallet size={22}/> {despesaEditando?.id ? 'EDITAR CONTA' : 'NOVA CONTA'}</h2>
              <X size={26} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => setPainelAberto(false)} />
            </div>
            
            {despesaEditando && (
              <div className="drawer-body">
                <div className="form-control"><label>Descrição / Nome da Conta</label><input className="input-text" value={despesaEditando.descricao} onChange={e => setDespesaEditando({...despesaEditando, descricao: e.target.value})} placeholder="Ex: Conta de Luz, Aluguel..." /></div>
                <div className="form-control">
                  <label>Categoria</label>
                  <select className="input-text" value={despesaEditando.categoria} onChange={e => setDespesaEditando({...despesaEditando, categoria: e.target.value})}>
                    <option value="Despesa Fixa">Despesa Fixa (Aluguel, Internet)</option>
                    <option value="Imposto MEI (DAS)">Imposto MEI (DAS)</option>
                    <option value="Folha de Pagamento">Folha de Pagamento</option>
                    <option value="Despesa Variável">Despesa Variável (Manutenção)</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div className="form-control"><label>Valor (R$)</label><input type="number" step="0.01" className="input-text" value={despesaEditando.valor} onChange={e => setDespesaEditando({...despesaEditando, valor: Number(e.target.value)})} /></div>
                <div className="form-control"><label>Data de Vencimento</label><input type="date" className="input-text" value={despesaEditando.data_vencimento} onChange={e => setDespesaEditando({...despesaEditando, data_vencimento: e.target.value})} /></div>
                
                <div style={{background: '#121214', border: '1px solid #27272a', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px'}}>
                  <input type="checkbox" id="chkPago" checked={despesaEditando.pago} onChange={e => setDespesaEditando({...despesaEditando, pago: e.target.checked})} style={{width: '20px', height: '20px', accentColor: '#10b981'}} />
                  <label htmlFor="chkPago" style={{color: '#f8fafc', fontWeight: 'bold', cursor: 'pointer'}}>Marcar como já pago</label>
                </div>
              </div>
            )}
            
            <div style={{ padding: '20px', borderTop: '1px solid #27272a', background: '#121214' }}>
              <button className="btn-save" onClick={salvarDespesa} disabled={salvando}>
                {salvando ? <Loader2 size={24} className="spin" /> : <Save size={24} />} 
                {salvando ? 'SALVANDO...' : 'SALVAR DESPESA'}
              </button>
            </div>
          </aside>
        </main>
      </div>
    </>
  );
}