package org.progresspalbackend.progresspalbackend.dto.dashboard;

import java.math.BigDecimal;
import java.util.UUID;

public record MeDashboardByActivityTypeDto(
        UUID activityTypeId,
        String name,
        String category,
        long totalDurationSeconds,
        long totalSessions,
        BigDecimal totalMetricValue,
        String metricLabel
) {
}
