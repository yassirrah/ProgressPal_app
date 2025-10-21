package org.progresspalbackend.progresspalbackend.dto.session;

import jakarta.validation.constraints.PositiveOrZero;

public record SessionStopDto(@PositiveOrZero Double quantity) {}