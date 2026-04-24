import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
  return null;
}

  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-4)' }}>
      <div 
        style={{ 
          transform: isLoaded ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
          opacity: isLoaded ? 1 : 0,
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)'
        }}
      >
        <div 
          className="flex-center" 
          style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '24px', 
            background: 'var(--color-primary)',
            color: 'white',
            boxShadow: 'var(--shadow-lg), 0 0 40px var(--color-primary-glow)'
          }}
        >
          <Pill size={48} />
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: 'var(--space-1)' }}>PillOps</h1>
          <p className="text-muted" style={{ fontSize: '1.1rem' }}>Smart Pharmacy Operations</p>
        </div>
      </div>

      <div 
        style={{ 
          opacity: isLoaded ? 1 : 0, 
          transition: 'opacity 0.8s ease 0.4s',
          marginTop: 'var(--space-6)'
        }}
      >
        <button 
          className="btn btn-primary" 
          style={{ padding: '0.75rem 2.5rem', fontSize: '1.1rem', borderRadius: '100px' }}
          onClick={() => router.push('/dashboard')}
        >
          Enter Store
        </button>
      </div>

      <div 
        className="text-muted"
        style={{ 
          position: 'absolute', 
          bottom: 'var(--space-4)', 
          fontSize: 'var(--font-size-sm)',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.8s ease 0.6s'
        }}
      >
        POC Build v0.1.0 • Local Storage Mode
      </div>
    </div>
  );
}
