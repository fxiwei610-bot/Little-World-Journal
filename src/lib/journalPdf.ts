import { jsPDF } from 'jspdf';
import type { JournalEntry } from '../types/journal';

interface LoadedRasterImage {
  dataUrl: string;
  format: 'JPEG' | 'PNG';
  width: number;
  height: number;
}

function sanitizePdfText(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    // Remove surrogate pairs / emoji outside Latin-1 so jsPDF Helvetica stays crisp
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '')
    .trim();
}

function formatPdfDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return sanitizePdfText(dateStr) || 'Undated';
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function slugifyFilename(title: string, date: string): string {
  const stem = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const dateSuffix = date ? `-${date.replace(/[^0-9-]/g, '')}` : '';
  return `${stem || 'travel-journal'}${dateSuffix}.pdf`;
}

function imageElementToRaster(dataOrObjectUrl: string): Promise<LoadedRasterImage | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const naturalW = img.naturalWidth || 800;
      const naturalH = img.naturalHeight || 600;
      const maxDim = 1400;
      let targetW = naturalW;
      let targetH = naturalH;

      if (targetW > maxDim || targetH > maxDim) {
        if (targetW >= targetH) {
          targetH = Math.round((targetH * maxDim) / targetW);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW * maxDim) / targetH);
          targetH = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, targetW);
      canvas.height = Math.max(1, targetH);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      // Fill warm white behind transparent PNGs before exporting to JPEG
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      try {
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve({
          dataUrl: jpegDataUrl,
          format: 'JPEG',
          width: canvas.width,
          height: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataOrObjectUrl;
  });
}

async function loadPhotoForPdf(url: string): Promise<LoadedRasterImage | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Data URLs can be converted directly
  if (trimmed.startsWith('data:image/')) {
    return imageElementToRaster(trimmed);
  }

  // Same-origin URLs (e.g. /uploads/...) can be fetched directly without CORS taint
  if (trimmed.startsWith('/') || trimmed.startsWith(window.location.origin)) {
    try {
      const direct = await imageElementToRaster(trimmed);
      if (direct) return direct;
    } catch {
      // Fall through
    }
  }

  // Try direct CORS load first for external URLs
  const corsAttempt = await imageElementToRaster(trimmed);
  if (corsAttempt) return corsAttempt;

  // Fallback to backend image proxy for external hosts without CORS headers
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const proxyRes = await fetch(
        `/api/photo-data?url=${encodeURIComponent(trimmed)}`
      );
      if (proxyRes.ok) {
        const data = (await proxyRes.json()) as { dataUrl?: string };
        if (data.dataUrl) {
          return imageElementToRaster(data.dataUrl);
        }
      }
    } catch {
      // Ignore proxy errors and skip broken image gracefully
    }
  }

  return null;
}

function drawScenicCoverIllustration(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number
) {
  // Soft cream sky
  doc.setFillColor(255, 241, 223);
  doc.roundedRect(x, y, w, h, 8, 8, 'F');
  // Sun
  doc.setFillColor(255, 130, 110);
  doc.circle(x + w * 0.78, y + h * 0.34, 18, 'F');
  // Distant hill
  doc.setFillColor(154, 164, 194);
  doc.triangle(x, y + h, x + w * 0.35, y + h * 0.42, x + w * 0.72, y + h, 'F');
  // Foreground hill
  doc.setFillColor(55, 68, 99);
  doc.triangle(x + w * 0.25, y + h, x + w * 0.65, y + h * 0.48, x + w, y + h, 'F');
}

export async function exportJournalEntryToPdf(entry: JournalEntry): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const contentWidth = pageWidth - marginX * 2;
  const topMargin = 46;
  const bottomMargin = 52;
  let y = topMargin;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = topMargin;
    }
  };

  // Top Header Strip
  doc.setFillColor(255, 249, 237);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(255, 130, 110);
  doc.rect(0, 28, pageWidth, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(214, 102, 84);
  doc.text('THE LITTLE WORLD JOURNAL  -  TRAVEL MEMORY', marginX, 18);

  y = 52;

  // Title
  const cleanTitle = sanitizePdfText(entry.title) || 'Travel Journal Entry';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(39, 51, 75);
  const titleLines = doc.splitTextToSize(cleanTitle, contentWidth) as string[];
  doc.text(titleLines, marginX, y);
  y += titleLines.length * 26 + 4;

  // Subtitle line
  const subtitleParts = [
    sanitizePdfText(entry.country),
    sanitizePdfText(entry.location),
    formatPdfDate(entry.date),
  ].filter(Boolean);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(214, 102, 84);
  doc.text(subtitleParts.join('  ·  '), marginX, y);
  y += 18;

  // Load all photos up front (cover + gallery)
  const coverPhoto = entry.photoUrl ? await loadPhotoForPdf(entry.photoUrl) : null;
  const gallerySources = (entry.gallery || []).filter((g) => g.url && g.url.trim().length > 0);
  const loadedGallery = await Promise.all(
    gallerySources.map(async (item) => ({
      caption: sanitizePdfText(item.caption),
      url: item.url,
      raster: await loadPhotoForPdf(item.url),
    }))
  );

  // Cover visual
  if (coverPhoto) {
    const maxCoverH = 230;
    const scale = Math.min(contentWidth / coverPhoto.width, maxCoverH / coverPhoto.height);
    const drawW = coverPhoto.width * scale;
    const drawH = coverPhoto.height * scale;
    const drawX = marginX + (contentWidth - drawW) / 2;
    ensureSpace(drawH + 16);
    doc.setFillColor(248, 243, 234);
    doc.roundedRect(marginX, y, contentWidth, drawH, 6, 6, 'F');
    doc.addImage(coverPhoto.dataUrl, coverPhoto.format, drawX, y, drawW, drawH);
    y += drawH + 16;
  } else {
    const fallbackH = 120;
    ensureSpace(fallbackH + 16);
    drawScenicCoverIllustration(doc, marginX, y, contentWidth, fallbackH);
    y += fallbackH + 16;
  }

  // Metadata Box
  const metaItems = [
    { label: 'DATE', value: formatPdfDate(entry.date) },
    { label: 'PLACE', value: sanitizePdfText(entry.location || entry.country) || '—' },
    { label: 'COMPANIONS', value: sanitizePdfText(entry.companions) || 'Not specified' },
    { label: 'WEATHER', value: sanitizePdfText(entry.weather) || 'Not recorded' },
  ];

  const metaBoxH = 48;
  ensureSpace(metaBoxH + 18);
  doc.setFillColor(255, 248, 237);
  doc.setDrawColor(240, 233, 220);
  doc.roundedRect(marginX, y, contentWidth, metaBoxH, 6, 6, 'FD');

  const colW = contentWidth / 4;
  metaItems.forEach((item, idx) => {
    const cellX = marginX + idx * colW + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(108, 117, 132);
    doc.text(item.label, cellX, y + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(39, 51, 75);
    const valLine = (doc.splitTextToSize(item.value, colW - 18) as string[])[0] || '—';
    doc.text(valLine, cellX, y + 33);
  });
  y += metaBoxH + 22;

  // Story Section
  ensureSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(39, 51, 75);
  doc.text('Travel Story & Experiences', marginX, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(63, 74, 92);
  const storyText = sanitizePdfText(entry.text) || 'No travel story recorded.';
  const paragraphs = storyText.split(/\n+/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      y += 8;
      continue;
    }
    const lines = doc.splitTextToSize(trimmed, contentWidth) as string[];
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, marginX, y);
      y += 15.5;
    }
    y += 7;
  }

  // Highlights Section
  const cleanHighlights = (entry.highlights || [])
    .map((h) => sanitizePdfText(h))
    .filter(Boolean);

  if (cleanHighlights.length > 0) {
    y += 8;
    ensureSpace(42);
    doc.setDrawColor(240, 233, 220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(39, 51, 75);
    doc.text('Memorable Highlights', marginX, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(39, 51, 75);

    for (const highlight of cleanHighlights) {
      const hLines = doc.splitTextToSize(highlight, contentWidth - 18) as string[];
      ensureSpace(hLines.length * 14 + 6);
      doc.setFillColor(255, 130, 110);
      doc.circle(marginX + 4, y - 3.5, 2.2, 'F');
      doc.text(hLines, marginX + 14, y);
      y += hLines.length * 14 + 6;
    }
  }

  // Photo Gallery Section (all gallery photos; plus cover if not duplicated in gallery)
  const galleryEntries = loadedGallery.filter((g) => g.raster !== null) as {
    caption: string;
    url: string;
    raster: LoadedRasterImage;
  }[];

  if (galleryEntries.length > 0) {
    y += 10;
    ensureSpace(46);
    doc.setDrawColor(240, 233, 220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(39, 51, 75);
    doc.text(
      `Photo Gallery (${galleryEntries.length} ${
        galleryEntries.length === 1 ? 'photo' : 'photos'
      })`,
      marginX,
      y
    );
    y += 18;

    const gap = 14;
    const cardW = (contentWidth - gap) / 2;
    const maxImgH = 155;

    for (let i = 0; i < galleryEntries.length; i += 2) {
      const pair = galleryEntries.slice(i, i + 2);
      const renderedPair = pair.map((item) => {
        const scale = Math.min(cardW / item.raster.width, maxImgH / item.raster.height);
        const drawW = item.raster.width * scale;
        const drawH = item.raster.height * scale;
        const captionLines = item.caption
          ? (doc.splitTextToSize(item.caption, cardW - 12) as string[]).slice(0, 2)
          : [];
        return { item, drawW, drawH, captionLines };
      });

      const rowImgH = Math.max(...renderedPair.map((p) => p.drawH));
      const rowCaptionH = Math.max(
        ...renderedPair.map((p) =>
          p.captionLines.length > 0 ? p.captionLines.length * 12 + 10 : 0
        )
      );
      const rowTotalH = rowImgH + rowCaptionH + 10;

      ensureSpace(rowTotalH);

      renderedPair.forEach((p, colIdx) => {
        const cardX = marginX + colIdx * (cardW + gap);
        const boxH = rowImgH + rowCaptionH;

        doc.setFillColor(255, 253, 248);
        doc.setDrawColor(240, 233, 220);
        doc.roundedRect(cardX, y, cardW, boxH, 5, 5, 'FD');

        const imgX = cardX + (cardW - p.drawW) / 2;
        const imgY = y + (rowImgH - p.drawH) / 2;
        doc.addImage(
          p.item.raster.dataUrl,
          p.item.raster.format,
          imgX,
          imgY,
          p.drawW,
          p.drawH
        );

        if (p.captionLines.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(39, 51, 75);
          doc.text(p.captionLines, cardX + 6, y + rowImgH + 13);
        }
      });

      y += rowTotalH + 6;
    }
  }

  // Page Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(140, 148, 163);
    doc.text(
      `The Little World Journal  ·  ${cleanTitle}`,
      marginX,
      pageHeight - 24
    );
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 24,
      { align: 'right' }
    );
  }

  doc.save(slugifyFilename(cleanTitle, entry.date));
}
