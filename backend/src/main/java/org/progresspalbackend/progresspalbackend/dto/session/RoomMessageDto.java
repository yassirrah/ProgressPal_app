package org.progresspalbackend.progresspalbackend.dto.session;

import java.time.Instant;
import java.util.UUID;

public record RoomMessageDto(
        UUID id,
        UUID sessionId,
        UUID senderId,
        String senderUsername,
        String senderProfileImage,
        String content,
        Instant createdAt
) {}
