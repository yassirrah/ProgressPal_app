package org.progresspalbackend.progresspalbackend.dto.dashboard;

import java.util.List;

public record MeDashboardSummaryDto(
        long totalSessions,
        long totalDurationSeconds,
        long activeDays,
        List<TopActivityTypeByTimeDto> topActivityTypesByTime
) {
}
