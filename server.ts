import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Ensure the server-side Gemini client is lazy-initialized or safely checked
let ai: GoogleGenAI | null = null;
const getGeminiClient = () => {
  if (ai) return ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('WARNING: GEMINI_API_KEY environment variable is not defined.');
  }
  ai = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return ai;
};

const app = express();
const PORT = 3000;

app.use(express.json());

// Transparent Supabase API Proxy to bypass sandbox client-side network isolation/timeouts
import fs from 'fs';
const logFilePath = path.join(process.cwd(), 'proxy_logs.txt');
const appendProxyLog = (line: string) => {
  try {
    fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] ${line}\n`);
  } catch (err) {
    console.error('Failed to write proxy log', err);
  }
};

app.all('/api/supabase-proxy/*', async (req, res) => {
  const originalUrl = req.originalUrl || req.url;
  const method = req.method;
  appendProxyLog(`PROXY REQUEST INCOMING: ${method} ${originalUrl}`);
  console.log(`[Proxy Request] Incoming: ${method} ${originalUrl}`);
  try {
    const targetUrl = process.env.VITE_SUPABASE_URL;
    if (!targetUrl) {
      appendProxyLog('PROXY ERROR: Supabase URL is not configured.');
      console.warn('[Proxy Error] Supabase URL is not configured.');
      return res.status(500).json({ error: 'Supabase URL is not configured on the server.' });
    }

    // Extract path and query params keeping everything intact, supporting both /api/supabase-proxy and /supabase-proxy
    const proxyPathSegment = '/supabase-proxy';
    const proxyIndex = originalUrl.indexOf(proxyPathSegment);
    const pathSuffix = proxyIndex !== -1
      ? originalUrl.substring(proxyIndex + proxyPathSegment.length)
      : originalUrl;
    
    // Normalize to avoid double slash problems
    const baseUrl = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl;
    const cleanPathSuffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
    const fullTargetUrl = `${baseUrl}${cleanPathSuffix}`;

    appendProxyLog(`ROUTING TO: ${fullTargetUrl}`);
    console.log(`[Proxy Target] Routing to: ${fullTargetUrl}`);

    let body: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body && Object.keys(req.body).length > 0) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        appendProxyLog(`FORWARDING BODY: ${body.length} chars`);
        console.log(`[Proxy Body] Forwarding payload length: ${body.length}`);
      }
    }

    const whitelist = [
      'apikey',
      'authorization',
      'content-type',
      'prefer',
      'range',
      'range-unit',
      'x-client-info',
      'accept',
    ];

    const headers: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        const lowerKey = key.toLowerCase();
        if (whitelist.includes(lowerKey)) {
          headers[lowerKey] = value;
        }
      }
    }

    // Ensure authorization headers are perfectly present
    if (!headers['apikey'] && process.env.VITE_SUPABASE_ANON_KEY) {
      headers['apikey'] = process.env.VITE_SUPABASE_ANON_KEY;
    }

    appendProxyLog(`HEADERS: ${JSON.stringify(Object.keys(headers))}`);
    console.log('[Proxy Headers] Exposing headers subset:', Object.keys(headers));

    const startTime = Date.now();
    const response = await fetch(fullTargetUrl, {
      method: req.method,
      headers: headers,
      body: body,
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
    });

    const duration = Date.now() - startTime;
    appendProxyLog(`RESPONSE STATUS: ${response.status} from Supabase in ${duration}ms`);
    console.log(`[Proxy Response] Status ${response.status} from Supabase in ${duration}ms`);

    const excludedResponseHeaders = [
      'content-encoding',
      'transfer-encoding',
      'connection',
      'keep-alive',
      'access-control-allow-origin',
      'access-control-allow-credentials',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-expose-headers',
    ];

    response.headers.forEach((value, name) => {
      const lowerName = name.toLowerCase();
      if (!excludedResponseHeaders.includes(lowerName)) {
        res.setHeader(name, value);
      }
    });

    res.status(response.status);
    const arrayBuffer = await response.arrayBuffer();
    appendProxyLog(`RETURNING BUFFER SIZE: ${arrayBuffer.byteLength}`);
    console.log(`[Proxy Response] Returning buffer of length: ${arrayBuffer.byteLength}`);
    res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    appendProxyLog(`PROXY RUNTIME EXCEPTION: ${error.message || error}`);
    console.error(`[Proxy Error] Error proxying ${method} ${originalUrl}:`, error);
    res.status(500).json({ error: error.message || 'Supabase proxy request failed.' });
  }
});

// API: AI Assistant Chat Interface supporting special clinical features
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history, feature, context } = req.body;

    if (!message && !feature) {
      return res.status(400).json({ error: 'Message or specific feature parameter is required.' });
    }

    const client = getGeminiClient();
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Gemini API key is not configured inside this environment. Please configure it under Secrets.' 
      });
    }

    let systemInstruction = `You are "APLD Smart Clinic Assistant", an expert AI clinical copilot integrated into "Ashok Private Laboratory and Dispensary (APLD) Management System".
Your role is to assist clinical doctors, laboratory technicians, nurses, and pharmacists with high-precision clinical decision assistance, summaries, diagnostics help, and documentation.

Always adhere to these guidelines:
1. Provide highly professional, balanced, structured, and clinically precise responses.
2. Clearly distinguish between subjective symptoms, objective laboratory markers, diagnostic assessments, and treatment plans.
3. Keep the tone clinical, empathetic, and objective. Always include a short professional disclaimer reminding users that you are an AI assistant and all diagnoses/orders must be verified by the licensed attending physician.
4. Format all documents, notes, summaries, and value tables perfectly in well-spaced, highly readable Markdown, using clean tables, bullet points, headers, and bold text.
5. Use medical terminology with brief helpful definitions when answering non-clinical user questions.`;

    // Augment prompt based on selected APLD smart features of the bot
    let dynamicPrompt = message || '';
    
    if (feature === 'generate_clinical_notes') {
      systemInstruction += `\n\nFeature: Generate Clinical Notes (SOAP Format)
You will receive clinical inputs, symptoms, primary complaints, and basic details. Output a professionally structured SOAP note:
- S (Subjective): Chief complaints, history of presenting illness, symptoms.
- O (Objective): Vital signs (if supplied), physical exam, and laboratory markers.
- A (Assessment): Differential diagnoses or primary diagnostic assessments, clinical reasoning.
- P (Plan): Further diagnostics/lab work, medication/prescriptions (with dosages), referral guidelines, and patient education.`;
      dynamicPrompt = `Generate a comprehensive professional clinical SOAP Note based on the following patient presentation:
${context || message}`;
    } 
    else if (feature === 'suggest_lab_tests') {
      systemInstruction += `\n\nFeature: Suggest Lab Tests
Analyze presenting symptoms, chronic conditions, or clinical suspicions and propose structured laboratory investigations.
Group your suggestions logically (e.g., Hematology, Biochemistry, Immunology, Urinalysis).
For each suggested test, briefly outline:
1. Clinical Rationale: Why this test is appropriate.
2. Expected Insights: What specific markers are being evaluated.
3. Specimen: Standard specimen type (e.g., EDTA whole blood, serum, random urine).`;
      dynamicPrompt = `Identify and suggest the most relevant laboratory test orders for a patient presenting with:
${context || message}`;
    }
    else if (feature === 'interpret_lab_values') {
      systemInstruction += `\n\nFeature: Interpret Lab Values
Analyze provided laboratory values, test results, or values with reference ranges.
Identify any abnormal, critical, or out-of-range parameters (elevated, depressed).
Provide clear clinical breakdowns:
1. Identify high/low markers and their values compared to standard reference intervals.
2. List possible pathological or physiological etiologies (differential causes).
3. Offer recommended near-term clinical next steps or confirmatory tests.
4. Highlight any potential 'CRITICAL' alert signs that require urgent callback.`;
      dynamicPrompt = `Analyze, calculate, and interpret the following laboratory results:
${context || message}`;
    }
    else if (feature === 'smart_record_search') {
      systemInstruction += `\n\nFeature: Smart Record Search & Medical Knowledge Map
The clinician is trying to lookup, understand, or classify a medical concept, drug class, diagnosis, ICD-10 medical code, or anatomical relation.
Help search your background knowledge Base. Give a clean medical reference card explaining the query, any relevant clinical applications, drug interactions, or diagnostic values.`;
      dynamicPrompt = `Perform a smart clinical conceptual search/explanation for. Break it down beautifully:
"${context || message}"`;
    }
    else if (feature === 'monthly_report_summary') {
      systemInstruction += `\n\nFeature: Monthly Clinical & Diagnostic Performance Report Summary
Summarize the laboratory performance, diagnostic volumes, clinical billing counts, or stock levels provided in the context.
Translate raw numbers, values, or trends into a beautiful Executive Clinical Informatics Report:
1. Diagnostic Highlights: Performance spikes, test-related trends (e.g., uptick in malaria smears or lipid profiles).
2. Financial & Billing summary context.
3. Inventory Insights: Crucial stock alerts, low medicines, or supply chain bottlenecks.
4. Operational Recommendation: Clear actionable suggestions to optimize clinic throughput or quality controls.`;
      dynamicPrompt = `Perform a brilliant summary and informatics breakdown of the following raw clinic report data:
${context || message}`;
    }

    // Structure chat contents
    const chatContents: any[] = [];
    
    // Add history if present
    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
        chatContents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }],
        });
      });
    }

    // Append the primary new user query
    chatContents.push({
      role: 'user',
      parts: [{ text: dynamicPrompt }],
    });

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: chatContents,
      config: {
        systemInstruction,
        temperature: 0.2, // Keep it precise and clinical
      }
    });

    const reply = response.text || "I was unable to formulate a clinical response regarding this request. Please verify inputs.";
    res.json({ reply });
  } catch (error: any) {
    console.error('Error handling server-side Gemini request:', error);
    res.status(500).json({ error: error.message || 'An error occurred while contacting the clinical AI engine.' });
  }
});

// Serve Vite dev server or static static assets
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted in Development mode');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production-ready compiled assets from dist/');
  }

  // Only start listening if not running in a serverless environment like Vercel
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[APLD Server] listening live on http://localhost:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  setupVite().catch((err) => {
    console.error('Error initializing Express + Vite fullstack server:', err);
  });
}

export default app;
