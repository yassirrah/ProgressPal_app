package org.progresspalbackend.progresspalbackend.dto.comment;

import java.time.Instant;
import java.util.UUID;

public record SessionCommentDto(UUID id,
                                UUID sessionId,
                                UUID authorId,
                                String authorUsername,
                                String authorProfileImage,
                                String content,
                                Instant createdAt,
                                Instant updatedAt,
                                boolean editable) {
}
