package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.user.UserAccountUpdateDto;
import org.progresspalbackend.progresspalbackend.dto.user.UserCreateDto;
import org.progresspalbackend.progresspalbackend.dto.user.UserDto;
import org.progresspalbackend.progresspalbackend.mapper.UserMapper;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository repo;
    private final UserMapper mapper;
    private final PasswordEncoder passwordEncoder;

    public UserDto create(UserCreateDto dto) {
        User entity = mapper.toEntity(dto);
        entity.setPassword(encodeRequiredPassword(dto.password()));
        entity.setCreatedAt(Instant.now());
        return mapper.toDto(repo.save(entity));
    }

    public List<UserDto> list() {
        return repo.findAll().stream()
                .map(mapper::toDto)
                .toList();
    }

    public List<UserDto> searchByUsername(String query) {
        String normalized = query == null ? "" : query.trim();
        if (normalized.isBlank()) {
            return List.of();
        }

        return repo.findTop10ByUsernameContainingIgnoreCaseOrderByUsernameAsc(normalized).stream()
                .map(mapper::toDto)
                .toList();
    }

    public UserDto find(UUID id) {
        return repo.findById(id)
                .map(mapper::toDto)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));
    }

    public UserDto update(UUID id, UserCreateDto dto) {
        User existing = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));

        String previousPassword = existing.getPassword();
        mapper.updateFromDto(dto, existing);
        if (dto.password() == null || dto.password().isBlank()) {
            existing.setPassword(previousPassword);
        } else {
            existing.setPassword(passwordEncoder.encode(dto.password()));
        }
        existing.setUpdatedAt(Instant.now());

        return mapper.toDto(repo.save(existing));
    }

    public UserDto getAccount(UUID userId) {
        return repo.findById(userId)
                .map(mapper::toDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    public UserDto updateAccount(UUID userId, UserAccountUpdateDto dto) {
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }

        User existing = repo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (dto.username() != null) {
            String username = dto.username().trim();
            if (username.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "username cannot be blank");
            }
            if (repo.existsByUsernameIgnoreCaseAndIdNot(username, userId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "username already exists");
            }
            existing.setUsername(username);
        }

        if (dto.email() != null) {
            String email = dto.email().trim();
            if (email.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "email cannot be blank");
            }
            if (repo.existsByEmailIgnoreCaseAndIdNot(email, userId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "email already exists");
            }
            existing.setEmail(email);
        }

        if (dto.profileImage() != null) {
            String profileImage = dto.profileImage().trim();
            existing.setProfileImage(profileImage.isBlank() ? null : profileImage);
        }

        if (dto.bio() != null) {
            String bio = dto.bio().trim();
            existing.setBio(bio.isBlank() ? null : bio);
        }

        if (dto.newPassword() != null && !dto.newPassword().isBlank()) {
            if (isKeycloakLinked(existing)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password changes are disabled for Keycloak-linked accounts");
            }
            if (dto.currentPassword() == null || dto.currentPassword().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "currentPassword is required to change password");
            }
            if (!passwordMatches(dto.currentPassword(), existing.getPassword())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "currentPassword is invalid");
            }
            existing.setPassword(passwordEncoder.encode(dto.newPassword()));
        }

        existing.setUpdatedAt(Instant.now());
        return mapper.toDto(repo.save(existing));
    }

    private String encodeRequiredPassword(String rawPassword) {
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password is required");
        }
        return passwordEncoder.encode(rawPassword);
    }

    private boolean passwordMatches(String rawPassword, String storedPassword) {
        if (isBcryptHash(storedPassword)) {
            return passwordEncoder.matches(rawPassword, storedPassword);
        }
        return Objects.equals(rawPassword, storedPassword);
    }

    private boolean isBcryptHash(String value) {
        return value != null
                && (value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$"));
    }

    private boolean isKeycloakLinked(User user) {
        return user.getAuthIssuer() != null && !user.getAuthIssuer().isBlank()
                && user.getAuthSubject() != null && !user.getAuthSubject().isBlank();
    }
}
