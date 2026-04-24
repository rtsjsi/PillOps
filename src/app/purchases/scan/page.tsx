'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Camera, Focus, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function AIInvoiceScanner() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200; // Optimal size for OCR, anything larger wastes bandwidth/latency

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target?.result as string); // fallback
          
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality JPEG compression
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleScanReal = async (file: File) => {
    setScanning(true);
    setError(null);
    setProgressText('Uploading image securely...');

    try {
      const base64 = await fileToBase64(file);
      
      setProgressText('Vision AI processing document...');
      
      const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract data');
      }

      setProgressText('Extraction complete! Redirecting...');
      
      // Store the extracted data temporarily in sessionStorage to pass to the review page
      sessionStorage.setItem('pillops_extracted_invoice', JSON.stringify(data));
      
      setTimeout(() => {
        router.push('/purchases/review');
      }, 500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unknown error occurred');
      setScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleScanReal(e.target.files[0]);
    }
  };

  if (scanning) {
    return (
      <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'white', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.15, background: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }} />
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0, height: '2px',
          background: 'var(--color-primary)', boxShadow: '0 0 40px 10px var(--color-primary)',
          zIndex: 10, animation: 'scanline 2s infinite linear alternate'
        }} />
        <Focus size={64} color="var(--color-primary)" style={{ marginBottom: '32px', animation: 'pulse 2s infinite' }} />
        <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', zIndex: 10 }}>PillOps Vision AI</h2>
        <p style={{ color: 'var(--color-primary)', zIndex: 10, textAlign: 'center', padding: '0 20px' }}>{progressText}</p>
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
          @keyframes scanline { 0% { top: 10%; } 100% { top: 90%; } }
        `}} />
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'var(--space-6)' }}>
        <Link href="/purchases" className="btn btn-outline" style={{ padding: '8px', border: 'none' }}>
           <ArrowLeft size={24} />
        </Link>
        <h1 style={{ fontSize: '1.5rem' }}>Scan Invoice</h1>
      </header>

      {error && (
        <div style={{ background: 'var(--color-danger)', color: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
           <AlertTriangle size={24} style={{ flexShrink: 0 }} />
           <div style={{ fontSize: '0.9rem' }}>
              <strong>Scan Failed:</strong> {error}
           </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2 style={{ fontSize: '1.1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Choose an input method</h2>
        
        <button 
          className="glass-card flex-center" 
          style={{ flex: 1, flexDirection: 'column', gap: '16px', fontSize: '1.2rem', fontWeight: 'bold', border: '2px dashed var(--color-primary)', background: 'var(--color-primary-glow)' }}
          onClick={() => {
              // In a real mobile PWA, we'd trigger the <input capture="environment"> here
              fileInputRef.current?.click();
          }}
        >
          <Camera size={48} color="var(--color-primary)" />
          Open Camera
        </button>

        <div className="flex-center text-muted">OR</div>

        <button 
          className="glass-card flex-center" 
          style={{ flex: 1, flexDirection: 'column', gap: '16px', fontSize: '1.2rem', fontWeight: 'bold', border: '1px solid rgba(107,114,128,0.2)' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={48} color="var(--color-text-muted)" />
          Upload Image
        </button>
        
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}

