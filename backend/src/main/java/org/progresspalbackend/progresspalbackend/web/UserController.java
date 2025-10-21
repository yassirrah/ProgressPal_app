package org.progresspalbackend.progresspalbackend.web;

import lombok.RequiredArgsConstructor;

import org.progresspalbackend.progresspalbackend.dto.user.UserCreateDto;
import org.progresspalbackend.progresspalbackend.dto.user.UserDto;
import org.progresspalbackend.progresspalbackend.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService service;

    @GetMapping
    public List<UserDto> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public UserDto get(@PathVariable UUID id) {
        return service.find(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto create(@RequestBody UserCreateDto dto) {
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public UserDto update(@PathVariable UUID id,
                          @RequestBody UserCreateDto dto) {
        return service.update(id, dto);
    }
}
