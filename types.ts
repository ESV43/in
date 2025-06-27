export interface CharacterReference {
  id: string;
  name: string;
  images: { id: string; base64: string; file: File }[];
  detailedTextDescription?: string; // For AI-generated textual description
}

export interface PanelContent {
  sceneDescription: string;
  dialogueOrCaption: string;
}

export interface GeneratedPanel extends PanelContent {
  id:string;
  imageUrl?: string; 
  imageError?: string;
  isGenerating?: boolean;
}

export interface ComicConfig {
  storyScript: string;
  // geminiApiKey is read from process.env, not a user input field in the form
  textModel: string;
  imageModel: string;
  characterAnalysisModel?: string; // For analyzing character references if imageModel is not directly multimodal
  imageStyle: string;
  comicEra: string;
  aspectRatio: string;
  numPages: number;
  includeCaptions: boolean;
  overlayText: boolean;
  seed: number;
}

export enum ApiProvider {
  GEMINI = 'Gemini',
  POLLINATIONS = 'Pollinations',
  HUGGINGFACE = 'HuggingFace', // Added Hugging Face provider
}

export interface ModelOption {
  id: string;
  name: string;
  provider: ApiProvider;
  isMultimodal?: boolean; // For image models that can take image inputs
  isCharacterAnalyzer?: boolean; // For text models that can analyze images for description
  generationParams?: { // For Pollinations specific params
    width?: number;
    height?: number;
  }
}

// For Pollinations API responses
export interface PollinationsModel {
  [key: string]: { // Model name is the key
    name?: string; 
    image?: boolean; 
    parameters?: {
      width?: string; // e.g. "1024"
      height?: string; // e.g. "1024"
    }
  }
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

export interface LocalCandidate {
  groundingMetadata?: GroundingMetadata;
  content?: { parts?: { text?: string; inlineData?: { data: string; mimeType: string } }[] };
}

export interface GenerateContentResponse {
  text: string;
  candidates?: LocalCandidate[];
}

export interface GenerateContentResponseWithMetadata extends GenerateContentResponse {}

export interface GenerateImageResponse {
 generatedImages: {
    image: {
      imageBytes: string; 
    };
  }[];
}