// WithdrawalsController unit tests.
// Verifies that getWithdrawal() delegates directly to PublicApiService.getWithdrawal().

import { WithdrawalsController } from './withdrawals.controller';

describe('WithdrawalsController', () => {
  it('delegates getWithdrawal to service with the id param', async () => {
    const mockWithdrawal = { id: '0xwith1', amount: '2000000' };
    const service = { getWithdrawal: vi.fn().mockResolvedValue(mockWithdrawal) };
    const controller = new WithdrawalsController(service as never);

    const result = await controller.getWithdrawal('0xwith1');

    expect(service.getWithdrawal).toHaveBeenCalledWith('0xwith1');
    expect(result).toBe(mockWithdrawal);
  });
});
