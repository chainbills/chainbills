// ChainsController unit tests.
// Verifies that getChains() delegates directly to PublicApiService.getChains().

import { ChainsController } from './chains.controller';

describe('ChainsController', () => {
  it('delegates getChains to service', () => {
    const mockResult = [{ chainId: '0x1', slug: 'anvil' }];
    const service = { getChains: vi.fn().mockReturnValue(mockResult) };
    const controller = new ChainsController(service as never);

    const result = controller.getChains();

    expect(service.getChains).toHaveBeenCalledOnce();
    expect(result).toBe(mockResult);
  });
});
