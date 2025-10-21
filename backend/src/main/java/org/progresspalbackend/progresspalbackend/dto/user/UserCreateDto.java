package org.progresspalbackend.progresspalbackend.dto.user;

public record UserCreateDto(
        String username,
        String email,
        String password,      // plain or already hashed – depends on flow
        String profileImage,
        String bio) { }