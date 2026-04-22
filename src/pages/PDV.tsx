import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Banknote, CreditCard, QrCode, Trash2, ArrowLeft, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Produto { id: string; nome: string; preco_venda: number; custo: number; categoria: string; codigo_barras: string; imagem_url?: string; }
interface ItemCarrinho extends Produto { quantidade: number; subtotal: number; sequencia: number; }
interface Pagamento { metodo: string; valor: number; taxa_cobrada?: number; valor_liquido?: number; }
interface Taxas { debito: number; credito_avista: number; credito_parcelado: number; pix: number; }

export default function PDV() {
  const navigate = useNavigate();
  
  const [taxasConfig, setTaxasConfig] = useState<Taxas>({ debito: 0, credito_avista: 0, credito_parcelado: 0, pix: 0 });

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [quantidadeNova, setQuantidadeNova] = useState(1);
  const [busca, setBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const [modalPagamento, setModalPagamento] = useState(false);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [valorInputPgto, setValorInputPgto] = useState('');

  const totalCarrinho = useMemo(() => carrinho.reduce((acc, item) => acc + item.subtotal, 0), [carrinho]);
  const ultimoItem = carrinho.length > 0 ? carrinho[carrinho.length - 1] : null;
  const totalPago = useMemo(() => pagamentos.reduce((acc, p) => acc + p.valor, 0), [pagamentos]);
  const faltante = Math.max(0, totalCarrinho - totalPago);
  const troco = Math.max(0, totalPago - totalCarrinho);

  // Busca as Taxas sem travar o caixa
  useEffect(() => {
    const inicializarPDV = async () => {
      try {
        const docConfig = await getDoc(doc(db, "configuracoes", "geral"));
        if (docConfig.exists() && docConfig.data().taxas) setTaxasConfig(docConfig.data().taxas);
      } catch (error) { console.error("Erro ao carregar taxas."); }
    };
    inicializarPDV();
  }, []);

  useEffect(() => { 
    if (!modalPagamento) document.getElementById('input-codigo')?.focus(); 
    else document.getElementById('input-valor-pgto')?.focus();
  }, [carrinho, modalPagamento]);

  useEffect(() => {
    if (modalPagamento && faltante > 0) setValorInputPgto(faltante.toFixed(2));
    else if (faltante <= 0) setValorInputPgto('');
  }, [modalPagamento, faltante]);

  const handleBuscarProduto = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const termoBusca = busca.trim();
      if (!termoBusca) return;
      setBuscando(true);
      try {
        const produtosRef = collection(db, "produtos");
        const q = query(produtosRef, where("codigo_barras", "==", termoBusca));
        const snap = await getDocs(q);
        if (!snap.empty) adicionarAoCarrinho({ id: snap.docs[0].id, ...snap.docs[0].data() } as Produto);
        else {
          const qNome = query(produtosRef, where("nome", "==", termoBusca.toUpperCase()));
          const snapNome = await getDocs(qNome);
          if (!snapNome.empty) adicionarAoCarrinho({ id: snapNome.docs[0].id, ...snapNome.docs[0].data() } as Produto);
          else alert('Produto não encontrado!'); setBusca('');
        }
      } catch (error) { alert("Erro ao consultar banco de dados."); } 
      finally { setBuscando(false); }
    }
  };

  const adicionarAoCarrinho = (produto: Produto) => {
    setCarrinho(prev => [...prev, { ...produto, quantidade: quantidadeNova, subtotal: quantidadeNova * produto.preco_venda, sequencia: prev.length + 1 }]);
    setBusca(''); setQuantidadeNova(1);
  };

  const adicionarPagamento = (metodo: string) => {
    const valorFloat = parseFloat(valorInputPgto.replace(',', '.'));
    if (isNaN(valorFloat) || valorFloat <= 0) return alert('Digite um valor numérico válido.');
    setPagamentos(prev => [...prev, { metodo, valor: valorFloat }]);
  };

  const confirmarEFinalizarVenda = async () => {
    if (faltante > 0) return alert('Ainda falta receber um valor para fechar a conta.');
    
    setFinalizando(true);
    try {
      let custoTotalDaVenda = 0;
      const itensFormatados = carrinho.map(item => {
        const custoUnitario = item.custo || 0;
        custoTotalDaVenda += (custoUnitario * item.quantidade);
        return { produto_id: item.id, nome: item.nome, categoria: item.categoria || 'Outros', quantidade: item.quantidade, preco_unitario: item.preco_venda, custo_unitario: custoUnitario, subtotal: item.subtotal, codigo_barras: item.codigo_barras || '' };
      });

      let totalTaxasCobrada = 0;
      let trocoAbater = troco;

      const pagamentosProcessados = pagamentos.map(pgto => {
        let valorBase = pgto.valor;
        let taxaValor = 0;

        if (pgto.metodo === 'Dinheiro') {
           if (trocoAbater > 0) { valorBase -= trocoAbater; trocoAbater = 0; }
        } else if (pgto.metodo === 'Cartão de Débito') {
          taxaValor = valorBase * (taxasConfig.debito / 100);
        } else if (pgto.metodo === 'Cartão de Crédito') {
          taxaValor = valorBase * (taxasConfig.credito_avista / 100);
        } else if (pgto.metodo === 'PIX') {
          taxaValor = valorBase * (taxasConfig.pix / 100);
        }

        totalTaxasCobrada += taxaValor;
        return { ...pgto, valor: valorBase, taxa_cobrada: taxaValor, valor_liquido: valorBase - taxaValor };
      });

      const metodosUsados = pagamentosProcessados.map(p => p.metodo).filter((v, i, a) => a.indexOf(v) === i).join(' + ');
      const lucroReal = totalCarrinho - custoTotalDaVenda - totalTaxasCobrada;

      const novaVenda = {
        data_venda: new Date().toISOString(),
        forma_pagamento: metodosUsados,
        pagamentos_detalhados: pagamentosProcessados, 
        total_venda: totalCarrinho, 
        valor_recebido: totalPago, 
        troco: troco,
        custo_total: custoTotalDaVenda,
        taxas_maquininha: totalTaxasCobrada,
        lucro_total: lucroReal,
        itens: itensFormatados
      };

      await addDoc(collection(db, "vendas"), novaVenda);
      for (const item of carrinho) { await updateDoc(doc(db, "produtos", item.id), { estoque_atual: increment(-item.quantidade) }); }

      alert(`VENDA FINALIZADA COM SUCESSO!\nTroco a devolver: R$ ${troco.toFixed(2)}`);
      setCarrinho([]); setModalPagamento(false); setPagamentos([]);
    } catch (error) { alert("Erro ao gravar venda."); } 
    finally { setFinalizando(false); }
  };

  return (
    <>
      <style>{`
        /* TEMA PRETO E OURO */
        html, body, #root { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background-color: #0a0a0b; color: #e4e4e7; font-family: system-ui, sans-serif; }
        .pdv-wrapper { display: flex; flex-direction: column; height: 100%; width: 100%; }
        
        /* HEADER ESCURO COM LINHA DOURADA */
        .pdv-header { flex: 0 0 60px; display: flex; justify-content: space-between; align-items: center; padding: 0 2vw; background-color: #18181b; border-bottom: 3px solid #facc15; }
        .btn-voltar { background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: bold; transition: 0.3s;}
        .btn-voltar:hover { background: #3f3f46; color: white; }
        .titulo-loja { font-size: clamp(1rem, 1.2vw, 1.8rem); font-weight: 900; text-transform: uppercase; margin: 0; color: #facc15; letter-spacing: 1px; }
        .badge-status { background: rgba(250, 204, 21, 0.1); color: #facc15; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: clamp(10px, 0.9vw, 12px); border: 1px solid rgba(250, 204, 21, 0.3); }

        .pdv-grid { flex: 1; display: grid; grid-template-columns: minmax(0, 3.5fr) minmax(0, 4.5fr) minmax(0, 2fr); gap: 1.5vw; padding: 1.5vw; overflow: hidden; }
        .coluna { display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; }
        
        /* CUPOM ESCURO PREMIUM */
        .col-cupom { background-color: #121214; border: 1px solid #27272a; color: #e4e4e7; }
        .cupom-header { padding: 1.5vh 1vw; text-align: center; border-bottom: 2px dashed #27272a; background-color: #18181b; color: #facc15; }
        .cupom-scroll { flex: 1; overflow-y: auto; padding: 1vw; font-family: monospace; font-size: clamp(12px, 1.2vw, 16px); }
        .cupom-table { width: 100%; border-collapse: collapse; }
        .cupom-table th { text-align: left; padding-bottom: 1vh; border-bottom: 1px dashed #3f3f46; color: #a1a1aa; }
        .cupom-table td { padding: 1vh 0; border-bottom: 1px dashed #27272a; }
        
        .col-display { gap: 1.5vh; background-color: transparent; }
        
        /* PAINEL LCD DOURADO */
        .lcd-panel { background: #000; border: 2px solid #27272a; padding: 3vh 2vw; border-radius: 12px; text-align: right; flex: 0 0 auto; box-shadow: inset 0 0 20px rgba(0,0,0,0.8); }
        .lcd-valor { font-size: clamp(2.5rem, 6vw, 6rem); font-weight: 900; color: #facc15; font-family: monospace; line-height: 1; text-shadow: 0 0 15px rgba(250, 204, 21, 0.3); }
        
        .ultimo-item-panel { flex: 1; background: #0a0a0b; border-radius: 12px; border: 2px solid #27272a; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
        .item-foto { width: 100%; height: 100%; object-fit: contain; }
        
        .inputs-area { display: flex; gap: 1vw; flex: 0 0 auto; }
        .input-box { background: #18181b; border: 2px solid #27272a; padding: 2vh 1vw; font-size: clamp(1rem, 1.5vw, 1.8rem); font-weight: bold; border-radius: 8px; width: 100%; text-transform: uppercase; color: #facc15; outline: none; transition: 0.2s; }
        .input-box:focus { background: #1f1f22; border-color: #facc15; box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1); }
        .input-box::placeholder { color: #52525b; }

        .col-botoes { background-color: #121214; border: 1px solid #27272a; padding: 1.5vw; gap: 1.5vh; justify-content: flex-end; }
        .btn { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #27272a; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: clamp(12px, 1.1vw, 16px); cursor: pointer; transition: 0.2s; padding: 2vh; border: 1px solid transparent; }
        .btn-red { background: #18181b; color: #ef4444; border-color: #3f3f46; }
        .btn-red:hover { background: #ef4444; color: white; border-color: #ef4444; }
        
        /* BOTÃO PRINCIPAL DOURADO */
        .btn-finalizar { background: #facc15; color: #0a0a0b; flex-direction: row; gap: 1vw; font-size: clamp(14px, 1.3vw, 20px); text-transform: uppercase; min-height: 100px; box-shadow: 0 4px 15px rgba(250, 204, 21, 0.3); }
        .btn-finalizar:hover { background: #eab308; transform: translateY(-2px); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* MODAL DE PAGAMENTO DARK & GOLD */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(5px); }
        .modal-content { background: #18181b; width: 90vw; max-width: 900px; border-radius: 12px; border: 1px solid #3f3f46; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
        .modal-header { padding: 20px; background: #0a0a0b; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #27272a; }
        .modal-body { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; }
        
        .box-valor { background: #0a0a0b; padding: 20px; border-radius: 8px; text-align: right; border: 1px solid #27272a; margin-bottom: 10px;}
        .box-valor.destaque { border-color: #facc15; background: rgba(250, 204, 21, 0.05); }
        .box-valor.troco { border-color: #10b981; background: rgba(16, 185, 129, 0.05); }
        .lbl-valor { font-size: 0.8rem; color: #a1a1aa; font-weight: bold; text-transform: uppercase; }
        .txt-valor { font-size: 2.5rem; font-weight: 900; font-family: monospace; color: #e4e4e7; }
        .box-valor.destaque .txt-valor { color: #facc15; }
        
        .input-pgto { background: #0a0a0b; border: 2px solid #3f3f46; padding: 15px; font-size: 2rem; font-weight: 900; border-radius: 8px; color: #facc15; text-align: center; width: 100%; margin-bottom: 15px; outline: none; transition: 0.2s;}
        .input-pgto:focus { border-color: #facc15; }
        
        .grid-metodos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;}
        .btn-metodo { background: #27272a; color: #e4e4e7; border: 1px solid #3f3f46; padding: 15px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s;}
        .btn-metodo:hover { background: #3f3f46; border-color: #facc15; color: #facc15; }
        
        .lista-pgtos { background: #0a0a0b; border-radius: 8px; padding: 10px; min-height: 120px; border: 1px solid #27272a;}
        .item-pgto { display: flex; justify-content: space-between; align-items: center; padding: 12px 10px; border-bottom: 1px dashed #27272a; }
        
        .modal-footer { padding: 20px; background: #0a0a0b; display: flex; justify-content: flex-end; border-top: 1px solid #27272a; }
        .btn-confirmar { background: #facc15; color: #0a0a0b; border: none; padding: 15px 30px; border-radius: 8px; font-weight: 900; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.2s; }
        .btn-confirmar:hover:not(:disabled) { background: #eab308; }
        .btn-confirmar:disabled { background: #27272a; color: #52525b; cursor: not-allowed; }
      `}</style>

      <div className="pdv-wrapper">
        <header className="pdv-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
            <button onClick={() => navigate('/')} className="btn-voltar"><ArrowLeft size={18} /> VOLTAR</button>
            <h1 className="titulo-loja">Império Variedades</h1>
          </div>
          <span className="badge-status">CAIXA LIVRE</span>
        </header>

        <main className="pdv-grid">
          <div className="coluna col-cupom">
            <div className="cupom-header"><h2 style={{ fontSize: '1rem', fontWeight: 900, margin: 0, letterSpacing: '1px' }}>CUPOM NÃO FISCAL</h2></div>
            <div className="cupom-scroll">
              <table className="cupom-table">
                <thead><tr><th style={{ width: '15%' }}>ITEM</th><th>DESCRIÇÃO</th><th style={{ textAlign: 'right' }}>QTDxUN</th><th style={{ textAlign: 'right' }}>TOTAL</th></tr></thead>
                <tbody>{carrinho.map(item => (<tr key={item.sequencia}><td>{item.sequencia.toString().padStart(3, '0')}</td><td style={{ fontWeight: 'bold', color: '#f8fafc' }}>{item.nome}</td><td style={{ textAlign: 'right', color: '#a1a1aa' }}>{item.quantidade}x{item.preco_venda.toFixed(2)}</td><td style={{ textAlign: 'right', fontWeight: 'bold', color: '#facc15' }}>{item.subtotal.toFixed(2)}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
          <div className="coluna col-display">
            <div className="lcd-panel"><div style={{ color: '#a1a1aa', fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: '2px', marginBottom: '5px' }}>TOTAL A PAGAR</div><div className="lcd-valor">R$ {totalCarrinho.toFixed(2)}</div></div>
            <div className="ultimo-item-panel">{ultimoItem?.imagem_url ? (<img src={ultimoItem.imagem_url} alt="Produto" className="item-foto" />) : (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#3f3f46' }}><ImageIcon size={64} /><span style={{ marginTop: '1vh', fontWeight: 'bold', letterSpacing: '2px' }}>FOTO DO PRODUTO</span></div>)}</div>
            <div className="inputs-area">
              <div style={{ flex: '0 0 20%' }}><input type="number" min="1" value={quantidadeNova} onChange={(e) => setQuantidadeNova(Number(e.target.value) || 1)} className="input-box" style={{ textAlign: 'center' }} disabled={buscando} /></div>
              <div style={{ flex: 1 }}><input id="input-codigo" type="text" value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={handleBuscarProduto} placeholder={buscando ? "CONSULTANDO..." : "ESCANEIE O CÓDIGO..."} className="input-box" disabled={buscando} /></div>
            </div>
          </div>
          <div className="coluna col-botoes">
            <button className="btn btn-red" onClick={() => setCarrinho(prev => prev.slice(0, -1))}><Trash2 size={24} style={{marginBottom:'8px'}}/> CANCELAR ITEM</button>
            <button className="btn btn-finalizar" onClick={() => { if(carrinho.length === 0) alert('Carrinho Vazio.'); else { setPagamentos([]); setModalPagamento(true); } }}><ShoppingCart size={32} /> RECEBER</button>
          </div>
        </main>
      </div>

      {modalPagamento && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.5rem', color: '#facc15', display: 'flex', alignItems: 'center', gap: '10px' }}><Banknote size={24} /> PAGAMENTO</h2>
              <button onClick={() => setModalPagamento(false)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}><X size={28} /></button>
            </div>
            <div className="modal-body">
              <div>
                <div className="box-valor"><div className="lbl-valor">Total da Compra</div><div className="txt-valor">R$ {totalCarrinho.toFixed(2)}</div></div>
                <div className={`box-valor ${faltante > 0 ? 'destaque' : ''}`}><div className="lbl-valor">Falta Receber</div><div className="txt-valor">R$ {faltante.toFixed(2)}</div></div>
                <div className={`box-valor ${troco > 0 ? 'troco' : ''}`}><div className="lbl-valor">Troco a Devolver</div><div className="txt-valor" style={{ color: troco > 0 ? '#10b981' : '#e4e4e7' }}>R$ {troco.toFixed(2)}</div></div>
              </div>
              <div>
                <input id="input-valor-pgto" type="text" value={valorInputPgto} onChange={(e) => setValorInputPgto(e.target.value)} placeholder="0.00" className="input-pgto" />
                <div className="grid-metodos">
                  <button className="btn-metodo" onClick={() => adicionarPagamento('Dinheiro')}><Banknote size={20} /> Dinheiro</button>
                  <button className="btn-metodo" onClick={() => adicionarPagamento('Cartão de Crédito')}><CreditCard size={20} /> Crédito</button>
                  <button className="btn-metodo" onClick={() => adicionarPagamento('Cartão de Débito')}><CreditCard size={20} /> Débito</button>
                  <button className="btn-metodo" onClick={() => adicionarPagamento('PIX')}><QrCode size={20} /> PIX</button>
                </div>
                <div className="lista-pgtos">
                  {pagamentos.map((p, idx) => (
                    <div key={idx} className="item-pgto">
                      <span style={{ fontWeight: 'bold', color: '#a1a1aa' }}>{p.metodo}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}><span style={{ fontWeight: 900, color: '#facc15', fontSize: '1.2rem' }}>R$ {p.valor.toFixed(2)}</span><button onClick={() => setPagamentos(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-confirmar" onClick={confirmarEFinalizarVenda} disabled={faltante > 0 || finalizando}>{finalizando ? <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /> : <ShoppingCart size={24} />} FINALIZAR VENDA</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}