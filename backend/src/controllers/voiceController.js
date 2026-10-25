const { query } = require('../db/pool');
const { asyncHandler } = require('../middleware/errors');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voice/parse
//
// The phone records a short clip and sends it here (base64). We hand the audio
// straight to Gemini, which transcribes AND understands it in one call, and
// returns a structured intent. Nothing is written to the database here — the
// app always shows the parsed result for the shopkeeper to confirm, and the
// confirmed action then goes through the normal offline-first write + sync.
//
// The Gemini key lives only in the server's .env; it never ships in the APK.
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_LIMIT = parseInt(process.env.VOICE_DAILY_LIMIT) || 50;
const MAX_AUDIO_BYTES = 1024 * 1024;
const ALLOWED_MIME = ['audio/m4a', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/3gpp'];

const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        action: {
            type: 'STRING',
            enum: ['khata_credit', 'khata_repayment', 'sale', 'stock_in', 'unknown'],
        },
        transcript: { type: 'STRING' },
        customer_name: { type: 'STRING', nullable: true },
        amount: { type: 'NUMBER', nullable: true },
        payment_mode: { type: 'STRING', enum: ['cash', 'upi', 'credit'], nullable: true },
        note: { type: 'STRING', nullable: true },
        items: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    product_name: { type: 'STRING' },
                    quantity: { type: 'NUMBER' },
                },
                required: ['product_name', 'quantity'],
            },
        },
    },
    required: ['action', 'transcript'],
};

function buildPrompt({ customers, products }) {
    return `You are the voice assistant of a small Indian shop's billing app.
The shopkeeper speaks Hindi, Marathi, English or a mix (Hinglish). Listen to the
audio and return ONE action as JSON.

Actions:
- khata_credit: a customer took goods/money on credit ("udhaar", "khate mein likho").
  Fill customer_name and amount.
- khata_repayment: a customer paid back dues ("jama", "wapas diye", "paid").
  Fill customer_name and amount.
- sale: items were sold. Fill items (product_name + quantity), optional customer_name,
  payment_mode (cash/upi/credit; default cash).
- stock_in: stock arrived from a supplier. Fill items (product_name + quantity).
- unknown: anything else, or if unsure.

Rules:
- Numbers may be spoken in words in any language ("do sau" = 200, "dedh" = 1.5, "paanch" = 5).
- When a spoken name is close to one of the known names below, return the known
  name spelled exactly as listed. Otherwise return what was said.
- transcript is what was said, written in Latin script.
- Never invent an amount or quantity that wasn't spoken; leave it null instead.

Known customers: ${customers.length ? customers.join(', ') : '(none)'}
Known products: ${products.length ? products.join(', ') : '(none)'}`;
}

async function takeQuota(businessId) {
    const { rows } = await query(
        `INSERT INTO voice_usage (business_id, day, count) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (business_id, day) DO UPDATE SET count = voice_usage.count + 1
     RETURNING count`,
        [businessId]
    );
    return rows[0].count <= DAILY_LIMIT;
}

const parse = asyncHandler(async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Voice is not configured on this server' });

    const { audio, mime_type: mimeType = 'audio/m4a' } = req.body || {};
    if (!audio || typeof audio !== 'string') {
        return res.status(422).json({ error: 'Missing audio' });
    }
    if (!ALLOWED_MIME.includes(mimeType)) {
        return res.status(422).json({ error: 'Unsupported audio format' });
    }
    if (Buffer.byteLength(audio, 'base64') > MAX_AUDIO_BYTES) {
        return res.status(413).json({ error: 'Recording too long — keep it under 15 seconds' });
    }

    if (!(await takeQuota(req.business.id))) {
        return res.status(429).json({ error: `Daily voice limit (${DAILY_LIMIT}) reached — try again tomorrow` });
    }

    // Names give Gemini something to snap fuzzy speech onto ("Ramesh bhai" → "Ramesh").
    const [customers, products] = await Promise.all([
        query('SELECT name FROM customers WHERE business_id = $1 ORDER BY last_purchase_at DESC NULLS LAST LIMIT 200', [req.business.id]),
        query('SELECT name FROM products WHERE business_id = $1 ORDER BY updated_at DESC LIMIT 300', [req.business.id]),
    ]);

    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let gRes;
    try {
        gRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [
                        { text: buildPrompt({ customers: customers.rows.map(r => r.name), products: products.rows.map(r => r.name) }) },
                        { inline_data: { mime_type: mimeType, data: audio } },
                    ],
                }],
                generationConfig: {
                    temperature: 0,
                    responseMimeType: 'application/json',
                    responseSchema: RESPONSE_SCHEMA,
                },
            }),
        });
    } catch (err) {
        return res.status(504).json({ error: 'Voice service timed out — try again' });
    } finally {
        clearTimeout(timer);
    }

    if (!gRes.ok) {
        const detail = await gRes.text().catch(() => '');
        console.error('[voice] Gemini error', gRes.status, detail.slice(0, 500));
        return res.status(502).json({ error: 'Voice service error — try again' });
    }

    const data = await gRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    let intent;
    try {
        intent = JSON.parse(text);
    } catch {
        intent = { action: 'unknown', transcript: '' };
    }
    res.json({ intent });
});

module.exports = { parse };
