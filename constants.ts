import { ApiProvider, ModelOption } from './types';

export const GEMINI_API_KEY_ENV_VAR = 'API_KEY'; // process.env.API_KEY
export const HUGGINGFACE_API_KEY_ENV_VAR = 'HUGGINGFACE_API_KEY';

// Text Models
export const GEMINI_1_5_PRO_LATEST_MODEL_ID = 'gemini-1.5-pro-latest';
export const GEMINI_1_5_FLASH_LATEST_MODEL_ID = 'gemini-1.5-flash-latest';
export const GEMINI_2_5_FLASH_PREVIEW_MODEL_ID = 'gemini-2.5-flash-preview-04-17';

// Image Generation Models
export const GEMINI_IMAGEN_MODEL_ID = 'imagen-3.0-generate-002';
export const GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID = 'gemini-2.0-flash-preview-image-generation';

// Multimodal Text Model (used for character analysis and general text generation)
// This constant is still useful as a primary default for character analysis.
export const GEMINI_MULTIMODAL_TEXT_MODEL_ID = 'gemini-2.5-flash-preview-04-17';


export const DEFAULT_TEXT_MODELS: ModelOption[] = [
  { id: GEMINI_2_5_FLASH_PREVIEW_MODEL_ID, name: `Gemini 2.5 Flash Preview (${GEMINI_2_5_FLASH_PREVIEW_MODEL_ID})`, provider: ApiProvider.GEMINI, isCharacterAnalyzer: true },
  { id: GEMINI_1_5_FLASH_LATEST_MODEL_ID, name: `Gemini 1.5 Flash Latest (${GEMINI_1_5_FLASH_LATEST_MODEL_ID})`, provider: ApiProvider.GEMINI, isCharacterAnalyzer: true },
  { id: GEMINI_1_5_PRO_LATEST_MODEL_ID, name: `Gemini 1.5 Pro Latest (${GEMINI_1_5_PRO_LATEST_MODEL_ID})`, provider: ApiProvider.GEMINI, isCharacterAnalyzer: true },
  { id: 'gpt2', name: 'GPT-2 (HuggingFace)', provider: ApiProvider.HUGGINGFACE },
  { id: 'bigscience/bloom', name: 'Bloom (HuggingFace)', provider: ApiProvider.HUGGINGFACE },
];

// Specific models suitable for character image analysis (multimodal text models)
// Now dynamically includes all Gemini text models marked as character analyzers.
export const CHARACTER_ANALYSIS_MODELS: ModelOption[] = DEFAULT_TEXT_MODELS.filter(
    model => model.provider === ApiProvider.GEMINI && model.isCharacterAnalyzer
).map(model => ({ ...model, name: `${model.name} (for Character Analysis)` }));

export const DEFAULT_IMAGE_MODELS: ModelOption[] = [
  { id: GEMINI_IMAGEN_MODEL_ID, name: `Gemini Imagen (${GEMINI_IMAGEN_MODEL_ID})`, provider: ApiProvider.GEMINI, isMultimodal: false },
  { id: GEMINI_MULTIMODAL_TEXT_MODEL_ID, name: `Use Gemini ${GEMINI_MULTIMODAL_TEXT_MODEL_ID} to Enhance Prompt for Imagen`, provider: ApiProvider.GEMINI, isMultimodal: false },
  { id: GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID, name: `Gemini Multimodal Image Gen (${GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID})`, provider: ApiProvider.GEMINI, isMultimodal: true },
  { id: 'stabilityai/stable-diffusion-2', name: 'Stable Diffusion 2 (HuggingFace)', provider: ApiProvider.HUGGINGFACE },
  { id: 'CompVis/stable-diffusion-v1-4', name: 'Stable Diffusion v1-4 (HuggingFace)', provider: ApiProvider.HUGGINGFACE },
];

export const POLLINATIONS_API_BASE_URL_IMAGE = 'https://image.pollinations.ai';
export const POLLINATIONS_API_BASE_URL_TEXT = 'https://text.pollinations.ai';

export const IMAGE_STYLES: string[] = [
  'Photorealistic', 'Anime', 'Comic Book Art', 'Fantasy Art', 'Sci-Fi Concept Art',
  'Impressionistic', 'Surreal', 'Minimalist', '3D Render', 'Pixel Art', 'Watercolor', 'Sketch'
];
export const COMIC_ERAS: string[] = ['Golden Age (1930s-50s)', 'Silver Age (1950s-70s)', 'Bronze Age (1970s-80s)', 'Modern Age (1980s-Present)', 'Futuristic'];
export const ASPECT_RATIOS: Record<string, { width: number; height: number, label: string }> = {
  '16:9': { width: 1024, height: 576, label: '16:9 (Widescreen)' },
  '4:3': { width: 1024, height: 768, label: '4:3 (Standard)' },
  '1:1': { width: 1024, height: 1024, label: '1:1 (Square)' },
  '3:4': { width: 768, height: 1024, label: '3:4 (Portrait)' },
  '9:16': { width: 576, height: 1024, label: '9:16 (Tall Portrait)' },
};

// Target resolution for Pollinations (longest side) for "high quality"
export const TARGET_POLLINATIONS_RESOLUTION = 3072;


export const MAX_PAGES = 200;
export const MIN_STORY_LENGTH = 10;
export const MAX_STORY_LENGTH = 10000;
export const MAX_CHAR_REF_IMAGES = 5;

export const DEFAULT_CONFIG_VALUES = {
  textModel: GEMINI_2_5_FLASH_PREVIEW_MODEL_ID,
  imageModel: GEMINI_IMAGEN_MODEL_ID,
  characterAnalysisModel: GEMINI_MULTIMODAL_TEXT_MODEL_ID, // Default character analyzer
  imageStyle: IMAGE_STYLES[0],
  comicEra: COMIC_ERAS[3],
  aspectRatio: '16:9',
  numPages: 3,
  includeCaptions: true,
  overlayText: false,
};