// PayablesController unit tests.
// Covers all five endpoints: listPayables, getPayable, setDescription,
// listPayablePayments, and listPayableWithdrawals.

import { PayablesController } from './payables.controller';

function makeService() {
  return {
    listPayables: vi.fn(),
    getPayable: vi.fn(),
    setDescription: vi.fn(),
    listPayablePayments: vi.fn(),
    listPayableWithdrawals: vi.fn(),
  };
}

const PAYABLE_ID = '0xabc123';
const WALLET_KEY = 'evm:0xd8da6bf26964af9d7eed9e03e53415d37aa96045';

describe('PayablesController', () => {
  describe('listPayables', () => {
    it('delegates to service with all query fields', async () => {
      const mockResult = { items: [], nextCursor: null };
      const service = makeService();
      service.listPayables.mockResolvedValue(mockResult);
      const controller = new PayablesController(service as never);

      const result = await controller.listPayables({
        host: '0xd8da',
        chain: 'arcmainnet',
        limit: 10,
        cursor: undefined,
      } as never);

      expect(service.listPayables).toHaveBeenCalledWith({
        host: '0xd8da',
        chain: 'arcmainnet',
        limit: 10,
        cursor: undefined,
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('getPayable', () => {
    it('delegates to service with the id param', async () => {
      const mockPayable = { id: PAYABLE_ID };
      const service = makeService();
      service.getPayable.mockResolvedValue(mockPayable);
      const controller = new PayablesController(service as never);

      const result = await controller.getPayable(PAYABLE_ID);

      expect(service.getPayable).toHaveBeenCalledWith(PAYABLE_ID);
      expect(result).toBe(mockPayable);
    });
  });

  describe('setDescription', () => {
    it('calls service.setDescription with id, walletKey, description, and chain hint', async () => {
      const service = makeService();
      service.setDescription.mockResolvedValue(undefined);
      const controller = new PayablesController(service as never);
      const user = { walletKey: WALLET_KEY, userId: 'u1', sessionId: 's1' };

      await controller.setDescription(
        PAYABLE_ID,
        { description: 'Valid description text' },
        { chain: 'arcmainnet' },
        user as never
      );

      expect(service.setDescription).toHaveBeenCalledWith(PAYABLE_ID, WALLET_KEY, 'Valid description text', 'arcmainnet');
    });

    it('passes undefined chain when query has no chain hint', async () => {
      const service = makeService();
      service.setDescription.mockResolvedValue(undefined);
      const controller = new PayablesController(service as never);
      const user = { walletKey: WALLET_KEY, userId: 'u1', sessionId: 's1' };

      await controller.setDescription(PAYABLE_ID, { description: 'Some description here' }, {}, user as never);

      expect(service.setDescription).toHaveBeenCalledWith(PAYABLE_ID, WALLET_KEY, 'Some description here', undefined);
    });
  });

  describe('listPayablePayments', () => {
    it('delegates to service with id and pagination', async () => {
      const mockResult = { items: [], nextCursor: null };
      const service = makeService();
      service.listPayablePayments.mockResolvedValue(mockResult);
      const controller = new PayablesController(service as never);

      const result = await controller.listPayablePayments(PAYABLE_ID, { limit: 20, cursor: undefined });

      expect(service.listPayablePayments).toHaveBeenCalledWith(PAYABLE_ID, { limit: 20, cursor: undefined });
      expect(result).toBe(mockResult);
    });
  });

  describe('listPayableWithdrawals', () => {
    it('delegates to service with id and pagination', async () => {
      const mockResult = { items: [], nextCursor: null };
      const service = makeService();
      service.listPayableWithdrawals.mockResolvedValue(mockResult);
      const controller = new PayablesController(service as never);

      const result = await controller.listPayableWithdrawals(PAYABLE_ID, { limit: 20, cursor: undefined });

      expect(service.listPayableWithdrawals).toHaveBeenCalledWith(PAYABLE_ID, { limit: 20, cursor: undefined });
      expect(result).toBe(mockResult);
    });
  });
});
