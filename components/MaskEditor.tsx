import React, { useRef, useEffect, useState } from 'react';
import { Button } from './Button';
import { detectObjects } from '../services/geminiService';

interface MaskEditorProps {
  imageSrc: string;
  onConfirm: (maskBase64: string) => void;
  onCancel: () => void;
}

export const MaskEditor: React.FC<MaskEditorProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null); 
  const mousePosRef = useRef({ x: 0, y: 0 });
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(50);
  const [isSoftBrush, setIsSoftBrush] = useState(false);
  const [isEraser, setIsEraser] = useState(false); 
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  
  // Set up canvas size to match image natural size
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = new Image();
    img.src = imageSrc;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setImageLoaded(true);
      }
    };
  }, [imageSrc]);

  // Update cursor visual when brush size, softness or tool changes
  useEffect(() => {
    if (mousePosRef.current.x !== 0 && mousePosRef.current.y !== 0 && cursorRef.current && cursorRef.current.style.opacity !== '0') {
        updateCursorVisuals(mousePosRef.current.x, mousePosRef.current.y);
    }
  }, [brushSize, isSoftBrush, isEraser]);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory(prev => [...prev, imageData]);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (canvas && ctx) {
      const lastState = history[history.length - 1];
      ctx.globalCompositeOperation = 'source-over'; // Reset composite op for restoration
      ctx.putImageData(lastState, 0, 0);
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const handleAutoDetect = async () => {
    if (isDetecting || !imageLoaded) return;
    
    saveHistory();
    setIsDetecting(true);
    
    try {
        const boxes = await detectObjects(imageSrc);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        
        if (canvas && ctx && boxes.length > 0) {
            ctx.save();
            // Force settings for drawing mask
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(255, 0, 0, 1.0)';
            ctx.shadowBlur = isSoftBrush ? 20 : 0;
            ctx.shadowColor = 'rgba(255, 0, 0, 1.0)';

            boxes.forEach(box => {
                // Coordinates are 0-1000 normalized
                const x = (box.xmin / 1000) * canvas.width;
                const y = (box.ymin / 1000) * canvas.height;
                const w = ((box.xmax - box.xmin) / 1000) * canvas.width;
                const h = ((box.ymax - box.ymin) / 1000) * canvas.height;
                
                ctx.fillRect(x, y, w, h);
            });
            ctx.restore();
        }
    } catch (error) {
        console.error("Auto detection failed", error);
        alert("Не удалось автоматически обнаружить объекты.");
    } finally {
        setIsDetecting(false);
    }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const updateCursorVisuals = (x: number, y: number) => {
    if (!cursorRef.current || !containerRef.current || !canvasRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    // Calculate scale: Displayed Width / Actual Canvas Width
    const scale = rect.width / canvasRef.current.width;
    const visualSize = brushSize * scale;

    cursorRef.current.style.width = `${visualSize}px`;
    cursorRef.current.style.height = `${visualSize}px`;
    cursorRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    cursorRef.current.style.opacity = '1';
    
    if (isEraser) {
        // Eraser visual (White/Clear)
        cursorRef.current.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        cursorRef.current.style.border = '1px solid rgba(255, 255, 255, 0.9)';
        cursorRef.current.style.boxShadow = '0 0 0 1px rgba(0, 0, 0, 0.8)'; // Contrast ring
        if (isSoftBrush) {
             cursorRef.current.style.boxShadow = `0 0 ${visualSize / 2}px rgba(255, 255, 255, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.5)`;
        }
    } else {
        // Brush visual (Red)
        if (isSoftBrush) {
            cursorRef.current.style.boxShadow = `0 0 ${visualSize / 2}px rgba(255, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.5)`;
            cursorRef.current.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            cursorRef.current.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        } else {
            cursorRef.current.style.boxShadow = '0 0 0 1px rgba(0, 0, 0, 0.8)';
            cursorRef.current.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            cursorRef.current.style.border = '2px solid rgba(255, 255, 255, 0.9)';
        }
    }
  };

  const updateCursor = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Check if cursor is inside container
    if (
        clientX < rect.left || 
        clientX > rect.right || 
        clientY < rect.top || 
        clientY > rect.bottom
    ) {
        if (cursorRef.current) cursorRef.current.style.opacity = '0';
        return;
    }

    // Position relative to container top-left
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    mousePosRef.current = { x, y };
    updateCursorVisuals(x, y);
  };

  const configureContext = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;

    if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0, 0, 0, 1.0)'; // Color doesn't strictly matter for destination-out
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255, 0, 0, 1.0)'; 
    }

    if (isSoftBrush) {
        // Apply shadow to create a feathered effect
        ctx.shadowBlur = brushSize / 2;
        ctx.shadowColor = isEraser ? 'rgba(0, 0, 0, 1.0)' : 'rgba(255, 0, 0, 1.0)';
    } else {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imageLoaded) return;
    saveHistory(); // Save state before new stroke
    setIsDrawing(true);
    updateCursor(e);
    
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      configureContext(ctx);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    updateCursor(e);

    if (!isDrawing) return;
    
    if (e.cancelable && 'touches' in e) e.preventDefault(); 

    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      configureContext(ctx); // Ensure context is configured correctly for every move
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.closePath();
  };

  const handleLeave = () => {
    stopDrawing();
    if (cursorRef.current) {
        cursorRef.current.style.opacity = '0';
    }
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
      img.onload = () => {
        // 1. Draw the original image base
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // 2. Draw the red mask strokes on top of it
        tempCtx.drawImage(canvas, 0, 0);
        
        onConfirm(tempCanvas.toDataURL('image/png'));
      };
      img.onerror = () => {
         console.error("Failed to load image for mask composition");
         onConfirm(canvas.toDataURL('image/png')); 
      }
    }
  };

  const clearCanvas = () => {
    saveHistory(); // Save before clearing
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="flex flex-col w-full items-center gap-4 animate-fade-in">
      <div className="flex flex-col gap-4 w-full bg-white/5 p-4 rounded-lg border border-white/10">
        
        <div className="flex flex-col xl:flex-row justify-between items-center border-b border-white/10 pb-3 gap-4">
             <div className="flex items-center gap-4 flex-wrap justify-center md:justify-start">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${isEraser ? 'bg-white' : 'bg-red-500'}`}></div>
                    <p className="text-gray-200 font-mono text-sm font-bold whitespace-nowrap">
                        {isEraser ? 'РЕЖИМ ЛАСТИКА' : 'РЕЖИМ КИСТИ'}
                    </p>
                </div>

                {/* Auto Detect Button */}
                <button
                    onClick={handleAutoDetect}
                    disabled={isDetecting}
                    className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-mono font-bold transition-all border ${
                        isDetecting 
                        ? 'bg-white/10 text-white border-white/20 cursor-wait' 
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent hover:scale-105 hover:shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                    }`}
                >
                    {isDetecting ? (
                        <>
                           <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                           ПОИСК...
                        </>
                    ) : (
                        <>
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                           </svg>
                           АВТО-ВЫДЕЛЕНИЕ
                        </>
                    )}
                </button>
            </div>
            
            <div className="flex flex-wrap gap-4 items-center justify-center md:justify-end">
                {/* Tool Selection */}
                <div className="flex bg-black/40 rounded p-1 gap-1 border border-white/5">
                    <button
                        onClick={() => setIsEraser(false)}
                        className={`px-3 py-1 text-xs font-mono rounded transition-all ${
                            !isEraser 
                            ? 'bg-torg-accent text-black font-bold shadow-[0_0_10px_rgba(212,255,0,0.2)]' 
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        РИСОВАТЬ
                    </button>
                    <button
                        onClick={() => setIsEraser(true)}
                        className={`px-3 py-1 text-xs font-mono rounded transition-all ${
                            isEraser 
                            ? 'bg-white text-black font-bold shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        СТИРАТЬ
                    </button>
                </div>

                <div className="w-px h-6 bg-white/10 hidden md:block"></div>

                {/* Brush Type Selection */}
                <div className="flex bg-black/40 rounded p-1 gap-1 border border-white/5">
                    <button
                        onClick={() => setIsSoftBrush(false)}
                        className={`px-3 py-1 text-xs font-mono rounded transition-all ${
                            !isSoftBrush 
                            ? 'bg-gray-700 text-white font-bold' 
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        ЖЕСТКАЯ
                    </button>
                    <button
                        onClick={() => setIsSoftBrush(true)}
                        className={`px-3 py-1 text-xs font-mono rounded transition-all ${
                            isSoftBrush 
                            ? 'bg-gray-700 text-white font-bold shadow-[0_0_10px_rgba(100,100,100,0.4)]' 
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        МЯГКАЯ
                    </button>
                </div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center w-full">
            <label className="text-xs text-torg-accent uppercase font-mono whitespace-nowrap">Размер</label>
            <input 
                type="range" 
                min="10" 
                max="400" 
                value={brushSize} 
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-torg-accent"
            />
            <span className="font-mono text-xs w-8 text-right">{brushSize}</span>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="relative w-full border border-white/20 rounded overflow-hidden cursor-none touch-none group shadow-2xl bg-black"
        onMouseEnter={() => { if (cursorRef.current) cursorRef.current.style.opacity = '1'; }}
        onMouseLeave={handleLeave}
      >
        {/* Background Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={imageSrc} 
          alt="Source" 
          className="w-full h-auto block pointer-events-none select-none"
        />
        
        {/* Drawing Canvas with CSS Opacity for visual overlay effect */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full touch-none z-10 opacity-60 mix-blend-normal"
          onMouseDown={startDrawing}
          onMouseMove={handleMove}
          onMouseUp={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={handleMove}
          onTouchEnd={stopDrawing}
        />

        {/* Enhanced High-Contrast Cursor */}
        <div 
            ref={cursorRef}
            className="pointer-events-none absolute top-0 left-0 rounded-full z-20 opacity-0 will-change-transform flex items-center justify-center"
            style={{
                border: '2px solid rgba(255, 255, 255, 0.9)',
                backgroundColor: 'rgba(255, 0, 0, 0.1)', // Lighter bg since canvas handles opacity
                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.8)', 
                transition: 'width 0.05s linear, height 0.05s linear', 
            }}
        >
            <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_2px_rgba(0,0,0,1)]"></div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mb-2">
         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
         </svg>
         <span>Область, выделенная красным, будет удалена и перегенерирована.</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        <Button 
            variant="outline" 
            onClick={handleUndo} 
            type="button" 
            className="w-full"
            disabled={history.length === 0}
        >
            ОТМЕНИТЬ
        </Button>
        <Button variant="outline" onClick={clearCanvas} type="button" className="w-full">
            ОЧИСТИТЬ
        </Button>
        <Button variant="secondary" onClick={onCancel} type="button" className="w-full">
            ОТМЕНА
        </Button>
        <Button variant="primary" onClick={handleConfirm} type="button" className="w-full">
            УДАЛИТЬ
        </Button>
      </div>
    </div>
  );
};
