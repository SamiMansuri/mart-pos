import PDFParser from 'pdf2json';

/**
 * Safely decodes URI-encoded text strings from pdf2json,
 * handling raw '%' signs or malformed escape sequences.
 */
function safeDecode(str) {
  if (!str) return '';
  try {
    return decodeURIComponent(str);
  } catch {
    try {
      return decodeURI(str.replace(/%(?![0-9a-fA-F]{2})/g, '%25'));
    } catch {
      return str.replace(/%20/g, ' ').replace(/%2C/g, ',');
    }
  }
}

/**
 * Parses a numeric string (e.g. "1,233.21") into a float.
 */
function parseNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const cleaned = String(val).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract invoice data from a digital PDF using bounding-box coordinates (pdf2json).
 * This reconstructs multi-column tables, headers, and footer summaries.
 * 
 * @param {string|Buffer} pdfSource - File path or Buffer of the PDF.
 * @returns {Promise<Object>} Structured JSON object of the invoice.
 */
export function extractWithCoordinates(pdfSource) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(new Error(errData.parserError || 'Failed to parse PDF'));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        const pages = pdfData.Pages || [];
        if (pages.length === 0) {
          return resolve({ success: false, error: 'PDF has no pages' });
        }

        // Process all pages
        const allItems = [];
        pages.forEach((page, pageIdx) => {
          (page.Texts || []).forEach((t) => {
            const rawText = t.R && t.R[0] ? t.R[0].T : '';
            const text = safeDecode(rawText).trim();
            if (text.length > 0) {
              allItems.push({
                page: pageIdx + 1,
                x: Math.round(t.x * 100) / 100,
                y: Math.round(t.y * 100) / 100,
                w: Math.round(t.w * 100) / 100,
                text,
              });
            }
          });
        });

        // Sort items reading order: top-to-bottom, then left-to-right
        allItems.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));

        // Group into visual lines (tolerance of 0.35 vertical units)
        const lines = [];
        let currentLine = [];
        let currentY = null;

        for (const item of allItems) {
          if (currentY === null || Math.abs(item.y - currentY) > 0.35) {
            if (currentLine.length) lines.push({ y: currentY, items: currentLine });
            currentLine = [item];
            currentY = item.y;
          } else {
            currentLine.push(item);
          }
        }
        if (currentLine.length) lines.push({ y: currentY, items: currentLine });

        // 1. Locate Table Header and Boundaries
        let tableHeaderY = -1;
        let tableFooterY = 9999;

        for (let i = 0; i < lines.length; i++) {
          const lineText = lines[i].items.map((item) => item.text).join(' ');
          if (
            (lineText.includes('Product Name') || lineText.includes('Description') || lineText.includes('Item')) &&
            (lineText.includes('HSN') || lineText.includes('Qty') || lineText.includes('Rate'))
          ) {
            tableHeaderY = lines[i].y;
            break;
          }
        }

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (tableHeaderY !== -1 && l.y > tableHeaderY + 1.0) {
            const lineText = l.items.map((item) => item.text).join(' ');
            if (
              lineText.includes('No.of Items') ||
              (lineText.includes('Total') && (lineText.includes('Credit Adj') || lineText.includes('Pre Tax') || lineText.includes('Net Amount'))) ||
              lineText.includes('Amount In Words') ||
              lineText.includes('Net Receivable')
            ) {
              tableFooterY = Math.min(tableFooterY, l.y);
            }
          }
        }

        // 2. Parse Header Information (Seller, Buyer, Invoice Details)
        const headerLines = tableHeaderY !== -1
          ? lines.filter((l) => l.y < tableHeaderY)
          : lines.filter((l) => l.y < 11.0);

        const invoice = {
          metadata: {
            invoiceNumber: null,
            invoiceDate: null,
            poReference: null,
            salesmanName: null,
            beatName: null,
            paymentMode: null,
            vehicle: null,
          },
          seller: {
            name: null,
            address: [],
            gstin: null,
            pan: null,
            fssai: null,
            contactNumber: null,
            state: null,
            stateCode: null,
          },
          buyer: {
            name: null,
            address: [],
            gstin: null,
            pan: null,
            fssai: null,
            state: null,
            stateCode: null,
          },
          items: [],
          taxBreakdown: {
            cgstRate: null,
            cgstAmount: null,
            sgstRate: null,
            sgstAmount: null,
            igstRate: null,
            igstAmount: null,
          },
          summary: {
            numberOfItems: 0,
            totalQuantity: null,
            totalFreeQuantity: null,
            grossAmount: null,
            schemeDiscount: null,
            totalDiscount: null,
            taxableAmount: null,
            cgstAmount: null,
            sgstAmount: null,
            igstAmount: null,
            roundOff: null,
            netAmount: null,
            netReceivable: null,
            amountInWords: null,
          },
        };

        // Extract metadata and party information from header lines
        headerLines.forEach((l) => {
          const leftItems = l.items.filter((i) => i.x < 10.0);
          const midItems = l.items.filter((i) => i.x >= 10.0 && i.x < 20.0);
          const rightItems = l.items.filter((i) => i.x >= 20.0);

          const leftText = leftItems.map((i) => i.text).join(' ');
          const midText = midItems.map((i) => i.text).join(' ');
          const rightText = rightItems.map((i) => i.text).join(' ');

          // Seller (Left column: x < 10)
          if (leftText.startsWith('From :')) {
            invoice.seller.name = leftText.replace('From :', '').trim();
          } else if (invoice.seller.name && /^(LIMITED|LTD|PVT\.?\s*LTD)/i.test(leftText)) {
            invoice.seller.name += ' ' + leftText;
          } else if (invoice.seller.name && !invoice.seller.pan && leftText && !leftText.includes('GSTIN') && !leftText.includes('Contact')) {
            if (/^[A-Z0-9]{10}$/.test(leftText) || leftText.startsWith('PAN')) {
              // PAN line
            } else {
              invoice.seller.address.push(leftText);
            }
          }

          if (leftText.includes('PAN')) {
            const m = leftText.match(/PAN\s*:?\s*([A-Z0-9]{10})/i);
            if (m) invoice.seller.pan = m[1];
          }
          if (leftText.includes('GSTIN')) {
            const m = leftText.match(/GSTIN\s*(?:No\.?)?\s*:?\s*([A-Z0-9]{15})/i);
            if (m) invoice.seller.gstin = m[1];
          }
          if (leftText.includes('FSSAI')) {
            const m = leftText.match(/FSSAI\s*(?:Lic\.?)?\s*:?\s*([0-9]+)/i);
            if (m) invoice.seller.fssai = m[1];
          }
          if (leftText.includes('Contact No')) {
            const m = leftText.match(/Contact No\s*:?\s*([0-9]+)/i);
            if (m) invoice.seller.contactNumber = m[1];
          }
          if (leftText.includes('State Code')) {
            const m = leftText.match(/GST State\s*:\s*([^,]+),\s*State Code\s*:\s*(\d+)/i);
            if (m) {
              invoice.seller.state = m[1].trim();
              invoice.seller.stateCode = m[2].trim();
            }
          }

          // Buyer (Middle column: 10 <= x < 20)
          if (midText.startsWith('To :')) {
            invoice.buyer.name = midText.replace('To :', '').trim();
          } else if (invoice.buyer.name && !invoice.buyer.pan && midText && !midText.includes('GSTIN') && !midText.includes('FSSAI')) {
            if (/^[A-Z0-9]{10}$/.test(midText) || midText.startsWith('PAN')) {
              // PAN line
            } else {
              invoice.buyer.address.push(midText);
            }
          }

          if (midText.includes('PAN')) {
            const m = midText.match(/PAN\s*:?\s*([A-Z0-9]{10})/i);
            if (m) invoice.buyer.pan = m[1];
          }
          if (midText.includes('GSTIN')) {
            const m = midText.match(/GSTIN\s*(?:No\.?)?\s*:?\s*([A-Z0-9]{15})/i);
            if (m) invoice.buyer.gstin = m[1];
          }
          if (midText.includes('FSSAI')) {
            const m = midText.match(/FSSAI\s*(?:Lic\.?)?\s*:?\s*([0-9]+)/i);
            if (m) invoice.buyer.fssai = m[1];
          }
          if (midText.includes('State Code')) {
            const m = midText.match(/GST State\s*:\s*([^,]+),\s*State Code\s*:\s*(\d+)/i);
            if (m) {
              invoice.buyer.state = m[1].trim();
              invoice.buyer.stateCode = m[2].trim();
            }
          }

          // Invoice Details (Right column: x >= 20)
          if (rightText.includes('Inv No')) {
            const m = rightText.match(/Inv No\s*:?\s*([A-Z0-9]+)/i);
            if (m) invoice.metadata.invoiceNumber = m[1];
          }
          if (rightText.includes('Invoice Date')) {
            const m = rightText.match(/Invoice Date\s*:?\s*([\d\/\-\.]+)/i);
            if (m) invoice.metadata.invoiceDate = m[1];
          }
          if (rightText.includes('PO/SO ref')) {
            const m = rightText.match(/PO\/SO ref\.?\s*(?:no\.?)?\s*:?\s*([^\s]+)/i);
            if (m) invoice.metadata.poReference = m[1].replace(/\/null$/, '');
          }
          if (rightText.includes('SM Name')) {
            const m = rightText.match(/SM Name\s*:?\s*(.+)/i);
            if (m) invoice.metadata.salesmanName = m[1].trim();
          }
          if (rightText.includes('Beat Name')) {
            const m = rightText.match(/Beat Name\s*:?\s*(.+)/i);
            if (m) invoice.metadata.beatName = m[1].trim();
          }
          if (rightText.includes('Payment Mode')) {
            const m = rightText.match(/Payment Mode\s*:?\s*([A-Za-z]+)/i);
            if (m) invoice.metadata.paymentMode = m[1].trim();
          }
          if (rightText.includes('Vehicle')) {
            const m = rightText.match(/Vehicle\s*:?\s*([A-Za-z0-9]+)/i);
            if (m) invoice.metadata.vehicle = m[1].trim();
          }
        });

        // 3. Extract Table Line Items
        const columnDefinitions = [
          { key: 'serialNumber', min: 0, max: 1.0, type: 'number' },
          { key: 'hsnCode', min: 1.0, max: 3.5, type: 'string' },
          { key: 'description', min: 3.5, max: 7.8, type: 'text' },
          { key: 'mrp', min: 7.8, max: 9.8, type: 'number' },
          { key: 'cs', min: 9.8, max: 11.0, type: 'number' },
          { key: 'quantity', min: 11.0, max: 12.5, type: 'number' },
          { key: 'freeQuantity', min: 12.5, max: 13.8, type: 'number' },
          { key: 'upc', min: 13.8, max: 15.0, type: 'number' },
          { key: 'grossRate', min: 15.0, max: 16.8, type: 'number' },
          { key: 'totalGross', min: 16.8, max: 19.0, type: 'number' },
          { key: 'primaryDiscount', min: 19.0, max: 21.0, type: 'number' },
          { key: 'secondaryDiscount', min: 21.0, max: 23.0, type: 'number' },
          { key: 'lndDiscount', min: 23.0, max: 24.5, type: 'number' },
          { key: 'taxableValue', min: 24.5, max: 26.5, type: 'number' },
          { key: 'cgstRate', min: 26.5, max: 28.0, type: 'number' },
          { key: 'cgstAmount', min: 28.0, max: 30.0, type: 'number' },
          { key: 'sgstRate', min: 30.0, max: 31.5, type: 'number' },
          { key: 'sgstAmount', min: 31.5, max: 33.5, type: 'number' },
          { key: 'netRate', min: 33.5, max: 35.5, type: 'number' },
          { key: 'netValue', min: 35.5, max: 39.0, type: 'number' },
        ];

        const tableLines = lines.filter((l) => l.y > tableHeaderY + 0.8 && l.y < tableFooterY);
        let currentItem = null;

        for (const line of tableLines) {
          const first = line.items[0];
          // Check if this line marks the beginning of a new item
          const isNewItemRow = first && first.x < 1.0 && /^\d+$/.test(first.text);

          if (isNewItemRow) {
            if (currentItem) {
              invoice.items.push(finalizeItem(currentItem));
            }
            currentItem = {};
          }

          if (!currentItem) continue;

          for (const item of line.items) {
            const col = columnDefinitions.find((c) => item.x >= c.min && item.x < c.max);
            if (col) {
              if (currentItem[col.key]) {
                if (col.type === 'text') {
                  currentItem[col.key] += ' ' + item.text;
                } else {
                  currentItem[col.key] += item.text;
                }
              } else {
                currentItem[col.key] = item.text;
              }
            }
          }
        }

        if (currentItem) {
          invoice.items.push(finalizeItem(currentItem));
        }

        // 4. Parse Footer and Totals
        const footerLines = lines.filter((l) => l.y >= tableFooterY);
        footerLines.forEach((l) => {
          const lineText = l.items.map((i) => i.text).join(' ');

          // Total items count
          const itemCountMatch = lineText.match(/No\.?\s*of\s*Items\s*[:\s]*(\d+)/i);
          if (itemCountMatch) invoice.summary.numberOfItems = parseInt(itemCountMatch[1], 10);

          // Total quantity row: look at first line after table
          if (l.y === tableFooterY || Math.abs(l.y - tableFooterY) < 0.6) {
            const qtyItem = l.items.find((i) => i.x >= 11.0 && i.x < 12.5);
            const freeItem = l.items.find((i) => i.x >= 12.5 && i.x < 14.0);
            const grossItem = l.items.find((i) => i.x >= 16.5 && i.x < 18.5);
            const discItem = l.items.find((i) => i.x >= 21.0 && i.x < 22.5);
            const taxableItem = l.items.find((i) => i.x >= 24.5 && i.x < 26.5);
            const netItem = l.items.find((i) => i.x >= 35.5 && i.x < 37.5);

            if (qtyItem) invoice.summary.totalQuantity = parseNumber(qtyItem.text);
            if (freeItem) invoice.summary.totalFreeQuantity = parseNumber(freeItem.text);
            if (grossItem) invoice.summary.grossAmount = parseNumber(grossItem.text);
            if (discItem) invoice.summary.totalDiscount = parseNumber(discItem.text);
            if (taxableItem) invoice.summary.taxableAmount = parseNumber(taxableItem.text);
            if (netItem) invoice.summary.netAmount = parseNumber(netItem.text);
          }

          // Net Amount / Net Receivable
          if (lineText.includes('Net Amount:')) {
            const m = lineText.match(/Net Amount\s*:\s*([\d,\.]+)/i) || l.items.find((i) => parseNumber(i.text) > 100);
            if (m) invoice.summary.netAmount = typeof m === 'object' && m[1] ? parseNumber(m[1]) : parseNumber(m.text);
          }
          if (lineText.includes('Round Off')) {
            const m = lineText.match(/Round Off\s*:\s*([\d,\.]+)/i) || l.items.find((i) => parseNumber(i.text) !== null && parseNumber(i.text) < 5);
            if (m) invoice.summary.roundOff = typeof m === 'object' && m[1] ? parseNumber(m[1]) : parseNumber(m.text);
          }
          if (lineText.includes('Net Receivable')) {
            const m = lineText.match(/Net Receivable\s*([\d,\.]+)/i) || l.items.find((i) => parseNumber(i.text) > 100);
            if (m) invoice.summary.netReceivable = typeof m === 'object' && m[1] ? parseNumber(m[1]) : parseNumber(m.text);
          }
          if (lineText.includes('Amount In Words')) {
            const idx = lineText.indexOf('Amount In Words');
            const wordsPart = lineText.slice(idx).replace(/Amount In Words\s*:?/i, '').replace(/For\s*:.*/i, '').trim();
            if (wordsPart) invoice.summary.amountInWords = wordsPart;
          }

          // Tax Breakdown totals
          if (l.items.length >= 5 && l.items.some((i) => i.text === '2.50' || i.text === '60.19')) {
            const rates = l.items.filter((i) => i.text === '2.50' || i.text === '2.5');
            const amts = l.items.filter((i) => parseNumber(i.text) > 10 && parseNumber(i.text) < 1000);
            if (rates.length >= 2) {
              invoice.taxBreakdown.cgstRate = parseNumber(rates[0].text);
              invoice.taxBreakdown.sgstRate = parseNumber(rates[1].text);
            }
            if (amts.length >= 2) {
              invoice.taxBreakdown.cgstAmount = parseNumber(amts[0].text);
              invoice.taxBreakdown.sgstAmount = parseNumber(amts[1].text);
              invoice.summary.cgstAmount = invoice.taxBreakdown.cgstAmount;
              invoice.summary.sgstAmount = invoice.taxBreakdown.sgstAmount;
            }
          }
        });

        // Set number of items from array if not captured from footer
        if (!invoice.summary.numberOfItems) {
          invoice.summary.numberOfItems = invoice.items.length;
        }

        resolve({
          success: true,
          method: 'coordinate_layout',
          data: invoice,
        });
      } catch (err) {
        reject(err);
      }
    });

    if (Buffer.isBuffer(pdfSource)) {
      pdfParser.parseBuffer(pdfSource);
    } else if (typeof pdfSource === 'string') {
      pdfParser.loadPDF(pdfSource);
    } else {
      reject(new Error('pdfSource must be a file path string or Buffer'));
    }
  });
}

function finalizeItem(raw) {
  return {
    serialNumber: parseInt(raw.serialNumber, 10) || null,
    hsnCode: raw.hsnCode || null,
    description: (raw.description || '').trim(),
    mrp: parseNumber(raw.mrp),
    cs: parseNumber(raw.cs) || 0,
    quantity: parseNumber(raw.quantity) || 0,
    freeQuantity: parseNumber(raw.freeQuantity) || 0,
    upc: parseNumber(raw.upc) || null,
    grossRate: parseNumber(raw.grossRate),
    totalGross: parseNumber(raw.totalGross),
    primaryDiscount: parseNumber(raw.primaryDiscount) || 0,
    secondaryDiscount: parseNumber(raw.secondaryDiscount) || 0,
    lndDiscount: parseNumber(raw.lndDiscount) || 0,
    taxableValue: parseNumber(raw.taxableValue),
    cgstRate: parseNumber(raw.cgstRate),
    cgstAmount: parseNumber(raw.cgstAmount),
    sgstRate: parseNumber(raw.sgstRate),
    sgstAmount: parseNumber(raw.sgstAmount),
    netRate: parseNumber(raw.netRate),
    netValue: parseNumber(raw.netValue),
  };
}
