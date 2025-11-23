
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { ImageUploader } from './ImageUploader';
import { mixImages, MixInput } from '../services/geminiService';

interface MixerModeProps {
  onGenerate: (promise: Promise<string>) => void;
}

type SubMode = 'STRUCTURED' | 'CREATIVE';

export const MixerMode: React.FC<MixerModeProps> = ({ onGenerate }) => {
  const [subMode, setSubMode] = useState<SubMode>('STRUCTURED');

  // Structured State
  const [envImage, setEnvImage] = useState<string | null>(null);
  const [charImage, setCharImage] = useState<string | null>(null);
  const [objImage, setObjImage] = useState<string | null>(null);

  // Creative State
  const [creativeImages, setCreativeImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');

  const handleStructuredSubmit = useCallback(() => {
    if (!envImage && !charImage && !objImage) {
        alert("Пожалуйста, добавьте хотя бы одно изображение.");
        return;
    }

    const inputs: MixInput[] = [];
    if (envImage) inputs.push({ base64: envImage, label: "Background Environment/Scenery" });
    if (charImage) inputs.push({ base64: charImage, label: "Main Character/Subject" });
    if (objImage) inputs.push({ base64: objImage, label: "Key Object/Item" });

    const finalPrompt = "Generate a cohesive, high-quality image that blends these visual elements seamlessly. Respect the composition implied by the labels (environment background, character in foreground, object interaction).";
    
    onGenerate(mixImages(inputs, finalPrompt));
  }, [envImage, charImage, objImage, onGenerate]);

  const handleCreativeSubmit = useCallback(() => {
    if (creativeImages.length === 0) {
        alert("Пожалуйста, загрузите изображения для смешивания.");
        return;
    }
    if (!prompt.trim()) {
        alert("Пожалуйста, опишите, как смешать изображения.");
        return;
    }

    const inputs: MixInput[] = creativeImages.map(img => ({ base64: img }));
    const finalPrompt = `Combine these images creatively based on the following instruction: ${prompt}. Create a single unified composition.`;

    onGenerate(mixImages(inputs, finalPrompt));
  }, [creativeImages, prompt, onGenerate]);

  // Keyboard shortcut listener for MixerMode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (subMode === 'STRUCTURED') {
                handleStructuredSubmit();
            } else {
                handleCreativeSubmit();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [subMode, handleStructuredSubmit, handleCreativeSubmit]);


  const addCreativeImage = (base64: string) => {
      setCreativeImages([...creativeImages, base64]);
  };

  const removeCreativeImage = (index: number) => {
      const newImages = [...creativeImages];
      newImages.splice(index, 1);
      setCreativeImages(newImages);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sub-mode Toggle */}
      <div className="flex justify-center mb-6">
         <div className="bg-black/40 p-1 rounded-lg border border-white/10 flex">
            <button
                onClick={() => setSubMode('STRUCTURED')}
                className={`px-6 py-2 rounded font-mono text-sm font-bold transition-all ${
                    subMode === 'STRUCTURED' 
                    ? 'bg-torg-accent text-black shadow-[0_0_10px_rgba(212,255,0,0.3)]' 
                    : 'text-gray-400 hover:text-white'
                }`}
            >
                СТРУКТУРА (СЛОТЫ)
            </button>
            <button
                onClick={() => setSubMode('CREATIVE')}
                className={`px-6 py-2 rounded font-mono text-sm font-bold transition-all ${
                    subMode === 'CREATIVE' 
                    ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.3)]' 
                    : 'text-gray-400 hover:text-white'
                }`}
            >
                ТВОРЧЕСТВО (ФРИСТАЙЛ)
            </button>
         </div>
      </div>

      {subMode === 'STRUCTURED' ? (
        <div className="space-y-6">
            <p className="text-center text-gray-400 text-sm max-w-lg mx-auto">
                Загрузите компоненты для создания сцены. Нейросеть объединит окружение, персонажа и объект в единую композицию.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <p className="text-torg-accent font-mono text-xs uppercase tracking-wider text-center">Окружение</p>
                    <ImageUploader 
                        onImageSelect={setEnvImage} 
                        selectedImage={envImage} 
                        className="h-48 bg-black/30"
                        placeholder="Фон / Локация"
                    />
                </div>
                <div className="space-y-2">
                    <p className="text-torg-purple font-mono text-xs uppercase tracking-wider text-center">Персонаж</p>
                    <ImageUploader 
                        onImageSelect={setCharImage} 
                        selectedImage={charImage} 
                        className="h-48 bg-black/30"
                        placeholder="Герой / Существо"
                    />
                </div>
                <div className="space-y-2">
                    <p className="text-blue-400 font-mono text-xs uppercase tracking-wider text-center">Объект</p>
                    <ImageUploader 
                        onImageSelect={setObjImage} 
                        selectedImage={objImage} 
                        className="h-48 bg-black/30"
                        placeholder="Предмет / Артефакт"
                    />
                </div>
            </div>
            <div className="flex justify-center items-center gap-4 pt-4">
                <span className="text-xs font-mono text-gray-500 hidden md:block">
                    [CTRL + ENTER]
                </span>
                <Button 
                    onClick={handleStructuredSubmit} 
                    disabled={!envImage && !charImage && !objImage}
                    className="w-full md:w-1/2"
                >
                    СИНТЕЗИРОВАТЬ СЦЕНУ
                </Button>
            </div>
        </div>
      ) : (
        <div className="space-y-6">
            <p className="text-center text-gray-400 text-sm max-w-lg mx-auto">
                Загрузите любое количество изображений и опишите, что вы хотите получить в итоге.
            </p>
            
            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {creativeImages.map((img, index) => (
                    <div key={index} className="relative group aspect-square border border-white/20 rounded overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={`Input ${index}`} className="w-full h-full object-cover" />
                        <button 
                            onClick={() => removeCreativeImage(index)}
                            className="absolute top-2 right-2 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                ))}
                
                {/* Add Button */}
                <div className="aspect-square">
                     <ImageUploader 
                        onImageSelect={addCreativeImage} 
                        selectedImage={null}
                        className="h-full bg-white/5 border-dashed border-white/30"
                        placeholder="+ Добавить"
                     />
                </div>
            </div>

            <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Пример: Смешай стиль первого изображения с композицией второго. Сделай результат похожим на сюрреалистичную картину..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-sm focus:border-torg-accent focus:ring-1 focus:ring-torg-accent outline-none resize-none h-32 font-mono text-gray-300 placeholder-gray-600 transition-all"
                />
            </div>

             <div className="flex justify-end items-center gap-4">
                <span className="text-xs font-mono text-gray-500 hidden md:block">
                    [CTRL + ENTER]
                </span>
                <Button onClick={handleCreativeSubmit} disabled={creativeImages.length === 0 || !prompt}>
                  СМЕШАТЬ
                </Button>
              </div>
        </div>
      )}
    </div>
  );
};
