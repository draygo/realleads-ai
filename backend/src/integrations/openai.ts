// Import the OpenAI SDK
import OpenAI from 'openai';

// Initialize the OpenAI client using the API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Calls the OpenAI orchestrator model for chat completion.
 * Combines a system prompt and a user prompt, and returns the model's response.
 * 
 * @param userPrompt - The prompt provided by the user.
 * @param systemPrompt - The system-level instruction for the model.
 * @returns The orchestrated reply from the model.
 */
export async function callOrchestrator(
  userPrompt: string, 
  systemPrompt: string
): Promise<string> {
  try {
    // Select model from environment or use 'gpt-4o' as default
    const model = process.env.ORCHESTRATOR_MODEL || 'gpt-4o';

    // Call OpenAI chat completion
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    // Extract the reply content from the first choice
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenAI orchestration');
    }
    return content;
  } catch (error: any) {
    // Add context to the error message for easier debugging
    throw new Error(`Error calling OpenAI Orchestrator: ${error.message}`);
  }
}

/**
 * Transcribes an audio file using OpenAI's Whisper model.
 * 
 * @param audioFile - The audio file to transcribe. Should be a Node.js compatible file (e.g., fs.ReadStream or Buffer)
 * @returns The transcription text.
 */
export async function transcribeAudio(audioFile: any): Promise<string> {
  try {
    // Call OpenAI Whisper model for audio transcription
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    // Return the transcription text from the response
    if (!response.text) {
      throw new Error('No transcription text returned from OpenAI');
    }
    return response.text;
  } catch (error: any) {
    // Add context to the error message for easier debugging
    throw new Error(`Error transcribing audio with OpenAI: ${error.message}`);
  }
}

