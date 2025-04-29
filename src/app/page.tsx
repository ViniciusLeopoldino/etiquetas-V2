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
      for (let index = 0; index < csvData.length; index++) {
        const row = csvData[index];

        if (!row.DUN || !row.LOTE) {
          console.error(`Linha ${index + 1} não contém valores necessários`);
          continue;
        }

        if (index > 0) {
          doc.addPage();
        }

        try {
          /////////////////Alterar fonte e tipo de texto/////////////////
          //Tipos de Texto = Normal(padrão), Bold(negrito), Italic(itálico) e BoldItalic(negrito e itálico)
          //Tipos de fonte = Helvetica, Times e Courier
          doc.setFont("Helvetica", "Bold");
          doc.setFontSize(11);

          // Código de barras inicial (da coluna DUN)
          const dunBarcode = await generateBarcodeImage(row.DUN);
          doc.addImage(dunBarcode, 'PNG', 0.1, 0.1, 9.8, 1.8);
          doc.text(`DUN:`, 0.1, 1.8); // Valor do código

          /////////////////Alterar fonte e tipo de texto/////////////////
          //Tipos de Texto = Normal(padrão), Bold(negrito), Italic(itálico) e BoldItalic(negrito e itálico)
          //Tipos de fonte = Helvetica, Times e Courier
          doc.setFont("Helvetica", "Bold");
          doc.setFontSize(11);

          // Adiciona descrição, volume e peças
          const descricaoTexto = doc.splitTextToSize(`Descrição: ${row.DESCRICAO}`, 9.8);
          doc.text(descricaoTexto, 0.2, 2.8);
          // doc.text(`Qtd Volume: ${row.QTD_VOLUME}`, 0.2, 4.1);
          doc.text(`Qtd Peças: ${row.QTD_PECAS}`, 0.2, 4.7);

          // Adiciona validade (se existir)
          const validade = row.VALIDADE ? row.VALIDADE : new Date().toLocaleDateString();
          doc.text(`Data de Validade: ${validade}`, 9.8, 4.7, { align: 'right' });

          // Código de barras final (da coluna LOTE)
          const loteBarcode = await generateBarcodeImage(row.LOTE);
          doc.addImage(loteBarcode, 'PNG', 0.1, 5.2, 9.8, 1.8);
          doc.text(`LOTE:`, 0.1, 6.9); // Valor do lote

        } catch (error) {
          console.error("Erro ao gerar código de barras:", error);
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
      <h1>Impressão de Etiquetas</h1>
      <p>Importar CSV</p>
      <input title="Import de Arquivo CSV" type="file" accept=".csv" onChange={handleFileUpload} className="fileInput" />
      <button title="Botão para gerar etiquetas" type="button" onClick={generatePDF} disabled={loading} className="button">
        {loading ? 'Gerando...' : 'Gerar Etiquetas'}
      </button>
    </div>
  );
}
