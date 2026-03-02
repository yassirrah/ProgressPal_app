package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.User;
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

    private String encodeRequiredPassword(String rawPassword) {
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password is required");
        }
        return passwordEncoder.encode(rawPassword);
    }
}
