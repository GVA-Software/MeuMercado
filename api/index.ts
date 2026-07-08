// Função serverless da Vercel. A Vercel expõe arquivos em /api como funções;
// esta encaminha /api/* para a app Nest (compilada em apps/api/dist).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getServerlessHandler } from '../apps/api/dist/serverless.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getServerlessHandler();
  app(req, res);
}
