import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CalendarRange, PackageSearch, TrendingUp, CreditCard, ListTodo, Loader2, Search, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface Produto { id: string; nome: string; categoria: string; custo: number; estoque_atual: number; codigo_barras: string; }
interface ItemVenda { nome: string; quantidade: number; preco_unitario: number; custo_unitario: number; subtotal: number; categoria: string; codigo_barras?: string; }
interface PagamentoDetalhado { metodo: string; valor: number; taxa_cobrada?: number; valor_liquido?: number; }
interface Venda { id: string; data_venda: string; forma_pagamento: string; pagamentos_detalhados?: PagamentoDetalhado[]; total_venda: number; troco?: number; custo_total: number; lucro_total: number; taxas_maquininha?: number; itens: ItemVenda[]; }
interface ItemNota { produto_id: string; nome: string; categoria: string; quantidade: number; custo_unitario: number; subtotal: number; }
interface NotaFiscal { id: string; data_emissao: string; fornecedor: string; total_nota: number; itens: ItemNota[]; }

export default function Financeiro() {
  const navigate = useNavigate();
  const [abaAtiva, setAbaAtiva] = useState<'dia' | 'periodo' | 'produto' | 'top_produtos' | 'pagamentos' | 'grupos' | 'completo'>('dia');
  
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [produtosBase, setProdutosBase] = useState<Produto[]>([]);
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscal[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [dataUnica, setDataUnica] = useState(new Date().toISOString().substring(0, 10));
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().substring(0, 10));
  const [dataFim, setDataFim] = useState(new Date().toISOString().substring(0, 10));
  const [buscaProduto, setBuscaProduto] = useState('');
  const [vendaAberta, setVendaAberta] = useState<string | null>(null);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [snapVendas, snapProdutos, snapNotas] = await Promise.all([
          getDocs(collection(db, "vendas")),
          getDocs(collection(db, "produtos")),
          getDocs(collection(db, "notas_fiscais"))
        ]);
        setVendas(snapVendas.docs.map(d => ({ id: d.id, ...d.data() })) as Venda[]);
        setProdutosBase(snapProdutos.docs.map(d => ({ id: d.id, ...d.data() })) as Produto[]);
        setNotasFiscais(snapNotas.docs.map(d => ({ id: d.id, ...d.data() })) as NotaFiscal[]);
      } catch (error) {
        alert("Erro ao carregar dados financeiros e estoque.");
      } finally {
        setCarregando(false);
      }
    };
    carregarDados();
  }, []);

  const detalhesDoDia = useMemo(() => {
    const filtradas = vendas.filter(v => v.data_venda.startsWith(dataUnica));
    const totalDia = filtradas.reduce((acc, v) => acc + v.total_venda, 0);
    return { vendas: filtradas, totalDia };
  }, [vendas, dataUnica]);

  const resumoAgrupadoPeriodo = useMemo(() => {
    const agrupado: Record<string, { faturamento: number; lucro: number; qtd: number }> = {};
    vendas.forEach(v => {
      const d = v.data_venda.substring(0, 10);
      if ((!dataInicio || d >= dataInicio) && (!dataFim || d <= dataFim)) {
        if (!agrupado[d]) agrupado[d] = { faturamento: 0, lucro: 0, qtd: 0 };
        agrupado[d].faturamento += v.total_venda;
        agrupado[d].lucro += v.lucro_total;
        agrupado[d].qtd += 1;
      }
    });
    return Object.entries(agrupado).map(([data, d]) => ({ data, ...d })).sort((a,b) => b.data.localeCompare(a.data));
  }, [vendas, dataInicio, dataFim]);

  const rastreioProduto = useMemo(() => {
    const termo = buscaProduto.toLowerCase().trim();
    if (!termo) return null;
    const produtoPorEan = produtosBase.find(p => p.codigo_barras === termo);
    const nomeAlvo = produtoPorEan ? produtoPorEan.nome.toLowerCase() : termo;

    let totalQtd = 0, faturamento = 0, lucroBruto = 0, lucroLiquido = 0;
    const historico: any[] = [];

    vendas.forEach(v => {
      const d = v.data_venda.substring(0, 10);
      if ((!dataInicio || d >= dataInicio) && (!dataFim || d <= dataFim)) {
        v.itens.forEach(item => {
          if (item.nome.toLowerCase().includes(termo) || item.nome.toLowerCase() === nomeAlvo || item.codigo_barras === termo) {
            const taxaProporcional = (v.taxas_maquininha || 0) * (item.subtotal / v.total_venda);
            const lucroB = item.subtotal - (item.custo_unitario * item.quantidade);
            totalQtd += item.quantidade;
            faturamento += item.subtotal;
            lucroBruto += lucroB;
            lucroLiquido += (lucroB - taxaProporcional);
            historico.push({ data: v.data_venda, qtd: item.quantidade, total: item.subtotal });
          }
        });
      }
    });
    return { totalQtd, faturamento, lucroBruto, lucroLiquido, historico: historico.sort((a,b) => b.data.localeCompare(a.data)) };
  }, [vendas, produtosBase, buscaProduto, dataInicio, dataFim]);

  const rankingGeral = useMemo(() => {
    const mapa: Record<string, { qtd: number; faturamento: number; lucro: number }> = {};
    vendas.forEach(v => {
      const d = v.data_venda.substring(0, 10);
      if ((!dataInicio || d >= dataInicio) && (!dataFim || d <= dataFim)) {
        v.itens.forEach(i => {
          if (!mapa[i.nome]) mapa[i.nome] = { qtd: 0, faturamento: 0, lucro: 0 };
          mapa[i.nome].qtd += i.quantidade;
          mapa[i.nome].faturamento += i.subtotal;
          mapa[i.nome].lucro += (i.subtotal - (i.custo_unitario * i.quantidade));
        });
      }
    });
    return Object.entries(mapa).map(([nome, d]) => ({ nome, ...d })).sort((a,b) => b.qtd - a.qtd);
  }, [vendas, dataInicio, dataFim]);

  const pagamentosPeriodo = useMemo(() => {
    const mapa: Record<string, { bruto: number; taxas: number }> = {};
    vendas.forEach(v => {
      const d = v.data_venda.substring(0, 10);
      if ((!dataInicio || d >= dataInicio) && (!dataFim || d <= dataFim)) {
        if (v.pagamentos_detalhados) {
          v.pagamentos_detalhados.forEach(p => {
            if (!mapa[p.metodo]) mapa[p.metodo] = { bruto: 0, taxas: 0 };
            mapa[p.metodo].bruto += p.valor;
            mapa[p.metodo].taxas += (p.taxa_cobrada || 0);
          });
        }
      }
    });
    return Object.entries(mapa).map(([metodo, d]) => ({ metodo, ...d })).sort((a,b) => b.bruto - a.bruto);
  }, [vendas, dataInicio, dataFim]);

  const comprasEVendasPorCategoria = useMemo(() => {
    const mapa: Record<string, { faturamento: number; cpv_vendido: number; lucro: number; quantidade_comprada: number; valor_comprado: number }> = {};

    vendas.forEach(v => {
      const d = v.data_venda.substring(0, 10);
      if ((!dataInicio || d >= dataInicio) && (!dataFim || d <= dataFim)) {
        v.itens.forEach(i => {
          const cat = i.categoria || 'Sem Grupo';
          if (!mapa[cat]) mapa[cat] = { faturamento: 0, cpv_vendido: 0, lucro: 0, quantidade_comprada: 0, valor_comprado: 0 };
          mapa[cat].faturamento += i.subtotal;
          mapa[cat].cpv_vendido += (i.custo_unitario * i.quantidade); 
          mapa[cat].lucro += (i.subtotal - (i.custo_unitario * i.quantidade));
        });
      }
    });

    notasFiscais.forEach(n => {
      const d = n.data_emissao.substring(0, 10);
      if ((!dataInicio || d >= dataInicio) && (!dataFim || d <= dataFim)) {
        n.itens.forEach(i => {
          const cat = i.categoria || 'Sem Grupo';
          if (!mapa[cat]) mapa[cat] = { faturamento: 0, cpv_vendido: 0, lucro: 0, quantidade_comprada: 0, valor_comprado: 0 };
          mapa[cat].quantidade_comprada += i.quantidade;
          mapa[cat].valor_comprado += i.subtotal;
        });
      }
    });

    return Object.entries(mapa).map(([grupo, d]) => ({ grupo, ...d })).sort((a,b) => b.faturamento - a.faturamento);
  }, [vendas, notasFiscais, dataInicio, dataFim]);

  if (carregando) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0b' }}><Loader2 size={40} className="spin" color="#facc15" /></div>;

  return (
    <>
      <style>{`
        /* TEMA PRETO E OURO */
        html, body, #root { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background-color: #0a0a0b; color: #e4e4e7; font-family: system-ui, sans-serif; }
        .fin-layout { display: flex; flex-direction: column; height: 100%; width: 100%; }
        .fin-header { flex: 0 0 64px; background-color: #18181b; padding: 0 2vw; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #facc15; }
        .btn-voltar { background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: bold; transition: 0.3s;}
        .btn-voltar:hover { background: #3f3f46; color: white; }
        .titulo-loja { font-size: clamp(1rem, 1.2vw, 1.8rem); font-weight: 900; text-transform: uppercase; margin: 0; color: #facc15; letter-spacing: 1px; }
        .content-area { flex: 1; display: flex; overflow: hidden; padding: 1.5vw; gap: 1.5vw; }
        
        .side-menu { width: 280px; background: #121214; border-radius: 12px; border: 1px solid #27272a; display: flex; flex-direction: column; padding: 10px; gap: 5px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        .menu-item { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 8px; cursor: pointer; font-weight: bold; color: #a1a1aa; transition: 0.2s; border: none; background: transparent; text-align: left; font-size: 0.9rem;}
        .menu-item:hover { background: #1c1f24; color: #e4e4e7; }
        .menu-item.ativo { background: rgba(250, 204, 21, 0.1); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.2); }
        
        .painel-relatorio { flex: 1; background: #121214; border-radius: 12px; border: 1px solid #27272a; padding: 1.5vw; overflow-y: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        .painel-titulo { font-size: 1.3rem; font-weight: 900; border-bottom: 1px solid #27272a; padding-bottom: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; color: #f8fafc; }
        .filtro-bar { display: flex; gap: 10px; margin-bottom: 20px; background: #18181b; padding: 12px; border-radius: 8px; border: 1px solid #27272a; align-items: center; flex-wrap: wrap; }
        .input-filtro { padding: 8px 12px; border-radius: 6px; border: 1px solid #3f3f46; font-weight: bold; outline: none; background: #0a0a0b; color: #facc15; color-scheme: dark; }
        .input-filtro:focus { border-color: #facc15; box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1); }
        
        .tabela-fin { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
        .tabela-fin th { padding: 12px; border-bottom: 2px solid #27272a; background: #18181b; color: #facc15; font-size: 0.75rem; text-transform: uppercase; position: sticky; top: 0; letter-spacing: 1px;}
        .tabela-fin td { padding: 12px; border-bottom: 1px dashed #27272a; }
        .tabela-fin tr:hover { background: #1c1f24; }
        
        .venda-card { border: 1px solid #27272a; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
        .venda-header { padding: 12px 15px; background: #18181b; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border-left: 3px solid transparent; transition: 0.2s;}
        .venda-header:hover { background: #1c1f24; border-left-color: #facc15; }
        .venda-detalhes { padding: 15px; background: #0a0a0b; border-top: 1px solid #27272a; }
        
        .badge { background: #27272a; color: #e4e4e7; padding: 3px 8px; border-radius: 5px; font-size: 0.75rem; font-weight: bold; border: 1px solid #3f3f46;}
        .kpi-row { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .kpi-box { flex: 1; min-width: 150px; padding: 15px; border-radius: 8px; background: #0a0a0b; border: 1px dashed #3f3f46; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* SCROLLBAR DARK */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #121214; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>

      <div className="fin-layout">
        <header className="fin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
            <button onClick={() => navigate('/')} className="btn-voltar"><ArrowLeft size={18} /> VOLTAR</button>
            <h1 className="titulo-loja">INTELIGÊNCIA FINANCEIRA</h1>
          </div>
        </header>

        <main className="content-area">
          <aside className="side-menu">
            <button className={`menu-item ${abaAtiva === 'dia' ? 'ativo' : ''}`} onClick={() => setAbaAtiva('dia')}><CalendarDays size={18} /> Resumo por Dia</button>
            <button className={`menu-item ${abaAtiva === 'periodo' ? 'ativo' : ''}`} onClick={() => setAbaAtiva('periodo')}><CalendarRange size={18} /> Vendas por Período</button>
            <button className={`menu-item ${abaAtiva === 'produto' ? 'ativo' : ''}`} onClick={() => setAbaAtiva('produto')}><PackageSearch size={18} /> Venda por Produto</button>
            <button className={`menu-item ${abaAtiva === 'top_produtos' ? 'ativo' : ''}`} onClick={() => setAbaAtiva('top_produtos')}><TrendingUp size={18} /> Produtos Mais Vendidos</button>
            <button className={`menu-item ${abaAtiva === 'grupos' ? 'ativo' : ''}`} onClick={() => setAbaAtiva('grupos')}><Layers size={18} /> Compras e Vendas</button>
            <button className={`menu-item ${abaAtiva === 'pagamentos' ? 'ativo' : ''}`} onClick={() => setAbaAtiva('pagamentos')}><CreditCard size={18} /> Formas de Pagamento</button>
            <button className={`menu-item ${abaAtiva === 'completo' ? 'ativo' : ''}`} onClick={() => setAbaAtiva('completo')}><ListTodo size={18} /> Relatório Completo</button>
          </aside>

          <section className="painel-relatorio">
            
            {abaAtiva === 'dia' && (
              <>
                <h2 className="painel-titulo"><CalendarDays size={24} color="#facc15" /> Detalhes das Vendas do Dia</h2>
                <div className="filtro-bar">
                  <span style={{fontWeight:'bold', fontSize:'0.8rem', color:'#a1a1aa'}}>SELECIONE O DIA:</span>
                  <input type="date" className="input-filtro" value={dataUnica} onChange={e => setDataUnica(e.target.value)} />
                  <div style={{marginLeft:'auto', textAlign:'right'}}>
                    <span style={{fontSize:'0.8rem', color:'#a1a1aa', fontWeight:'bold', display:'block'}}>VENDA TOTAL NO DIA</span>
                    <span style={{fontSize:'1.5rem', fontWeight:900, color:'#10b981'}}>R$ {detalhesDoDia.totalDia.toFixed(2)}</span>
                  </div>
                </div>

                {detalhesDoDia.vendas.length === 0 && <div style={{textAlign:'center', padding:'50px', color:'#52525b'}}>Nenhuma venda realizada neste dia.</div>}
                
                {detalhesDoDia.vendas.sort((a,b) => b.data_venda.localeCompare(a.data_venda)).map(v => (
                  <div key={v.id} className="venda-card">
                    <div className="venda-header" onClick={() => setVendaAberta(vendaAberta === v.id ? null : v.id)}>
                      <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                        <span style={{fontWeight:'900', color:'#facc15'}}>#{v.id.substring(0,5).toUpperCase()}</span>
                        <span style={{fontSize:'0.85rem', color:'#a1a1aa'}}>{new Date(v.data_venda).toLocaleTimeString('pt-BR')}</span>
                        <span className="badge">{v.forma_pagamento}</span>
                      </div>
                      <div style={{display:'flex', gap:'20px', alignItems:'center'}}>
                        <span style={{fontWeight:900, fontSize:'1.1rem'}}>R$ {v.total_venda.toFixed(2)}</span>
                        {vendaAberta === v.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                      </div>
                    </div>
                    {vendaAberta === v.id && (
                      <div className="venda-detalhes">
                        <table className="tabela-fin" style={{marginBottom:'15px'}}>
                          <thead><tr><th>Produto</th><th style={{textAlign:'center'}}>Qtd</th><th style={{textAlign:'right'}}>Preço Un.</th><th style={{textAlign:'right'}}>Subtotal</th></tr></thead>
                          <tbody>
                            {v.itens.map((it, idx) => (
                              <tr key={idx}>
                                <td style={{fontWeight:'bold'}}>{it.nome}</td>
                                <td style={{textAlign:'center'}}>{it.quantidade}</td>
                                <td style={{textAlign:'right'}}>R$ {it.preco_unitario.toFixed(2)}</td>
                                <td style={{textAlign:'right', fontWeight:'bold', color: '#facc15'}}>R$ {it.subtotal.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{display:'flex', justifyContent:'flex-end', gap:'20px', fontSize:'0.8rem', color:'#a1a1aa', borderTop:'1px dashed #27272a', paddingTop:'10px'}}>
                          <span>Custo Mercadoria: R$ {v.custo_total.toFixed(2)}</span>
                          <span style={{color:'#ef4444'}}>Taxas: - R$ {(v.taxas_maquininha || 0).toFixed(2)}</span>
                          <span style={{color:'#10b981', fontWeight:'bold'}}>Lucro: R$ {v.lucro_total.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {abaAtiva === 'periodo' && (
              <>
                <h2 className="painel-titulo"><CalendarRange size={24} color="#facc15" /> Resumo de Vendas por Período</h2>
                <div className="filtro-bar">
                  <span style={{fontWeight:'bold', color:'#a1a1aa'}}>DE:</span>
                  <input type="date" className="input-filtro" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                  <span style={{fontWeight:'bold', color:'#a1a1aa'}}>ATÉ:</span>
                  <input type="date" className="input-filtro" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
                <table className="tabela-fin">
                  <thead><tr><th>Data</th><th style={{textAlign:'center'}}>Qtd. Cupons</th><th style={{textAlign:'right'}}>Faturamento Bruto</th><th style={{textAlign:'right', color:'#10b981'}}>Lucro Líquido</th></tr></thead>
                  <tbody>
                    {resumoAgrupadoPeriodo.map(r => (
                      <tr key={r.data}>
                        <td style={{fontWeight:'bold'}}>{new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td style={{textAlign:'center'}}><span className="badge">{r.qtd} vendas</span></td>
                        <td style={{textAlign:'right', fontWeight:900, color: '#facc15'}}>R$ {r.faturamento.toFixed(2)}</td>
                        <td style={{textAlign:'right', fontWeight:900, color:'#10b981'}}>R$ {r.lucro.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {abaAtiva === 'produto' && (
              <>
                <h2 className="painel-titulo"><PackageSearch size={24} color="#facc15" /> Venda por Produto (EAN ou Nome)</h2>
                <div className="filtro-bar">
                  <div style={{display:'flex', alignItems:'center', background:'#0a0a0b', border:'1px solid #3f3f46', borderRadius:'8px', padding:'0 15px', flex:1}}>
                    <Search size={18} color="#facc15"/>
                    <input type="text" className="input-filtro" style={{border:'none', width:'100%'}} placeholder="Bipe o EAN ou digite o nome..." value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} />
                  </div>
                  <input type="date" className="input-filtro" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                  <input type="date" className="input-filtro" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>

                {rastreioProduto ? (
                  <>
                    <div className="kpi-row">
                      <div className="kpi-box"><div style={{fontSize:'0.7rem', fontWeight:'bold', color:'#a1a1aa'}}>TOTAL VENDIDO</div><div style={{fontSize:'1.5rem', fontWeight:900}}>{rastreioProduto.totalQtd} un</div></div>
                      <div className="kpi-box"><div style={{fontSize:'0.7rem', fontWeight:'bold', color:'#a1a1aa'}}>FATURAMENTO BRUTO</div><div style={{fontSize:'1.5rem', fontWeight:900, color: '#facc15'}}>R$ {rastreioProduto.faturamento.toFixed(2)}</div></div>
                      <div className="kpi-box"><div style={{fontSize:'0.7rem', fontWeight:'bold', color:'#a1a1aa'}}>LUCRO BRUTO</div><div style={{fontSize:'1.5rem', fontWeight:900, color:'#e4e4e7'}}>R$ {rastreioProduto.lucroBruto.toFixed(2)}</div></div>
                      <div className="kpi-box" style={{background:'rgba(16, 185, 129, 0.1)', borderColor:'#10b981'}}><div style={{fontSize:'0.7rem', fontWeight:'bold', color:'#10b981'}}>LUCRO LÍQUIDO (PÓS-TAXAS)</div><div style={{fontSize:'1.5rem', fontWeight:900, color:'#10b981'}}>R$ {rastreioProduto.lucroLiquido.toFixed(2)}</div></div>
                    </div>
                    <table className="tabela-fin">
                      <thead><tr><th>Data/Hora da Venda</th><th style={{textAlign:'center'}}>Qtd Comprada</th><th style={{textAlign:'right'}}>Valor Total</th></tr></thead>
                      <tbody>
                        {rastreioProduto.historico.map((h, i) => (
                          <tr key={i}><td>{new Date(h.data).toLocaleString('pt-BR')}</td><td style={{textAlign:'center'}}>{h.qtd}</td><td style={{textAlign:'right', fontWeight:900, color: '#facc15'}}>R$ {h.total.toFixed(2)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : <div style={{textAlign:'center', padding:'50px', color:'#52525b'}}>Bipe um código de barras ou digite o nome do produto.</div>}
              </>
            )}

            {abaAtiva === 'top_produtos' && (
              <>
                <h2 className="painel-titulo"><TrendingUp size={24} color="#facc15" /> Ranking de Produtos Mais Vendidos</h2>
                <div className="filtro-bar">
                   <span style={{fontWeight:'bold', color:'#a1a1aa'}}>PERÍODO:</span>
                   <input type="date" className="input-filtro" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                   <input type="date" className="input-filtro" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
                <table className="tabela-fin">
                  <thead><tr><th>Posição</th><th>Produto</th><th style={{textAlign:'center'}}>Qtd Total</th><th style={{textAlign:'right'}}>Faturamento</th><th style={{textAlign:'right', color:'#10b981'}}>Lucro</th></tr></thead>
                  <tbody>
                    {rankingGeral.map((p, i) => (
                      <tr key={i}>
                        <td style={{fontWeight:900, color:'#facc15'}}>{i+1}º</td>
                        <td style={{fontWeight:'bold'}}>{p.nome}</td>
                        <td style={{textAlign:'center', fontWeight:900}}>{p.qtd} un</td>
                        <td style={{textAlign:'right'}}>R$ {p.faturamento.toFixed(2)}</td>
                        <td style={{textAlign:'right', fontWeight:900, color:'#10b981'}}>R$ {p.lucro.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {abaAtiva === 'grupos' && (
              <>
                <h2 className="painel-titulo"><Layers size={24} color="#facc15" /> Compras e Vendas (Por Categoria)</h2>
                <div className="filtro-bar">
                   <input type="date" className="input-filtro" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                   <input type="date" className="input-filtro" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
                <table className="tabela-fin">
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th style={{textAlign:'center', color:'#d4af37'}}>Unidades Compradas</th>
                      <th style={{textAlign:'right', color:'#d4af37'}}>Total Gasto (Notas)</th>
                      <th style={{textAlign:'right', color:'#ef4444'}}>Custo Vendido (CPV)</th>
                      <th style={{textAlign:'right', color:'#facc15'}}>Faturamento (Vendas)</th>
                      <th style={{textAlign:'right', color:'#10b981'}}>Lucro Bruto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprasEVendasPorCategoria.map((g, i) => (
                      <tr key={i}>
                        <td style={{fontWeight:'bold', fontSize:'1.05rem'}}>{g.grupo}</td>
                        <td style={{textAlign:'center', color:'#d4af37', fontWeight:'bold'}}>{g.quantidade_comprada} un</td>
                        <td style={{textAlign:'right', color:'#d4af37', fontWeight:'bold'}}>R$ {g.valor_comprado.toFixed(2)}</td>
                        <td style={{textAlign:'right', color:'#ef4444'}}>- R$ {g.cpv_vendido.toFixed(2)}</td>
                        <td style={{textAlign:'right', fontWeight:900, color:'#facc15'}}>R$ {g.faturamento.toFixed(2)}</td>
                        <td style={{textAlign:'right', fontWeight:900, color:'#10b981'}}>R$ {g.lucro.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {abaAtiva === 'pagamentos' && (
              <>
                <h2 className="painel-titulo"><CreditCard size={24} color="#facc15" /> Desempenho de Recebimentos</h2>
                <div className="filtro-bar">
                   <input type="date" className="input-filtro" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                   <input type="date" className="input-filtro" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
                <table className="tabela-fin">
                  <thead><tr><th>Meio de Pagamento</th><th style={{textAlign:'right'}}>Bruto Recebido</th><th style={{textAlign:'right', color:'#ef4444'}}>Taxas Operadoras</th><th style={{textAlign:'right', color:'#10b981'}}>Líquido Real</th></tr></thead>
                  <tbody>
                    {pagamentosPeriodo.map((p, i) => (
                      <tr key={i}>
                        <td style={{fontWeight:'bold'}}>{p.metodo}</td>
                        <td style={{textAlign:'right', fontWeight:900, color: '#facc15'}}>R$ {p.bruto.toFixed(2)}</td>
                        <td style={{textAlign:'right', color:'#ef4444'}}>- R$ {p.taxas.toFixed(2)}</td>
                        <td style={{textAlign:'right', fontWeight:900, color:'#10b981'}}>R$ {(p.bruto - p.taxas).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {abaAtiva === 'completo' && (
              <>
                <h2 className="painel-titulo"><ListTodo size={24} color="#facc15" /> Extrato Geral de Transações</h2>
                <div className="filtro-bar">
                   <input type="date" className="input-filtro" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                   <input type="date" className="input-filtro" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
                <table className="tabela-fin">
                  <thead><tr><th>Data/Hora</th><th>Pagamento</th><th style={{textAlign:'center'}}>Itens</th><th style={{textAlign:'right'}}>Total Bruto</th><th style={{textAlign:'right', color:'#10b981'}}>Lucro Líquido</th></tr></thead>
                  <tbody>
                    {vendas
                      .filter(v => {
                        const d = v.data_venda.substring(0, 10);
                        return (!dataInicio || d >= dataInicio) && (!dataFim || d <= dataFim);
                      })
                      .sort((a,b) => b.data_venda.localeCompare(a.data_venda))
                      .map(v => (
                        <tr key={v.id}>
                          <td style={{color:'#a1a1aa'}}>{new Date(v.data_venda).toLocaleString('pt-BR')}</td>
                          <td>
                            {v.pagamentos_detalhados 
                                ? v.pagamentos_detalhados.map((p, i) => <span key={i} className="badge" style={{marginRight:'4px'}}>{p.metodo}</span>) 
                                : <span className="badge">{v.forma_pagamento}</span>
                            }
                          </td>
                          <td style={{textAlign:'center'}}>{v.itens.length}</td>
                          <td style={{textAlign:'right', fontWeight:900, color: '#facc15'}}>R$ {v.total_venda.toFixed(2)}</td>
                          <td style={{textAlign:'right', fontWeight:900, color:'#10b981'}}>R$ {v.lucro_total.toFixed(2)}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

          </section>
        </main>
      </div>
    </>
  );
}