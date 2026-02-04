package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;

import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.activitytype.ActivityTypeCreateDto;
import org.progresspalbackend.progresspalbackend.dto.activitytype.ActivityTypeDto;
import org.progresspalbackend.progresspalbackend.mapper.ActivityTypeMapper;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActivityTypeService {

    private final ActivityTypeRepository repo;
    private final UserRepository userRepo;
    private final ActivityTypeMapper mapper;
    private final ActivityTypeRepository activityTypeRepository;

    public ActivityTypeDto create(ActivityTypeCreateDto dto, UUID user_id) {
        User user = userRepo.findById(user_id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if(activityTypeRepository.existsByNameIgnoreCaseAndCreatedBy(dto.name(), user)){
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This activity type already exists");
        }
        ActivityType entity = mapper.toEntity(dto);
        entity.setCreatedBy(user);
        entity.setCustom(true);
        ActivityType savedEntity = repo.save(entity);
        System.out.println("saved custom = " + savedEntity.isCustom());
        return mapper.toDto(savedEntity);
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