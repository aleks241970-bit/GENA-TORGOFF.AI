
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from './Button';
import { ImageUploader } from './ImageUploader';
import { removeBackground, replaceBackgroundWithText, replaceBackgroundWithImage } from '../services/geminiService';

interface RemoveBgModeProps {
  onGenerate: (promise: Promise<string>) => void;
}

type BgMode = 'TRANSPARENT' | 'TEXT_GEN' | 'IMAGE_SWAP';

export const RemoveBgMode: React.FC<RemoveBgModeProps> = ({ onGenerate }) => {
  const [bgMode, setBgMode] = useState<BgMode>('TRANSPARENT');
  
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null); // For Image Swap
  const [prompt, setPrompt] = useState(''); // For Text Gen

  const handleSubmit = useCallback(() => {
    if (!sourceImage) {
        alert("Пожалуйста, загрузите исходное изображение.");
        return;
    }

    if (bgMode === 'TRANSPARENT') {
        onGenerate(removeBackground(sourceImage));
    } else if (bgMode === 'TEXT_GEN') {
        if (!prompt.trim()) {
            alert("Введите описание нового фона.");
            return;
        }
        onGenerate(replaceBackgroundWithText(sourceImage, prompt));
    } else if (bgMode === 'IMAGE_SWAP') {
        if (!bgImage) {
            alert("Загрузите изображение для заднего фона.");
            return;
        }
        onGenerate(replaceBackgroundWithImage(sourceImage, bgImage));
    }
  }, [bgMode, sourceImage, bgImage, prompt, onGenerate]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            handleSubmit();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
            onClick={() => setBgMode('TRANSPARENT')}
            className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${
                bgMode === 'TRANSPARENT' 
                ? 'bg-torg-accent/10 border-torg-accent shadow-[0_0_15px_rgba(212,255,0,0.2)]' 
                : 'bg-black/40 border-white/10 hover:bg-white/5 hover:border-white/30'
            }`}
        >
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bgMode === 'TRANSPARENT' ? 'bg-torg-accent text-black' : 'bg-gray-800 text-gray-400'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                </div>
                <span className={`font-mono font-bold text-sm ${bgMode === 'TRANSPARENT' ? 'text-torg-accent' : 'text-gray-300'}`}>ПРОЗРАЧНОСТЬ</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight">Удаление фона с сохранением объекта в PNG (Alpha).</p>
        </button>

        <button
            onClick={() => setBgMode('TEXT_GEN')}
            className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${
                bgMode === 'TEXT_GEN' 
                ? 'bg-torg-purple/10 border-torg-purple shadow-[0_0_15px_rgba(110,68,255,0.2)]' 
                : 'bg-black/40 border-white/10 hover:bg-white/5 hover:border-white/30'
            }`}
        >
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bgMode === 'TEXT_GEN' ? 'bg-torg-purple text-white' : 'bg-gray-800 text-gray-400'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </div>
                <span className={`font-mono font-bold text-sm ${bgMode === 'TEXT_GEN' ? 'text-torg-purple' : 'text-gray-300'}`}>ГЕНЕРАЦИЯ</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight">Создание нового фона по текстовому описанию.</p>
        </button>

        <button
            onClick={() => setBgMode('IMAGE_SWAP')}
            className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${
                bgMode === 'IMAGE_SWAP' 
                ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                : 'bg-black/40 border-white/10 hover:bg-white/5 hover:border-white/30'
            }`}
        >
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bgMode === 'IMAGE_SWAP' ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <span className={`font-mono font-bold text-sm ${bgMode === 'IMAGE_SWAP' ? 'text-blue-500' : 'text-gray-300'}`}>ЗАМЕНА</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight">Подстановка вашего собственного изображения.</p>
        </button>
      </div>

      <div className="space-y-6">
          {/* Main Image Upload - Always Visible */}
          <div className="space-y-2">
              <p className="text-torg-accent font-mono text-sm uppercase tracking-wider">1. ИСХОДНЫЙ ОБЪЕКТ</p>
              <ImageUploader 
                  onImageSelect={setSourceImage} 
                  selectedImage={sourceImage} 
                  className="h-64"
                  placeholder="Загрузите фото с объектом"
              />
          </div>

          {/* Dynamic Controls based on Mode */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 transition-all animate-fade-in">
             {bgMode === 'TRANSPARENT' && (
                 <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-torg-accent/10 rounded-full flex items-center justify-center text-torg-accent shadow-[0_0_20px_rgba(212,255,0,0.1)]">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                         </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">Режим "Прозрачность"</h3>
                    <p className="text-gray-400 text-sm max-w-md mx-auto">
                        ИИ Gemini Nano автоматически выделит главный объект и удалит все остальное.
                    </p>
                 </div>
             )}

             {bgMode === 'TEXT_GEN' && (
                 <div className="space-y-4">
                     <p className="text-torg-purple font-mono text-sm uppercase tracking-wider">2. ОПИСАНИЕ НОВОГО ФОНА</p>
                     <div className="relative">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Например: 'Футуристическая лаборатория с неоновым светом', 'Пляж на закате'..."
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-sm focus:border-torg-purple focus:ring-1 focus:ring-torg-purple outline-none resize-none h-32 font-mono text-gray-300 placeholder-gray-600"
                        />
                        <div className="absolute bottom-2 right-2 text-[10px] text-gray-600 font-mono">GEMINI 2.5 FLASH</div>
                     </div>
                 </div>
             )}

             {bgMode === 'IMAGE_SWAP' && (
                 <div className="space-y-4">
                     <p className="text-blue-400 font-mono text-sm uppercase tracking-wider">2. ФОНОВОЕ ИЗОБРАЖЕНИЕ</p>
                     <ImageUploader 
                         onImageSelect={setBgImage} 
                         selectedImage={bgImage} 
                         className="h-48 bg-black/30"
                         placeholder="Загрузите новый фон"
                     />
                     <div className="flex items-start gap-2 mt-2">
                         <svg className="w-4 h-4 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                         <p className="text-xs text-gray-500 font-mono">
                             ИИ выполнит композинг: освещение и тени объекта будут адаптированы под новый фон.
                         </p>
                     </div>
                 </div>
             )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end items-center gap-4 pt-2 border-t border-white/5">
              <span className="text-xs font-mono text-gray-500 hidden md:block">
                  [CTRL + ENTER]
              </span>
              <Button 
                  onClick={handleSubmit} 
                  disabled={
                      !sourceImage || 
                      (bgMode === 'TEXT_GEN' && !prompt) || 
                      (bgMode === 'IMAGE_SWAP' && !bgImage)
                  }
                  className={
                      bgMode === 'TRANSPARENT' ? 'bg-torg-accent text-black hover:bg-white' :
                      bgMode === 'TEXT_GEN' ? 'bg-torg-purple text-white hover:bg-purple-500' :
                      'bg-blue-500 text-white hover:bg-blue-400'
                  }
              >
                  {bgMode === 'TRANSPARENT' ? 'ВЫПОЛНИТЬ (NANO BANANA)' : 'СГЕНЕРИРОВАТЬ'}
              </Button>
          </div>
      </div>
    </div>
  );
};
