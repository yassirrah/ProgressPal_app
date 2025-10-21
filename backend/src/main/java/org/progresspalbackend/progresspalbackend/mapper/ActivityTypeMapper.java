package org.progresspalbackend.progresspalbackend.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.dto.activitytype.ActivityTypeCreateDto;
import org.progresspalbackend.progresspalbackend.dto.activitytype.ActivityTypeDto;


@Mapper(componentModel = "spring")
public interface ActivityTypeMapper {

    ActivityTypeDto toDto(ActivityType entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    ActivityType toEntity(ActivityTypeCreateDto dto);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    void updateFromDto(ActivityTypeCreateDto dto,
                       @MappingTarget ActivityType entity);
}
