package org.progresspalbackend.progresspalbackend.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.dto.SessionCreateDto;
import org.progresspalbackend.progresspalbackend.dto.SessionDto;

@Mapper(componentModel = "spring")
public interface SessionMapper {

    /* ───────────────────────────────────────────────────────────────
       ENTITY ➜ DTO
       ───────────────────────────────────────────────────────────── */
    @Mapping(target = "userId",          source = "user.id")
    @Mapping(target = "activityTypeId",  source = "activityType.id")
    SessionDto toDto(Session entity);


    /* ───────────────────────────────────────────────────────────────
       DTO ➜ ENTITY  (initial creation)
       Relationships (user, activityType) are set later in the service
       ───────────────────────────────────────────────────────────── */
    @Mapping(target = "id",          ignore = true)
    @Mapping(target = "user",        ignore = true)
    @Mapping(target = "activityType",ignore = true)
    @Mapping(target = "startedAt",   ignore = true)
    @Mapping(target = "endedAt",     ignore = true)
    @Mapping(target = "ongoing",     ignore = true)
    Session toEntity(SessionCreateDto dto);


    /* ───────────────────────────────────────────────────────────────
       DTO ↷ EXISTING ENTITY  (update call)
       Keeps id & timestamps intact, only updatable fields change.
       ───────────────────────────────────────────────────────────── */
    @Mapping(target = "id",            ignore = true)
    @Mapping(target = "user",          ignore = true)
    @Mapping(target = "activityType",  ignore = true)
    @Mapping(target = "startedAt",     ignore = true)
    @Mapping(target = "endedAt",       ignore = true)
    @Mapping(target = "ongoing",       ignore = true)
    void updateFromDto(SessionCreateDto dto,
                       @MappingTarget Session entity);
}