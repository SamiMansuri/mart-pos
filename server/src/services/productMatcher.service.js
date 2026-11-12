import pool from '../config/db.config.js';
import { SUPPLIER_PRODUCT_MAPPING_QUERIES } from '../db/queries.js';

// Common unit/package stopwords that add noise to product name matching
const STOP_WORDS = new Set([
  'pch', 'pouch', 'jr', 'jar', 'btl', 'bot', 'bottle', 'bx', 'box', 'pkt', 'pack', 'packet',
  'pc', 'pcs', 'piece', 'pieces', 'ed', 'ft-p', 'lo', 'pl', 'sp', 'fr', 'wt', 'off',
  'free', 'promo', 'rs', 'mrp', 'no', 'nos', 'unit', 'units', 'ctn', 'carton'
]);

/**
 * Normalizes text for clean comparison:
 * lowercase, replaces punctuation with spaces, collapses whitespace
 */
export function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes HSN code by stripping periods and non-numeric characters
 */
export function normalizeHsn(hsn) {
  if (!hsn) return '';
  return String(hsn).replace(/[^0-9]/g, '');
}

/**
 * Extracts normalized tokens from a product description
 */
export function extractTokens(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  return normalized
    .split(' ')
    .map((token) => {
      // Normalize units: e.g. "200gms" -> "200g", "1ltr" -> "1l", "100mls" -> "100ml"
      return token
        .replace(/(\d+)\s*(?:gms|gm|g)/g, '$1g')
        .replace(/(\d+)\s*(?:kgs|kg)/g, '$1kg')
        .replace(/(\d+)\s*(?:mls|ml)/g, '$1ml')
        .replace(/(\d+)\s*(?:ltrs|ltr|l)/g, '$1l');
    })
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

/**
 * Computes character bigrams for string similarity (Dice's Coefficient)
 */
function getBigrams(str) {
  const bigrams = new Set();
  const s = ` ${str} `;
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2));
  }
  return bigrams;
}

/**
 * Calculates Dice's string similarity coefficient (0 to 1)
 */
export function diceSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let intersection = 0;

  for (const bg of bg1) {
    if (bg2.has(bg)) intersection++;
  }

  return (2 * intersection) / (bg1.size + bg2.size);
}

/**
 * Calculates token overlap similarity with prefix support for abbreviations
 */
export function tokenSimilarity(vendorTokens, systemTokens) {
  if (vendorTokens.length === 0 || systemTokens.length === 0) return 0;

  let matches = 0;
  for (const vToken of vendorTokens) {
    for (const sToken of systemTokens) {
      if (vToken === sToken) {
        matches += 1.0;
        break;
      }
      // Check prefix matching (e.g. "saf" -> "saffola", "oat" -> "oats")
      if (vToken.length >= 3 && sToken.length >= 3) {
        if (sToken.startsWith(vToken) || vToken.startsWith(sToken)) {
          matches += 0.8;
          break;
        }
      }
    }
  }

  // Jaccard-like score relative to the shorter string tokens
  const minLen = Math.min(vendorTokens.length, systemTokens.length);
  return Math.min(1.0, matches / minLen);
}

/**
 * Calculates an overall text similarity score between vendor and system product names
 */
export function calculateNameScore(vendorName, systemName) {
  if (!vendorName || !systemName) return 0;

  const vNorm = normalizeText(vendorName);
  const sNorm = normalizeText(systemName);

  if (vNorm === sNorm) return 1.0;
  if (sNorm.includes(vNorm) || vNorm.includes(sNorm)) return 0.92;

  const vTokens = extractTokens(vendorName);
  const sTokens = extractTokens(systemName);

  const tokenScore = tokenSimilarity(vTokens, sTokens);
  const diceScore = diceSimilarity(vNorm, sNorm);

  return tokenScore * 0.65 + diceScore * 0.35;
}

/**
 * Matches a list of extracted invoice line items against the system product catalog.
 * 
 * Pipeline:
 *  Tier 1: Supplier memory mapping (exact alias previously saved) -> 100%
 *  Tier 2: Barcode / UPC match -> 100%
 *  Tier 3: HSN Code + MRP Match -> 85-90%
 *  Tier 4: Tokenized Text Similarity -> 40-85% (suggestions / match)
 * 
 * @param {Array} items - Line items extracted from the invoice
 * @param {number|string|null} supplierId - Optional supplier ID
 * @param {Object} dbClient - Optional database client (default: pool)
 * @returns {Promise<Array>} Enriched items with matching results
 */
export async function matchExtractedItems(items = [], supplierId = null, dbClient = pool) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  // 1. Fetch active system products with their latest batch / pricing information
  const productsQuery = `
    SELECT 
      p.id,
      p.name,
      p.barcode,
      p.selling_price,
      p.gst_rate,
      p.hsn_code,
      lb.mrp AS batch_mrp,
      COALESCE(lb.mrp, p.selling_price) AS effective_mrp
    FROM products p
    LEFT JOIN LATERAL (
      SELECT mrp
      FROM product_batches pb
      WHERE pb.product_id = p.id
      ORDER BY pb.created_at DESC
      LIMIT 1
    ) lb ON true
    WHERE p.is_active = true
  `;
  const { rows: products } = await dbClient.query(productsQuery);

  // 2. Fetch existing supplier mappings if supplierId is provided
  let mappingsMap = new Map();
  if (supplierId) {
    const { rows: mappings } = await dbClient.query(
      SUPPLIER_PRODUCT_MAPPING_QUERIES.GET_BY_SUPPLIER,
      [supplierId]
    );
    for (const m of mappings) {
      const key = normalizeText(m.vendor_product_name);
      if (key) {
        mappingsMap.set(key, {
          id: m.system_product_id,
          name: m.system_product_name,
          barcode: m.barcode,
          selling_price: m.selling_price,
          gst_rate: m.gst_rate,
          hsn_code: m.hsn_code,
        });
      }
    }
  }

  // Quick lookup indices for catalog
  const barcodeMap = new Map();
  products.forEach((p) => {
    if (p.barcode && p.barcode.trim()) {
      barcodeMap.set(p.barcode.trim(), p);
    }
  });

  // 3. Process each line item through the matching pipeline
  return items.map((item) => {
    const rawDescription = item.description || item.product_name || item.name || '';
    const cleanDescription = normalizeText(rawDescription);
    const itemHsn = normalizeHsn(item.hsnCode || item.hsn_code || '');
    const itemMrp = parseFloat(item.mrp || 0);
    const itemBarcode = item.barcode ? String(item.barcode).trim() : null;
    const itemUpc = item.upc ? String(item.upc).trim() : null;

    // ── Tier 1: Supplier Alias Memory ──────────────────────────────────────────
    if (cleanDescription && mappingsMap.has(cleanDescription)) {
      const matched = mappingsMap.get(cleanDescription);
      return {
        ...item,
        matchedProduct: matched,
        matchType: 'exact_supplier_mapping',
        confidence: 1.0,
        suggestions: [],
      };
    }

    // ── Tier 2: Exact Barcode / UPC Match ──────────────────────────────────────
    if (itemBarcode && barcodeMap.has(itemBarcode)) {
      const matched = barcodeMap.get(itemBarcode);
      return {
        ...item,
        matchedProduct: matched,
        matchType: 'exact_barcode',
        confidence: 1.0,
        suggestions: [],
      };
    }
    if (itemUpc && barcodeMap.has(itemUpc)) {
      const matched = barcodeMap.get(itemUpc);
      return {
        ...item,
        matchedProduct: matched,
        matchType: 'exact_barcode',
        confidence: 1.0,
        suggestions: [],
      };
    }

    // ── Tier 3: HSN Code + MRP Match ──────────────────────────────────────────
    if (itemHsn && itemHsn.length >= 4 && itemMrp > 0) {
      const hsnCandidates = products.filter((p) => {
        const prodHsn = normalizeHsn(p.hsn_code);
        const prodMrp = parseFloat(p.effective_mrp || p.selling_price || 0);

        if (Math.abs(prodMrp - itemMrp) > 0.01) return false;
        // Check if 4+ digit HSN prefix matches
        return (
          prodHsn &&
          (prodHsn.startsWith(itemHsn.slice(0, 4)) || itemHsn.startsWith(prodHsn.slice(0, 4)))
        );
      });

      if (hsnCandidates.length === 1) {
        return {
          ...item,
          matchedProduct: hsnCandidates[0],
          matchType: 'hsn_mrp',
          confidence: 0.88,
          suggestions: hsnCandidates,
        };
      } else if (hsnCandidates.length > 1) {
        // Disambiguate multiple HSN+MRP matches using name similarity
        const scored = hsnCandidates.map((p) => ({
          product: p,
          score: calculateNameScore(rawDescription, p.name) + 0.3, // Boost score for matching HSN+MRP
          reason: `HSN ${itemHsn.slice(0, 4)} & MRP ₹${itemMrp} match`,
        }));
        scored.sort((a, b) => b.score - a.score);

        const best = scored[0];
        if (best.score >= 0.7) {
          return {
            ...item,
            matchedProduct: best.product,
            matchType: 'hsn_mrp',
            confidence: Math.min(0.92, Number(best.score.toFixed(2))),
            suggestions: scored.slice(0, 5).map((s) => s.product),
          };
        }
      }
    }

    // ── Tier 4: Text Similarity Search across all products ─────────────────────
    if (cleanDescription) {
      const scoredProducts = products.map((p) => {
        let score = calculateNameScore(rawDescription, p.name);

        // Slight bonus if MRP matches
        const prodMrp = parseFloat(p.effective_mrp || p.selling_price || 0);
        if (itemMrp > 0 && Math.abs(prodMrp - itemMrp) < 0.01) {
          score += 0.12;
        }

        // Slight bonus if HSN prefix matches
        const prodHsn = normalizeHsn(p.hsn_code);
        if (itemHsn && prodHsn && prodHsn.slice(0, 4) === itemHsn.slice(0, 4)) {
          score += 0.10;
        }

        return {
          product: p,
          score: Math.min(1.0, score),
        };
      });

      scoredProducts.sort((a, b) => b.score - a.score);
      const topMatches = scoredProducts.filter((s) => s.score >= 0.35).slice(0, 5);

      if (topMatches.length > 0 && topMatches[0].score >= 0.65) {
        const best = topMatches[0];
        return {
          ...item,
          matchedProduct: best.product,
          matchType: 'suggested_name',
          confidence: Number(best.score.toFixed(2)),
          suggestions: topMatches.map((t) => t.product),
        };
      } else if (topMatches.length > 0) {
        // Lower confidence suggestions for user dropdown
        return {
          ...item,
          matchedProduct: null,
          matchType: 'unmatched',
          confidence: Number(topMatches[0].score.toFixed(2)),
          suggestions: topMatches.map((t) => t.product),
        };
      }
    }

    // Default: Unmatched
    return {
      ...item,
      matchedProduct: null,
      matchType: 'unmatched',
      confidence: 0,
      suggestions: [],
    };
  });
}
