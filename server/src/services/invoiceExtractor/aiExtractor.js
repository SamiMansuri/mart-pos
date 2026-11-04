import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

/**
 * Invoice JSON schema for AI structured output
 */
export const invoiceJsonSchema = {
  type: 'object',
  properties: {
    metadata: {
      type: 'object',
      properties: {
        invoiceNumber: { type: 'string' },
        invoiceDate: { type: 'string' },
        dueDate: { type: 'string' },
        poReference: { type: 'string' },
        paymentMode: { type: 'string' },
        salesmanName: { type: 'string' },
        beatName: { type: 'string' },
      },
    },
    seller: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: { type: 'string' },
        gstin: { type: 'string' },
        pan: { type: 'string' },
        fssai: { type: 'string' },
        phone: { type: 'string' },
        state: { type: 'string' },
        stateCode: { type: 'string' },
      },
    },
    buyer: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: { type: 'string' },
        gstin: { type: 'string' },
        pan: { type: 'string' },
        fssai: { type: 'string' },
        phone: { type: 'string' },
        state: { type: 'string' },
        stateCode: { type: 'string' },
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          serialNumber: { type: 'number' },
          hsnCode: { type: 'string' },
          description: { type: 'string' },
          mrp: { type: 'number' },
          quantity: { type: 'number' },
          freeQuantity: { type: 'number' },
          unit: { type: 'string' },
          grossRate: { type: 'number' },
          discountAmount: { type: 'number' },
          taxableValue: { type: 'number' },
          cgstRate: { type: 'number' },
          cgstAmount: { type: 'number' },
          sgstRate: { type: 'number' },
          sgstAmount: { type: 'number' },
          igstRate: { type: 'number' },
          igstAmount: { type: 'number' },
          netRate: { type: 'number' },
          netValue: { type: 'number' },
        },
        required: ['description', 'quantity', 'netValue'],
      },
    },
    taxBreakdown: {
      type: 'object',
      properties: {
        cgstRate: { type: 'number' },
        cgstAmount: { type: 'number' },
        sgstRate: { type: 'number' },
        sgstAmount: { type: 'number' },
        igstRate: { type: 'number' },
        igstAmount: { type: 'number' },
        totalTaxAmount: { type: 'number' },
      },
    },
    summary: {
      type: 'object',
      properties: {
        numberOfItems: { type: 'number' },
        totalQuantity: { type: 'number' },
        grossAmount: { type: 'number' },
        totalDiscount: { type: 'number' },
        taxableAmount: { type: 'number' },
        totalTaxAmount: { type: 'number' },
        roundOff: { type: 'number' },
        netReceivable: { type: 'number' },
        amountInWords: { type: 'string' },
      },
      required: ['netReceivable'],
    },
  },
  required: ['metadata', 'seller', 'buyer', 'items', 'summary'],
};

/**
 * Extracts invoice data using Google Gemini API (multimodal PDF input).
 * 
 * @param {string|Buffer} pdfSource - File path or Buffer of the PDF.
 * @param {Object} options - API options (apiKey, model).
 */
export async function extractWithGemini(pdfSource, options = {}) {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please set it in your environment or .env file.');
  }

  const ai = new GoogleGenAI({ apiKey });

  let buffer;
  if (Buffer.isBuffer(pdfSource)) {
    buffer = pdfSource;
  } else if (typeof pdfSource === 'string') {
    buffer = fs.readFileSync(pdfSource);
  } else {
    throw new Error('pdfSource must be a file path string or Buffer');
  }

  const model = options.model || 'gemini-2.5-flash';

  const prompt = `You are a precision invoice data extraction engine.
Analyze this invoice PDF document and extract all data into the required JSON structure.
Be thorough with table rows/line items: include serial number, HSN/SAC code, product description, MRP, quantity, free quantity, gross rate, discount, taxable value, CGST/SGST/IGST rates and amounts, and net total.
Also extract seller details, buyer details, invoice number, date, tax summaries, round off, and net receivable amount.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: buffer.toString('base64'),
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: invoiceJsonSchema,
    },
  });

  const parsed = JSON.parse(response.text);
  return {
    success: true,
    method: 'ai_gemini',
    model,
    data: parsed,
  };
}
