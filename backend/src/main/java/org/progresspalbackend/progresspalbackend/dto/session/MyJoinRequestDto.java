package org.progresspalbackend.progresspalbackend.dto.session;

import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequestStatus;

import java.time.Instant;
import java.util.UUID;

public record MyJoinRequestDto(
        UUID requestId,
        UUID sessionId,
        UUID hostUserId,
        SessionJoinRequestStatus status,
        Instant createdAt,
        Instant respondedAt
) {}
