package org.progresspalbackend.progresspalbackend.mapper;

import org.mapstruct.*;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.dto.session.SessionCreateDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionDto;


import java.time.Instant;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface SessionMapper {

    /* ENTITY -> DTO (flat ids) */
    @Mapping(target = "userId",         source = "user.id")
    @Mapping(target = "activityTypeId", source = "activityType.id")
    SessionDto toDto(Session entity);

    /* CREATE DTO -> ENTITY (relations & timestamps set elsewhere) */
    @Mapping(target = "id",            ignore = true)
    @Mapping(target = "user",          ignore = true)
    @Mapping(target = "activityType",  ignore = true)
    @Mapping(target = "startedAt",     ignore = true)
    @Mapping(target = "endedAt",       ignore = true)
    @Mapping(target = "metricValue",   ignore = true)
    Session toEntity(SessionCreateDto dto);

    /* Optional helper to set startedAt now */
    @AfterMapping
    default void setDefaults(@MappingTarget Session entity) {
        if (entity.getStartedAt() == null) {
            entity.setStartedAt(Instant.now());
        }
    }
}
