import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { imageUrl, category } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Rate this picture for the category: ${category}. Reply with "Post ✅" or "Nah ❌" and one short suggestion.` },
            { type: "image_url", image_url: imageUrl }
          ],
        },
      ],
    });

    // Return the assistant's text content
    const feedback = response.choices?.[0]?.message?.content ?? null;
    res.status(200).json({ feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI request failed" });
  }
}
