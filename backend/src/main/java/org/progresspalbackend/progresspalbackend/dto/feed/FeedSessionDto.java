package org.progresspalbackend.progresspalbackend.dto.feed;

import org.progresspalbackend.progresspalbackend.domain.Visibility;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FeedSessionDto(UUID id,
                             UUID userId,
                             String username,
                             UUID activityTypeId,
                             String activityTypeName,
                             String title,
                             BigDecimal metricValue,
                             String metricLabel,
                             Instant startedAt,
                             Instant endedAt,
                             Visibility visibility) {}
