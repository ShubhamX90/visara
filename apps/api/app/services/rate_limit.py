from __future__ import annotations

import asyncio
from collections import defaultdict
from time import monotonic

from app.core.exceptions import VisaraAPIError


class InMemoryRateLimiter:
    def __init__(self, *, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._lock = asyncio.Lock()
        self._events: dict[str, list[float]] = defaultdict(list)

    async def enforce(self, *, key: str) -> None:
        now = monotonic()
        async with self._lock:
            window_start = now - self.window_seconds
            active_events = [event for event in self._events[key] if event >= window_start]
            if len(active_events) >= self.limit:
                raise VisaraAPIError(
                    code="RATE_LIMITED",
                    message="Too many case submissions were received in a short period.",
                    detail="Please wait a few minutes before starting another analysis.",
                    status_code=429,
                )

            active_events.append(now)
            self._events[key] = active_events
