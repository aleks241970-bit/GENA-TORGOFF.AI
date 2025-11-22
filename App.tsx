import React, { useState } from 'react';
import { AppMode, StylePreset } from './types';
import { generateImageFromText, stylizeImage, removeObjectWithMask } from './services/geminiService';
import { Button } from './components/Button';
import { ImageUploader } from './components/ImageUploader';
import { MaskEditor } from './components/MaskEditor';

const STYLE_PRESETS: StylePreset[] = [
  { id: 'cyberpunk', name: 'Киберпанк', promptSuffix: 'cyberpunk, neon lights, futuristic city, high contrast' },
  { id: 'anime', name: 'Аниме', promptSuffix: 'anime style, studio ghibli, vibrant colors, cel shaded' },
  { id: 'impressionism', name: 'Импрессионизм', promptSuffix: 'impressionist oil painting, claude monet style, visible brush strokes' },
  { id: 'cubism', name: 'Кубизм', promptSuffix: 'cubism style, picasso, geometric shapes, abstract' },
  { id: 'watercolor', name: 'Акварель', promptSuffix: 'watercolor painting, artistic, soft edges, bleeding colors' },
  { id: 'pixel', name: 'Пиксель-арт', promptSuffix: 'pixel art, 8-bit, retro game style' },
];

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.GENERATE);
  
  // State
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [refStyleImage, setRefStyleImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  
  // Cleanup Mode Specific
  const [isMasking, setIsMasking] = useState(false);

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const result = await generateImageFromText(prompt, aspectRatio);
      setGeneratedImage(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Ошибка генерации.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStylizeSubmit = async () => {
    if (!sourceImage) {
      setError("Пожалуйста, загрузите исходное изображение.");
      return;
    }
    
    const selectedPreset = STYLE_PRESETS.find(s => s.id === selectedStyleId);
    // If no preset, we might rely on ref image or raw text, but let's enforce at least one or prompt text
    if (!selectedPreset && !refStyleImage && !prompt) {
        setError("Пожалуйста, выберите стиль, загрузите референс или введите описание.");
        return;
    }

    const styleDescription = [
        selectedPreset?.promptSuffix,
        prompt
    ].filter(Boolean).join(', ');

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
        const result = await stylizeImage(sourceImage, styleDescription, refStyleImage || undefined);
        setGeneratedImage(result);
    } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Ошибка стилизации.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleCleanupConfirm = async (maskBase64: string) => {
    if (!sourceImage) return;
    
    setIsMasking(false); // Hide editor
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
        const result = await removeObjectWithMask(sourceImage, maskBase64);
        setGeneratedImage(result);
    } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Ошибка удаления объекта.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleModeSwitch = (newMode: AppMode) => {
    setMode(newMode);
    setPrompt('');
    setAspectRatio('1:1');
    setGeneratedImage(null);
    setError(null);
    setIsMasking(false);
    setSelectedStyleId(null);
    setRefStyleImage(null);
    // Note: We might keep sourceImage for convenience when switching between Stylize/Cleanup
  };

  const handleEditResult = () => {
    if (generatedImage) {
      const imageToEdit = generatedImage;
      handleModeSwitch(AppMode.STYLIZE);
      setSourceImage(imageToEdit);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderModeContent = () => {
    if (isMasking && sourceImage) {
        return (
            <MaskEditor 
                imageSrc={sourceImage} 
                onConfirm={handleCleanupConfirm}
                onCancel={() => setIsMasking(false)}
            />
        );
    }

    switch (mode) {
      case AppMode.GENERATE:
        return (
          <form onSubmit={handleGenerateSubmit} className="space-y-6 animate-fade-in">
             <div className="space-y-2">
                <p className="text-sm font-mono text-gray-400">ФОРМАТ ИЗОБРАЖЕНИЯ</p>
                <div className="flex flex-wrap gap-2">
                    {['1:1', '16:9', '9:16', '4:3', '3:4'].map((ratio) => (
                        <button
                            key={ratio}
                            type="button"
                            onClick={() => setAspectRatio(ratio)}
                            className={`px-4 py-2 rounded border text-sm font-mono transition-all ${
                                aspectRatio === ratio
                                ? 'bg-torg-accent text-black border-torg-accent font-bold shadow-[0_0_10px_rgba(212,255,0,0.2)]'
                                : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                            }`}
                        >
                            {ratio}
                        </button>
                    ))}
                </div>
             </div>

             <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Опишите футуристический город, космическую сущность или неонового персонажа..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-lg focus:border-torg-accent focus:ring-1 focus:ring-torg-accent outline-none resize-none h-48 font-mono text-gray-300 placeholder-gray-600 transition-all"
                />
                <div className="absolute bottom-4 right-4 text-xs text-gray-500 font-mono">GEMINI 2.5 FLASH</div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={!prompt} isLoading={isLoading}>
                  НАЧАТЬ ГЕНЕРАЦИЮ
                </Button>
              </div>
          </form>
        );

      case AppMode.STYLIZE:
        return (
          <div className="space-y-6 animate-fade-in">
             <div className="grid md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <p className="text-sm font-mono text-torg-accent">ИСХОДНОЕ ИЗОБРАЖЕНИЕ</p>
                    <ImageUploader onImageSelect={setSourceImage} selectedImage={sourceImage} />
                 </div>
                 <div className="space-y-2">
                    <p className="text-sm font-mono text-gray-400">РЕФЕРЕНС СТИЛЯ (ОПЦИОНАЛЬНО)</p>
                    <ImageUploader onImageSelect={setRefStyleImage} selectedImage={refStyleImage} />
                 </div>
             </div>

             <div className="space-y-2">
                 <p className="text-sm font-mono text-gray-400">ВЫБЕРИТЕ ПРЕДУСТАНОВЛЕННЫЙ СТИЛЬ</p>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                     {STYLE_PRESETS.map(style => (
                         <button
                            key={style.id}
                            onClick={() => setSelectedStyleId(selectedStyleId === style.id ? null : style.id)}
                            className={`p-3 border rounded text-sm font-bold font-mono transition-all ${
                                selectedStyleId === style.id 
                                ? 'border-torg-accent bg-torg-accent/10 text-torg-accent' 
                                : 'border-white/10 hover:border-white/30 text-gray-400'
                            }`}
                         >
                            {style.name}
                         </button>
                     ))}
                 </div>
             </div>

             <div className="relative">
                 <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Дополнительные инструкции (например, 'темные тона', 'больше деталей')..."
                    className="w-full bg-black/40 border border-white/10 rounded p-3 font-mono text-sm focus:border-torg-accent outline-none"
                 />
             </div>

             <div className="flex justify-end">
                <Button 
                    onClick={handleStylizeSubmit} 
                    disabled={!sourceImage || (!selectedStyleId && !refStyleImage && !prompt)} 
                    isLoading={isLoading}
                >
                  ПРИМЕНИТЬ СТИЛЬ
                </Button>
              </div>
          </div>
        );

      case AppMode.CLEANUP:
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="space-y-2">
                    <p className="text-sm font-mono text-torg-accent">ИСХОДНОЕ ИЗОБРАЖЕНИЕ</p>
                    <ImageUploader onImageSelect={setSourceImage} selectedImage={sourceImage} />
                </div>
                
                {sourceImage && (
                     <div className="p-4 border border-torg-purple/30 bg-torg-purple/5 rounded-lg">
                        <p className="text-sm text-gray-300 mb-4">
                            Загрузите изображение, затем перейдите в режим маскирования, чтобы выделить объекты для интеллектуального удаления.
                        </p>
                        <Button 
                            variant="secondary" 
                            onClick={() => setIsMasking(true)} 
                            className="w-full"
                        >
                            РЕЖИМ МАСКИРОВАНИЯ
                        </Button>
                     </div>
                )}
            </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-torg-black text-white selection:bg-torg-accent selection:text-torg-black flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-torg-accent to-torg-purple rounded-sm animate-pulse"></div>
            <h1 className="text-2xl font-extrabold tracking-tighter font-mono hidden md:block">
              GENA<span className="text-torg-accent">TORGOFF</span>.AI
            </h1>
            <h1 className="text-xl font-extrabold tracking-tighter font-mono md:hidden">
              GT<span className="text-torg-accent">.AI</span>
            </h1>
          </div>
          
          <nav className="flex bg-white/5 p-1 rounded-lg overflow-x-auto">
            {[
                { mode: AppMode.GENERATE, label: 'ГЕНЕРАЦИЯ' },
                { mode: AppMode.STYLIZE, label: 'СТИЛИЗАЦИЯ' },
                { mode: AppMode.CLEANUP, label: 'УДАЛЕНИЕ' },
            ].map((item) => (
                <button
                    key={item.mode}
                    onClick={() => handleModeSwitch(item.mode)}
                    className={`px-4 py-2 rounded text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                        mode === item.mode 
                        ? 'bg-white text-black shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    {item.label}
                </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-start p-4 md:p-8 max-w-6xl mx-auto w-full gap-8">
          
          {/* Input Panel */}
          <div className="w-full glass-panel p-6 md:p-8 rounded-xl border-t border-white/10 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-torg-accent via-torg-purple to-torg-accent opacity-50"></div>
             
             <h2 className="text-2xl font-black italic mb-6 flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
               {mode === AppMode.GENERATE && '/// СИНТЕЗ ИЗОБРАЖЕНИЯ ПО ТЕКСТУ'}
               {mode === AppMode.STYLIZE && '/// НЕЙРОННЫЙ ПЕРЕНОС СТИЛЯ'}
               {mode === AppMode.CLEANUP && '/// УМНОЕ УДАЛЕНИЕ ОБЪЕКТОВ'}
             </h2>

             {renderModeContent()}

             {error && (
              <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 text-red-200 rounded font-mono text-sm flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Output Panel */}
          {(generatedImage || isLoading) && !isMasking && (
            <div className="w-full glass-panel p-2 rounded-xl overflow-hidden min-h-[400px] flex flex-col relative border border-torg-accent/20">
              <div className="bg-black/40 border-b border-white/5 p-3 flex justify-between items-center">
                <span className="font-mono text-xs text-torg-accent">ТЕРМИНАЛ ВЫВОДА</span>
                {generatedImage && <span className="font-mono text-xs text-green-500">ГОТОВО</span>}
              </div>

              <div className="flex-grow flex items-center justify-center bg-black/20 relative p-4">
                {isLoading && !generatedImage && (
                    <div className="flex flex-col items-center justify-center gap-6">
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-torg-accent/20 border-t-torg-accent rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 bg-torg-purple rounded-full animate-ping"></div>
                            </div>
                        </div>
                        <p className="font-mono text-torg-accent text-sm tracking-widest animate-pulse">ОБРАБОТКА ВИЗУАЛЬНЫХ ДАННЫХ...</p>
                    </div>
                )}
                
                {generatedImage && (
                    <div className="relative w-full h-full flex items-center justify-center group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                        src={generatedImage} 
                        alt="Generated output" 
                        className="max-w-full h-auto max-h-[70vh] rounded shadow-2xl border border-white/10"
                    />
                    <div className="absolute bottom-4 flex gap-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                        <button 
                            onClick={handleEditResult}
                            className="bg-black/80 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-torg-purple hover:border-torg-purple transition-all shadow-lg flex items-center gap-2"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            РЕДАКТИРОВАТЬ
                        </button>

                        <a 
                        href={generatedImage} 
                        download={`genatorgoff-${Date.now()}.png`}
                        className="bg-torg-accent text-black px-6 py-3 rounded-full font-bold text-sm hover:bg-white transition-colors shadow-lg hover:shadow-torg-accent/50 flex items-center gap-2"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        СОХРАНИТЬ
                        </a>
                    </div>
                    </div>
                )}
              </div>
            </div>
          )}
      </main>
      
      <footer className="border-t border-white/5 py-8 mt-12 text-center">
        <p className="text-torg-accent font-mono text-xs mb-2">GENA TORGOFF AI SYSTEM V2.0</p>
        <p className="text-gray-600 text-xs font-mono">POWERED BY GEMINI 2.5 FLASH IMAGE</p>
      </footer>
    </div>
  );
};

export default App;