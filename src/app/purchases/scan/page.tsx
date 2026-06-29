'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Camera, Focus, ArrowLeft, AlertTriangle, Plus } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { GROQ_OCR_MODELS } from '@/lib/ai-server';
import { ImageCropper } from '@/components/purchases/image-cropper';
export default function AIInvoiceScanner() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [images, setImages] = useState<{base64: string, mimeType: string, previewUrl: string}[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropQueueIndex, setCropQueueIndex] = useState(0);

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

  const handleProcess = async () => {
    if (images.length === 0) return;
    setScanning(true);
    setError(null);

    try {
      let data: any;

      if (selectedModel === 'offline') {
        // --- CLIENT-SIDE OCR using Tesseract.js (runs in the browser) ---
        setProgressText('Loading Tesseract OCR engine...');
        const Tesseract = await import('tesseract.js');

        // Create a persistent worker for all pages (faster than recognize() shorthand)
        const worker = await Tesseract.createWorker('eng', undefined, {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              const pct = Math.round((m.progress || 0) * 100);
              setProgressText(`Recognizing text… ${pct}%`);
            } else {
              setProgressText(m.status || 'Initializing...');
            }
          }
        });

        let combinedText = '';
        for (let i = 0; i < images.length; i++) {
          setProgressText(`OCR processing page ${i + 1} of ${images.length}...`);

          // Convert data URL to Blob for reliable Tesseract processing
          const dataUrl = images[i].base64;
          const res = await fetch(dataUrl);
          const blob = await res.blob();

          const result = await worker.recognize(blob);
          const pageText = result.data.text || '';
          console.log(`[Tesseract] Page ${i + 1} text (${pageText.length} chars):`, pageText.substring(0, 200));
          combinedText += pageText + '\n';
        }

        await worker.terminate();
        console.log('[Tesseract] Combined text length:', combinedText.trim().length);

        // Step 2: Parse the raw text into structured invoice data (no AI needed)
        setProgressText('Parsing invoice structure...');
        const { parseInvoiceText } = await import('@/lib/invoice-text-parser');
        data = parseInvoiceText(combinedText);
        console.log('[Parser] Result:', data.items.length, 'items,', 'confidence:', data.parsingConfidence);
      } else {
        // --- SERVER-SIDE OCR via API ---
        setProgressText('Uploading images securely...');
        const payloadImages = images.map(img => ({ base64: img.base64, mimeType: img.mimeType }));
        setProgressText('Vision AI processing documents...');

        const response = await fetch('/api/extract-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: payloadImages,
            preferredModel: selectedModel
          })
        });

        data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to extract data');
        }
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setCropQueue(filesArray);
      setCropQueueIndex(0);
      
      const firstBase64 = await fileToBase64(filesArray[0]);
      setCroppingImage(firstBase64);

      // Reset input so the same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCropSave = (croppedBase64: string) => {
    const newImages = [...images];
    const currentFile = cropQueue[cropQueueIndex];
    
    newImages.push({ base64: croppedBase64, mimeType: currentFile.type, previewUrl: croppedBase64 });
    setImages(newImages);

    moveToNextInCropQueue();
  };

  const handleCropCancel = () => {
    moveToNextInCropQueue();
  };

  const moveToNextInCropQueue = async () => {
    const nextIndex = cropQueueIndex + 1;
    if (nextIndex < cropQueue.length) {
      setCropQueueIndex(nextIndex);
      const base64 = await fileToBase64(cropQueue[nextIndex]);
      setCroppingImage(base64);
    } else {
      setCroppingImage(null);
      setCropQueue([]);
      setCropQueueIndex(0);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
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
    <div className="p-4 flex flex-col bg-background">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/purchases" className="p-2 border-none">
           <ArrowLeft size={24} />
        </Link>
        <h1 className="text-lg font-bold">Scan Invoice</h1>
      </header>

      {error && (
        <div className="bg-red-500 text-white p-4 rounded-lg mb-4 flex items-start gap-3">
           <AlertTriangle size={24} className="shrink-0" />
           <div className="text-sm">
              <strong>Scan Failed:</strong> {error}
           </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="bg-card p-4 rounded-xl border mb-2">
           <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2 block">AI Model Preference</Label>
                           {/* Model selector – dynamically generated from GROQ_OCR_MODELS */}
                <Select value={selectedModel} onValueChange={(val) => setSelectedModel(val || 'auto')}>
                  <SelectTrigger className="w-full h-10 text-sm font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Auto fallback option */}
                    <SelectItem value="auto">Auto-Fallback (Recommended)</SelectItem>
                    {/* Dynamically list Groq vision models */}
                    {GROQ_OCR_MODELS.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
        </div>

        {images.length > 0 && (
          <div className="bg-card p-4 rounded-xl border animate-page-in">
            <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3 block">Scanned Pages ({images.length})</Label>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative shrink-0 w-24 h-32 rounded-lg border-2 border-primary/20 overflow-hidden shadow-sm">
                  <img src={img.previewUrl} className="object-cover w-full h-full" alt={`Page ${idx + 1}`} />
                  <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md transition-colors">
                    ×
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-1 font-bold">
                    Page {idx + 1}
                  </div>
                </div>
              ))}
              
              <div className="relative shrink-0 w-24 h-32">
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex flex-col items-center justify-center w-full h-full rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary gap-1"
                >
                  <Plus size={24} />
                  <span className="text-[10px] font-bold">Add Page</span>
                </button>

                {showAddModal && (
                  <div className="absolute inset-0 bg-white dark:bg-slate-900 border-2 border-primary rounded-lg flex flex-col p-1.5 gap-1.5 animate-in fade-in zoom-in-95 duration-100 z-10 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        if (fileInputRef.current) {
                          fileInputRef.current.capture = 'environment';
                          fileInputRef.current.multiple = false;
                          fileInputRef.current.click();
                        }
                      }}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded bg-primary/5 text-primary text-[10px] font-bold hover:bg-primary/10 transition-colors"
                    >
                      <Camera size={14} />
                      <span>Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute('capture');
                          fileInputRef.current.multiple = true;
                          fileInputRef.current.click();
                        }
                      }}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-bold hover:bg-slate-200 transition-colors"
                    >
                      <Upload size={14} />
                      <span>Gallery</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddModal(false);
                      }}
                      className="text-[9px] text-muted-foreground hover:text-foreground font-semibold py-0.5 text-center bg-slate-50 dark:bg-slate-800 rounded border border-border"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {images.length === 0 && (
          <div className="flex gap-3 h-24 shrink-0 animate-page-in">
            <button 
              className="flex-1 flex flex-col items-center justify-center gap-2 text-sm font-bold border-2 border-dashed border-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors"
              onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.capture = 'environment';
                    fileInputRef.current.multiple = false;
                    fileInputRef.current.click();
                  }
              }}
            >
              <Camera size={28} className="text-primary" />
              Camera
            </button>

            <button 
              className="flex-1 flex flex-col items-center justify-center gap-2 text-sm font-bold border border-muted-foreground/30 bg-card hover:bg-accent rounded-xl transition-colors"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute('capture');
                  fileInputRef.current.multiple = true;
                  fileInputRef.current.click();
                }
              }}
            >
              <Upload size={28} className="text-muted-foreground" />
              Gallery
            </button>
          </div>
        )}

        {images.length > 0 && (
          <button
            onClick={handleProcess}
            className="w-full mt-4 mb-4 bg-primary text-primary-foreground font-black py-4 rounded-xl shadow-lg hover:brightness-110 transition-all animate-page-in"
          >
            PROCESS {images.length} PAGE{images.length !== 1 ? 'S' : ''}
          </button>
        )}
        
        <input 
          type="file" 
          accept="image/*" 
          multiple
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
        />
      </div>

      {croppingImage && (
        <ImageCropper
          src={croppingImage}
          onCrop={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}


