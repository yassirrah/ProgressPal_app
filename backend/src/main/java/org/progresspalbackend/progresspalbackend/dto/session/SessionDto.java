package org.progresspalbackend.progresspalbackend.dto.session;

import org.progresspalbackend.progresspalbackend.domain.Visibility;

import java.time.Instant;
import java.util.UUID;

public record SessionDto(
        UUID id,
        UUID userId,
        UUID activityTypeId,
        String title,
        String description,
        Instant startedAt,
        Instant endedAt,
        Visibility visibility,
        boolean ongoing
) {}
