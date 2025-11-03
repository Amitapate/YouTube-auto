
export enum Tab {
  VIDEO_CREATOR = 'VIDEO_CREATOR',
  LIVE_ANALYST = 'LIVE_ANALYST',
  RESEARCH_HUB = 'RESEARCH_HUB',
  CREATIVE_STUDIO = 'CREATIVE_STUDIO',
}

export interface GeneratedVideoAssets {
  script: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailPrompt: string;
  thumbnailUrl: string;
  videoUrl: string | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
        reviewSnippets: {
            uri: string;
            text: string;
        }[]
    }[]
  };
}
