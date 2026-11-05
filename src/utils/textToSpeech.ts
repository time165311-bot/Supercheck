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

/**
 * Cancels any ongoing browser speech synthesis immediately.
 */
export function stopSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Speaks text using the browser SpeechSynthesis API with Aura settings:
 * - Cancels previous speech
 * - Uses Thai female voice if available
 * - Sets volume to 0.75
 * - Strips emojis and uses phonetic transliteration
 */
export function speakWithAura(
  rawText: string,
  voices: SpeechSynthesisVoice[] = [],
  onEnd?: () => void
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  // Always cancel any existing playback first
  stopSpeech();

  const speechText = prepareTextForSpeech(rawText);
  if (!speechText) return null;

  try {
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'th-TH';
    utterance.rate = 1.05;
    utterance.pitch = 1.2;
    utterance.volume = 0.75; // 75% volume

    // Search for best Thai voice, preferring natural female voices
    const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
    const thaiVoices = availableVoices.filter((v) => v.lang.includes('th') || v.lang.includes('TH'));

    const femaleVoice =
      thaiVoices.find(
        (v) =>
          v.name.includes('Female') ||
          v.name.includes('Wan') ||
          v.name.includes('Kanya') ||
          v.name.includes('Google') ||
          v.name.includes('Prem') ||
          v.name.includes('หญิง') ||
          v.name.includes('Narisa')
      ) || thaiVoices[0];

    if (femaleVoice) {
      utterance.voice = femaleVoice;
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
