package org.progresspalbackend.progresspalbackend.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.UserCreateDto;
import org.progresspalbackend.progresspalbackend.dto.UserDto;

@Mapper(componentModel = "spring")
public interface UserMapper {

    UserDto toDto(User entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    User toEntity(UserCreateDto dto);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void updateFromDto(UserCreateDto dto,
                       @MappingTarget User entity);
}