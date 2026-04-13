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
  formatAndSize: string;
  campaignContext: string;
  suggestedTitle: string;
  suggestedCopy: string;
  brandGuidelines: string;
  masterPromptEn: string;
  masterPromptEs: string;
  resizePrompt: string;
}

export async function extractAndOptimizePrompts(inputText: string): Promise<CreativeSpec[]> {
  // Allow up to 100KB to support 80+ rows with audience data
  const truncatedInput = inputText.slice(0, 100000);

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("La solicitud a la IA ha tardado demasiado (Timeout). Intenta con menos texto.")), 300000);
    });

    const callGemini = async (useBackup = false) => getAI(useBackup).models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an Expert Prompt Engineer specializing in DCO (Dynamic Creative Optimization), Audience Strategy, Copywriting, and Brand Consistency.

The user has provided a document (parsed from Excel/CSV/Text) containing creative specifications.
Your PRIMARY goals:
A) IDENTIFY every unique "Audiencia Referencia" (reference audience) column/grouping in the data.
B) For EACH reference audience, understand the COMMUNICATION DRIVERS — what motivates that specific audience, what pain points they have, what messaging resonates with them.
C) Generate creatives that speak to HOW to reach the GENERAL audience THROUGH the specific reference audience. The copy and context must reflect the audience's language, interests, and triggers.
D) Generate a "Master Prompt" for each row focused on text placement.

AUDIENCE STRATEGY LOGIC:
- Each "Audiencia Referencia" is a SPECIFIC sub-segment that serves as the entry point to reach a broader general audience.
- The COMMUNICATION DRIVER tells you WHY this audience cares, WHAT motivates their action.
- Your suggestedTitle and suggestedCopy MUST reflect the driver and speak directly to that reference audience's mindset.
- Different reference audiences for the same brand MUST have different copy angles — never repeat the same generic message.
- Example: If driver is "precio" for "Familias ahorrativas", copy should emphasize savings. If driver is "innovación" for "Early adopters tech", copy should emphasize novelty.

CRITICAL RULES:
1. "Zelva" (or Zelva Agencia Creativa) is the creative agency, IT IS NOT THE BRAND. Never use Zelva as the brand.
2. IDENTIFY THE ACTUAL BRAND from the document's title, headers, or content (e.g., "ETB", "Colgate", "Samsung").
3. FLAWLESS SPANISH & ORTHOGRAPHY: Zero spelling mistakes. Perfect accents (tildes) and punctuation.
4. CHARACTER LIMITS ARE ABSOLUTE AND NON-NEGOTIABLE:
   - suggestedTitle: MAXIMUM 30 characters including spaces. Count EVERY character. If it exceeds 30, shorten it.
   - suggestedCopy: MAXIMUM 90 characters including spaces. Count EVERY character. If it exceeds 90, shorten it.
   - BEFORE returning each title/copy, mentally count the characters. If over the limit, rewrite shorter.
5. PROCESS EVERY SINGLE ROW: You MUST generate one creative per row in the input. If there are 50 rows, return 50 creatives. If there are 60, return 60. NEVER stop early. NEVER skip rows. Count the rows first, then generate that exact number.
6. If the document has columns like "Audiencia", "Audiencia Referencia", "Driver", "Comunicación", "Mensaje", "Insight" — USE THEM to differentiate the copy per audience.

THE MASTER PROMPT MUST FOCUS ON TEXT PLACEMENT:
The Master Prompt is for an AI image generator. Its primary job is to tell the AI WHERE and HOW to place the Title and Copy text onto a creative/ad visual. The prompt structure must be:

ENGLISH Master Prompt structure:
"Commercial advertisement for [Brand]. Clean, professional layout with [Brand colors/style].
HEADLINE TEXT: Bold, prominent typography at the [top/center] that reads exactly: '[Suggested Title]'.
BODY TEXT: Smaller supporting text that reads exactly: '[Suggested Copy]'.
[If price exists]: Price displayed prominently: '[Price]'.
Layout: Zoomed out, wide margins, all text fully visible inside the canvas. No cropping, no cut-off text.
Color palette: [Brand colors]. [Format: dimensions]."

SPANISH Master Prompt: Exact translation of the English version.

For each row generate:
1. identifiedBrand: The actual brand name.
2. formatAndSize: Dimensions from the document (e.g., "1080x1080", "300x250"). If not specified, use "1080x1080".
3. campaignContext: In Spanish — include the reference audience name, the communication driver, and the campaign objective. E.g., "Audiencia: Familias ahorrativas | Driver: Precio accesible | Objetivo: Generar awareness de promoción escolar".
4. suggestedTitle: In Spanish, tailored to the specific reference audience and driver. STRICTLY ≤30 characters. COUNT THEM.
5. suggestedCopy: In Spanish, tailored to the specific reference audience and driver. STRICTLY ≤90 characters. COUNT THEM.
6. brandGuidelines: Colors, tone, layout rules in Spanish.
7. masterPromptEn: English Master Prompt focused on text placement (structure above).
8. masterPromptEs: Spanish Master Prompt (translation of above).
9. resizePrompt: "Seamlessly extend the background to fit the new canvas size, maintaining exact lighting, textures, and visual style. STRICTLY preserve all existing text, titles, copy, and prices without alterations or distortions. Keep main subjects untouched and preserve negative space."

IMPORTANT:
- Count the input rows FIRST. Then generate EXACTLY that many creatives (up to 80).
- Do NOT stop at 14, 20, or 24. Process ALL rows.
- Each creative must have UNIQUE copy tailored to its specific audience + driver combination.

Input specifications (Client Requirements):
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
                  id: { type: Type.STRING, description: "Unique identifier for this creative" },
                  identifiedBrand: { type: Type.STRING, description: "The actual brand name (not Zelva)" },
                  formatAndSize: { type: Type.STRING, description: "Dimensions (e.g., 1080x1080)" },
                  campaignContext: { type: Type.STRING, description: "Campaign objective in Spanish" },
                  suggestedTitle: { type: Type.STRING, description: "Title in Spanish, STRICTLY max 30 chars including spaces" },
                  suggestedCopy: { type: Type.STRING, description: "Ad text in Spanish, STRICTLY max 90 chars including spaces" },
                  brandGuidelines: { type: Type.STRING, description: "Colors, tone, layout rules" },
                  masterPromptEn: { type: Type.STRING, description: "English prompt focused on text placement in the creative" },
                  masterPromptEs: { type: Type.STRING, description: "Spanish prompt focused on text placement in the creative" },
                  resizePrompt: { type: Type.STRING, description: "Universal outpainting/resize prompt" }
                },
                required: ["id", "identifiedBrand", "formatAndSize", "campaignContext", "suggestedTitle", "suggestedCopy", "brandGuidelines", "masterPromptEn", "masterPromptEs", "resizePrompt"]
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

    // Post-process: enforce character limits strictly
    parsed.creatives.forEach((c: CreativeSpec) => {
      if (c.suggestedTitle && c.suggestedTitle.length > 30) {
        c.suggestedTitle = c.suggestedTitle.substring(0, 30).replace(/\s+\S*$/, '');
      }
      if (c.suggestedCopy && c.suggestedCopy.length > 90) {
        c.suggestedCopy = c.suggestedCopy.substring(0, 90).replace(/\s+\S*$/, '');
      }
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
  const charLimit = fieldType === 'title' ? 30 : 90;
  const currentText = fieldType === 'title' ? creative.suggestedTitle : creative.suggestedCopy;
  const fieldName = fieldType === 'title' ? 'Title' : 'Copy';

  try {
    const callRegenerate = (useBackup = false) => getAI(useBackup).models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an Expert Copywriter and Prompt Engineer specializing in DCO (Dynamic Creative Optimization).

Task:
1. Regenerate the ad ${fieldName} based on the user's feedback.
2. Update the Master Prompts to explicitly include this new ${fieldName} text instead of the old one.
3. The Master Prompt focuses on TEXT PLACEMENT — where and how to display the title and copy on the creative.

Context:
- Brand: ${creative.identifiedBrand}
- Campaign Context: ${creative.campaignContext}
- Current ${fieldName}: "${currentText}"
- Current Master Prompt (EN): "${creative.masterPromptEn}"
- Current Master Prompt (ES): "${creative.masterPromptEs}"
- User Feedback / Instructions: "${feedback}"

CRITICAL RULES:
1. FLAWLESS SPANISH & ORTHOGRAPHY: Zero spelling mistakes, correct accents (tildes), punctuation.
2. STRICT CHARACTER LIMIT: Maximum ${charLimit} characters including spaces. COUNT EVERY CHARACTER before returning. If over the limit, rewrite shorter.
3. Tailor the tone and message to the user's feedback and the brand.
4. Replace the old ${fieldName} text in both Master Prompts with the new one.

Return the newly generated text AND the updated master prompts.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            newText: { type: Type.STRING, description: `The regenerated text in Spanish, strictly max ${charLimit} chars.` },
            updatedMasterPromptEn: { type: Type.STRING, description: "The updated Master Prompt in English with new text." },
            updatedMasterPromptEs: { type: Type.STRING, description: "The updated Master Prompt in Spanish with new text." }
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

    // Enforce char limit on regenerated text
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
