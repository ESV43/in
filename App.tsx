import React, { useState, useCallback, useEffect } from 'react';
import ConfigForm from './components/ConfigForm';
import ComicPanel from './components/ComicPanel';
import LoadingSpinner from './components/LoadingSpinner';
import {
  ComicConfig, CharacterReference, GeneratedPanel, PanelContent,
  ApiProvider, ModelOption, GenerateContentResponseWithMetadata, GenerateImageResponse
} from './types';
import { generateTextWithGemini, generateImageWithGemini, analyzeCharacterWithGemini } from './services/geminiService';
import { getPollinationsTextModels, getPollinationsImageModels, generateTextWithPollinations, generateImageWithPollinations } from './services/pollinationsService';
import { getHuggingFaceTextModels, getHuggingFaceImageModels, generateTextWithHuggingFace, generateImageWithHuggingFace } from './services/huggingfaceService';
import { downloadComicAsPDF } from './services/pdfService';
import {
  ASPECT_RATIOS, GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID, GEMINI_MULTIMODAL_TEXT_MODEL_ID,
  DEFAULT_IMAGE_MODELS, DEFAULT_TEXT_MODELS, GEMINI_API_KEY_ENV_VAR, CHARACTER_ANALYSIS_MODELS
} from './constants';

const App: React.FC = () => {
  const [config, setConfig] = useState<ComicConfig | null>(null);
  const [characters, setCharacters] = useState<CharacterReference[]>([]);
  const [panels, setPanels] = useState<GeneratedPanel[]>([]);
  const [isGeneratingComic, setIsGeneratingComic] = useState<boolean>(false);
  const [isGeneratingInitialPanels, setIsGeneratingInitialPanels] = useState<boolean>(false);
  const [isAnalyzingCharacters, setIsAnalyzingCharacters] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(process.env[GEMINI_API_KEY_ENV_VAR] || '');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const [allTextModels, setAllTextModels] = useState<ModelOption[]>(DEFAULT_TEXT_MODELS);
  const [allImageModels, setAllImageModels] = useState<ModelOption[]>(DEFAULT_IMAGE_MODELS);
  const [allAnalysisModels, setAllAnalysisModels] = useState<ModelOption[]>(CHARACTER_ANALYSIS_MODELS);
  const [overallProgress, setOverallProgress] = useState<string>('');

  useEffect(() => {
    const fetchAllModels = async () => {
      try {
        const [pollinationsText, pollinationsImage, huggingfaceText, huggingfaceImage] = await Promise.all([
          getPollinationsTextModels(),
          getPollinationsImageModels(),
          getHuggingFaceTextModels(),
          getHuggingFaceImageModels()
        ]);
        
        const combinedTextModels = [...DEFAULT_TEXT_MODELS];
        const existingTextModelIds = new Set(DEFAULT_TEXT_MODELS.map(m => m.id));
        [...pollinationsText, ...huggingfaceText].forEach(pt => {
          if (!existingTextModelIds.has(pt.id)) {
            combinedTextModels.push(pt);
          }
        });
        setAllTextModels(combinedTextModels);

        const combinedImageModels = [...DEFAULT_IMAGE_MODELS];
        const existingImageModelIds = new Set(DEFAULT_IMAGE_MODELS.map(m => m.id));
        [...pollinationsImage, ...huggingfaceImage].forEach(pi => {
          if (!existingImageModelIds.has(pi.id)) {
            combinedImageModels.push(pi);
          }
        });
        setAllImageModels(combinedImageModels);
        setAllAnalysisModels(CHARACTER_ANALYSIS_MODELS); 

      } catch (e) {
        console.error("Failed to load Pollinations models", e);
        setError("Could not load models from Pollinations.ai. Only default models will be available.");
      }
    };
    fetchAllModels();
  }, []);
  
  const validateApiKey = () => {
      if (!apiKey) {
          const keyError = 'A Gemini API Key is required. Please enter one in the field above or set it as an environment variable.';
          setApiKeyError(keyError);
          return false;
      }
      setApiKeyError(null);
      return true;
  }

  const getAspectRatioClass = (aspectRatioKey: string): string => {
    switch (aspectRatioKey) {
      case '16:9': return 'aspect-video';
      case '4:3': return 'aspect-[4/3]';
      case '1:1': return 'aspect-square';
      case '3:4': return 'aspect-[3/4]';
      case '9:16': return 'aspect-[9/16]';
      default: return 'aspect-video';
    }
  };

  const generateAllPanelContents = async (currentConfig: ComicConfig, currentCharacters: CharacterReference[]): Promise<PanelContent[]> => {
    setError(null);
    setIsGeneratingInitialPanels(true);
    setOverallProgress('Generating panel descriptions and dialogues...');

    const characterDetails = currentCharacters.map(c => {
      let imageInfo = c.images.length > 0 ? ` with ${c.images.length} reference image(s)` : '';
      let descInfo = (c.detailedTextDescription && c.detailedTextDescription.trim() !== "") ? ` (textual description available)` : '';
      return `${c.name}${imageInfo}${descInfo}`;
    }).join(', ');
    
    const charPromptPart = currentCharacters.length > 0 ? `\n\nReferenced Characters: ${characterDetails}. If these characters are mentioned in a panel, ensure their descriptions are consistent with any provided image references or generated textual descriptions. If using a multimodal image model that accepts images, these references might be passed directly.` : '';

    const systemInstructionPart1 = `You are an expert comic scriptwriter. Your task is to break down the following story into ${currentConfig.numPages} distinct comic panels. For each panel, provide a "sceneDescription" (visual details for the artist, including character actions, expressions, and setting) and a "dialogueOrCaption". The "dialogueOrCaption" MUST contain the speech for characters, thoughts, sound effects, or narrator text for the panel. If there is no direct speech, provide a brief narrator's caption describing the moment or setting the scene. Do not leave "dialogueOrCaption" empty unless absolutely no text is suitable for the panel; in such rare cases, use " " (a single space). ${charPromptPart} `;
    const systemInstructionPart2 = `Your response MUST be a valid JSON array of objects, where each object has keys "sceneDescription" and "dialogueOrCaption". Do NOT include any explanatory text, comments, markdown, or any characters whatsoever before the opening '[' or after the closing ']' of the JSON array. ONLY THE JSON ARRAY. `;
    const systemInstructionPart3 = `Example: [{"sceneDescription": "A hero stands on a cliff", "dialogueOrCaption": "I must save the city!"}]`;
    const systemInstruction = systemInstructionPart1 + systemInstructionPart2 + systemInstructionPart3;
    
    const userPrompt = `Story Script: """${currentConfig.storyScript}"""\n\nGenerate ${currentConfig.numPages} panels.`;

    let rawTextResponse: string = "";
    let jsonStr: string = "";

    try {
      const selectedTextModel = allTextModels.find(m => m.id === currentConfig.textModel);

      if (selectedTextModel?.provider === ApiProvider.GEMINI) {
        if (!validateApiKey()) {
            throw new Error(apiKeyError || "Gemini API key is not configured.");
        }
        const response: GenerateContentResponseWithMetadata = await generateTextWithGemini(
          apiKey,
          currentConfig.textModel,
          userPrompt,
          systemInstruction
        );
        rawTextResponse = response.text;
      } else if (selectedTextModel?.provider === ApiProvider.POLLINATIONS) {
        const fullPollinationsPrompt = `${systemInstruction}\n\n${userPrompt}\n\nReturn ONLY THE JSON array.`;
        rawTextResponse = await generateTextWithPollinations(currentConfig.textModel, fullPollinationsPrompt);
      } else if (selectedTextModel?.provider === ApiProvider.HUGGINGFACE) {
        rawTextResponse = await generateTextWithHuggingFace(currentConfig.textModel, `${systemInstruction}\n\n${userPrompt}`);
      } else {
        throw new Error(`Unknown text model provider for ${currentConfig.textModel}`);
      }

      jsonStr = rawTextResponse.trim();
      
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      try {
        const parsedPanelsAttempt1 = JSON.parse(jsonStr) as PanelContent[];
         if (!Array.isArray(parsedPanelsAttempt1) || !parsedPanelsAttempt1.every(p => p.sceneDescription && (typeof p.dialogueOrCaption !== 'undefined'))) {
            throw new Error("AI did not return valid panel data structure in initial parse.");
        }
        const processedPanels = parsedPanelsAttempt1.map(p => ({
            ...p,
            dialogueOrCaption: (p.dialogueOrCaption === null || p.dialogueOrCaption === undefined || p.dialogueOrCaption.trim() === "") ? " " : p.dialogueOrCaption,
        }));

        setOverallProgress('Panel content generated. Starting image generation...');
        return processedPanels.slice(0, currentConfig.numPages);
      } catch (parseError1) {
        console.warn("Initial JSON.parse failed. Attempting more aggressive extraction.", parseError1);
        console.log("String after markdown fence removal (Attempt 1):", jsonStr);

        const firstBracket = jsonStr.indexOf('[');
        const lastBracket = jsonStr.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
        } else {
          const firstBrace = jsonStr.indexOf('{');
          const lastBrace = jsonStr.lastIndexOf('}');
           if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace && jsonStr.trim().startsWith("{") && jsonStr.trim().endsWith("}")) {
             console.warn("Extracted content looks like a single object, wrapping in array.");
             jsonStr = `[${jsonStr}]`;
           } else {
             throw parseError1;
           }
        }
      }
      let parsedPanels = JSON.parse(jsonStr) as PanelContent[];
      if (!Array.isArray(parsedPanels) || !parsedPanels.every(p => p.sceneDescription && (typeof p.dialogueOrCaption !== 'undefined'))) {
        throw new Error("AI did not return valid panel data. Expected an array of {sceneDescription, dialogueOrCaption}.");
      }
      
      parsedPanels = parsedPanels.map(p => ({
        ...p,
        dialogueOrCaption: (p.dialogueOrCaption === null || p.dialogueOrCaption === undefined || p.dialogueOrCaption.trim() === "") ? " " : p.dialogueOrCaption,
      }));

      setOverallProgress('Panel content generated. Starting image generation...');
      return parsedPanels.slice(0, currentConfig.numPages);

    } catch (e: any) {
      console.error("Error generating panel content:", e);
      setError(`Failed to generate panel content: ${e.message}. Check console for the AI's raw response.`);
      throw e;
    } finally {
        setIsGeneratingInitialPanels(false);
    }
  };

  const generateImageForPanel = async (panelToProcess: GeneratedPanel, panelIndex: number, currentConfig: ComicConfig, currentCharacters: CharacterReference[]) => {
    setPanels(prevPanels => prevPanels.map((p, idx) => idx === panelIndex ? { ...p, isGenerating: true, imageError: undefined } : p));
    setOverallProgress(`Generating image for panel ${panelIndex + 1} of ${currentConfig.numPages}...`);

    let imagePrompt = panelToProcess.sceneDescription;
    imagePrompt += ` Comic Era: ${currentConfig.comicEra}.`;
    
    const selectedImageModelDetails = allImageModels.find(m => m.id === currentConfig.imageModel);

    if (currentConfig.imageStyle === "Photorealistic") {
        if (selectedImageModelDetails?.provider === ApiProvider.POLLINATIONS) {
            imagePrompt += ` Style: Photorealistic.`;
        } else {
            imagePrompt += ` Style: Photorealistic (ultra-realistic details, photographic quality, sharp focus, lifelike textures, natural lighting).`;
        }
    } else {
        imagePrompt += ` Style: ${currentConfig.imageStyle}.`;
    }
    
    if (currentConfig.overlayText && selectedImageModelDetails?.provider === ApiProvider.POLLINATIONS && panelToProcess.dialogueOrCaption && panelToProcess.dialogueOrCaption.trim() !== "") {
        imagePrompt += ` The following text should appear on the image: "${panelToProcess.dialogueOrCaption.trim()}".`;
    }

    let referenceImageBlobs: { data: string; mimeType: string }[] | undefined = undefined;

    if (currentConfig.imageModel === GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID && currentCharacters.length > 0) {
        referenceImageBlobs = [];
        for (const char of currentCharacters) {
            const charNameRegex = new RegExp(`\\b${char.name}\\b`, 'i');
            if (charNameRegex.test(panelToProcess.sceneDescription) || charNameRegex.test(panelToProcess.dialogueOrCaption)) {
                if(char.images.length > 0) {
                    imagePrompt += ` Featuring ${char.name} (refer to provided images for appearance).`;
                    char.images.forEach(img => referenceImageBlobs!.push({ data: img.base64.split(',')[1], mimeType: img.file.type }));
                } else {
                     imagePrompt += ` Featuring ${char.name}.`;
                }
            }
        }
        if(referenceImageBlobs.length === 0) referenceImageBlobs = undefined;
    } else if (currentCharacters.length > 0) {
        currentCharacters.forEach(char => {
            const charNameRegex = new RegExp(`\\b${char.name}\\b`, 'i');
            if (charNameRegex.test(panelToProcess.sceneDescription) || charNameRegex.test(panelToProcess.dialogueOrCaption)) {
                if (char.detailedTextDescription && char.detailedTextDescription.trim() !== "") {
                    imagePrompt += ` Important Character: ${char.name}. Description: "${char.detailedTextDescription.trim()}". It is CRUCIAL that ${char.name} in this image strictly matches this description.`;
                } else {
                    imagePrompt += ` Featuring ${char.name}.`; 
                }
            }
        });
    }

    try {
      let imageUrl: string;
      const highQualityGemini = selectedImageModelDetails?.provider === ApiProvider.GEMINI;

      if (selectedImageModelDetails?.provider === ApiProvider.GEMINI) {
         if (!validateApiKey()) {
            throw new Error(apiKeyError || "Gemini API key is not configured.");
        }
        const geminiResponse: GenerateImageResponse = await generateImageWithGemini(
          apiKey,
          currentConfig.imageModel,
          imagePrompt,
          1,
          currentConfig.seed,
          ASPECT_RATIOS[currentConfig.aspectRatio],
          referenceImageBlobs,
          'image/png',
          highQualityGemini
        );
        if (!geminiResponse.generatedImages || geminiResponse.generatedImages.length === 0 || !geminiResponse.generatedImages[0].image.imageBytes) {
            throw new Error("Gemini image generation did not return image data.");
        }
        imageUrl = `data:image/png;base64,${geminiResponse.generatedImages[0].image.imageBytes}`;
      
      } else if (selectedImageModelDetails?.provider === ApiProvider.POLLINATIONS) {
        imageUrl = await generateImageWithPollinations(
          currentConfig.imageModel,
          imagePrompt,
          currentConfig.seed,
          currentConfig.aspectRatio
        );
      } else if (selectedImageModelDetails?.provider === ApiProvider.HUGGINGFACE) {
        imageUrl = await generateImageWithHuggingFace(currentConfig.imageModel, imagePrompt);
      } else {
        throw new Error(`Unknown image model provider for ${currentConfig.imageModel}`);
      }
      setPanels(prevPanels => prevPanels.map((p, idx) => idx === panelIndex ? { ...p, imageUrl, isGenerating: false } : p));
    } catch (e: any) {
      console.error(`Error generating image for panel ${panelIndex + 1}:`, e);
      setPanels(prevPanels => prevPanels.map((p, idx) => idx === panelIndex ? { ...p, imageError: e.message, isGenerating: false } : p));
    }
  };

  const handleConfigSubmit = async (submittedConfig: ComicConfig, submittedCharacters: CharacterReference[]) => {
    setConfig(submittedConfig);
    setCharacters(submittedCharacters); 
    setPanels([]);
    setError(null);
    setApiKeyError(null);

    const usesGemini = submittedConfig.textModel.includes('gemini') || 
                       submittedConfig.imageModel.includes('gemini') ||
                       (submittedCharacters.some(c => c.images.length > 0) && submittedConfig.characterAnalysisModel);
    
    if (usesGemini && !validateApiKey()) {
        setIsGeneratingComic(false);
        return;
    }

    setIsGeneratingComic(true);
    let charactersWithDescriptions = [...submittedCharacters]; 

    const needsCharacterAnalysis = submittedCharacters.some(c => c.images.length > 0) &&
                                submittedConfig.imageModel !== GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID &&
                                submittedConfig.characterAnalysisModel;

    if (needsCharacterAnalysis) {
        setIsAnalyzingCharacters(true);
        setOverallProgress('Analyzing character reference images...');
        try {
            for (let i = 0; i < charactersWithDescriptions.length; i++) {
                const char = charactersWithDescriptions[i];
                if (char.images.length > 0 && submittedConfig.characterAnalysisModel) {
                     setOverallProgress(`Analyzing character: ${char.name}...`);
                    const base64Images = char.images.map(img => ({ data: img.base64.split(',')[1], mimeType: img.file.type }));
                    const description = await analyzeCharacterWithGemini(apiKey, submittedConfig.characterAnalysisModel, char.name, base64Images);
                    charactersWithDescriptions[i] = { ...char, detailedTextDescription: description };
                }
            }
            setCharacters(charactersWithDescriptions); 
        } catch (e: any) {
            setError(`Failed to analyze characters: ${e.message}.`);
        } finally {
            setIsAnalyzingCharacters(false);
        }
    }

    setOverallProgress('Initializing comic generation...');

    try {
      const panelContents = await generateAllPanelContents(submittedConfig, charactersWithDescriptions);
      
      const initialGeneratedPanels: GeneratedPanel[] = panelContents.map((content, index) => ({
        id: `${Date.now()}-${index}`,
        ...content,
        isGenerating: true,
      }));
      setPanels(initialGeneratedPanels);

      for (let i = 0; i < initialGeneratedPanels.length; i++) {
        await generateImageForPanel(initialGeneratedPanels[i], i, submittedConfig, charactersWithDescriptions);
      }
      setOverallProgress('Comic generation complete!');
    } catch (e) {
      if (!error && e instanceof Error) { 
        setError(`Comic generation failed: ${e.message}. Check console for details.`);
      } else if (!error) {
        setError("An unknown error occurred during comic generation. Check console.");
      }
    } finally {
      setIsGeneratingComic(false);
      setIsGeneratingInitialPanels(false);
      setIsAnalyzingCharacters(false);
    }
  };

  const handleDownloadPdf = () => {
    if (panels.length === 0 || panels.some(p => p.isGenerating)) {
      alert('Please wait for all panels to generate or ensure there are panels to download.');
      return;
    }
    const title = config?.storyScript.substring(0, 30).replace(/\s+/g, '_') || 'My_AI_Comic';
    downloadComicAsPDF(panels, title);
  };

  const isLoading = isGeneratingComic || isGeneratingInitialPanels || isAnalyzingCharacters;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="text-center mb-12">
        <h1 className="main-header">
          AI Comic Creator
        </h1>
        <p className="sub-header">Craft your own comic book pages with the power of AI.</p>
      </header>
      
      <main className="max-w-7xl mx-auto space-y-12">
        <ConfigForm
          onSubmit={handleConfigSubmit}
          isGenerating={isLoading}
          initialConfig={config || undefined}
          initialCharacters={characters}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          apiKeyError={apiKeyError}
        />

        {isLoading && overallProgress && (
          <div className="text-center my-6 p-4 rounded-lg">
            <LoadingSpinner text={overallProgress} size="md" />
          </div>
        )}

        {error && !isLoading && ( 
          <div className="pro-container bg-red-900/50 border-red-700 text-red-200 p-4 text-center">
            <p className="font-semibold">An Error Occurred:</p>
            <p>{error}</p>
          </div>
        )}

        {panels.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="section-header pb-0 mb-0 border-none text-3xl font-bold">Your Comic</h2>
              <button
                onClick={handleDownloadPdf}
                disabled={isLoading || panels.some(p => p.isGenerating || !!p.imageError)}
                className="pro-button pro-button-primary"
              >
                Download as PDF
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {panels.map((panel, index) => (
                <ComicPanel
                  key={panel.id}
                  panel={panel}
                  panelNumber={index + 1}
                  overlayTextGlobal={config?.overlayText || false}
                  aspectRatioClass={getAspectRatioClass(config?.aspectRatio || '16:9')}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="text-center mt-16 py-6 border-t border-slate-800">
        <p className="text-sm text-slate-500">
          AI Comic Creator © {new Date().getFullYear()}.
        </p>
      </footer>
    </div>
  );
};

export default App;
