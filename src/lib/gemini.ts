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
  copyPrincipal: string;
  desarrollo: string;
  cierre: string;
  brandGuidelines: string;
  masterPromptEn: string;
  resizePrompt: string;
}

// Call server-side proxy — API key never touches the browser
async function callProxy(contents: string, config: any): Promise<string> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, config }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || JSON.stringify(data);
    throw new Error(msg);
  }
  return data.text;
}

const PROMPT_PREFIX = `You are an Expert Prompt Engineer specializing in DCO (Dynamic Creative Optimization), Audience Strategy, and Brand Consistency.

The user uploaded a document (Excel/CSV) with creative specifications. You MUST read and understand EVERY column.

STEP 0 — IDENTIFY THE BRAND:
The BRAND is usually in the FILE NAME (shown as "[Nombre del archivo original: ...]") or in the TITLE/FIRST ROWS of the document.
Examples: if filename says "Tarrito Rojo" → brand is "Tarrito Rojo". If it says "ETB_campaña" → brand is "ETB".
"Zelva" or "Zelva Agencia Creativa" is the AGENCY, NEVER the brand. IGNORE it as brand.
Use this identified brand for ALL creatives in identifiedBrand field.

STEP 1 — READ THE CSV HEADER AND MAP EVERY COLUMN:
The input is CSV data. The FIRST line is the header. Read it character by character to identify ALL columns.
You MUST find and use these columns (names may vary slightly but look for them):
- MEDIO → Platform (META, DV360, TIKTOK, YOUTUBE, GOOGLE)
- Formato de Anuncio → Ad format (Link Ad, Stories, Banners, Native Ads, Infeed, Trueview, Shorts)
- Creativo → Creative type (Imagen, Video, Estandar, Cápsulas Hero)
- Tamaño (en pixeles) → Dimensions (1080x1080, 1920x1080, 300x250, 728x90, 1200x627)
- Formato → File format (JPG, PNG, MP4, MOV, GIF, HTML5)
- Peso → File weight limit (80KB, <2.3GB, 40KB, 100k)
- Texto → CHARACTER LIMITS. Read the cell value:
  * "Texto: 200 Caracteres" → maxCopyChars=200, maxTitleChars=40
  * "Título: max 25 Caracteres" → maxTitleChars=25, maxCopyChars=90
  * "de la cuenta: máximo 20 / del anuncio: 100 caracteres" → maxTitleChars=20, maxCopyChars=100
- OBJETIVO → Campaign objective (Awareness, Conversión, Tráfico)
- GEOGRAFIA → Geographic targeting (Nacional, Regional, Ciudad)
- **AUDIENCIAS** → THIS IS THE MACRO audience. MUST READ. Examples: "Generación Energía", "Motores del Día a Día", "Los comprometidos", "Vitalidad Clásica"
- **AUDIENCIAS REFERENCIA** → THIS IS THE MICRO personas (comma-separated). MUST READ. Examples: "La guerrera del gimnasio, La influencer Wellness, el papá proveedor consciente"
- **DRIVER** or **DRIVERS** or **Driver de Comunicación** → The communication angle/motivation. MUST READ if present.

CRITICAL: The CSV may have the columns in ANY order. Use the HEADER to find the column index for each field.
If a column has a similar name (e.g., "AUDIENCIA" instead of "AUDIENCIAS"), still use it.
DO NOT leave audienciaMacro, audienciaReferencia, or driverComunicacion empty if those columns exist in the data.

STEP 2 — MACRO vs MICRO AUDIENCE LOGIC (CRITICAL):
The document has TWO audience columns:
- AUDIENCIAS = MACRO (broad segment). Example: "Generación Energía"
- AUDIENCIAS REFERENCIA = MICRO (specific personas within the macro, comma-separated). Example: "La guerrera del gimnasio, La influencer Wellness, el papá proveedor consciente."

For EACH row, you MUST:
a) Read the MACRO audience from the AUDIENCIAS column → put it in "audienciaMacro"
b) Read ALL the MICRO personas from AUDIENCIAS REFERENCIA → put the full list in "audienciaReferencia"
c) CHOOSE ONE specific micro persona for this creative → put it in "audienciaReferenciaElegida"
d) The suggestedTitle and suggestedCopy MUST be crafted specifically for that chosen micro persona
e) DISTRIBUTE micro personas across rows: if there are 9 rows for "Generación Energía" with 3 micros, assign ~3 rows to each. ROTATE them.
f) The campaignContext MUST clearly state: "Audiencia: [MACRO] | Para: [MICRO elegida] | Objetivo: [OBJETIVO]"

STEP 3 — GENERATE COPY RESPECTING THE EXACT CHARACTER LIMITS FROM THE "Texto" COLUMN:
- READ the "Texto" column for each row. It tells you the max characters.
- If it says "200 Caracteres", your suggestedCopy MUST be ≤200 characters.
- If it says "Título: max 25", your suggestedTitle MUST be ≤25 characters.
- ALWAYS count characters before returning. If over the limit, REWRITE A COMPLETE SHORTER IDEA. Do NOT just cut the text.
- The copy MUST be a COMPLETE THOUGHT — a full sentence or idea that ends naturally. NEVER leave a sentence unfinished.
- The copy must be tailored to the platform (MEDIO), the chosen MICRO audience, and driver.
- NO EMOJIS in titles or copy unless the brand explicitly uses them.
- If the limit is tight (e.g., 25 chars), write a punchy slogan, not a truncated sentence.

STEP 3.5 — STRUCTURE THE COPY INTO 3 PARTS (CRITICAL FOR VIDEO FRAMES & STATICS):
Every creative has 3 text layers that appear sequentially in video frames or as visual hierarchy in statics:
- **copyPrincipal**: The HOOK — the main attention-grabbing line. Bold, provocative, emotional. This is the first thing the viewer reads. Short and punchy.
- **desarrollo**: The BODY — expands on the hook with product benefit, reason-to-believe, or emotional payoff. More informative, connects the hook to the brand/product.
- **cierre**: The CTA/CLOSE — call to action or closing tagline. Short, direct, actionable. Examples: "Tómalo todos los días", "Encuéntralo en tu tienda", "Descarga ahora".
The suggestedCopy field should contain ALL three parts concatenated: "copyPrincipal + desarrollo + cierre".
But you MUST also return each part separately in copyPrincipal, desarrollo, and cierre fields.
The total of all 3 parts must respect the character limit from the Texto column.

STEP 4 — AUDIENCE-SPECIFIC COPY STRATEGY:
- Each MICRO persona has a unique worldview. Speak to THEIR specific reality.
- The title and copy must feel like it was written BY someone who understands that specific persona.
- NEVER use the same copy for different micro personas even if they share a macro audience.
- Write a CONCRETE CONCEPT — a clear creative idea, not filler text. Each copy must have a hook that grabs attention.

STEP 5 — UNDERSTAND CREATIVE CONTEXT & INDUSTRY TERMINOLOGY:
- "Cápsulas Hero": Short, punchy call-to-action pieces. NOT about the product — attention-grabbing micro-moments. Bold statement + CTA.
- "Hero": Main flagship creative — high impact, big idea.
- "Awareness": Top-of-funnel — emotional, memorable, not hard-sell.
- "Conversión": Bottom-funnel — action NOW, CTA-heavy, urgency.

STEP 6 — DISRUPTIVE, NON-GENERIC COPY:
- NO generic messages like "Descubre lo mejor", "Sigue disfrutando", "Te da la vitalidad que necesitas". ALL BANNED.
- Use provocative questions, bold statements, unexpected angles, emotional triggers.
- Each creative = UNIQUE concept with a CLEAR IDEA that stands on its own. Vary tone: playful, bold, emotional, data-driven.
- EVERY SINGLE COPY MUST BE UNIQUE. No two creatives with same title or copy.
- The copy must feel like a professional copywriter wrote it, not a generic AI. Be specific, concrete, and memorable.

STEP 7 — GENERATE masterPromptEn AND resizePrompt FOR EACH CREATIVE:

masterPromptEn (English ONLY) — this is the prompt for AI image generators (Gemini, DALL-E, Midjourney, Mixboard).
It instructs the AI to take a REFERENCE IMAGE (the original ad) and generate variants where:
- The BRAND IDENTITY is SACRED: logo position, brand colors, graphic elements, borders, shapes stay PIXEL-IDENTICAL
- The TEXT/COPY changes to the NEW generated copy (copyPrincipal + desarrollo + cierre)
- The PERSON/CHARACTER changes (different person, same energy/mood)
- The BACKGROUND can adapt but must match the brand's color palette
- The TEXT must be rendered CHARACTER BY CHARACTER with perfect spelling including all accents (á é í ó ú ñ)
- Include the EXACT text that must appear: spell out each word letter by letter in the prompt
- DO NOT generate masterPromptEs — only English is needed

resizePrompt — this is a prompt for INTELLIGENT FORMAT ADAPTATION (not just outpainting).
It must instruct the AI to:
- UNDERSTAND the composition: where the text is, where the person is, where the logo is, what the brand colors are
- RECOMPOSE the layout for the new aspect ratio (e.g., 1080x1080 → 1200x628 banner)
- Keep ALL brand elements (logo, colors, graphic shapes) but REDISTRIBUTE them harmonically for the new format
- The person/character should be repositioned naturally, not stretched
- Text should be repositioned to fit the new layout while maintaining hierarchy
- Background fills should use the brand's color palette, NOT white space
- This is a CREATIVE RECOMPOSITION, not a simple canvas extension

CRITICAL RULES:
1. "Zelva" / "Zelva Agencia Creativa" is the agency, NOT the brand.
2. FLAWLESS SPANISH: Zero spelling mistakes, correct tildes. NO EMOJIS.
3. CHARACTER LIMITS FROM THE DOCUMENT ARE LAW. But the text must be a COMPLETE idea within those limits.
4. PROCESS EVERY ROW. 1 row = 1 creative. NEVER stop early.
5. Each row in output array matches input order.
6. NEVER return a sentence that ends mid-thought or is cut off. Every suggestedTitle and suggestedCopy must read as a finished, polished piece of copy.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    creatives: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          identifiedBrand: { type: "STRING" },
          medio: { type: "STRING" },
          formatoAnuncio: { type: "STRING" },
          creativo: { type: "STRING" },
          formatAndSize: { type: "STRING" },
          formato: { type: "STRING" },
          peso: { type: "STRING" },
          textoSpec: { type: "STRING" },
          maxTitleChars: { type: "NUMBER" },
          maxCopyChars: { type: "NUMBER" },
          objetivo: { type: "STRING" },
          geografia: { type: "STRING" },
          audienciaMacro: { type: "STRING" },
          audienciaReferencia: { type: "STRING" },
          audienciaReferenciaElegida: { type: "STRING" },
          driverComunicacion: { type: "STRING" },
          campaignContext: { type: "STRING" },
          suggestedTitle: { type: "STRING" },
          suggestedCopy: { type: "STRING" },
          copyPrincipal: { type: "STRING" },
          desarrollo: { type: "STRING" },
          cierre: { type: "STRING" },
          brandGuidelines: { type: "STRING" },
          masterPromptEn: { type: "STRING" },
          resizePrompt: { type: "STRING" }
        },
        required: ["id", "identifiedBrand", "medio", "formatoAnuncio", "creativo", "formatAndSize", "formato", "peso", "textoSpec", "maxTitleChars", "maxCopyChars", "objetivo", "geografia", "audienciaMacro", "audienciaReferencia", "audienciaReferenciaElegida", "campaignContext", "suggestedTitle", "suggestedCopy", "copyPrincipal", "desarrollo", "cierre", "brandGuidelines", "masterPromptEn", "resizePrompt"]
      }
    }
  },
  required: ["creatives"]
};

export async function extractAndOptimizePrompts(inputText: string): Promise<CreativeSpec[]> {
  const truncatedInput = inputText.slice(0, 100000);

  try {
    const fullPrompt = `${PROMPT_PREFIX}

For each row return the fields listed above as JSON.

Input document:
${truncatedInput}`;

    const text = await callProxy(fullPrompt, {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    });

    if (!text) throw new Error("La IA no devolvió ninguna respuesta.");

    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    if (!parsed.creatives || !Array.isArray(parsed.creatives)) {
      throw new Error("El formato de respuesta de la IA no es válido.");
    }

    parsed.creatives.forEach((c: CreativeSpec) => {
      const titleMax = c.maxTitleChars || 40;
      const copyMax = c.maxCopyChars || 200;
      // Do NOT truncate — the AI must generate complete ideas within limits.
      // Truncating creates cut-off sentences that are unusable.
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
      c.copyPrincipal = c.copyPrincipal || '';
      c.desarrollo = c.desarrollo || '';
      c.cierre = c.cierre || '';
    });

    return parsed.creatives;
  } catch (error: any) {
    console.error("Error in extractAndOptimizePrompts:", error);
    throw new Error(error.message || "Error de conexión con la IA al analizar el texto.");
  }
}

export async function regenerateCopy(
  creative: CreativeSpec,
  fieldType: 'title' | 'copy',
  feedback: string
): Promise<{ newText: string; updatedMasterPromptEn: string }> {
  const charLimit = fieldType === 'title' ? (creative.maxTitleChars || 40) : (creative.maxCopyChars || 200);
  const currentText = fieldType === 'title' ? creative.suggestedTitle : creative.suggestedCopy;
  const fieldName = fieldType === 'title' ? 'Title' : 'Copy';

  try {
    const prompt = `You are an Expert Copywriter specializing in DCO.

Task: Regenerate the ad ${fieldName} based on feedback. Update Master Prompts.

Context:
- Brand: ${creative.identifiedBrand}
- Platform: ${creative.medio} — ${creative.formatoAnuncio}
- Macro Audience: ${creative.audienciaMacro || 'General'}
- Micro Persona: ${creative.audienciaReferenciaElegida || 'General'}
- Driver: ${creative.driverComunicacion || 'N/A'}
- Campaign: ${creative.campaignContext}
- Current ${fieldName}: "${currentText}"
- Current Master Prompt (EN): "${creative.masterPromptEn}"
- Feedback: "${feedback}"

CRITICAL: Max ${charLimit} characters. COUNT THEM. FLAWLESS SPANISH. Generate a DIFFERENT creative concept — not a minor rewording but a genuinely new angle/idea.`;

    const text = await callProxy(prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          newText: { type: "STRING" },
          updatedMasterPromptEn: { type: "STRING" }
        },
        required: ["newText", "updatedMasterPromptEn"]
      }
    });

    if (!text) throw new Error("La IA no devolvió ninguna respuesta.");
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    const newText = parsed.newText || '';

    return {
      newText,
      updatedMasterPromptEn: parsed.updatedMasterPromptEn
    };
  } catch (error: any) {
    console.error("Error in regenerateCopy:", error);
    throw new Error(error.message || "Error al regenerar el texto.");
  }
}

/**
 * Generate a completely new variant of ALL copy fields (title, copyPrincipal, desarrollo, cierre).
 * Produces a fresh creative concept for the same audience/platform specs.
 */
export async function generateVariant(
  creative: CreativeSpec
): Promise<{ suggestedTitle: string; suggestedCopy: string; copyPrincipal: string; desarrollo: string; cierre: string; masterPromptEn: string }> {
  const titleLimit = creative.maxTitleChars || 40;
  const copyLimit = creative.maxCopyChars || 200;

  try {
    const prompt = `You are an Expert Copywriter specializing in DCO (Dynamic Creative Optimization).

Task: Generate a COMPLETELY NEW creative variant — a fresh concept, angle, and tone. NOT a rewording of the current copy.

Context:
- Brand: ${creative.identifiedBrand}
- Platform: ${creative.medio} — ${creative.formatoAnuncio}
- Creative Type: ${creative.creativo}
- Format: ${creative.formatAndSize}
- Macro Audience: ${creative.audienciaMacro || 'General'}
- Micro Persona: ${creative.audienciaReferenciaElegida || 'General'}
- Driver: ${creative.driverComunicacion || 'N/A'}
- Campaign: ${creative.campaignContext}
- Objective: ${creative.objetivo || 'Awareness'}

CURRENT COPY (generate something DIFFERENT from this):
- Title: "${creative.suggestedTitle}"
- Copy Principal: "${creative.copyPrincipal}"
- Desarrollo: "${creative.desarrollo}"
- Cierre: "${creative.cierre}"

RULES:
- suggestedTitle: max ${titleLimit} characters. A COMPLETE idea, not truncated.
- Total of copyPrincipal + desarrollo + cierre: max ${copyLimit} characters combined.
- copyPrincipal = HOOK — attention-grabbing opening line.
- desarrollo = BODY — product benefit, reason-to-believe.
- cierre = CTA — short, actionable call to action.
- suggestedCopy = concatenation of all three parts.
- FLAWLESS SPANISH. Zero spelling errors. Correct tildes (á é í ó ú ñ).
- NO generic filler ("Descubre lo mejor", "Sigue disfrutando"). Be bold, specific, memorable.
- This must be a genuinely DIFFERENT creative concept — different hook, different angle, different emotional trigger.
- masterPromptEn: English prompt for Mixboard/image AI using the NEW copy text.

masterPromptEn format:
"take as a reference this creative and generate 5 different variants with this image. respect the logo 100% faithful and the identity of the brand ${creative.identifiedBrand}. change the background environment and the character to: ${creative.campaignContext || creative.audienciaReferenciaElegida || 'a different setting'}. take the same font and Include the exact text '[NEW COPY PRINCIPAL]' and '[NEW DESARROLLO]' ensuring flawless spelling. be faithful to the initial logo and the graphic lines."`;

    const text = await callProxy(prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          suggestedTitle: { type: "STRING" },
          suggestedCopy: { type: "STRING" },
          copyPrincipal: { type: "STRING" },
          desarrollo: { type: "STRING" },
          cierre: { type: "STRING" },
          masterPromptEn: { type: "STRING" }
        },
        required: ["suggestedTitle", "suggestedCopy", "copyPrincipal", "desarrollo", "cierre", "masterPromptEn"]
      }
    });

    if (!text) throw new Error("La IA no devolvió ninguna respuesta.");
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    return {
      suggestedTitle: parsed.suggestedTitle || '',
      suggestedCopy: parsed.suggestedCopy || '',
      copyPrincipal: parsed.copyPrincipal || '',
      desarrollo: parsed.desarrollo || '',
      cierre: parsed.cierre || '',
      masterPromptEn: parsed.masterPromptEn || ''
    };
  } catch (error: any) {
    console.error("Error in generateVariant:", error);
    throw new Error(error.message || "Error al generar variante.");
  }
}
