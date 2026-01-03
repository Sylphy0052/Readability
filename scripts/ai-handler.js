/**
 * scripts/ai-handler.js
 * Interface for Chrome Built-in AI (Gemini Nano)
 */

const AIHandler = {
  _expectedInputs: [{ type: "text", languages: ["en", "ja"] }],
  _expectedOutputs: [{ type: "text", languages: ["ja"] }],

  isAvailable: async () => {
    try {
      if (typeof LanguageModel === 'undefined') {
        return false;
      }
      const availability = await LanguageModel.availability({
        expectedInputs: AIHandler._expectedInputs,
        expectedOutputs: AIHandler._expectedOutputs
      });
      return availability === 'available';
    } catch (e) {
      console.warn('AI availability check failed', e);
      return false;
    }
  },

  createSession: async () => {
    if (!await AIHandler.isAvailable()) {
      throw new Error('AI not available');
    }
    return await LanguageModel.create({
      systemPrompt: "You are an expert technical writer. You improve Markdown documentation.",
      expectedInputs: AIHandler._expectedInputs,
      expectedOutputs: AIHandler._expectedOutputs
    });
  },

  formatMarkdown: async (markdown) => {
    if (!await AIHandler.isAvailable()) return markdown;
    
    try {
      const session = await AIHandler.createSession();
      // Chunking might be needed for very long content, but for this demo/MVP we try direct.
      // Context window is limited (e.g. 4k tokens).
      
      const prompt = `
      Fix the following Markdown content. 
      - Remove excessive newlines.
      - Ensure code blocks have language tags if possible.
      - Fix broken headers.
      - Do not summarize, keep all details.
      
      Content:
      ${markdown.substring(0, 10000)} 
      `; 
      // Safe truncate for MVP
      
      const result = await session.prompt(prompt);
      session.destroy();
      return result;
    } catch (e) {
      console.error('AI Format failed', e);
      return markdown; // Fallback to raw
    }
  },

  summarize: async (text) => {
    if (!await AIHandler.isAvailable()) return null;

    try {
      const session = await LanguageModel.create({
          systemPrompt: "You are a helpful assistant that summarizes text.",
          expectedInputs: AIHandler._expectedInputs,
          expectedOutputs: AIHandler._expectedOutputs
      });
      
      const prompt = `Summarize the following content in 3-5 bullet points:\n\n${text.substring(0, 8000)}`;
      const result = await session.prompt(prompt);
      session.destroy();
      return result;
    } catch (e) {
      console.error('AI Summarize failed', e);
      return null;
    }
  }
};

// Export for ES modules or global
if (typeof self !== 'undefined') {
    self.AIHandler = AIHandler;
}
