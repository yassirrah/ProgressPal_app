package org.progresspalbackend.progresspalbackend.dto.session;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.progresspalbackend.progresspalbackend.domain.Visibility;

import java.util.UUID;

public record SessionCreateDto(
//        UUID userId,
        @NotNull(message = "activityTypeId is required.")
        UUID activityTypeId,

        @Size(max = 120, message = "title must be at most 120 characters.")
        String title,

        String description,

        @NotNull(message = "visibility is required.")
        Visibility visibility
) {}