package org.progresspalbackend.progresspalbackend.web;

import lombok.RequiredArgsConstructor;

import org.progresspalbackend.progresspalbackend.config.CurrentUser;
import org.progresspalbackend.progresspalbackend.dto.activitytype.ActivityTypeCreateDto;
import org.progresspalbackend.progresspalbackend.dto.activitytype.ActivityTypeDto;
import org.progresspalbackend.progresspalbackend.service.ActivityTypeService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/activity-types")
@RequiredArgsConstructor
public class ActivityTypeController {

    private final ActivityTypeService service;
    private final CurrentUser currentUser;

    /* ── LIST ─────────────────────────────── */
    @GetMapping
    public List<ActivityTypeDto> list(Authentication authentication,
                                      @RequestParam(defaultValue = "ALL") String scope) {
        UUID userId = currentUser.id(authentication);
        return service.list(scope, userId);
    }

    /* ── GET ONE ──────────────────────────── */
    @GetMapping("/{id}")
    public ActivityTypeDto get(@PathVariable UUID id) {
        return service.find(id);
    }

    /* ── CREATE ───────────────────────────── */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityTypeDto create(@RequestBody ActivityTypeCreateDto dto,
                                  Authentication authentication) {
        UUID userId = currentUser.id(authentication);
        return service.create(dto, userId);
    }

    /* ── UPDATE ───────────────────────────── */
    @PutMapping("/{id}")
    public ActivityTypeDto update(@PathVariable UUID id,
                                  @RequestBody ActivityTypeCreateDto dto) {
        return service.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id,
            Authentication authentication) {
        UUID userId = currentUser.id(authentication);
        service.delete(userId, id);
    }
}
