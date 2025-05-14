"use client";

import React, { useState } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import bwipjs from 'bwip-js';

interface CsvRow {
  DUN: string;
  LOTE: string;
  DESCRICAO: string;
  QTD_VOLUME: string;
  QTD_PECAS: string;
  VALIDADE?: string;
  QTD_ETIQUETAS?: string;
}

export default function HomePage() {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse<CsvRow>(file, {
        header: true,
        complete: (results) => {
          const filteredData = results.data.filter(row => row.DUN && row.LOTE);
          setCsvData(filteredData);
          console.log('Dados do CSV filtrados:', filteredData);
        },
      });
    }
  };

  const generatePDF = async () => {
    setLoading(true);
    if (!csvData || csvData.length === 0) {
      console.error("Nenhum dado CSV encontrado");
      setLoading(false);
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'cm',
      format: [10, 7],
    });

    const generateBarcodeImage = (text: string): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        const canvas = document.createElement('canvas');
        try {
          bwipjs.toCanvas(canvas, {
            bcid: 'code128',
            text: text,
            scale: 5, // Ajuste de escala para tamanho do código de barras
            height: 5, // Ajuste de altura do código de barras
            includetext: true, // Inclui ou não o texto diretamente no código de barras
          });
          const barcodeImage = canvas.toDataURL("image/png");
          resolve(barcodeImage);
        } catch (error) {
          reject(error);
        }
      });
    };

    const generateBarcodes = async () => {
  let isFirstPage = true;

  for (let index = 0; index < csvData.length; index++) {
    const row = csvData[index];

    if (!row.DUN || !row.LOTE) {
      console.error(`Linha ${index + 1} não contém valores necessários`);
      continue;
    }

    // Converte a quantidade de etiquetas para número e usa 1 como padrão
    const qtdEtiquetas = Math.max(parseInt(row.QTD_ETIQUETAS || '1'), 1);

    for (let i = 0; i < qtdEtiquetas; i++) {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      try {
        doc.setFont("Helvetica", "Bold");
        doc.setFontSize(11);

        const dunBarcode = await generateBarcodeImage(row.DUN);
        doc.addImage(dunBarcode, 'PNG', 0.1, 0.1, 9.8, 1.8);
        doc.text(`DUN:`, 0.1, 1.8);

        doc.setFont("Helvetica", "Bold");
        doc.setFontSize(11);

        const descricaoTexto = doc.splitTextToSize(`Descrição: ${row.DESCRICAO}`, 9.8);
        doc.text(descricaoTexto, 0.2, 2.8);
        doc.text(`Qtd Peças: ${row.QTD_PECAS}`, 0.2, 4.7);

        const validade = row.VALIDADE ? row.VALIDADE : new Date().toLocaleDateString();
        doc.text(`Data de Validade: ${validade}`, 9.8, 4.7, { align: 'right' });

        const loteBarcode = await generateBarcodeImage(row.LOTE);
        doc.addImage(loteBarcode, 'PNG', 0.1, 5.2, 9.8, 1.8);
        doc.text(`LOTE:`, 0.1, 6.9);
      } catch (error) {
        console.error("Erro ao gerar código de barras:", error);
      }
    }
  }

  doc.save("Etiquetas.pdf");
};


    try {
      await generateBarcodes();
    } catch (error) {
      console.error("Erro ao gerar o PDF:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <img src="/logo.png" alt="Logo" className="logo" />
      <h1>Impressão de Etiquetas (DUN)</h1>
      <p>Importar CSV</p>
      <input title="Import de Arquivo CSV" type="file" accept=".csv" onChange={handleFileUpload} className="fileInput" />
      <button title="Botão para gerar etiquetas" type="button" onClick={generatePDF} disabled={loading} className="button">
        {loading ? 'Gerando...' : 'Gerar Etiquetas'}
      </button>
    </div>
  );
}
