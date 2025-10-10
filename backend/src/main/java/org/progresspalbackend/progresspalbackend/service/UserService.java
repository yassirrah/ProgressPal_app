package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.UserCreateDto;
import org.progresspalbackend.progresspalbackend.dto.UserDto;
import org.progresspalbackend.progresspalbackend.mapper.UserMapper;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
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

    public UserDto create(UserCreateDto dto) {
        User entity = mapper.toEntity(dto);
        entity.setCreatedAt(Instant.now());
        return mapper.toDto(repo.save(entity));
    }

    public List<UserDto> list() {
        return repo.findAll().stream()
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

        mapper.updateFromDto(dto, existing);
        existing.setUpdatedAt(Instant.now());

        return mapper.toDto(repo.save(existing));
    }
}