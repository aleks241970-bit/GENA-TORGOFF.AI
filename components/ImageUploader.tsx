
import React, { useRef } from 'react';

interface ImageUploaderProps {
  onImageSelect: (base64: string) => void;
  selectedImage: string | null;
  className?: string; // Added for flexible styling
  placeholder?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  onImageSelect, 
  selectedImage, 
  className = "h-64", // Default height
  placeholder = "Загрузить изображение"
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, загрузите корректный файл изображения.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onImageSelect(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full h-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      
      <div 
        onClick={triggerFileInput}
        className={`
          w-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all
          ${selectedImage 
            ? 'border-torg-accent bg-torg-dark/50' 
            : 'border-white/20 hover:border-white/40 hover:bg-white/5'
          }
          ${className}
        `}
      >
        {selectedImage ? (
          <div className="relative w-full h-full p-2 flex items-center justify-center overflow-hidden group">
             {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedImage} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain rounded shadow-lg"
            />
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-torg-accent font-mono font-bold text-xs text-center p-2">ЗАМЕНИТЬ</p>
            </div>
          </div>
        ) : (
          <div className="text-center p-4">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-300 font-medium text-xs md:text-sm">{placeholder}</p>
          </div>
        )}
      </div>
    </div>
  );
};
