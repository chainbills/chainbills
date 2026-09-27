// StatsController unit tests.
// Verifies that getStats() delegates directly to PublicApiService.getStats().

import { StatsController } from './stats.controller';

describe('StatsController', () => {
  it('delegates getStats to service', async () => {
    const mockResult = [{ chainId: '0x1', paymentsCount: '5' }];
    const service = { getStats: vi.fn().mockResolvedValue(mockResult) };
    const controller = new StatsController(service as never);

    const result = await controller.getStats();

    expect(service.getStats).toHaveBeenCalledOnce();
    expect(result).toBe(mockResult);
  });
});
