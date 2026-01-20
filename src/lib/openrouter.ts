export type OpenRouterMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
const OPENROUTER_MODEL = (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined) || 'x-ai/grok-4.1-fast';

export const createOpenRouterChatCompletion = async (messages: OpenRouterMessage[]) => {
    if (!OPENROUTER_API_KEY) {
        throw new Error('Missing OpenRouter API key. Set VITE_OPENROUTER_API_KEY.');
    }

    const referer = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': referer,
            'X-Title': 'SabongXYZ Support Chat',
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages,
            temperature: 0.2,
            max_tokens: 700,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('No response received from the AI model.');
    }

    return String(content).trim();
};
