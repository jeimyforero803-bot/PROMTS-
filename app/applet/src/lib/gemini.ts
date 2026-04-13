import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  // Truncate input to prevent massive payloads that can cause the model to hang
  const truncatedInput = inputText.slice(0, 15000);

  try {
    // We use Promise.race to add a timeout just in case the API hangs, increased to 3 minutes for large requests
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("La solicitud a la IA ha tardado demasiado (Timeout). Intenta con menos texto.")), 180000);
    });

    const apiPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an Expert Prompt Engineer specializing in DCO (Dynamic Creative Optimization), Copywriting, and Brand Consistency.
      
The user has provided a document (parsed from Excel/CSV/Text) containing creative specifications from their client.
Your goal is to generate a "Master Prompt" (Prompt Maestro) for each distinct request in the document, AND generate suggested copywriting based on the theme.

CRITICAL RULES:
1. "Zelva" (or Zelva Agencia Creativa) is the creative agency responsible for the request, IT IS NOT THE BRAND. Do not use Zelva as the brand in the copy or prompts.
2. IDENTIFY THE ACTUAL BRAND: You must deduce the actual brand from the original filename (provided at the top of the input like [Nombre del archivo original: ...]) or the document content. 
   - CRITICAL: If the filename contains "etb" or "ETB", the brand is STRICTLY "ETB".
   - CRITICAL: Do NOT confuse the campaign name or program name (e.g., "Academia Conectada") with the brand. "Academia Conectada" is a campaign/program, the brand is "ETB".
3. Tailor the generated copy, tone, and visual guidelines specifically to the identified brand.
4. You MUST generate the actual copy (Title and Text) based on the requested theme and the identified brand.
5. FLAWLESS SPANISH & ORTHOGRAPHY: The native language is Spanish. You must ensure absolute perfection in spelling, grammar, and orthography. ZERO spelling mistakes are allowed in the generated copy, titles, or Spanish prompts. Pay maximum attention to accents (tildes) and punctuation.
6. INTEGRATE COPY INTO MASTER PROMPT: You MUST explicitly integrate the generated "Suggested Title" and "Suggested Copy" inside the Master Prompt itself.

For each distinct row/request in the input, generate a complete DCO Master Prompt package containing:
1. Identified Brand: The actual brand name you identified for this request (e.g., "ETB").
2. Format & Size: Extract the requested dimensions, aspect ratio, or format (e.g., "1080x1080", "16:9", "Story 1080x1920"). If not specified, suggest a standard digital format based on the context.
3. Campaign Context: Brief summary of the campaign objective in Spanish based on the row data.
4. Suggested Title: Create a catchy title in Spanish based on the theme and brand. STRICTLY maximum 30 characters including spaces. FLAWLESS ORTHOGRAPHY.
5. Suggested Copy: Create compelling ad text in Spanish based on the theme and brand. STRICTLY maximum 90 characters including spaces. FLAWLESS ORTHOGRAPHY.
6. Brand Guidelines & Layout: Extracted rules for colors, tone, and layout/safe zones. (In Spanish)

IMPORTANT: Process all distinct requests in the input. Limit your response to a maximum of 20 creatives to avoid timeouts. Ignore empty rows or invalid data.

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
                  id: { type: Type.STRING, description: "A unique identifier for this creative" },
                  identifiedBrand: { type: Type.STRING, description: "The actual brand name identified from the document (e.g., ETB), ignoring 'Zelva' which is just the agency." },
                  formatAndSize: { type: Type.STRING, description: "The specific format, dimensions, or aspect ratio (e.g., 1080x1080, 16:9, Story)" },
                  campaignContext: { type: Type.STRING, description: "Brief summary of the campaign objective" },
                  suggestedTitle: { type: Type.STRING, description: "Suggested title in Spanish, STRICTLY max 30 chars" },
                  suggestedCopy: { type: Type.STRING, description: "Suggested ad text in Spanish, STRICTLY max 90 chars" },
                  brandGuidelines: { type: Type.STRING, description: "Rules for colors, lighting, tone, and layout/safe zones" }
                },
                required: ["id", "identifiedBrand", "formatAndSize", "campaignContext", "suggestedTitle", "suggestedCopy", "brandGuidelines"]
              }
            }
          },
          required: ["creatives"]
        }
      }
    });

    const response = await Promise.race([apiPromise, timeoutPromise]) as any;

    const text = response.text;
    if (!text) throw new Error("La IA no devolvió ninguna respuesta.");
    
    // Clean up potential markdown formatting around JSON
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    
    if (!parsed.creatives || !Array.isArray(parsed.creatives)) {
      throw new Error("El formato de respuesta de la IA no es válido.");
    }

    // Hardcode the prompts to guarantee the exact raw string format requested by the user
    return parsed.creatives.map((c: any) => ({
      ...c,
      masterPromptEn: `take as a reference this creative and generate 5 different variants with this image. respect the logo 100% faithful and the identity of the brand ${c.identifiedBrand}. change the background environment and the character to: ${c.campaignContext}. take the same font and Include the exact text '${c.suggestedTitle}' and '${c.suggestedCopy}' ensuring flawless spelling. be faithful to the initial logo and the graphic lines.`,
      masterPromptEs: `toma como referencia este creativo y genera 5 variantes diferentes con esta imagen. respeta el logo 100% fiel y la identidad de la marca ${c.identifiedBrand}. cambia el entorno de fondo y el personaje a: ${c.campaignContext}. toma la misma fuente e incluye el texto exacto '${c.suggestedTitle}' y '${c.suggestedCopy}' asegurando una ortografía impecable. sé fiel al logo inicial y las líneas gráficas.`,
      resizePrompt: `Seamlessly extend the background to fit the new canvas size, maintaining the exact lighting, textures, and visual style of the original image. STRICTLY preserve all existing text, titles, copy, and prices without any alterations or distortions. Keep the main subjects completely untouched and preserve negative space.`
    }));
  } catch (error: any) {
    console.error("Error in extractAndOptimizePrompts:", error);
    if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Se ha alcanzado el límite de uso de la IA (Error 429). Por favor, intenta de nuevo en unos minutos.");
    }
    throw new Error(error.message || "Error de conexión con la IA al analizar el texto.");
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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an Expert Copywriter and Prompt Engineer specializing in DCO (Dynamic Creative Optimization).
      
Task: 
1. Regenerate the ad ${fieldName} based on the user's feedback.

Context:
- Brand: ${creative.identifiedBrand}
- Campaign Context: ${creative.campaignContext}
- Current ${fieldName}: "${currentText}"
- User Feedback / Instructions: "${feedback}"

CRITICAL RULES:
1. FLAWLESS SPANISH & ORTHOGRAPHY: The output text must be in perfect Spanish with zero spelling mistakes, correct accents (tildes), and punctuation.
2. STRICT CHARACTER LIMIT: Maximum ${charLimit} characters including spaces for the new text.
3. Tailor the tone and message specifically to the user's feedback and the brand.

Return the newly generated text.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            newText: { type: Type.STRING, description: `The regenerated text in Spanish, strictly max ${charLimit} chars.` }
          },
          required: ["newText"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("La IA no devolvió ninguna respuesta.");
    
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    
    const newTitle = fieldType === 'title' ? parsed.newText : creative.suggestedTitle;
    const newCopy = fieldType === 'copy' ? parsed.newText : creative.suggestedCopy;

    return {
      newText: parsed.newText,
      updatedMasterPromptEn: `take as a reference this creative and generate 5 different variants with this image. respect the logo 100% faithful and the identity of the brand ${creative.identifiedBrand}. change the background environment and the character to: ${creative.campaignContext}. take the same font and Include the exact text '${newTitle}' and '${newCopy}' ensuring flawless spelling. be faithful to the initial logo and the graphic lines.`,
      updatedMasterPromptEs: `toma como referencia este creativo y genera 5 variantes diferentes con esta imagen. respeta el logo 100% fiel y la identidad de la marca ${creative.identifiedBrand}. cambia el entorno de fondo y el personaje a: ${creative.campaignContext}. toma la misma fuente e incluye el texto exacto '${newTitle}' and '${newCopy}' asegurando una ortografía impecable. sé fiel al logo inicial y las líneas gráficas.`
    };
  } catch (error: any) {
    console.error("Error in regenerateCopy:", error);
    if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Se ha alcanzado el límite de uso de la IA (Error 429). Por favor, intenta de nuevo en unos minutos.");
    }
    throw new Error(error.message || "Error al regenerar el texto.");
  }
}
