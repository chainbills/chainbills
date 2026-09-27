// PaymentsController unit tests.
// Verifies delegation to PublicApiService for UserPayment and PayablePayment lookups.

import { PaymentsController } from './payments.controller';

function makeService() {
  return {
    getUserPayment: vi.fn(),
    getPayablePayment: vi.fn(),
  };
}

describe('PaymentsController', () => {
  describe('getUserPayment', () => {
    it('delegates to service.getUserPayment with the id param', async () => {
      const mockPayment = { id: '0xpay1' };
      const service = makeService();
      service.getUserPayment.mockResolvedValue(mockPayment);
      const controller = new PaymentsController(service as never);

      const result = await controller.getUserPayment('0xpay1');

      expect(service.getUserPayment).toHaveBeenCalledWith('0xpay1');
      expect(result).toBe(mockPayment);
    });
  });

  describe('getPayablePayment', () => {
    it('delegates to service.getPayablePayment with the id param', async () => {
      const mockPayment = { id: '0xppay1' };
      const service = makeService();
      service.getPayablePayment.mockResolvedValue(mockPayment);
      const controller = new PaymentsController(service as never);

      const result = await controller.getPayablePayment('0xppay1');

      expect(service.getPayablePayment).toHaveBeenCalledWith('0xppay1');
      expect(result).toBe(mockPayment);
    });
  });
});
