package org.progresspalbackend.progresspalbackend.dto.user;

import java.util.UUID;

public record UserProfileDto(
        UUID userId,
        String username,
        String bio,
        String profileImage,
        String viewerScope,
        UserProfileStatsDto stats
) {
}
