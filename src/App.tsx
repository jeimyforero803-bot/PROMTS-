/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { extractAndOptimizePrompts, regenerateCopy, CreativeSpec } from './lib/gemini';
import { Loader2, Upload, FileText, Sparkles, AlertCircle, Copy, Check, Layers, Palette, Type, AlignLeft, Tag, Crop, RefreshCw, X, MessageSquare, Download, Image, Lightbulb, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [excelRows, setExcelRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [creatives, setCreatives] = useState<CreativeSpec[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [regenConfig, setRegenConfig] = useState<{
    creativeId: string;
    type: 'title' | 'copy';
    currentText: string;
  } | null>(null);
  const [regenFeedback, setRegenFeedback] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [progress, setProgress] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [pendingWorkbook, setPendingWorkbook] = useState<any>(null);

  // Creative context: text notes, uploaded text files, uploaded images
  const [contextText, setContextText] = useState('');
  const [contextFiles, setContextFiles] = useState<{ name: string; content: string; type: 'text' | 'image' }[]>([]);

  const handleExportExcel = () => {
    if (creatives.length === 0) return;

    // Build rows: original Excel data + generated columns
    const exportRows = creatives.map((c, i) => {
      // Start with original row data if available
      const original = excelRows[i] ? { ...excelRows[i] } : {};
      return {
        ...original,
        'TÍTULO GENERADO': c.suggestedTitle,
        'COPY PRINCIPAL': c.copyPrincipal || '',
        'DESARROLLO': c.desarrollo || '',
        'CIERRE': c.cierre || '',
        'COPY COMPLETO': c.suggestedCopy,
        'AUDIENCIA MACRO': c.audienciaMacro,
        'MICRO ELEGIDA': c.audienciaReferenciaElegida,
        'DRIVER': c.driverComunicacion,
        'PROMPT F1 — IMAGEN': c.copyPrincipal ? JSON.stringify({ task: "Generate 5 variants of the attached reference image.", antiHallucination: { brandName: `The brand is "${c.identifiedBrand}" and ONLY "${c.identifiedBrand}". Do NOT invent alternative brand names, logos, or taglines.`, logoRule: "Copy the logo PIXEL BY PIXEL from reference. Same text, font, colors, position, size.", textRule: "ONLY the text specified below. Do NOT generate or invent any other text." }, text: { content: c.copyPrincipal, spelling: "Write CHARACTER BY CHARACTER. Every accent (á é í ó ú ñ) mandatory. Do NOT misspell or modify.", position: "EXACT same position and style as reference.", font: "EXACT same font family, weight, color, effects as reference." }, layout: "IDENTICAL to reference. Change ONLY background and person.", colorPalette: "EXACT same colors as reference.", whatToChange: "ONLY background environment and person. Everything else IDENTICAL." }) : '',
        'PROMPT F2 — IMAGEN': c.desarrollo ? JSON.stringify({ task: "Generate 5 variants of the attached reference image.", antiHallucination: { brandName: `ONLY "${c.identifiedBrand}". NO invented names.`, logoRule: "PIXEL BY PIXEL from reference.", textRule: "ONLY text below." }, text: { content: c.desarrollo, spelling: "CHARACTER BY CHARACTER. Accents mandatory.", position: "EXACT same as reference.", font: "EXACT same as reference." }, layout: "IDENTICAL. Change ONLY background and person.", colorPalette: "EXACT match.", whatToChange: "ONLY background and person." }) : '',
        'PROMPT F3 — IMAGEN': c.cierre ? JSON.stringify({ task: "Generate 5 variants of the attached reference image.", antiHallucination: { brandName: `ONLY "${c.identifiedBrand}".`, logoRule: "PIXEL BY PIXEL.", textRule: "ONLY text below." }, text: { content: c.cierre, spelling: "CHARACTER BY CHARACTER. Accents mandatory.", position: "EXACT same.", font: "EXACT same." }, layout: "IDENTICAL. Change ONLY background and person.", whatToChange: "ONLY background and person." }) : '',
        'PROMPT VIDEO': c.copyPrincipal ? JSON.stringify({ task: `15-second video ad for "${c.identifiedBrand}". ALL copy displayed sequentially. Reference image = visual template.`, antiHallucination: { brandName: `ONLY "${c.identifiedBrand}". Do NOT invent alternative names or logos.`, logoRule: "FIXED element in EVERY frame. Same text, font, colors, proportions.", textRule: "ONLY text in frames[]. Do NOT add or invent ANY other text." }, spelling: { method: "Spell each word letter by letter before rendering. Accents (á é í ó ú ñ) MANDATORY.", forbidden: "Do NOT autocorrect, rephrase, translate, or modify." }, brandIdentity: { colors: "EXACT palette from reference throughout ALL 15s.", typography: "EXACT same font for all text.", logo: "Same position as reference in EVERY frame." }, frames: [...(c.copyPrincipal ? [{ time: "0-4s", text: c.copyPrincipal, visual: "Dynamic opening, text large and centered." }] : []), ...(c.desarrollo ? [{ time: "4-10s", text: c.desarrollo, visual: "Product narrative, text prominent." }] : []), ...(c.cierre ? [{ time: "10-13s", text: c.cierre, visual: "Product hero, text impactful." }] : []), { time: "13-15s", text: `${c.identifiedBrand} logo`, visual: "Clean end card." }], consistency: "Same colors, font, style ALL 15s. One cohesive ad." }) : '',
        'PROMPT RESIZE': c.resizePrompt,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Creatividades');

    const exportName = fileName ? fileName.replace(/\.[^.]+$/, '') + '_PROMTS.xlsx' : 'creatividades_PROMTS.xlsx';
    XLSX.writeFile(wb, exportName);
  };

  // Helper: find a header column by keywords (case-insensitive, partial match)
  const findCol = (headers: string[], keywords: string[]): string | null => {
    return headers.find(h => {
      const up = h.toUpperCase().trim();
      return keywords.some(k => up.includes(k));
    }) || null;
  };

  // Build a creative locally from existing row data (no AI needed)
  const buildLocalCreative = (row: Record<string, string>, headers: string[], idx: number, brand: string): CreativeSpec => {
    const get = (keywords: string[]) => {
      const col = findCol(headers, keywords);
      return col ? (row[col] || '').trim() : '';
    };

    const title = get(['TÍTULO', 'TITULO', 'TITLE', 'HEADLINE']);
    const copyRaw = get(['COPY', 'TEXTO SUGERIDO', 'DESCRIPCION', 'DESCRIPTION']);

    // Parse copy structure from a single column that contains "Copy principal: ... Desarrollo: ... Cierre: ..."
    const parseCopyParts = (text: string) => {
      const cp: { principal: string; desarrollo: string; cierre: string } = { principal: '', desarrollo: '', cierre: '' };
      if (!text) return cp;
      const lower = text.toLowerCase();
      // Try to find labeled sections
      const cpIdx = lower.search(/copy\s*principal\s*[:：]/i);
      const devIdx = lower.search(/desarrollo\s*[:：]/i);
      const clIdx = lower.search(/cierre\s*[:：]/i);
      if (cpIdx >= 0 || devIdx >= 0 || clIdx >= 0) {
        // We have at least one label — parse by positions
        const markers = [
          { key: 'principal' as const, idx: cpIdx, label: /copy\s*principal\s*[:：]\s*/i },
          { key: 'desarrollo' as const, idx: devIdx, label: /desarrollo\s*[:：]\s*/i },
          { key: 'cierre' as const, idx: clIdx, label: /cierre\s*[:：]\s*/i },
        ].filter(m => m.idx >= 0).sort((a, b) => a.idx - b.idx);
        markers.forEach((m, i) => {
          const start = text.slice(m.idx).replace(m.label, '');
          const nextIdx = markers[i + 1]?.idx;
          const chunk = nextIdx !== undefined ? text.slice(m.idx, nextIdx) : text.slice(m.idx);
          cp[m.key] = chunk.replace(m.label, '').trim();
        });
      }
      return cp;
    };

    const parsed = parseCopyParts(copyRaw);
    // Also check dedicated columns as fallback
    let copyPrincipalVal = parsed.principal || get(['COPY PRINCIPAL', 'HOOK', 'PRINCIPAL']);
    let desarrolloVal = parsed.desarrollo || get(['DESARROLLO', 'BODY', 'CUERPO']);
    let cierreVal = parsed.cierre || get(['CIERRE', 'CTA', 'CALL TO ACTION', 'CLOSING']);
    // Clean copy: if we parsed parts, reconstruct without labels
    const copy = copyPrincipalVal ? `${copyPrincipalVal}${desarrolloVal ? '. ' + desarrolloVal : ''}${cierreVal ? '. ' + cierreVal : ''}` : copyRaw;
    const medio = get(['MEDIO', 'PLATAFORMA', 'PLATFORM']);
    const formato = get(['FORMATO DE ANUNCIO', 'FORMATO ANUNCIO', 'AD FORMAT']);
    const creativo = get(['CREATIVO', 'CREATIVE', 'TIPO']);
    const size = get(['TAMAÑO', 'SIZE', 'PIXELES', 'DIMENSIONES']);
    const fileFormat = get(['FORMATO', 'FORMAT', 'JPG', 'PNG']);
    const peso = get(['PESO', 'WEIGHT']);
    const textoSpec = get(['TEXTO', 'CARACTERES', 'CHAR']);
    const objetivo = get(['OBJETIVO', 'OBJECTIVE']);
    const geo = get(['GEOGRAFIA', 'GEO', 'UBICACIÓN']);
    const audMacro = get(['AUDIENCIAS', 'AUDIENCIA MACRO', 'AUDIENCE']);
    const audRef = get(['AUDIENCIAS REFERENCIA', 'REFERENCIA', 'MICRO']);
    const driver = get(['DRIVER', 'DRIVERS', 'COMUNICACIÓN']);
    const concepto = get(['CONCEPTO', 'CONCEPT']);
    const campana = get(['CAMPAÑA', 'CAMPAIGN']);

    const context = `Audiencia: ${audMacro || 'General'} | Objetivo: ${objetivo || 'Awareness'} | Campaña: ${campana || concepto || 'N/A'}`;

    return {
      id: `creative-${idx + 1}`,
      identifiedBrand: brand,
      medio,
      formatoAnuncio: formato,
      creativo,
      formatAndSize: size,
      formato: fileFormat,
      peso,
      textoSpec,
      maxTitleChars: 40,
      maxCopyChars: 200,
      objetivo,
      geografia: geo,
      audienciaMacro: audMacro,
      audienciaReferencia: audRef,
      audienciaReferenciaElegida: audRef.split(',')[0]?.trim() || '',
      driverComunicacion: driver,
      campaignContext: context,
      suggestedTitle: title || concepto || '',
      suggestedCopy: copy || '',
      copyPrincipal: copyPrincipalVal || '',
      desarrollo: desarrolloVal || '',
      cierre: cierreVal || '',
      brandGuidelines: '',
      masterPromptEn: `take as a reference this creative and generate 5 different variants with this image. respect the logo 100% faithful and the identity of the brand ${brand}. change the background environment and the character to: ${context}. take the same font and Include the exact text '${title || concepto || ''}' and '${copy || ''}' ensuring flawless spelling. be faithful to the initial logo and the graphic lines.`,
      masterPromptEs: `toma como referencia esta pieza creativa y genera 5 variantes diferentes con esta imagen. respeta el logo 100% fiel y la identidad de la marca ${brand}. cambia el entorno del fondo y el personaje a: ${context}. usa la misma tipografía e incluye el texto exacto '${title || concepto || ''}' y '${copy || ''}' asegurando ortografía impecable. sé fiel al logo inicial y a las líneas gráficas.`,
      resizePrompt: size ? `OUTPAINT ONLY — extend the canvas to ${size}. DO NOT duplicate, regenerate, or modify the original image. The original creative stays UNTOUCHED in the center. ONLY fill the new empty space around it with a seamless continuation of the background. No new text, no new logos, no new objects. Brand: ${brand}.` : '',
    };
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    setCreatives([]);
    setProgress('Preparando lotes...');

    try {
      // Use real Excel rows if available, otherwise fall back to text parsing
      let rows: Record<string, string>[] = excelRows;
      let headers: string[] = [];
      let fileCtx = fileName ? `[Nombre del archivo original: ${fileName}]` : '';

      if (rows.length > 0) {
        headers = Object.keys(rows[0]);
      } else {
        const lines = inputText.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('[Nombre'));
        if (lines.length < 2) throw new Error("No se encontraron datos suficientes.");
        headers = lines[0].split('\t').length > 1 ? lines[0].split('\t') : lines[0].split(',');
        rows = lines.slice(1).map(line => {
          const vals = line.split('\t').length > 1 ? line.split('\t') : line.split(',');
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
          return obj;
        });
      }

      // Detect if file already has COPY/TITLE columns with content
      const copyCol = findCol(headers, ['COPY', 'TEXTO SUGERIDO', 'DESCRIPCION']);
      const titleCol = findCol(headers, ['TÍTULO', 'TITULO', 'TITLE', 'HEADLINE', 'CONCEPTO']);

      const hasExistingCopy = copyCol && rows.filter(r => r[copyCol]?.trim().length > 0).length > rows.length * 0.3;
      const hasExistingTitle = titleCol && rows.filter(r => r[titleCol]?.trim().length > 0).length > rows.length * 0.3;

      if (hasExistingCopy || hasExistingTitle) {
        // FILE ALREADY HAS COPY/TITLE — generate prompts locally without AI
        setProgress('Archivo con copy existente detectado — generando prompts directamente...');

        // Extract brand from filename
        const brandMatch = fileName.match(/^([^-_]+)/);
        const brand = brandMatch ? brandMatch[1].replace(/[^a-záéíóúñ\s]/gi, '').trim() : 'Marca';

        const allCreatives = rows.map((row, i) => buildLocalCreative(row, headers, i, brand));
        setCreatives(allCreatives);
        setProgress('');
      } else {
        // NO EXISTING COPY — use AI to generate
        const BATCH_SIZE = 10;
        const totalRows = rows.length;
        const allCreatives: CreativeSpec[] = [];
        let failures = 0;
        const headerLine = headers.join('\t');

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
          const from = i + 1;
          const to = Math.min(i + batch.length, totalRows);

          setProgress(`Lote ${batchNum}/${totalBatches} — filas ${from}-${to} de ${totalRows} (${allCreatives.length} generadas)`);

          const batchLines = batch.map(row =>
            headers.map(h => String(row[h] || '').replace(/[\n\r]+/g, ' ')).join('\t')
          );

          let contextBlock = '';
          if (contextText.trim() || contextFiles.length > 0) {
            const parts: string[] = [];
            if (contextText.trim()) parts.push(`NOTAS DEL EQUIPO CREATIVO:\n${contextText.trim()}`);
            contextFiles.forEach(f => {
              if (f.type === 'text') parts.push(`ARCHIVO DE REFERENCIA (${f.name}):\n${f.content.slice(0, 5000)}`);
              if (f.type === 'image') parts.push(`[Imagen de referencia adjunta: ${f.name}]`);
            });
            contextBlock = `\n\nCONTEXTO CREATIVO ADICIONAL (usa esta información para generar copys más relevantes y alineados):\n${parts.join('\n\n')}`;
          }

          const batchText = `${fileCtx}${contextBlock}\n${headerLine}\n${batchLines.join('\n')}`;

          try {
            const specs = await extractAndOptimizePrompts(batchText);
            specs.forEach((s, idx) => { s.id = `creative-${allCreatives.length + idx + 1}`; });
            allCreatives.push(...specs);
            setCreatives([...allCreatives]);
          } catch (err: any) {
            console.error(`Batch ${batchNum} failed:`, err);
            failures++;
          }
        }

        setProgress('');
        if (allCreatives.length === 0) {
          throw new Error("No se generaron creatividades. Revisa el formato del archivo.");
        }
        if (failures > 0) {
          setError(`Se completaron ${allCreatives.length} de ${totalRows} filas. ${failures} lotes fallaron.`);
        }
      }
    } catch (err: any) {
      setError(err.message || "Error al analizar las especificaciones.");
    } finally {
      setIsAnalyzing(false);
      setProgress('');
    }
  };

  const processSheet = (wb: any, sheetName: string, fName: string) => {
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });

    const KNOWN_HEADERS = ['MEDIO', 'CAMPAÑA', 'OBJETIVO', 'AUDIENCIAS', 'CREATIVO', 'REFERENCIA', 'MES', 'FORMATO', 'PIEZAS', 'DRIVER', 'TAMAÑO'];
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
      const rowVals = rawRows[i].map(v => String(v || '').toUpperCase().trim());
      const matches = KNOWN_HEADERS.filter(kw => rowVals.some(v => v.includes(kw)));
      if (matches.length >= 3) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
        const filled = rawRows[i].filter(v => String(v || '').trim().length > 0);
        if (filled.length >= 5) {
          headerRowIdx = i;
          break;
        }
      }
    }

    if (headerRowIdx === -1) headerRowIdx = 0;

    const headers = rawRows[headerRowIdx].map((h, i) => {
      const val = String(h || '').trim();
      return val || `COL_${i}`;
    });

    const dataRows = rawRows.slice(headerRowIdx + 1);

    const rows = dataRows
      .map(rawRow => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = String(rawRow[i] || '').replace(/[\n\r]+/g, ' ').trim();
        });
        return obj;
      })
      .filter(row => {
        const filled = headers.filter(h => row[h] && row[h].length > 0 && row[h] !== '0');
        if (filled.length < 3) return false;

        const KEY_COLS = ['MEDIO', 'CAMPAÑA', 'OBJETIVO', 'CREATIVO', 'AUDIENCIAS'];
        const hasKeyCol = headers.some(h => {
          const hUp = h.toUpperCase().trim();
          const isKey = KEY_COLS.some(k => hUp.includes(k));
          return isKey && row[h] && row[h].trim().length > 0;
        });
        return hasKeyCol;
      });

    setExcelRows(rows);
    setFileName(fName);
    setSheetNames([]);
    setPendingWorkbook(null);

    const displayLines = [headers.join('\t')];
    rows.forEach(row => {
      displayLines.push(headers.map(h => String(row[h] || '').replace(/[\n\r]+/g, ' ')).join('\t'));
    });

    setInputText(`[Nombre del archivo original: ${fName}] [Hoja: ${sheetName}]\n\n${displayLines.join('\n')}`);
    setError(null);
  };

  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        // Auto-detect: prefer sheet with "MATRICES" in name
        const matricesSheet = wb.SheetNames.find((n: string) =>
          n.toUpperCase().includes('MATRICES') || n.toUpperCase().includes('MATRIZ')
        );

        if (matricesSheet) {
          // Found the right sheet automatically
          processSheet(wb, matricesSheet, file.name);
        } else if (wb.SheetNames.length > 1) {
          // Multiple sheets, no "MATRICES" found — let user pick
          setSheetNames(wb.SheetNames);
          setPendingWorkbook(wb);
          setFileName(file.name);
          setError(null);
        } else {
          // Single sheet — use it
          processSheet(wb, wb.SheetNames[0], file.name);
        }
      } catch (err) {
        console.error(err);
        setError("Error al leer el archivo. Asegúrate de que sea un Excel o CSV válido.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleContextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const isImage = file.type.startsWith('image/');
      const reader = new FileReader();

      if (isImage) {
        reader.onload = (evt) => {
          const dataUrl = evt.target?.result as string;
          setContextFiles(prev => [...prev, { name: file.name, content: dataUrl, type: 'image' }]);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (evt) => {
          const text = evt.target?.result as string;
          setContextFiles(prev => [...prev, { name: file.name, content: text, type: 'text' }]);
        };
        reader.readAsText(file);
      }
    });
    e.target.value = '';
  };

  const removeContextFile = (index: number) => {
    setContextFiles(prev => prev.filter((_, i) => i !== index));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const executeRegenerate = async () => {
    if (!regenConfig || !regenFeedback.trim()) return;
    setIsRegenerating(true);
    try {
      const creative = creatives.find(c => c.id === regenConfig.creativeId);
      if (!creative) throw new Error("Creative not found");
      
      const { newText, updatedMasterPromptEn, updatedMasterPromptEs } = await regenerateCopy(creative, regenConfig.type, regenFeedback);
      
      setCreatives(prev => prev.map(c => {
        if (c.id === regenConfig.creativeId) {
          return {
            ...c,
            suggestedTitle: regenConfig.type === 'title' ? newText : c.suggestedTitle,
            suggestedCopy: regenConfig.type === 'copy' ? newText : c.suggestedCopy,
            masterPromptEn: updatedMasterPromptEn,
            masterPromptEs: updatedMasterPromptEs
          };
        }
        return c;
      }));
      setRegenConfig(null);
      setRegenFeedback('');
    } catch (err: any) {
      alert("Error al regenerar: " + (err.message || "Error desconocido"));
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-gray-900 font-sans">
      <header className="bg-black border-b border-green-900/30 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://i.postimg.cc/zBwZ8cxn/logo-zalvaje-(1).png" alt="Zalvaje Logo" className="h-10 object-contain" referrerPolicy="no-referrer" />
            <div>
              <h1 className="text-xl font-black text-green-500 tracking-tight">
                Master Prompt
              </h1>
              <p className="text-xs text-stone-400 font-medium">Generador de Prompts DCO</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-stone-400">
            <Sparkles className="w-4 h-4 text-green-500" />
            <span>Powered by ZALVAJE</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Template Section (Full Width) */}
        <div className="lg:col-span-12 mb-2">
          <div className="bg-stone-900 rounded-2xl p-6 shadow-lg border border-stone-800 text-stone-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-green-500" />
                Plantilla Base del Prompt Maestro
              </h2>
              <button 
                onClick={() => copyToClipboard("take as a reference this creative and generate 5 different variants with this image. respect the logo 100% faithful and the identity of the brand [Marca Identificada]. change the background environment and the character to: [Contexto de la Campaña]. take the same font and Include the exact text '[Título Generado]' and '[Texto Generado]' ensuring flawless spelling. be faithful to the initial logo and the graphic lines.", "template")}
                className="flex items-center gap-2 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs font-bold transition-colors border border-stone-700"
              >
                {copiedId === "template" ? (
                  <><Check className="w-4 h-4 text-green-500" /> Copiado</>
                ) : (
                  <><Copy className="w-4 h-4" /> Copiar Plantilla</>
                )}
              </button>
            </div>
            <p className="font-mono text-sm leading-relaxed text-stone-400">
              take as a reference this creative and generate 5 different variants with this image. respect the logo 100% faithful and the identity of the brand <span className="text-green-400 font-bold">[Marca Identificada]</span>. change the background environment and the character to: <span className="text-green-400 font-bold">[Contexto de la Campaña]</span>. take the same font and Include the exact text '<span className="text-green-400 font-bold">[Título Generado]</span>' and '<span className="text-green-400 font-bold">[Texto Generado]</span>' ensuring flawless spelling. be faithful to the initial logo and the graphic lines.
            </p>
          </div>
        </div>

        {/* Input Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-stone-50 p-6 rounded-2xl shadow-sm border border-stone-200 sticky top-24">
            
            {/* Text Specs Upload */}
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-gray-900">
              <FileText className="w-5 h-5 text-green-600" />
              Requerimientos del Cliente
            </h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Sube el documento Excel/CSV con las especificaciones del cliente. El sistema leerá cada fila y generará la estructura DCO y el Prompt Maestro correspondiente.
            </p>
            
            <div className="mb-4">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-stone-300 border-dashed rounded-xl cursor-pointer bg-stone-100 hover:bg-stone-200 hover:border-green-500 transition-all">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-stone-400" />
                  <p className="mb-2 text-sm text-gray-600"><span className="font-bold text-green-600">Sube Excel/CSV</span> o arrastra el archivo</p>
                  <p className="text-xs text-stone-500">XLSX, XLS, CSV</p>
                </div>
                <input type="file" className="hidden" accept=".xlsx, .xls, .csv, .txt" onChange={handleTextFileUpload} />
              </label>
            </div>

            {/* Sheet selector when Excel has multiple sheets */}
            {sheetNames.length > 1 && pendingWorkbook && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm font-bold text-amber-800 mb-3">Este archivo tiene {sheetNames.length} hojas. Selecciona la correcta:</p>
                <div className="space-y-2">
                  {sheetNames.map((name: string) => (
                    <button
                      key={name}
                      onClick={() => processSheet(pendingWorkbook, name, fileName)}
                      className="w-full text-left px-4 py-2.5 bg-white hover:bg-green-50 border border-amber-200 hover:border-green-500 rounded-lg text-sm font-medium text-gray-800 transition-all flex items-center gap-2"
                    >
                      <Layers className="w-4 h-4 text-amber-600" />
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Creative Context Section */}
            <div className="mb-4 p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl">
              <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Contexto Creativo (opcional)
              </h3>
              <p className="text-xs text-amber-700/80 mb-3">
                Ideas que han funcionado, lo implementado, tono de marca, referencias visuales...
              </p>
              <textarea
                className="w-full h-24 p-3 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all resize-none text-sm leading-relaxed mb-3"
                placeholder="Ej: Los copys que mejor han funcionado usan humor y referencias a la rutina diaria. El tono es cercano, no corporativo. Evitar hablar de precio. La campaña anterior 'Energía Real' tuvo buen engagement con audiencia joven..."
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
              />

              <div className="flex gap-2 mb-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer text-xs font-bold text-amber-700 transition-colors">
                  <Image className="w-3.5 h-3.5" />
                  Subir imagen
                  <input type="file" className="hidden" accept="image/*" multiple onChange={handleContextFileUpload} />
                </label>
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer text-xs font-bold text-amber-700 transition-colors">
                  <FileText className="w-3.5 h-3.5" />
                  Subir texto/doc
                  <input type="file" className="hidden" accept=".txt,.pdf,.doc,.docx,.rtf,.csv" multiple onChange={handleContextFileUpload} />
                </label>
              </div>

              {contextFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {contextFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-amber-100">
                      {f.type === 'image' ? (
                        <img src={f.content} alt={f.name} className="w-10 h-10 object-cover rounded" />
                      ) : (
                        <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span className="text-xs text-gray-700 font-medium truncate flex-1">{f.name}</span>
                      <button onClick={() => removeContextFile(i)} className="p-1 hover:bg-red-50 rounded text-stone-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview of loaded data */}
            {inputText && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1">
                    <Check className="w-3 h-3" /> Datos cargados
                  </span>
                  <span className="text-xs text-stone-500">{excelRows.length} filas detectadas</span>
                </div>
                <textarea
                  className="w-full h-24 p-3 bg-green-50/50 border border-green-200 rounded-xl text-xs text-gray-600 leading-relaxed resize-none font-mono"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  readOnly={excelRows.length > 0}
                />
              </div>
            )}
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2 border border-red-100">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !inputText.trim()}
              className="mt-6 w-full bg-green-700 hover:bg-green-800 disabled:bg-stone-300 text-white font-bold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando Documento...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generar Prompts Maestros {excelRows.length > 0 ? `(${excelRows.length} filas)` : ''}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-8 space-y-6">
          {creatives.length === 0 && !isAnalyzing ? (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl bg-white">
              <div className="bg-stone-50 p-4 rounded-full mb-4">
                <img src="https://i.postimg.cc/zBwZ8cxn/logo-zalvaje-(1).png" alt="Zalvaje Logo" className="w-12 h-12 object-contain opacity-50 grayscale" referrerPolicy="no-referrer" />
              </div>
              <p className="text-lg font-bold text-stone-600">No hay Prompts Maestros generados</p>
              <p className="text-sm mt-1">Sube el Excel con los requerimientos del cliente para comenzar</p>
            </div>
          ) : creatives.length === 0 && isAnalyzing ? (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl bg-white">
              <Loader2 className="w-12 h-12 animate-spin text-green-600 mb-4" />
              <p className="text-lg font-bold text-stone-600">Iniciando generación...</p>
              <p className="text-sm mt-1 text-green-700 font-medium">{progress || 'Preparando lotes...'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top bar: count + export */}
              <div className="flex items-center justify-between bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
                <p className="text-sm font-bold text-gray-700">
                  {creatives.length} creatividades generadas
                  {isAnalyzing && <span className="text-green-600 ml-2 font-medium">(generando más...)</span>}
                </p>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Exportar Excel
                </button>
              </div>
              {creatives.map((creative, index) => (
                <div key={creative.id} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col p-6 transition-all hover:shadow-md">
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* DCO Structure Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-900 border-b border-stone-100 pb-2 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-green-600" />
                        Estructura DCO & Copy (Fila #{index + 1})
                      </h3>

                      {/* Platform & Format Pills */}
                      <div className="flex flex-wrap gap-2">
                        {creative.medio && (
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase">{creative.medio}</span>
                        )}
                        {creative.formatoAnuncio && (
                          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">{creative.formatoAnuncio}</span>
                        )}
                        {creative.creativo && (
                          <span className="px-2.5 py-1 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full">{creative.creativo}</span>
                        )}
                        {creative.objetivo && (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">{creative.objetivo}</span>
                        )}
                        {creative.geografia && (
                          <span className="px-2.5 py-1 bg-teal-100 text-teal-700 text-[10px] font-bold rounded-full">{creative.geografia}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Identified Brand */}
                        <div className="bg-green-50/80 border border-green-100 p-3 rounded-xl relative group flex items-center gap-2">
                          <Tag className="w-4 h-4 text-green-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider block truncate">Marca</span>
                            <span className="text-sm font-bold text-gray-900 truncate block">{creative.identifiedBrand}</span>
                          </div>
                        </div>

                        {/* Format and Size */}
                        <div className="bg-stone-50/80 border border-stone-200 p-3 rounded-xl relative group flex items-center gap-2">
                          <Crop className="w-4 h-4 text-stone-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block truncate">Tamaño</span>
                            <span className="text-sm font-bold text-gray-900 truncate block">{creative.formatAndSize}</span>
                          </div>
                        </div>
                      </div>

                      {/* Audience Macro + Micro */}
                      {(creative.audienciaMacro || creative.audienciaReferenciaElegida) && (
                        <div className="bg-cyan-50/80 border border-cyan-200 p-3 rounded-xl space-y-2">
                          <div className="flex items-center gap-2">
                            {creative.audienciaMacro && (
                              <span className="px-2.5 py-1 bg-cyan-600 text-white text-[10px] font-bold rounded-full uppercase">{creative.audienciaMacro}</span>
                            )}
                            {creative.audienciaReferenciaElegida && (
                              <span className="px-2.5 py-1 bg-orange-500 text-white text-[10px] font-bold rounded-full">{creative.audienciaReferenciaElegida}</span>
                            )}
                          </div>
                          {creative.audienciaReferencia && (
                            <div>
                              <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider block">Micros disponibles:</span>
                              <span className="text-xs text-gray-600">{creative.audienciaReferencia}</span>
                            </div>
                          )}
                          {creative.driverComunicacion && (
                            <div>
                              <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider block">Driver</span>
                              <span className="text-sm font-semibold text-gray-900">{creative.driverComunicacion}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text Spec from document */}
                      {creative.textoSpec && (
                        <div className="bg-yellow-50/60 border border-yellow-200 px-3 py-2 rounded-lg">
                          <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider">Spec Texto: </span>
                          <span className="text-xs text-yellow-800 font-medium">{creative.textoSpec}</span>
                        </div>
                      )}

                      {/* Campaign Context */}
                      <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl relative group">
                        <span className="text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1 mb-2">
                          <FileText className="w-3 h-3" /> Contexto de Campaña
                        </span>
                        <p className="text-sm text-gray-800 leading-relaxed">{creative.campaignContext}</p>
                      </div>

                      {/* Suggested Title */}
                      <div className="bg-orange-50/50 border border-orange-100/50 p-4 rounded-xl relative group">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                            <Type className="w-3 h-3" /> Título Sugerido
                          </span>
                          <span className={`text-xs font-bold ${creative.suggestedTitle.length > (creative.maxTitleChars || 40) ? 'text-red-500' : 'text-green-600'}`}>
                            {creative.suggestedTitle.length}/{creative.maxTitleChars || 40}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 font-medium">{creative.suggestedTitle}</p>
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          <button
                            onClick={() => setRegenConfig({ creativeId: creative.id, type: 'title', currentText: creative.suggestedTitle })}
                            className="p-1.5 bg-white rounded-md shadow-sm text-gray-500 hover:text-blue-600"
                            title="Regenerar con feedback"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => copyToClipboard(creative.suggestedTitle, `${creative.id}-title`)}
                            className="p-1.5 bg-white rounded-md shadow-sm text-gray-500 hover:text-orange-600"
                            title="Copiar Título"
                          >
                            {copiedId === `${creative.id}-title` ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Suggested Copy — full */}
                      <div className="bg-orange-50/50 border border-orange-100/50 p-4 rounded-xl relative group">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                            <AlignLeft className="w-3 h-3" /> Texto Completo
                          </span>
                          <span className={`text-xs font-bold ${creative.suggestedCopy.length > (creative.maxCopyChars || 200) ? 'text-red-500' : 'text-green-600'}`}>
                            {creative.suggestedCopy.length}/{creative.maxCopyChars || 200}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">{creative.suggestedCopy}</p>
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          <button
                            onClick={() => setRegenConfig({ creativeId: creative.id, type: 'copy', currentText: creative.suggestedCopy })}
                            className="p-1.5 bg-white rounded-md shadow-sm text-gray-500 hover:text-blue-600"
                            title="Regenerar con feedback"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => copyToClipboard(creative.suggestedCopy, `${creative.id}-text`)}
                            className="p-1.5 bg-white rounded-md shadow-sm text-gray-500 hover:text-orange-600"
                            title="Copiar Texto"
                          >
                            {copiedId === `${creative.id}-text` ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Copy Structure: Principal / Desarrollo / Cierre */}
                      {(creative.copyPrincipal || creative.desarrollo || creative.cierre) && (
                        <div className="bg-blue-50/50 border border-blue-100/50 p-4 rounded-xl space-y-3">
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Estructura del Copy (Frames)
                          </span>
                          {creative.copyPrincipal && (
                            <div className="relative group/cp">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full uppercase">Copy Principal</span>
                                <span className="text-[10px] text-gray-400">Hook / Apertura</span>
                              </div>
                              <p className="text-sm text-gray-800 font-semibold pl-2 border-l-2 border-blue-400">{creative.copyPrincipal}</p>
                              <button
                                onClick={() => copyToClipboard(creative.copyPrincipal, `${creative.id}-cp`)}
                                className="absolute top-0 right-0 p-1 opacity-0 group-hover/cp:opacity-100 transition-opacity bg-white rounded shadow-sm text-gray-400 hover:text-blue-600"
                                title="Copiar"
                              >
                                {copiedId === `${creative.id}-cp` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          )}
                          {creative.desarrollo && (
                            <div className="relative group/dev">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">Desarrollo</span>
                                <span className="text-[10px] text-gray-400">Cuerpo / Beneficio</span>
                              </div>
                              <p className="text-sm text-gray-800 pl-2 border-l-2 border-emerald-400">{creative.desarrollo}</p>
                              <button
                                onClick={() => copyToClipboard(creative.desarrollo, `${creative.id}-dev`)}
                                className="absolute top-0 right-0 p-1 opacity-0 group-hover/dev:opacity-100 transition-opacity bg-white rounded shadow-sm text-gray-400 hover:text-emerald-600"
                                title="Copiar"
                              >
                                {copiedId === `${creative.id}-dev` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          )}
                          {creative.cierre && (
                            <div className="relative group/cl">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">Cierre</span>
                                <span className="text-[10px] text-gray-400">CTA / Llamado a la acción</span>
                              </div>
                              <p className="text-sm text-gray-800 font-medium pl-2 border-l-2 border-amber-400">{creative.cierre}</p>
                              <button
                                onClick={() => copyToClipboard(creative.cierre, `${creative.id}-cl`)}
                                className="absolute top-0 right-0 p-1 opacity-0 group-hover/cl:opacity-100 transition-opacity bg-white rounded shadow-sm text-gray-400 hover:text-amber-600"
                                title="Copiar"
                              >
                                {copiedId === `${creative.id}-cl` ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Brand Guidelines */}
                      <div className="bg-purple-50/50 border border-purple-100/50 p-4 rounded-xl relative group">
                        <span className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1 mb-2">
                          <Palette className="w-3 h-3" /> Guías de Marca y Composición
                        </span>
                        <p className="text-sm text-gray-800 leading-relaxed">{creative.brandGuidelines}</p>
                      </div>
                    </div>

                    {/* Master Prompts Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-900 border-b border-stone-100 pb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-green-600" />
                        Prompts Maestros por Frame
                      </h3>

                      {/* Per-frame prompts */}
                      {(() => {
                        const brand = creative.identifiedBrand;
                        const cp = creative.copyPrincipal || creative.suggestedTitle || '';
                        const dev = creative.desarrollo || '';
                        const cl = creative.cierre || '';
                        const b = (t: string) => t ? `[${t}]` : '';

                        const frames = [
                          { label: 'FRAME 1 — Copy Principal', color: 'blue', text: cp, timing: '0-3s' },
                          { label: 'FRAME 2 — Desarrollo', color: 'emerald', text: dev, timing: '3-9s' },
                          { label: 'FRAME 3 — Cierre', color: 'amber', text: cl, timing: '9-13s' },
                        ].filter(f => f.text);

                        const fullCopy = [cp, dev, cl].filter(Boolean).join(' ');

                        const imgPrompt = (text: string) =>
                          `take as a reference this creative and generate 5 different variants with this image. respect the logo 100% faithful and the identity of the brand ${brand}. change the background environment and the character to: ${creative.campaignContext || creative.audienciaReferenciaElegida || 'a different person in the same mood'}. take the same font and Include EXACTLY this text — do NOT modify, rephrase, abbreviate, translate, or autocorrect ANY word:\n\n"""${text}"""\n\nThis text has ${text.length} characters and ${text.split(' ').length} words. Copy it VERBATIM. Every letter matters: ${text.split(' ').map(w => `"${w}"(${w.length})`).join(' ')}. Accents are mandatory: á é í ó ú ñ. If a word has an accent in the original, it MUST have it in the output.\n\nbe faithful to the initial logo and the graphic lines. do not add white space — use only the brand colors from the reference.`;

                        const videoPrompt =
                          `generate a 15-second video ad for ${brand} using this reference image as visual template. respect the logo 100% faithful and the identity of the brand ${brand} in every frame. ` +
                          (cp ? `frame 1 (0-4s): show EXACTLY this text — do NOT modify: """${cp}""" (${cp.length} chars, ${cp.split(' ').length} words). ` : '') +
                          (dev ? `frame 2 (4-10s): show EXACTLY this text — do NOT modify: """${dev}""" (${dev.length} chars, ${dev.split(' ').length} words). ` : '') +
                          (cl ? `frame 3 (10-13s): show EXACTLY this text — do NOT modify: """${cl}""" (${cl.length} chars, ${cl.split(' ').length} words). ` : '') +
                          `frame 4 (13-15s): ${brand} logo centered on brand color. ` +
                          `take the same font from reference for all text. ensure flawless spelling with all accents (á é í ó ú ñ). be faithful to the initial logo and graphic lines. same colors, same style throughout all 15 seconds. one cohesive ad.`;

                        const colorMap: Record<string, string> = { blue: 'text-blue-400', emerald: 'text-emerald-400', amber: 'text-amber-400' };
                        const borderMap: Record<string, string> = { blue: 'border-blue-500/30', emerald: 'border-emerald-500/30', amber: 'border-amber-500/30' };
                        const bgMap: Record<string, string> = { blue: 'bg-blue-500/5', emerald: 'bg-emerald-500/5', amber: 'bg-amber-500/5' };
                        const labelBgMap: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', emerald: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700' };

                        return (
                          <>
                            {frames.map((f, fi) => {
                              const prompt = imgPrompt(f.text);
                              return (
                                <div key={fi} className={`flex flex-col border rounded-xl overflow-hidden ${borderMap[f.color]}`}>
                                  <div className={`flex items-center justify-between px-4 py-2 ${bgMap[f.color]}`}>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${labelBgMap[f.color]}`}>{f.label}</span>
                                      <span className="text-[10px] text-stone-400">Imagen</span>
                                    </div>
                                    <button onClick={() => copyToClipboard(prompt, `${creative.id}-f${fi}`)}
                                      className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-green-50 text-stone-600 hover:text-green-600 rounded text-[10px] font-bold transition-colors border border-stone-200 hover:border-green-200">
                                      {copiedId === `${creative.id}-f${fi}` ? <><Check className="w-3 h-3 text-green-600" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                                    </button>
                                  </div>
                                  <div className="bg-stone-900 border-t border-stone-700 p-4 text-xs text-stone-300 leading-relaxed whitespace-pre-wrap overflow-x-auto">
                                    <span className="text-stone-400">...respect logo 100% — brand </span>
                                    <span className="text-green-400 font-bold">{brand}</span>
                                    <span className="text-stone-400">. Include EXACTLY this text — do NOT modify:{'\n\n'}</span>
                                    <span className={`font-bold text-base ${colorMap[f.color]}`}>"""{f.text}"""</span>
                                    <span className="text-stone-400">{'\n'}</span>
                                    <span className="text-red-400">{(f.text || '').length} chars, {(f.text || '').split(' ').length} words: {(f.text || '').split(' ').map(w => `"${w}"(${w.length})`).join(' ')}</span>
                                    <span className="text-stone-400">{'\n\n'}Accents mandatory (á é í ó ú ñ). brand colors only, no white.</span>
                                  </div>
                                </div>
                              );
                            })}

                            <div className="flex flex-col border rounded-xl overflow-hidden border-purple-500/30">
                              <div className="flex items-center justify-between px-4 py-2 bg-purple-500/5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-purple-100 text-purple-700">VIDEO</span>
                                  <span className="text-[10px] text-stone-400">{frames.length} frames — 15s</span>
                                </div>
                                <button onClick={() => copyToClipboard(videoPrompt, `${creative.id}-video`)}
                                  className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-green-50 text-stone-600 hover:text-green-600 rounded text-[10px] font-bold transition-colors border border-stone-200 hover:border-green-200">
                                  {copiedId === `${creative.id}-video` ? <><Check className="w-3 h-3 text-green-600" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                                </button>
                              </div>
                              <div className="bg-stone-900 border-t border-stone-700 p-4 text-xs text-stone-300 leading-relaxed whitespace-pre-wrap overflow-x-auto">
                                <span className="text-stone-400">generate a 15-second video ad for </span>
                                <span className="text-green-400 font-bold">{brand}</span>
                                <span className="text-stone-400"> using this reference image as visual template. respect the logo 100% faithful in every frame.</span>
                                {cp && <><br/><span className="text-blue-400">frame 1 (0-4s): '{cp}'</span></>}
                                {dev && <><br/><span className="text-emerald-400">frame 2 (4-10s): '{dev}'</span></>}
                                {cl && <><br/><span className="text-amber-400">frame 3 (10-13s): '{cl}'</span></>}
                                <br/><span className="text-stone-400">frame 4 (13-15s): {brand} logo centered. same font, flawless spelling, same colors throughout all 15s.</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      {/* Resize / Adaptation Prompt */}
                      {(() => {
                        const b = creative.identifiedBrand;
                        const copyText = [creative.copyPrincipal, creative.desarrollo, creative.cierre].filter(Boolean).join(' ');
                        const size = creative.formatAndSize || '1080x1080';
                        const adaptPrompt = `Adapt this creative to formatos horizontales: 1920x1080 con dimensión 16:9 dimensions while maintaining 100% brand fidelity for ${b}.\n\nRESIZE RULES:\n- Use intelligent outpainting to extend the background naturally — match textures, colors, lighting, and perspective seamlessly.\n- The logo MUST remain in its exact original position and proportions — do NOT scale, move, stretch, or crop it.\n- All text must remain fully legible and in its original position. If the new aspect ratio requires repositioning, keep text centered and at the same relative scale.\n- Key visual elements (product, character, focal point) must stay in the visual center of attention — use rule of thirds for the new dimensions.\n- Do NOT add new elements, watermarks, or artifacts. The extended area should feel like a natural continuation of the original scene.\n- Maintain the exact same color palette, lighting direction, and brand style.\n- If adapting from horizontal to vertical (or vice versa): extend the dominant background direction, never crop the main subject.`;
                        return (
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1">
                                <Crop className="w-3 h-3" /> Prompt de Adaptación
                              </h4>
                              <button onClick={() => copyToClipboard(adaptPrompt, `${creative.id}-resize`)}
                                className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-green-50 text-stone-600 hover:text-green-600 rounded text-[10px] font-bold transition-colors border border-stone-200 hover:border-green-200">
                                {copiedId === `${creative.id}-resize` ? <><Check className="w-3 h-3 text-green-600" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                              </button>
                            </div>
                            <div className="bg-green-50/50 border border-green-200 p-4 rounded-xl text-xs text-green-800 leading-relaxed flex-1 overflow-y-auto">
                              {adaptPrompt}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Fixed progress bar at bottom while generating */}
      {isAnalyzing && creatives.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-stone-900 text-white px-6 py-3 z-40 shadow-lg border-t border-green-600">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-green-400" />
              <span className="text-sm font-medium">{progress}</span>
            </div>
            <span className="text-sm font-bold text-green-400">{creatives.length} generadas</span>
          </div>
        </div>
      )}

      {/* Regenerate Modal */}
      {regenConfig && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                Regenerar {regenConfig.type === 'title' ? 'Título' : 'Texto'}
              </h3>
              <button 
                onClick={() => { setRegenConfig(null); setRegenFeedback(''); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
                disabled={isRegenerating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Texto Actual
                </label>
                <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 border border-gray-100">
                  {regenConfig.currentText}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  Instrucciones / Feedback
                </label>
                <textarea
                  value={regenFeedback}
                  onChange={(e) => setRegenFeedback(e.target.value)}
                  placeholder="Ej: Hazlo más formal, enfócate en el descuento, usa un tono más juvenil..."
                  className="w-full h-24 p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  disabled={isRegenerating}
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setRegenConfig(null); setRegenFeedback(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                disabled={isRegenerating}
              >
                Cancelar
              </button>
              <button
                onClick={executeRegenerate}
                disabled={!regenFeedback.trim() || isRegenerating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Regenerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Regenerar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
