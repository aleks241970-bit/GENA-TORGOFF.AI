
import React, { useState, useEffect, useCallback } from 'react';
import { AppMode, StylePreset } from './types';
import { generateImageFromText, stylizeImage, removeObjectWithMask, applyStyleToMask, removeBackground, upscaleImage, restoreImage } from './services/geminiService';
import { Button } from './components/Button';
import { ImageUploader } from './components/ImageUploader';
import { MaskEditor } from './components/MaskEditor';
import { MixerMode } from './components/MixerMode';
import { RemoveBgMode } from './components/RemoveBgMode';
import { CompareSlider } from './components/CompareSlider';

// Interface for AI Studio global object
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}

const STYLE_PRESETS: StylePreset[] = [
  { id: 'cyberpunk', name: 'Киберпанк', promptSuffix: 'cyberpunk, neon lights, futuristic city, high contrast' },
  { id: 'anime', name: 'Аниме', promptSuffix: 'anime style, studio ghibli, vibrant colors, cel shaded' },
  { id: 'impressionism', name: 'Импрессионизм', promptSuffix: 'impressionist oil painting, claude monet style, visible brush strokes' },
  { id: 'cubism', name: 'Кубизм', promptSuffix: 'cubism style, picasso, geometric shapes, abstract' },
  { id: 'watercolor', name: 'Акварель', promptSuffix: 'watercolor painting, artistic, soft edges, bleeding colors' },
  { id: 'pixel', name: 'Пиксель-арт', promptSuffix: 'pixel art, 8-bit, retro game style' },
];

const CLEANUP_STEPS = [
    { threshold: 15, label: "СКАНИРОВАНИЕ ГЕОМЕТРИИ" },
    { threshold: 40, label: "АНАЛИЗ КОНТЕКСТА" },
    { threshold: 65, label: "УДАЛЕНИЕ ОБЪЕКТА" },
    { threshold: 85, label: "СИНТЕЗ ФОНА" },
    { threshold: 100, label: "ФИНАЛИЗАЦИЯ" }
];

const TECH_LOGS = [
    "INITIALIZING_NEURAL_UPLINK...",
    "ALLOCATING_VRAM_BUFFERS...",
    "QUANTIZING_TENSORS...",
    "SYNTHESIZING_PIXELS...",
    "OPTIMIZING_GRADIENTS...",
    "APPLYING_AESTHETIC_WEIGHTS...",
    "RENDERING_FINAL_OUTPUT..."
];

const UPSCALE_LOGS = [
    "LOADING_GEMINI_PRO_VISION...",
    "ANALYZING_MICRO_DETAILS...",
    "RECONSTRUCTING_TEXTURES...",
    "ENHANCING_RESOLUTION_4K...",
    "DENOISING_SIGNAL...",
    "SHARPENING_EDGES...",
    "FINALIZING_HIGH_RES_OUTPUT..."
];

// --- Prompt Helpers Data ---
const RANDOM_PROMPTS = [
    "A futuristic city floating in the clouds, waterfalls cascading down, soft golden sunset lighting, high detail, 8k",
    "Portrait of a cyborg geisha with neon circuitry face, traditional kimono made of fiber optics, dark background, cyberpunk style",
    "An astronaut discovering an ancient glowing artifact on Mars, dust storm in background, cinematic lighting",
    "A cozy isometric room with plants and a sleeping cat, lo-fi aesthetic, pastel colors, soft shadows",
    "A dragon made of crystal and lightning, storm clouds, epic scale, hyperrealistic",
    "A retro 1980s synthwave highway, purple sunset, palm trees, grid lines, outrun style"
];

const PROMPT_TAGS = {
    style: ['Cyberpunk', 'Photorealistic', 'Oil Painting', '3D Render', 'Anime', 'Minimalist'],
    light: ['Neon Lights', 'Golden Hour', 'Cinematic Lighting', 'Volumetric Fog', 'Soft Light'],
    camera: ['Wide Angle', 'Macro', 'Bokeh', '4k', 'Fisheye'],
    vibe: ['Dark', 'Vibrant', 'Ethereal', 'Melancholic', 'Epic']
};

// Helper Component for Navigation Items
interface NavItemProps {
    mode: AppMode;
    currentMode: AppMode;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    desc: string;
    shortcut?: string;
}

const NavItem: React.FC<NavItemProps> = ({ mode, currentMode, onClick, icon, label, desc, shortcut }) => {
    const isActive = mode === currentMode;
    return (
      <button
          onClick={onClick}
          className={`w-full text-left p-3 rounded-xl transition-all duration-300 group relative overflow-hidden mb-2 border ${
              isActive 
              ? 'bg-torg-accent/10 border-torg-accent text-white shadow-[0_0_20px_rgba(212,255,0,0.3),inset_0_0_10px_rgba(212,255,0,0.1)] backdrop-blur-sm' 
              : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white hover:border-white/5'
          }`}
      >
          {isActive && (
            <>
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-torg-accent shadow-[0_0_15px_#D4FF00]"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-torg-accent/20 to-transparent opacity-30"></div>
            </>
          )}
          <div className="flex items-center gap-3 relative z-10">
              <div className={`${isActive ? 'text-torg-accent drop-shadow-[0_0_8px_rgba(212,255,0,0.8)]' : 'text-gray-500 group-hover:text-torg-accent transition-colors'}`}>
                  {icon}
              </div>
              <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <div className={`font-bold font-mono text-sm leading-none mb-1 ${isActive ? 'text-white text-shadow-[0_0_10px_rgba(255,255,255,0.5)]' : ''}`}>{label}</div>
                    {shortcut && (
                        <span className={`text-[9px] font-mono border rounded px-1 transition-colors ${
                            isActive ? 'border-torg-accent/50 text-torg-accent shadow-[0_0_5px_rgba(212,255,0,0.5)] bg-black/40' : 'border-white/10 text-gray-600'
                        }`}>
                            {shortcut}
                        </span>
                    )}
                  </div>
                  <div className={`text-[10px] leading-tight font-mono ${isActive ? 'text-torg-accent/80' : 'text-gray-600 group-hover:text-gray-400'}`}>
                      {desc}
                  </div>
              </div>
          </div>
      </button>
    );
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.GENERATE);
  
  // State
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [refStyleImage, setRefStyleImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  
  // Cleanup & Partial Style Mode Specific
  const [isMasking, setIsMasking] = useState(false);
  const [maskImage, setMaskImage] = useState<string | null>(null); // For partial style

  // Loading Animation State
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let logInterval: ReturnType<typeof setInterval>;

    const activeLogs = isUpscaling ? UPSCALE_LOGS : TECH_LOGS;

    if (isLoading) {
      setLoadingProgress(0);
      setLogIndex(0);

      interval = setInterval(() => {
        setLoadingProgress((prev) => {
          // Simulation: Fast at first, slows down as it approaches 100%
          if (prev >= 99) return prev;
          const remaining = 99 - prev;
          const step = Math.max(0.1, remaining * 0.05) + (Math.random() * 0.5);
          return prev + step;
        });
      }, 100);

      logInterval = setInterval(() => {
          setLogIndex(prev => (prev + 1) % activeLogs.length);
      }, 450); // Slightly slower for readability

    } else {
      setLoadingProgress(100);
    }
    return () => {
        clearInterval(interval);
        clearInterval(logInterval);
    };
  }, [isLoading, isUpscaling]);

  // --- Actions ---

  const handleGenerateSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setIsUpscaling(false);
    setError(null);
    setGeneratedImage(null);

    try {
      const result = await generateImageFromText(prompt, aspectRatio);
      setGeneratedImage(result);
      setSourceImage(result); // Auto-set as source for subsequent edits
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Ошибка генерации.");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, aspectRatio]);

  const handleStylizeSubmit = useCallback(async () => {
    if (!sourceImage) {
      setError("Пожалуйста, загрузите исходное изображение.");
      return;
    }
    
    const selectedPreset = STYLE_PRESETS.find(s => s.id === selectedStyleId);
    if (!selectedPreset && !refStyleImage && !prompt) {
        setError("Пожалуйста, выберите стиль, загрузите референс или введите описание.");
        return;
    }

    const styleDescription = [
        selectedPreset?.promptSuffix,
        prompt
    ].filter(Boolean).join(', ');

    setIsLoading(true);
    setIsUpscaling(false);
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
  }, [sourceImage, selectedStyleId, refStyleImage, prompt]);

  const handleMaskConfirm = async (maskBase64: string) => {
    if (!sourceImage) return;
    
    setIsMasking(false); // Hide editor
    
    if (mode === AppMode.CLEANUP) {
        setIsLoading(true);
        setIsUpscaling(false);
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
    } else if (mode === AppMode.PARTIAL_STYLE) {
        setMaskImage(maskBase64);
    }
  };

  const handlePartialStyleSubmit = useCallback(async () => {
      if (!sourceImage || !maskImage) {
          setError("Необходимо исходное изображение и выделенная область.");
          return;
      }

      const selectedPreset = STYLE_PRESETS.find(s => s.id === selectedStyleId);
      if (!selectedPreset && !prompt) {
          setError("Введите описание или выберите стиль.");
          return;
      }

      const stylePrompt = [
          selectedPreset?.promptSuffix,
          prompt
      ].filter(Boolean).join(', ');

      setIsLoading(true);
      setIsUpscaling(false);
      setError(null);
      setGeneratedImage(null);

      try {
          const result = await applyStyleToMask(sourceImage, maskImage, stylePrompt);
          setGeneratedImage(result);
      } catch (err) {
          console.error(err);
          setError(err instanceof Error ? err.message : "Ошибка локальной стилизации.");
      } finally {
          setIsLoading(false);
      }
  }, [sourceImage, maskImage, selectedStyleId, prompt]);

  const handleRestoreSubmit = useCallback(async () => {
      if (!sourceImage) {
          setError("Пожалуйста, загрузите исходное изображение для реставрации.");
          return;
      }

      setIsLoading(true);
      setIsUpscaling(false);
      setError(null);
      setGeneratedImage(null);

      try {
          const result = await restoreImage(sourceImage, prompt);
          setGeneratedImage(result);
      } catch (err) {
          console.error(err);
          setError(err instanceof Error ? err.message : "Ошибка реставрации.");
      } finally {
          setIsLoading(false);
      }
  }, [sourceImage, prompt]);

  // Generic handler for complex components like MixerMode and RemoveBgMode
  const handleComplexGenerate = async (promise: Promise<string>) => {
      setIsLoading(true);
      setIsUpscaling(false);
      setError(null);
      setGeneratedImage(null);

      try {
          const result = await promise;
          setGeneratedImage(result);
      } catch (err) {
          console.error(err);
          setError(err instanceof Error ? err.message : "Ошибка обработки.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleUpscale = async () => {
    if (!generatedImage) return;

    setIsLoading(true);
    setIsUpscaling(true);
    setError(null);

    try {
        // 1. Check for API Key (Required for Gemini 3 Pro)
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await window.aistudio.openSelectKey();
                // Simple race condition mitigation: Assuming success if dialog closes without error
                // A real impl might re-check, but for now we proceed.
            }
        }

        // 2. Call Upscale Service
        const upscaled = await upscaleImage(generatedImage);
        setGeneratedImage(upscaled);
        setSourceImage(upscaled); // Update source to the high-res version
    } catch (err) {
        console.error(err);
        if (err instanceof Error && err.message.includes("Requested entity was not found")) {
             // Handle key selection failure retry
             if (window.aistudio) await window.aistudio.openSelectKey();
             setError("Ошибка авторизации ключа. Попробуйте снова.");
        } else {
             setError(err instanceof Error ? err.message : "Ошибка увеличения разрешения.");
        }
    } finally {
        setIsLoading(false);
        setIsUpscaling(false);
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
    setMaskImage(null);
  };

  const handleSmartEdit = (targetMode: AppMode) => {
    if (generatedImage) {
      setSourceImage(generatedImage);
      handleModeSwitch(targetMode);
    }
  };

  const handleSurpriseMe = () => {
      const randomPrompt = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
      setPrompt(randomPrompt);
  };

  const handleAddTag = (tag: string) => {
      setPrompt(prev => {
          const trimmed = prev.trim();
          if (!trimmed) return tag;
          if (trimmed.endsWith(',')) return `${trimmed} ${tag}`;
          return `${trimmed}, ${tag}`;
      });
  };

  // --- Keyboard Shortcuts ---

  const triggerPrimaryAction = useCallback(() => {
    if (isLoading || isMasking) return;

    switch (mode) {
        case AppMode.GENERATE:
            handleGenerateSubmit();
            break;
        case AppMode.STYLIZE:
            handleStylizeSubmit();
            break;
        case AppMode.PARTIAL_STYLE:
            if (maskImage) handlePartialStyleSubmit();
            break;
        case AppMode.REMOVE_BG:
             // RemoveBgMode handles its own execution
            break;
        case AppMode.RESTORATION:
            handleRestoreSubmit();
            break;
        // MixerMode handles its own execution since it has internal state
        case AppMode.MIX:
            break; 
        case AppMode.CLEANUP:
             if (!isMasking && sourceImage) setIsMasking(true);
             break;
    }
  }, [mode, isLoading, isMasking, handleGenerateSubmit, handleStylizeSubmit, handlePartialStyleSubmit, handleRestoreSubmit, maskImage, sourceImage]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // Ignore if focus is in an input field (unless it's a modifier combo like Ctrl+Enter)
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        
        // Navigation Shortcuts (Alt + 1-7)
        if (e.altKey && !isInput) {
            switch(e.key) {
                case '1': handleModeSwitch(AppMode.GENERATE); break;
                case '2': handleModeSwitch(AppMode.STYLIZE); break;
                case '3': handleModeSwitch(AppMode.PARTIAL_STYLE); break;
                case '4': handleModeSwitch(AppMode.MIX); break;
                case '5': handleModeSwitch(AppMode.CLEANUP); break;
                case '6': handleModeSwitch(AppMode.REMOVE_BG); break;
                case '7': handleModeSwitch(AppMode.RESTORATION); break;
            }
        }

        // Execution Shortcut (Ctrl + Enter)
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            triggerPrimaryAction();
        }

        // Cancel / Back (Esc)
        if (e.key === 'Escape') {
            if (isMasking) setIsMasking(false);
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [triggerPrimaryAction, isMasking]);


  // --- Render Helpers ---

  const getModeTitle = () => {
      switch (mode) {
          case AppMode.GENERATE: return 'СИНТЕЗ ИЗОБРАЖЕНИЯ';
          case AppMode.STYLIZE: return 'НЕЙРОННАЯ СТИЛИЗАЦИЯ';
          case AppMode.PARTIAL_STYLE: return 'ЛОКАЛЬНАЯ ТРАНСФОРМАЦИЯ';
          case AppMode.MIX: return 'МУЛЬТИМОДАЛЬНЫЙ МИКСЕР';
          case AppMode.CLEANUP: return 'ИНТЕЛЛЕКТУАЛЬНОЕ УДАЛЕНИЕ';
          case AppMode.REMOVE_BG: return 'УПРАВЛЕНИЕ ФОНОМ';
          case AppMode.RESTORATION: return 'AI РЕСТАВРАЦИЯ';
          default: return 'GENA TORGOFF AI';
      }
  };

  const getModeDescription = () => {
      switch (mode) {
          case AppMode.GENERATE: return 'Создание высококачественных изображений по текстовому описанию с использованием Gemini 2.5.';
          case AppMode.STYLIZE: return 'Перенос художественного стиля на ваши изображения с сохранением композиции.';
          case AppMode.PARTIAL_STYLE: return 'Использование кисти для выделения областей и их изменения с помощью текстовых команд.';
          case AppMode.MIX: return 'Творческое объединение персонажей, объектов и окружения в единую сцену.';
          case AppMode.CLEANUP: return 'Удаление нежелательных объектов из сцены с автоматическим заполнением фона.';
          case AppMode.REMOVE_BG: return 'Комплексные инструменты для работы с фоном: удаление, генерация нового или замена на фото.';
          case AppMode.RESTORATION: return 'Восстановление старых или поврежденных фото: удаление шума, царапин, улучшение четкости и цвета.';
          default: return '';
      }
  };

  const renderModeContent = () => {
    if (isMasking && sourceImage) {
        return (
            <MaskEditor 
                imageSrc={sourceImage} 
                onConfirm={handleMaskConfirm}
                onCancel={() => setIsMasking(false)}
                instructionText={
                    mode === AppMode.PARTIAL_STYLE 
                    ? "Область, выделенная красным, будет изменена в соответствии с вашим запросом." 
                    : "Область, выделенная красным, будет удалена и перегенерирована."
                }
            />
        );
    }

    switch (mode) {
      case AppMode.GENERATE:
        return (
          <form onSubmit={handleGenerateSubmit} className="space-y-6 animate-fade-in">
             {/* Visual Aspect Ratio Selector */}
             <div className="space-y-3">
                <p className="text-sm font-mono text-gray-400 uppercase tracking-widest">Геометрия кадра</p>
                <div className="flex flex-wrap gap-3">
                    {[
                        { label: '1:1', w: 24, h: 24, desc: 'SQUARE' },
                        { label: '16:9', w: 32, h: 18, desc: 'LANDSCAPE' },
                        { label: '9:16', w: 18, h: 32, desc: 'PORTRAIT' },
                        { label: '4:3', w: 28, h: 21, desc: 'CLASSIC' },
                        { label: '3:4', w: 21, h: 28, desc: 'VERTICAL' }
                    ].map((ratio) => (
                        <button
                            key={ratio.label}
                            type="button"
                            onClick={() => setAspectRatio(ratio.label)}
                            className={`flex flex-col items-center justify-center gap-2 px-3 py-3 rounded-xl border transition-all min-w-[80px] ${
                                aspectRatio === ratio.label
                                ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)] scale-105'
                                : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30 hover:bg-white/5'
                            }`}
                        >
                            {/* Visual Box */}
                            <div className="h-8 flex items-center justify-center w-10">
                                <div 
                                    className={`border-2 transition-all duration-300 ${aspectRatio === ratio.label ? 'border-black bg-black/10' : 'border-gray-500'}`}
                                    style={{ 
                                        width: `${ratio.w}px`, 
                                        height: `${ratio.h}px` 
                                    }}
                                ></div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold font-mono text-xs">{ratio.label}</div>
                            </div>
                        </button>
                    ))}
                </div>
             </div>

             {/* Interactive Prompt Area */}
             <div className="space-y-3">
                <div className="flex justify-between items-end">
                    <p className="text-sm font-mono text-gray-400 uppercase tracking-widest">Промпт-инженер</p>
                    <button 
                        type="button"
                        onClick={handleSurpriseMe}
                        className="text-xs font-mono text-torg-accent hover:text-white transition-colors flex items-center gap-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        СГЕНЕРИРОВАТЬ ИДЕЮ
                    </button>
                </div>
                
                <div className="relative group">
                    <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Опишите вашу мечту..."
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-lg focus:border-torg-accent focus:ring-1 focus:ring-torg-accent outline-none resize-none h-40 font-mono text-white placeholder-gray-600 transition-all group-hover:bg-black/80 shadow-inner"
                    />
                    <div className="absolute bottom-3 right-3 text-[10px] text-gray-600 font-mono bg-black/50 px-2 py-1 rounded border border-white/5">
                        {prompt.length} CHARS
                    </div>
                </div>

                {/* Tag Boosters */}
                <div className="flex flex-wrap gap-2 animate-fade-in">
                    {Object.entries(PROMPT_TAGS).map(([category, tags]) => (
                        <div key={category} className="flex items-center gap-2 mr-4 mb-2">
                            <span className="text-[10px] font-mono text-gray-500 uppercase">{category}:</span>
                            {tags.map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => handleAddTag(tag)}
                                    className="px-2 py-1 rounded border border-white/10 bg-white/5 text-[10px] font-mono text-gray-300 hover:border-torg-accent hover:text-torg-accent hover:bg-torg-accent/10 transition-all"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
              </div>

              <div className="flex justify-end items-center gap-4 pt-4 border-t border-white/5">
                <span className="text-xs font-mono text-gray-500 hidden md:block">
                    [CTRL + ENTER]
                </span>
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
                    <ImageUploader onImageSelect={setSourceImage} selectedImage={sourceImage} className="h-48" />
                 </div>
                 <div className="space-y-2">
                    <p className="text-sm font-mono text-gray-400">РЕФЕРЕНС СТИЛЯ (ОПЦИОНАЛЬНО)</p>
                    <ImageUploader onImageSelect={setRefStyleImage} selectedImage={refStyleImage} className="h-48" />
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

             <div className="flex justify-end items-center gap-4">
                <span className="text-xs font-mono text-gray-500 hidden md:block">
                    [CTRL + ENTER]
                </span>
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
                     <div className="p-6 border border-torg-purple/30 bg-torg-purple/5 rounded-lg flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-torg-purple/20 rounded-full flex items-center justify-center mb-3 text-torg-purple">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <p className="text-sm text-gray-300 mb-4 max-w-md">
                            Перейдите в режим маскирования, чтобы выделить объекты, которые необходимо удалить. Нейросеть автоматически дорисует фон.
                        </p>
                        <Button 
                            variant="secondary" 
                            onClick={() => setIsMasking(true)} 
                        >
                            ОТКРЫТЬ РЕДАКТОР МАСКИ
                        </Button>
                     </div>
                )}
            </div>
        );

      case AppMode.PARTIAL_STYLE:
          return (
             <div className="space-y-6 animate-fade-in">
                <div className="space-y-2">
                    <p className="text-sm font-mono text-torg-accent">ИСХОДНОЕ ИЗОБРАЖЕНИЕ</p>
                    <ImageUploader onImageSelect={(img) => { setSourceImage(img); setMaskImage(null); }} selectedImage={sourceImage} />
                </div>
                
                {sourceImage && !maskImage && (
                     <div className="p-6 border border-blue-500/30 bg-blue-500/5 rounded-lg flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-3 text-blue-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </div>
                        <p className="text-sm text-gray-300 mb-4">
                            Выделите область изображения, которую хотите изменить или стилизовать.
                        </p>
                        <Button 
                            variant="secondary" 
                            onClick={() => setIsMasking(true)} 
                        >
                            ВЫБРАТЬ ОБЛАСТЬ (КИСТЬ)
                        </Button>
                     </div>
                )}

                {sourceImage && maskImage && (
                     <div className="space-y-6 border-t border-white/10 pt-6 animate-fade-in">
                        <div className="flex items-center justify-between bg-green-900/20 p-3 rounded border border-green-500/20">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <p className="text-green-400 font-mono text-sm font-bold">МАСКА АКТИВНА</p>
                            </div>
                            <button 
                                onClick={() => setIsMasking(true)}
                                className="text-xs text-gray-400 hover:text-white underline font-mono"
                            >
                                [ИЗМЕНИТЬ]
                            </button>
                        </div>

                        <div className="space-y-2">
                             <p className="text-sm font-mono text-gray-400">СТИЛЬ ОБЛАСТИ (ПРЕСЕТ)</p>
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
                                placeholder="Опишите, что должно появиться в выделенной области..."
                                className="w-full bg-black/40 border border-white/10 rounded p-3 font-mono text-sm focus:border-torg-accent outline-none"
                             />
                        </div>
                        
                        <div className="flex justify-end items-center gap-4">
                            <span className="text-xs font-mono text-gray-500 hidden md:block">
                                [CTRL + ENTER]
                            </span>
                            <Button 
                                onClick={handlePartialStyleSubmit} 
                                disabled={!selectedStyleId && !prompt}
                                isLoading={isLoading}
                            >
                                ПРИМЕНИТЬ ЛОКАЛЬНО
                            </Button>
                        </div>
                     </div>
                )}
            </div>
          );
        
      case AppMode.MIX:
          return <MixerMode onGenerate={handleComplexGenerate} />;
          
      case AppMode.REMOVE_BG:
          return <RemoveBgMode onGenerate={handleComplexGenerate} />;
          
      case AppMode.RESTORATION:
          return (
              <div className="space-y-6 animate-fade-in">
                  <div className="space-y-2">
                      <p className="text-sm font-mono text-amber-400 uppercase tracking-wider">ИСХОДНОЕ ИЗОБРАЖЕНИЕ</p>
                      <ImageUploader 
                        onImageSelect={setSourceImage} 
                        selectedImage={sourceImage} 
                        className="h-64 border-amber-400/20 hover:border-amber-400/50"
                        placeholder="Загрузите старое или поврежденное фото"
                      />
                  </div>

                   <div className="p-6 border border-amber-500/20 bg-amber-500/5 rounded-lg flex flex-col gap-4">
                        <div className="flex items-center gap-3 text-amber-500">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="font-bold font-mono">НАСТРОЙКИ РЕСТАВРАЦИИ</h3>
                        </div>
                        <p className="text-sm text-gray-400">
                             Нейросеть автоматически устранит шум, царапины и размытость. Вы можете добавить уточнения.
                        </p>
                        <div className="relative">
                            <input
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Например: 'Сделать цветным', 'Усилить резкость лиц'..."
                                className="w-full bg-black/40 border border-white/10 rounded p-3 font-mono text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none text-white placeholder-gray-600"
                            />
                        </div>
                   </div>

                  <div className="flex justify-end items-center gap-4 pt-4 border-t border-white/5">
                      <span className="text-xs font-mono text-gray-500 hidden md:block">
                          [CTRL + ENTER]
                      </span>
                      <Button 
                        onClick={handleRestoreSubmit} 
                        disabled={!sourceImage} 
                        isLoading={isLoading}
                        className="bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                      >
                          РЕСТАВРИРОВАТЬ
                      </Button>
                  </div>
              </div>
          );
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-torg-black text-white selection:bg-torg-accent selection:text-torg-black font-sans overflow-hidden relative">
      
       {/* Ambient Background */}
       <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-torg-purple/10 rounded-full blur-[150px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-torg-accent/5 rounded-full blur-[150px]"></div>
      </div>

      {/* SIDEBAR */}
      <aside className="w-full md:w-72 bg-black/40 backdrop-blur-xl border-b md:border-b-0 md:border-r border-white/10 flex flex-col z-50 flex-shrink-0 md:h-screen glass-panel">
        <div className="p-6 flex items-center gap-4 border-b border-white/5 bg-white/5">
          <div className="w-12 h-12 bg-gradient-to-br from-torg-accent to-torg-purple rounded-md shadow-[0_0_20px_rgba(212,255,0,0.4)]"></div>
          <div>
              <h1 className="text-2xl font-extrabold tracking-tighter font-mono leading-none">
              GENA<span className="text-torg-accent">TORGOFF</span>
              </h1>
              <span className="text-xs text-gray-500 font-mono tracking-[0.2em]">AI WORKSTATION</span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-4 px-2 mt-2">Инструментарий</p>
          
          <NavItem 
             mode={AppMode.GENERATE} 
             currentMode={mode} 
             onClick={() => handleModeSwitch(AppMode.GENERATE)}
             label="ГЕНЕРАЦИЯ"
             desc="Text-to-Image"
             shortcut="Alt+1"
             icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
             }
          />
          <NavItem 
             mode={AppMode.STYLIZE} 
             currentMode={mode} 
             onClick={() => handleModeSwitch(AppMode.STYLIZE)}
             label="СТИЛИЗАЦИЯ"
             desc="Image-to-Image"
             shortcut="Alt+2"
             icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
             }
          />
          <NavItem 
             mode={AppMode.PARTIAL_STYLE} 
             currentMode={mode} 
             onClick={() => handleModeSwitch(AppMode.PARTIAL_STYLE)}
             label="ЛОКАЛЬНО"
             desc="Inpainting"
             shortcut="Alt+3"
             icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
             }
          />
          <NavItem 
             mode={AppMode.MIX} 
             currentMode={mode} 
             onClick={() => handleModeSwitch(AppMode.MIX)}
             label="СМЕШИВАНИЕ"
             desc="Multimodal Mix"
             shortcut="Alt+4"
             icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
             }
          />
          <NavItem 
             mode={AppMode.CLEANUP} 
             currentMode={mode} 
             onClick={() => handleModeSwitch(AppMode.CLEANUP)}
             label="УДАЛЕНИЕ"
             desc="Smart Erase"
             shortcut="Alt+5"
             icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
             }
          />
          <NavItem 
             mode={AppMode.REMOVE_BG} 
             currentMode={mode} 
             onClick={() => handleModeSwitch(AppMode.REMOVE_BG)}
             label="УПРАВЛЕНИЕ ФОНОМ"
             desc="Bg Control"
             shortcut="Alt+6"
             icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
             }
          />
          <NavItem 
             mode={AppMode.RESTORATION} 
             currentMode={mode} 
             onClick={() => handleModeSwitch(AppMode.RESTORATION)}
             label="РЕСТАВРАЦИЯ"
             desc="AI Restore"
             shortcut="Alt+7"
             icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
             }
          />
        </nav>
        
        <div className="p-6 border-t border-white/5 bg-white/5">
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                <span>STATUS:</span>
                <span className="text-green-500">ONLINE</span>
            </div>
            <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-torg-purple/50 animate-pulse"></div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-[9px] font-mono text-gray-600">
                <div>ALT + 1-7 : NAV</div>
                <div className="text-right">CTRL + ENTER : RUN</div>
            </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative z-10 h-full scroll-smooth">
          <div className="max-w-6xl mx-auto p-4 md:p-12 space-y-8 min-h-full flex flex-col pb-32">
             
             {/* Page Header */}
             <header className="mb-4">
                 <div className="flex items-center gap-4 mb-2">
                    <h2 className="text-3xl md:text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
                        {getModeTitle()}
                    </h2>
                    <div className="h-px flex-grow bg-gradient-to-r from-white/20 to-transparent"></div>
                 </div>
                 <p className="text-gray-400 font-mono text-sm md:max-w-2xl">
                    {getModeDescription()}
                 </p>
             </header>

             {/* INPUT PANEL */}
             <div className="glass-panel p-6 md:p-8 rounded-xl border-t border-white/10 relative overflow-hidden shadow-2xl backdrop-blur-2xl">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-torg-accent via-torg-purple to-torg-accent opacity-50"></div>
                 
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

             {/* OUTPUT PANEL */}
             {(generatedImage || isLoading) && !isMasking && (
                <div className="glass-panel p-2 rounded-xl overflow-hidden min-h-[500px] flex flex-col relative border border-torg-accent/20 shadow-2xl">
                  <div className="bg-black/40 border-b border-white/5 p-3 flex justify-between items-center z-10 relative">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${generatedImage ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                        <span className="font-mono text-xs text-torg-accent tracking-widest">TERMINAL_OUTPUT_V2</span>
                    </div>
                    {generatedImage && <span className="font-mono text-xs text-green-500">[COMPLETE]</span>}
                  </div>
    
                  <div className="flex-grow flex items-center justify-center bg-black/20 relative p-4 overflow-hidden">
                    {isLoading && !generatedImage && (
                         <div className="flex flex-col items-center justify-center w-full h-full absolute inset-0 bg-black/90 backdrop-blur-md z-20">
                            
                            {/* CLEANUP MODE SPECIFIC LOADER */}
                            {mode === AppMode.CLEANUP ? (
                                <div className="max-w-sm w-full space-y-4 font-mono">
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2 border-b border-white/10 pb-2">
                                        <span>TASK: OBJECT_REMOVAL</span>
                                        <span>{Math.round(loadingProgress)}%</span>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {CLEANUP_STEPS.map((step, idx) => {
                                            const isCompleted = loadingProgress >= step.threshold;
                                            const isCurrent = !isCompleted && (idx === 0 || loadingProgress >= CLEANUP_STEPS[idx-1].threshold);
                                            
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className={`flex items-center gap-3 p-3 rounded border transition-all ${
                                                        isCompleted 
                                                        ? 'bg-green-900/10 border-green-500/20 text-green-500' 
                                                        : isCurrent 
                                                            ? 'bg-torg-purple/10 border-torg-purple/40 text-white shadow-[0_0_10px_rgba(110,68,255,0.2)]' 
                                                            : 'bg-transparent border-transparent text-gray-600'
                                                    }`}
                                                >
                                                    <div className="w-5 h-5 flex items-center justify-center">
                                                        {isCompleted ? (
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        ) : isCurrent ? (
                                                            <div className="w-2 h-2 bg-torg-accent rounded-full animate-ping"></div>
                                                        ) : (
                                                            <div className="w-1.5 h-1.5 bg-gray-700 rounded-full"></div>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-bold tracking-widest">{step.label}</span>
                                                    {isCurrent && (
                                                        <span className="ml-auto text-[10px] animate-pulse text-torg-accent">...</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="w-full h-0.5 bg-gray-800 rounded-full overflow-hidden mt-6">
                                        <div 
                                            className="h-full bg-gradient-to-r from-torg-accent to-torg-purple transition-all duration-300 ease-out"
                                            style={{ width: `${loadingProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ) : (
                                /* FUTURISTIC LOADER FOR OTHER MODES */
                                <div className="flex flex-col items-center justify-center relative">
                                    {/* Orbital Rings */}
                                    <div className="relative w-48 h-48 flex items-center justify-center mb-8">
                                        {/* Outer Ring */}
                                        <div className="absolute inset-0 border-t-2 border-l-2 border-torg-accent/30 rounded-full animate-spin duration-[3s]"></div>
                                        {/* Middle Ring */}
                                        <div className="absolute inset-4 border-b-2 border-r-2 border-torg-purple/40 rounded-full animate-spin-reverse duration-[4s]"></div>
                                        {/* Inner Ring */}
                                        <div className="absolute inset-8 border-t-2 border-white/20 rounded-full animate-spin duration-[2s]"></div>
                                        
                                        {/* Core Glow */}
                                        <div className="w-24 h-24 bg-torg-accent/5 rounded-full blur-xl animate-pulse"></div>
                                        
                                        {/* Center Percentage */}
                                        <div className="absolute inset-0 flex items-center justify-center flex-col z-10">
                                            <span className="text-5xl font-black font-mono text-white tracking-tighter">
                                                {Math.round(loadingProgress)}%
                                            </span>
                                            <span className="text-[10px] text-gray-500 font-mono tracking-[0.2em] mt-1">PROCESSING</span>
                                        </div>
                                    </div>

                                    {/* Segmented Progress Bar */}
                                    <div className="flex gap-1 mb-4 w-64 justify-center">
                                        {Array.from({ length: 20 }).map((_, i) => (
                                            <div 
                                                key={i} 
                                                className={`h-3 w-2 rounded-sm transition-all duration-300 ${
                                                    i < (loadingProgress / 5) 
                                                    ? 'bg-torg-accent shadow-[0_0_5px_rgba(212,255,0,0.5)]' 
                                                    : 'bg-white/5'
                                                }`}
                                            ></div>
                                        ))}
                                    </div>

                                    {/* Cycling Tech Logs */}
                                    <div className="h-6 overflow-hidden text-center">
                                        <p className="font-mono text-xs text-torg-purple animate-pulse tracking-widest uppercase">
                                            {`> ${isUpscaling ? UPSCALE_LOGS[logIndex] : TECH_LOGS[logIndex]}`}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {generatedImage && !isLoading && (
                        <div className="relative w-full h-full flex items-center justify-center group animate-fade-in">
                            
                            {/* Compare Slider Integration */}
                            {mode !== AppMode.GENERATE && sourceImage ? (
                                <CompareSlider 
                                    original={sourceImage}
                                    modified={generatedImage}
                                    className="max-w-full h-auto max-h-[70vh] shadow-2xl border border-white/10"
                                />
                            ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img 
                                    src={generatedImage} 
                                    alt="Generated output" 
                                    className="max-w-full h-auto max-h-[70vh] rounded shadow-2xl border border-white/10"
                                />
                            )}

                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0 shadow-[0_0_30px_rgba(0,0,0,0.5)] z-30 max-w-[95%] overflow-x-auto scrollbar-hide">
                                
                                <button 
                                    onClick={() => handleSmartEdit(AppMode.STYLIZE)}
                                    className="flex flex-col items-center justify-center w-12 h-12 rounded-xl hover:bg-white/10 text-gray-300 hover:text-torg-accent transition-all group/btn relative"
                                    title="Стилизация"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span className="text-[8px] font-mono uppercase tracking-wider">EDIT</span>
                                </button>

                                <button 
                                    onClick={() => handleSmartEdit(AppMode.PARTIAL_STYLE)}
                                    className="flex flex-col items-center justify-center w-12 h-12 rounded-xl hover:bg-white/10 text-gray-300 hover:text-torg-accent transition-all group/btn"
                                    title="Частичное редактирование"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                    </svg>
                                    <span className="text-[8px] font-mono uppercase tracking-wider">MASK</span>
                                </button>

                                <button 
                                    onClick={() => handleSmartEdit(AppMode.CLEANUP)}
                                    className="flex flex-col items-center justify-center w-12 h-12 rounded-xl hover:bg-white/10 text-gray-300 hover:text-torg-accent transition-all group/btn"
                                    title="Удаление объектов"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span className="text-[8px] font-mono uppercase tracking-wider">ERASE</span>
                                </button>
                                
                                <button 
                                    onClick={() => handleSmartEdit(AppMode.REMOVE_BG)}
                                    className="flex flex-col items-center justify-center w-12 h-12 rounded-xl hover:bg-white/10 text-gray-300 hover:text-torg-accent transition-all group/btn"
                                    title="Удалить фон"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" />
                                    </svg>
                                    <span className="text-[8px] font-mono uppercase tracking-wider">CUT</span>
                                </button>

                                <div className="w-px h-8 bg-white/10 mx-1"></div>
                                
                                {/* Upscale Button */}
                                <button 
                                    onClick={handleUpscale}
                                    disabled={isUpscaling}
                                    className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-black bg-cyan-400 hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                                    title="Увеличить разрешение (4K)"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    <span className="text-[8px] font-mono uppercase tracking-wider font-bold">4K</span>
                                </button>

                                <a 
                                href={generatedImage} 
                                download={`genatorgoff-${Date.now()}.png`}
                                className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-torg-accent text-black hover:bg-white transition-colors shadow-[0_0_15px_rgba(212,255,0,0.3)]"
                                title="Скачать"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span className="text-[8px] font-mono uppercase tracking-wider font-bold">SAVE</span>
                                </a>
                            </div>
                        </div>
                    )}
                  </div>
                </div>
             )}
          </div>
      </main>
    </div>
  );
};

export default App;
