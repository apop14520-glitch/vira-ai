"""Small in-process sliding-window limiter for local provider calls."""

from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from typing import Callable


class SlidingWindowRateLimiter:
    """Bound repeated calls by principal without adding a production service yet."""

    def __init__(self, max_requests: int, window_seconds: int, clock: Callable[[], float] = monotonic) -> None:
        if max_requests < 1 or window_seconds < 1:
            raise ValueError("O rate limit deve ter valores positivos.")
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._clock = clock
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        """Return whether the next request for ``key`` is within the window."""

        now = self._clock()
        cutoff = now - self.window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= self.max_requests:
                return False
            events.append(now)
            return True

    def retry_after(self, key: str) -> int:
        """Return a conservative number of seconds before the oldest event expires."""

        now = self._clock()
        with self._lock:
            events = self._events.get(key)
            if not events:
                return 0
            return max(1, int(events[0] + self.window_seconds - now))
