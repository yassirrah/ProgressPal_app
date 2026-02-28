package org.progresspalbackend.progresspalbackend.dto.auth;

import org.progresspalbackend.progresspalbackend.dto.user.UserDto;

public record AuthLoginResponseDto(
        String token,
        UserDto user
) {
}
