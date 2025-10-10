package org.progresspalbackend.progresspalbackend.dto;

import org.progresspalbackend.progresspalbackend.domain.Visibility;

import java.util.UUID;

public record ActivityCreateDto(
        UUID userId,
        UUID activityTypeId,
        String title,
        String description,
        Visibility visibility
) {}
