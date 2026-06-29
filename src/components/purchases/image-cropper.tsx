'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RotateCw, Crop, Check, X, RefreshCw } from 'lucide-react';
import { exportCanvasForOcr } from '@/lib/groq-image-compress';

interface ImageCropperProps {
  src: string;
  onCrop: (croppedBase64: string) => void;
  onCancel: () => void;
}

export function ImageCropper({ src, onCrop, onCancel }: ImageCropperProps) {
  const [currentImageSrc, setCurrentImageSrc] = useState(src);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 }); // Percentages
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, crop: { x: 0, y: 0, w: 0, h: 0 } });

  // Reset/sync when source image changes
  useEffect(() => {
    setCurrentImageSrc(src);
    setCrop({ x: 0, y: 0, w: 100, h: 100 });
  }, [src]);

  // Pointer event start handler
  const handlePointerDown = (e: React.PointerEvent, target: string) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Get client position as percentage of container dimensions
    const px = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const py = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    dragStart.current = {
      mouseX: px,
      mouseY: py,
      crop: { ...crop }
    };
    setDragTarget(target);
  };

  // Pointer events move & up listeners
  useEffect(() => {
    if (!dragTarget || !containerRef.current) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const px = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const py = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      const dx = px - dragStart.current.mouseX;
      const dy = py - dragStart.current.mouseY;

      setCrop(() => {
        let { x, y, w, h } = dragStart.current.crop;
        const minSize = 10; // Min crop window size (10% of image size)

        if (dragTarget === 'move') {
          x = Math.max(0, Math.min(100 - w, x + dx));
          y = Math.max(0, Math.min(100 - h, y + dy));
        } else if (dragTarget === 'tl') {
          const newX = Math.max(0, Math.min(x + w - minSize, x + dx));
          const newY = Math.max(0, Math.min(y + h - minSize, y + dy));
          w = w - (newX - x);
          h = h - (newY - y);
          x = newX;
          y = newY;
        } else if (dragTarget === 'tr') {
          const newY = Math.max(0, Math.min(y + h - minSize, y + dy));
          h = h - (newY - y);
          y = newY;
          w = Math.max(minSize, Math.min(100 - x, w + dx));
        } else if (dragTarget === 'bl') {
          const newX = Math.max(0, Math.min(x + w - minSize, x + dx));
          w = w - (newX - x);
          x = newX;
          h = Math.max(minSize, Math.min(100 - y, h + dy));
        } else if (dragTarget === 'br') {
          w = Math.max(minSize, Math.min(100 - x, w + dx));
          h = Math.max(minSize, Math.min(100 - y, h + dy));
        } else if (dragTarget === 't') {
          const newY = Math.max(0, Math.min(y + h - minSize, y + dy));
          h = h - (newY - y);
          y = newY;
        } else if (dragTarget === 'b') {
          h = Math.max(minSize, Math.min(100 - y, h + dy));
        } else if (dragTarget === 'l') {
          const newX = Math.max(0, Math.min(x + w - minSize, x + dx));
          w = w - (newX - x);
          x = newX;
        } else if (dragTarget === 'r') {
          w = Math.max(minSize, Math.min(100 - x, w + dx));
        }

        return { x, y, w, h };
      });
    };

    const handlePointerUp = () => {
      setDragTarget(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragTarget]);

  // Execute rotation in canvas and save base64
  const handleRotate = async () => {
    if (isRotating) return;
    setIsRotating(true);

    try {
      const rotated = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.height;
          canvas.height = img.width;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((90 * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          resolve(exportCanvasForOcr(canvas).base64);
        };
        img.onerror = () => reject(new Error('Failed to load image for rotation'));
        img.src = currentImageSrc;
      });

      setCurrentImageSrc(rotated);
      setCrop({ x: 0, y: 0, w: 100, h: 100 }); // Reset crop bounds to standard
    } catch (err) {
      console.error('Error rotating image:', err);
    } finally {
      setIsRotating(false);
    }
  };

  // Perform final crop on native canvas resolution
  const handleSave = () => {
    if (!imageRef.current) return;
    const img = imageRef.current;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Convert crop percentages back to original natural image coordinates
    const startX = (crop.x / 100) * img.naturalWidth;
    const startY = (crop.y / 100) * img.naturalHeight;
    const cropW = (crop.w / 100) * img.naturalWidth;
    const cropH = (crop.h / 100) * img.naturalHeight;

    canvas.width = cropW;
    canvas.height = cropH;

    ctx.drawImage(
      img,
      startX,
      startY,
      cropW,
      cropH,
      0,
      0,
      cropW,
      cropH
    );

    const { base64 } = exportCanvasForOcr(canvas);
    onCrop(base64);
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Crop className="w-5 h-5 text-primary" />
            Adjust & Crop Invoice Page
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Crop unnecessary margins for optimal OCR processing</p>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 hover:bg-slate-800 rounded-full transition-colors"
          title="Cancel and skip"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Workspace */}
      <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center p-6 sm:p-10 relative overflow-hidden select-none bg-slate-950">
        <div
          ref={containerRef}
          className="relative inline-flex max-w-full max-h-full shadow-2xl border border-slate-800"
          style={{ touchAction: 'none' }}
        >
          {/* Main Image */}
          <img
            ref={imageRef}
            src={currentImageSrc}
            alt="To Crop"
            className="max-w-full max-h-full object-contain block pointer-events-none"
          />

          {/* Dark Backdrop Overlays surrounding the crop box */}
          {/* Top */}
          <div
            className="absolute left-0 top-0 right-0 bg-slate-950/70 pointer-events-none"
            style={{ height: `${crop.y}%` }}
          />
          {/* Bottom */}
          <div
            className="absolute left-0 bottom-0 right-0 bg-slate-950/70 pointer-events-none"
            style={{ top: `${crop.y + crop.h}%` }}
          />
          {/* Left */}
          <div
            className="absolute left-0 bg-slate-950/70 pointer-events-none"
            style={{ top: `${crop.y}%`, width: `${crop.x}%`, height: `${crop.h}%` }}
          />
          {/* Right */}
          <div
            className="absolute right-0 bg-slate-950/70 pointer-events-none"
            style={{ top: `${crop.y}%`, left: `${crop.x + crop.w}%`, height: `${crop.h}%` }}
          />

          {/* Crop Area */}
          <div
            className="absolute border-2 border-primary cursor-move shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.w}%`,
              height: `${crop.h}%`,
            }}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
          >
            {/* Edge Drag Handles */}
            <div
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 't'); }}
              className="absolute -top-3 left-4 right-4 h-6 cursor-ns-resize z-10"
              style={{ touchAction: 'none' }}
            />
            <div
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'b'); }}
              className="absolute -bottom-3 left-4 right-4 h-6 cursor-ns-resize z-10"
              style={{ touchAction: 'none' }}
            />
            <div
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'l'); }}
              className="absolute -left-3 top-4 bottom-4 w-6 cursor-ew-resize z-10"
              style={{ touchAction: 'none' }}
            />
            <div
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'r'); }}
              className="absolute -right-3 top-4 bottom-4 w-6 cursor-ew-resize z-10"
              style={{ touchAction: 'none' }}
            />

            {/* Corner Drag Handles with larger hitboxes */}
            <div
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'tl'); }}
              className="absolute -left-5 -top-5 w-10 h-10 flex items-center justify-center cursor-nwse-resize z-20"
              style={{ touchAction: 'none' }}
            >
              <div className="w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md pointer-events-none" />
            </div>
            <div
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'tr'); }}
              className="absolute -right-5 -top-5 w-10 h-10 flex items-center justify-center cursor-nesw-resize z-20"
              style={{ touchAction: 'none' }}
            >
              <div className="w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md pointer-events-none" />
            </div>
            <div
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'bl'); }}
              className="absolute -left-5 -bottom-5 w-10 h-10 flex items-center justify-center cursor-nesw-resize z-20"
              style={{ touchAction: 'none' }}
            >
              <div className="w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md pointer-events-none" />
            </div>
            <div
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'br'); }}
              className="absolute -right-5 -bottom-5 w-10 h-10 flex items-center justify-center cursor-nwse-resize z-20"
              style={{ touchAction: 'none' }}
            >
              <div className="w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <footer className="p-4 border-t border-slate-800 bg-slate-900/50 flex flex-wrap justify-between items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={handleRotate}
            disabled={isRotating}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-bold rounded-lg transition-colors border border-slate-700"
          >
            <RotateCw className={`w-4 h-4 ${isRotating ? 'animate-spin' : ''}`} />
            Rotate 90°
          </button>
          
          <button
            onClick={() => setCrop({ x: 0, y: 0, w: 100, h: 100 })}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-850 hover:text-white rounded-lg transition-colors border border-slate-800"
          >
            Skip Page
          </button>
          
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:brightness-110 text-xs font-black text-white rounded-lg transition-colors shadow-lg shadow-primary/20"
          >
            <Check className="w-4 h-4" />
            Crop & Save Page
          </button>
        </div>
      </footer>
    </div>,
    document.body
  );
}
