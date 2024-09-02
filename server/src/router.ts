import { Request, Response, Router } from 'express';
import {
  createPayable,
  getPayable,
  payablePaid,
  relay,
  saveNotificationToken,
  userPaid,
  withdrew
} from './handlers';
import { validateAuth, validateChain, validateNetwork } from './middleware';

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
  validateChain,
  validateAuth,
  async (req: Request, res: Response) => {
    await wrapper(
      async () => await saveNotificationToken(req.body),
      'saving notification token',
      res
    );
  }
);

router.get('/payable/:id', async (req: Request, res: Response) => {
  await wrapper(
    async () => await getPayable(req.params.id),
    'getting payable',
    res
  );
});

router.post(
  '/payment/payable',
  validateChain,
  validateNetwork,
  async (req: Request, res: Response) => {
    const { chain, whNetwork } = res.locals;
    await wrapper(
      async () => await payablePaid(req.body, chain, whNetwork),
      'payment/payable finalizer',
      res
    );
  }
);

[
  { entity: 'payable', handler: createPayable },
  { entity: 'payment/user', handler: userPaid },
  { entity: 'withdrawal', handler: withdrew }
].forEach(({ entity, handler }) => {
  router.post(
    `/${entity}`,
    validateChain,
    validateNetwork,
    validateAuth,
    async (req: Request, res: Response) => {
      const { chain, walletAddress, whNetwork } = res.locals;
      await wrapper(
        async () => await handler(req.body, chain, walletAddress, whNetwork),
        `${entity} finalizer`,
        res
      );
    }
  );
});

router.use('**', (_, res) =>
  res.status(404).json({ success: false, message: 'Not Found' })
);
