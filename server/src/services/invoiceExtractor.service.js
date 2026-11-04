import { extractWithCoordinates } from './invoiceExtractor/coordinateExtractor.js';
import { extractWithRawText } from './invoiceExtractor/rawTextExtractor.js';
import { extractWithGemini } from './invoiceExtractor/aiExtractor.js';

/**
 * Unified Invoice Extractor Service.
 * 
 * @param {string|Buffer} pdfSource - File path or Buffer of the PDF.
 * @param {Object} options - Options:
 *   - method: 'coordinate' | 'ai' | 'raw-text' | 'auto' (default: 'auto')
 *   - apiKey: Gemini API key (optional, can also be read from process.env.GEMINI_API_KEY)
 *   - model: AI model to use (default: 'gemini-2.5-flash')
 * @returns {Promise<Object>} Extracted invoice JSON.
 */
export async function extractInvoice(pdfSource, options = {}) {
  const method = options.method || 'auto';

  if (method === 'ai') {
    return await extractWithGemini(pdfSource, options);
  }

  if (method === 'raw-text') {
    return await extractWithRawText(pdfSource);
  }

  if (method === 'auto') {
    try {
      const coordResult = await extractWithCoordinates(pdfSource);
      if (coordResult.success && coordResult.data.items && coordResult.data.items.length > 0) {
        return coordResult;
      }
    } catch {
      // Fall through to AI if API key is present
    }

    if (process.env.GEMINI_API_KEY || options.apiKey) {
      return await extractWithGemini(pdfSource, options);
    }

    // Fall back to coordinate result
    return await extractWithCoordinates(pdfSource);
  }

  // Default: coordinate-based layout extraction
  return await extractWithCoordinates(pdfSource);
}

export {
  extractWithCoordinates,
  extractWithRawText,
  extractWithGemini,
};
