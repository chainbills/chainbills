// UsersApiController unit tests.
// Verifies delegation to PublicApiService for all three user-scoped list endpoints.

import { UsersApiController } from './users-api.controller';

function makeService() {
  return {
    listUserPayments: vi.fn(),
    listUserPayables: vi.fn(),
    listUserActivity: vi.fn(),
  };
}

const WALLET_KEY = 'evm:0xd8da6bf26964af9d7eed9e03e53415d37aa96045';

describe('UsersApiController', () => {
  describe('listUserPayments', () => {
    it('delegates to service with walletKey and pagination', async () => {
      const mockResult = { items: [], nextCursor: null };
      const service = makeService();
      service.listUserPayments.mockResolvedValue(mockResult);
      const controller = new UsersApiController(service as never);

      const result = await controller.listUserPayments(WALLET_KEY, { limit: 20, cursor: undefined });

      expect(service.listUserPayments).toHaveBeenCalledWith(WALLET_KEY, { limit: 20, cursor: undefined });
      expect(result).toBe(mockResult);
    });

    it('passes cursor when provided', async () => {
      const service = makeService();
      service.listUserPayments.mockResolvedValue({ items: [], nextCursor: null });
      const controller = new UsersApiController(service as never);

      await controller.listUserPayments(WALLET_KEY, { limit: 10, cursor: 'abc123' });

      expect(service.listUserPayments).toHaveBeenCalledWith(WALLET_KEY, { limit: 10, cursor: 'abc123' });
    });
  });

  describe('listUserPayables', () => {
    it('delegates to service with walletKey and pagination', async () => {
      const mockResult = { items: [], nextCursor: null };
      const service = makeService();
      service.listUserPayables.mockResolvedValue(mockResult);
      const controller = new UsersApiController(service as never);

      const result = await controller.listUserPayables(WALLET_KEY, { limit: 20, cursor: undefined });

      expect(service.listUserPayables).toHaveBeenCalledWith(WALLET_KEY, { limit: 20, cursor: undefined });
      expect(result).toBe(mockResult);
    });
  });

  describe('listUserActivity', () => {
    it('delegates to service with walletKey and pagination', async () => {
      const mockResult = { items: [], nextCursor: null };
      const service = makeService();
      service.listUserActivity.mockResolvedValue(mockResult);
      const controller = new UsersApiController(service as never);

      const result = await controller.listUserActivity(WALLET_KEY, { limit: 20, cursor: undefined });

      expect(service.listUserActivity).toHaveBeenCalledWith(WALLET_KEY, { limit: 20, cursor: undefined });
      expect(result).toBe(mockResult);
    });
  });
});
