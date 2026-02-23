package org.progresspalbackend.progresspalbackend.dto.activitytype;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.progresspalbackend.progresspalbackend.domain.MetricKind;

public record ActivityTypeCreateDto(
        @NotBlank @Size(min=60)
        String name,
        String iconUrl,
        MetricKind metricKind,
        String metricLabel) {}
