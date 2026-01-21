export type OpenRouterMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

export type OpenRouterAudioResponse = {
    id: string;
    data: string; // Base64 audio
    expires_at: number;
    transcript: string;
};

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
const OPENROUTER_MODEL = (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined) || 'x-ai/grok-4.1-fast';

export const createOpenRouterChatCompletion = async (
    messages: OpenRouterMessage[],
    options?: {
        model?: string;
        modalities?: string[];
    }
) => {
    if (!OPENROUTER_API_KEY) {
        throw new Error('Missing OpenRouter API key. Set VITE_OPENROUTER_API_KEY.');
    }

    const referer = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const isAudio = options?.modalities?.includes('audio');

    // Notes: Audio models often require streaming to function correctly via API
    const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': referer,
            'X-Title': 'SabongXYZ Support Chat',
        },
        body: JSON.stringify({
            model: options?.model || OPENROUTER_MODEL,
            messages,
            modalities: options?.modalities,
            audio: isAudio ? { format: 'pcm16', voice: 'alloy' } : undefined, // pcm16 required for streaming
            temperature: 0.2,
            max_tokens: 700,
            stream: true, // Force streaming
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter API Error (${response.status}):`, errorText);
        if (response.status === 401) throw new Error('Unauthorized: Invalid API Key or Account Issue');
        throw new Error(`OpenRouter error: ${response.status} ${errorText}`);
    }

    if (!response.body) throw new Error('No response body received.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    let accumulatedContent = '';
    let accumulatedAudioData = '';
    let audioId = '';

    while (!done) {
        const { value, done: DONE } = await reader.read();
        done = DONE;
        if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const json = JSON.parse(line.substring(6));
                        const delta = json.choices?.[0]?.delta;

                        if (delta?.content) {
                            accumulatedContent += delta.content;
                        }

                        if (delta?.audio?.transcript) {
                            accumulatedContent += delta.audio.transcript;
                        }

                        if (delta?.audio?.data) {
                            accumulatedAudioData += delta.audio.data;
                        }

                        if (delta?.audio?.id) {
                            audioId = delta.audio.id;
                        }
                    } catch (e) {
                        // Ignore parse errors for partial chunks
                    }
                }
            }
        }
    }

    if (!accumulatedContent && !accumulatedAudioData) {
        throw new Error('No response content received from stream.');
    }

    return {
        content: accumulatedContent.trim(),
        audio: accumulatedAudioData ? { id: audioId || 'audio_response', data: accumulatedAudioData } : undefined
    };
};
