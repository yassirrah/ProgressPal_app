package org.progresspalbackend.progresspalbackend.dto.activitytype;

import java.util.UUID;

public record ActivityTypeDto(
        UUID id,
        String name,
        boolean isCustom) {}
