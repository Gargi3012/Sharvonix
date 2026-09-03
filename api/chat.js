// Sharvonix AI Chatbot API Route
// Works seamlessly on Vercel Serverless Functions, Node.js, and local dev

const SYSTEM_PROMPT = `You are Sharvonix AI, the official assistant for Sharvonix digital experience studio (founded by Gargi Sharma and Shubham Sharma).
Studio Info:
- Packages: Starter (₹5,999), Business (₹9,999 - Most Popular), Custom Growth (₹15,999).
- Delivery: 3 to 7 business days.
- Tech Stack: Next.js, Tailwind CSS, Supabase, Vercel, Figma.
- Direct Contact: WhatsApp +91 79882 07356 / +91 70154 36857 | sharvonix@gmail.com.

STRICT GUARDRAILS:
- ONLY answer questions about Sharvonix services, web design, pricing, process, and booking.
- If user asks any unrelated question (e.g. general knowledge, math, coding help, other brands), politely refuse: 'I can only assist with Sharvonix web development and design inquiries. Would you like to discuss a project for your brand?'
- When someone is interested, collect their Name and WhatsApp number and prompt them to connect directly on WhatsApp (+91 79882 07356).`;

export default async function handler(req, res) {
  // CORS support
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

    // 1. Try Google Gemini API if GEMINI_API_KEY is configured
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: `System Instruction:\n${SYSTEM_PROMPT}\n\nUser Query: ${userMessage}` }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 350
              }
            })
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return res.status(200).json({ reply });
          }
        }
      } catch (err) {
        console.warn('Gemini API call failed, using built-in guardrail engine:', err.message);
      }
    }

    // 2. Try OpenAI API if OPENAI_API_KEY is configured
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
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.3,
            max_tokens: 350
          })
        });

        if (openaiRes.ok) {
          const data = await openaiRes.json();
          const reply = data?.choices?.[0]?.message?.content;
          if (reply) {
            return res.status(200).json({ reply });
          }
        }
      } catch (err) {
        console.warn('OpenAI API call failed, using built-in guardrail engine:', err.message);
      }
    }

    // 3. Built-in Deterministic Guardrail Engine (Strictly enforces prompt requirements)
    const reply = evaluateGuardrails(userMessage);
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({
      reply: "I can only assist with Sharvonix web development and design inquiries. Would you like to discuss a project for your brand? You can reach Gargi and Shubham on WhatsApp at +91 79882 07356."
    });
  }
}

// Deterministic Guardrails Evaluator
function evaluateGuardrails(userMessage) {
  const q = userMessage.toLowerCase();

  // Guardrail check: Off-topic questions (math, general coding homework, politics, weather, recipes, competitors)
  const offTopicKeywords = [
    'capital of', 'who is president', 'weather', 'recipe', 'solve', 'calculate',
    'python homework', 'java code', 'write a poem', 'tell a joke', 'who won', 'history of',
    'movie', 'actor', 'song', 'sports', 'cricket score', 'crypto price'
  ];

  for (const kw of offTopicKeywords) {
    if (q.includes(kw)) {
      return "I can only assist with Sharvonix web development and design inquiries. Would you like to discuss a project for your brand?";
    }
  }

  // Lead / Booking Interest (Rule 3)
  if (q.includes('start') || q.includes('hire') || q.includes('book') || q.includes('interested') || q.includes('build my') || q.includes('contact')) {
    return "We'd love to build your website! Please share your **Name** and **WhatsApp number** so Gargi and Shubham can reach out, or you can connect with us directly on WhatsApp at **+91 79882 07356**.";
  }

  // Pricing & Packages
  if (q.includes('price') || q.includes('cost') || q.includes('package') || q.includes('plan') || q.includes('rate') || q.includes('fee')) {
    return "Here are our transparent studio packages:\n• **Starter Plan:** ₹5,999 (Essential modern landing page, 3–5 days delivery)\n• **Business Plan:** ₹9,999 (Most Popular – multi-section custom web experience, animations, responsive design)\n• **Custom Growth Plan:** ₹15,999 (Complex web app, custom AI integrations, priority delivery)\n\nWould you like to connect directly on WhatsApp (+91 79882 07356) to choose the best plan for your brand?";
  }

  // Delivery & Timeline
  if (q.includes('fast') || q.includes('time') || q.includes('deliver') || q.includes('duration') || q.includes('how long') || q.includes('days')) {
    return "Our typical turnaround time is **3 to 7 business days** for standard and business projects, with direct founder-level dedication from day one. Would you like to get started?";
  }

  // Founders & Studio Info
  if (q.includes('founder') || q.includes('who are') || q.includes('gargi') || q.includes('shubham') || q.includes('team') || q.includes('about')) {
    return "Sharvonix is an independent digital experience studio founded by **Gargi Sharma** and **Shubham Sharma**. You get direct founder access without any middlemen or account managers! Direct WhatsApp: +91 79882 07356 / +91 70154 36857.";
  }

  // Tech Stack
  if (q.includes('tech') || q.includes('stack') || q.includes('framework') || q.includes('wordpress') || q.includes('next') || q.includes('react')) {
    return "We specialize in modern, high-performance web experiences using **Next.js, React, Tailwind CSS, Supabase, Vercel, and Figma**—zero slow WordPress templates. Everything is custom crafted for your brand.";
  }

  // Default Polite Studio Redirection
  return "I can only assist with Sharvonix web development and design inquiries. Would you like to discuss a project for your brand? You can also connect directly with Gargi and Shubham on WhatsApp at +91 79882 07356.";
}
