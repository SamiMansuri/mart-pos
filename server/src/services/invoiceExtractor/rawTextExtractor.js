import fs from 'fs';
import { PDFParse } from 'pdf-parse';

/**
 * Basic text extraction using pdf-parse.
 * Flattens the PDF into text and applies regex patterns.
 */
export async function extractWithRawText(pdfSource) {
  let buffer;
  if (Buffer.isBuffer(pdfSource)) {
    buffer = pdfSource;
  } else if (typeof pdfSource === 'string') {
    buffer = fs.readFileSync(pdfSource);
  } else {
    throw new Error('pdfSource must be a file path string or Buffer');
  }

  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const textResult = await parser.getText();
  const fullText = textResult.text || '';

  const invoice = {
    metadata: {
      invoiceNumber: null,
      invoiceDate: null,
      poReference: null,
      paymentMode: null,
    },
    seller: {
      name: null,
      gstin: null,
      pan: null,
      phone: null,
    },
    buyer: {
      name: null,
      gstin: null,
      pan: null,
    },
    summary: {
      netAmount: null,
      roundOff: null,
      amountInWords: null,
    },
    rawText: fullText,
  };

  const invNoMatch = fullText.match(/Inv\s*No\s*:?\s*([A-Z0-9]+)/i) || fullText.match(/Invoice\s*(?:No|Number)\s*:?\s*([A-Z0-9]+)/i);
  if (invNoMatch) invoice.metadata.invoiceNumber = invNoMatch[1];

  const invDateMatch = fullText.match(/Invoice\s*Date\s*:?\s*([\d\/\-\.]+)/i);
  if (invDateMatch) invoice.metadata.invoiceDate = invDateMatch[1];

  const poMatch = fullText.match(/PO\/SO\s*(?:ref\.?)?\s*(?:no\.?)?\s*:?\s*([A-Z0-9\/]+)/i);
  if (poMatch) invoice.metadata.poReference = poMatch[1].replace(/\/null$/, '');

  const fromMatch = fullText.match(/From\s*:\s*([^\n\r]+)/i);
  if (fromMatch) invoice.seller.name = fromMatch[1].trim();

  const toMatch = fullText.match(/To\s*:\s*([^\n\r]+)/i);
  if (toMatch) invoice.buyer.name = toMatch[1].trim();

  const gstMatches = [...fullText.matchAll(/GSTIN\s*(?:No\.?)?\s*:?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/gi)];
  if (gstMatches.length > 0) invoice.seller.gstin = gstMatches[0][1];
  if (gstMatches.length > 1) invoice.buyer.gstin = gstMatches[1][1];

  const netMatch = fullText.match(/Net\s*Receivable\s*([\d,\.]+)/i) || fullText.match(/Net\s*Amount\s*:?\s*([\d,\.]+)/i);
  if (netMatch) invoice.summary.netAmount = parseFloat(netMatch[1].replace(/,/g, ''));

  const wordsMatch = fullText.match(/Amount\s*In\s*Words\s*:?\s*([^\n\r]+)/i);
  if (wordsMatch) invoice.summary.amountInWords = wordsMatch[1].replace(/For\s*:.*/i, '').trim();

  return {
    success: true,
    method: 'raw_text',
    note: 'Raw text flattens multi-column tables. For accurate table rows, use coordinate or AI extractor.',
    data: invoice,
  };
}
