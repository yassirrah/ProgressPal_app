package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.Activity;

import org.progresspalbackend.progresspalbackend.dto.ActivityCreateDto;
import org.progresspalbackend.progresspalbackend.dto.ActivityDto;
import org.progresspalbackend.progresspalbackend.mapper.ActivityMapper;
import org.progresspalbackend.progresspalbackend.repository.ActivityRepository;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActivityService {

    private final ActivityRepository activityRepo;
    private final UserRepository userRepo;
    private final ActivityTypeRepository typeRepo;
    private final ActivityMapper mapper;

    /* ────── CREATE ────── */
    public ActivityDto create(ActivityCreateDto dto) {
        Activity entity = mapper.toEntity(dto);

        // resolve relations
        entity.setUser(userRepo.getReferenceById(dto.userId()));
        entity.setActivityType(typeRepo.getReferenceById(dto.activityTypeId()));

        entity.setStartedAt(Instant.now());
        entity.setOngoing(true);

        return mapper.toDto(activityRepo.save(entity));
    }

    /* ────── LIST ALL ────── */
    public List<ActivityDto> findAll() {
        return activityRepo.findAll()
                .stream()
                .map(mapper::toDto)
                .toList();
    }

    /* ────── UPDATE ────── */
    public ActivityDto update(UUID id, ActivityCreateDto dto) {
        Activity existing = activityRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Activity not found"));

        mapper.updateFromDto(dto, existing);

        if (!existing.getUser().getId().equals(dto.userId())) {
            existing.setUser(userRepo.getReferenceById(dto.userId()));
        }
        if (!existing.getActivityType().getId().equals(dto.activityTypeId())) {
            existing.setActivityType(typeRepo.getReferenceById(dto.activityTypeId()));
        }
        return mapper.toDto(activityRepo.save(existing));
    }
}

