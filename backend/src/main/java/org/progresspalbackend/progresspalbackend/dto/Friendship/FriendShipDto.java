package org.progresspalbackend.progresspalbackend.dto.Friendship;

import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

public record FriendShipDto(
        @NotNull UUID FriendId,
        String friendusername,
        @Nullable Instant createdAt
) {}
