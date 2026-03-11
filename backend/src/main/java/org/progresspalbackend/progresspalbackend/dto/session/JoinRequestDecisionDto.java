package org.progresspalbackend.progresspalbackend.dto.session;

import jakarta.validation.constraints.NotNull;

public record JoinRequestDecisionDto(
        @NotNull(message = "decision is required")
        JoinRequestDecision decision
) {}
