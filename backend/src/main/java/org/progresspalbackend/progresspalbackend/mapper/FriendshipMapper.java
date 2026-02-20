package org.progresspalbackend.progresspalbackend.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.progresspalbackend.progresspalbackend.domain.Friendship;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendShipDto;

@Mapper(componentModel = "spring")
public interface FriendshipMapper {


    @Mapping(target = "FriendId", source = "friend.id")
    FriendShipDto toDto(Friendship entity);
}
