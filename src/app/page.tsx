"use client";

import React, { useState, useEffect } from 'react';

// Declara as bibliotecas no escopo global para o TypeScript
declare global {
  interface Window {
    Papa: any;
    jspdf: any;
    bwipjs: any;
  }
}

// Interface para os dados do CSV (com o campo DESCRICAO)
interface CsvRow {
  NOME_CLIENTE: string;
  CODIGO: string;
  EAN: string;
  DESCRICAO: string;
  LOTE: string;
  VENCIMENTO: string;
  QTD_ETIQUETAS?: string;
}

export default function HomePage() {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  useEffect(() => {
    const loadScript = (src: string) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/bwip-js@4.1.0/dist/bwip-js.min.js')
    ]).then(() => {
      setScriptsLoaded(true);
    }).catch(err => {
      console.error("Falha ao carregar os scripts necessários:", err);
      setError("Não foi possível carregar as dependências. Verifique sua conexão e recarregue a página.");
    });
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv') {
        setError('Por favor, selecione um arquivo .csv');
        return;
      }
      
      setFileName(file.name);
      setError('');
      window.Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: ";", // Usa ponto e vírgula como separador
        complete: (results: any) => {
          const requiredColumns = ['NOME_CLIENTE', 'CODIGO', 'EAN', 'DESCRICAO', 'LOTE', 'VENCIMENTO'];
          const fileColumns = results.meta.fields || [];
          const missingColumns = requiredColumns.filter(col => !fileColumns.includes(col));

          if (missingColumns.length > 0) {
            setError(`O arquivo CSV não contém as seguintes colunas obrigatórias: ${missingColumns.join(', ')}`);
            setCsvData([]);
            setFileName('');
            return;
          }

          const filteredData = results.data.filter((row: CsvRow) => row.NOME_CLIENTE && row.CODIGO && row.EAN && row.DESCRICAO && row.LOTE && row.VENCIMENTO);
          setCsvData(filteredData);
        },
        error: (err: any) => {
            setError(`Erro ao processar o arquivo: ${err.message}`);
        }
      });
    }
  };

  const downloadTemplate = () => {
    // Adicionado \uFEFF (BOM) para compatibilidade com Excel e usando ; como separador
    const csvContent = "\uFEFFNOME_CLIENTE;CODIGO;EAN;DESCRICAO;LOTE;VENCIMENTO;QTD_ETIQUETAS\n" +
                         "SYN;CSSK;7891234567890;CREA Sour Morango com Kiwi;GCRMK2408012;02/2027;1\n" +
                         "OUTRO CLIENTE;XYZ-01;9876543210987;Produto Exemplo 2;LOTEABCDE123;12/2025;5";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_etiquetas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const generatePDF = async () => {
    if (csvData.length === 0) {
      setError("Nenhum dado válido para gerar as etiquetas. Verifique o arquivo CSV.");
      return;
    }
    setLoading(true);
    setError('');

    const doc = new window.jspdf.jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [100, 70], // Tamanho 10x7 cm
    });

    const generateBarcodeImage = (text: string, height: number): Promise<string> => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        try {
          window.bwipjs.toCanvas(canvas, {
            bcid: 'code128', text, scale: 3, height, includetext: false, textxalign: 'center',
          });
          resolve(canvas.toDataURL("image/png"));
        } catch (e) { reject(e); }
      });
    };

    let isFirstPage = true;

    for (const row of csvData) {
        const quantity = parseInt(row.QTD_ETIQUETAS || '1', 10);
        if (isNaN(quantity) || quantity < 1) continue;

        try {
            const eanBarcode = await generateBarcodeImage(row.EAN, 8);
            const loteBarcode = await generateBarcodeImage(row.LOTE, 8);

            for (let i = 0; i < quantity; i++) {
                if (!isFirstPage) doc.addPage();
                isFirstPage = false;

                const margin = 3;
                const pageW = doc.internal.pageSize.getWidth();
                
                doc.setDrawColor(0);
                doc.rect(1, 1, pageW - 2, 68); 

                doc.setFont("Helvetica", "bold");
                doc.setFontSize(16); 
                doc.text(row.NOME_CLIENTE, pageW / 2, 7, { align: 'center' });

                // --- CÓDIGO ---
                doc.setFontSize(8); 
                doc.rect(margin, 9, 22, 7);
                doc.text("CÓDIGO", margin + 11, 13.5, { align: 'center' });
                doc.rect(margin + 23, 9, pageW - 30, 7);
                doc.setFontSize(8); 
                doc.text(row.CODIGO, margin + 23 + (pageW - 30) / 2, 13.5, { align: 'center' });
                doc.rect(margin, 17, 22, 7);
                doc.text("EAN", margin + 11, 21.5, { align: 'center' });
                doc.addImage(eanBarcode, 'PNG', margin + 23, 16.5, pageW - 30, 8);
                
                // --- DESCRIÇÃO ---
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(8);
                doc.rect(margin, 25, 22, 15);
                doc.text("DESCRIÇÃO", margin + 11, 33.5, { align: 'center' });
                doc.rect(margin + 23, 25, pageW - 30, 15);
                doc.setFontSize(8);
                
                // 1. Limita a string da descrição para no máximo 132 caracteres
                const descricaoLimitada = row.DESCRICAO.substring(0, 132);

                // 2. Quebra o texto (já limitado) em linhas que cabem na largura da caixa
                const descMaxWidth = pageW - 32;
                const descricaoTexto = doc.splitTextToSize(descricaoLimitada, descMaxWidth);

                // 3. Lógica para centralizar verticalmente
                const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor;
                const boxCenterY = 25 + (15 / 2);
                const startY = boxCenterY - ((descricaoTexto.length - 1) * lineHeight) / 2;
                const centerX = margin + 23 + (pageW - 30) / 2;

                // 4. Adiciona o texto ao PDF
                doc.text(descricaoTexto, centerX, startY, { align: 'center' });

                // --- LOTE ---
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(8); 
                doc.rect(margin, 41.5, 22, 15.5);
                doc.text("LOTE", margin + 11, 49.5, { align: 'center' });
                doc.rect(margin + 23, 41.5, pageW - 30, 7);
                doc.setFontSize(8); 
                doc.text(row.LOTE, margin + 23 + (pageW - 30) / 2, 46, { align: 'center' });
                doc.addImage(loteBarcode, 'PNG', margin + 23, 49, pageW - 30, 8);

                // --- VENCIMENTO ---
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(8); 
                doc.rect(margin, 59, 22, 7);
                doc.text("VENCIMENTO", margin + 11, 63.5, { align: 'center' });
                doc.setFontSize(14); 
                doc.rect(margin + 23, 59, pageW - 30, 7);
                doc.text(row.VENCIMENTO, margin + 23 + (pageW - 30) / 2, 64, { align: 'center' });
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            setError(`Erro ao gerar código de barras para EAN ${row.EAN}: ${errorMessage}`);
            console.error(e);
            continue; 
        }
    }

    if (!error) doc.save("etiquetas.pdf");
    setLoading(false);
  };
  
  return (
    <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4 text-gray-100">
        <div className="w-full max-w-lg bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
            <div className='text-center'>
              <img src="/logo.png" alt="Logo da sua Empresa" className="w-40 mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-white">Gerador de Etiquetas</h1>
                <p className="text-gray-400 mt-2">Importe um arquivo CSV para criar suas etiquetas.</p>
                {!scriptsLoaded && !error && <p className="text-yellow-400 text-sm mt-2">Carregando dependências...</p>}
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm">
                    <p>{error}</p>
                </div>
            )}
            
            <div className="space-y-4">
                <label htmlFor="file-upload" className={`w-full cursor-pointer bg-gray-700 hover:bg-gray-600 transition-colors text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center ${!scriptsLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {fileName ? `Arquivo: ${fileName}` : 'Escolher Arquivo CSV'}
                </label>
                <input id="file-upload" type="file" accept=".csv" onChange={handleFileUpload} className="hidden" disabled={!scriptsLoaded} />

                <div className='flex flex-col sm:flex-row gap-4'>
                    <button 
                        onClick={downloadTemplate} 
                        className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                         </svg>
                         Baixar Modelo
                    </button>

                    <button 
                        onClick={generatePDF} 
                        disabled={loading || csvData.length === 0 || !scriptsLoaded} 
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center"
                    >
                        {loading ? (
                            <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Gerando...</>
                        ) : 'Gerar Etiquetas'}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}