package org.progresspalbackend.progresspalbackend.dto.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MetricTrendPointDto(
        LocalDate bucketStart,
        BigDecimal totalMetricValue
) {
}
