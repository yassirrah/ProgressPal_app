package org.progresspalbackend.progresspalbackend.dto.dashboard;

import java.util.List;
import java.util.UUID;

public record MeDashboardTrendsDto(
        String bucket,
        List<DurationTrendPointDto> durationSeries,
        UUID metricActivityTypeId,
        String metricLabel,
        List<MetricTrendPointDto> metricSeries
) {
}
