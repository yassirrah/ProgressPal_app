package org.progresspalbackend.progresspalbackend.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.dto.session.SessionCreateDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionStopDto;
import org.progresspalbackend.progresspalbackend.service.SessionService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
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
        return service.stop(id, userId, body==null? new SessionStopDto() : body);
    }
}