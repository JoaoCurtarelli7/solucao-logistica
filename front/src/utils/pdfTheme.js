import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

const BRAND = "Solução Logística";
const PRIMARY_RED = [192, 57, 43];
const LIGHT_RED_BG = [253, 245, 245];

const getInitials = (name) => {
  const text = String(name || BRAND).trim();
  if (!text) return "SL";
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "SL";
};

export const createStandardPdf = ({ title, companyName, subtitle, generatedAt }) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(...LIGHT_RED_BG);
  doc.rect(0, 0, pageWidth, 34, "F");

  // Logo badge (text-based mark)
  doc.setFillColor(...PRIMARY_RED);
  doc.roundedRect(14, 9, 14, 14, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(getInitials(companyName), 21, 17, { align: "center", baseline: "middle" });

  // Title and meta
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(13);
  doc.text(title || "Relatório", 32, 14);
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(companyName ? `Empresa: ${companyName}` : BRAND, 32, 20);
  if (subtitle) doc.text(subtitle, 32, 25);
  doc.text(`Gerado em: ${generatedAt || dayjs().format("DD/MM/YYYY HH:mm")}`, 14, 31);

  return { doc, startY: 40 };
};

export const addCompactTable = (doc, { head, body, startY }) => {
  autoTable(doc, {
    head: [head],
    body,
    startY,
    tableLineWidth: 0.1,
    tableLineColor: [230, 230, 230],
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      lineWidth: 0.1,
      lineColor: [235, 235, 235],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: PRIMARY_RED,
      textColor: 255,
      fontStyle: "bold",
      lineWidth: 0.1,
      lineColor: [220, 220, 220],
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    margin: { left: 14, right: 14 },
  });
  return doc.lastAutoTable?.finalY || startY;
};

