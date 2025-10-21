package org.progresspalbackend.progresspalbackend.web;

import lombok.RequiredArgsConstructor;

import org.progresspalbackend.progresspalbackend.dto.activitytype.ActivityTypeCreateDto;
import org.progresspalbackend.progresspalbackend.dto.activitytype.ActivityTypeDto;
import org.progresspalbackend.progresspalbackend.service.ActivityTypeService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/activity-types")
@RequiredArgsConstructor
public class ActivityTypeController {

    private final ActivityTypeService service;

    /* ── LIST ─────────────────────────────── */
    @GetMapping
    public List<ActivityTypeDto> list() {
        return service.list();
    }

    /* ── GET ONE ──────────────────────────── */
    @GetMapping("/{id}")
    public ActivityTypeDto get(@PathVariable UUID id) {
        return service.find(id);
    }

    /* ── CREATE ───────────────────────────── */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityTypeDto create(@RequestBody ActivityTypeCreateDto dto) {
        return service.create(dto);
    }

    /* ── UPDATE ───────────────────────────── */
    @PutMapping("/{id}")
    public ActivityTypeDto update(@PathVariable UUID id,
                                  @RequestBody ActivityTypeCreateDto dto) {
        return service.update(id, dto);
    }
}