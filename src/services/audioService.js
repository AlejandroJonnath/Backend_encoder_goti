// Servicio de Audio Libro usando Google Cloud Text-to-Speech
// Usa voces Neural2 — las más naturales y humanas disponibles
// Usa SSML para controlar pausas y ritmo sin leer la puntuación en voz alta
// El texto se pre-procesa para limpiar artefactos de PDF antes de sintetizar

const axios = require("axios");

// Pre-procesa el texto del PDF para que suene natural cuando se lea
function preprocessTextForSpeech(rawText) {
  return rawText
    // Limpiamos saltos de línea múltiples (artefacto de PDFs)
    .replace(/\n{3,}/g, "\n\n")
    // Eliminamos guiones de corte de palabra al final de línea (ej: "impor-\ntante" → "importante")
    .replace(/-\n(\w)/g, "$1")
    // Unimos líneas que son continuación de una misma oración
    .replace(/([a-záéíóúüñA-ZÁÉÍÓÚÜÑ,])\n([a-záéíóúüñ])/g, "$1 $2")
    // Normalizamos espacios múltiples
    .replace(/ {2,}/g, " ")
    // Eliminamos números de página aislados (ej: "\n3\n")
    .replace(/\n\d{1,3}\n/g, "\n")
    .trim();
}

// Convierte texto a SSML para pausas naturales sin leer la puntuación
function textToSSML(text) {
  // Escapamos caracteres XML
  let ssml = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Convertimos puntuación en pausas SSML naturales
  // Los puntos finales dan una pausa larga (como una persona terminando una oración)
  ssml = ssml.replace(/\. /g, '.<break time="600ms"/> ');
  // Los puntos seguidos de nueva línea
  ssml = ssml.replace(/\.\n/g, '.<break time="800ms"/>');
  // Las comas dan una pausa corta
  ssml = ssml.replace(/, /g, ',<break time="200ms"/> ');
  // Los dos puntos
  ssml = ssml.replace(/: /g, ':<break time="400ms"/> ');
  // Los signos de exclamación e interrogación
  ssml = ssml.replace(/[!¡]/g, '!<break time="500ms"/>');
  ssml = ssml.replace(/[?¿]/g, '?<break time="500ms"/>');
  // Párrafos nuevos = pausa más larga (como cuando una persona respira al cambiar de tema)
  ssml = ssml.replace(/\n\n/g, '<break time="1200ms"/>');
  ssml = ssml.replace(/\n/g, '<break time="300ms"/>');

  return `<speak>${ssml}</speak>`;
}

const VOICES = {
  es: { languageCode: "es-US", name: "es-US-Neural2-B" }, // Voz masculina española Neural2
  en: { languageCode: "en-US", name: "en-US-Neural2-J" }, // Voz masculina inglesa Neural2
  fr: { languageCode: "fr-FR", name: "fr-FR-Neural2-B" }, // Voz masculina francesa Neural2
};

async function generateAudioFromText(text, lang = "es") {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_TTS_API_KEY no configurada en .env");

  const voice = VOICES[lang] || VOICES.es;

  // Pre-procesamos el texto
  const cleanText = preprocessTextForSpeech(text);

  // TTS tiene límite de ~5000 bytes por request — dividimos en chunks
  const CHUNK_SIZE = 4500;
  const textChunks = [];
  const paragraphs = cleanText.split("\n\n");

  let currentChunk = "";
  for (const para of paragraphs) {
    if ((currentChunk + "\n\n" + para).length > CHUNK_SIZE) {
      if (currentChunk) textChunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
    }
  }
  if (currentChunk.trim()) textChunks.push(currentChunk.trim());

  // Sintetizamos cada chunk y unimos los audios en base64
  const audioChunks = [];
  for (const chunk of textChunks) {
    const ssml = textToSSML(chunk);

    const response = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        input: { ssml },
        voice: {
          languageCode: voice.languageCode,
          name: voice.name,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 0.95,    // Ligeramente más lento que normal — más cómodo para escuchar
          pitch: 0.0,            // Tono neutro y natural
          effectsProfileId: ["headphone-class-device"], // Optimizado para auriculares
        },
      },
      { timeout: 30000 }
    );

    audioChunks.push(response.data.audioContent);
  }

  // Convertimos cada chunk de base64 a Buffer y los concatenamos
  const audioBuffers = audioChunks.map((chunk) => Buffer.from(chunk, "base64"));
  const combinedAudio = Buffer.concat(audioBuffers);

  return combinedAudio;
}

module.exports = { generateAudioFromText };
