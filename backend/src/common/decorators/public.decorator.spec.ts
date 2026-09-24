// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — @Public() decorator tests
//
// Confirms the decorator sets IS_PUBLIC_KEY metadata to true on both a
// method and a class, the two targets @SetMetadata can decorate.
// ──────────────────────────────────────────────────────────────────────────────

import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('Public', () => {
  it('sets isPublic metadata to true on a method', () => {
    class Target {
      @Public()
      handler(): void {}
    }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Target.prototype.handler)).toBe(true);
  });

  it('sets isPublic metadata to true on a class', () => {
    @Public()
    class Target {}
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Target)).toBe(true);
  });

  it('exports the metadata key used by the guard', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });
});
