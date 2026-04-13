/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { extractAndOptimizePrompts, regenerateCopy, CreativeSpec } from './lib/gemini';
import { Loader2, Upload, FileText, Sparkles, AlertCircle, Copy, Check, Layers, Palette, Type, AlignLeft, Tag, Crop, RefreshCw, X, MessageSquare } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function App() {
  const [inputText, setInputText] = useState('');
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

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const specs = await extractAndOptimizePrompts(inputText);
      setCreatives(specs);
    } catch (err: any) {
      setError(err.message || "Error al analizar las especificaciones.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_csv(ws);
        
        // REEMPLAZAR el texto en lugar de añadirlo, para evitar que se acumule en múltiples intentos
        setInputText(`[Nombre del archivo original: ${file.name}]

${data}`);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Error al leer el archivo. Asegúrate de que sea un Excel o CSV válido.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
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
            <span>AI-Powered DCO</span>
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

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-stone-50 px-3 text-xs font-bold text-stone-400 uppercase tracking-wider">O pega el contenido</span>
              </div>
            </div>

            <textarea
              className="w-full h-48 p-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all resize-none text-sm leading-relaxed"
              placeholder="Ejemplo (Copiado de Excel):&#10;Campaña, Formato, Requerimientos&#10;Back to School, 1080x1080, Fondo amarillo corporativo, espacio a la izquierda para copy dinámico, niños felices con mochilas.&#10;Cyber Monday, 1920x1080, Fondo oscuro tecnológico, espacio central para precio dinámico."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            
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
                  Generar Prompts Maestros
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
          ) : isAnalyzing ? (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl bg-white">
              <Loader2 className="w-12 h-12 animate-spin text-green-600 mb-4" />
              <p className="text-lg font-bold text-stone-600">Analizando requerimientos y estructurando DCO...</p>
              <p className="text-sm mt-1">Esto puede tomar unos segundos</p>
            </div>
          ) : (
            <div className="space-y-6">
              {creatives.map((creative, index) => (
                <div key={creative.id} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col p-6 transition-all hover:shadow-md">
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* DCO Structure Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-900 border-b border-stone-100 pb-2 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-green-600" />
                        Estructura DCO & Copy (Fila #{index + 1})
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Identified Brand */}
                        <div className="bg-green-50/80 border border-green-100 p-3 rounded-xl relative group flex items-center gap-2">
                          <Tag className="w-4 h-4 text-green-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider block truncate">Marca Identificada</span>
                            <span className="text-sm font-bold text-gray-900 truncate block">{creative.identifiedBrand}</span>
                          </div>
                        </div>

                        {/* Format and Size */}
                        <div className="bg-stone-50/80 border border-stone-200 p-3 rounded-xl relative group flex items-center gap-2">
                          <Crop className="w-4 h-4 text-stone-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block truncate">Formato y Tamaño</span>
                            <span className="text-sm font-bold text-gray-900 truncate block">{creative.formatAndSize}</span>
                          </div>
                        </div>
                      </div>

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
                          <span className={`text-xs font-bold ${creative.suggestedTitle.length > 30 ? 'text-red-500' : 'text-green-600'}`}>
                            {creative.suggestedTitle.length}/30
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

                      {/* Suggested Copy */}
                      <div className="bg-orange-50/50 border border-orange-100/50 p-4 rounded-xl relative group">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                            <AlignLeft className="w-3 h-3" /> Texto Sugerido
                          </span>
                          <span className={`text-xs font-bold ${creative.suggestedCopy.length > 90 ? 'text-red-500' : 'text-green-600'}`}>
                            {creative.suggestedCopy.length}/90
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
                        Prompt Maestro (Master Prompt)
                      </h3>

                      {/* Filled Template Prompt */}
                      {(() => {
                        const filledEn = `take as a reference this creative and generate 5 different variants with this image. respect the logo 100% faithful and the identity of the brand ${creative.identifiedBrand}. change the background environment and the character to: ${creative.campaignContext}. take the same font and Include the exact text '${creative.suggestedTitle}' and '${creative.suggestedCopy}' ensuring flawless spelling. be faithful to the initial logo and the graphic lines.`;
                        const filledEs = `toma como referencia esta pieza creativa y genera 5 variantes diferentes con esta imagen. respeta el logo 100% fiel y la identidad de la marca ${creative.identifiedBrand}. cambia el entorno del fondo y el personaje a: ${creative.campaignContext}. usa la misma tipografía e incluye el texto exacto '${creative.suggestedTitle}' y '${creative.suggestedCopy}' asegurando ortografía impecable. sé fiel al logo inicial y a las líneas gráficas.`;
                        return (
                          <>
                            {/* English Filled */}
                            <div className="flex flex-col">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider">Inglés (Para la IA)</h4>
                                <button
                                  onClick={() => copyToClipboard(filledEn, `${creative.id}-en`)}
                                  className="flex items-center gap-1 px-2 py-1 bg-stone-50 hover:bg-green-50 text-stone-600 hover:text-green-600 rounded text-[10px] font-bold transition-colors border border-stone-200 hover:border-green-200"
                                >
                                  {copiedId === `${creative.id}-en` ? (
                                    <><Check className="w-3 h-3 text-green-600" /> Copiado</>
                                  ) : (
                                    <><Copy className="w-3 h-3" /> Copiar</>
                                  )}
                                </button>
                              </div>
                              <div className="bg-stone-900 border border-stone-700 p-4 rounded-xl text-xs text-stone-300 leading-relaxed font-mono whitespace-pre-wrap">
                                <span className="text-stone-400">take as a reference this creative and generate 5 different variants with this image. respect the logo 100% faithful and the identity of the brand </span>
                                <span className="text-green-400 font-bold">{creative.identifiedBrand}</span>
                                <span className="text-stone-400">. change the background environment and the character to: </span>
                                <span className="text-green-400 font-bold">{creative.campaignContext}</span>
                                <span className="text-stone-400">. take the same font and Include the exact text '</span>
                                <span className="text-orange-400 font-bold">{creative.suggestedTitle}</span>
                                <span className="text-stone-400">' and '</span>
                                <span className="text-orange-400 font-bold">{creative.suggestedCopy}</span>
                                <span className="text-stone-400">' ensuring flawless spelling. be faithful to the initial logo and the graphic lines.</span>
                              </div>
                            </div>

                            {/* Spanish Filled */}
                            <div className="flex flex-col">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider">Español (Referencia)</h4>
                                <button
                                  onClick={() => copyToClipboard(filledEs, `${creative.id}-es`)}
                                  className="flex items-center gap-1 px-2 py-1 bg-stone-50 hover:bg-green-50 text-stone-600 hover:text-green-600 rounded text-[10px] font-bold transition-colors border border-stone-200 hover:border-green-200"
                                >
                                  {copiedId === `${creative.id}-es` ? (
                                    <><Check className="w-3 h-3 text-green-600" /> Copiado</>
                                  ) : (
                                    <><Copy className="w-3 h-3" /> Copiar</>
                                  )}
                                </button>
                              </div>
                              <div className="bg-stone-900 border border-stone-700 p-4 rounded-xl text-xs text-stone-300 leading-relaxed font-mono whitespace-pre-wrap">
                                <span className="text-stone-400">toma como referencia esta pieza creativa y genera 5 variantes diferentes con esta imagen. respeta el logo 100% fiel y la identidad de la marca </span>
                                <span className="text-green-400 font-bold">{creative.identifiedBrand}</span>
                                <span className="text-stone-400">. cambia el entorno del fondo y el personaje a: </span>
                                <span className="text-green-400 font-bold">{creative.campaignContext}</span>
                                <span className="text-stone-400">. usa la misma tipografía e incluye el texto exacto '</span>
                                <span className="text-orange-400 font-bold">{creative.suggestedTitle}</span>
                                <span className="text-stone-400">' y '</span>
                                <span className="text-orange-400 font-bold">{creative.suggestedCopy}</span>
                                <span className="text-stone-400">' asegurando ortografía impecable. sé fiel al logo inicial y a las líneas gráficas.</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      {/* Resize Prompt */}
                      <div className="flex flex-col h-[140px]">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1">
                            <Crop className="w-3 h-3" /> Prompt de Adaptación (Outpainting)
                          </h4>
                          <button 
                            onClick={() => copyToClipboard(creative.resizePrompt, `${creative.id}-resize`)}
                            className="flex items-center gap-1 px-2 py-1 bg-stone-50 hover:bg-green-50 text-stone-600 hover:text-green-600 rounded text-[10px] font-bold transition-colors border border-stone-200 hover:border-green-200"
                          >
                            {copiedId === `${creative.id}-resize` ? (
                              <><Check className="w-3 h-3 text-green-600" /> Copiado</>
                            ) : (
                              <><Copy className="w-3 h-3" /> Copiar</>
                            )}
                          </button>
                        </div>
                        <div className="bg-green-50/50 border border-green-200 p-4 rounded-xl text-xs text-gray-700 leading-relaxed flex-1 font-mono overflow-y-auto whitespace-pre-wrap">
                          {creative.resizePrompt}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
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
