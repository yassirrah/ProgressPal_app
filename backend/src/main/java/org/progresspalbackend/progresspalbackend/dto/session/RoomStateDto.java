package org.progresspalbackend.progresspalbackend.dto.session;

import java.util.List;
import java.util.UUID;

public record RoomStateDto(
        UUID sessionId,
        RoomUserDto host,
        List<RoomUserDto> participants,
        boolean live
) {}
