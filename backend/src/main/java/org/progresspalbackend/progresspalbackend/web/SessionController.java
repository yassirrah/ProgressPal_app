package org.progresspalbackend.progresspalbackend.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.progresspalbackend.progresspalbackend.dto.session.SessionCreateDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionGoalUpdateDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionProgressDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionStopDto;
import org.progresspalbackend.progresspalbackend.service.SessionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService service;

    @GetMapping
    public List<SessionDto> list() { return service.findAll(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionDto create(@Valid @RequestBody SessionCreateDto dto,
                             @RequestHeader("X-User-Id") UUID userId) {
        return service.create(dto, userId);
    }

    @PatchMapping("/{id}/stop")
    @ResponseStatus(HttpStatus.OK)
    public SessionDto stop(
            @PathVariable UUID id,
            @RequestHeader("X-User-Id") UUID userId,
            @RequestBody(required = false) SessionStopDto body
    ){
        return service.stop(id, userId, body == null ? new SessionStopDto(null) : body);
    }

    @PatchMapping("/{id}/goal")
    @ResponseStatus(HttpStatus.OK)
    public SessionDto updateGoal(
            @PathVariable UUID id,
            @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody SessionGoalUpdateDto body
    ) {
        return service.updateGoal(id, userId, body);
    }

    @PatchMapping("/{id}/progress")
    @ResponseStatus(HttpStatus.OK)
    public SessionDto updateProgress(
            @PathVariable UUID id,
            @RequestHeader("X-User-Id") UUID userId,
            @RequestBody SessionProgressDto body
    ) {
        return service.updateProgress(id, userId, body);
    }

    @PatchMapping("/{id}/pause")
    @ResponseStatus(HttpStatus.OK)
    public SessionDto pause(
            @PathVariable UUID id,
            @RequestHeader("X-User-Id") UUID userId
    ) {
        return service.pause(id, userId);
    }

    @PatchMapping("/{id}/resume")
    @ResponseStatus(HttpStatus.OK)
    public SessionDto resume(
            @PathVariable UUID id,
            @RequestHeader("X-User-Id") UUID userId
    ) {
        return service.resume(id, userId);
    }

    @GetMapping("/live")
    public ResponseEntity<SessionDto> live(
            @RequestHeader("X-User-Id") UUID userId){
        return service.getLiveSessionOfUser(userId).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
