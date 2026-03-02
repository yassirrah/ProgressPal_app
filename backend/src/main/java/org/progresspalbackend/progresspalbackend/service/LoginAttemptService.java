package org.progresspalbackend.progresspalbackend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class LoginAttemptService {

    private static final String LOCKED_MESSAGE = "Too many failed login attempts. Try again later";

    private final int maxFailedAttempts;
    private final Duration lockDuration;
    private final ConcurrentMap<UUID, AttemptState> attemptsByUserId = new ConcurrentHashMap<>();

    public LoginAttemptService(
            @Value("${app.security.login.max-failed-attempts:5}") int maxFailedAttempts,
            @Value("${app.security.login.lock-duration:PT15M}") Duration lockDuration) {
        if (maxFailedAttempts < 1) {
            throw new IllegalArgumentException("app.security.login.max-failed-attempts must be >= 1");
        }
        if (lockDuration.isNegative() || lockDuration.isZero()) {
            throw new IllegalArgumentException("app.security.login.lock-duration must be > 0");
        }
        this.maxFailedAttempts = maxFailedAttempts;
        this.lockDuration = lockDuration;
    }

    public void checkNotLocked(UUID userId) {
        AttemptState state = attemptsByUserId.get(userId);
        if (state == null) {
            return;
        }

        Instant now = Instant.now();
        if (isExpired(state, now)) {
            attemptsByUserId.remove(userId, state);
            return;
        }

        if (isLocked(state, now)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, LOCKED_MESSAGE);
        }
    }

    public void recordFailure(UUID userId) {
        Instant now = Instant.now();
        AttemptState state = attemptsByUserId.compute(userId, (id, previous) -> nextStateAfterFailure(previous, now));
        if (state != null && isLocked(state, now)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, LOCKED_MESSAGE);
        }
    }

    public void clear(UUID userId) {
        attemptsByUserId.remove(userId);
    }

    private AttemptState nextStateAfterFailure(AttemptState previous, Instant now) {
        if (previous != null && isLocked(previous, now)) {
            return previous;
        }

        int failedAttempts = 0;
        if (previous != null && !isExpired(previous, now)) {
            failedAttempts = previous.failedAttempts();
        }

        int nextFailedAttempts = failedAttempts + 1;
        if (nextFailedAttempts >= maxFailedAttempts) {
            return new AttemptState(0, now.plus(lockDuration));
        }

        return new AttemptState(nextFailedAttempts, null);
    }

    private boolean isLocked(AttemptState state, Instant now) {
        return state.lockedUntil() != null && now.isBefore(state.lockedUntil());
    }

    private boolean isExpired(AttemptState state, Instant now) {
        return state.lockedUntil() != null && !now.isBefore(state.lockedUntil());
    }

    private record AttemptState(int failedAttempts, Instant lockedUntil) {
    }
}
