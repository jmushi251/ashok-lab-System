import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Gemini lazily to avoid bundling and startup crashes on Vercel
let ai = null;
const getGeminiClient = async () => {
  if (ai) return ai;
  const apiKey = process.env.GEMINI_API_KEY;
  const { GoogleGenAI } = await import('@google/genai');
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

// Main routing logic that supports Vercel environment rewrites perfectly
app.all('*', async (req, res) => {
  const originalUrl = req.originalUrl || req.url || '';
  const method = req.method;
  
  console.log(`[API Gateway] Incoming: ${method} ${originalUrl}`);

  // 1. Check if Supabase proxy request
  if (originalUrl.includes('/supabase-proxy')) {
    try {
      const targetUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const targetKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (!targetUrl) {
        console.error('[API Gateway Error] Supabase URL is not configured on the server.');
        return res.status(500).json({ error: 'Supabase URL is not configured on the server.' });
      }

      // Extract the path suffix from the original URL
      const proxyPathSegment = '/supabase-proxy';
      const proxyIndex = originalUrl.indexOf(proxyPathSegment);
      let pathSuffix = originalUrl;
      if (proxyIndex !== -1) {
        pathSuffix = originalUrl.substring(proxyIndex + proxyPathSegment.length);
      }

      // Prepare target URL
      const baseUrl = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl;
      const cleanPathSuffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
      const fullTargetUrl = `${baseUrl}${cleanPathSuffix}`;

      console.log(`[API Gateway Proxy] Routing to: ${fullTargetUrl}`);

      let body = undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (req.body && Object.keys(req.body).length > 0) {
          body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
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

      const headers = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          const lowerKey = key.toLowerCase();
          if (whitelist.includes(lowerKey)) {
            headers[lowerKey] = value;
          }
        }
      }

      // Ensure api key resides in headers
      if (!headers['apikey'] && targetKey) {
        headers['apikey'] = targetKey;
      }

      const response = await fetch(fullTargetUrl, {
        method: req.method,
        headers: headers,
        body: body,
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
      });

      // Forward response headers (excluding chunked / encoding related)
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
      return res.send(Buffer.from(arrayBuffer));

    } catch (error) {
      console.error('[API Gateway Proxy Exception]', error);
      return res.status(500).json({ error: error.message || 'Supabase proxy request failed.' });
    }
  }

  // 2. Check if AI Chat request
  if (originalUrl.includes('/ai/chat')) {
    try {
      const { message, history, feature, context } = req.body;

      if (!message && !feature) {
        return res.status(400).json({ error: 'Message or specific feature parameter is required.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          error: 'Gemini API key is not configured on the server.' 
        });
      }

      const client = await getGeminiClient();

      let systemInstruction = `You are "APLD Smart Clinic Assistant", an expert AI clinical copilot integrated into "Ashok Private Laboratory and Dispensary (APLD) Management System".
Your role is to assist clinical doctors, laboratory technicians, nurses, and pharmacists with high-precision clinical decision assistance, summaries, diagnostics help, and documentation.

Always adhere to these guidelines:
1. Provide highly professional, balanced, structured, and clinically precise responses.
2. Clearly distinguish between subjective symptoms, objective laboratory markers, diagnostic assessments, and treatment plans.
3. Keep the tone clinical, empathetic, and objective. Always include a short professional disclaimer reminding users that you are an AI assistant and all diagnoses/orders must be verified by the licensed attending physician.
4. Format all documents, notes, summaries, and value tables perfectly in well-spaced, highly readable Markdown, using clean tables, bullet points, headers, and bold text.
5. Use medical terminology with brief helpful definitions when answering non-clinical user questions.`;

      let dynamicPrompt = message || '';
      
      if (feature === 'generate_clinical_notes') {
        systemInstruction += `\n\nFeature: Generate Clinical Notes (SOAP Format)
You will receive clinical inputs, symptoms, primary complaints, and basic details. Output a professionally structured SOAP note:
- S (Subjective): Chief complaints, history of presenting illness, symptoms.
- O (Objective): Vital signs (if supplied), physical exam, and laboratory markers.
- A (Assessment): Differential diagnoses or primary diagnostic assessments, clinical reasoning.
- P (Plan): Further diagnostics/lab work, medication/prescriptions (with dosages), referral guidelines, and patient education.`;
        dynamicPrompt = `Generate a comprehensive professional clinical SOAP Note based on the following patient presentation:\n${context || message}`;
      } 
      else if (feature === 'suggest_lab_tests') {
        systemInstruction += `\n\nFeature: Suggest Lab Tests
Analyze presenting symptoms, chronic conditions, or clinical suspicions and propose structured laboratory investigations.
Group your suggestions logically (e.g., Hematology, Biochemistry, Immunology, Urinalysis).
For each suggested test, briefly outline:
1. Clinical Rationale: Why this test is appropriate.
2. Expected Insights: What specific markers are being evaluated.
3. Specimen: Standard specimen type (e.g., EDTA whole blood, serum, random urine).`;
        dynamicPrompt = `Identify and suggest the most relevant laboratory test orders for a patient presenting with:\n${context || message}`;
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
        dynamicPrompt = `Analyze, calculate, and interpret the following laboratory results:\n${context || message}`;
      }
      else if (feature === 'smart_record_search') {
        systemInstruction += `\n\nFeature: Smart Record Search & Medical Knowledge Map
The clinician is trying to lookup, understand, or classify a medical concept, drug class, diagnosis, ICD-10 medical code, or anatomical relation.
Help search your background knowledge Base. Give a clean medical reference card explaining the query, any relevant clinical applications, drug interactions, or diagnostic values.`;
        dynamicPrompt = `Perform a smart clinical conceptual search/explanation for. Break it down beautifully:\n"${context || message}"`;
      }
      else if (feature === 'monthly_report_summary') {
        systemInstruction += `\n\nFeature: Monthly Clinical & Diagnostic Performance Report Summary
Summarize the laboratory performance, diagnostic volumes, clinical billing counts, or stock levels provided in the context.
Translate raw numbers, values, or trends into a beautiful Executive Clinical Informatics Report:
1. Diagnostic Highlights: Performance spikes, test-related trends (e.g., uptick in malaria smears or lipid profiles).
2. Financial & Billing summary context.
3. Inventory Insights: Crucial stock alerts, low medicines, or supply chain bottlenecks.
4. Operational Recommendation: Clear actionable suggestions to optimize clinic throughput or quality controls.`;
        dynamicPrompt = `Perform a brilliant summary and informatics breakdown of the following raw clinic report data:\n${context || message}`;
      }

      const chatContents = [];
      if (history && Array.isArray(history)) {
        history.forEach((h) => {
          chatContents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }],
          });
        });
      }

      chatContents.push({
        role: 'user',
        parts: [{ text: dynamicPrompt }],
      });

      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: chatContents,
        config: {
          systemInstruction,
          temperature: 0.2,
        }
      });

      const reply = response.text || "I was unable to formulate a clinical response regarding this request. Please verify inputs.";
      return res.json({ reply });

    } catch (error) {
      console.error('[API Gateway AI Error]', error);
      return res.status(500).json({ error: error.message || 'An error occurred contacting AI engine.' });
    }
  }

  // 3. Fallback 404 with JSON
  console.log(`[API Gateway] 404 Not Found: ${method} ${originalUrl}`);
  return res.status(404).json({ error: `Route not found on Gateway: ${method} ${originalUrl}` });
});

export default app;
