import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    
    if (!email || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }

    setCarregando(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      navigate('/'); // Se der certo, manda pro Menu Principal
    } catch (error: any) {
      console.error(error);
      setErro('Acesso negado. Verifique seu e-mail e senha.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      <style>{`
        html, body, #root { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background-color: #0a0a0b; color: #e4e4e7; font-family: system-ui, sans-serif; }
        .login-wrapper { display: flex; align-items: center; justify-content: center; height: 100vh; width: 100vw; background: radial-gradient(circle at center, #18181b 0%, #0a0a0b 100%); }
        .login-box { background: #121214; border: 1px solid #27272a; padding: 40px; border-radius: 16px; width: 100%; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center; }
        
        .logo-login { max-height: 100px; margin-bottom: 30px; filter: drop-shadow(0px 4px 10px rgba(250, 204, 21, 0.2)); }
        
        .login-form { width: 100%; display: flex; flex-direction: column; gap: 20px; }
        .input-group { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 15px; color: #facc15; }
        .login-input { width: 100%; background: #0a0a0b; border: 2px solid #3f3f46; padding: 15px 15px 15px 45px; border-radius: 8px; color: #f8fafc; font-size: 1rem; outline: none; transition: 0.3s; font-weight: bold;}
        .login-input:focus { border-color: #facc15; box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1); }
        .login-input::placeholder { color: #52525b; font-weight: normal;}
        
        .erro-msg { color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 10px; border-radius: 8px; font-size: 0.85rem; text-align: center; font-weight: bold; }
        
        .btn-entrar { background: #facc15; color: #0a0a0b; border: none; padding: 15px; border-radius: 8px; font-weight: 900; font-size: 1.1rem; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 10px; transition: 0.2s; text-transform: uppercase; margin-top: 10px; }
        .btn-entrar:hover:not(:disabled) { background: #eab308; transform: translateY(-2px); box-shadow: 0 10px 20px -10px rgba(250, 204, 21, 0.5); }
        .btn-entrar:disabled { opacity: 0.7; cursor: not-allowed; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="login-wrapper">
        <div className="login-box">
          <img src={logoImg} alt="Império Variedades" className="logo-login" />
          
          <form className="login-form" onSubmit={fazerLogin}>
            {erro && <div className="erro-msg">{erro}</div>}
            
            <div className="input-group">
              <Mail size={20} className="input-icon" />
              <input type="email" placeholder="Seu E-mail" className="login-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            
            <div className="input-group">
              <Lock size={20} className="input-icon" />
              <input type="password" placeholder="Sua Senha" className="login-input" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>

            <button type="submit" className="btn-entrar" disabled={carregando}>
              {carregando ? <Loader2 size={20} className="spin" /> : <LogIn size={20} />}
              {carregando ? 'AUTENTICANDO...' : 'ACESSAR SISTEMA'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}