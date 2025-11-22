import { GoogleGenAI, Type } from "@google/genai";

// Initialize the client with the API key from the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash-image';
const ANALYSIS_MODEL_NAME = 'gemini-2.5-flash';

/**
 * Generates an image based on a text prompt.
 */
export const generateImageFromText = async (prompt: string, aspectRatio: string = '1:1'): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio
        }
      }
    });

    return parseImageResponse(response);
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
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
    parts.push({ text: `Transfer the artistic style of the second image to the first image. ${stylePrompt}` });
  } else {
    parts.push({ text: `Transform this image into the following style: ${stylePrompt}` });
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
 * Detects main objects in the image and returns their bounding boxes.
 */
export const detectObjects = async (sourceImage: string): Promise<Array<{ymin: number, xmin: number, ymax: number, xmax: number, label: string}>> => {
  try {
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
    return JSON.parse(text);
  } catch (error) {
    console.error("Error detecting objects:", error);
    throw error;
  }
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
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
    });
    return parseImageResponse(response);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseImageResponse = (response: any): string => {
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("Gemini не вернул вариантов генерации.");
  }

  const parts = candidates[0].content.parts;
  for (const part of parts) {
    if (part.inlineData) {
      const base64Str = part.inlineData.data;
      return `data:image/png;base64,${base64Str}`;
    }
  }

  const textPart = parts.find((p: any) => p.text);
  if (textPart) {
    throw new Error(`Модель вернула текст вместо изображения: ${textPart.text}`);
  }

  throw new Error("В ответе не найдено данных изображения.");
};
