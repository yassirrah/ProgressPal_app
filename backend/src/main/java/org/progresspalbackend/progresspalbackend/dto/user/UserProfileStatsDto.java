package org.progresspalbackend.progresspalbackend.dto.user;

import org.progresspalbackend.progresspalbackend.dto.dashboard.TopActivityTypeByTimeDto;

import java.util.List;

public record UserProfileStatsDto(
        long totalSessions,
        long totalVisibleDurationSeconds,
        List<TopActivityTypeByTimeDto> topActivityTypesByVisibleDuration,
        List<UserProfileRecentSessionDto> recentSessions
) {
}
