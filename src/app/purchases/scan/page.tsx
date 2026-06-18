'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Camera, Focus, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function AIInvoiceScanner() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('auto');

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 2000; // Increased size for dense invoice OCR

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

          // Removed B&W binarization to let Vision LLMs use natural colors/shadows
          resolve(canvas.toDataURL('image/jpeg', 0.9)); // 90% quality JPEG compression
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
          mimeType: file.type,
          preferredModel: selectedModel
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
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-15 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-primary shadow-[0_0_40px_10px_var(--color-primary)] z-10 animate-[scanline_2s_infinite_linear_alternate]" />
        <Focus size={64} className="text-primary mb-8 animate-pulse z-10" />
        <h2 className="text-2xl mb-4 z-10">PillOps Vision AI</h2>
        <p className="text-primary z-10 text-center px-5">{progressText}</p>
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes scanline { 0% { top: 10%; } 100% { top: 90%; } }
        `}} />
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col h-screen bg-background">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/purchases" className="p-2 border-none">
           <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold">Scan Invoice</h1>
      </header>

      {error && (
        <div className="bg-red-500 text-white p-4 rounded-lg mb-4 flex items-start gap-3">
           <AlertTriangle size={24} className="shrink-0" />
           <div className="text-sm">
              <strong>Scan Failed:</strong> {error}
           </div>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-card p-4 rounded-xl border mb-2">
           <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2 block">AI Model Preference</Label>
           <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-full h-12 text-md font-bold">
                 <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="auto">Auto-Fallback (Recommended)</SelectItem>
                 <SelectItem value="github">GitHub Models (GPT-4o mini)</SelectItem>
                 <SelectItem value="gemini">Google Gemini (Flash)</SelectItem>
                 <SelectItem value="groq">Groq (Llama Vision)</SelectItem>
              </SelectContent>
           </Select>
        </div>

        <h2 className="text-lg text-center text-muted-foreground">Choose an input method</h2>
        
        <button 
          className="flex-1 flex flex-col items-center justify-center gap-4 text-xl font-bold border-2 border-dashed border-primary bg-primary/10 rounded-xl"
          onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.capture = 'environment';
                fileInputRef.current.click();
              }
          }}
        >
          <Camera size={48} className="text-primary" />
          Open Camera
        </button>

        <div className="flex items-center justify-center text-muted-foreground">OR</div>

        <button 
          className="flex-1 flex flex-col items-center justify-center gap-4 text-xl font-bold border border-muted/20 bg-card rounded-xl"
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.removeAttribute('capture');
              fileInputRef.current.click();
            }
          }}
        >
          <Upload size={48} className="text-muted-foreground" />
          Upload Image
        </button>
        
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}


