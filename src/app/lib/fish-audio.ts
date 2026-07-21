const MIMO_TTS_API = "https://token-plan-cn.xiaomimimo.com/v1/chat/completions";

const VOICE_MAP: Record<string, string> = {
  zh: "冰糖",
  en: "Milo",
};

function getMimoTTSConfig() {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) throw new Error("MIMO_API_KEY is not set");
  return { apiKey };
}

export async function synthesizeSpeech(
  text: string,
  language: "zh" | "en"
): Promise<ArrayBuffer> {
  const { apiKey } = getMimoTTSConfig();
  const voice = VOICE_MAP[language] || VOICE_MAP.zh;

  const response = await fetch(MIMO_TTS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      model: "mimo-v2.5-tts",
      messages: [
        { role: "assistant", content: text },
      ],
      audio: {
        voice,
        format: "wav",
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`MiMo TTS failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const audioBase64 = data.choices?.[0]?.message?.audio?.data;
  if (!audioBase64) throw new Error("No audio data in response");

  return Buffer.from(audioBase64, "base64").buffer;
}
