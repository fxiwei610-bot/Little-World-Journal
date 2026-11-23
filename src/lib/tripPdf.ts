import { jsPDF } from 'jspdf';
import type { Country, Trip, TripActivity } from '../types/journal';
import {
  getDayDateLabel,
  getTripDateRangeLabel,
  sortActivitiesChronologically,
} from './itinerary';

function sanitizePdfText(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    // Replace common currency glyphs outside Latin-1 with readable codes
    .replace(/\u20B1/g, 'PHP ')
    .replace(/\u20A9/g, 'KRW ')
    .replace(/\u20AC/g, 'EUR ')
    .replace(/\u0E3F/g, 'THB ')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '')
    .trim();
}

function slugifyTripFilename(title: string, date: string): string {
  const stem = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const dateSuffix = date ? `-${date.replace(/[^0-9-]/g, '')}` : '';
  return `${stem || 'trip-itinerary'}${dateSuffix}-itinerary.pdf`;
}

export function exportTripItineraryToPdf(trip: Trip, country?: Country): void {
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

  // Header Banner
  doc.setFillColor(255, 249, 237);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(255, 130, 110);
  doc.rect(0, 28, pageWidth, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(214, 102, 84);
  doc.text('THE LITTLE WORLD JOURNAL  -  DETAILED TRIP ITINERARY', marginX, 18);

  y = 54;

  // Trip Title
  const cleanTitle = sanitizePdfText(trip.name) || 'Trip Itinerary';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(39, 51, 75);
  const titleLines = doc.splitTextToSize(cleanTitle, contentWidth) as string[];
  doc.text(titleLines, marginX, y);
  y += titleLines.length * 26 + 4;

  // Subtitle
  const dateRange = sanitizePdfText(getTripDateRangeLabel(trip.date, trip.days));
  const subtitleParts = [
    sanitizePdfText(trip.country),
    `${trip.days} ${trip.days === 1 ? 'Day' : 'Days'}`,
    dateRange,
  ].filter(Boolean);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(214, 102, 84);
  doc.text(subtitleParts.join('  ·  '), marginX, y);
  y += 20;

  // Summary Metadata Card
  const metaItems = [
    { label: 'DESTINATION', value: sanitizePdfText(trip.country) || 'TBD' },
    { label: 'DATES', value: dateRange || 'TBD' },
    { label: 'STATUS', value: sanitizePdfText(trip.status) || 'Planning' },
    {
      label: 'ITINERARY STOPS',
      value: `${trip.activities.length} ${trip.activities.length === 1 ? 'stop' : 'stops'}`,
    },
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
    const valLine = (doc.splitTextToSize(item.value, colW - 18) as string[])[0] || '-';
    doc.text(valLine, cellX, y + 33);
  });
  y += metaBoxH + 20;

  // Country Quick Info / Best Season (if available)
  if (country && (country.capital || country.currency || country.season)) {
    const countryLineParts = [
      country.capital ? `Capital: ${sanitizePdfText(country.capital)}` : '',
      country.currency ? `Currency: ${sanitizePdfText(country.currency)}` : '',
      country.season ? `Best Season: ${sanitizePdfText(country.season)}` : '',
    ].filter(Boolean);

    if (countryLineParts.length > 0) {
      const infoLines = doc.splitTextToSize(countryLineParts.join('   |   '), contentWidth) as string[];
      ensureSpace(infoLines.length * 13 + 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(108, 117, 132);
      doc.text(infoLines, marginX, y);
      y += infoLines.length * 13 + 12;
    }
  }

  // Itinerary Overview
  const cleanOverview = sanitizePdfText(trip.itineraryOverview);
  if (cleanOverview) {
    const overviewLines = doc.splitTextToSize(cleanOverview, contentWidth - 20) as string[];
    const boxH = overviewLines.length * 14 + 28;
    ensureSpace(boxH + 14);
    doc.setFillColor(244, 250, 253);
    doc.setDrawColor(220, 236, 245);
    doc.roundedRect(marginX, y, contentWidth, boxH, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(58, 110, 143);
    doc.text('TRIP OVERVIEW', marginX + 10, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(39, 51, 75);
    doc.text(overviewLines, marginX + 10, y + 30);
    y += boxH + 16;
  }

  // Notes
  const cleanNotes = sanitizePdfText(trip.notes);
  if (cleanNotes) {
    const noteLines = doc.splitTextToSize(cleanNotes, contentWidth - 20) as string[];
    const boxH = noteLines.length * 14 + 28;
    ensureSpace(boxH + 16);
    doc.setFillColor(255, 253, 248);
    doc.setDrawColor(240, 233, 220);
    doc.roundedRect(marginX, y, contentWidth, boxH, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(108, 117, 132);
    doc.text('TRAVELER NOTES & REMINDERS', marginX + 10, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(63, 74, 92);
    doc.text(noteLines, marginX + 10, y + 30);
    y += boxH + 18;
  }

  // Day-by-Day Itinerary Section
  ensureSpace(44);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(39, 51, 75);
  doc.text('Day-by-Day Itinerary', marginX, y);
  y += 18;

  const sorted = sortActivitiesChronologically(trip.activities);
  const groupedByDay = new Map<number, TripActivity[]>();
  for (const act of sorted) {
    const dayNum = typeof act.day === 'number' && act.day >= 1 ? act.day : 1;
    const list = groupedByDay.get(dayNum) || [];
    list.push(act);
    groupedByDay.set(dayNum, list);
  }

  const dayNumbers = Array.from(groupedByDay.keys()).sort((a, b) => a - b);

  if (dayNumbers.length === 0) {
    ensureSpace(36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(108, 117, 132);
    doc.text('No itinerary stops added yet.', marginX, y);
    y += 24;
  } else {
    for (const dayNum of dayNumbers) {
      const items = groupedByDay.get(dayNum) || [];
      const dayLabel = `Day ${dayNum}  ·  ${sanitizePdfText(getDayDateLabel(trip.date, dayNum))}`;

      ensureSpace(48);
      // Day Header Pill Bar
      doc.setFillColor(255, 240, 233);
      doc.roundedRect(marginX, y, contentWidth, 24, 5, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(190, 78, 60);
      doc.text(dayLabel, marginX + 10, y + 15.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(140, 102, 94);
      doc.text(
        `${items.length} ${items.length === 1 ? 'stop' : 'stops'}`,
        marginX + contentWidth - 10,
        y + 15.5,
        { align: 'right' }
      );
      y += 32;

      for (const act of items) {
        const cleanActTitle = sanitizePdfText(act.title) || 'Planned stop';
        const cleanTime = sanitizePdfText(act.timeSlot);
        const cleanCategory = sanitizePdfText(act.category);
        const cleanLocation = sanitizePdfText(act.location);
        const cleanDuration = sanitizePdfText(act.duration);
        const cleanCost = sanitizePdfText(act.costEstimate);
        const cleanDetails = sanitizePdfText(act.details);

        const metaLine = [
          cleanCategory,
          cleanLocation,
          cleanDuration,
          cleanCost ? `Est. ${cleanCost}` : '',
        ]
          .filter(Boolean)
          .join('  ·  ');

        const titleColW = contentWidth - 88;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        const actTitleLines = doc.splitTextToSize(
          `${act.done ? '[Done] ' : ''}${cleanActTitle}`,
          titleColW
        ) as string[];

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const metaLines = metaLine
          ? (doc.splitTextToSize(metaLine, titleColW) as string[])
          : [];
        const detailLines = cleanDetails
          ? (doc.splitTextToSize(cleanDetails, titleColW) as string[])
          : [];

        const cardH =
          18 +
          actTitleLines.length * 13 +
          (metaLines.length > 0 ? metaLines.length * 12 + 2 : 0) +
          (detailLines.length > 0 ? detailLines.length * 12.5 + 4 : 0);

        ensureSpace(cardH + 10);

        // Card container
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(240, 233, 220);
        doc.roundedRect(marginX, y, contentWidth, cardH, 5, 5, 'FD');

        // Left Time Column
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(214, 102, 84);
        doc.text(cleanTime || 'Flexible', marginX + 10, y + 18);

        // Vertical Divider
        doc.setDrawColor(244, 238, 228);
        doc.line(marginX + 74, y + 8, marginX + 74, y + cardH - 8);

        // Right Content Column
        let textY = y + 18;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(act.done ? 108 : 39, act.done ? 117 : 51, act.done ? 132 : 75);
        doc.text(actTitleLines, marginX + 84, textY);
        textY += actTitleLines.length * 13;

        if (metaLines.length > 0) {
          textY += 2;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(108, 117, 132);
          doc.text(metaLines, marginX + 84, textY);
          textY += metaLines.length * 12;
        }

        if (detailLines.length > 0) {
          textY += 3;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(63, 74, 92);
          doc.text(detailLines, marginX + 84, textY);
        }

        y += cardH + 8;
      }

      y += 8;
    }
  }

  // Smart Packing List Summary (if available)
  const packingList = trip.packingList || [];
  if (packingList.length > 0) {
    y += 6;
    ensureSpace(50);
    doc.setDrawColor(240, 233, 220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(39, 51, 75);
    doc.text(`Packing Checklist (${packingList.length} items)`, marginX, y);
    y += 16;

    const groups = new Map<string, typeof packingList>();
    for (const item of packingList) {
      const cat = sanitizePdfText(item.category) || 'Essentials';
      const arr = groups.get(cat) || [];
      arr.push(item);
      groups.set(cat, arr);
    }

    for (const [category, items] of groups.entries()) {
      ensureSpace(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(214, 102, 84);
      doc.text(category.toUpperCase(), marginX, y);
      y += 13;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(39, 51, 75);

      for (const item of items) {
        const lineText = `[${item.packed ? 'x' : ' '}] ${sanitizePdfText(item.name)}${
          item.reason ? ` - ${sanitizePdfText(item.reason)}` : ''
        }`;
        const wrapped = doc.splitTextToSize(lineText, contentWidth - 10) as string[];
        ensureSpace(wrapped.length * 13 + 3);
        doc.text(wrapped, marginX + 8, y);
        y += wrapped.length * 13 + 3;
      }

      y += 6;
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

  doc.save(slugifyTripFilename(cleanTitle, trip.date));
}
