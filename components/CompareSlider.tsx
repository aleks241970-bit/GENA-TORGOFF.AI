
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CompareSliderProps {
  original: string;
  modified: string;
  className?: string;
}

export const CompareSlider: React.FC<CompareSliderProps> = ({ 
  original, 
  modified, 
  className = '' 
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width to ensure the 'original' image (clipped) matches dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateWidth = () => {
        if(containerRef.current) setContainerWidth(containerRef.current.offsetWidth);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    
    // ResizeObserver for more robust handling of layout changes
    const resizeObserver = new ResizeObserver(() => updateWidth());
    resizeObserver.observe(containerRef.current);

    return () => {
        window.removeEventListener('resize', updateWidth);
        resizeObserver.disconnect();
    };
  }, []);

  const handleStart = useCallback(() => setIsResizing(true), []);
  const handleEnd = useCallback(() => setIsResizing(false), []);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPosition(percent);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
        if (isResizing) handleMove(e.clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
        if (isResizing) handleMove(e.touches[0].clientX);
    };

    if (isResizing) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isResizing, handleMove, handleEnd]);

  const handleContainerClick = (e: React.MouseEvent) => {
      handleMove(e.clientX);
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative select-none overflow-hidden cursor-ew-resize group ${className}`}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      onClick={handleContainerClick}
    >
      {/* Background Layer: Modified Image (After) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img 
        src={modified} 
        alt="Modified" 
        className="block w-full h-auto object-contain pointer-events-none select-none" 
      />
      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded pointer-events-none border border-white/10">
        AFTER
      </div>

      {/* Foreground Layer: Original Image (Before) - Clipped */}
      <div 
        className="absolute top-0 left-0 h-full overflow-hidden pointer-events-none select-none border-r-2 border-torg-accent shadow-[0_0_20px_rgba(0,0,0,0.5)]"
        style={{ width: `${sliderPosition}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={original} 
          alt="Original" 
          className="block max-w-none h-full object-contain"
          style={{ width: containerWidth ? `${containerWidth}px` : '100vw' }} 
        />
        <div className="absolute bottom-2 left-2 bg-black/60 text-torg-accent text-[10px] font-mono px-2 py-1 rounded pointer-events-none border border-torg-accent/30">
            BEFORE
        </div>
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-transparent pointer-events-none z-20"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-torg-accent/90 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center border-2 border-white/20 backdrop-blur-sm">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h8M8 17h8m-8-5h8" />
             </svg>
        </div>
      </div>
    </div>
  );
};
