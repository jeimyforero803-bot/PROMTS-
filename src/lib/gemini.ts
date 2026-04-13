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
- ALWAYS count characters before returning. If over the limit, rewrite shorter.
- The copy must be tailored to the platform (MEDIO), the chosen MICRO audience, and driver.

STEP 4 — AUDIENCE-SPECIFIC COPY STRATEGY:
- Each MICRO persona has a unique worldview. Speak to THEIR specific reality.
- The title and copy must feel like it was written BY someone who understands that specific persona.
- NEVER use the same copy for different micro personas even if they share a macro audience.

STEP 5 — UNDERSTAND CREATIVE CONTEXT & INDUSTRY TERMINOLOGY:
- "Cápsulas Hero": Short, punchy call-to-action pieces. NOT about the product — attention-grabbing micro-moments. Bold statement + CTA.
- "Hero": Main flagship creative — high impact, big idea.
- "Awareness": Top-of-funnel — emotional, memorable, not hard-sell.
- "Conversión": Bottom-funnel — action NOW, CTA-heavy, urgency.

STEP 6 — DISRUPTIVE, NON-GENERIC COPY:
- NO generic messages like "Descubre lo mejor". BANNED.
- Use provocative questions, bold statements, unexpected angles, emotional triggers.
- Each creative = UNIQUE concept. Vary tone: playful, bold, emotional, data-driven.
- EVERY SINGLE COPY MUST BE UNIQUE. No two creatives with same title or copy.

CRITICAL RULES:
1. "Zelva" / "Zelva Agencia Creativa" is the agency, NOT the brand.
2. FLAWLESS SPANISH: Zero spelling mistakes, correct tildes.
3. CHARACTER LIMITS FROM THE DOCUMENT ARE LAW.
4. PROCESS EVERY ROW. 1 row = 1 creative. NEVER stop early.
5. Each row in output array matches input order.`;

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
          brandGuidelines: { type: "STRING" },
          masterPromptEn: { type: "STRING" },
          masterPromptEs: { type: "STRING" },
          resizePrompt: { type: "STRING" }
        },
        required: ["id", "identifiedBrand", "medio", "formatoAnuncio", "creativo", "formatAndSize", "formato", "peso", "textoSpec", "maxTitleChars", "maxCopyChars", "objetivo", "geografia", "audienciaMacro", "audienciaReferencia", "audienciaReferenciaElegida", "campaignContext", "suggestedTitle", "suggestedCopy", "brandGuidelines", "masterPromptEn", "masterPromptEs", "resizePrompt"]
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
      if (c.suggestedTitle && c.suggestedTitle.length > titleMax) {
        c.suggestedTitle = c.suggestedTitle.substring(0, titleMax).replace(/\s+\S*$/, '');
      }
      if (c.suggestedCopy && c.suggestedCopy.length > copyMax) {
        c.suggestedCopy = c.suggestedCopy.substring(0, copyMax).replace(/\s+\S*$/, '');
      }
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
    throw new Error(error.message || "Error de conexión con la IA al analizar el texto.");
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
- Current Master Prompt (ES): "${creative.masterPromptEs}"
- Feedback: "${feedback}"

CRITICAL: Max ${charLimit} characters. COUNT THEM. FLAWLESS SPANISH.`;

    const text = await callProxy(prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          newText: { type: "STRING" },
          updatedMasterPromptEn: { type: "STRING" },
          updatedMasterPromptEs: { type: "STRING" }
        },
        required: ["newText", "updatedMasterPromptEn", "updatedMasterPromptEs"]
      }
    });

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
    throw new Error(error.message || "Error al regenerar el texto.");
  }
}
