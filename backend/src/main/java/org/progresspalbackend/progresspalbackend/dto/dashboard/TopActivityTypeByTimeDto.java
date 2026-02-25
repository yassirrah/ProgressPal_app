package org.progresspalbackend.progresspalbackend.dto.dashboard;

import java.util.UUID;

public record TopActivityTypeByTimeDto(
        UUID activityTypeId,
        String activityTypeName,
        long totalDurationSeconds
) {
}
