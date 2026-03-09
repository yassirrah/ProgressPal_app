package org.progresspalbackend.progresspalbackend.dto.Friendship;

import java.util.List;
import java.util.UUID;

public record FriendSuggestionDto(
        UUID userId,
        String username,
        String profileImage,
        int score,
        int mutualFriends,
        int sharedActivityTypes,
        int interactionCount,
        boolean recentlyActive,
        List<String> reasons
) {
}
