package org.progresspalbackend.progresspalbackend.dto.dashboard;

import java.time.LocalDate;

public record DurationTrendPointDto(
        LocalDate bucketStart,
        long totalDurationSeconds
) {
}
