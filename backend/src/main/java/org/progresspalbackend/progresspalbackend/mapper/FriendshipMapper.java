package org.progresspalbackend.progresspalbackend.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.progresspalbackend.progresspalbackend.domain.Friendship;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendShipDto;

@Mapper(componentModel = "spring")
public interface FriendshipMapper {

    @Mapping(target = "FriendId", source = "friend.id")
    @Mapping(target = "friendusername", source = "friend.username")
    FriendShipDto toDtoFromUserSide(Friendship entity);

    @Mapping(target = "FriendId", source = "user.id")
    @Mapping(target = "friendusername", source = "user.username")
    FriendShipDto toDtoFromFriendSide(Friendship entity);
}
