import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatedBackground } from '../components/ui/AnimatedBackground';
import { useAuth } from '../context/AuthContext';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      setToken(token);
      navigate('/dashboard', { replace: true });
      return;
    }

    if (error) {
      navigate('/login', { replace: true, state: { error } });
      return;
    }

    navigate('/login', { replace: true });
  }, [navigate, searchParams, setToken]);

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <AnimatedBackground />
      <motion.p
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="relative z-10 text-sm text-slate-400"
      >
        Completing sign-in…
      </motion.p>
    </div>
  );
}
