package org.progresspalbackend.progresspalbackend.dto;

import java.time.Instant;
import java.util.UUID;

public record UserDto(
        UUID id,
        String username,
        String email,
        String profileImage,
        String bio,
        Instant createdAt) { }