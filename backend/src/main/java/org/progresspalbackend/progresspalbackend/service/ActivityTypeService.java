package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.dto.ActivityTypeCreateDto;
import org.progresspalbackend.progresspalbackend.dto.ActivityTypeDto;
import org.progresspalbackend.progresspalbackend.mapper.ActivityTypeMapper;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActivityTypeService {

    private final ActivityTypeRepository repo;
    private final ActivityTypeMapper mapper;

    public ActivityTypeDto create(ActivityTypeCreateDto dto) {
        ActivityType entity = mapper.toEntity(dto);
        return mapper.toDto(repo.save(entity));
    }

    public List<ActivityTypeDto> list() {
        return repo.findAll().stream().map(mapper::toDto).toList();
    }

    public ActivityTypeDto find(UUID id) {
        return mapper.toDto(repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "ActivityType not found")));
    }

    public ActivityTypeDto update(UUID id, ActivityTypeCreateDto dto) {
        ActivityType existing = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "ActivityType not found"));
        mapper.updateFromDto(dto, existing);
        return mapper.toDto(repo.save(existing));
    }
}