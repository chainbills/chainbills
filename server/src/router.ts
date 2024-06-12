import { Request, Response, Router } from 'express';
import {
  initializedPayable,
  paid,
  relay,
  saveNotificationToken,
  withdrew
} from './handlers';
import { validateAuth, validateNetwork } from './middleware';

export const router = Router();

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

router.post('/relay', validateNetwork, async (req: Request, res: Response) => {
  await wrapper(async () => await relay(req.body), 'relaying', res);
});

router.post(
  '/notifications',
  validateAuth,
  async (req: Request, res: Response) => {
    await wrapper(
      async () => await saveNotificationToken(req.body),
      'saving notification token',
      res
    );
  }
);

[
  { entity: 'payable', handler: initializedPayable },
  { entity: 'payment', handler: paid },
  { entity: 'withdrawal', handler: withdrew }
].forEach(({ entity, handler }) => {
  router.post(
    `/${entity}`,
    validateNetwork,
    validateAuth,
    async (req: Request, res: Response) => {
      const { auth, whNetwork } = res.locals;
      await wrapper(
        async () => await handler(req.body, auth, whNetwork),
        `${entity} finalizer`,
        res
      );
    }
  );
});

router.use('**', (_, res) =>
  res.status(404).json({ success: false, message: 'Not Found' })
);
