package org.progresspalbackend.progresspalbackend.dto.user;

public record UserAccountUpdateDto(
        String username,
        String email,
        String profileImage,
        String bio,
        String currentPassword,
        String newPassword
) {
}
