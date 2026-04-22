// src/services/produtos.ts
import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";

const produtosRef = collection(db, "produtos");

export const buscarProdutos = async () => {
  const snapshot = await getDocs(produtosRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const salvarNovoProduto = async (produto: any) => {
  return await addDoc(produtosRef, produto);
};

export const atualizarProduto = async (id: string, dados: any) => {
  const produtoDoc = doc(db, "produtos", id);
  return await updateDoc(produtoDoc, dados);
};