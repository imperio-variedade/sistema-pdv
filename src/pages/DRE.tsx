import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, DollarSign } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface PagamentoDetalhado { metodo: string; valor: number; taxa_cobrada?: number; }
interface Venda { data_venda: string; total_venda: number; custo_total: number; lucro_total: number; pagamentos_detalhados?: PagamentoDetalhado[]; taxas_maquininha?: number; }
interface Despesa { data_vencimento: string; valor: number; categoria: string; }

export default function DRE() {
  const navigate = useNavigate();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [despesasFirebase, setDespesasFirebase] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  const [visao, setVisao] = useState<'mensal' | 'anual'>('mensal');
  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().substring(0, 7)); 
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    const buscarDados = async () => {
      try {
        const [snapVendas, snapDespesas] = await Promise.all([ getDocs(collection(db, "vendas")), getDocs(collection(db, "despesas")) ]);
        setVendas(snapVendas.docs.map(d => d.data()) as Venda[]);
        setDespesasFirebase(snapDespesas.docs.map(d => d.data()) as Despesa[]);
      } catch (e) { alert("Erro ao carregar dados do DRE."); } 
      finally { setCarregando(false); }
    };
    buscarDados();
  }, []);

  const dreData = useMemo(() => {
    const vendasFiltradas = vendas.filter(v => {
      if (visao === 'mensal') return v.data_venda.startsWith(mesSelecionado);
      return v.data_venda.startsWith(anoSelecionado);
    });

    const despesasFiltradas = despesasFirebase.filter(d => {
      if (visao === 'mensal') return d.data_vencimento.startsWith(mesSelecionado);
      return d.data_vencimento.startsWith(anoSelecionado);
    });

    const receitaBruta = vendasFiltradas.reduce((acc, v) => acc + v.total_venda, 0);
    const custoFornecedores = vendasFiltradas.reduce((acc, v) => acc + (v.custo_total || 0), 0);
    
    let taxasDebito = 0; let taxasCredito = 0; let taxasPix = 0;
    vendasFiltradas.forEach(v => {
      if (v.pagamentos_detalhados) {
        v.pagamentos_detalhados.forEach(p => {
          if (p.metodo === 'Cartão de Débito') taxasDebito += p.taxa_cobrada || 0;
          if (p.metodo === 'Cartão de Crédito') taxasCredito += p.taxa_cobrada || 0;
          if (p.metodo === 'PIX') taxasPix += p.taxa_cobrada || 0;
        });
      }
    });

    const totalTaxas = taxasDebito + taxasCredito + taxasPix;
    const impostoMEI = despesasFiltradas.filter(d => d.categoria === 'Imposto MEI (DAS)').reduce((acc, d) => acc + d.valor, 0);
    const receitaLiquida = receitaBruta - totalTaxas - impostoMEI;
    const lucroBruto = receitaLiquida - custoFornecedores;
    const despesasOperacionais = despesasFiltradas.filter(d => d.categoria !== 'Imposto MEI (DAS)').reduce((acc, d) => acc + d.valor, 0);
    const ebit = lucroBruto - despesasOperacionais;

    return { receitaBruta, impostoMEI, taxasDebito, taxasCredito, taxasPix, totalTaxas, receitaLiquida, custoFornecedores, lucroBruto, despesasOperacionais, ebit };
  }, [vendas, despesasFirebase, visao, mesSelecionado, anoSelecionado]);

  if (carregando) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0b' }}><Loader2 size={40} className="spin" color="#facc15" /></div>;

  return (
    <>
      <style>{`
        html, body, #root { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background-color: #0a0a0b; color: #e4e4e7; font-family: system-ui, sans-serif; }
        .dre-layout { display: flex; flex-direction: column; height: 100%; width: 100%; }
        .dre-header { flex: 0 0 64px; background-color: #18181b; padding: 0 2vw; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #facc15; }
        .btn-voltar { background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: bold; transition: 0.3s;}
        .btn-voltar:hover { background: #3f3f46; color: white; }
        .titulo-loja { font-size: clamp(1rem, 1.2vw, 1.8rem); font-weight: 900; text-transform: uppercase; margin: 0; color: #facc15; letter-spacing: 1px; }

        .dre-content { flex: 1; overflow-y: auto; padding: 2vw; }
        .filtro-card { background: #121214; padding: 1.5vw; border-radius: 12px; border: 1px solid #27272a; margin-bottom: 2vw; display: flex; gap: 2vw; align-items: center; justify-content: center; }
        .select-dre { padding: 10px; border-radius: 8px; border: 1px solid #3f3f46; font-weight: bold; outline: none; background: #0a0a0b; color: #facc15; color-scheme: dark; }
        
        .dre-table { background: #121214; border-radius: 12px; border: 1px solid #27272a; overflow: hidden; max-width: 900px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .dre-row { display: flex; justify-content: space-between; padding: 10px 25px; border-bottom: 1px dashed #27272a; font-size: 0.95rem; }
        .dre-row.header-row { background: #18181b; font-weight: 800; color: #facc15; text-transform: uppercase; font-size: 0.8rem; padding: 15px 25px; border-bottom: 2px solid #27272a;}
        .dre-row.subtotal { background: rgba(250, 204, 21, 0.05); font-weight: 700; color: #facc15; border-bottom: 2px solid #27272a; padding: 15px 25px;}
        .dre-row.final { background: #000; color: #facc15; font-weight: 900; font-size: 1.2rem; padding: 20px 25px; border-top: 2px solid #facc15;}
        .val-pos { color: #10b981; } .val-neg { color: #ef4444; }
        .spin { animation: spin 1s linear infinite; }
      `}</style>

      <div className="dre-layout">
        <header className="dre-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}><button onClick={() => navigate('/')} className="btn-voltar"><ArrowLeft size={18} /> VOLTAR</button><h1 className="titulo-loja">DRE FINANCEIRO</h1></div>
          <button className="btn-voltar" style={{ background: '#facc15', color: '#0a0a0b', borderColor: '#facc15' }} onClick={() => window.print()}><Download size={18} /> EXPORTAR PDF</button>
        </header>

        <main className="dre-content">
          <div className="filtro-card" style={{maxWidth: '900px', margin: '0 auto 20px auto'}}>
            <div style={{display:'flex', gap: '10px'}}>
              <button className="select-dre" style={{cursor:'pointer', color: visao === 'mensal' ? '#0a0a0b' : '#a1a1aa', background: visao === 'mensal' ? '#facc15' : '#18181b'}} onClick={() => setVisao('mensal')}>MENSAL</button>
              <button className="select-dre" style={{cursor:'pointer', color: visao === 'anual' ? '#0a0a0b' : '#a1a1aa', background: visao === 'anual' ? '#facc15' : '#18181b'}} onClick={() => setVisao('anual')}>ANUAL</button>
            </div>
            {visao === 'mensal' ? <input type="month" className="select-dre" value={mesSelecionado} onChange={e => setMesSelecionado(e.target.value)} /> : <select className="select-dre" value={anoSelecionado} onChange={e => setAnoSelecionado(e.target.value)}><option value="2026">2026</option><option value="2025">2025</option></select>}
          </div>

          <div className="dre-table">
            <div className="dre-row header-row"><span>Descrição da Conta</span><span>Valor Acumulado</span></div>

            <div className="dre-row" style={{fontWeight: 700, padding: '15px 25px'}}><span>(+) FATURAMENTO BRUTO (Vendas)</span><span style={{color: '#facc15'}}>R$ {dreData.receitaBruta.toFixed(2)}</span></div>
            
            <div className="dre-row"><span style={{paddingLeft: '20px', color: '#a1a1aa'}}>(-) Taxas Maquininha (Débito)</span><span className="val-neg">R$ {dreData.taxasDebito.toFixed(2)}</span></div>
            <div className="dre-row"><span style={{paddingLeft: '20px', color: '#a1a1aa'}}>(-) Taxas Maquininha (Crédito)</span><span className="val-neg">R$ {dreData.taxasCredito.toFixed(2)}</span></div>
            <div className="dre-row"><span style={{paddingLeft: '20px', color: '#a1a1aa'}}>(-) Taxas Transação (PIX)</span><span className="val-neg">R$ {dreData.taxasPix.toFixed(2)}</span></div>
            <div className="dre-row"><span style={{paddingLeft: '20px', color: '#a1a1aa'}}>(-) Impostos sobre Vendas (MEI DAS)</span><span className="val-neg">R$ {dreData.impostoMEI.toFixed(2)}</span></div>

            <div className="dre-row subtotal"><span>(=) RECEITA LÍQUIDA</span><span>R$ {dreData.receitaLiquida.toFixed(2)}</span></div>

            <div className="dre-row" style={{padding: '15px 25px'}}><span style={{paddingLeft: '20px'}}>(-) Custo de Mercadorias (CPV)</span><span className="val-neg">R$ {dreData.custoFornecedores.toFixed(2)}</span></div>

            <div className="dre-row subtotal" style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981'}}><span>(=) LUCRO BRUTO</span><span>R$ {dreData.lucroBruto.toFixed(2)}</span></div>

            <div className="dre-row" style={{padding: '15px 25px'}}><span style={{paddingLeft: '20px'}}>(-) Despesas Operacionais (Luz, Aluguel, etc)</span><span className="val-neg">R$ {dreData.despesasOperacionais.toFixed(2)}</span></div>

            <div className="dre-row final"><div style={{display: 'flex', alignItems: 'center', gap: '10px'}}><DollarSign size={20} color="#facc15" /><span>(=) EBIT (LUCRO LÍQUIDO)</span></div><span>R$ {dreData.ebit.toFixed(2)}</span></div>
          </div>
        </main>
      </div>
    </>
  );
}