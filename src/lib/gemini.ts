import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_KEY_BACKUP = process.env.GEMINI_API_KEY_BACKUP || '';

function getAI(useBackup = false) {
  const key = useBackup ? GEMINI_KEY_BACKUP : GEMINI_KEY;
  if (!key) throw new Error('GEMINI_API_KEY no configurada. Contacta al administrador.');
  return new GoogleGenAI({ apiKey: key });
}

export interface CreativeSpec {
  id: string;
  identifiedBrand: string;
  medio: string;
  formatoAnuncio: string;
  creativo: string;
  formatAndSize: string;
  formato: string;
  peso: string;
  textoSpec: string;
  maxTitleChars: number;
  maxCopyChars: number;
  objetivo: string;
  geografia: string;
  audienciaMacro: string;
  audienciaReferencia: string;
  audienciaReferenciaElegida: string;
  driverComunicacion: string;
  campaignContext: string;
  suggestedTitle: string;
  suggestedCopy: string;
  brandGuidelines: string;
  masterPromptEn: string;
  masterPromptEs: string;
  resizePrompt: string;
}

export async function extractAndOptimizePrompts(inputText: string): Promise<CreativeSpec[]> {
  const truncatedInput = inputText.slice(0, 100000);

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("La solicitud a la IA ha tardado demasiado (Timeout). Intenta con menos texto.")), 300000);
    });

    const callGemini = async (useBackup = false) => getAI(useBackup).models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an Expert Prompt Engineer specializing in DCO (Dynamic Creative Optimization), Audience Strategy, and Brand Consistency.

The user uploaded a document (Excel/CSV) with creative specifications. You MUST read and understand EVERY column.

STEP 1 — UNDERSTAND THE COLUMNS:
Read the header row carefully. Common columns include (names may vary):
- MEDIO: Platform (META, DV360, TIKTOK, YOUTUBE, GOOGLE, etc.)
- Formato de Anuncio: Ad format (Link Ad, Link Ad Video, Stories, Banners tradicionales, Native Ads, Infeed, Trueview, Shorts, etc.)
- Creativo: Creative type (Imagen, Video, Estandar, etc.)
- Tamaño (en pixeles): Dimensions (1080x1080, 1920x1080, 300x250, 728x90, 1200x627, etc.)
- Formato: File format (JPG, PNG, MP4, MOV, GIF, HTML5, etc.)
- Peso: File weight limit (80KB, <2.3GB, 40KB, 100k, etc.)
- Texto: CHARACTER LIMITS — THIS IS CRITICAL. Read exactly what it says. Examples:
  * "Texto: 200 Caracteres" → maxCopyChars = 200
  * "Título: max 25 Caracteres" → maxTitleChars = 25
  * "de la cuenta: máximo 20 / del anuncio: 100 caracteres" → maxTitleChars = 20, maxCopyChars = 100
  * If it says just "Texto: 200 Caracteres" with no title spec → maxTitleChars = 40, maxCopyChars = 200
  * If it says "Título: max 25 Caracteres" only → maxTitleChars = 25, maxCopyChars = 90
- OBJETIVO: Campaign objective (Awareness, Conversión, Tráfico, etc.)
- GEOGRAFIA: Geographic targeting (Nacional, Regional, Ciudad, etc.)
- AUDIENCIAS: The MACRO audience segment (e.g., "Generación Energía", "Motores del Día a Día", "Los comprometidos", "Vitalidad Clásica"). This is the broad target group.
- AUDIENCIAS REFERENCIA: The MICRO audience profiles within each macro, separated by commas (e.g., "La guerrera del gimnasio, La influencer Wellness, el papá proveedor consciente."). These are specific personas used to build the creative concept.
- Driver / Driver de Comunicación: Communication driver or key message angle (if present)

STEP 2 — MACRO vs MICRO AUDIENCE LOGIC (CRITICAL):
The document has TWO audience columns:
- AUDIENCIAS = MACRO (broad segment). Example: "Generación Energía"
- AUDIENCIAS REFERENCIA = MICRO (specific personas within the macro, comma-separated). Example: "La guerrera del gimnasio, La influencer Wellness, el papá proveedor consciente."

For EACH row, you MUST:
a) Read the MACRO audience from the AUDIENCIAS column → put it in "audienciaMacro"
b) Read ALL the MICRO personas from AUDIENCIAS REFERENCIA → put the full list in "audienciaReferencia"
c) CHOOSE ONE specific micro persona for this creative → put it in "audienciaReferenciaElegida"
d) The suggestedTitle and suggestedCopy MUST be crafted specifically for that chosen micro persona
e) DISTRIBUTE micro personas across rows: if there are 9 rows for "Generación Energía" with 3 micros ("La guerrera del gimnasio, La influencer Wellness, el papá proveedor consciente"), assign ~3 rows to each micro persona. ROTATE them.
f) The campaignContext MUST clearly state: "Audiencia: [MACRO] | Para: [MICRO elegida] | Objetivo: [OBJETIVO]"

Example:
- Row 1: audienciaMacro="Generación Energía", audienciaReferenciaElegida="La guerrera del gimnasio" → copy speaks to gym warriors
- Row 2: audienciaMacro="Generación Energía", audienciaReferenciaElegida="La influencer Wellness" → copy speaks to wellness influencers
- Row 3: audienciaMacro="Generación Energía", audienciaReferenciaElegida="El papá proveedor consciente" → copy speaks to conscious provider dads
- Row 4: rotate back to "La guerrera del gimnasio" with a DIFFERENT angle/format

STEP 3 — GENERATE COPY RESPECTING THE EXACT CHARACTER LIMITS FROM THE "Texto" COLUMN:
- READ the "Texto" column for each row. It tells you the max characters.
- If it says "200 Caracteres", your suggestedCopy MUST be ≤200 characters.
- If it says "Título: max 25", your suggestedTitle MUST be ≤25 characters.
- ALWAYS count characters before returning. If over the limit, rewrite shorter.
- The copy must be tailored to the platform (MEDIO), the chosen MICRO audience, and driver.

STEP 4 — AUDIENCE-SPECIFIC COPY STRATEGY:
- Each MICRO persona has a unique worldview. Speak to THEIR specific reality:
  * "La guerrera del gimnasio" → energy, performance, pushing limits, pre-workout, gains
  * "La influencer Wellness" → self-care, mindful living, clean ingredients, aesthetic
  * "El papá proveedor consciente" → family health, responsible choices, value for money
  * "El trabajador de construcción" → stamina, hard work, affordable energy, recovery
  * "La profesora comprometida" → dedication, mental clarity, juggling responsibilities
  * "El abuelo vital" → active aging, vitality, enjoying life, independence
- The title and copy must feel like it was written BY someone who understands that specific persona.
- NEVER use the same copy for different micro personas even if they share a macro audience.

STEP 5 — DISRUPTIVE, NON-GENERIC COPY:
Your copy MUST be DISRUPTIVE, CREATIVE, and SPECIFIC. You are saving the creative team hours of brainstorming.
- NO generic messages like "Descubre lo mejor" or "La mejor opción para ti". These are BANNED.
- Use provocative questions, bold statements, unexpected angles, cultural references, emotional triggers.
- Each creative must feel like a UNIQUE concept — as if a senior copywriter spent 10 minutes crafting just that one.
- Vary the tone across rows: some playful, some bold, some emotional, some data-driven, some aspirational.
- Think about what would make someone STOP scrolling on that specific platform (META vs TikTok vs YouTube).
- For the same audience, vary the angle across formats: Stories copy ≠ Feed copy ≠ Banner copy.
- Examples of GOOD disruptive copy:
  * "¿Sigues pagando de más? Tu vecino ya no." (driver: precio)
  * "Lo que Netflix no te cuenta sobre el 5G" (driver: innovación, audience: tech-savvy)
  * "3 de cada 5 mamás ya cambiaron. ¿Y tú?" (driver: social proof, audience: madres)
- Examples of BAD generic copy (NEVER do this):
  * "La mejor experiencia te espera"
  * "Descubre nuestras ofertas"
  * "Calidad que se nota"

CRITICAL RULES:
1. "Zelva" / "Zelva Agencia Creativa" is the agency, NOT the brand. Identify the actual brand from the document.
2. FLAWLESS SPANISH: Zero spelling mistakes, correct tildes, punctuation.
3. CHARACTER LIMITS FROM THE DOCUMENT ARE LAW. Read the "Texto" column and respect it exactly.
4. PROCESS EVERY ROW. Count rows first. If 50 rows → 50 creatives. If 30 → 30. NEVER stop early. NEVER skip.
5. Each row = 1 creative in the output array, in the same order as the input.
6. EVERY SINGLE COPY MUST BE UNIQUE. No two creatives should have the same title or copy text.

MASTER PROMPT (for AI image generator, focused on text placement):
ENGLISH: "Commercial advertisement for [Brand]. [Medio] [Formato de Anuncio] format. Clean, professional layout.
HEADLINE TEXT: Bold typography reading exactly: '[Title]'.
BODY TEXT: Supporting text reading exactly: '[Copy]'.
Layout: Zoomed out, wide margins, all text visible. No cropping.
Color palette: [Brand colors]. Dimensions: [Tamaño]. File: [Formato]."

SPANISH: Exact translation.

For each row return:
- id: sequential "creative-1", "creative-2", etc.
- identifiedBrand: actual brand name
- medio: platform from MEDIO column (e.g., "META", "DV360", "TIKTOK")
- formatoAnuncio: from "Formato de Anuncio" column
- creativo: from "Creativo" column (Imagen, Video, etc.)
- formatAndSize: from "Tamaño" column
- formato: file format from "Formato" column
- peso: weight limit from "Peso" column
- textoSpec: the RAW text from the "Texto" column (e.g., "Texto: 200 Caracteres")
- maxTitleChars: extracted max title characters from "Texto" column (number only)
- maxCopyChars: extracted max copy characters from "Texto" column (number only)
- objetivo: from "OBJETIVO" column
- geografia: from "GEOGRAFIA" column
- audienciaMacro: from AUDIENCIAS column (the macro segment)
- audienciaReferencia: full comma-separated list from AUDIENCIAS REFERENCIA column
- audienciaReferenciaElegida: the ONE specific micro persona you chose for THIS row's creative
- driverComunicacion: from driver column if exists, otherwise ""
- campaignContext: "Audiencia: [MACRO] | Para: [MICRO elegida] | Objetivo: [OBJETIVO]"
- suggestedTitle: in Spanish, respecting maxTitleChars limit. COUNT CHARACTERS.
- suggestedCopy: in Spanish, respecting maxCopyChars limit. COUNT CHARACTERS.
- brandGuidelines: colors, tone, composition rules in Spanish
- masterPromptEn: English master prompt with text placement
- masterPromptEs: Spanish master prompt
- resizePrompt: "Seamlessly extend the background to fit the new canvas size, maintaining exact lighting, textures, and visual style. STRICTLY preserve all existing text, titles, copy, and prices without alterations or distortions. Keep main subjects untouched and preserve negative space."

IMPORTANT: Process ALL rows (up to 80). Do NOT stop early.

Input document:
${truncatedInput}
`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            creatives: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  identifiedBrand: { type: Type.STRING },
                  medio: { type: Type.STRING, description: "Platform: META, DV360, TIKTOK, YOUTUBE, etc." },
                  formatoAnuncio: { type: Type.STRING, description: "Ad format: Link Ad, Stories, Banners, Native Ads, etc." },
                  creativo: { type: Type.STRING, description: "Creative type: Imagen, Video, Estandar" },
                  formatAndSize: { type: Type.STRING, description: "Dimensions from Tamaño column" },
                  formato: { type: Type.STRING, description: "File format: JPG, PNG, MP4, etc." },
                  peso: { type: Type.STRING, description: "File weight limit" },
                  textoSpec: { type: Type.STRING, description: "Raw text spec from Texto column" },
                  maxTitleChars: { type: Type.NUMBER, description: "Max title characters extracted from Texto column" },
                  maxCopyChars: { type: Type.NUMBER, description: "Max copy characters extracted from Texto column" },
                  objetivo: { type: Type.STRING, description: "Campaign objective" },
                  geografia: { type: Type.STRING, description: "Geographic targeting" },
                  audienciaMacro: { type: Type.STRING, description: "MACRO audience from AUDIENCIAS column (e.g., Generación Energía)" },
                  audienciaReferencia: { type: Type.STRING, description: "Full list of micro personas from AUDIENCIAS REFERENCIA column" },
                  audienciaReferenciaElegida: { type: Type.STRING, description: "The ONE specific micro persona chosen for THIS creative (e.g., La guerrera del gimnasio)" },
                  driverComunicacion: { type: Type.STRING, description: "Communication driver if present" },
                  campaignContext: { type: Type.STRING },
                  suggestedTitle: { type: Type.STRING, description: "Title respecting maxTitleChars" },
                  suggestedCopy: { type: Type.STRING, description: "Copy respecting maxCopyChars" },
                  brandGuidelines: { type: Type.STRING },
                  masterPromptEn: { type: Type.STRING },
                  masterPromptEs: { type: Type.STRING },
                  resizePrompt: { type: Type.STRING }
                },
                required: ["id", "identifiedBrand", "medio", "formatoAnuncio", "creativo", "formatAndSize", "formato", "peso", "textoSpec", "maxTitleChars", "maxCopyChars", "objetivo", "geografia", "audienciaMacro", "audienciaReferencia", "audienciaReferenciaElegida", "campaignContext", "suggestedTitle", "suggestedCopy", "brandGuidelines", "masterPromptEn", "masterPromptEs", "resizePrompt"]
              }
            }
          },
          required: ["creatives"]
        }
      }
    });

    let response: any;
    try {
      response = await Promise.race([callGemini(false), timeoutPromise]) as any;
    } catch (primaryErr: any) {
      const msg = primaryErr?.message || '';
      if ((msg.includes('403') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('leaked')) && GEMINI_KEY_BACKUP) {
        console.warn('Primary API key failed, retrying with backup key...');
        response = await Promise.race([callGemini(true), timeoutPromise]) as any;
      } else {
        throw primaryErr;
      }
    }

    const text = response.text;
    if (!text) throw new Error("La IA no devolvió ninguna respuesta.");

    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    if (!parsed.creatives || !Array.isArray(parsed.creatives)) {
      throw new Error("El formato de respuesta de la IA no es válido.");
    }

    // Post-process: enforce character limits from each row's spec
    parsed.creatives.forEach((c: CreativeSpec) => {
      const titleMax = c.maxTitleChars || 40;
      const copyMax = c.maxCopyChars || 200;
      if (c.suggestedTitle && c.suggestedTitle.length > titleMax) {
        c.suggestedTitle = c.suggestedTitle.substring(0, titleMax).replace(/\s+\S*$/, '');
      }
      if (c.suggestedCopy && c.suggestedCopy.length > copyMax) {
        c.suggestedCopy = c.suggestedCopy.substring(0, copyMax).replace(/\s+\S*$/, '');
      }
      // Defaults
      c.medio = c.medio || '';
      c.formatoAnuncio = c.formatoAnuncio || '';
      c.creativo = c.creativo || '';
      c.formato = c.formato || '';
      c.peso = c.peso || '';
      c.textoSpec = c.textoSpec || '';
      c.maxTitleChars = titleMax;
      c.maxCopyChars = copyMax;
      c.objetivo = c.objetivo || '';
      c.geografia = c.geografia || '';
      c.audienciaMacro = c.audienciaMacro || '';
      c.audienciaReferencia = c.audienciaReferencia || '';
      c.audienciaReferenciaElegida = c.audienciaReferenciaElegida || '';
      c.driverComunicacion = c.driverComunicacion || '';
    });

    return parsed.creatives;
  } catch (error: any) {
    console.error("Error in extractAndOptimizePrompts:", error);
    throw new Error(error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED") ? "Se ha alcanzado el límite de uso de la IA (Error 429). Por favor, intenta de nuevo en unos minutos." : (error.message || "Error de conexión con la IA al analizar el texto."));
  }
}

export async function regenerateCopy(
  creative: CreativeSpec,
  fieldType: 'title' | 'copy',
  feedback: string
): Promise<{ newText: string; updatedMasterPromptEn: string; updatedMasterPromptEs: string }> {
  const charLimit = fieldType === 'title' ? (creative.maxTitleChars || 40) : (creative.maxCopyChars || 200);
  const currentText = fieldType === 'title' ? creative.suggestedTitle : creative.suggestedCopy;
  const fieldName = fieldType === 'title' ? 'Title' : 'Copy';

  try {
    const callRegenerate = (useBackup = false) => getAI(useBackup).models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an Expert Copywriter and Prompt Engineer specializing in DCO (Dynamic Creative Optimization).

Task:
1. Regenerate the ad ${fieldName} based on the user's feedback.
2. Update the Master Prompts to include the new text.

Context:
- Brand: ${creative.identifiedBrand}
- Platform: ${creative.medio} — ${creative.formatoAnuncio}
- Audience: ${creative.audienciaReferencia || 'General'}
- Driver: ${creative.driverComunicacion || 'N/A'}
- Campaign Context: ${creative.campaignContext}
- Current ${fieldName}: "${currentText}"
- Current Master Prompt (EN): "${creative.masterPromptEn}"
- Current Master Prompt (ES): "${creative.masterPromptEs}"
- User Feedback: "${feedback}"

CRITICAL: Maximum ${charLimit} characters including spaces. COUNT EVERY CHARACTER. Rewrite shorter if over.
FLAWLESS SPANISH. Correct accents and punctuation.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            newText: { type: Type.STRING, description: `Regenerated text, max ${charLimit} chars` },
            updatedMasterPromptEn: { type: Type.STRING },
            updatedMasterPromptEs: { type: Type.STRING }
          },
          required: ["newText", "updatedMasterPromptEn", "updatedMasterPromptEs"]
        }
      }
    });

    let response: any;
    try {
      response = await callRegenerate(false);
    } catch (primaryErr: any) {
      const msg = primaryErr?.message || '';
      if ((msg.includes('403') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('leaked')) && GEMINI_KEY_BACKUP) {
        console.warn('Primary API key failed in regenerate, retrying with backup...');
        response = await callRegenerate(true);
      } else {
        throw primaryErr;
      }
    }

    const text = response.text;
    if (!text) throw new Error("La IA no devolvió ninguna respuesta.");

    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    let newText = parsed.newText || '';
    if (newText.length > charLimit) {
      newText = newText.substring(0, charLimit).replace(/\s+\S*$/, '');
    }

    return {
      newText,
      updatedMasterPromptEn: parsed.updatedMasterPromptEn,
      updatedMasterPromptEs: parsed.updatedMasterPromptEs
    };
  } catch (error: any) {
    console.error("Error in regenerateCopy:", error);
    throw new Error(error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED") ? "Se ha alcanzado el límite de uso de la IA (Error 429). Por favor, intenta de nuevo en unos minutos." : (error.message || "Error al regenerar el texto."));
  }
}
