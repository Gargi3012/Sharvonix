// Sharvonix AI Chatbot API Route
// Works seamlessly on Vercel Serverless Functions, Node.js, and local dev

const SYSTEM_PROMPT = `You are the official AI assistant for Sharvonix — a premium digital experience studio based in India, founded by Gargi Sharma and Shubham Sharma.

## LANGUAGE RULE (VERY IMPORTANT)
- Detect the language of the user's message automatically.
- If the user writes in **Hinglish** (Hindi + English mix) or **Hindi**, always reply in warm, friendly **Hinglish** — like a real Indian studio team member talking casually. Example: "Haan bilkul! Humara Business Plan ₹9,999 mein aata hai jisme 6 pages, SEO, aur animations sab included hain 🙌"
- If the user writes in **English**, always reply in clean, professional **English**.
- Never switch languages mid-conversation unless the user switches first.
- Never reply in pure Hindi script (Devanagari) — always use Roman script for Hindi words.

## WHO YOU ARE
You represent Sharvonix with warmth, confidence, and professionalism. You speak like a knowledgeable studio team member — friendly, concise, and helpful. You always guide users toward booking a project or connecting with the founders.

## ABOUT SHARVONIX STUDIO
- **Founded by:** Gargi Sharma & Shubham Sharma (you work directly with them — no middlemen)
- **What we do:** Custom high-converting websites, landing pages, portfolio sites, e-commerce stores, AI-integrated web apps
- **Our edge:** 100% custom design (no generic templates), founder-level attention, fast delivery, affordable pricing

## PACKAGES & PRICING
1. **Starter Plan — ₹5,999**
   - 1–3 page modern landing page
   - Mobile responsive, SEO setup
   - Contact form + WhatsApp integration
   - Delivered in 3–5 days

2. **Business Plan — ₹9,999** ⭐ Most Popular
   - Up to 6 custom high-impact pages
   - Google SEO setup & fast indexing
   - Animations, micro-interactions, premium UI
   - Fast loading on all mobile phones
   - Interactive contact form + WhatsApp
   - 1 month free priority updates & support
   - Delivered in 5–7 days

3. **Custom Growth Plan — ₹15,999**
   - Online store / custom web application
   - Direct checkout & WhatsApp ordering
   - AI chatbot / automation integration
   - Full branding & identity system
   - Priority delivery, dedicated support
   - Timeline: 7–14 days based on scope

## OUR PROCESS
1. Quick Chat — Understand your business goals
2. Design Preview — Show the design, refine based on feedback
3. Development — Build fast, test on all devices
4. Launch — Live on Google in 3–7 days

## TECH STACK
Next.js, React, Tailwind CSS, Supabase, Vercel, Figma, Framer, OpenAI/Groq APIs

## CONTACT
- WhatsApp: +91 79882 07356 (Gargi) / +91 70154 36857 (Shubham)
- Email: sharvonix@gmail.com
- Instagram: @sharvonix

## TONE GUIDELINES
- Be warm, helpful, and encouraging — never robotic
- Keep responses short and to the point (2–4 sentences max unless listing features)
- Use bold text for key info (prices, names, numbers)
- Always end with a soft CTA: invite them to WhatsApp or share their requirements

## STRICT GUARDRAILS
- ONLY answer questions about Sharvonix, web design, websites, pricing, process, tech stack, or booking
- If asked general knowledge, math, coding homework, news, politics, competitors, or anything unrelated: politely refuse with "I'm the Sharvonix studio assistant — I can only help with web design and project inquiries. Want to discuss a website for your brand?"
- NEVER make up prices, timelines, or features not listed above
- NEVER mention or compare with competitors (Wix, Squarespace, other agencies, freelancers)
- When a user shows buying intent, ask for their **Name** and **WhatsApp number** so Gargi & Shubham can reach out`;

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, messages } = req.body || {};
    const userMessage = (message || (messages && messages[messages.length - 1]?.content) || '').trim();

    if (!userMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build conversation history (Last 6 messages for context memory)
    const validHistory = messages && Array.isArray(messages) && messages.length > 0
      ? messages.slice(-6).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || '')
        }))
      : [{ role: 'user', content: userMessage }];

    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...validHistory
    ];

    // Background Lead Capture: If user typed a phone number, log to Supabase leads table
    autoCaptureLeadIfPhonePresent(userMessage);

    // 1. Try Groq API (Fastest — llama-3.1-8b-instant)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: apiMessages,
            temperature: 0.35,
            max_tokens: 400
          })
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          const reply = data?.choices?.[0]?.message?.content;
          if (reply) return res.status(200).json({ reply });
        }
      } catch (err) {
        console.warn('Groq failed, falling back:', err.message);
      }
    }

    // 2. Try Google Gemini API (Gemini 1.5 Flash with native system_instruction)
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const contents = validHistory.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: contents,
              generationConfig: { temperature: 0.3, maxOutputTokens: 350 }
            })
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return res.status(200).json({ reply });
        }
      } catch (err) {
        console.warn('Gemini failed, falling back:', err.message);
      }
    }

    // 3. Try OpenAI API (gpt-4o-mini)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: apiMessages,
            temperature: 0.3,
            max_tokens: 350
          })
        });

        if (openaiRes.ok) {
          const data = await openaiRes.json();
          const reply = data?.choices?.[0]?.message?.content;
          if (reply) return res.status(200).json({ reply });
        }
      } catch (err) {
        console.warn('OpenAI failed, falling back:', err.message);
      }
    }

    // 4. Built-in Deterministic Guardrail Engine (Zero-cost fallback)
    const reply = evaluateGuardrails(userMessage);
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      reply: "Main Sharvonix ka assistant hun — website design aur development inquiries mein help kar sakta hun. Gargi aur Shubham se seedha WhatsApp par judne ke liye click karein: +91 79882 07356 🙌"
    });
  }
}

// Background Lead Capture Helper (Captures leads to Supabase if phone/email detected)
async function autoCaptureLeadIfPhonePresent(text) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    // Detect 10-digit phone or email
    const phoneMatch = text.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/);
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

    if (phoneMatch || emailMatch) {
      await fetch(`${supabaseUrl}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          name: 'AI Chat Visitor',
          phone: phoneMatch ? phoneMatch[0] : null,
          email: emailMatch ? emailMatch[0] : null,
          message: text,
          source: 'ai_chat',
          plan: 'Inquired in Chat'
        })
      });
    }
  } catch (e) {
    // Non-blocking background log
    console.warn('Silent lead capture error:', e.message);
  }
}

// Deterministic Guardrails Evaluator (Bilingual: Hinglish + English)
function evaluateGuardrails(userMessage) {
  const q = userMessage.toLowerCase();

  // Detect Hinglish / Hindi intent
  const isHindi = /\b(kya|hai|hain|kitna|kitne|bhai|chahiye|banao|kaise|hoga|karega|mujhe|humara|aapka|aap|me|mein|nahi|karo|tha|thi|the|wala|waali|acha|thik|suno|bolo|btao|batao|lena|dena|milega|milegi|paisa|rupay|kab|kyun|kon|jo|to|se|ka|ki|ke|per|par|sirf|bahut|thoda|zyada|accha|sahi|galat|agar|phir|abhi|tab|jab|yahan|vahan)\b/.test(q);

  // Off-topic guardrail check
  const offTopicKeywords = [
    'capital of', 'who is president', 'weather', 'recipe', 'solve', 'calculate',
    'python homework', 'java code', 'write a poem', 'tell a joke', 'who won', 'history of',
    'movie', 'actor', 'song', 'sports', 'cricket score', 'crypto price'
  ];
  for (const kw of offTopicKeywords) {
    if (q.includes(kw)) {
      return isHindi
        ? "Bhai, main sirf Sharvonix ke web design aur website projects ke baare mein help kar sakta hun. Kya aap apne brand ke liye website banwana chahte hain?"
        : "I can only assist with Sharvonix web development and design inquiries. Would you like to discuss a project for your brand?";
    }
  }

  // Lead / Booking Interest
  if (q.includes('start') || q.includes('hire') || q.includes('book') || q.includes('interested') || q.includes('build my') || q.includes('contact') || q.includes('banana') || q.includes('banwana') || q.includes('chahiye') || q.includes('chahta') || q.includes('chahti')) {
    return isHindi
      ? "Zabardast! Aapka **naam** aur **WhatsApp number** share karein, Gargi aur Shubham seedha aapse connect karenge. Ya aap khud WhatsApp kar sakte hain: **+91 79882 07356** 🚀"
      : "We'd love to build your website! Please share your **Name** and **WhatsApp number** so Gargi and Shubham can reach out, or connect directly on WhatsApp: **+91 79882 07356**.";
  }

  // Pricing & Packages
  if (q.includes('price') || q.includes('cost') || q.includes('package') || q.includes('plan') || q.includes('rate') || q.includes('fee') || q.includes('kitna') || q.includes('kitne') || q.includes('paisa') || q.includes('rupay') || q.includes('budget')) {
    return isHindi
      ? "Humare 3 transparent packages hain:\n• **Starter Plan:** ₹5,999 (1–3 page site, 3–5 din mein ready)\n• **Business Plan:** ₹9,999 ⭐ (Most Popular — 6 pages, SEO, animations, 1 month support)\n• **Custom Growth:** ₹15,999 (Online store, AI tools, full branding)\n\nAap WhatsApp par Gargi ya Shubham se seedha baat kar sakte hain: **+91 79882 07356** 🙌"
      : "Here are our transparent studio packages:\n• **Starter Plan:** ₹5,999 (Essential landing page, 3–5 days delivery)\n• **Business Plan:** ₹9,999 ⭐ (Most Popular – 6 pages, SEO, animations, 1 month support)\n• **Custom Growth Plan:** ₹15,999 (Web app, AI integrations, full branding)\n\nConnect on WhatsApp (+91 79882 07356) to choose the best plan for your brand!";
  }

  // Delivery & Timeline
  if (q.includes('fast') || q.includes('time') || q.includes('deliver') || q.includes('duration') || q.includes('how long') || q.includes('days') || q.includes('kab') || q.includes('kitne din') || q.includes('kitna time')) {
    return isHindi
      ? "Typically **3 se 7 business days** mein site live ho jaati hai. Gargi aur Shubham khud kaam karte hain — koi middleman nahi! Shuru karna chahte hain? 🙌"
      : "Our typical turnaround is **3 to 7 business days**, with direct founder-level dedication from day one. Ready to get started?";
  }

  // Founders & Studio Info
  if (q.includes('founder') || q.includes('who are') || q.includes('gargi') || q.includes('shubham') || q.includes('team') || q.includes('about') || q.includes('kaun') || q.includes('kon hain') || q.includes('studio')) {
    return isHindi
      ? "Sharvonix ek premium Indian digital studio hai jo **Gargi Sharma** aur **Shubham Sharma** ne banaya hai. Aap seedha founders ke saath kaam karte hain — koi account manager nahi, koi delay nahi! WhatsApp: +91 79882 07356 / +91 70154 36857"
      : "Sharvonix is a premium digital experience studio founded by **Gargi Sharma** and **Shubham Sharma**. You get direct founder access — no middlemen, no delays! WhatsApp: +91 79882 07356 / +91 70154 36857.";
  }

  // Tech Stack
  if (q.includes('tech') || q.includes('stack') || q.includes('framework') || q.includes('wordpress') || q.includes('next') || q.includes('react') || q.includes('technology') || q.includes('tools')) {
    return isHindi
      ? "Hum **Next.js, React, Tailwind CSS, Supabase, Vercel, aur Figma** use karte hain — koi slow WordPress template nahi! Sab kuch aapke brand ke liye custom banta hai. 🔥"
      : "We use **Next.js, React, Tailwind CSS, Supabase, Vercel, and Figma** — no slow WordPress templates. Everything is custom-crafted for your brand.";
  }

  // Default Polite Redirect
  return isHindi
    ? "Main Sharvonix ka studio assistant hun — sirf web design aur website projects mein help kar sakta hun. Kya aap apne brand ke liye website discuss karna chahte hain? WhatsApp: +91 79882 07356"
    : "I can only assist with Sharvonix web development and design inquiries. Would you like to discuss a project for your brand? WhatsApp: +91 79882 07356.";
}