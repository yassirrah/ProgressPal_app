package org.progresspalbackend.progresspalbackend.dto.user;

public record UserCreateDto(
        String username,
        String email,
        String password,
        String profileImage,
        String bio) { }
