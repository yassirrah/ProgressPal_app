package org.progresspalbackend.progresspalbackend.dto.user;

import org.progresspalbackend.progresspalbackend.domain.Visibility;

import java.time.Instant;
import java.util.UUID;

public record UserProfileRecentSessionDto(
        UUID id,
        UUID activityTypeId,
        String activityTypeName,
        String title,
        Instant startedAt,
        Instant endedAt,
        long durationSeconds,
        Visibility visibility
) {
}
