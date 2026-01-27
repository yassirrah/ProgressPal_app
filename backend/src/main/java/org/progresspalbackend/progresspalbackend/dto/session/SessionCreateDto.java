package org.progresspalbackend.progresspalbackend.dto.session;

import org.progresspalbackend.progresspalbackend.domain.Visibility;

import java.util.UUID;

public record SessionCreateDto(
//        UUID userId,
        UUID activityTypeId,
        String title,
        String description,
        Visibility visibility
) {}