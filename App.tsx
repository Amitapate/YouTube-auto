
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Tab } from './types';
import { GeneratedVideoAssets, ChatMessage, GroundingChunk } from './types';
import * as geminiService from './services/geminiService';
import { BrushIcon, MicIcon, SearchIcon, VideoIcon, LoadingSpinner, StopIcon } from './components/Icons';
import TabButton from './components/TabButton';
import FileUpload from './components/FileUpload';
import { GoogleGenAI, LiveSession, LiveServerMessage, Chat, Modality } from '@google/genai';

// Helper for base64 encoding
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

// Audio Decoding/Encoding for Live API
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const VideoCreator: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [assets, setAssets] = useState<GeneratedVideoAssets | null>(null);
    const [apiKeySelected, setApiKeySelected] = useState(false);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setApiKeySelected(true);
            }
        };
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true); // Assume success to avoid race condition
        }
    };

    const handleGenerate = async () => {
        if (!topic && !imageFile) {
            alert("Please provide a topic or an image.");
            return;
        }

        if (!apiKeySelected) {
            alert("Please select your API key first.");
            return;
        }

        setIsLoading(true);
        setAssets(null);

        try {
            let scriptData = { script: '', title: '', description: '', tags: [], thumbnailPrompt: '' };

            if (topic) {
                setLoadingMessage("Aggregating market data with Gemini Search...");
                const groundingResponse = await geminiService.generateTextWithGrounding(
                    `Find the latest news and market data about ${topic}`
                );
                
                setLoadingMessage("Generating script & metadata with Gemini Pro (Thinking Mode)...");
                scriptData = await geminiService.generateScriptAndMetadata(topic, groundingResponse.text);
            } else {
                scriptData.script = "A short video based on the provided image.";
                scriptData.title = "AI-Generated Video";
                scriptData.description = "This video was generated from an image using CryptoVid AI Studio.";
                scriptData.tags = ["ai", "video", "generativeart"];
                scriptData.thumbnailPrompt = "A visually interesting thumbnail related to the uploaded image.";
            }

            setLoadingMessage("Creating a stunning thumbnail with Imagen 4...");
            const thumbnailUrl = await geminiService.generateImage(scriptData.thumbnailPrompt, "16:9");
            setAssets({ ...scriptData, thumbnailUrl, videoUrl: null });

            setLoadingMessage("Generating your video with Veo... This may take a few minutes.");
            let imagePayload;
            if (imageFile) {
                const imageBytes = await fileToBase64(imageFile);
                imagePayload = { imageBytes, mimeType: imageFile.type };
            }
            const videoUrl = await geminiService.generateVideo(scriptData.script, aspectRatio, imagePayload);
            
            setAssets(prev => prev ? { ...prev, videoUrl } : null);

        } catch (error) {
            console.error(error);
            alert(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
             if (error instanceof Error && error.message.includes("Requested entity was not found.")) {
                setApiKeySelected(false);
                alert("API Key not found. Please select your key again.");
            }
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            {!apiKeySelected && (
                <div className="text-center p-4 rounded-lg bg-yellow-900 border border-yellow-600 mb-4">
                    <p className="mb-2">Veo video generation requires an API key.</p>
                     <p className="mb-4 text-sm text-yellow-300">Billing charges may apply. See <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">billing documentation</a>.</p>
                    <button onClick={handleSelectKey} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg">Select API Key</button>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-lg font-semibold mb-2">1. Input Topic or Image</h3>
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g., Bitcoin Halving Analysis"
                        className="w-full p-3 bg-gray-700 rounded-lg mb-4"
                    />
                    <p className="text-center my-2 text-gray-400">OR</p>
                    <FileUpload onFileUpload={setImageFile} accept="image/*" label="Upload Starting Image (Optional)" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold mb-2">2. Configure</h3>
                    <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
                        className="w-full p-3 bg-gray-700 rounded-lg mb-4"
                    >
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                    </select>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !apiKeySelected}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? <LoadingSpinner /> : 'Generate Video Package'}
                    </button>
                    {isLoading && <p className="text-center mt-2 text-purple-300">{loadingMessage}</p>}
                </div>
            </div>
            {assets && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold mb-4 text-center">Generated Assets</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-gray-700 p-4 rounded-lg">
                            <h3 className="text-xl font-semibold mb-2">Video & Thumbnail</h3>
                            {assets.videoUrl ? (
                                <video controls src={assets.videoUrl} className="w-full rounded-lg mb-4"></video>
                            ) : (
                                <div className="w-full aspect-video bg-gray-600 rounded-lg mb-4 flex items-center justify-center"><LoadingSpinner/></div>
                            )}
                            <img src={assets.thumbnailUrl} alt="Generated Thumbnail" className="w-full rounded-lg" />
                        </div>
                        <div className="bg-gray-700 p-4 rounded-lg space-y-4">
                            <div><h3 className="font-bold text-purple-300">Title:</h3><p>{assets.title}</p></div>
                            <div><h3 className="font-bold text-purple-300">Description:</h3><p className="whitespace-pre-wrap">{assets.description}</p></div>
                            <div><h3 className="font-bold text-purple-300">Tags:</h3><div className="flex flex-wrap gap-2">{assets.tags.map(t => <span key={t} className="bg-gray-600 px-2 py-1 rounded-md text-sm">{t}</span>)}</div></div>
                            <div><h3 className="font-bold text-purple-300">Script:</h3><p className="whitespace-pre-wrap max-h-48 overflow-y-auto">{assets.script}</p></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const LiveAnalyst: React.FC = () => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLive, setIsLive] = useState(false);
    const [transcriptions, setTranscriptions] = useState<{user: string, model: string}[]>([]);
    
    const sessionRef = useRef<LiveSession | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

    const stopConversation = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if(streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        setIsLive(false);
        setIsConnecting(false);
    }, []);

    const startConversation = useCallback(async () => {
        setIsConnecting(true);
        setTranscriptions([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            let currentInputTranscription = '';
            let currentOutputTranscription = '';

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        mediaStreamSourceRef.current = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
                        processorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        
                        processorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };

                        mediaStreamSourceRef.current.connect(processorRef.current);
                        processorRef.current.connect(audioContextRef.current!.destination);
                        setIsConnecting(false);
                        setIsLive(true);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscription += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscription += message.serverContent.inputTranscription.text;
                        }
                        if(message.serverContent?.turnComplete) {
                            const userInput = currentInputTranscription;
                            const modelOutput = currentOutputTranscription;
                            setTranscriptions(prev => [...prev, {user: userInput, model: modelOutput}]);
                            currentInputTranscription = '';
                            currentOutputTranscription = '';
                        }
                        
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            source.addEventListener('ended', () => sourcesRef.current.delete(source));
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        }

                        if (message.serverContent?.interrupted) {
                            sourcesRef.current.forEach(source => source.stop());
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error("Live API Error:", e);
                        alert("A connection error occurred.");
                        stopConversation();
                    },
                    onclose: () => {
                        stopConversation();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: 'You are a friendly and helpful crypto market analyst. Keep your answers concise.',
                },
            });
            sessionRef.current = await sessionPromise;

        } catch (error) {
            console.error("Failed to start conversation:", error);
            alert(`Could not start the conversation: ${error instanceof Error ? error.message : "Unknown error"}`);
            stopConversation();
        }
    }, [stopConversation]);
    
    useEffect(() => {
        return () => {
            stopConversation();
        };
    }, [stopConversation]);

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
            <h2 className="text-2xl font-bold mb-4">Live Crypto Analyst</h2>
            <p className="text-gray-400 mb-6">Start a real-time conversation with a Gemini-powered AI analyst.</p>
            <button
                onClick={isLive ? stopConversation : startConversation}
                disabled={isConnecting}
                className={`px-8 py-4 rounded-full text-lg font-bold transition-all duration-300 flex items-center justify-center mx-auto ${
                    isLive ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
                } disabled:opacity-50`}
            >
                {isConnecting ? <LoadingSpinner /> : (isLive ? <><StopIcon className="w-6 h-6 mr-2" /> Stop Conversation</> : <><MicIcon className="w-6 h-6 mr-2" /> Start Conversation</>)}
            </button>
            <div className="mt-8 text-left bg-gray-900 p-4 rounded-lg max-h-96 overflow-y-auto">
                {transcriptions.map((turn, index) => (
                    <div key={index} className="mb-4">
                        <p><strong className="text-purple-400">You:</strong> {turn.user}</p>
                        <p><strong className="text-pink-400">Analyst:</strong> {turn.model}</p>
                    </div>
                ))}
                {transcriptions.length === 0 && !isLive && (
                    <p className="text-gray-500 text-center">Conversation transcript will appear here.</p>
                )}
            </div>
        </div>
    );
};

const ResearchHub: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePrompt, setImagePrompt] = useState('Analyze this crypto chart.');

    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPrompt, setVideoPrompt] = useState('Summarize the key points of this video.');
    
    const chatRef = useRef<Chat | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');

    useEffect(() => {
        chatRef.current = geminiService.createChat();
    }, []);

    const handleChatSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !chatRef.current) return;
        const userMessage: ChatMessage = { role: 'user', text: chatInput };
        setChatMessages(prev => [...prev, userMessage]);
        const currentChatInput = chatInput;
        setChatInput('');
        setIsLoading(true);

        try {
            const response = await chatRef.current.sendMessage({ message: currentChatInput });
            const modelMessage: ChatMessage = { role: 'model', text: response.text };
            setChatMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            const errorMessage: ChatMessage = { role: 'model', text: "Sorry, I encountered an error." };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageAnalysis = async () => {
        if (!imageFile || !imagePrompt.trim()) return alert("Please upload an image and provide a prompt.");
        setIsLoading(true);
        setResult('');
        setGroundingChunks([]);
        try {
            const base64 = await fileToBase64(imageFile);
            const analysis = await geminiService.analyzeImage(imagePrompt, base64, imageFile.type);
            setResult(analysis);
        } catch (error) {
            console.error(error);
            setResult(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleVideoAnalysis = async () => {
         if (!videoFile || !videoPrompt.trim()) return alert("Please upload a video and provide a prompt.");
        setIsLoading(true);
        setResult('');
        setGroundingChunks([]);
        try {
            const analysis = await geminiService.analyzeVideo(videoPrompt, videoFile);
            setResult(analysis);
        } catch (error) {
            console.error(error);
            setResult(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left side: Analysis tools */}
            <div className="space-y-6">
                {/* Image Analysis */}
                <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-xl font-semibold mb-3">Image Analysis with Gemini Flash</h3>
                    <FileUpload onFileUpload={setImageFile} accept="image/*" label="Upload Image" />
                    <textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} className="w-full p-2 bg-gray-600 rounded-lg my-3" rows={2}></textarea>
                    <button onClick={handleImageAnalysis} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg disabled:opacity-50">Analyze Image</button>
                </div>
                {/* Video Analysis */}
                <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-xl font-semibold mb-3">Video Analysis with Gemini Pro</h3>
                    <FileUpload onFileUpload={setVideoFile} accept="video/*" label="Upload Video" />
                    <textarea value={videoPrompt} onChange={e => setVideoPrompt(e.target.value)} className="w-full p-2 bg-gray-600 rounded-lg my-3" rows={2}></textarea>
                    <button onClick={handleVideoAnalysis} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg disabled:opacity-50">Analyze Video (Simulated)</button>
                </div>
                 {/* Result Display */}
                 {(result || isLoading) && (
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h3 className="text-xl font-semibold mb-2">Analysis Result</h3>
                        {isLoading ? <div className="flex justify-center"><LoadingSpinner /></div> : <p className="whitespace-pre-wrap">{result}</p>}
                    </div>
                )}
            </div>
             {/* Right side: Chatbot */}
            <div className="bg-gray-700 p-4 rounded-lg flex flex-col h-[600px]">
                <h3 className="text-xl font-semibold mb-3 text-center">Crypto Chat</h3>
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    {chatMessages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <p className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-purple-600' : 'bg-gray-600'}`}>{msg.text}</p>
                        </div>
                    ))}
                     {isLoading && chatMessages.length > 0 && chatMessages[chatMessages.length-1].role === 'user' && (
                        <div className="flex justify-start"><div className="p-3 bg-gray-600 rounded-lg"><LoadingSpinner/></div></div>
                    )}
                </div>
                <form onSubmit={handleChatSend} className="mt-4 flex gap-2">
                    <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about crypto..." className="flex-1 p-2 bg-gray-600 rounded-lg" />
                    <button type="submit" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg disabled:opacity-50">Send</button>
                </form>
            </div>
        </div>
    );
};


const CreativeStudio: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [imageGenPrompt, setImageGenPrompt] = useState('A hyper-realistic 4k image of a golden Bitcoin rocket launching to the moon');
    const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('16:9');
    const [generatedImageUrl, setGeneratedImageUrl] = useState('');
    
    const [editImageFile, setEditImageFile] = useState<File | null>(null);
    const [editPrompt, setEditPrompt] = useState('Add a retro filter');
    const [editedImageUrl, setEditedImageUrl] = useState('');
    const [originalImageUrl, setOriginalImageUrl] = useState('');

    const handleGenerateImage = async () => {
        if (!imageGenPrompt) return;
        setIsLoading(true);
        setGeneratedImageUrl('');
        try {
            const url = await geminiService.generateImage(imageGenPrompt, aspectRatio);
            setGeneratedImageUrl(url);
        } catch (error) {
            console.error(error);
            alert(`Error generating image: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEditImage = async () => {
        if (!editImageFile || !editPrompt) return alert("Please upload an image and provide an edit prompt.");
        setIsLoading(true);
        setEditedImageUrl('');
        try {
            const base64 = await fileToBase64(editImageFile);
            setOriginalImageUrl(`data:${editImageFile.type};base64,${base64}`);
            const url = await geminiService.editImage(editPrompt, base64, editImageFile.type);
            setEditedImageUrl(url);
        } catch (error) {
            console.error(error);
            alert(`Error editing image: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Generation */}
            <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="text-xl font-semibold mb-3">Generate Image with Imagen 4</h3>
                <textarea value={imageGenPrompt} onChange={e => setImageGenPrompt(e.target.value)} className="w-full p-2 bg-gray-600 rounded-lg" rows={3}></textarea>
                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full p-2 bg-gray-600 rounded-lg my-3">
                    <option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="3:4">3:4</option>
                </select>
                <button onClick={handleGenerateImage} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg disabled:opacity-50">Generate</button>
                {isLoading && !generatedImageUrl && <div className="flex justify-center mt-4"><LoadingSpinner/></div>}
                {generatedImageUrl && <img src={generatedImageUrl} alt="Generated" className="mt-4 rounded-lg w-full"/>}
            </div>
            
            {/* Image Editing */}
            <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="text-xl font-semibold mb-3">Edit Image with Gemini Flash</h3>
                <FileUpload onFileUpload={setEditImageFile} accept="image/*" label="Upload Image to Edit" />
                <input type="text" value={editPrompt} onChange={e => setEditPrompt(e.target.value)} className="w-full p-2 bg-gray-600 rounded-lg my-3" />
                <button onClick={handleEditImage} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg disabled:opacity-50">Edit</button>
                {isLoading && !editedImageUrl && <div className="flex justify-center mt-4"><LoadingSpinner/></div>}
                {editedImageUrl && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div><h4 className="text-center mb-2">Original</h4><img src={originalImageUrl} alt="Original" className="rounded-lg w-full"/></div>
                        <div><h4 className="text-center mb-2">Edited</h4><img src={editedImageUrl} alt="Edited" className="rounded-lg w-full"/></div>
                    </div>
                )}
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.VIDEO_CREATOR);

  const renderContent = () => {
    switch (activeTab) {
      case Tab.VIDEO_CREATOR:
        return <VideoCreator />;
      case Tab.LIVE_ANALYST:
        return <LiveAnalyst />;
      case Tab.RESEARCH_HUB:
        return <ResearchHub />;
      case Tab.CREATIVE_STUDIO:
        return <CreativeStudio />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text">
          CryptoVid AI Studio
        </h1>
        <p className="text-gray-400 mt-2 max-w-2xl mx-auto">
          Your all-in-one platform to automate crypto content creation, from real-time data analysis to final video production.
        </p>
      </header>

      <nav className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center mb-8">
        <TabButton label="Video Creator" isActive={activeTab === Tab.VIDEO_CREATOR} onClick={() => setActiveTab(Tab.VIDEO_CREATOR)} icon={<VideoIcon className="w-full h-full" />} />
        <TabButton label="Live Analyst" isActive={activeTab === Tab.LIVE_ANALYST} onClick={() => setActiveTab(Tab.LIVE_ANALYST)} icon={<MicIcon className="w-full h-full" />} />
        <TabButton label="Research Hub" isActive={activeTab === Tab.RESEARCH_HUB} onClick={() => setActiveTab(Tab.RESEARCH_HUB)} icon={<SearchIcon className="w-full h-full" />} />
        <TabButton label="Creative Studio" isActive={activeTab === Tab.CREATIVE_STUDIO} onClick={() => setActiveTab(Tab.CREATIVE_STUDIO)} icon={<BrushIcon className="w-full h-full" />} />
      </nav>

      <main className="max-w-7xl mx-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
