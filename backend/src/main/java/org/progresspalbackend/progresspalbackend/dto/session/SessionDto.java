package org.progresspalbackend.progresspalbackend.dto.session;

import org.progresspalbackend.progresspalbackend.domain.GoalType;
import org.progresspalbackend.progresspalbackend.domain.Visibility;

import java.math.BigDecimal;
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
        Instant pausedAt,
        Long pausedDurationSeconds,
        BigDecimal metricValue,
        BigDecimal metricCurrentValue,
        GoalType goalType,
        BigDecimal goalTarget,
        String goalNote,
        BigDecimal goalDone,
        Boolean goalAchieved,
        Visibility visibility,
        boolean paused,
        boolean ongoing
) {}
