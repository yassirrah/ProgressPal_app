package org.progresspalbackend.progresspalbackend.dto.session;

import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequestStatus;

import java.time.Instant;
import java.util.UUID;

public record SessionJoinRequestDto(
        UUID id,
        UUID sessionId,
        UUID requesterId,
        String requesterUsername,
        SessionJoinRequestStatus status,
        Instant createdAt,
        Instant respondedAt
) {}
