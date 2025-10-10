package org.progresspalbackend.progresspalbackend.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.dto.ActivityCreateDto;
import org.progresspalbackend.progresspalbackend.dto.ActivityDto;
import org.progresspalbackend.progresspalbackend.service.ActivityService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/activities")
@RequiredArgsConstructor
public class ActivityController {

    private final ActivityService service;

    @GetMapping
    public List<ActivityDto> list() { return service.findAll(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityDto create(@Valid @RequestBody ActivityCreateDto dto) {
        return service.create(dto);
    }
}

