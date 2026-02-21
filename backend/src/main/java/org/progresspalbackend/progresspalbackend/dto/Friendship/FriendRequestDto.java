package org.progresspalbackend.progresspalbackend.dto.Friendship;

import java.time.Instant;
import java.util.UUID;

public record FriendRequestDto(
        UUID requesterId,
        String requesterUsername,
        Instant createdAt
) {}
