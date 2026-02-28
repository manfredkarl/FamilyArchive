import { type Express, type Request, type Response } from 'express';
import { DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
const TOKEN_SCOPE = 'https://cognitiveservices.azure.com/.default';

export function mapVoiceEndpoints(app: Express): void {
  app.get('/api/voice/token', async (_req: Request, res: Response) => {
    const endpoint =
      process.env.AZURE_VOICELIVE_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;

    if (!endpoint) {
      res.status(503).json({
        error:
          'Voice service is not configured. Set AZURE_VOICELIVE_ENDPOINT or AZURE_OPENAI_ENDPOINT.',
      });
      return;
    }

    try {
      const tokenResponse = await credential.getToken(TOKEN_SCOPE);
      const model = process.env.AZURE_VOICELIVE_MODEL || 'gpt-4o';
      res.json({
        token: tokenResponse.token,
        endpoint,
        model,
      });
    } catch {
      res.status(503).json({ error: 'Failed to acquire voice token.' });
    }
  });
}
