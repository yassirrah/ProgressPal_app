package org.progresspalbackend.progresspalbackend.dto.activitytype;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ActivityTypeCreateDto(
        @NotBlank @Size(min=60)
        String name,
        String iconUrl) {}
