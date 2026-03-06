package org.progresspalbackend.progresspalbackend.dto.reaction;

import java.util.UUID;

public record SessionLikeSummaryDto(UUID sessionId,
                                    long likesCount,
                                    boolean likedByMe) {
}
