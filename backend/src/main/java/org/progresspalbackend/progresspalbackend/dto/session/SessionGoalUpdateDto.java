package org.progresspalbackend.progresspalbackend.dto.session;

import jakarta.validation.constraints.Size;
import org.progresspalbackend.progresspalbackend.domain.GoalType;

import java.math.BigDecimal;

public record SessionGoalUpdateDto(
        GoalType goalType,
        BigDecimal goalTarget,
        @Size(max = 255, message = "goalNote must be at most 255 characters.")
        String goalNote
) {}
