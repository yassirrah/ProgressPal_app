package org.progresspalbackend.progresspalbackend.dto.session;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.progresspalbackend.progresspalbackend.domain.Visibility;

import java.util.UUID;

public record SessionCreateDto(
//        UUID userId,
        @NotNull(message = "ActivityTypeId is required")
        UUID activityTypeId,

        @Size(max = 120, message = "Title must be at least")
        String title,

        String description,

        @NotNull(message = "Visibility is required")
        Visibility visibility
) {}