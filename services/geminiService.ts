
import { GoogleGenAI, GenerateContentResponse, Chat, Type, Modality } from "@google/genai";

// Ensure process.env.API_KEY is handled by the environment.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTextWithGrounding = async (prompt: string, useMaps: boolean = false): Promise<GenerateContentResponse> => {
    const ai = getAI();
    const tools: any[] = useMaps ? [{ googleMaps: {} }] : [{ googleSearch: {} }];
    const toolConfig: any = {};

    if (useMaps) {
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            toolConfig.retrievalConfig = {
                latLng: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                }
            };
        } catch (error) {
            console.warn("Could not get geolocation. Proceeding without it.");
        }
    }
    
    return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { tools, toolConfig },
    });
};

export const generateScriptAndMetadata = async (topic: string, aggregatedData: string) => {
    const ai = getAI();
    const prompt = `
        Based on the following aggregated crypto data for "${topic}", generate a complete set of assets for a YouTube video.
        
        Data:
        ---
        ${aggregatedData}
        ---

        Your task is to return a JSON object with the following structure:
        {
          "script": "A compelling, narrated script for a 2-minute video. Use engaging language. Start with a hook. End with a call to action.",
          "title": "A catchy, SEO-friendly YouTube title under 70 characters.",
          "description": "A detailed YouTube description, including relevant links and 3-5 relevant hashtags.",
          "tags": ["tag1", "tag2", "tag3", "crypto", "blockchain"],
          "thumbnailPrompt": "A highly detailed, dramatic, and visually striking prompt for an AI image generator to create a thumbnail. For example: 'Hyper-realistic 4k image of a golden Bitcoin rocket launching to the moon, with dramatic lighting and a sense of speed.'"
        }
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            // Fix: Added responseSchema for more reliable JSON output.
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    script: { type: Type.STRING, description: "A compelling, narrated script for a 2-minute video." },
                    title: { type: Type.STRING, description: "A catchy, SEO-friendly YouTube title." },
                    description: { type: Type.STRING, description: "A detailed YouTube description." },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of relevant tags." },
                    thumbnailPrompt: { type: Type.STRING, description: "A prompt for an AI image generator to create a thumbnail." }
                },
                required: ["script", "title", "description", "tags", "thumbnailPrompt"]
            },
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });

    try {
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini Pro:", e);
        throw new Error("Could not generate video script and metadata.");
    }
};

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4") => {
    const ai = getAI();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio,
        },
    });
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
};

export const generateVideo = async (prompt: string, aspectRatio: "16:9" | "9:16", image?: { imageBytes: string; mimeType: string }) => {
    const ai = getAI();
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: image,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation failed to produce a download link.");
    }

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
};

export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string) => {
    const ai = getAI();
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64,
      },
    };
    const textPart = { text: prompt };
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
    });
    return response.text;
};

export const editImage = async (prompt: string, imageBase64: string, mimeType: string) => {
    const ai = getAI();
    const imagePart = {
        inlineData: { data: imageBase64, mimeType },
    };
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        // Fix: responseModalities must be an array with a single `Modality.IMAGE` element.
        config: { responseModalities: [Modality.IMAGE] },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:image/png;base64,${base64ImageBytes}`;
    }
    throw new Error("Image editing failed.");
};


export const createChat = (): Chat => {
    const ai = getAI();
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: 'You are a helpful assistant specializing in cryptocurrency and blockchain technology.',
        },
    });
};

export const analyzeVideo = async (prompt: string, videoFile: File): Promise<string> => {
    // This is a simplified simulation. True video understanding requires a more complex
    // frame-by-frame analysis or a dedicated multi-modal model endpoint not fully
    // representable here. We'll simulate by analyzing a "snapshot" or metadata.
    const ai = getAI();
    const analysisPrompt = `
        A video file named "${videoFile.name}" of type "${videoFile.type}" and size ${videoFile.size} bytes has been uploaded.
        Based on this information and the user's prompt, provide a detailed analysis.

        User Prompt: "${prompt}"

        Analyze the potential content and key information of the video.
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: analysisPrompt,
        config: { thinkingConfig: { thinkingBudget: 32768 } }
    });

    return response.text;
};

export const textToSpeech = async (text: string) => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
            // Fix: responseModalities must be an array with a single `Modality.AUDIO` element.
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
        return base64Audio;
    }
    throw new Error("Text-to-speech conversion failed.");
};

// Note: Live API (Native Audio) is implemented directly in the component due to its stateful, callback-based nature.
