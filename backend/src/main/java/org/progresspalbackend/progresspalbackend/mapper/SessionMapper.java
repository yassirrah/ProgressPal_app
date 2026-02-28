package org.progresspalbackend.progresspalbackend.mapper;

import org.mapstruct.*;
import org.progresspalbackend.progresspalbackend.domain.GoalType;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.dto.session.SessionCreateDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionDto;


import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface SessionMapper {

    /* ENTITY -> DTO (flat ids) */
    @Mapping(target = "userId",         source = "user.id")
    @Mapping(target = "activityTypeId", source = "activityType.id")
    @Mapping(target = "goalDone",       expression = "java(computeGoalDone(entity))")
    @Mapping(target = "goalAchieved",   expression = "java(computeGoalAchieved(entity))")
    SessionDto toDto(Session entity);

    /* CREATE DTO -> ENTITY (relations & timestamps set elsewhere) */
    @Mapping(target = "id",            ignore = true)
    @Mapping(target = "user",          ignore = true)
    @Mapping(target = "activityType",  ignore = true)
    @Mapping(target = "startedAt",     ignore = true)
    @Mapping(target = "endedAt",       ignore = true)
    @Mapping(target = "pausedAt",      ignore = true)
    @Mapping(target = "pausedDurationSeconds", ignore = true)
    @Mapping(target = "metricValue",   ignore = true)
    Session toEntity(SessionCreateDto dto);

    /* Optional helper to set startedAt now */
    @AfterMapping
    default void setDefaults(@MappingTarget Session entity) {
        if (entity.getStartedAt() == null) {
            entity.setStartedAt(Instant.now());
        }
    }

    default BigDecimal computeGoalDone(Session entity) {
        GoalType goalType = entity.getGoalType() == null ? GoalType.NONE : entity.getGoalType();
        if (goalType == GoalType.TIME) {
            long durationSeconds = computeEffectiveDurationSeconds(entity, Instant.now());
            return BigDecimal.valueOf(durationSeconds)
                    .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        }
        if (goalType == GoalType.METRIC) {
            if (entity.getMetricCurrentValue() != null) {
                return entity.getMetricCurrentValue();
            }
            return entity.getMetricValue();
        }
        return null;
    }

    default long computeEffectiveDurationSeconds(Session entity, Instant now) {
        Instant end = entity.getEndedAt() == null ? now : entity.getEndedAt();
        long rawSeconds = Math.max(0, Duration.between(entity.getStartedAt(), end).getSeconds());

        long pausedSeconds = entity.getPausedDurationSeconds() == null ? 0L : entity.getPausedDurationSeconds();
        if (entity.getPausedAt() != null) {
            pausedSeconds += Math.max(0, Duration.between(entity.getPausedAt(), end).getSeconds());
        }
        return Math.max(0, rawSeconds - pausedSeconds);
    }

    default Boolean computeGoalAchieved(Session entity) {
        GoalType goalType = entity.getGoalType() == null ? GoalType.NONE : entity.getGoalType();
        if (goalType == GoalType.NONE) {
            return null;
        }
        if (entity.getGoalTarget() == null) {
            return null;
        }
        BigDecimal done = computeGoalDone(entity);
        if (done == null) {
            return null;
        }
        return done.compareTo(entity.getGoalTarget()) >= 0;
    }
}
