package org.progresspalbackend.progresspalbackend.dto.activitytype;


import org.progresspalbackend.progresspalbackend.domain.MetricKind;

import java.util.UUID;

public record ActivityTypeDto(
        UUID id,
        String name,
        boolean custom,
        UUID createdBy,
        MetricKind metricKind,
        String metricLabel
) {}
