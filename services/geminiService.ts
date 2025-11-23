
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the client with the API key from the environment
// Note: For standard operations we use the default instance.
// For Upscaling (Gemini 3 Pro), we recreate the instance to ensure the user-selected key is used.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash-image';
const ANALYSIS_MODEL_NAME = 'gemini-2.5-flash';
const UPSCALE_MODEL_NAME = 'gemini-3-pro-image-preview';

const MAX_RETRIES = 5;
const BASE_DELAY = 2000;

/**
 * Helper to retry operations on 429 errors (Quota Exceeded)
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            const msg = error?.message || '';
            const status = error?.status || error?.code;
            
            // Check for 429 (Quota Exceeded) or 503 (Service Unavailable) inside object or string message
            const isQuotaError = 
                status === 429 || 
                status === 503 || 
                msg.includes('429') || 
                msg.includes('quota') || 
                msg.includes('RESOURCE_EXHAUSTED');
            
            if (isQuotaError && attempt < MAX_RETRIES) {
                // Exponential backoff with jitter to prevent thundering herd
                const delay = (BASE_DELAY * Math.pow(2, attempt)) + (Math.random() * 1000);
                console.warn(`[Gemini API] Quota hit (429/Resource Exhausted). Retrying in ${Math.round(delay)}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            break; 
        }
    }

    // Final error handling if retries failed
    const finalMsg = lastError?.message || '';
    if (finalMsg.includes('429') || finalMsg.includes('quota') || finalMsg.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("⚠️ Превышен лимит квоты API (429). Сервер перегружен. Пожалуйста, подождите 1-2 минуты и попробуйте снова.");
    }
    
    throw lastError;
}

/**
 * Generates an image based on a text prompt.
 */
export const generateImageFromText = async (prompt: string, aspectRatio: string = '1:1'): Promise<string> => {
  return withRetry(async () => {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            { text: `Generate a high-quality image of: ${prompt}` }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          },
          systemInstruction: "You are an advanced AI image generator. Your task is to generate images based on the user's prompt. Do not output text. Only output the generated image."
        }
      });

      return parseImageResponse(response);
  });
};

/**
 * Process an image with a generic prompt (standard edit).
 */
export const editImageWithPrompt = async (base64Image: string, prompt: string): Promise<string> => {
  return processMultiPartRequest([
    createImagePart(base64Image),
    { text: prompt }
  ]);
};

/**
 * Applies a style to an image, optionally using a reference image.
 */
export const stylizeImage = async (sourceImage: string, stylePrompt: string, refImage?: string): Promise<string> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [createImagePart(sourceImage)];
  
  if (refImage) {
    parts.push(createImagePart(refImage));
    parts.push({ text: `Transfer the artistic style of the second image to the first image. ${stylePrompt}. Return only the edited image.` });
  } else {
    parts.push({ text: `Transform this image into the following style: ${stylePrompt}. Return only the edited image.` });
  }

  return processMultiPartRequest(parts);
};

/**
 * Removes an object defined by a mask.
 * Note: 'markedImage' is the source image with red scribbles covering the object to remove.
 */
export const removeObjectWithMask = async (sourceImage: string, markedImage: string): Promise<string> => {
  const parts = [
    createImagePart(sourceImage),
    createImagePart(markedImage),
    { text: "The second image shows the first image with red markings. Remove the objects highlighted in red from the first image and inpaint the background to match the surroundings seamlessly. Return only the edited image." }
  ];

  return processMultiPartRequest(parts);
};

/**
 * Applies a specific style/edit to the masked area.
 */
export const applyStyleToMask = async (sourceImage: string, markedImage: string, prompt: string): Promise<string> => {
    const parts = [
      createImagePart(sourceImage),
      createImagePart(markedImage),
      { text: `The second image shows the first image with red markings. Edit the content highlighted in red in the first image to match this description: "${prompt}". Ensure the edits blend seamlessly with the surrounding original image. Return only the edited image.` }
    ];
    return processMultiPartRequest(parts);
};

/**
 * Removes background from the image (Transparent Mode).
 */
export const removeBackground = async (sourceImage: string): Promise<string> => {
    const parts = [
        createImagePart(sourceImage),
        { text: "Remove the background from this image. Extract the main subject and place it on a transparent background. Return the image in PNG format with an alpha channel. Ensure high precision on edges. Return only the image." }
    ];
    return processMultiPartRequest(parts);
};

/**
 * Replaces the background of the image based on a text prompt.
 */
export const replaceBackgroundWithText = async (sourceImage: string, prompt: string): Promise<string> => {
    const parts = [
        createImagePart(sourceImage),
        { text: `Keep the main subject of this image exactly as is, but replace the background with a scene described as: '${prompt}'. Adjust the lighting on the subject to match the new background naturally. Return only the edited image.` }
    ];
    return processMultiPartRequest(parts);
};

/**
 * Replaces the background of the source image with a provided background image.
 */
export const replaceBackgroundWithImage = async (foregroundImage: string, backgroundImage: string): Promise<string> => {
    const parts = [
        createImagePart(foregroundImage),
        createImagePart(backgroundImage),
        { text: "Composite the main subject from the first image onto the second image. The second image acts as the background. Scale and position the subject naturally within the new environment. Adjust lighting and shadows for a realistic blend. Return only the composite image." }
    ];
    return processMultiPartRequest(parts);
};

/**
 * Restores an old or damaged image.
 */
export const restoreImage = async (sourceImage: string, instructions?: string): Promise<string> => {
  const basePrompt = "Restore this old or damaged photo. Automatically fix scratches, tears, folds, noise and dust. Improve image clarity, sharpness, and detail.";
  const extraPrompt = instructions 
    ? ` Additional user instructions: "${instructions}".` 
    : " If the photo is black and white, subtly colorize it if appropriate or just enhance the contrast. Ensure faces are natural.";
  
  const parts = [
    createImagePart(sourceImage),
    { text: `${basePrompt}${extraPrompt} Return only the restored image.` }
  ];

  return processMultiPartRequest(parts);
};

/**
 * Upscales an image to 4K resolution using Gemini 3 Pro.
 * Requires User Selected API Key.
 */
export const upscaleImage = async (sourceImage: string): Promise<string> => {
    return withRetry(async () => {
        // Create a NEW instance to ensure we use the user-selected API key from the dialog
        const upscaleAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const response = await upscaleAi.models.generateContent({
            model: UPSCALE_MODEL_NAME,
            contents: {
                parts: [
                    createImagePart(sourceImage),
                    { text: "Upscale this image to 4K resolution. Enhance fine details, sharpen textures, improve lighting and reduce noise while strictly maintaining the original composition, colors, and subject identity. Return only the upscaled image." }
                ]
            },
            config: {
                imageConfig: {
                    imageSize: "4K" // Explicitly request 4K
                }
            }
        });

        return parseImageResponse(response);
    });
};

/**
 * Detects main objects in the image and returns their bounding boxes.
 */
export const detectObjects = async (sourceImage: string): Promise<Array<{ymin: number, xmin: number, ymax: number, xmax: number, label: string}>> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL_NAME,
      contents: {
        parts: [
          createImagePart(sourceImage),
          { text: "Detect the main foreground objects in this image that a user might want to remove or edit. Return their bounding boxes with coordinates normalized to 0-1000." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING, description: "The name of the object" },
              ymin: { type: Type.NUMBER, description: "Top coordinate (0-1000)" },
              xmin: { type: Type.NUMBER, description: "Left coordinate (0-1000)" },
              ymax: { type: Type.NUMBER, description: "Bottom coordinate (0-1000)" },
              xmax: { type: Type.NUMBER, description: "Right coordinate (0-1000)" },
            },
            required: ["label", "ymin", "xmin", "ymax", "xmax"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse detection JSON", e);
        return [];
    }
  });
};

/**
 * Mixes multiple images based on inputs.
 */
export interface MixInput {
    base64: string;
    label?: string;
}

export const mixImages = async (inputs: MixInput[], prompt: string): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];
    
    // We will structure it as: [Image1, "Label/Context", Image2, "Label/Context", Instruction]
    
    inputs.forEach((input) => {
        parts.push(createImagePart(input.base64));
        if (input.label) {
            parts.push({ text: `Reference for: ${input.label}` });
        }
    });

    parts.push({ text: `${prompt}. Return only the combined image.` });

    return processMultiPartRequest(parts);
};


// --- Helpers ---

const createImagePart = (base64Data: string) => {
  const data = base64Data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
  const mimeMatch = base64Data.match(/^data:(image\/[a-zA-Z]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

  return {
    inlineData: {
      data,
      mimeType
    }
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processMultiPartRequest = async (parts: any[]): Promise<string> => {
  return withRetry(async () => {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts },
        config: {
           systemInstruction: "You are an advanced AI image editor. Your task is to edit or transform images based on user instructions. Always return the resulting image. Do not provide conversational text."
        }
      });
      return parseImageResponse(response);
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseImageResponse = (response: any): string => {
  if (!response) {
    throw new Error("Получен пустой ответ от API.");
  }

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    if (response.promptFeedback && response.promptFeedback.blockReason) {
        throw new Error(`Запрос заблокирован: ${response.promptFeedback.blockReason}`);
    }
    throw new Error("Gemini не вернул вариантов генерации.");
  }

  const candidate = candidates[0];
  
  // Robust check for content presence
  if (!candidate.content) {
      const finishReason = candidate.finishReason;
      if (finishReason) {
          const reasons: Record<string, string> = {
              'SAFETY': 'Заблокировано фильтрами безопасности.',
              'RECITATION': 'Обнаружено цитирование.',
              'OTHER': 'Иная причина завершения.',
              'IMAGE_SAFETY': 'Изображение заблокировано фильтрами безопасности.',
              'IMAGE_OTHER': 'Не удалось сгенерировать изображение. Попробуйте изменить запрос или использовать другое изображение.'
          };
          throw new Error(`Генерация прервана. Причина: ${reasons[finishReason] || finishReason}`);
      }
      throw new Error("Модель вернула ответ без контента.");
  }

  const parts = candidate.content.parts;
  
  if (!parts || parts.length === 0) {
      throw new Error("Ответ модели содержит пустой список элементов.");
  }

  for (const part of parts) {
    if (part.inlineData) {
      const base64Str = part.inlineData.data;
      return `data:image/png;base64,${base64Str}`;
    }
  }

  const textPart = parts.find((p: any) => p.text);
  if (textPart) {
    // Only throw if no image was found in the previous loop
    throw new Error(`Модель вернула текст вместо изображения: "${textPart.text.slice(0, 100)}..."`);
  }

  throw new Error("В ответе не найдено данных изображения.");
};
