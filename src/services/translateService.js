// Servicio de traducción usando Google Gemini
// Recibe texto plano y el idioma destino, devuelve el texto traducido

const { GoogleGenerativeAI } = require("@google/generative-ai");

const LANG_NAMES = {
  es: "Spanish",
  en: "English",
  fr: "French",
};

async function translateText(text, targetLang) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada en .env");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const langName = LANG_NAMES[targetLang] || "Spanish";

  // Dividimos en chunks de 3000 chars para no exceder el límite del modelo
  const CHUNK_SIZE = 3000;
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.substring(i, i + CHUNK_SIZE));
  }

  const translatedChunks = [];
  for (const chunk of chunks) {
    const prompt = `Translate the following text to ${langName}. 
Preserve the original formatting, paragraph breaks, and structure exactly.
Only return the translated text, nothing else — no explanations, no headers.

Text to translate:
${chunk}`;

    const result = await model.generateContent(prompt);
    translatedChunks.push(result.response.text());
  }

  return translatedChunks.join("\n");
}

module.exports = { translateText };
