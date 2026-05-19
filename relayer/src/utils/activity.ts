let _lastActivityAt = Date.now();

export const recordActivity = () => {
  _lastActivityAt = Date.now();
};

export const idleMs = () => Date.now() - _lastActivityAt;
