/**
 * Text-to-Speech & Medical Transliteration Engine for Aura AI Assistant
 */

// Phonetic dictionary mapping English medical terms & acronyms to natural Thai pronunciation
export const MEDICAL_PHONETIC_MAP: Array<{ pattern: RegExp; replacement: string }> = [
  // Specific requested transliterations
  { pattern: /\bAtropine\b/gi, replacement: 'อะโทรพีน' },
  { pattern: /\bTransamin\b/gi, replacement: 'ทรานซามิน' },
  { pattern: /\bIV\s*set\b/gi, replacement: 'ไอวี เซ็ต' },
  { pattern: /\bIV\b/gi, replacement: 'ไอวี' },
  { pattern: /\bExtension\s*tube\b/gi, replacement: 'เอ็กซ์เทนชัน ทูบ' },
  { pattern: /\bSyringe\b/gi, replacement: 'ไซริงค์' },
  { pattern: /\bCrash\s*Cart\b/gi, replacement: 'คาร์ท รถฉุกเฉิน' },
  { pattern: /\bEmergency\s*Bag\b/gi, replacement: 'กระเป๋าฉุกเฉิน' },
  { pattern: /\bEmergency\b/gi, replacement: 'ฉุกเฉิน' },

  // Emergency & Anesthesia Medications
  { pattern: /\bAdrenaline\b/gi, replacement: 'อะดรีนาลีน' },
  { pattern: /\bEpinephrine\b/gi, replacement: 'เอพิเนฟรีน' },
  { pattern: /\bPropofol\b/gi, replacement: 'โพรโพฟอล' },
  { pattern: /\bKetamine\b/gi, replacement: 'คีตามีน' },
  { pattern: /\bFentanyl\b/gi, replacement: 'เฟนทานิล' },
  { pattern: /\bMorphine\b/gi, replacement: 'มอร์ฟีน' },
  { pattern: /\bMidazolam\b/gi, replacement: 'มิดาโซแลม' },
  { pattern: /\bDiazepam\b/gi, replacement: 'ไดอะซีแพม' },
  { pattern: /\bSuccinylcholine\b/gi, replacement: 'ซัคซินิลโคลีน' },
  { pattern: /\bRocuronium\b/gi, replacement: 'โรคุโรเนียม' },
  { pattern: /\bCisatracurium\b/gi, replacement: 'ซิสอะทราคูเรียม' },
  { pattern: /\bSugammadex\b/gi, replacement: 'ซูกัมมาเด็กซ์' },
  { pattern: /\bEphedrine\b/gi, replacement: 'เอฟิดรีน' },
  { pattern: /\bNorepinephrine\b/gi, replacement: 'นอร์เอพิเนฟรีน' },
  { pattern: /\bDopamine\b/gi, replacement: 'โดปามีน' },
  { pattern: /\bAmiodarone\b/gi, replacement: 'แอมมิโอดาโรน' },
  { pattern: /\bLidocaine\b/gi, replacement: 'ลิโดเคน' },
  { pattern: /\bXylocaine\b/gi, replacement: 'ไซโลเคน' },
  { pattern: /\bBupivacaine\b/gi, replacement: 'บิวปิวาเคน' },
  { pattern: /\bMarcaine\b/gi, replacement: 'มาเคน' },
  { pattern: /\bBetadine\b/gi, replacement: 'เบตาดีน' },
  { pattern: /\bAmmonia\b/gi, replacement: 'แอมโมเนีย' },
  { pattern: /\b0\.9%\s*NSS\b/gi, replacement: 'น้ำเกลือศูนย์จุดเก้าเปอร์เซ็นต์ เอ็นเอสเอส' },
  { pattern: /\bNSS\b/gi, replacement: 'น้ำเกลือ เอ็นเอสเอส' },
  { pattern: /\bNormal\s*Saline\b/gi, replacement: 'นอร์มอล ซาไลน์' },
  { pattern: /\bAcetar\b/gi, replacement: 'อะซีตาร์' },
  { pattern: /\bMicropore\b/gi, replacement: 'ไมโครพอร์' },
  { pattern: /\bTranspore\b/gi, replacement: 'ทรานสพอร์' },

  // Airway & Equipment
  { pattern: /\bVideo\s*Laryngoscope\b/gi, replacement: 'วิดีโอ ลาริงโกสโคป' },
  { pattern: /\bLaryngoscope\b/gi, replacement: 'ลาริงโกสโคป' },
  { pattern: /\bStylet\b/gi, replacement: 'สไตเล็ต' },
  { pattern: /\bBougie\b/gi, replacement: 'บูจี' },
  { pattern: /\bET\s*Tube\b/gi, replacement: 'อีที ทูบ' },
  { pattern: /\bETT\b/gi, replacement: 'อีที ทูบ' },
  { pattern: /\bi-gel\b/gi, replacement: 'ไอเจล' },
  { pattern: /\bLMA\b/gi, replacement: 'แอลเอ็มเอ' },
  { pattern: /\bAmbu\s*bag\b/gi, replacement: 'แอมบูแบ็ก' },
  { pattern: /\bO2\s*Tank\b/gi, replacement: 'ถังออกซิเจน' },
  { pattern: /\bO2\b/gi, replacement: 'ออกซิเจน' },
  { pattern: /\bOxygen\b/gi, replacement: 'ออกซิเจน' },
  { pattern: /\bPSI\b/gi, replacement: 'พีเอสไอ' },
  { pattern: /\bCatheter\b/gi, replacement: 'คาธีเตอร์' },
  { pattern: /\bCannula\b/gi, replacement: 'แคนนูล่า' },
  { pattern: /\bDefibrillator\b/gi, replacement: 'เครื่องกระตุกหัวใจ' },
  { pattern: /\bAED\b/gi, replacement: 'เออีดี' },
  { pattern: /\bSuction\b/gi, replacement: 'ซักชัน' },

  // Medical Clinical Concepts
  { pattern: /\bCPR\b/gi, replacement: 'ซีพีอาร์ ปั๊มหัวใจ' },
  { pattern: /\bACLS\b/gi, replacement: 'เอซีแอลเอส' },
  { pattern: /\bPALS\b/gi, replacement: 'พีเอแอลเอส' },
  { pattern: /\bAirway\b/gi, replacement: 'แอร์เวย์ ทางเดินหายใจ' },
  { pattern: /\bChecklist\b/gi, replacement: 'เช็คลิสต์' },
  { pattern: /\bOR\b/gi, replacement: 'โออาร์ ห้องผ่าตัด' },
  { pattern: /\bPACU\b/gi, replacement: 'ห้องพักฟื้น พาคิว' },
  { pattern: /\bEXP\b/gi, replacement: 'วันหมดอายุ' },
  { pattern: /\bNo\s*EXP\b/gi, replacement: 'ไม่มีวันหมดอายุ' },
  { pattern: /\bQty\b/gi, replacement: 'จำนวน' },
  { pattern: /\bAmp\b/gi, replacement: 'แอมป์' },
  { pattern: /\bVial\b/gi, replacement: 'ไวอัล' },
  { pattern: /\bAURA\b/gi, replacement: 'ออร่า' },
  { pattern: /\bAI\b/gi, replacement: 'เอไอ' },
];

/**
 * Strips all Emoji, Unicode icons, and special symbols from text.
 * Leaves Thai, English, numbers, and basic punctuation for clear TTS reading.
 */
export function stripEmojisAndSpecialCharacters(text: string): string {
  if (!text) return '';

  return (
    text
      // Strip markdown bold/italic/headers/links/bullets
      .replace(/[*#_`~>]+/g, ' ')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      // Strip all Unicode emoji ranges (emoticons, pictographs, transport, flags, symbols)
      .replace(
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu,
        ''
      )
      // Strip medical/status visual icons explicitly
      .replace(/[💉📊🚨🎉💡⏳📦👶✨🎤🧪📅🫁🩺🛒🎒📋✔️❌⚠️🚗💼💊🏠🗑️•·|\\/]/g, ' ')
      // Normalize consecutive whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Prepares raw text for Thai Speech Synthesis by:
 * 1. Stripping all emojis and special characters.
 * 2. Transliterating medical & English terms to natural Thai speech phonetics.
 */
export function prepareTextForSpeech(text: string): string {
  if (!text) return '';

  // 1. First remove emojis and markdown symbols
  let cleaned = stripEmojisAndSpecialCharacters(text);

  // 2. Replace English medical vocabulary with Thai phonetic equivalents
  for (const item of MEDICAL_PHONETIC_MAP) {
    cleaned = cleaned.replace(item.pattern, item.replacement);
  }

  // 3. Clean up extra punctuation or dangling symbols
  return cleaned
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


// Track active HTMLAudioElement for external TTS streams
let activeAudioElement: HTMLAudioElement | null = null;

export type AuraVoiceEngine = 'browser' | 'elevenlabs' | 'responsivevoice' | 'google_cloud';

export interface AuraVoiceConfig {
  engine: AuraVoiceEngine;
  pitch: number;          // 1.2 to 1.35 (default 1.28 for cute Alya anime girl tone)
  rate: number;           // 0.95 to 1.0 (default 0.98 for gentle, cute pacing)
  volume: number;         // 0.0 to 1.0 (default 0.85)
  voiceName?: string;     // Preferred browser voice name
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string; // Voice ID for ElevenLabs soft anime girl
  googleApiKey?: string;
}

// 🔊 Locked Permanent Anime Soft Voice for Aura Assistant (ResponsiveVoice / Pitch 1.44x, Speed 1.11x)
export const AURA_LOCKED_PITCH = 1.44;
export const AURA_LOCKED_RATE = 1.11;

export const DEFAULT_AURA_VOICE_CONFIG: AuraVoiceConfig = {
  engine: 'responsivevoice',
  pitch: 1.44,
  rate: 1.11,
  volume: 0.85,
  voiceName: '',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM', // Sweet female anime tone
  googleApiKey: '',
};

export const AURA_PREVIEW_TEXT = 'สวัสดีค่ะพี่พยาบาล~ น้องออร่าจัดการให้เรียบร้อยแล้วนะคะ ✨🌸🎀';

export function getStoredVoiceConfig(): AuraVoiceConfig {
  if (typeof window === 'undefined') return DEFAULT_AURA_VOICE_CONFIG;
  try {
    const raw = localStorage.getItem('aura_voice_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate to permanently locked pitch 1.44 and rate 1.11
      if (parsed.pitch !== 1.44 || parsed.rate !== 1.11 || parsed.engine !== 'responsivevoice') {
        saveVoiceConfig(DEFAULT_AURA_VOICE_CONFIG);
        return DEFAULT_AURA_VOICE_CONFIG;
      }
      return { ...DEFAULT_AURA_VOICE_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('[TextToSpeech] Failed to read voice config:', e);
  }
  return DEFAULT_AURA_VOICE_CONFIG;
}

export function saveVoiceConfig(config: AuraVoiceConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('aura_voice_config', JSON.stringify(config));
  } catch (e) {
    console.warn('[TextToSpeech] Failed to save voice config:', e);
  }
}

/**
 * Cancels any ongoing browser speech synthesis or external audio playback immediately.
 */
export function stopSpeech(): void {
  if (typeof window !== 'undefined') {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // Also cancel responsiveVoice if present
    if ((window as any).responsiveVoice) {
      try {
        (window as any).responsiveVoice.cancel();
      } catch (e) {
        // ignore
      }
    }
  }
  if (activeAudioElement) {
    activeAudioElement.pause();
    activeAudioElement.currentTime = 0;
    activeAudioElement = null;
  }
}

/**
 * Speaks text using Aura voice settings (Alya Anime Girl character):
 * - Cancels previous speech
 * - Uses Thai female voice with Pitch 1.28 (cute anime) & Rate 0.98 (gentle pace)
 * - Supports external TTS engines (ElevenLabs / ResponsiveVoice / Google Cloud TTS)
 */
export function speakWithAura(
  rawText: string,
  voices: SpeechSynthesisVoice[] = [],
  customConfig?: Partial<AuraVoiceConfig>,
  onEnd?: () => void
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Always cancel any existing playback first
  stopSpeech();

  const speechText = prepareTextForSpeech(rawText);
  if (!speechText) return null;

  const config: AuraVoiceConfig = {
    ...getStoredVoiceConfig(),
    ...(customConfig || {}),
  };

  // 1. External Engine: ResponsiveVoice
  if (config.engine === 'responsivevoice' && (window as any).responsiveVoice) {
    try {
      (window as any).responsiveVoice.speak(speechText, 'Thai Female', {
        pitch: config.pitch,
        rate: config.rate,
        volume: config.volume,
        onend: () => onEnd?.(),
        onerror: () => onEnd?.(),
      });
      return null;
    } catch (e) {
      console.warn('[TextToSpeech] ResponsiveVoice failed, falling back to browser:', e);
    }
  }

  // 2. External Engine: ElevenLabs (if API key provided)
  if (config.engine === 'elevenlabs' && config.elevenLabsApiKey) {
    const voiceId = config.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM';
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': config.elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: speechText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.45,
          use_speaker_boost: true,
        },
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`ElevenLabs error: ${res.statusText}`);
        return res.blob();
      })
      .then((blob) => {
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        activeAudioElement = audio;
        audio.volume = config.volume;
        audio.onended = () => {
          activeAudioElement = null;
          URL.revokeObjectURL(audioUrl);
          onEnd?.();
        };
        audio.onerror = () => {
          activeAudioElement = null;
          URL.revokeObjectURL(audioUrl);
          onEnd?.();
        };
        audio.play();
      })
      .catch((err) => {
        console.warn('[TextToSpeech] ElevenLabs failed, falling back to Web Speech API:', err);
        // Fallback to browser Web Speech API
        speakWithBrowserSpeech(speechText, voices, config, onEnd);
      });
    return null;
  }

  // 3. External Engine: Google Cloud TTS (if API key provided)
  if (config.engine === 'google_cloud' && config.googleApiKey) {
    fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: speechText },
        voice: { languageCode: 'th-TH', name: 'th-TH-Neural2-C', ssmlGender: 'FEMALE' },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: config.rate,
          pitch: Math.min(20, Math.max(-20, (config.pitch - 1) * 12)),
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.audioContent) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
          activeAudioElement = audio;
          audio.volume = config.volume;
          audio.onended = () => {
            activeAudioElement = null;
            onEnd?.();
          };
          audio.play();
        } else {
          speakWithBrowserSpeech(speechText, voices, config, onEnd);
        }
      })
      .catch((err) => {
        console.warn('[TextToSpeech] Google Cloud TTS failed, falling back to browser:', err);
        speakWithBrowserSpeech(speechText, voices, config, onEnd);
      });
    return null;
  }

  // Default: Web Speech API (Browser) with Alya parameters
  return speakWithBrowserSpeech(speechText, voices, config, onEnd);
}

function speakWithBrowserSpeech(
  speechText: string,
  voices: SpeechSynthesisVoice[],
  config: AuraVoiceConfig,
  onEnd?: () => void
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'th-TH';
    // 🔊 Alya Anime Voice: Pitch 1.44 (อนิเมะสาวน้อย), Speed 1.11 (ละมุน นุ่มนวล)
    utterance.pitch = config.pitch || AURA_LOCKED_PITCH;
    utterance.rate = config.rate || AURA_LOCKED_RATE;
    utterance.volume = config.volume ?? 0.85;

    // Search for best Thai voice, preferring natural female voices
    const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
    const thaiVoices = availableVoices.filter((v) => v.lang.includes('th') || v.lang.includes('TH'));

    let selectedVoice: SpeechSynthesisVoice | undefined;

    // 1. If user explicitly specified a voice name
    if (config.voiceName) {
      selectedVoice = availableVoices.find((v) => v.name === config.voiceName);
    }

    // 2. Otherwise find best soft female Thai voice
    if (!selectedVoice) {
      selectedVoice =
        thaiVoices.find(
          (v) =>
            v.name.includes('Female') ||
            v.name.includes('Wan') ||
            v.name.includes('Kanya') ||
            v.name.includes('Google') ||
            v.name.includes('Prem') ||
            v.name.includes('Premwadee') ||
            v.name.includes('Narisa') ||
            v.name.includes('หญิง') ||
            v.name.includes('Achara')
        ) || thaiVoices[0];
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch (err) {
    console.warn('[TextToSpeech] speak error:', err);
    return null;
  }
}

/**
 * Preview Aura's cute voice with a friendly sample line:
 * "สวัสดีค่ะพี่พยาบาล~ น้องออร่าจัดการให้เรียบร้อยแล้วนะคะ ✨🌸🎀"
 */
export function previewAuraVoice(
  customConfig?: Partial<AuraVoiceConfig>,
  voices: SpeechSynthesisVoice[] = [],
  onEnd?: () => void
): SpeechSynthesisUtterance | null {
  return speakWithAura(AURA_PREVIEW_TEXT, voices, customConfig, onEnd);
}
