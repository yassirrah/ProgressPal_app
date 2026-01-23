package org.progresspalbackend.progresspalbackend.service;

import jakarta.annotation.Nullable;
import lombok.RequiredArgsConstructor;


import org.progresspalbackend.progresspalbackend.domain.Session;

import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.dto.session.SessionCreateDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionStopDto;
import org.progresspalbackend.progresspalbackend.mapper.SessionMapper;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepo;
    private final UserRepository userRepo;
    private final ActivityTypeRepository typeRepo;
    private final SessionMapper mapper;

    public SessionDto create(SessionCreateDto dto) {
        if(dto.activityTypeId() == null){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "activityTypeId cannot be null");
        }
        Session entity = mapper.toEntity(dto);
        entity.setUser(userRepo.getReferenceById(dto.userId()));
        entity.setActivityType(typeRepo.getReferenceById(dto.activityTypeId()));
        entity.setStartedAt(Instant.now());
        return mapper.toDto(sessionRepo.save(entity));
    }

    public List<SessionDto> findAll() {
        return sessionRepo.findAll().stream().map(mapper::toDto).toList();
    }

    public SessionDto update(UUID id, SessionCreateDto dto) {
        Session existing = sessionRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        // simple field updates
        existing.setTitle(dto.title());
        existing.setDescription(dto.description());
        existing.setVisibility(dto.visibility());

        // relation updates (only if changed)
        if (!existing.getUser().getId().equals(dto.userId())) {
            existing.setUser(userRepo.getReferenceById(dto.userId()));
        }
        if (!existing.getActivityType().getId().equals(dto.activityTypeId())) {
            existing.setActivityType(typeRepo.getReferenceById(dto.activityTypeId()));
        }

        return mapper.toDto(sessionRepo.save(existing));
    }

    public SessionDto stop(UUID id, UUID actorUserId, SessionStopDto body) {
        Session s = sessionRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        if(!s.getUser().getId().equals(actorUserId)){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot stop another user's session");
        }

        if(s.getEndedAt() != null){
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Session already stopped");
        }
        s.setEndedAt(Instant.now());
        return mapper.toDto(sessionRepo.save(s));
    }

    public List<SessionDto> findVisibleSessions(UUID actorUserId, UUID targetUserId, @Nullable Visibility visibility){
        boolean isOwner = targetUserId.equals(actorUserId);
        List<Session> sessions;
        if(isOwner) {
            if (visibility == null) {
                sessions = sessionRepo.findByUserIdOrderByStartedAtDesc(targetUserId);
            } else {
                sessions = sessionRepo.findByUserIdAndVisibilityOrderByStartedAtDesc(targetUserId, visibility);
            }
        }else{
            sessions = sessionRepo.findByUserIdAndVisibilityOrderByStartedAtDesc(targetUserId, Visibility.PUBLIC);
        }
        return sessions.stream().map(mapper::toDto).toList();
    }
}
