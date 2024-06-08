import express, { Request, Response } from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import morgan from 'morgan';

import { initializedPayable, paid, withdrew } from './handlers';
import { validateAuth } from './middleware/validate-auth';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('combined'));
app.use(validateAuth);

const wrapper = async (
  action: Function,
  desc: string,
  response: Response
): Promise<Response> => {
  try {
    const data = await action();
    return response.json({
      success: true,
      ...(data ? { data } : {})
    });
  } catch (e: any) {
    console.error(`Error at ${desc} ... `);
    console.error(e);
    return response.status(400).json({
      success: false,
      message: `Error at ${desc}: ${e['message'] ?? e}`
    });
  }
};

app.get('/payable/:address/:email', async (req: Request, res: Response) => {
  await wrapper(
    async () => await initializedPayable(req.params, res.locals.auth),
    'initialized payable finalizer',
    res
  );
});

app.get('/payment/:address/:email', async (req: Request, res: Response) => {
  await wrapper(
    async () => await paid(req.params, res.locals.auth),
    'payment finalizer',
    res
  );
});

app.get('/withdrawal/:address', async (req: Request, res: Response) => {
  await wrapper(
    async () => await withdrew(req.params, res.locals.auth),
    'withdrawal finalizer',
    res
  );
});

app.use('**', (_, res) =>
  res.status(404).json({ success: false, message: 'Not Found' })
);

export const server = onRequest({ cors: true }, app);
