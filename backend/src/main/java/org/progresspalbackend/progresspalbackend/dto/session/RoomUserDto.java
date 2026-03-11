package org.progresspalbackend.progresspalbackend.dto.session;

import java.util.UUID;

public record RoomUserDto(
        UUID id,
        String username,
        String profileImage
) {}
